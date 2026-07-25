import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .shared_models import SharedRide, SharedRideRider
from .models import Ride, RideStatus, PaymentMethod
from .services import RouteDistanceResolver, FareCalculator, RideMatchingService
from apps.payments.services import WalletService
from apps.payments.models import WalletTransaction
from .notifications import notify_student_ride_status

logger = logging.getLogger('apps.rides.shared')

class SharedRideService:
    @staticmethod
    def compute_fares(shared_ride: SharedRide) -> bool:
        """
        Computes the proportional fares for all riders in a shared ride.
        The anchor fare is the fare of the longest individual leg.
        Each rider pays proportionally based on their distance relative to the sum of all distances.
        Minimum fare rules are respected.
        """
        riders = shared_ride.riders.exclude(status=SharedRideRider.Status.CANCELLED)
        if not riders.exists():
            return False

        max_distance = Decimal('0')
        sum_distances = Decimal('0')

        # 1. Resolve distance for each rider to the drop-off point
        for rider in riders:
            try:
                route = RouteDistanceResolver.resolve(
                    pickup_latitude=float(rider.pickup_latitude),
                    pickup_longitude=float(rider.pickup_longitude),
                    dropoff_latitude=float(shared_ride.dropoff_latitude),
                    dropoff_longitude=float(shared_ride.dropoff_longitude),
                    vehicle_type=shared_ride.vehicle_type,
                    allow_haversine_fallback=True
                )
                rider.distance_km = Decimal(str(route.distance_km))
            except Exception as e:
                logger.error(f'Could not resolve route for SharedRideRider {rider.id}: {e}')
                rider.distance_km = Decimal('1.0')  # Fallback to prevent division by zero

            max_distance = max(max_distance, rider.distance_km)
            sum_distances += rider.distance_km

        if sum_distances == Decimal('0'):
            # Edge case, they are all at the drop-off
            sum_distances = Decimal('1')
            max_distance = Decimal('1')

        # 2. Compute the anchor fare based on the longest leg
        fare_data = FareCalculator.calculate(
            vehicle_type=shared_ride.vehicle_type,
            distance_km=float(max_distance),
            passenger_count=1  # The total shared ride only counts as 1 trip to the driver logically, or max seats? Let's use 1 for base.
        )
        
        anchor_fare = Decimal(str(fare_data['total_fare']))
        minimum_fare = Decimal(str(fare_data['minimum_fare']))

        total_collected = Decimal('0')

        # 3. Compute proportional shares
        for rider in riders:
            proportion = rider.distance_km / sum_distances
            raw_share = proportion * anchor_fare
            
            # Ensure each rider pays at least the platform minimum fare
            fare_share = max(raw_share, minimum_fare)
            rider.fare_share = round(fare_share, 2)
            rider.save(update_fields=['distance_km', 'fare_share'])
            
            total_collected += rider.fare_share

        shared_ride.anchor_distance_km = max_distance
        shared_ride.anchor_fare = anchor_fare
        shared_ride.total_collected = total_collected
        
        # Driver earnings + platform commission based on the total collected 
        # (excess minimums are passed to driver as bonus)
        commission_rate = Decimal(str(fare_data['commission_rate']))
        commission = round(total_collected * commission_rate, 2)
        
        shared_ride.platform_commission = commission
        shared_ride.driver_earnings = total_collected - commission
        
        shared_ride.save(update_fields=[
            'anchor_distance_km', 'anchor_fare', 'total_collected',
            'platform_commission', 'driver_earnings'
        ])
        return True

    @staticmethod
    @transaction.atomic
    def confirm_rider(rider: SharedRideRider) -> bool:
        """
        Debits the rider's wallet for their share and marks them as confirmed.
        """
        if rider.status == SharedRideRider.Status.CONFIRMED:
            return True
            
        shared_ride = rider.shared_ride
        
        if shared_ride.status != SharedRide.Status.GATHERING:
            raise ValueError('Shared ride is no longer accepting confirmations.')
            
        if not rider.fare_share:
            raise ValueError('Fare share not computed yet.')
            
        WalletService.debit(
            user=rider.user,
            amount=rider.fare_share,
            source=WalletTransaction.Source.RIDE_PAYMENT,
            narration=f'Shared Ride Escrow - {shared_ride.share_code}'
        )
        
        rider.status = SharedRideRider.Status.CONFIRMED
        rider.confirmed_at = timezone.now()
        rider.save(update_fields=['status', 'confirmed_at'])
        
        # Check if all active riders have confirmed
        active_riders = shared_ride.riders.exclude(status=SharedRideRider.Status.CANCELLED)
        all_confirmed = all(r.status == SharedRideRider.Status.CONFIRMED for r in active_riders)
        
        if all_confirmed and active_riders.count() > 1:
            # Note: We don't auto dispatch here because the creator might still want to wait for more friends
            pass

        return True

    @staticmethod
    @transaction.atomic
    def dispatch_ride(shared_ride: SharedRide) -> Ride:
        """
        Locks the shared ride and dispatches a single composite Ride to the driver pool.
        """
        if shared_ride.status != SharedRide.Status.GATHERING:
            raise ValueError(f'Cannot dispatch ride in {shared_ride.status} state.')

        active_riders = shared_ride.riders.filter(status=SharedRideRider.Status.CONFIRMED).order_by('joined_at')
        if active_riders.count() == 0:
            raise ValueError('No riders confirmed.')

        # 1. Update shared ride status
        shared_ride.status = SharedRide.Status.MATCHING
        shared_ride.save(update_fields=['status'])
        
        # 2. Re-compute final fares based on ONLY the confirmed riders, and refund diffs? 
        # For simplicity in v1, the fares are locked when confirmed. If someone cancels, their fare is refunded.
        # But if the anchor distance drops? Let's just keep it locked to whatever they paid.

        # 3. Create the underlying Ride object
        # We set the creator as the 'student' for the driver's perspective
        creator_rider = active_riders.filter(user=shared_ride.creator).first() or active_riders.first()
        
        # Collect waypoints for the driver
        waypoints = []
        for r in active_riders:
            waypoints.append({
                'latitude': float(r.pickup_latitude),
                'longitude': float(r.pickup_longitude),
                'address': r.pickup_address,
                'rider_name': r.user.get_full_name()
            })

        ride = Ride.objects.create(
            reference=f'RD{shared_ride.reference[2:]}', # Use same hex
            student=shared_ride.creator,
            status=RideStatus.SEARCHING,
            vehicle_type_requested=shared_ride.vehicle_type,
            requested_seats=active_riders.count(),
            pickup_latitude=creator_rider.pickup_latitude,
            pickup_longitude=creator_rider.pickup_longitude,
            pickup_address=creator_rider.pickup_address,
            dropoff_latitude=shared_ride.dropoff_latitude,
            dropoff_longitude=shared_ride.dropoff_longitude,
            dropoff_address=shared_ride.dropoff_address,
            payment_method=PaymentMethod.WALLET,
            is_paid=True, # Pre-paid by individuals
            base_fare=shared_ride.anchor_fare, # Driver sees anchor fare or total collected? Total collected.
            total_fare=shared_ride.total_collected,
            platform_commission=shared_ride.platform_commission,
            driver_earnings=shared_ride.driver_earnings,
            route_metadata={'shared_waypoints': waypoints},
        )
        
        shared_ride.ride = ride
        shared_ride.save(update_fields=['ride'])

        # Assign driver async or right here
        RideMatchingService.assign_driver(ride)
        
        return ride

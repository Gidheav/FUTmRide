import math
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrCampusAdmin
from .scheduled_models import (
    ScheduledRide,
    ScheduledRideStatus,
    PassengerStatus,
    ScheduledRideActivityLog
)
from .scheduled_views import scope_admin_queryset, refund_passenger

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance between two points in km."""
    R = 6371  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) * math.sin(dlon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class CompatibleRidesView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request, ride_id):
        qs = scope_admin_queryset(request.user, ScheduledRide.objects.all())
        try:
            source_ride = qs.get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            raise NotFound('Ride not found.')

        if source_ride.status != ScheduledRideStatus.SCHEDULED:
            return Response({'detail': 'Only scheduled rides can be migrated.'}, status=status.HTTP_400_BAD_REQUEST)

        # Find compatible rides
        compatible_rides = qs.filter(
            campus=source_ride.campus,
            status=ScheduledRideStatus.SCHEDULED
        ).exclude(id=source_ride.id)

        results = []
        for target in compatible_rides:
            # Check date within 1 day
            time_diff = abs((target.departure_date - source_ride.departure_date).days)
            if time_diff > 1:
                continue

            # Check distance
            orig_dist = haversine_distance(
                float(source_ride.origin_latitude), float(source_ride.origin_longitude),
                float(target.origin_latitude), float(target.origin_longitude)
            )
            dest_dist = haversine_distance(
                float(source_ride.destination_latitude), float(source_ride.destination_longitude),
                float(target.destination_latitude), float(target.destination_longitude)
            )

            if orig_dist > 2.0 or dest_dist > 2.0:
                continue

            # Calculate remaining seats
            active_passengers = target.passengers.exclude(status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW])
            total_seats = sum([bus.seated_capacity for bus in target.bus_assignments.all()])
            available_seats = total_seats - active_passengers.filter(seat_type='seated').count()
            total_standing = sum([bus.standing_capacity for bus in target.bus_assignments.all()])
            available_standing = total_standing - active_passengers.filter(seat_type='standing').count()

            results.append({
                'id': str(target.id),
                'reference': target.reference,
                'departure_date': target.departure_date,
                'window_start': target.window_start,
                'window_end': target.window_end,
                'origin_address': target.origin_address,
                'destination_address': target.destination_address,
                'available_seats': available_seats,
                'available_standing': available_standing,
                'standard_price': str(target.standard_price) if target.standard_enabled else None,
            })

        return Response(results)

class MigrateRideView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id):
        target_ride_id = request.data.get('target_ride_id')
        if not target_ride_id:
            return Response({'detail': 'target_ride_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = scope_admin_queryset(request.user, ScheduledRide.objects.all())
        try:
            source_ride = qs.get(id=ride_id)
            target_ride = qs.get(id=target_ride_id)
        except ScheduledRide.DoesNotExist:
            raise NotFound('Ride not found.')

        if not source_ride.can_cancel:
            return Response({'detail': 'Source ride cannot be cancelled or migrated.'}, status=status.HTTP_400_BAD_REQUEST)
        if target_ride.status != ScheduledRideStatus.SCHEDULED:
            return Response({'detail': 'Target ride is not in scheduled state.'}, status=status.HTTP_400_BAD_REQUEST)

        target_stops = list(target_ride.stops.all())
        active_passengers = list(source_ride.passengers.select_related('boarding_stop', 'alighting_stop').exclude(status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW]))

        migrated_count = 0
        unmigrated_count = 0

        for pax in active_passengers:
            # Match boarding stop
            matched_boarding = None
            if pax.boarding_stop:
                for ts in target_stops:
                    dist = haversine_distance(
                        float(pax.boarding_stop.latitude), float(pax.boarding_stop.longitude),
                        float(ts.latitude), float(ts.longitude)
                    )
                    if dist <= 0.5 and ts.is_pickup:
                        matched_boarding = ts
                        break
            
            # Match alighting stop
            matched_alighting = None
            if pax.alighting_stop:
                for ts in target_stops:
                    dist = haversine_distance(
                        float(pax.alighting_stop.latitude), float(pax.alighting_stop.longitude),
                        float(ts.latitude), float(ts.longitude)
                    )
                    if dist <= 0.5 and ts.is_dropoff:
                        matched_alighting = ts
                        break
            
            # If stops match or if they were using origin/dest natively
            if (not pax.boarding_stop or matched_boarding) and (not pax.alighting_stop or matched_alighting):
                # Try to handle price
                source_price = pax.amount_paid
                target_price = target_ride.get_tier_price(pax.pricing_tier)
                
                if target_price is None:
                    # Tier not supported on target
                    refund_passenger(pax, f'Ride migrated but {pax.pricing_tier} tier not supported on new ride')
                    pax.status = PassengerStatus.CANCELLED
                    pax.save(update_fields=['status'])
                    unmigrated_count += 1
                    continue
                
                if target_price < source_price:
                    # Refund difference
                    diff = source_price - target_price
                    from apps.payments.services import WalletService
                    from apps.payments.models import WalletTransaction
                    WalletService.credit(
                        user=pax.student,
                        amount=diff,
                        source=WalletTransaction.Source.RIDE_REFUND,
                        narration=f'Fare difference refund for migrated ride - {source_ride.reference}',
                        metadata={
                            'scheduled_passenger_id': str(pax.id),
                            'reason': 'Fare difference on migration'
                        }
                    )
                
                pax.ride = target_ride
                pax.boarding_stop = matched_boarding
                pax.alighting_stop = matched_alighting
                pax.bus_assignment = None
                pax.save(update_fields=['ride', 'boarding_stop', 'alighting_stop', 'bus_assignment'])
                migrated_count += 1
            else:
                # Refund
                refund_passenger(pax, 'Ride migrated but stops incompatible')
                pax.status = PassengerStatus.CANCELLED
                pax.save(update_fields=['status'])
                unmigrated_count += 1

        # Now cancel the source ride
        from .scheduled_models import BusAssignmentStatus
        buses = source_ride.bus_assignments.filter(status__in=[BusAssignmentStatus.ASSIGNED, BusAssignmentStatus.BOARDING, BusAssignmentStatus.LOADING])
        for bus in buses:
            if bus.driver:
                from .scheduled_models import ScheduledRideDriverInterest
                ScheduledRideDriverInterest.objects.filter(
                    ride=source_ride,
                    driver=bus.driver,
                    status='assigned'
                ).update(status='interested')
            bus.delete()

        source_ride.transition_to(ScheduledRideStatus.CANCELLED)
        source_ride.save(update_fields=['status', 'updated_at'])

        ScheduledRideActivityLog.objects.create(
            ride=source_ride,
            message=f"Ride migrated to {target_ride.reference}. {migrated_count} passengers moved, {unmigrated_count} refunded.",
            log_type='warning'
        )

        # Notify users...
        
        return Response({
            'migrated_count': migrated_count,
            'unmigrated_count': unmigrated_count,
            'source_cancelled': True,
        })

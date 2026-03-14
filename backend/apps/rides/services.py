import logging
from django.utils import timezone
from django.conf import settings
from apps.accounts.models import DriverProfile, UserRole
from .models import Ride, DriverRideRequest, RideStatus

logger = logging.getLogger('apps.rides')


class FareCalculator:
    BASE_FARE = {
        'motorcycle': 200,
        'tricycle': 300,
        'sedan': 500,
        'suv': 700,
        'minivan': 600,
    }
    PER_KM_RATE = {
        'motorcycle': 80,
        'tricycle': 100,
        'sedan': 150,
        'suv': 200,
        'minivan': 170,
    }
    MINIMUM_FARE = {
        'motorcycle': 250,
        'tricycle': 350,
        'sedan': 600,
        'suv': 800,
        'minivan': 700,
    }

    @classmethod
    def calculate(cls, vehicle_type: str, distance_km: float, surge_multiplier: float = 1.0) -> dict:
        vt = vehicle_type.lower()
        base = cls.BASE_FARE.get(vt, 500)
        per_km = cls.PER_KM_RATE.get(vt, 150)
        minimum = cls.MINIMUM_FARE.get(vt, 600)
        raw_fare = base + (per_km * distance_km)
        surged_fare = raw_fare * surge_multiplier
        final_fare = max(surged_fare, minimum)
        commission_rate = settings.TRIP_FARE_PLATFORM_COMMISSION_PERCENT / 100
        commission = final_fare * commission_rate
        driver_earnings = final_fare - commission
        return {
            'base_fare': round(base, 2),
            'total_fare': round(final_fare, 2),
            'platform_commission': round(commission, 2),
            'driver_earnings': round(driver_earnings, 2),
            'surge_multiplier': surge_multiplier,
        }


class RideMatchingService:
    @staticmethod
    def find_available_drivers(vehicle_type: str, exclude_driver_ids: list = None):
        qs = DriverProfile.objects.filter(
            verification_status=DriverProfile.VerificationStatus.APPROVED,
            is_online=True,
            is_on_trip=False,
            vehicle_type=vehicle_type,
            user__is_active=True,
        ).select_related('user')
        if exclude_driver_ids:
            qs = qs.exclude(user__id__in=exclude_driver_ids)
        return qs.order_by('-average_rating', '-acceptance_rate')

    @classmethod
    def assign_driver(cls, ride: Ride) -> bool:
        already_offered = list(
            DriverRideRequest.objects.filter(ride=ride).values_list('driver_id', flat=True)
        )
        drivers = cls.find_available_drivers(
            ride.vehicle_type_requested, exclude_driver_ids=already_offered
        )
        if not drivers.exists():
            ride.transition_to(RideStatus.CANCELLED_NO_DRIVER)
            ride.cancellation_reason = 'No available drivers found in your area.'
            ride.save()
            logger.info('ride_no_driver ride_ref=%s', ride.reference)
            return False

        driver_profile = drivers.first()
        DriverRideRequest.objects.create(
            ride=ride,
            driver=driver_profile.user,
        )
        ride.transition_to(RideStatus.DRIVER_ASSIGNED)
        ride.driver = driver_profile.user
        ride.save()
        driver_profile.is_on_trip = True
        driver_profile.save(update_fields=['is_on_trip'])
        logger.info(
            'ride_driver_assigned ride_ref=%s driver_id=%s',
            ride.reference,
            str(driver_profile.user.id),
        )
        return True
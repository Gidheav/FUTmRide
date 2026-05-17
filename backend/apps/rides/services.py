import logging
import math
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from apps.accounts.models import DriverProfile, UserRole
from apps.tracking.models import DriverLocation
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
        commission_rate = getattr(settings, 'PLATFORM_COMMISSION_RATE', 0.15)
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
        from .notifications import notify_student_ride_status
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
            notify_student_ride_status(ride)
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
        notify_student_ride_status(ride)
        logger.info(
            'ride_driver_assigned ride_ref=%s driver_id=%s',
            ride.reference,
            str(driver_profile.user.id),
        )
        return True


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    # Radius of Earth in km
    radius = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def get_available_drivers_nearby(
    latitude: float,
    longitude: float,
    radius_km: float,
    vehicle_type: str | None = None,
    max_age_seconds: int = 300,
    limit: int = 50,
):
    cutoff = timezone.now() - timedelta(seconds=max_age_seconds)
    # Rough bounding box to reduce candidate rows
    delta_lat = radius_km / 111.0
    delta_lng = radius_km / (111.0 * max(math.cos(math.radians(latitude)), 0.0001))

    qs = DriverLocation.objects.filter(
        updated_at__gte=cutoff,
        latitude__gte=latitude - delta_lat,
        latitude__lte=latitude + delta_lat,
        longitude__gte=longitude - delta_lng,
        longitude__lte=longitude + delta_lng,
        driver__is_active=True,
        driver__driver_profile__verification_status=DriverProfile.VerificationStatus.APPROVED,
        driver__driver_profile__is_online=True,
        driver__driver_profile__is_on_trip=False,
    ).select_related('driver', 'driver__driver_profile')

    if vehicle_type:
        qs = qs.filter(driver__driver_profile__vehicle_type=vehicle_type)

    candidates = []
    for loc in qs:
        dist_km = haversine_km(latitude, longitude, float(loc.latitude), float(loc.longitude))
        if dist_km <= radius_km:
            candidates.append((dist_km, loc))

    candidates.sort(key=lambda item: item[0])
    return candidates[:limit]

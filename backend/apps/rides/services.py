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
    """
    Calculates ride fares using admin-configured FareConfiguration and
    PlatformSettings from the database. Falls back to legacy hardcoded
    defaults if no active config row exists for a vehicle type.
    """

    # Legacy fallback defaults (used only if no DB config exists)
    _LEGACY_BASE = {
        'motorbike': 200, 'tricycle': 300, 'sedan': 500, 'mpv': 700,
    }
    _LEGACY_PER_KM = {
        'motorbike': 80, 'tricycle': 100, 'sedan': 150, 'mpv': 200,
    }
    _LEGACY_MIN = {
        'motorbike': 250, 'tricycle': 350, 'sedan': 600, 'mpv': 800,
    }

    @classmethod
    def calculate(
        cls,
        vehicle_type: str,
        distance_km: float,
        surge_multiplier: float = 1.0,
        passenger_count: int = 1,
        config_override: dict | None = None,
        settings_override: dict | None = None,
    ) -> dict:
        from apps.pricing.models import FareConfiguration, PlatformSettings

        vt = vehicle_type.lower()
        config = FareConfiguration.get_active(vt)
        platform = PlatformSettings.load()

        if config_override:
            base = float(config_override.get('base_fare', 0))
            per_km = float(config_override.get('per_km_rate', 0))
            minimum = float(config_override.get('minimum_fare', 0))
            booking_fee = float(config_override.get('booking_fee', 0))
            surge_enabled = bool(config_override.get('surge_enabled', True))
            max_surge = float(config_override.get('max_surge_multiplier', 2.5))
            source = 'draft_preview'
        elif config:
            base = float(config.base_fare)
            per_km = float(config.per_km_rate)
            minimum = float(config.minimum_fare)
            booking_fee = float(config.booking_fee)
            surge_enabled = config.surge_enabled
            max_surge = float(config.max_surge_multiplier)
            source = 'database'
        else:
            base = cls._LEGACY_BASE.get(vt, 500)
            per_km = cls._LEGACY_PER_KM.get(vt, 150)
            minimum = cls._LEGACY_MIN.get(vt, 600)
            booking_fee = 0
            surge_enabled = True
            max_surge = 2.5
            source = 'legacy_fallback'

        commission_rate = float(
            settings_override.get('commission_rate', platform.commission_rate)
            if settings_override else platform.commission_rate
        )
        max_distance = float(
            settings_override.get('max_distance_km', platform.max_distance_km)
            if settings_override else platform.max_distance_km
        )

        clamped = min(distance_km, max_distance) if max_distance > 0 else distance_km
        distance_clamped = distance_km > max_distance if max_distance > 0 else False
        passengers = max(int(passenger_count or 1), 1)

        effective_surge = surge_multiplier
        if surge_enabled:
            effective_surge = min(surge_multiplier, max_surge)
        else:
            effective_surge = 1.0

        distance_charge = per_km * clamped
        subtotal = base + distance_charge + booking_fee
        surged_fare = subtotal * effective_surge
        single_passenger_fare = max(surged_fare, minimum)
        final_fare = single_passenger_fare * passengers
        minimum_adjustment = round(max(0, minimum - surged_fare), 2)

        commission = final_fare * commission_rate
        driver_earnings = final_fare - commission

        return {
            'base_fare': round(base, 2),
            'per_km_rate': round(per_km, 2),
            'booking_fee': round(booking_fee, 2),
            'distance_km': round(clamped, 2),
            'input_distance_km': round(distance_km, 2),
            'distance_charge': round(distance_charge, 2),
            'subtotal': round(subtotal, 2),
            'surge_multiplier': round(effective_surge, 2),
            'requested_surge_multiplier': round(surge_multiplier, 2),
            'surge_enabled': surge_enabled,
            'max_surge_multiplier': round(max_surge, 2),
            'surged_amount': round(surged_fare - subtotal, 2) if effective_surge > 1 else 0,
            'minimum_fare': round(minimum, 2),
            'minimum_adjustment': minimum_adjustment,
            'passenger_count': passengers,
            'single_passenger_fare': round(single_passenger_fare, 2),
            'total_fare': round(final_fare, 2),
            'commission_rate': round(commission_rate, 4),
            'platform_commission': round(commission, 2),
            'driver_earnings': round(driver_earnings, 2),
            'distance_clamped': distance_clamped,
            'max_distance_km': round(max_distance, 2),
            'config_source': source,
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

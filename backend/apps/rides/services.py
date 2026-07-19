import logging
import math
import os
from datetime import timedelta
from dataclasses import dataclass
from django.utils import timezone
from django.conf import settings
import requests
from apps.accounts.models import DriverProfile, UserRole
from apps.tracking.models import DriverLocation
from .models import Ride, DriverRideRequest, RideStatus

logger = logging.getLogger('apps.rides')


@dataclass(frozen=True)
class RouteResolution:
    distance_km: float
    duration_minutes: int | None
    geometry: list[dict]
    provider: str
    confidence: str
    metadata: dict


class RouteDistanceResolver:
    """
    Resolves payable route distance on the backend.

    Today this uses configured road providers first and Haversine as a safe
    fallback. The future calibrated campus graph should plug into this class as
    the highest-priority provider without changing ride booking or pricing code.
    """

    DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org'
    HAVERSINE_ROAD_FACTOR = 1.25
    REQUEST_TIMEOUT_SECONDS = 6

    @staticmethod
    def _decode_google_polyline(encoded: str) -> list[dict]:
        """Decode Google's encoded overview polyline into map coordinates."""
        coordinates = []
        index = 0
        lat = 0
        lng = 0

        while index < len(encoded):
            shift = 0
            result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            delta_lat = ~(result >> 1) if result & 1 else result >> 1
            lat += delta_lat

            shift = 0
            result = 0
            while True:
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            delta_lng = ~(result >> 1) if result & 1 else result >> 1
            lng += delta_lng

            coordinates.append({
                'latitude': round(lat / 1e5, 6),
                'longitude': round(lng / 1e5, 6),
            })

        return coordinates

    @classmethod
    def resolve(
        cls,
        pickup_latitude: float,
        pickup_longitude: float,
        dropoff_latitude: float,
        dropoff_longitude: float,
        vehicle_type: str | None = None,
        allow_haversine_fallback: bool = True,
        preferred_route_index: int = 0,
        provider_override: str | None = None,
    ) -> RouteResolution:
        from apps.pricing.models import PlatformSettings
        from apps.rides.engine import CampusRouter

        # 1. Always attempt the calibrated Campus Graph first
        if provider_override in (None, '', 'calibrated_graph'):
            campus_router = CampusRouter(vehicle_type=vehicle_type)
            campus_route = campus_router.resolve(
                pickup_lat=pickup_latitude,
                pickup_lng=pickup_longitude,
                dropoff_lat=dropoff_latitude,
                dropoff_lng=dropoff_longitude,
            )
            if campus_route:
                return RouteResolution(
                    distance_km=campus_route['distance_km'],
                    duration_minutes=None,
                    geometry=campus_route['geometry'],
                    provider=campus_route['provider'],
                    confidence=campus_route['confidence'],
                    metadata={**campus_route.get('metadata', {}), 'route_index': 0},
                )

        # 2. Fallback to Platform Setting provider
        platform = PlatformSettings.load()
        provider = (provider_override or platform.distance_provider or 'haversine').lower()

        if provider == 'osrm':
            route = cls._resolve_osrm(
                pickup_latitude,
                pickup_longitude,
                dropoff_latitude,
                dropoff_longitude,
                vehicle_type=vehicle_type,
                route_index=preferred_route_index,
            )
            if route:
                return route

        if provider in ('google', 'google_driving', 'google_walking'):
            travel_mode = 'walking' if provider == 'google_walking' else 'driving'
            route = cls._resolve_google(
                pickup_latitude,
                pickup_longitude,
                dropoff_latitude,
                dropoff_longitude,
                vehicle_type=vehicle_type,
                route_index=preferred_route_index,
                travel_mode=travel_mode,
            )
            if route:
                return route

        if not allow_haversine_fallback:
            raise ValueError('No valid road route found for this trip.')

        return cls._resolve_haversine(
            pickup_latitude,
            pickup_longitude,
            dropoff_latitude,
            dropoff_longitude,
            requested_provider=provider,
            vehicle_type=vehicle_type,
        )

    @classmethod
    def _resolve_osrm(
        cls,
        pickup_latitude: float,
        pickup_longitude: float,
        dropoff_latitude: float,
        dropoff_longitude: float,
        vehicle_type: str | None = None,
        route_index: int = 0,
    ) -> RouteResolution | None:
        base_url = (
            getattr(settings, 'OSRM_BASE_URL', None)
            or os.getenv('OSRM_BASE_URL')
            or cls.DEFAULT_OSRM_BASE_URL
        ).rstrip('/')
        url = (
            f'{base_url}/route/v1/driving/'
            f'{pickup_longitude},{pickup_latitude};{dropoff_longitude},{dropoff_latitude}'
        )
        params = {
            'overview': 'full',
            'geometries': 'geojson',
            'alternatives': 'true',
            'steps': 'false',
        }

        try:
            response = requests.get(url, params=params, timeout=cls.REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning('route_osrm_failed error=%s', exc)
            return None

        routes = data.get('routes') or []
        if data.get('code') != 'Ok' or not routes:
            logger.warning('route_osrm_no_route code=%s', data.get('code'))
            return None

        route = routes[min(max(route_index, 0), len(routes) - 1)]
        distance_m = float(route.get('distance') or 0)
        if distance_m <= 0:
            return None

        coordinates = (
            ((route.get('geometry') or {}).get('coordinates') or [])
            if isinstance(route.get('geometry'), dict)
            else []
        )
        geometry = [
            {'latitude': round(float(lat), 6), 'longitude': round(float(lng), 6)}
            for lng, lat in coordinates
        ]
        duration_seconds = route.get('duration')

        return RouteResolution(
            distance_km=round(distance_m / 1000, 3),
            duration_minutes=round(float(duration_seconds) / 60) if duration_seconds else None,
            geometry=geometry,
            provider='osrm',
            confidence='high',
            metadata={
                'vehicle_type': vehicle_type,
                'distance_meters': round(distance_m, 2),
                'duration_seconds': round(float(duration_seconds), 2) if duration_seconds else None,
                'fallback_used': False,
                'route_index': route_index,
            },
        )

    @classmethod
    def _resolve_google(
        cls,
        pickup_latitude: float,
        pickup_longitude: float,
        dropoff_latitude: float,
        dropoff_longitude: float,
        vehicle_type: str | None = None,
        route_index: int = 0,
        travel_mode: str = 'driving',
    ) -> RouteResolution | None:
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', None) or os.getenv('GOOGLE_MAPS_API_KEY')
        if not api_key:
            return None

        url = 'https://maps.googleapis.com/maps/api/directions/json'
        params = {
            'origin': f'{pickup_latitude},{pickup_longitude}',
            'destination': f'{dropoff_latitude},{dropoff_longitude}',
            'mode': travel_mode,
            'alternatives': 'true',
            'key': api_key,
        }

        try:
            response = requests.get(url, params=params, timeout=cls.REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning('route_google_failed error=%s', exc)
            return None

        routes = data.get('routes') or []
        if data.get('status') != 'OK' or not routes:
            logger.warning('route_google_no_route status=%s', data.get('status'))
            return None

        route = routes[min(max(route_index, 0), len(routes) - 1)]
        legs = route.get('legs') or []
        overview_polyline = ((route.get('overview_polyline') or {}).get('points') or '')
        if not legs:
            return None

        distance_m = sum(float((leg.get('distance') or {}).get('value') or 0) for leg in legs)
        duration_seconds = sum(float((leg.get('duration') or {}).get('value') or 0) for leg in legs)
        if distance_m <= 0:
            return None

        geometry = []
        if overview_polyline:
            try:
                geometry = cls._decode_google_polyline(overview_polyline)
            except Exception as exc:
                logger.warning('route_google_polyline_decode_failed error=%s', exc)
                geometry = []
        if not geometry:
            geometry = [
                {'latitude': round(pickup_latitude, 6), 'longitude': round(pickup_longitude, 6)},
                {'latitude': round(dropoff_latitude, 6), 'longitude': round(dropoff_longitude, 6)},
            ]

        return RouteResolution(
            distance_km=round(distance_m / 1000, 3),
            duration_minutes=round(duration_seconds / 60) if duration_seconds else None,
            geometry=geometry,
            provider='google' if travel_mode == 'driving' else f'google_{travel_mode}',
            confidence='high',
            metadata={
                'vehicle_type': vehicle_type,
                'travel_mode': travel_mode,
                'distance_meters': round(distance_m, 2),
                'duration_seconds': round(duration_seconds, 2) if duration_seconds else None,
                'fallback_used': False,
                'geometry_source': 'overview_polyline' if overview_polyline else 'endpoints',
                'route_index': route_index,
            },
        )

    @classmethod
    def resolve_options(
        cls,
        pickup_latitude: float,
        pickup_longitude: float,
        dropoff_latitude: float,
        dropoff_longitude: float,
        vehicle_type: str | None = None,
    ) -> list[RouteResolution]:
        from apps.pricing.models import PlatformSettings
        from apps.rides.engine import CampusRouter

        options: list[RouteResolution] = []
        campus_router = CampusRouter(vehicle_type=vehicle_type)
        campus_route = campus_router.resolve(
            pickup_lat=pickup_latitude,
            pickup_lng=pickup_longitude,
            dropoff_lat=dropoff_latitude,
            dropoff_lng=dropoff_longitude,
        )
        if campus_route:
            options.append(RouteResolution(
                distance_km=campus_route['distance_km'],
                duration_minutes=None,
                geometry=campus_route['geometry'],
                provider=campus_route['provider'],
                confidence=campus_route['confidence'],
                metadata={**campus_route.get('metadata', {}), 'route_index': 0},
            ))

        platform = PlatformSettings.load()
        preferred_provider = (platform.distance_provider or 'osrm').lower()
        provider_order = ['google_walking', 'google_driving', preferred_provider, 'osrm']

        for provider in provider_order:
            if provider == 'osrm':
                options.extend(cls._resolve_osrm_options(
                    pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, vehicle_type=vehicle_type,
                ))
            elif provider == 'google_driving':
                options.extend(cls._resolve_google_options(
                    pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, vehicle_type=vehicle_type, travel_mode='driving',
                ))
            elif provider == 'google_walking':
                options.extend(cls._resolve_google_options(
                    pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, vehicle_type=vehicle_type, travel_mode='walking',
                ))

        return cls._dedupe_route_options(options)

    @staticmethod
    def _dedupe_route_options(routes: list[RouteResolution]) -> list[RouteResolution]:
        unique: list[RouteResolution] = []
        seen = set()
        for route in routes:
            if len(route.geometry) >= 2:
                first = route.geometry[0]
                last = route.geometry[-1]
                key = (
                    route.provider,
                    route.metadata.get('travel_mode'),
                    round(route.distance_km, 2),
                    round(float(first.get('latitude', 0)), 4),
                    round(float(first.get('longitude', 0)), 4),
                    round(float(last.get('latitude', 0)), 4),
                    round(float(last.get('longitude', 0)), 4),
                )
            else:
                key = (route.provider, route.metadata.get('travel_mode'), round(route.distance_km, 2))
            if key in seen:
                continue
            seen.add(key)
            unique.append(route)
        return unique[:6]

    @classmethod
    def _resolve_osrm_options(
        cls,
        pickup_latitude: float,
        pickup_longitude: float,
        dropoff_latitude: float,
        dropoff_longitude: float,
        vehicle_type: str | None = None,
    ) -> list[RouteResolution]:
        base_url = (
            getattr(settings, 'OSRM_BASE_URL', None)
            or os.getenv('OSRM_BASE_URL')
            or cls.DEFAULT_OSRM_BASE_URL
        ).rstrip('/')
        url = f'{base_url}/route/v1/driving/{pickup_longitude},{pickup_latitude};{dropoff_longitude},{dropoff_latitude}'
        try:
            response = requests.get(url, params={
                'overview': 'full',
                'geometries': 'geojson',
                'alternatives': 'true',
                'steps': 'false',
            }, timeout=cls.REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning('route_osrm_options_failed error=%s', exc)
            return []

        if data.get('code') != 'Ok' or not data.get('routes'):
            return []

        options = []
        for idx, route in enumerate(data.get('routes') or []):
            distance_m = float(route.get('distance') or 0)
            coords = ((route.get('geometry') or {}).get('coordinates') or [])
            if distance_m <= 0 or len(coords) < 2:
                continue
            geometry = [{'latitude': round(float(lat), 6), 'longitude': round(float(lng), 6)} for lng, lat in coords]
            duration_seconds = route.get('duration')
            options.append(RouteResolution(
                distance_km=round(distance_m / 1000, 3),
                duration_minutes=round(float(duration_seconds) / 60) if duration_seconds else None,
                geometry=geometry,
                provider='osrm',
                confidence='high',
                metadata={
                    'vehicle_type': vehicle_type,
                    'distance_meters': round(distance_m, 2),
                    'duration_seconds': round(float(duration_seconds), 2) if duration_seconds else None,
                    'fallback_used': False,
                    'route_index': idx,
                },
            ))
        return options

    @classmethod
    def _resolve_google_options(
        cls,
        pickup_latitude: float,
        pickup_longitude: float,
        dropoff_latitude: float,
        dropoff_longitude: float,
        vehicle_type: str | None = None,
        travel_mode: str = 'driving',
    ) -> list[RouteResolution]:
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', None) or os.getenv('GOOGLE_MAPS_API_KEY')
        if not api_key:
            return []
        try:
            response = requests.get('https://maps.googleapis.com/maps/api/directions/json', params={
                'origin': f'{pickup_latitude},{pickup_longitude}',
                'destination': f'{dropoff_latitude},{dropoff_longitude}',
                'mode': travel_mode,
                'alternatives': 'true',
                'key': api_key,
            }, timeout=cls.REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning('route_google_options_failed error=%s', exc)
            return []
        if data.get('status') != 'OK' or not data.get('routes'):
            return []

        options = []
        for idx, route in enumerate(data.get('routes') or []):
            legs = route.get('legs') or []
            distance_m = sum(float((leg.get('distance') or {}).get('value') or 0) for leg in legs)
            duration_seconds = sum(float((leg.get('duration') or {}).get('value') or 0) for leg in legs)
            encoded = ((route.get('overview_polyline') or {}).get('points') or '')
            try:
                geometry = cls._decode_google_polyline(encoded) if encoded else []
            except Exception:
                geometry = []
            if distance_m <= 0 or len(geometry) < 2:
                continue
            options.append(RouteResolution(
                distance_km=round(distance_m / 1000, 3),
                duration_minutes=round(duration_seconds / 60) if duration_seconds else None,
                geometry=geometry,
                provider='google' if travel_mode == 'driving' else f'google_{travel_mode}',
                confidence='high',
                metadata={
                    'vehicle_type': vehicle_type,
                    'travel_mode': travel_mode,
                    'distance_meters': round(distance_m, 2),
                    'duration_seconds': round(duration_seconds, 2) if duration_seconds else None,
                    'fallback_used': False,
                    'route_index': idx,
                },
            ))
        return options

    @classmethod
    def _resolve_haversine(
        cls,
        pickup_latitude: float,
        pickup_longitude: float,
        dropoff_latitude: float,
        dropoff_longitude: float,
        requested_provider: str = 'haversine',
        vehicle_type: str | None = None,
    ) -> RouteResolution:
        straight_km = haversine_km(
            pickup_latitude,
            pickup_longitude,
            dropoff_latitude,
            dropoff_longitude,
        )
        estimated_road_km = max(straight_km * cls.HAVERSINE_ROAD_FACTOR, 0.1)

        return RouteResolution(
            distance_km=round(estimated_road_km, 3),
            duration_minutes=None,
            geometry=[
                {'latitude': round(pickup_latitude, 6), 'longitude': round(pickup_longitude, 6)},
                {'latitude': round(dropoff_latitude, 6), 'longitude': round(dropoff_longitude, 6)},
            ],
            provider='haversine_fallback',
            confidence='low',
            metadata={
                'vehicle_type': vehicle_type,
                'requested_provider': requested_provider,
                'straight_line_km': round(straight_km, 3),
                'road_factor': cls.HAVERSINE_ROAD_FACTOR,
                'fallback_used': requested_provider != 'haversine',
            },
        )


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

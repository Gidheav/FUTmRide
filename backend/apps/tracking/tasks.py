from datetime import timedelta
from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from apps.accounts.models import DriverProfile
from apps.tracking.models import DispatchIncidentLog, DriverLocation
from apps.rides.garage_models import GarageRide, GarageRideStatus
from apps.rides.models import Ride, RideStatus
from apps.rides.services import get_available_drivers_nearby

INCIDENT_CACHE_KEY = 'dispatch_incidents'


def _get_setting(name: str, default):
    return getattr(settings, name, default)


def _cache_key(scope: str) -> str:
    return f'{INCIDENT_CACHE_KEY}:{scope}'


def _add_incident(bucket: dict, campus_id: str | None, incident: dict):
    bucket.setdefault('all', []).append(incident)
    if campus_id:
        bucket.setdefault(campus_id, []).append(incident)


def _persist_incidents(incidents: list[dict], now):
    for incident in incidents:
        DispatchIncidentLog.objects.update_or_create(
            incident_key=incident.get('id'),
            defaults={
                'incident_type': incident.get('type', ''),
                'severity': incident.get('severity', 'low'),
                'campus_id': incident.get('campus_id'),
                'ride_id': incident.get('ride_id'),
                'driver_id': incident.get('driver_id'),
                'message': incident.get('message', ''),
                'latitude': incident.get('latitude'),
                'longitude': incident.get('longitude'),
                'metadata': incident.get('metadata', {}),
            },
        )


@shared_task(bind=True, name='tracking.compute_dispatch_incidents')
def compute_dispatch_incidents(self):
    now = timezone.now()
    incidents_by_campus: dict[str, list[dict]] = {}

    ride_age_minutes = _get_setting('DISPATCH_INCIDENT_RIDE_AGE_MINUTES', 10)
    arrived_no_start_minutes = _get_setting('DISPATCH_INCIDENT_ARRIVED_NO_START_MINUTES', 7)
    no_driver_minutes = _get_setting('DISPATCH_INCIDENT_NO_DRIVER_MINUTES', 8)
    low_rating_threshold = _get_setting('DISPATCH_INCIDENT_LOW_RATING_THRESHOLD', 3.5)
    high_cancel_threshold = _get_setting('DISPATCH_INCIDENT_HIGH_CANCELLATION_THRESHOLD', 20)
    high_demand_lookback_minutes = _get_setting('DISPATCH_INCIDENT_HIGH_DEMAND_LOOKBACK_MINUTES', 10)
    high_demand_radius_km = _get_setting('DISPATCH_INCIDENT_HIGH_DEMAND_RADIUS_KM', 1.0)
    high_demand_ride_threshold = _get_setting('DISPATCH_INCIDENT_HIGH_DEMAND_RIDE_THRESHOLD', 3)
    high_demand_driver_threshold = _get_setting('DISPATCH_INCIDENT_HIGH_DEMAND_DRIVER_THRESHOLD', 1)
    max_high_demand_checks = _get_setting('DISPATCH_INCIDENT_HIGH_DEMAND_MAX_CHECKS', 15)

    # 1) Garage rides aging out
    cutoff = now - timedelta(minutes=ride_age_minutes)
    stale_garage = GarageRide.objects.filter(
        status__in=[GarageRideStatus.OPEN, GarageRideStatus.FULL],
        created_at__lte=cutoff,
    ).select_related('driver', 'driver__driver_profile')

    for ride in stale_garage[:100]:
        campus_id = str(getattr(ride.driver.driver_profile, 'campus_id', '') or '') or None
        incident = {
            'id': f'garage_age:{ride.id}',
            'type': 'garage_ride_age',
            'severity': 'medium',
            'ride_id': str(ride.id),
            'driver_id': str(ride.driver_id),
            'message': f'Garage ride {ride.reference} open for {ride_age_minutes}+ min',
            'created_at': now.isoformat(),
            'campus_id': campus_id,
            'latitude': float(ride.origin_latitude),
            'longitude': float(ride.origin_longitude),
        }
        _add_incident(incidents_by_campus, campus_id, incident)

    # 2) Ride requested but no driver assigned
    no_driver_cutoff = now - timedelta(minutes=no_driver_minutes)
    waiting_rides = Ride.objects.filter(
        status=RideStatus.SEARCHING,
        requested_at__lte=no_driver_cutoff,
    ).select_related('student', 'student__student_profile')

    for ride in waiting_rides[:120]:
        campus_id = str(getattr(ride.student.student_profile, 'campus_id', '') or '') or None
        incident = {
            'id': f'no_driver:{ride.id}',
            'type': 'no_driver_assigned',
            'severity': 'high',
            'ride_id': str(ride.id),
            'driver_id': None,
            'message': f'Ride {ride.reference} has no driver for {no_driver_minutes}+ min',
            'created_at': now.isoformat(),
            'campus_id': campus_id,
            'latitude': float(ride.pickup_latitude),
            'longitude': float(ride.pickup_longitude),
        }
        _add_incident(incidents_by_campus, campus_id, incident)

    # 3) Driver arrived but trip not started
    arrived_cutoff = now - timedelta(minutes=arrived_no_start_minutes)
    arrived_rides = Ride.objects.filter(
        status=RideStatus.DRIVER_ARRIVED,
        driver_arrived_at__lte=arrived_cutoff,
    ).select_related('driver', 'student', 'student__student_profile')

    for ride in arrived_rides[:120]:
        campus_id = str(getattr(ride.student.student_profile, 'campus_id', '') or '') or None
        incident = {
            'id': f'arrived_no_start:{ride.id}',
            'type': 'arrived_not_started',
            'severity': 'high',
            'ride_id': str(ride.id),
            'driver_id': str(ride.driver_id) if ride.driver_id else None,
            'message': f'Driver arrived for {ride.reference} but trip not started',
            'created_at': now.isoformat(),
            'campus_id': campus_id,
            'latitude': float(ride.pickup_latitude),
            'longitude': float(ride.pickup_longitude),
        }
        _add_incident(incidents_by_campus, campus_id, incident)

    # 4) Driver risk signals (low rating / high cancellations)
    risky_drivers = DriverProfile.objects.filter(
        is_online=True,
    ).select_related('user')

    risk_driver_ids = [str(profile.user_id) for profile in risky_drivers]
    location_map = {}
    if risk_driver_ids:
        for loc in DriverLocation.objects.filter(driver_id__in=risk_driver_ids):
            location_map[str(loc.driver_id)] = {
                'latitude': float(loc.latitude),
                'longitude': float(loc.longitude),
            }

    for profile in risky_drivers[:200]:
        is_low_rating = profile.average_rating is not None and float(profile.average_rating) < low_rating_threshold
        is_high_cancel = float(profile.cancellation_rate) >= high_cancel_threshold
        if not is_low_rating and not is_high_cancel:
            continue
        campus_id = str(profile.campus_id) if profile.campus_id else None
        flags = []
        if is_low_rating:
            flags.append('low rating')
        if is_high_cancel:
            flags.append('high cancellation rate')
        incident = {
            'id': f'driver_risk:{profile.user_id}',
            'type': 'driver_risk',
            'severity': 'medium',
            'ride_id': None,
            'driver_id': str(profile.user_id),
            'message': f'Driver {profile.user.full_name} flagged: {", ".join(flags)}',
            'created_at': now.isoformat(),
            'campus_id': campus_id,
        }
        loc = location_map.get(str(profile.user_id))
        if loc:
            incident['latitude'] = loc['latitude']
            incident['longitude'] = loc['longitude']
        _add_incident(incidents_by_campus, campus_id, incident)

    # 5) High demand zones with low supply
    demand_cutoff = now - timedelta(minutes=high_demand_lookback_minutes)
    demand_rides = Ride.objects.filter(
        status=RideStatus.SEARCHING,
        requested_at__gte=demand_cutoff,
    ).select_related('student', 'student__student_profile')

    checked = 0
    for ride in demand_rides:
        if checked >= max_high_demand_checks:
            break
        checked += 1
        lat = float(ride.pickup_latitude)
        lng = float(ride.pickup_longitude)
        lat_delta = high_demand_radius_km / 111.0
        lng_delta = high_demand_radius_km / 111.0

        nearby_rides = demand_rides.filter(
            pickup_latitude__gte=lat - lat_delta,
            pickup_latitude__lte=lat + lat_delta,
            pickup_longitude__gte=lng - lng_delta,
            pickup_longitude__lte=lng + lng_delta,
        ).count()

        if nearby_rides < high_demand_ride_threshold:
            continue

        nearby = get_available_drivers_nearby(lat, lng, high_demand_radius_km, max_age_seconds=300, limit=5)
        if len(nearby) <= high_demand_driver_threshold:
            campus_id = str(getattr(ride.student.student_profile, 'campus_id', '') or '') or None
            incident = {
                'id': f'high_demand:{ride.id}',
                'type': 'high_demand_shortage',
                'severity': 'high',
                'ride_id': str(ride.id),
                'driver_id': None,
                'message': f'High demand area with low supply near {ride.pickup_address}',
                'created_at': now.isoformat(),
                'campus_id': campus_id,
                'latitude': float(ride.pickup_latitude),
                'longitude': float(ride.pickup_longitude),
            }
            _add_incident(incidents_by_campus, campus_id, incident)

    # Store to cache per campus + all
    ttl = _get_setting('DISPATCH_INCIDENT_CACHE_TTL_SECONDS', 120)
    for campus_id, items in incidents_by_campus.items():
        cache.set(_cache_key(campus_id), items, ttl)

    all_incidents = incidents_by_campus.get('all', [])
    _persist_incidents(all_incidents, now)
    cache.set(_cache_key('all'), all_incidents, ttl)
    cache.set('dispatch_incidents:last_run', now.isoformat(), ttl)
    cache.set('dispatch_incidents:last_count', len(all_incidents), ttl)

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)('campus_admin_incidents_all', {
            'type': 'incident_update',
            'incidents': all_incidents,
        })

        for campus_id, items in incidents_by_campus.items():
            if campus_id == 'all':
                continue
            async_to_sync(channel_layer.group_send)(f'campus_admin_incidents_{campus_id}', {
                'type': 'incident_update',
                'incidents': items,
            })

    return {
        'count': len(all_incidents),
        'campus_keys': list(incidents_by_campus.keys()),
    }

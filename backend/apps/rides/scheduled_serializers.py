import datetime
import math
import urllib.parse
import urllib.request
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import CampusAdminProfile, DriverProfile, User, UserRole
from apps.payments.models import WalletTransaction
from apps.payments.services import WalletService
from apps.rides.services import FareCalculator
from apps.rides.route_display import scheduled_endpoint_names
from .scheduled_models import (
    PassengerStatus,
    PricingTier,
    ScheduledRide,
    ScheduledRideBusAssignment,
    ScheduledRidePassenger,
    ScheduledRideStatus,
    ScheduledRideStop,
    VehicleClass,
)



def get_admin_campus(user):
    try:
        return user.campus_admin_profile.campus
    except CampusAdminProfile.DoesNotExist:
        return None


def combine_local(departure_date, departure_time):
    return timezone.make_aware(
        datetime.datetime.combine(departure_date, departure_time),
        timezone.get_current_timezone(),
    )


def generate_scheduled_reference():
    for _ in range(8):
        reference = 'SR-' + uuid.uuid4().hex[:8].upper()
        if not ScheduledRide.objects.filter(reference=reference).exists():
            return reference
    return 'SR-' + uuid.uuid4().hex[:12].upper()


def _as_float(value):
    return float(value or 0)


def _point_value(point, key):
    if isinstance(point, dict):
        return point.get(key)
    return getattr(point, key)


def _haversine_km(a, b):
    radius_km = 6371.0
    lat1 = math.radians(_as_float(_point_value(a, 'latitude')))
    lon1 = math.radians(_as_float(_point_value(a, 'longitude')))
    lat2 = math.radians(_as_float(_point_value(b, 'latitude')))
    lon2 = math.radians(_as_float(_point_value(b, 'longitude')))
    d_lat = lat2 - lat1
    d_lon = lon2 - lon1
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    )
    return 2 * radius_km * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def _route_path_between(a, b):
    coords = (
        f"{_as_float(_point_value(a, 'longitude'))},{_as_float(_point_value(a, 'latitude'))};"
        f"{_as_float(_point_value(b, 'longitude'))},{_as_float(_point_value(b, 'latitude'))}"
    )
    query = urllib.parse.urlencode({
        'overview': 'full',
        'geometries': 'geojson',
        'alternatives': 'false',
        'steps': 'false',
    })
    url = f'https://router.project-osrm.org/route/v1/driving/{coords}?{query}'
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            import json

            payload = json.loads(response.read().decode('utf-8'))
        if payload.get('code') == 'Ok' and payload.get('routes'):
            route = payload['routes'][0]
            coordinates = route.get('geometry', {}).get('coordinates') or []
            path = [
                {'latitude': coord[1], 'longitude': coord[0]}
                for coord in coordinates
            ]
            if len(path) >= 2:
                return path, float(route.get('distance') or 0) / 1000
    except Exception:
        pass

    fallback_path = [
        {'latitude': _point_value(a, 'latitude'), 'longitude': _point_value(a, 'longitude')},
        {'latitude': _point_value(b, 'latitude'), 'longitude': _point_value(b, 'longitude')},
    ]
    return fallback_path, _haversine_km(a, b) * 1.25


def _path_cumulative_km(path):
    cumulative = [0.0]
    for idx in range(1, len(path)):
        cumulative.append(cumulative[-1] + _haversine_km(path[idx - 1], path[idx]))
    return cumulative


def _project_point_to_route(point, path, path_cumulative):
    point_lat = _as_float(_point_value(point, 'latitude'))
    point_lng = _as_float(_point_value(point, 'longitude'))
    origin_lat = math.radians(point_lat)
    meters_per_deg_lat = 111_320
    meters_per_deg_lng = 111_320 * math.cos(origin_lat)

    def to_xy(lat, lng):
        return lng * meters_per_deg_lng, lat * meters_per_deg_lat

    px, py = to_xy(point_lat, point_lng)
    best_offset_m = float('inf')
    best_along_km = 0.0

    for idx in range(1, len(path)):
        ax, ay = to_xy(_as_float(path[idx - 1]['latitude']), _as_float(path[idx - 1]['longitude']))
        bx, by = to_xy(_as_float(path[idx]['latitude']), _as_float(path[idx]['longitude']))
        dx = bx - ax
        dy = by - ay
        segment_len_sq = dx * dx + dy * dy
        if segment_len_sq == 0:
            t = 0
        else:
            t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / segment_len_sq))
        nearest_x = ax + t * dx
        nearest_y = ay + t * dy
        offset_m = math.hypot(px - nearest_x, py - nearest_y)
        if offset_m < best_offset_m:
            best_offset_m = offset_m
            segment_km = max(0, path_cumulative[idx] - path_cumulative[idx - 1])
            best_along_km = path_cumulative[idx - 1] + (segment_km * t)

    return best_along_km, best_offset_m


def get_scheduled_fare_vehicle_type(ride):
    vehicle_types = ride.allowed_vehicle_types or []
    if vehicle_types:
        return vehicle_types[0]
    return VehicleClass.SEDAN


def get_route_cumulative_distances(stops, validate=False):
    ordered = sorted(stops, key=lambda stop: _point_value(stop, 'order'))
    if len(ordered) < 2:
        return ordered, [0.0]

    path, total_km = _route_path_between(ordered[0], ordered[-1])
    path_cumulative = _path_cumulative_km(path)
    if total_km > 0 and path_cumulative:
        scale = total_km / path_cumulative[-1] if path_cumulative[-1] else 1
        path_cumulative = [value * scale for value in path_cumulative]

    positions = []
    offsets = []
    for idx, stop in enumerate(ordered):
        if idx == 0:
            positions.append(0.0)
            offsets.append(0.0)
        elif idx == len(ordered) - 1:
            positions.append(total_km or path_cumulative[-1])
            offsets.append(0.0)
        else:
            along_km, offset_m = _project_point_to_route(stop, path, path_cumulative)
            positions.append(along_km)
            offsets.append(offset_m)

    if validate:
        far_stops = [
            _point_value(stop, 'name') or f"Stop {_point_value(stop, 'order')}"
            for stop, offset_m in zip(ordered, offsets)
            if offset_m > 1000
        ]
        if far_stops:
            raise serializers.ValidationError({
                'stops': f"Stops must be within 1km of the origin-to-destination route: {', '.join(far_stops)}.",
            })
        if any(positions[idx] <= positions[idx - 1] for idx in range(1, len(positions))):
            raise serializers.ValidationError({
                'stops': 'Stops must follow the same order as the origin-to-destination road route.',
            })

    return ordered, positions


def calculate_scheduled_segment_fare(ride, boarding_stop, alighting_stop, tier=PricingTier.STANDARD):
    """Proportional fare from admin-set price. No FareCalculator invocation."""
    stops, cumulative = get_route_cumulative_distances(list(ride.stops.all()), validate=False)
    order_to_index = {stop.order: idx for idx, stop in enumerate(stops)}
    board_idx = order_to_index.get(boarding_stop.order)
    alight_idx = order_to_index.get(alighting_stop.order)
    if board_idx is None or alight_idx is None or alight_idx <= board_idx:
        raise serializers.ValidationError({
            'alighting_stop_id': 'Alighting stop must come after boarding stop on the route.',
        })

    total_distance = max(Decimal('0.01'), Decimal(str(cumulative[-1])))
    segment_distance = max(Decimal('0.01'), Decimal(str(cumulative[alight_idx] - cumulative[board_idx])))
    ratio = segment_distance / total_distance

    # Pick the base price from admin-set values based on tier
    if tier == PricingTier.STANDING and ride.standing_enabled:
        full_price = ride.standing_price
    else:
        full_price = ride.standard_price

    amount = (full_price * ratio).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return amount


def build_scheduled_fare_matrix(ride):
    """Proportional fare matrix from admin-set prices. No FareCalculator invocation."""
    stops, cumulative = get_route_cumulative_distances(list(ride.stops.all()))
    total_distance = max(Decimal('0.01'), Decimal(str(cumulative[-1]))) if len(cumulative) >= 2 else Decimal('1')
    rows = []
    for from_idx, boarding in enumerate(stops[:-1]):
        for to_idx in range(from_idx + 1, len(stops)):
            alighting = stops[to_idx]
            segment_distance = max(Decimal('0.01'), Decimal(str(cumulative[to_idx] - cumulative[from_idx])))
            ratio = segment_distance / total_distance

            standard_fare = (ride.standard_price * ratio).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            standing_fare = None
            if ride.standing_enabled and ride.standing_price > 0:
                standing_fare = (ride.standing_price * ratio).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            rows.append({
                'boarding_stop_id': str(boarding.id),
                'boarding_stop_name': boarding.name,
                'boarding_stop_address': boarding.address,
                'boarding_order': boarding.order,
                'alighting_stop_id': str(alighting.id),
                'alighting_stop_name': alighting.name,
                'alighting_stop_address': alighting.address,
                'alighting_order': alighting.order,
                'distance_km': round(float(segment_distance), 3),
                'standard_fare': str(standard_fare),
                'standing_fare': str(standing_fare) if standing_fare is not None else None,
            })
    return rows


def get_full_route_fare_summary(ride):
    """Return admin-stored price directly. No FareCalculator invocation."""
    stops, cumulative = get_route_cumulative_distances(list(ride.stops.all()))
    if len(stops) < 2:
        return None
    distance_km = max(0.01, cumulative[-1])
    return {
        'vehicle_type': get_scheduled_fare_vehicle_type(ride),
        'distance_km': round(distance_km, 3),
        'fare': float(ride.standard_price),
        'standing_fare': float(ride.standing_price) if ride.standing_enabled else None,
    }


class ScheduledRideStopSerializer(serializers.ModelSerializer):
    address = serializers.CharField(max_length=255, allow_blank=False)

    class Meta:
        model = ScheduledRideStop
        fields = [
            'id', 'order', 'name', 'address', 'latitude', 'longitude',
            'estimated_arrival_offset_min', 'is_pickup', 'is_dropoff',
        ]
        read_only_fields = ['id']


class StopUpdateSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)
    address = serializers.CharField(max_length=255, allow_blank=False)

    class Meta:
        model = ScheduledRideStop
        fields = [
            'id', 'order', 'name', 'address', 'latitude', 'longitude',
            'estimated_arrival_offset_min', 'is_pickup', 'is_dropoff',
        ]

class ScheduledRideStopsUpdateSerializer(serializers.Serializer):
    stops = StopUpdateSerializer(many=True)

    def validate_stops(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('At least origin and destination stops are required.')
        orders = [stop['order'] for stop in value]
        expected = list(range(1, len(value) + 1))
        if sorted(orders) != expected:
            raise serializers.ValidationError(f'Stop order must be contiguous from 1 to {len(value)}.')
        for stop in value:
            if not stop.get('is_pickup', True) and not stop.get('is_dropoff', True):
                raise serializers.ValidationError('Each stop must allow pickup, dropoff, or both.')
        sorted_value = sorted(value, key=lambda item: item['order'])
        get_route_cumulative_distances(sorted_value, validate=False)
        return sorted_value

class ScheduledRideCreateSerializer(serializers.ModelSerializer):
    stops = ScheduledRideStopSerializer(many=True)
    assigned_driver = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=UserRole.DRIVER),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ScheduledRide
        fields = [
            'departure_date', 'window_start', 'window_end',
            'origin_address', 'origin_latitude', 'origin_longitude',
            'destination_address', 'destination_latitude', 'destination_longitude',
            'allowed_vehicle_types', 'cargo_capacity_kg', 'assigned_driver',
            'standard_enabled', 'standard_price',
            'standing_enabled', 'standing_price',
            'premium_enabled', 'premium_price',
            'freight_enabled', 'freight_price',
            'admin_notes', 'stops',
        ]

    def validate_cargo_capacity_kg(self, value):
        if value < 0 or value > 2000:
            raise serializers.ValidationError('Cargo capacity must be between 0 and 2000 kg.')
        return value

    def validate_departure_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError('Departure date cannot be in the past.')
        return value

    def validate_stops(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('At least origin and destination stops are required.')
        orders = [stop['order'] for stop in value]
        expected = list(range(1, len(value) + 1))
        if sorted(orders) != expected:
            raise serializers.ValidationError(f'Stop order must be contiguous from 1 to {len(value)}.')
        for stop in value:
            if not stop.get('is_pickup', True) and not stop.get('is_dropoff', True):
                raise serializers.ValidationError('Each stop must allow pickup, dropoff, or both.')
        sorted_value = sorted(value, key=lambda item: item['order'])
        get_route_cumulative_distances(sorted_value, validate=False)
        return sorted_value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        user = self.context['request'].user
        campus = get_admin_campus(user)
        if not campus:
            raise serializers.ValidationError('Only campus admins with an assigned campus can create scheduled rides.')

        departure_date = attrs.get('departure_date')
        window_start = attrs.get('window_start')
        window_end = attrs.get('window_end')

        if window_start and window_end:
            if window_end <= window_start:
                raise serializers.ValidationError({'window_end': 'Departure window end must be after start.'})
            start_dt = datetime.datetime.combine(datetime.date.today(), window_start)
            end_dt = datetime.datetime.combine(datetime.date.today(), window_end)
            diff = end_dt - start_dt
            if diff < datetime.timedelta(minutes=30):
                raise serializers.ValidationError({'window_end': 'Departure window must be at least 30 minutes.'})
            if diff > datetime.timedelta(hours=12):
                raise serializers.ValidationError({'window_end': 'Departure window cannot exceed 12 hours.'})

        if departure_date and window_start:
            departure_dt = combine_local(departure_date, window_start)
            if departure_dt <= timezone.now():
                raise serializers.ValidationError({'window_start': 'Departure time must be in the future.'})

        allowed_vehicle_types = attrs.get('allowed_vehicle_types', [])
        if not isinstance(allowed_vehicle_types, list) or not allowed_vehicle_types:
            raise serializers.ValidationError({'allowed_vehicle_types': 'Must provide a list of allowed vehicle types.'})

        # Block motorbike and tricycle for scheduled rides
        DISALLOWED_SCHEDULED = {'motorbike', 'tricycle'}
        invalid = set(allowed_vehicle_types) & DISALLOWED_SCHEDULED
        if invalid:
            raise serializers.ValidationError({
                'allowed_vehicle_types': 'Motorbike and Tricycle are not allowed for scheduled rides.',
            })

        attrs['standard_enabled'] = True
        # Standing is auto-enabled for coach, disabled for all others
        has_coach = 'coach' in allowed_vehicle_types
        attrs['standing_enabled'] = has_coach
        attrs['premium_enabled'] = False
        attrs['freight_enabled'] = False
        attrs['standing_price'] = Decimal('0')  # Will be set after standard_price is finalized in create()
        attrs['premium_price'] = Decimal('0')
        attrs['freight_price'] = Decimal('0')
        attrs['cargo_capacity_kg'] = 0

        assigned_driver = attrs.get('assigned_driver')
        if assigned_driver:
            self._validate_assigned_driver(assigned_driver, campus, allowed_vehicle_types)
            self._validate_assigned_driver_window(assigned_driver, departure_date, window_start)

        self._validate_route_window(campus, attrs, departure_date, window_start)
        return attrs

    def _validate_assigned_driver(self, driver, campus, allowed_vehicle_types):
        try:
            profile = driver.driver_profile
        except DriverProfile.DoesNotExist:
            raise serializers.ValidationError({'assigned_driver': 'Assigned driver does not have a fleet profile.'})
        if not driver.is_active:
            raise serializers.ValidationError({'assigned_driver': 'Assigned driver account is inactive.'})
        if profile.campus_id != campus.id:
            raise serializers.ValidationError({'assigned_driver': 'Assigned driver must belong to this campus.'})
        if profile.verification_status != DriverProfile.VerificationStatus.APPROVED:
            raise serializers.ValidationError({'assigned_driver': 'Assigned driver must be approved.'})
        if profile.maintenance_status != DriverProfile.MaintenanceStatus.ACTIVE:
            raise serializers.ValidationError({'assigned_driver': 'Assigned vehicle must be active.'})
        
        if profile.vehicle_type not in allowed_vehicle_types:
            raise serializers.ValidationError({
                'assigned_driver': f'Assigned driver vehicle type ({profile.vehicle_type}) is not in allowed types: {allowed_vehicle_types}.',
            })

    def _validate_route_window(self, campus, attrs, departure_date, window_start):
        if not departure_date or not window_start:
            return
        existing = ScheduledRide.objects.filter(
            campus=campus,
            departure_date=departure_date,
            status__in=[ScheduledRideStatus.SCHEDULED, ScheduledRideStatus.BOARDING],
            origin_address__iexact=attrs.get('origin_address', '').strip(),
            destination_address__iexact=attrs.get('destination_address', '').strip(),
        ).values_list('window_start', flat=True)
        self._reject_conflicting_starts(
            existing,
            window_start,
            'window_start',
            'Departure windows on the same route must be at least 30 minutes apart.',
        )

    def _validate_assigned_driver_window(self, driver, departure_date, window_start):
        if not departure_date or not window_start:
            return
        existing = ScheduledRide.objects.filter(
            assigned_driver=driver,
            departure_date=departure_date,
            status__in=[ScheduledRideStatus.SCHEDULED, ScheduledRideStatus.BOARDING],
        ).values_list('window_start', flat=True)
        self._reject_conflicting_starts(
            existing,
            window_start,
            'assigned_driver',
            'Assigned driver already has a scheduled ride within 30 minutes.',
        )

    def _reject_conflicting_starts(self, existing_starts, window_start, field, message):
        new_start = datetime.datetime.combine(datetime.date.today(), window_start)
        for existing_start in existing_starts:
            existing_dt = datetime.datetime.combine(datetime.date.today(), existing_start)
            if abs((new_start - existing_dt).total_seconds()) < 1800:
                raise serializers.ValidationError({field: message})

    def create(self, validated_data):
        stops_data = validated_data.pop('stops')
        user = self.context['request'].user
        campus = get_admin_campus(user)
        deadline_dt = combine_local(validated_data['departure_date'], validated_data['window_end'])
        deadline_dt -= datetime.timedelta(minutes=5)

        ordered_stops = sorted(stops_data, key=lambda item: item['order'])
        origin = ordered_stops[0]
        destination = ordered_stops[-1]
        validated_data.update({
            'origin_address': origin['address'],
            'origin_latitude': origin['latitude'],
            'origin_longitude': origin['longitude'],
            'destination_address': destination['address'],
            'destination_latitude': destination['latitude'],
            'destination_longitude': destination['longitude'],
        })

        ride = ScheduledRide.objects.create(
            reference=generate_scheduled_reference(),
            created_by=user,
            campus=campus,
            join_deadline=deadline_dt,
            **validated_data,
        )
        ScheduledRideStop.objects.bulk_create([
            ScheduledRideStop(ride=ride, **stop_data) for stop_data in stops_data
        ])
        full_route = get_full_route_fare_summary(ride)
        if full_route:
            ride.standard_price = Decimal(str(full_route['fare'])).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP,
            )
            # Auto-set standing price to 80% of standard for coach
            if 'coach' in (ride.allowed_vehicle_types or []):
                ride.standing_enabled = True
                ride.standing_price = (ride.standard_price * Decimal('0.80')).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP,
                )
            ride.save(update_fields=['standard_price', 'standing_enabled', 'standing_price', 'updated_at'])
        return ride


class ScheduledRideListSerializer(serializers.ModelSerializer):
    passenger_count = serializers.IntegerField(read_only=True)
    is_joinable = serializers.BooleanField(read_only=True)
    enabled_tiers = serializers.ListField(read_only=True)
    stops = ScheduledRideStopSerializer(many=True, read_only=True)
    stops_count = serializers.SerializerMethodField()
    origin_name = serializers.SerializerMethodField()
    destination_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_driver_name = serializers.SerializerMethodField()
    fare_summary = serializers.SerializerMethodField()
    is_joined_by_me = serializers.SerializerMethodField()
    my_ticket = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledRide
        fields = [
            'id', 'reference', 'departure_date', 'window_start', 'window_end', 'join_deadline',
            'origin_address', 'origin_name', 'origin_latitude', 'origin_longitude',
            'destination_address', 'destination_name', 'destination_latitude', 'destination_longitude',
            'allowed_vehicle_types', 'cargo_capacity_kg',
            'assigned_driver', 'assigned_driver_name', 'status',
            'standard_enabled', 'standard_price', 'standing_enabled', 'standing_price',
            'premium_enabled', 'premium_price', 'freight_enabled', 'freight_price',
            'passenger_count', 'is_joinable', 'enabled_tiers', 'stops', 'stops_count',
            'created_by_name', 'admin_notes', 'fare_summary', 'created_at',
            'is_joined_by_me', 'my_ticket',
        ]
        read_only_fields = fields

    def _get_my_passenger(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        return ScheduledRidePassenger.objects.filter(
            ride=obj,
            student=request.user,
        ).exclude(status=PassengerStatus.CANCELLED).select_related(
            'boarding_stop', 'alighting_stop'
        ).first()

    def get_is_joined_by_me(self, obj):
        return self._get_my_passenger(obj) is not None

    def get_my_ticket(self, obj):
        passenger = self._get_my_passenger(obj)
        if not passenger:
            return None
        return {
            'id': str(passenger.id),
            'ticket_ref': passenger.ticket_ref,
            'status': passenger.status,
            'boarding_stop_name': passenger.boarding_stop.name if passenger.boarding_stop else None,
            'boarding_stop_address': passenger.boarding_stop.address if passenger.boarding_stop else None,
            'alighting_stop_name': passenger.alighting_stop.name if passenger.alighting_stop else None,
            'alighting_stop_address': passenger.alighting_stop.address if passenger.alighting_stop else None,
            'amount_paid': str(passenger.amount_paid),
            'joined_at': passenger.joined_at.isoformat() if passenger.joined_at else None,
        }

    def get_stops_count(self, obj):
        return obj.stops.count()

    def get_origin_name(self, obj):
        return scheduled_endpoint_names(obj)['origin_name']

    def get_destination_name(self, obj):
        return scheduled_endpoint_names(obj)['destination_name']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name

    def get_assigned_driver_name(self, obj):
        return obj.assigned_driver.full_name if obj.assigned_driver else None

    def get_fare_summary(self, obj):
        return get_full_route_fare_summary(obj)


class ScheduledRideUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduledRide
        fields = [
            'window_start', 'window_end', 'join_deadline',
            'status', 'admin_notes'
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        
        window_start = attrs.get('window_start', self.instance.window_start if self.instance else None)
        window_end = attrs.get('window_end', self.instance.window_end if self.instance else None)
        
        if window_start and window_end:
            if window_end <= window_start:
                raise serializers.ValidationError({'window_end': 'Departure window end must be after start.'})
            start_dt = datetime.datetime.combine(datetime.date.today(), window_start)
            end_dt = datetime.datetime.combine(datetime.date.today(), window_end)
            diff = end_dt - start_dt
            if diff < datetime.timedelta(minutes=30):
                raise serializers.ValidationError({'window_end': 'Departure window must be at least 30 minutes.'})
            if diff > datetime.timedelta(hours=12):
                raise serializers.ValidationError({'window_end': 'Departure window cannot exceed 12 hours.'})
                
        return attrs


class ScheduledRidePassengerReadSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    boarding_stop_name = serializers.SerializerMethodField()
    alighting_stop_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledRidePassenger
        fields = [
            'id', 'ticket_ref', 'student', 'student_name', 'pricing_tier', 'boarding_stop',
            'boarding_stop_name', 'alighting_stop', 'alighting_stop_name',
            'amount_paid', 'payment_reference', 'cargo_description', 'cargo_weight_kg',
            'status', 'joined_at',
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_boarding_stop_name(self, obj):
        return obj.boarding_stop.name if obj.boarding_stop else None

    def get_alighting_stop_name(self, obj):
        return obj.alighting_stop.name if obj.alighting_stop else None


class ScheduledRideDetailSerializer(serializers.ModelSerializer):
    stops = ScheduledRideStopSerializer(many=True, read_only=True)
    passengers = ScheduledRidePassengerReadSerializer(many=True, read_only=True)
    passenger_count = serializers.IntegerField(read_only=True)
    is_joinable = serializers.BooleanField(read_only=True)
    enabled_tiers = serializers.ListField(read_only=True)
    origin_name = serializers.SerializerMethodField()
    destination_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_driver_name = serializers.SerializerMethodField()
    fare_summary = serializers.SerializerMethodField()
    fare_matrix = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledRide
        fields = [
            'id', 'reference', 'departure_date', 'window_start', 'window_end', 'join_deadline',
            'origin_address', 'origin_name', 'origin_latitude', 'origin_longitude',
            'destination_address', 'destination_name', 'destination_latitude', 'destination_longitude',
            'allowed_vehicle_types', 'cargo_capacity_kg',
            'assigned_driver', 'assigned_driver_name', 'standard_enabled', 'standard_price',
            'standing_enabled', 'standing_price', 'premium_enabled', 'premium_price',
            'freight_enabled', 'freight_price', 'status', 'admin_notes', 'stops', 'passengers',
            'passenger_count', 'is_joinable', 'enabled_tiers', 'created_by_name',
            'fare_summary', 'fare_matrix', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_origin_name(self, obj):
        return scheduled_endpoint_names(obj)['origin_name']

    def get_destination_name(self, obj):
        return scheduled_endpoint_names(obj)['destination_name']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name

    def get_assigned_driver_name(self, obj):
        return obj.assigned_driver.full_name if obj.assigned_driver else None

    def get_fare_summary(self, obj):
        return get_full_route_fare_summary(obj)

    def get_fare_matrix(self, obj):
        return build_scheduled_fare_matrix(obj)


class StudentScheduledRideDetailSerializer(ScheduledRideDetailSerializer):
    class Meta(ScheduledRideDetailSerializer.Meta):
        fields = [field for field in ScheduledRideDetailSerializer.Meta.fields if field != 'passengers']
        read_only_fields = fields


class ScheduledRideJoinSerializer(serializers.Serializer):
    pricing_tier = serializers.ChoiceField(choices=PricingTier.choices, required=False, default=PricingTier.STANDARD)
    boarding_stop_id = serializers.UUIDField(required=False, allow_null=True)
    alighting_stop_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        ride = self.context['ride']
        student = self.context['request'].user

        if student.role != UserRole.STUDENT:
            raise serializers.ValidationError('Only students can join scheduled rides.')
        if not ride.is_joinable:
            raise serializers.ValidationError('This ride is no longer accepting passengers.')
        if ScheduledRidePassenger.objects.filter(ride=ride, student=student).exclude(status=PassengerStatus.CANCELLED).exists():
            raise serializers.ValidationError('You already have a ticket for this ride.')

        # One-active-ride constraint: student cannot hold more than one active ticket
        active_ticket = ScheduledRidePassenger.objects.filter(
            student=student,
        ).exclude(
            status__in=[PassengerStatus.CANCELLED],
        ).exclude(
            ride__status__in=[ScheduledRideStatus.COMPLETED, ScheduledRideStatus.CANCELLED],
        ).exclude(
            ride=ride,
        ).select_related('ride').first()
        if active_ticket:
            raise serializers.ValidationError(
                f'You already have an active ticket for ride {active_ticket.ride.reference}. '
                'Please leave that ride before joining a new one.'
            )

        stops = list(ride.stops.order_by('order'))
        if len(stops) < 2:
            raise serializers.ValidationError('This ride route is incomplete.')

        boarding_stop_id = attrs.get('boarding_stop_id') or stops[0].id
        alighting_stop_id = attrs.get('alighting_stop_id') or stops[-1].id

        try:
            boarding_stop = next(stop for stop in stops if stop.id == boarding_stop_id)
        except StopIteration:
            raise serializers.ValidationError({'boarding_stop_id': 'This stop does not belong to the selected ride.'})
        try:
            alighting_stop = next(stop for stop in stops if stop.id == alighting_stop_id)
        except StopIteration:
            raise serializers.ValidationError({'alighting_stop_id': 'This stop does not belong to the selected ride.'})

        if not boarding_stop.is_pickup:
            raise serializers.ValidationError({'boarding_stop_id': 'This stop is not available for boarding.'})
        if not alighting_stop.is_dropoff:
            raise serializers.ValidationError({'alighting_stop_id': 'This stop is not available for alighting.'})
        if alighting_stop.order <= boarding_stop.order:
            raise serializers.ValidationError({'alighting_stop_id': 'Alighting stop must come after boarding stop.'})

        # Validate pricing tier
        tier = attrs.get('pricing_tier', PricingTier.STANDARD)
        if tier == PricingTier.STANDING and not ride.standing_enabled:
            raise serializers.ValidationError({'pricing_tier': 'Standing tier is not available for this ride.'})
        if tier not in (PricingTier.STANDARD, PricingTier.STANDING):
            raise serializers.ValidationError({'pricing_tier': 'Only standard and standing tiers are available for scheduled rides.'})

        amount = calculate_scheduled_segment_fare(ride, boarding_stop, alighting_stop, tier=tier)
        attrs['pricing_tier'] = tier
        attrs['boarding_stop'] = boarding_stop
        attrs['alighting_stop'] = alighting_stop
        attrs['calculated_amount'] = amount
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        ride = self.context['ride']
        student = self.context['request'].user
        tier = validated_data['pricing_tier']
        price = validated_data['calculated_amount']
        boarding_stop = validated_data['boarding_stop']
        alighting_stop = validated_data['alighting_stop']

        try:
            tx = WalletService.debit(
                user=student,
                amount=Decimal(str(price)),
                source=WalletTransaction.Source.RIDE_PAYMENT,
                narration=f'Scheduled ride ticket - {ride.reference}',
                metadata={
                    'scheduled_ride_id': str(ride.id),
                    'scheduled_ride_reference': ride.reference,
                    'pricing_tier': tier,
                    'boarding_stop_id': str(boarding_stop.id),
                    'alighting_stop_id': str(alighting_stop.id),
                    'vehicle_type': get_scheduled_fare_vehicle_type(ride),
                },
            )
        except ValueError as exc:
            raise serializers.ValidationError({'wallet': str(exc)})

        return ScheduledRidePassenger.objects.create(
            ride=ride,
            student=student,
            pricing_tier=tier,
            boarding_stop=boarding_stop,
            alighting_stop=alighting_stop,
            amount_paid=price,
            payment_reference=tx.reference,
        )

class DispatchedBusListSerializer(serializers.ModelSerializer):
    ride_id = serializers.UUIDField(source='ride.id', read_only=True)
    ride_reference = serializers.CharField(source='ride.reference', read_only=True)
    origin_address = serializers.CharField(source='ride.origin_address', read_only=True)
    origin_name = serializers.SerializerMethodField()
    destination_address = serializers.CharField(source='ride.destination_address', read_only=True)
    destination_name = serializers.SerializerMethodField()
    scheduled_departure_date = serializers.DateField(source='ride.departure_date', read_only=True)
    scheduled_window_start = serializers.TimeField(source='ride.window_start', read_only=True)
    driver_name = serializers.SerializerMethodField()
    passenger_count = serializers.IntegerField(source='total_assigned', read_only=True)

    class Meta:
        model = ScheduledRideBusAssignment
        fields = [
            'id', 'ride_id', 'ride_reference', 'origin_address', 'origin_name',
            'destination_address', 'destination_name',
            'scheduled_departure_date', 'scheduled_window_start',
            'driver_name', 'bus_label', 'status', 'departed_at', 'arrived_at', 
            'passenger_count', 'seated_capacity', 'standing_capacity'
        ]

    def get_origin_name(self, obj):
        return scheduled_endpoint_names(obj.ride)['origin_name']

    def get_destination_name(self, obj):
        return scheduled_endpoint_names(obj.ride)['destination_name']

    def get_driver_name(self, obj):
        return obj.driver.full_name if obj.driver else 'Unassigned'

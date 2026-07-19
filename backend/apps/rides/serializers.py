import uuid
from django.utils import timezone
from rest_framework import serializers
from apps.accounts.serializers import UserPublicSerializer
from .models import Ride, DriverRideRequest, RideStatus, PaymentMethod, VehicleType

# ── Vehicle seat policy for on-demand booking ──────────────────────────
# min_seats = minimum seats a student must book (protects driver earnings)
# max_seats = physical passenger capacity of the vehicle category
VEHICLE_SEAT_POLICY = {
    VehicleType.MOTORBIKE: {'min_seats': 1, 'max_seats': 2},
    VehicleType.TRICYCLE:  {'min_seats': 3, 'max_seats': 4},
    VehicleType.SEDAN:     {'min_seats': 3, 'max_seats': 5},
    VehicleType.MPV:       {'min_seats': 7, 'max_seats': 9},
}

# Only these vehicle types are available for on-demand ride booking.
# Minibus / Coach are reserved for scheduled/charter transport (future).
BOOKABLE_VEHICLE_TYPES = set(VEHICLE_SEAT_POLICY.keys())


class RideRequestSerializer(serializers.ModelSerializer):
    route_index = serializers.IntegerField(min_value=0, required=False, write_only=True)
    route_provider = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Ride
        fields = [
            'pickup_latitude',
            'pickup_longitude',
            'pickup_address',
            'dropoff_latitude',
            'dropoff_longitude',
            'dropoff_address',
            'scheduled_pickup_time',
            'vehicle_type_requested',
            'requested_seats',
            'payment_method',
            'route_index',
            'route_provider',
        ]

    def to_internal_value(self, data):
        if 'requested_seats' not in data:
            if 'passengerCount' in data:
                data = data.copy()
                data['requested_seats'] = data['passengerCount']
            elif 'passenger_count' in data:
                data = data.copy()
                data['requested_seats'] = data['passenger_count']
        return super().to_internal_value(data)

    def validate_vehicle_type_requested(self, value):
        if value not in VehicleType.values:
            raise serializers.ValidationError('Invalid vehicle type.')
        if value not in BOOKABLE_VEHICLE_TYPES:
            raise serializers.ValidationError(
                f'{VehicleType(value).label} is not available for on-demand booking.'
            )
        return value

    def validate_payment_method(self, value):
        if value not in PaymentMethod.values:
            raise serializers.ValidationError('Invalid payment method.')
        if value != PaymentMethod.WALLET:
            raise serializers.ValidationError('Wallet-only payments are supported for now.')
        return value

    def validate_requested_seats(self, value):
        if value < 1:
            raise serializers.ValidationError('At least one seat is required.')
        return value

    def validate_scheduled_pickup_time(self, value):
        if not value:
            return value
        now = timezone.now()
        if value < now - timezone.timedelta(minutes=2):
            raise serializers.ValidationError('Pickup time cannot be in the past.')
        if value > now + timezone.timedelta(minutes=30):
            raise serializers.ValidationError('Pickup time must be within 30 minutes.')
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        seats = attrs.get('requested_seats') or 1
        vehicle_type = attrs.get('vehicle_type_requested')
        policy = VEHICLE_SEAT_POLICY.get(vehicle_type)
        if policy:
            if seats < policy['min_seats']:
                raise serializers.ValidationError({
                    'requested_seats': (
                        f'{VehicleType(vehicle_type).label} requires a '
                        f'minimum booking of {policy["min_seats"]} seats.'
                    )
                })
            if seats > policy['max_seats']:
                raise serializers.ValidationError({
                    'requested_seats': (
                        f'{VehicleType(vehicle_type).label} allows up to '
                        f'{policy["max_seats"]} seats.'
                    )
                })
        return attrs

    def create(self, validated_data):
        validated_data.pop('route_index', None)
        validated_data.pop('route_provider', None)
        if not validated_data.get('scheduled_pickup_time'):
            validated_data['scheduled_pickup_time'] = timezone.now()
        reference = 'RD' + uuid.uuid4().hex[:8].upper()
        ride = Ride.objects.create(
            reference=reference,
            student=self.context['request'].user,
            **validated_data,
        )
        return ride


class RideListSerializer(serializers.ModelSerializer):
    student = UserPublicSerializer(read_only=True)
    driver = UserPublicSerializer(read_only=True)

    class Meta:
        model = Ride
        fields = [
            'id',
            'reference',
            'student',
            'driver',
            'status',
            'vehicle_type_requested',
            'requested_seats',
            'pickup_address',
            'pickup_latitude',
            'pickup_longitude',
            'dropoff_address',
            'dropoff_latitude',
            'dropoff_longitude',
            'estimated_distance_km',
            'estimated_duration_minutes',
            'estimated_route_geometry',
            'route_distance_provider',
            'route_confidence',
            'route_metadata',
            'total_fare',
            'payment_method',
            'is_paid',
            'requested_at',
            'scheduled_pickup_time',
            'trip_completed_at',
        ]
        read_only_fields = fields


class RideDriverSerializer(serializers.Serializer):
    """Serialises the driver user + their driver_profile for ride responses."""
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone_number = serializers.CharField(allow_null=True)
    role = serializers.CharField()
    profile_photo = serializers.SerializerMethodField()
    vehicle_type = serializers.SerializerMethodField()
    vehicle_make = serializers.SerializerMethodField()
    vehicle_model = serializers.SerializerMethodField()
    vehicle_color = serializers.SerializerMethodField()
    plate_number = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()

    def _profile(self, obj):
        try:
            return obj.driver_profile
        except Exception:
            return None

    def get_profile_photo(self, obj):
        if obj.profile_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_photo.url)
            return obj.profile_photo.url
        return None

    def get_vehicle_type(self, obj):
        p = self._profile(obj)
        return p.vehicle_type if p else None

    def get_vehicle_make(self, obj):
        p = self._profile(obj)
        return p.vehicle_make if p else None

    def get_vehicle_model(self, obj):
        p = self._profile(obj)
        return p.vehicle_model if p else None

    def get_vehicle_color(self, obj):
        p = self._profile(obj)
        return p.vehicle_color if p else None

    def get_plate_number(self, obj):
        p = self._profile(obj)
        return p.plate_number if p else None

    def get_average_rating(self, obj):
        p = self._profile(obj)
        return str(p.average_rating) if p and p.average_rating is not None else None


class RideDetailSerializer(serializers.ModelSerializer):
    student = UserPublicSerializer(read_only=True)
    driver = RideDriverSerializer(read_only=True)

    class Meta:
        model = Ride
        fields = [
            'id',
            'reference',
            'student',
            'driver',
            'status',
            'vehicle_type_requested',
            'requested_seats',
            'pickup_latitude',
            'pickup_longitude',
            'pickup_address',
            'dropoff_latitude',
            'dropoff_longitude',
            'dropoff_address',
            'scheduled_pickup_time',
            'estimated_distance_km',
            'actual_distance_km',
            'estimated_route_geometry',
            'route_distance_provider',
            'route_confidence',
            'route_metadata',
            'estimated_duration_minutes',
            'actual_duration_minutes',
            'base_fare',
            'surge_multiplier',
            'total_fare',
            'platform_commission',
            'driver_earnings',
            'payment_method',
            'is_paid',
            'cancellation_reason',
            'cancelled_at',
            'no_show_fee_amount',
            'no_show_marked_at',
            'emergency_activated',
            'requested_at',
            'driver_assigned_at',
            'driver_arrived_at',
            'trip_started_at',
            'trip_completed_at',
        ]
        read_only_fields = fields


class RideCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)


class RideStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=RideStatus.choices)


class DriverRideRequestSerializer(serializers.ModelSerializer):
    ride = RideListSerializer(read_only=True)

    class Meta:
        model = DriverRideRequest
        fields = ['id', 'ride', 'response', 'offered_at', 'responded_at']
        read_only_fields = fields


class AvailableRidesQuerySerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    radius_km = serializers.FloatField(default=1)
    vehicle_type = serializers.ChoiceField(choices=VehicleType.choices, required=False)
    max_age_seconds = serializers.IntegerField(default=300, required=False)

    def validate_radius_km(self, value):
        if value <= 0 or value > 5:
            raise serializers.ValidationError('radius_km must be between 0 and 5.')
        return value

    def validate_max_age_seconds(self, value):
        if value < 30 or value > 3600:
            raise serializers.ValidationError('max_age_seconds must be between 30 and 3600.')
        return value


class AvailableDriverSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    profile_photo = serializers.CharField(allow_null=True)
    vehicle_type = serializers.CharField(allow_null=True)
    vehicle_make = serializers.CharField(allow_null=True)
    vehicle_model = serializers.CharField(allow_null=True)
    vehicle_color = serializers.CharField(allow_null=True)
    plate_number = serializers.CharField(allow_null=True)
    average_rating = serializers.CharField(allow_null=True)
    distance_km = serializers.FloatField()
    location_updated_at = serializers.DateTimeField()

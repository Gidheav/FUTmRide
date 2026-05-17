import uuid
from django.utils import timezone
from rest_framework import serializers
from apps.accounts.serializers import UserPublicSerializer
from .models import Ride, DriverRideRequest, RideStatus, PaymentMethod, VehicleType


class RideRequestSerializer(serializers.ModelSerializer):
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
        ]

    def validate_vehicle_type_requested(self, value):
        if value not in VehicleType.values:
            raise serializers.ValidationError('Invalid vehicle type.')
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
        if vehicle_type == VehicleType.MOTORCYCLE and seats > 2:
            raise serializers.ValidationError({'requested_seats': 'Motorcycle allows up to 2 seats.'})
        if vehicle_type == VehicleType.TRICYCLE and seats > 4:
            raise serializers.ValidationError({'requested_seats': 'Tricycle allows up to 4 seats.'})
        return attrs

    def create(self, validated_data):
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
            'dropoff_address',
            'estimated_distance_km',
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
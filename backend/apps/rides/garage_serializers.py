import uuid
from django.utils import timezone
from rest_framework import serializers
from apps.accounts.serializers import UserPublicSerializer
from .garage_models import GarageRide, GarageRidePassenger, GarageRideStatus


class GarageRideCreateSerializer(serializers.ModelSerializer):
    """Used by driver to create a garage ride."""

    class Meta:
        model = GarageRide
        fields = [
            'origin_address',
            'origin_latitude',
            'origin_longitude',
            'destination_address',
            'destination_latitude',
            'destination_longitude',
            'vehicle_type',
            'total_seats',
            'fare_per_seat',
            'driver_note',
            'expires_at',
        ]

    def validate_total_seats(self, value):
        if value < 1 or value > 20:
            raise serializers.ValidationError('Seat count must be between 1 and 20.')
        return value

    def validate_fare_per_seat(self, value):
        if value <= 0:
            raise serializers.ValidationError('Fare must be greater than zero.')
        return value

    def validate_expires_at(self, value):
        if value and value < timezone.now():
            raise serializers.ValidationError('Expiry time cannot be in the past.')
        return value

    def create(self, validated_data):
        reference = 'GR' + uuid.uuid4().hex[:8].upper()
        return GarageRide.objects.create(
            reference=reference,
            driver=self.context['request'].user,
            **validated_data,
        )


class GarageRideDriverSerializer(serializers.Serializer):
    """Minimal driver info returned with a garage ride scan."""
    id = serializers.UUIDField()
    full_name = serializers.CharField()
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
        request = self.context.get('request')
        if obj.profile_photo:
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


class GarageRideDetailSerializer(serializers.ModelSerializer):
    """Full read representation of a garage ride (returned after scan or creation)."""
    driver = serializers.SerializerMethodField()
    available_seats = serializers.IntegerField(read_only=True)
    can_board = serializers.BooleanField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    qr_token = serializers.UUIDField(read_only=True)

    class Meta:
        model = GarageRide
        fields = [
            'id',
            'reference',
            'qr_token',
            'driver',
            'origin_address',
            'origin_latitude',
            'origin_longitude',
            'destination_address',
            'destination_latitude',
            'destination_longitude',
            'vehicle_type',
            'total_seats',
            'booked_seats',
            'available_seats',
            'fare_per_seat',
            'status',
            'driver_note',
            'can_board',
            'is_expired',
            'created_at',
            'departed_at',
            'expires_at',
        ]
        read_only_fields = fields

    def get_driver(self, obj):
        return GarageRideDriverSerializer(obj.driver, context=self.context).data


class GarageRideBoardSerializer(serializers.Serializer):
    """Student boards (pays for) a garage ride after scanning."""
    seats = serializers.IntegerField(min_value=1, max_value=6, default=1)

    def validate_seats(self, value):
        if value < 1:
            raise serializers.ValidationError('Must book at least 1 seat.')
        return value


class GarageRidePassengerSerializer(serializers.ModelSerializer):
    student = UserPublicSerializer(read_only=True)

    class Meta:
        model = GarageRidePassenger
        fields = [
            'id',
            'student',
            'seats_booked',
            'amount_paid',
            'wallet_transaction_reference',
            'boarded_at',
        ]
        read_only_fields = fields

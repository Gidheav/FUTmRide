from rest_framework import serializers
from apps.accounts.serializers import UserPublicSerializer
from .shared_models import SharedRide, SharedRideRider
from .models import VehicleType
from .serializers import RideDetailSerializer
from apps.pricing.models import FareConfiguration


class SharedRideRiderSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)

    class Meta:
        model = SharedRideRider
        fields = [
            'id', 'user', 'pickup_latitude', 'pickup_longitude', 'pickup_address',
            'distance_km', 'fare_share', 'status', 'joined_at', 'confirmed_at'
        ]


class SharedRideDetailSerializer(serializers.ModelSerializer):
    creator = UserPublicSerializer(read_only=True)
    riders = SharedRideRiderSerializer(many=True, read_only=True)
    ride = RideDetailSerializer(read_only=True)
    vehicle_type_label = serializers.CharField(source='get_vehicle_type_display', read_only=True)

    class Meta:
        model = SharedRide
        fields = [
            'id', 'reference', 'share_code', 'creator', 'vehicle_type', 'vehicle_type_label',
            'dropoff_latitude', 'dropoff_longitude', 'dropoff_address',
            'max_riders', 'status', 'anchor_distance_km', 'anchor_fare', 
            'total_collected', 'expires_at', 'created_at', 'riders', 'ride'
        ]


class SharedRideCreateSerializer(serializers.ModelSerializer):
    pickup_latitude = serializers.DecimalField(max_digits=9, decimal_places=6, write_only=True)
    pickup_longitude = serializers.DecimalField(max_digits=9, decimal_places=6, write_only=True)
    pickup_address = serializers.CharField(max_length=255, write_only=True)

    class Meta:
        model = SharedRide
        fields = [
            'vehicle_type', 'dropoff_latitude', 'dropoff_longitude', 
            'dropoff_address', 'max_riders',
            'pickup_latitude', 'pickup_longitude', 'pickup_address'
        ]

    def validate_vehicle_type(self, value):
        if value not in VehicleType.values:
            raise serializers.ValidationError('Invalid vehicle type.')
        return value

    def validate_max_riders(self, value):
        if value < 2:
            raise serializers.ValidationError('A shared ride must allow at least 2 riders.')
        # Could also check against vehicle policy max_seats here
        return value


class SharedRideJoinSerializer(serializers.ModelSerializer):
    class Meta:
        model = SharedRideRider
        fields = ['pickup_latitude', 'pickup_longitude', 'pickup_address']

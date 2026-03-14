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
            'vehicle_type_requested',
            'payment_method',
        ]

    def validate_vehicle_type_requested(self, value):
        if value not in VehicleType.values:
            raise serializers.ValidationError('Invalid vehicle type.')
        return value

    def validate_payment_method(self, value):
        if value not in PaymentMethod.values:
            raise serializers.ValidationError('Invalid payment method.')
        return value

    def create(self, validated_data):
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
            'pickup_address',
            'dropoff_address',
            'total_fare',
            'payment_method',
            'is_paid',
            'requested_at',
            'trip_completed_at',
        ]
        read_only_fields = fields


class RideDetailSerializer(serializers.ModelSerializer):
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
            'pickup_latitude',
            'pickup_longitude',
            'pickup_address',
            'dropoff_latitude',
            'dropoff_longitude',
            'dropoff_address',
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
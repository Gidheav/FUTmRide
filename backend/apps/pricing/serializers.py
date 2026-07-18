from rest_framework import serializers
from .models import FareConfiguration, PlatformSettings


class FareConfigSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = FareConfiguration
        fields = [
            'id', 'vehicle_type', 'is_active', 'base_fare', 'per_km_rate',
            'minimum_fare', 'booking_fee', 'surge_enabled', 'max_surge_multiplier',
            'effective_from', 'effective_to', 'created_by_name', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_by_name', 'created_at']

    def validate_base_fare(self, value):
        if value < 0:
            raise serializers.ValidationError('Base fare cannot be negative.')
        if value > 100000:
            raise serializers.ValidationError('Base fare cannot exceed ₦100,000.')
        return value

    def validate_per_km_rate(self, value):
        if value < 0:
            raise serializers.ValidationError('Per-KM rate cannot be negative.')
        if value > 10000:
            raise serializers.ValidationError('Per-KM rate cannot exceed ₦10,000.')
        return value

    def validate_minimum_fare(self, value):
        if value < 0:
            raise serializers.ValidationError('Minimum fare cannot be negative.')
        if value > 100000:
            raise serializers.ValidationError('Minimum fare cannot exceed ₦100,000.')
        return value

    def validate_booking_fee(self, value):
        if value < 0:
            raise serializers.ValidationError('Booking fee cannot be negative.')
        if value > 10000:
            raise serializers.ValidationError('Booking fee cannot exceed ₦10,000.')
        return value

    def validate_max_surge_multiplier(self, value):
        if value < 1.0:
            raise serializers.ValidationError('Max surge multiplier cannot be below 1.0.')
        if value > 5.0:
            raise serializers.ValidationError('Max surge multiplier cannot exceed 5.0.')
        return value

    def validate_effective_from(self, value):
        from django.utils import timezone
        now = timezone.now()
        
        # If updating an existing config, and the date hasn't changed, allow it.
        if self.instance and self.instance.effective_from == value:
            return value
            
        # For new configs or changed dates, ensure it's not backdated.
        # Allow a 5-minute buffer for form filling/network delay.
        if value < now - timezone.timedelta(minutes=5):
            raise serializers.ValidationError('Effective date cannot be set in the past.')
        return value

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class FareConfigOverrideSerializer(serializers.Serializer):
    base_fare = serializers.FloatField(min_value=0)
    per_km_rate = serializers.FloatField(min_value=0)
    minimum_fare = serializers.FloatField(min_value=0)
    booking_fee = serializers.FloatField(min_value=0, default=0)
    surge_enabled = serializers.BooleanField(default=True)
    max_surge_multiplier = serializers.FloatField(min_value=1.0, max_value=5.0, default=2.5)


class FareEstimateSerializer(serializers.Serializer):
    vehicle_type = serializers.ChoiceField(choices=FareConfiguration.VehicleType.choices)
    distance_km = serializers.FloatField(min_value=0.1, required=False)
    pickup_latitude = serializers.FloatField(min_value=-90, max_value=90, required=False)
    pickup_longitude = serializers.FloatField(min_value=-180, max_value=180, required=False)
    dropoff_latitude = serializers.FloatField(min_value=-90, max_value=90, required=False)
    dropoff_longitude = serializers.FloatField(min_value=-180, max_value=180, required=False)
    surge_multiplier = serializers.FloatField(min_value=1.0, max_value=5.0, default=1.0, required=False)
    passenger_count = serializers.IntegerField(min_value=1, max_value=99, default=1, required=False)
    config_override = FareConfigOverrideSerializer(required=False)
    settings_override = serializers.DictField(required=False)

    def to_internal_value(self, data):
        if 'passenger_count' not in data and 'passengerCount' in data:
            data = data.copy()
            data['passenger_count'] = data['passengerCount']
        return super().to_internal_value(data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        has_distance = attrs.get('distance_km') is not None
        coordinate_fields = [
            'pickup_latitude',
            'pickup_longitude',
            'dropoff_latitude',
            'dropoff_longitude',
        ]
        has_all_coordinates = all(attrs.get(field) is not None for field in coordinate_fields)
        has_any_coordinates = any(attrs.get(field) is not None for field in coordinate_fields)

        if not has_distance and not has_all_coordinates:
            raise serializers.ValidationError(
                'Provide distance_km or complete pickup/dropoff coordinates.'
            )
        if has_any_coordinates and not has_all_coordinates:
            raise serializers.ValidationError(
                'Complete pickup/dropoff coordinates are required for route-based estimates.'
            )
        return attrs


class PlatformSettingsSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source='updated_by.full_name', read_only=True, default=None)

    class Meta:
        model = PlatformSettings
        fields = [
            'id', 'commission_rate', 'distance_provider', 'max_distance_km',
            'no_show_fee_enabled', 'no_show_fee_amount', 'no_show_wait_minutes',
            'updated_at', 'updated_by_name',
        ]
        read_only_fields = ['id', 'updated_at', 'updated_by_name']

    def validate_commission_rate(self, value):
        if value < 0 or value > 0.5:
            raise serializers.ValidationError('Commission rate must be between 0% and 50%.')
        return value

    def validate_max_distance_km(self, value):
        if value < 1 or value > 1000:
            raise serializers.ValidationError('Max distance must be between 1 and 1000 KM.')
        return value

    def validate_no_show_fee_amount(self, value):
        if value < 0 or value > 10000:
            raise serializers.ValidationError('No-show fee must be between ₦0 and ₦10,000.')
        return value

    def validate_no_show_wait_minutes(self, value):
        if value < 1 or value > 30:
            raise serializers.ValidationError('No-show wait must be between 1 and 30 minutes.')
        return value

    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)

from rest_framework import serializers
from .models import FareConfiguration


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

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class FareEstimateSerializer(serializers.Serializer):
    vehicle_type = serializers.ChoiceField(choices=FareConfiguration.VehicleType.choices)
    distance_km = serializers.FloatField(min_value=0.1)
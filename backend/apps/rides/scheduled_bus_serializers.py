from rest_framework import serializers

from apps.accounts.models import DriverProfile, User, UserRole
from .scheduled_models import (
    BusAssignmentStatus,
    PassengerStatus,
    ScheduledRideBusAssignment,
    ScheduledRidePassenger,
    SeatType,
)


class BusAssignmentReadSerializer(serializers.ModelSerializer):
    driver_name = serializers.SerializerMethodField()
    vehicle_type = serializers.SerializerMethodField()
    plate_number = serializers.SerializerMethodField()
    seated_count = serializers.IntegerField(read_only=True)
    standing_count = serializers.IntegerField(read_only=True)
    checked_in_count = serializers.IntegerField(read_only=True)
    total_assigned = serializers.IntegerField(read_only=True)
    seats_available = serializers.IntegerField(read_only=True)
    standing_available = serializers.IntegerField(read_only=True)

    class Meta:
        model = ScheduledRideBusAssignment
        fields = [
            'id', 'ride', 'driver', 'driver_name', 'vehicle_type', 'plate_number',
            'bus_label', 'order', 'seated_capacity', 'standing_capacity',
            'status', 'departed_at', 'arrived_at', 'admin_notes',
            'seated_count', 'standing_count', 'checked_in_count',
            'total_assigned', 'seats_available', 'standing_available',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_driver_name(self, obj):
        return obj.driver.full_name if obj.driver else None

    def get_vehicle_type(self, obj):
        if not obj.driver:
            return None
        try:
            return obj.driver.driver_profile.vehicle_type
        except DriverProfile.DoesNotExist:
            return None

    def get_plate_number(self, obj):
        if not obj.driver:
            return None
        try:
            return obj.driver.driver_profile.plate_number
        except DriverProfile.DoesNotExist:
            return None


class BusAssignmentCreateSerializer(serializers.ModelSerializer):
    driver = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=UserRole.DRIVER),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ScheduledRideBusAssignment
        fields = [
            'driver', 'bus_label', 'order', 'seated_capacity',
            'standing_capacity', 'admin_notes',
        ]

    def validate_seated_capacity(self, value):
        if value < 1 or value > 500:
            raise serializers.ValidationError('Seated capacity must be between 1 and 500.')
        return value

    def validate_standing_capacity(self, value):
        if value < 0 or value > 200:
            raise serializers.ValidationError('Standing capacity must be between 0 and 200.')
        return value

    def validate(self, attrs):
        ride = self.context['ride']
        order = attrs.get('order', 1)
        if ScheduledRideBusAssignment.objects.filter(ride=ride, order=order).exists():
            max_order = ScheduledRideBusAssignment.objects.filter(ride=ride).count()
            attrs['order'] = max_order + 1
        return attrs


class BusAssignmentUpdateSerializer(serializers.ModelSerializer):
    driver = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=UserRole.DRIVER),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ScheduledRideBusAssignment
        fields = [
            'driver', 'bus_label', 'seated_capacity',
            'standing_capacity', 'admin_notes',
        ]

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status not in [BusAssignmentStatus.ASSIGNED, BusAssignmentStatus.BOARDING]:
            raise serializers.ValidationError('Cannot modify a bus assignment after loading/departure.')
        return attrs


class PassengerManifestSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_email = serializers.SerializerMethodField()
    bus_label = serializers.SerializerMethodField()
    boarding_stop_name = serializers.SerializerMethodField()
    alighting_stop_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledRidePassenger
        fields = [
            'id', 'student', 'student_name', 'student_email',
            'pricing_tier', 'bus_assignment', 'bus_label',
            'seat_type', 'checked_in_at',
            'boarding_stop', 'boarding_stop_name',
            'alighting_stop', 'alighting_stop_name',
            'amount_paid', 'payment_reference',
            'cargo_description', 'cargo_weight_kg',
            'status', 'joined_at',
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_student_email(self, obj):
        return obj.student.email

    def get_bus_label(self, obj):
        return obj.bus_assignment.bus_label if obj.bus_assignment else None

    def get_boarding_stop_name(self, obj):
        return obj.boarding_stop.name if obj.boarding_stop else None

    def get_alighting_stop_name(self, obj):
        return obj.alighting_stop.name if obj.alighting_stop else None


class ReassignPassengerSerializer(serializers.Serializer):
    bus_assignment_id = serializers.UUIDField()

    def validate_bus_assignment_id(self, value):
        ride = self.context['ride']
        try:
            bus = ScheduledRideBusAssignment.objects.get(id=value, ride=ride)
        except ScheduledRideBusAssignment.DoesNotExist:
            raise serializers.ValidationError('Bus assignment not found for this ride.')
        if bus.status in [BusAssignmentStatus.DEPARTED, BusAssignmentStatus.EN_ROUTE,
                          BusAssignmentStatus.ARRIVED, BusAssignmentStatus.COMPLETED]:
            raise serializers.ValidationError('Cannot reassign to a bus that has already departed.')
        return value


class AllocationResultSerializer(serializers.Serializer):
    allocated = serializers.IntegerField()
    unallocated = serializers.IntegerField()
    buses = serializers.ListField(child=serializers.DictField())

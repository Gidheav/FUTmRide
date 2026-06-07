import datetime
import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import CampusAdminProfile, DriverProfile, User, UserRole
from apps.payments.models import WalletTransaction
from apps.payments.services import WalletService
from .scheduled_models import (
    PassengerStatus,
    PricingTier,
    ScheduledRide,
    ScheduledRidePassenger,
    ScheduledRideStatus,
    ScheduledRideStop,
    VehicleSize,
)

ACCESSIBILITY_FEATURES = {'wheelchair_ramp', 'liftgate', 'low_floor', 'air_conditioning'}
SUPPORTED_DRIVER_SIZE_MATCHES = {
    VehicleSize.SEDAN: 'sedan',
    VehicleSize.SUV: 'suv',
    VehicleSize.MINIVAN: 'minivan',
}


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


class ScheduledRideStopSerializer(serializers.ModelSerializer):
    address = serializers.CharField(max_length=255, allow_blank=False)

    class Meta:
        model = ScheduledRideStop
        fields = [
            'id', 'order', 'name', 'address', 'latitude', 'longitude',
            'estimated_arrival_offset_min', 'is_pickup', 'is_dropoff',
        ]
        read_only_fields = ['id']


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
            'vehicle_size', 'cargo_capacity_kg', 'accessibility_features', 'assigned_driver',
            'standard_enabled', 'standard_price',
            'standing_enabled', 'standing_price',
            'premium_enabled', 'premium_price',
            'freight_enabled', 'freight_price',
            'admin_notes', 'stops',
        ]

    def validate_accessibility_features(self, value):
        if value in (None, ''):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Accessibility features must be a list.')
        unknown = [item for item in value if item not in ACCESSIBILITY_FEATURES]
        if unknown:
            raise serializers.ValidationError(f'Unsupported accessibility features: {", ".join(unknown)}.')
        return list(dict.fromkeys(value))

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
        return sorted(value, key=lambda item: item['order'])

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
            if end_dt - start_dt > datetime.timedelta(minutes=30):
                raise serializers.ValidationError({'window_end': 'Departure window cannot exceed 30 minutes.'})

        if departure_date and window_start:
            departure_dt = combine_local(departure_date, window_start)
            if departure_dt <= timezone.now():
                raise serializers.ValidationError({'window_start': 'Departure time must be in the future.'})

        vehicle_size = attrs.get('vehicle_size', VehicleSize.BUS)
        standing_enabled = attrs.get('standing_enabled', False)
        freight_enabled = attrs.get('freight_enabled', False)
        cargo_capacity = attrs.get('cargo_capacity_kg', 0)

        if standing_enabled and vehicle_size not in [VehicleSize.MINIBUS, VehicleSize.BUS]:
            raise serializers.ValidationError({
                'standing_enabled': 'Standing tier is only allowed on Minibus or Bus vehicles.',
            })
        if freight_enabled and cargo_capacity <= 0:
            raise serializers.ValidationError({
                'cargo_capacity_kg': 'Cargo capacity must be greater than 0 if Freight tier is enabled.',
            })

        enabled_tiers = {
            PricingTier.STANDARD: (attrs.get('standard_enabled', False), attrs.get('standard_price', Decimal('0'))),
            PricingTier.STANDING: (standing_enabled, attrs.get('standing_price', Decimal('0'))),
            PricingTier.PREMIUM: (attrs.get('premium_enabled', False), attrs.get('premium_price', Decimal('0'))),
            PricingTier.FREIGHT: (freight_enabled, attrs.get('freight_price', Decimal('0'))),
        }
        if not any(enabled for enabled, _price in enabled_tiers.values()):
            raise serializers.ValidationError('At least one pricing tier must be enabled.')
        price_errors = {}
        for tier, (enabled, price) in enabled_tiers.items():
            if enabled and price <= 0:
                price_errors[f'{tier}_price'] = 'Enabled pricing tiers must have a price greater than zero.'
        if price_errors:
            raise serializers.ValidationError(price_errors)

        assigned_driver = attrs.get('assigned_driver')
        if assigned_driver:
            self._validate_assigned_driver(assigned_driver, campus, vehicle_size)
            self._validate_assigned_driver_window(assigned_driver, departure_date, window_start)

        self._validate_route_window(campus, attrs, departure_date, window_start)
        return attrs

    def _validate_assigned_driver(self, driver, campus, vehicle_size):
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
        expected_type = SUPPORTED_DRIVER_SIZE_MATCHES.get(vehicle_size)
        if expected_type and profile.vehicle_type != expected_type:
            raise serializers.ValidationError({
                'assigned_driver': f'Assigned driver vehicle must match {vehicle_size}.',
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
        return ride


class ScheduledRideListSerializer(serializers.ModelSerializer):
    passenger_count = serializers.IntegerField(read_only=True)
    is_joinable = serializers.BooleanField(read_only=True)
    enabled_tiers = serializers.ListField(read_only=True)
    stops_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_driver_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledRide
        fields = [
            'id', 'reference', 'departure_date', 'window_start', 'window_end', 'join_deadline',
            'origin_address', 'destination_address', 'vehicle_size', 'cargo_capacity_kg',
            'accessibility_features', 'assigned_driver', 'assigned_driver_name', 'status',
            'standard_enabled', 'standard_price', 'standing_enabled', 'standing_price',
            'premium_enabled', 'premium_price', 'freight_enabled', 'freight_price',
            'passenger_count', 'is_joinable', 'enabled_tiers', 'stops_count',
            'created_by_name', 'admin_notes', 'created_at',
        ]
        read_only_fields = fields

    def get_stops_count(self, obj):
        return obj.stops.count()

    def get_created_by_name(self, obj):
        return obj.created_by.full_name

    def get_assigned_driver_name(self, obj):
        return obj.assigned_driver.full_name if obj.assigned_driver else None


class ScheduledRidePassengerReadSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    boarding_stop_name = serializers.SerializerMethodField()
    alighting_stop_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledRidePassenger
        fields = [
            'id', 'student', 'student_name', 'pricing_tier', 'boarding_stop',
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
    created_by_name = serializers.SerializerMethodField()
    assigned_driver_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledRide
        fields = [
            'id', 'reference', 'departure_date', 'window_start', 'window_end', 'join_deadline',
            'origin_address', 'origin_latitude', 'origin_longitude',
            'destination_address', 'destination_latitude', 'destination_longitude',
            'vehicle_size', 'cargo_capacity_kg', 'accessibility_features',
            'assigned_driver', 'assigned_driver_name', 'standard_enabled', 'standard_price',
            'standing_enabled', 'standing_price', 'premium_enabled', 'premium_price',
            'freight_enabled', 'freight_price', 'status', 'admin_notes', 'stops', 'passengers',
            'passenger_count', 'is_joinable', 'enabled_tiers', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        return obj.created_by.full_name

    def get_assigned_driver_name(self, obj):
        return obj.assigned_driver.full_name if obj.assigned_driver else None


class StudentScheduledRideDetailSerializer(ScheduledRideDetailSerializer):
    class Meta(ScheduledRideDetailSerializer.Meta):
        fields = [field for field in ScheduledRideDetailSerializer.Meta.fields if field != 'passengers']
        read_only_fields = fields


class ScheduledRideJoinSerializer(serializers.Serializer):
    pricing_tier = serializers.ChoiceField(choices=PricingTier.choices)
    boarding_stop_id = serializers.UUIDField(required=False, allow_null=True)
    alighting_stop_id = serializers.UUIDField(required=False, allow_null=True)
    cargo_description = serializers.CharField(required=False, allow_blank=True)
    cargo_weight_kg = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, allow_null=True)

    def validate(self, attrs):
        ride = self.context['ride']
        student = self.context['request'].user
        tier = attrs['pricing_tier']

        if student.role != UserRole.STUDENT:
            raise serializers.ValidationError('Only students can join scheduled rides.')
        if not ride.is_joinable:
            raise serializers.ValidationError('This ride is no longer accepting passengers.')
        if tier not in ride.enabled_tiers:
            raise serializers.ValidationError({'pricing_tier': f'The {tier} tier is not available for this ride.'})
        if ScheduledRidePassenger.objects.filter(ride=ride, student=student).exists():
            raise serializers.ValidationError('You already have a ticket for this ride.')
        if tier == PricingTier.STANDING and ride.vehicle_size not in [VehicleSize.MINIBUS, VehicleSize.BUS]:
            raise serializers.ValidationError({'pricing_tier': 'Standing tier is only available on Minibus or Bus rides.'})
        if tier == PricingTier.FREIGHT:
            if ride.cargo_capacity_kg <= 0:
                raise serializers.ValidationError({'pricing_tier': 'Freight is not available for this ride.'})
            if not attrs.get('cargo_description'):
                raise serializers.ValidationError({'cargo_description': 'Cargo description is required for freight tier.'})
            if not attrs.get('cargo_weight_kg') or attrs['cargo_weight_kg'] <= 0:
                raise serializers.ValidationError({'cargo_weight_kg': 'Cargo weight must be greater than 0 for freight tier.'})
            if attrs['cargo_weight_kg'] > ride.cargo_capacity_kg:
                raise serializers.ValidationError({'cargo_weight_kg': 'Cargo weight exceeds this ride cargo capacity.'})

        for field in ['boarding_stop_id', 'alighting_stop_id']:
            stop_id = attrs.get(field)
            if stop_id and not ScheduledRideStop.objects.filter(ride=ride, id=stop_id).exists():
                raise serializers.ValidationError({field: 'This stop does not belong to the selected ride.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        ride = self.context['ride']
        student = self.context['request'].user
        tier = validated_data['pricing_tier']
        price = ride.get_tier_price(tier)

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
                },
            )
        except ValueError as exc:
            raise serializers.ValidationError({'wallet': str(exc)})

        return ScheduledRidePassenger.objects.create(
            ride=ride,
            student=student,
            pricing_tier=tier,
            boarding_stop_id=validated_data.get('boarding_stop_id'),
            alighting_stop_id=validated_data.get('alighting_stop_id'),
            amount_paid=price,
            payment_reference=tx.reference,
            cargo_description=validated_data.get('cargo_description', ''),
            cargo_weight_kg=validated_data.get('cargo_weight_kg'),
        )

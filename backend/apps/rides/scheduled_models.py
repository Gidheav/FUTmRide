import uuid
from django.db import models
from django.utils import timezone
from apps.accounts.models import Campus, User


class ScheduledRideStatus(models.TextChoices):
    SCHEDULED = 'scheduled', 'Scheduled'
    BOARDING = 'boarding', 'Boarding'
    DEPARTED = 'departed', 'Departed'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


class PricingTier(models.TextChoices):
    STANDARD = 'standard', 'Standard'
    STANDING = 'standing', 'Standing'
    PREMIUM = 'premium', 'Premium'
    FREIGHT = 'freight', 'Freight'


class VehicleSize(models.TextChoices):
    SEDAN = 'sedan', 'Sedan'
    SUV = 'suv', 'SUV'
    MINIVAN = 'minivan', 'Minivan'
    MINIBUS = 'minibus', 'Minibus'
    BUS = 'bus', 'Bus'


class PassengerStatus(models.TextChoices):
    CONFIRMED = 'confirmed', 'Confirmed'
    BOARDED = 'boarded', 'Boarded'
    ALIGHTED = 'alighted', 'Alighted'
    CANCELLED = 'cancelled', 'Cancelled'
    NO_SHOW = 'no_show', 'No Show'


class ScheduledRide(models.Model):
    """Admin-created, time-bound campus transit ride."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=24, unique=True, db_index=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='scheduled_rides_created',
    )
    campus = models.ForeignKey(
        Campus,
        on_delete=models.PROTECT,
        related_name='scheduled_rides',
    )

    departure_date = models.DateField()
    window_start = models.TimeField()
    window_end = models.TimeField()
    join_deadline = models.DateTimeField()

    origin_address = models.CharField(max_length=255)
    origin_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    origin_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    destination_address = models.CharField(max_length=255)
    destination_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    destination_longitude = models.DecimalField(max_digits=9, decimal_places=6)

    vehicle_size = models.CharField(
        max_length=20,
        choices=VehicleSize.choices,
        default=VehicleSize.BUS,
    )
    cargo_capacity_kg = models.PositiveIntegerField(default=0)
    accessibility_features = models.JSONField(default=list, blank=True)
    assigned_driver = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scheduled_rides_assigned',
    )

    standard_enabled = models.BooleanField(default=True)
    standard_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    standing_enabled = models.BooleanField(default=False)
    standing_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    premium_enabled = models.BooleanField(default=False)
    premium_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    freight_enabled = models.BooleanField(default=False)
    freight_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    status = models.CharField(
        max_length=20,
        choices=ScheduledRideStatus.choices,
        default=ScheduledRideStatus.SCHEDULED,
        db_index=True,
    )
    admin_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'scheduled_rides'
        ordering = ['departure_date', 'window_start']
        indexes = [
            models.Index(fields=['campus', 'status', 'departure_date']),
            models.Index(fields=['status', 'join_deadline']),
            models.Index(fields=['created_by', 'departure_date']),
            models.Index(fields=['assigned_driver', 'departure_date']),
        ]

    def __str__(self):
        return f'ScheduledRide({self.reference} {self.departure_date} {self.window_start}-{self.window_end})'

    @property
    def is_joinable(self):
        return self.status == ScheduledRideStatus.SCHEDULED and timezone.now() < self.join_deadline

    @property
    def passenger_count(self):
        return self.passengers.exclude(status=PassengerStatus.CANCELLED).count()

    @property
    def enabled_tiers(self):
        tiers = []
        if self.standard_enabled:
            tiers.append(PricingTier.STANDARD)
        if self.standing_enabled:
            tiers.append(PricingTier.STANDING)
        if self.premium_enabled:
            tiers.append(PricingTier.PREMIUM)
        if self.freight_enabled:
            tiers.append(PricingTier.FREIGHT)
        return tiers

    def get_tier_price(self, tier: str):
        return {
            PricingTier.STANDARD: self.standard_price,
            PricingTier.STANDING: self.standing_price,
            PricingTier.PREMIUM: self.premium_price,
            PricingTier.FREIGHT: self.freight_price,
        }.get(tier)

    def transition_to(self, new_status):
        valid_transitions = {
            ScheduledRideStatus.SCHEDULED: [
                ScheduledRideStatus.BOARDING,
                ScheduledRideStatus.DEPARTED,
                ScheduledRideStatus.CANCELLED,
            ],
            ScheduledRideStatus.BOARDING: [
                ScheduledRideStatus.DEPARTED,
                ScheduledRideStatus.CANCELLED,
            ],
            ScheduledRideStatus.DEPARTED: [ScheduledRideStatus.COMPLETED],
        }
        allowed = valid_transitions.get(self.status, [])
        if new_status not in allowed:
            raise ValueError(f'Invalid transition: {self.status} -> {new_status}. Allowed: {allowed}')
        self.status = new_status


class ScheduledRideStop(models.Model):
    """Ordered pickup/dropoff stop on a scheduled ride route."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(ScheduledRide, on_delete=models.CASCADE, related_name='stops')
    order = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    estimated_arrival_offset_min = models.PositiveSmallIntegerField(default=0)
    is_pickup = models.BooleanField(default=True)
    is_dropoff = models.BooleanField(default=True)

    class Meta:
        db_table = 'scheduled_ride_stops'
        ordering = ['ride', 'order']
        unique_together = [('ride', 'order')]
        indexes = [models.Index(fields=['ride', 'order'])]

    def __str__(self):
        return f'Stop #{self.order}: {self.name} ({self.ride.reference})'


class ScheduledRidePassenger(models.Model):
    """A student ticket for a scheduled ride."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(ScheduledRide, on_delete=models.PROTECT, related_name='passengers')
    student = models.ForeignKey(User, on_delete=models.PROTECT, related_name='scheduled_ride_bookings')
    pricing_tier = models.CharField(max_length=20, choices=PricingTier.choices)
    boarding_stop = models.ForeignKey(
        ScheduledRideStop,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='boarding_passengers',
    )
    alighting_stop = models.ForeignKey(
        ScheduledRideStop,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alighting_passengers',
    )
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    payment_reference = models.CharField(max_length=40, blank=True)
    cargo_description = models.TextField(blank=True)
    cargo_weight_kg = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=PassengerStatus.choices, default=PassengerStatus.CONFIRMED)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'scheduled_ride_passengers'
        ordering = ['-joined_at']
        unique_together = [('ride', 'student')]
        indexes = [
            models.Index(fields=['ride', 'status']),
            models.Index(fields=['student', 'joined_at']),
        ]

    def __str__(self):
        return f'Passenger({self.ride.reference} {self.student_id} {self.pricing_tier})'

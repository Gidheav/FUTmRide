import uuid
from django.db import models
from django.utils import timezone
from apps.accounts.models import User
from .models import VehicleType


class GarageRideStatus(models.TextChoices):
    OPEN = 'open', 'Open (Accepting Passengers)'
    FULL = 'full', 'Full'
    DEPARTED = 'departed', 'Departed'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


class GarageRide(models.Model):
    """
    A driver-created ride that sits in a garage/bus park.
    Each ride has a unique QR token. Students scan the QR,
    see the ride details, and pay per seat to board.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    qr_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
        help_text='Unique token encoded in the QR code. One per ride creation.',
    )
    reference = models.CharField(max_length=24, unique=True, db_index=True)

    driver = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='garage_rides_as_driver',
    )

    # Route
    origin_address = models.CharField(max_length=255)
    origin_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    origin_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    destination_address = models.CharField(max_length=255)
    destination_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    destination_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    estimated_distance_km = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    estimated_route_geometry = models.JSONField(default=list, blank=True)

    # Vehicle & capacity
    vehicle_type = models.CharField(
        max_length=20, choices=VehicleType.choices, default=VehicleType.SEDAN
    )
    total_seats = models.PositiveSmallIntegerField(default=4)
    booked_seats = models.PositiveSmallIntegerField(default=0)

    # Pricing
    fare_per_seat = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(
        max_length=20,
        choices=GarageRideStatus.choices,
        default=GarageRideStatus.OPEN,
        db_index=True,
    )

    # Optional notes from driver (e.g., "Departs at 4pm sharp")
    driver_note = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    departed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='QR auto-expires after this time (optional).',
    )

    class Meta:
        db_table = 'garage_rides'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['driver', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f'GarageRide({self.reference} {self.origin_address}→{self.destination_address} {self.status})'

    @property
    def available_seats(self):
        return self.total_seats - self.booked_seats

    @property
    def is_expired(self):
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False

    @property
    def can_board(self):
        return (
            self.status == GarageRideStatus.OPEN
            and self.available_seats > 0
            and not self.is_expired
        )


class GarageRidePassenger(models.Model):
    """
    A record of a student who scanned the QR and paid to board.
    Each row = one seat purchase.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_ref = models.CharField(max_length=12, unique=True, db_index=True, blank=True, null=True)
    garage_ride = models.ForeignKey(
        GarageRide,
        on_delete=models.PROTECT,
        related_name='passengers',
    )
    student = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='garage_ride_bookings',
    )
    seats_booked = models.PositiveSmallIntegerField(default=1)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    wallet_transaction_reference = models.CharField(max_length=40, blank=True)
    boarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'garage_ride_passengers'
        ordering = ['-boarded_at']
        # A student can board the same garage ride only once
        unique_together = [('garage_ride', 'student')]
        indexes = [
            models.Index(fields=['garage_ride', 'boarded_at']),
            models.Index(fields=['student', 'boarded_at']),
        ]

    def __str__(self):
        return f'GaragePassenger(ride={self.garage_ride.reference} student={self.student_id} seats={self.seats_booked})'

    def save(self, *args, **kwargs):
        if not self.ticket_ref:
            from django.utils.crypto import get_random_string
            from apps.rides.scheduled_models import ScheduledRidePassenger
            while True:
                candidate = f'TCK-{get_random_string(length=6, allowed_chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}'
                if not GarageRidePassenger.objects.filter(ticket_ref=candidate).exists() and \
                   not ScheduledRidePassenger.objects.filter(ticket_ref=candidate).exists():
                    self.ticket_ref = candidate
                    break
        super().save(*args, **kwargs)


class DriverSavedRoute(models.Model):
    """
    Driver-saved routes for fast garage ride creation.
    Stored per driver and synced to devices.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='saved_routes',
    )
    name = models.CharField(max_length=80, blank=True)
    origin_address = models.CharField(max_length=255)
    origin_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    origin_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    destination_address = models.CharField(max_length=255)
    destination_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    destination_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    distance_km = models.DecimalField(max_digits=8, decimal_places=2)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'driver_saved_routes'
        ordering = ['-last_used_at', '-created_at']
        indexes = [
            models.Index(fields=['driver', 'created_at'], name='driver_sav_driver__e4934d_idx'),
            models.Index(fields=['driver', 'last_used_at'], name='driver_sav_driver__e0f2a2_idx'),
        ]

    def __str__(self):
        label = self.name or f'{self.origin_address} → {self.destination_address}'
        return f'DriverSavedRoute({label})'

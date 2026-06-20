import uuid
from django.db import models
from django.utils import timezone
from apps.accounts.models import User


class FareConfiguration(models.Model):
    class VehicleType(models.TextChoices):
        MOTORBIKE = 'motorbike', 'Motorbike'
        TRICYCLE = 'tricycle', 'Tricycle'
        SEDAN = 'sedan', 'Sedan'
        MPV = 'mpv', 'MPV'
        MINIBUS = 'minibus', 'Minibus'
        COACH = 'coach', 'Coach'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle_type = models.CharField(max_length=20, choices=VehicleType.choices, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    base_fare = models.DecimalField(max_digits=8, decimal_places=2)
    per_km_rate = models.DecimalField(max_digits=8, decimal_places=2)
    minimum_fare = models.DecimalField(max_digits=8, decimal_places=2)
    booking_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    surge_enabled = models.BooleanField(default=False)
    max_surge_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=2.00)
    effective_from = models.DateTimeField()
    effective_to = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fare_configurations'
        ordering = ['-effective_from']
        indexes = [
            models.Index(fields=['vehicle_type', 'is_active']),
        ]

    def __str__(self):
        return f'FareConfig({self.vehicle_type} from {self.effective_from.date()})'

    @classmethod
    def get_active(cls, vehicle_type: str):
        """Get the currently active config for a given vehicle type."""
        now = timezone.now()
        return cls.objects.filter(
            vehicle_type=vehicle_type,
            is_active=True,
            effective_from__lte=now,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=now)
        ).order_by('-effective_from', '-created_at').first()


class PlatformSettings(models.Model):
    """
    Singleton model for global platform pricing/operational settings.
    Only one row should ever exist; use PlatformSettings.load() to access.
    """

    class DistanceProvider(models.TextChoices):
        HAVERSINE = 'haversine', 'Haversine (Fallback)'
        OSRM = 'osrm', 'OSRM Routing (Primary)'
        GOOGLE = 'google', 'Google Distance Matrix'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=0.1500,
        help_text='Platform commission as a decimal (e.g., 0.15 = 15%)',
    )
    distance_provider = models.CharField(
        max_length=20, choices=DistanceProvider.choices, default=DistanceProvider.HAVERSINE,
    )
    max_distance_km = models.DecimalField(
        max_digits=6, decimal_places=2, default=150.00,
        help_text='Maximum distance allowed for ride requests in KM',
    )
    no_show_fee_enabled = models.BooleanField(default=True)
    no_show_fee_amount = models.DecimalField(
        max_digits=8, decimal_places=2, default=200.00,
        help_text='Fee charged to student after no-show timeout',
    )
    no_show_wait_minutes = models.PositiveSmallIntegerField(
        default=5, help_text='Minutes driver must wait before no-show can be triggered',
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
    )

    class Meta:
        db_table = 'platform_settings'
        verbose_name = 'Platform Settings'
        verbose_name_plural = 'Platform Settings'

    def __str__(self):
        return f'PlatformSettings (commission={self.commission_rate})'

    @classmethod
    def load(cls):
        """Load the singleton instance, creating defaults if not yet present."""
        obj, _ = cls.objects.get_or_create(defaults={})
        return obj
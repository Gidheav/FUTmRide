import uuid
from django.db import models
from apps.accounts.models import User


class FareConfiguration(models.Model):
    class VehicleType(models.TextChoices):
        MOTORCYCLE = 'motorcycle', 'Motorcycle'
        TRICYCLE = 'tricycle', 'Tricycle (Keke)'
        SEDAN = 'sedan', 'Sedan'
        SUV = 'suv', 'SUV'
        MINIVAN = 'minivan', 'Minivan / Shuttle'

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
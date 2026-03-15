import uuid
from django.db import models
from apps.accounts.models import User
from apps.rides.models import Ride


class DriverLocation(models.Model):
    driver = models.OneToOneField(User, on_delete=models.CASCADE, related_name='current_location', primary_key=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    heading = models.FloatField(null=True, blank=True)
    speed_kmh = models.FloatField(null=True, blank=True)
    accuracy_meters = models.FloatField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = 'driver_locations'

    def __str__(self):
        return f'DriverLocation({self.driver_id})'


class TripLocationSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='location_snapshots')
    recorded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    heading = models.FloatField(null=True, blank=True)
    speed_kmh = models.FloatField(null=True, blank=True)
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        db_table = 'trip_location_snapshots'
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['ride', 'timestamp']),
        ]
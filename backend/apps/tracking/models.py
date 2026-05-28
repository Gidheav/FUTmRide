import uuid
from django.db import models
from django.utils import timezone
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


class DispatchIncidentLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident_key = models.CharField(max_length=80, unique=True, db_index=True)
    incident_type = models.CharField(max_length=60, db_index=True)
    severity = models.CharField(max_length=20, db_index=True)
    campus_id = models.UUIDField(null=True, blank=True, db_index=True)
    ride_id = models.UUIDField(null=True, blank=True, db_index=True)
    driver_id = models.UUIDField(null=True, blank=True, db_index=True)
    message = models.TextField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    first_seen_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(auto_now=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'dispatch_incident_logs'
        ordering = ['-last_seen_at']
        indexes = [
            models.Index(fields=['campus_id', 'last_seen_at'], name='dispatch_incident_logs_campus_last_seen_idx'),
        ]

    def __str__(self):
        return f'DispatchIncidentLog({self.incident_key})'
import uuid
from django.db import models
from django.utils import timezone
from apps.accounts.models import User
from .models import Ride, VehicleType


class SharedRide(models.Model):
    class Status(models.TextChoices):
        GATHERING = 'gathering', 'Gathering'
        READY = 'ready', 'Ready'
        MATCHING = 'matching', 'Matching'
        MATCHED = 'matched', 'Matched'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'
        EXPIRED = 'expired', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=20, unique=True, db_index=True)
    share_code = models.CharField(max_length=12, unique=True, db_index=True)

    creator = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name='created_shared_rides'
    )
    vehicle_type = models.CharField(
        max_length=20, choices=VehicleType.choices, default=VehicleType.SEDAN
    )

    dropoff_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_address = models.CharField(max_length=255)

    max_riders = models.PositiveSmallIntegerField(default=4)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.GATHERING, db_index=True
    )

    # Computed pricing once dispatched
    anchor_distance_km = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    anchor_fare = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_collected = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    driver_earnings = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    platform_commission = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    ride = models.ForeignKey(Ride, on_delete=models.SET_NULL, null=True, blank=True, related_name='shared_rides')

    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shared_rides'
        ordering = ['-created_at']

    def __str__(self):
        return f'SharedRide({self.share_code} - {self.status})'


class SharedRideRider(models.Model):
    class Status(models.TextChoices):
        INVITED = 'invited', 'Invited'
        JOINED = 'joined', 'Joined'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shared_ride = models.ForeignKey(SharedRide, on_delete=models.CASCADE, related_name='riders')
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='shared_ride_memberships')

    pickup_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_address = models.CharField(max_length=255, blank=True)

    distance_km = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    fare_share = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.INVITED, db_index=True
    )
    joined_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'shared_ride_riders'
        unique_together = [('shared_ride', 'user')]

    def __str__(self):
        return f'Rider({self.user.id} -> {self.shared_ride.share_code})'

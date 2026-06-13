import uuid
from django.db import models
from django.utils import timezone
from apps.accounts.models import User


class RideStatus(models.TextChoices):
    REQUESTED = 'requested', 'Requested'
    SEARCHING = 'searching', 'Searching for Driver'
    DRIVER_ASSIGNED = 'driver_assigned', 'Driver Assigned'
    DRIVER_EN_ROUTE = 'driver_en_route', 'Driver En Route'
    DRIVER_ARRIVED = 'driver_arrived', 'Driver Arrived'
    IN_PROGRESS = 'in_progress', 'Trip In Progress'
    COMPLETED = 'completed', 'Completed'
    CANCELLED_BY_STUDENT = 'cancelled_by_student', 'Cancelled by Student'
    CANCELLED_BY_DRIVER = 'cancelled_by_driver', 'Cancelled by Driver'
    CANCELLED_NO_DRIVER = 'cancelled_no_driver', 'Cancelled - No Driver Found'
    CANCELLED_NO_SHOW = 'cancelled_no_show', 'Cancelled - No Show'
    DISPUTED = 'disputed', 'Disputed'


class PaymentMethod(models.TextChoices):
    WALLET = 'wallet', 'Wallet'
    CARD = 'card', 'Card'
    CASH = 'cash', 'Cash'


class VehicleType(models.TextChoices):
    MOTORBIKE = 'motorbike', 'Motorbike'
    TRICYCLE = 'tricycle', 'Tricycle'
    SEDAN = 'sedan', 'Sedan'
    MPV = 'mpv', 'MPV'
    MINIBUS = 'minibus', 'Minibus'
    COACH = 'coach', 'Coach'


class Ride(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=20, unique=True, db_index=True)

    student = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name='rides_as_student'
    )
    driver = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='rides_as_driver'
    )

    status = models.CharField(
        max_length=30, choices=RideStatus.choices, default=RideStatus.REQUESTED, db_index=True
    )
    vehicle_type_requested = models.CharField(
        max_length=20, choices=VehicleType.choices, default=VehicleType.SEDAN
    )
    requested_seats = models.PositiveSmallIntegerField(default=1)

    pickup_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_address = models.CharField(max_length=255)
    dropoff_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_address = models.CharField(max_length=255)

    scheduled_pickup_time = models.DateTimeField(null=True, blank=True)

    estimated_distance_km = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    actual_distance_km = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    estimated_duration_minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    actual_duration_minutes = models.PositiveSmallIntegerField(null=True, blank=True)

    base_fare = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    surge_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.00)
    total_fare = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    platform_commission = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    driver_earnings = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    is_paid = models.BooleanField(default=False)

    cancellation_reason = models.TextField(blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    no_show_fee_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    no_show_marked_at = models.DateTimeField(null=True, blank=True)

    emergency_activated = models.BooleanField(default=False)
    shared_with_contacts = models.JSONField(default=list, blank=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    driver_assigned_at = models.DateTimeField(null=True, blank=True)
    driver_arrived_at = models.DateTimeField(null=True, blank=True)
    trip_started_at = models.DateTimeField(null=True, blank=True)
    trip_completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rides'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['status', 'requested_at']),
            models.Index(fields=['student', 'status']),
            models.Index(fields=['driver', 'status']),
        ]

    def __str__(self):
        return f'Ride({self.reference} - {self.status})'

    @property
    def is_active(self):
        return self.status in [
            RideStatus.SEARCHING,
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.DRIVER_EN_ROUTE,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
        ]

    def transition_to(self, new_status):
        valid_transitions = {
            RideStatus.REQUESTED: [RideStatus.SEARCHING, RideStatus.CANCELLED_BY_STUDENT],
            RideStatus.SEARCHING: [
                RideStatus.DRIVER_ASSIGNED,
                RideStatus.CANCELLED_NO_DRIVER,
                RideStatus.CANCELLED_BY_STUDENT,
            ],
            RideStatus.DRIVER_ASSIGNED: [
                RideStatus.DRIVER_EN_ROUTE,
                RideStatus.CANCELLED_BY_DRIVER,
                RideStatus.CANCELLED_BY_STUDENT,
            ],
            RideStatus.DRIVER_EN_ROUTE: [
                RideStatus.DRIVER_ARRIVED,
                RideStatus.CANCELLED_BY_DRIVER,
                RideStatus.CANCELLED_BY_STUDENT,
            ],
            RideStatus.DRIVER_ARRIVED: [
                RideStatus.IN_PROGRESS,
                RideStatus.CANCELLED_BY_DRIVER,
                RideStatus.CANCELLED_BY_STUDENT,
                RideStatus.CANCELLED_NO_SHOW,
            ],
            RideStatus.IN_PROGRESS: [RideStatus.COMPLETED, RideStatus.DISPUTED],
            RideStatus.COMPLETED: [RideStatus.DISPUTED],
        }
        allowed = valid_transitions.get(self.status, [])
        if new_status not in allowed:
            raise ValueError(
                f'Invalid transition: {self.status} -> {new_status}. Allowed: {allowed}'
            )
        self.status = new_status
        timestamp_map = {
            RideStatus.DRIVER_ASSIGNED: 'driver_assigned_at',
            RideStatus.DRIVER_ARRIVED: 'driver_arrived_at',
            RideStatus.IN_PROGRESS: 'trip_started_at',
            RideStatus.COMPLETED: 'trip_completed_at',
        }
        if new_status in timestamp_map:
            setattr(self, timestamp_map[new_status], timezone.now())
        if new_status in [
            RideStatus.CANCELLED_BY_STUDENT,
            RideStatus.CANCELLED_BY_DRIVER,
            RideStatus.CANCELLED_NO_DRIVER,
            RideStatus.CANCELLED_NO_SHOW,
        ]:
            self.cancelled_at = timezone.now()


class DriverRideRequest(models.Model):
    class Response(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        TIMED_OUT = 'timed_out', 'Timed Out'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='driver_requests')
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ride_requests_received')
    response = models.CharField(max_length=10, choices=Response.choices, default=Response.PENDING)
    offered_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'driver_ride_requests'
        unique_together = [('ride', 'driver')]
        indexes = [
            models.Index(fields=['ride', 'response']),
            models.Index(fields=['driver', 'offered_at']),
        ]

    def __str__(self):
        return f'RideRequest(ride={self.ride.reference} driver={self.driver_id} response={self.response})'


# Import split-out model modules so Django discovers them during app loading
# and migration generation. These imports intentionally live at the end to
# avoid circular imports with VehicleType.
from .garage_models import DriverSavedRoute, GarageRide, GarageRidePassenger  # noqa: E402,F401
from .scheduled_models import ScheduledRide, ScheduledRidePassenger, ScheduledRideStop  # noqa: E402,F401

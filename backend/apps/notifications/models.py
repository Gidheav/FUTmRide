import uuid
from django.db import models
from apps.accounts.models import User


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        RIDE_REQUESTED = 'ride_requested', 'Ride Requested'
        DRIVER_ASSIGNED = 'driver_assigned', 'Driver Assigned'
        DRIVER_ARRIVED = 'driver_arrived', 'Driver Arrived'
        TRIP_STARTED = 'trip_started', 'Trip Started'
        TRIP_COMPLETED = 'trip_completed', 'Trip Completed'
        RIDE_CANCELLED = 'ride_cancelled', 'Ride Cancelled'
        PAYMENT_RECEIVED = 'payment_received', 'Payment Received'
        ACCOUNT_APPROVED = 'account_approved', 'Account Approved'
        VERIFICATION_SUBMITTED = 'verification_submitted', 'Verification Submitted'
        BROADCAST = 'broadcast', 'Broadcast'
        SYSTEM_ALERT = 'system_alert', 'System Alert'
        GENERAL = 'general', 'General'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=120)
    body = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f'Notification({self.user.phone_number} {self.notification_type})'
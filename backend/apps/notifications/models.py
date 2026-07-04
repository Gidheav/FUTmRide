import uuid
from django.db import models
from apps.accounts.models import Campus, User


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
        SUPPORT_TICKET = 'support_ticket', 'Support Ticket'
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


class InAppAnnouncement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campus = models.ForeignKey(
        Campus,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='in_app_announcements',
        help_text='Optional campus scope. Leave blank for a global student announcement.',
    )
    campaign_id = models.CharField(
        max_length=80,
        unique=True,
        db_index=True,
        help_text='Stable ID used by mobile clients to show this campaign once.',
    )
    title = models.CharField(max_length=120)
    body = models.TextField()
    image_url = models.URLField(blank=True)
    icon_name = models.CharField(
        max_length=50,
        blank=True,
        default='campaign',
        help_text='Optional MaterialIcons name used when no image URL is supplied.',
    )
    cta_label = models.CharField(max_length=30, default='Got it')
    is_active = models.BooleanField(default=False, db_index=True)
    send_push_notification = models.BooleanField(
        default=False,
        help_text='If checked, this announcement will also be sent to the notification page and as a push notification.',
    )
    push_sent = models.BooleanField(default=False, editable=False)
    starts_at = models.DateTimeField(null=True, blank=True, db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True)
    priority = models.PositiveSmallIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'in_app_announcements'
        ordering = ['-priority', '-created_at']
        indexes = [
            models.Index(fields=['is_active', 'starts_at', 'ends_at']),
        ]

    def __str__(self):
        return f'InAppAnnouncement({self.campaign_id})'

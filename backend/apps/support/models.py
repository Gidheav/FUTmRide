import uuid
from django.db import models
from apps.accounts.models import User
from apps.rides.models import Ride


class SupportTicket(models.Model):
    class Category(models.TextChoices):
        RIDE_ISSUE = 'ride_issue', 'Ride Issue'
        PAYMENT_ISSUE = 'payment_issue', 'Payment Issue'
        DRIVER_COMPLAINT = 'driver_complaint', 'Driver Complaint'
        STUDENT_COMPLAINT = 'student_complaint', 'Student Complaint'
        ACCOUNT_ISSUE = 'account_issue', 'Account Issue'
        OTHER = 'other', 'Other'

    class TicketStatus(models.TextChoices):
        OPEN = 'open', 'Open'
        IN_PROGRESS = 'in_progress', 'In Progress'
        RESOLVED = 'resolved', 'Resolved'
        CLOSED = 'closed', 'Closed'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        URGENT = 'urgent', 'Urgent'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=20, unique=True, db_index=True)
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets')
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets'
    )
    ride = models.ForeignKey(Ride, on_delete=models.SET_NULL, null=True, blank=True)
    category = models.CharField(max_length=30, choices=Category.choices)
    subject = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=15, choices=TicketStatus.choices, default=TicketStatus.OPEN, db_index=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'support_tickets'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'priority']),
            models.Index(fields=['submitted_by', 'status']),
        ]

    def __str__(self):
        return f'Ticket({self.reference} {self.status})'
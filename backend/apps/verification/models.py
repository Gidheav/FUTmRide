import uuid
from django.db import models
from apps.accounts.models import User


class DriverDocument(models.Model):
    class DocumentType(models.TextChoices):
        NATIONAL_ID = 'national_id', 'National ID'
        DRIVERS_LICENSE = 'drivers_license', "Driver's Licence"
        VEHICLE_REGISTRATION = 'vehicle_registration', 'Vehicle Registration'
        VEHICLE_INSURANCE = 'vehicle_insurance', 'Vehicle Insurance'
        PROFILE_PHOTO = 'profile_photo', 'Profile Photo'
        VEHICLE_PHOTO = 'vehicle_photo', 'Vehicle Photo'

    class DocumentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=30, choices=DocumentType.choices)
    file = models.FileField(upload_to='driver_docs/%Y/%m/')
    status = models.CharField(max_length=10, choices=DocumentStatus.choices, default=DocumentStatus.PENDING, db_index=True)
    rejection_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_documents')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'driver_documents'
        unique_together = [('driver', 'document_type')]
        indexes = [
            models.Index(fields=['driver', 'status']),
        ]

    def __str__(self):
        return f'Doc({self.driver.full_name} {self.document_type} {self.status})'
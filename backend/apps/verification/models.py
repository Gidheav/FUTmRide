import uuid
from django.db import models
from apps.accounts.models import User


class AccountVerification(models.Model):
    """Stage 1: Driver submits personal identity details + NIN scan."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        UNDER_REVIEW = 'under_review', 'Under Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    NIGERIAN_STATES = [
        ('abia', 'Abia'), ('adamawa', 'Adamawa'), ('akwa_ibom', 'Akwa Ibom'),
        ('anambra', 'Anambra'), ('bauchi', 'Bauchi'), ('bayelsa', 'Bayelsa'),
        ('benue', 'Benue'), ('borno', 'Borno'), ('cross_river', 'Cross River'),
        ('delta', 'Delta'), ('ebonyi', 'Ebonyi'), ('edo', 'Edo'),
        ('ekiti', 'Ekiti'), ('enugu', 'Enugu'), ('fct', 'FCT (Abuja)'),
        ('gombe', 'Gombe'), ('imo', 'Imo'), ('jigawa', 'Jigawa'),
        ('kaduna', 'Kaduna'), ('kano', 'Kano'), ('katsina', 'Katsina'),
        ('kebbi', 'Kebbi'), ('kogi', 'Kogi'), ('kwara', 'Kwara'),
        ('lagos', 'Lagos'), ('nasarawa', 'Nasarawa'), ('niger', 'Niger'),
        ('ogun', 'Ogun'), ('ondo', 'Ondo'), ('osun', 'Osun'),
        ('oyo', 'Oyo'), ('plateau', 'Plateau'), ('rivers', 'Rivers'),
        ('sokoto', 'Sokoto'), ('taraba', 'Taraba'), ('yobe', 'Yobe'),
        ('zamfara', 'Zamfara'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='account_verification'
    )

    # Personal identity fields
    full_name = models.CharField(max_length=200)
    age = models.PositiveSmallIntegerField()
    state_of_origin = models.CharField(max_length=30, choices=NIGERIAN_STATES)
    address = models.TextField()

    # NIN
    nin_number = models.CharField(max_length=11, help_text='11-digit National Identification Number')
    nin_scan = models.FileField(upload_to='account_verification/%Y/%m/', help_text='Scanned NIN slip or card')

    # Workflow
    status = models.CharField(
        max_length=15, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    rejection_reason = models.TextField(blank=True)
    admin_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_account_verifications'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'account_verifications'
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['driver', 'status']),
        ]

    def __str__(self):
        return f'AccountVerification({self.driver.full_name} — {self.status})'


class DriverDocument(models.Model):
    """Stage 2: Driver submits vehicle-related documents (gated by AccountVerification approval)."""

    class DocumentType(models.TextChoices):
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
    status = models.CharField(
        max_length=10, choices=DocumentStatus.choices,
        default=DocumentStatus.PENDING, db_index=True
    )
    rejection_reason = models.TextField(blank=True)
    admin_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_documents'
    )
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
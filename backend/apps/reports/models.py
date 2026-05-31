import uuid

from django.conf import settings
from django.db import models


class ReportRun(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_key = models.CharField(max_length=80, db_index=True)
    report_title = models.CharField(max_length=200)
    category = models.CharField(max_length=40, db_index=True)
    format = models.CharField(max_length=10, db_index=True)
    period = models.CharField(max_length=10, default='30D')
    filters = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    row_count = models.PositiveIntegerField(default=0)
    file = models.FileField(upload_to='reports/runs/%Y/%m/', blank=True, null=True)
    file_size = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    campus = models.ForeignKey(
        'accounts.Campus', on_delete=models.SET_NULL, null=True, blank=True, related_name='report_runs',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='report_runs',
    )
    scheduled_report = models.ForeignKey(
        'ScheduledReport', on_delete=models.SET_NULL, null=True, blank=True, related_name='runs',
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'report_runs'
        ordering = ['-created_at']

    def __str__(self):
        return f'ReportRun({self.report_key} {self.status})'


class ScheduledReport(models.Model):
    class Frequency(models.TextChoices):
        DAILY = 'daily', 'Daily'
        WEEKLY = 'weekly', 'Weekly'
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    report_key = models.CharField(max_length=80, db_index=True)
    format = models.CharField(max_length=10, default='csv')
    period = models.CharField(max_length=10, default='30D')
    filters = models.JSONField(default=dict, blank=True)
    frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.WEEKLY)
    day_of_week = models.PositiveSmallIntegerField(default=0)  # 0=Mon
    day_of_month = models.PositiveSmallIntegerField(default=1)
    hour = models.PositiveSmallIntegerField(default=8)
    minute = models.PositiveSmallIntegerField(default=0)
    recipients = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    campus = models.ForeignKey(
        'accounts.Campus', on_delete=models.CASCADE, null=True, blank=True, related_name='scheduled_reports',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='scheduled_reports',
    )
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_status = models.CharField(max_length=20, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'scheduled_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f'ScheduledReport({self.name})'


class StatementAccessRequest(models.Model):
    class Scope(models.TextChoices):
        DRIVER_EARNINGS = 'driver_earnings', 'Driver Earnings'
        STUDENT_WALLET = 'student_wallet', 'Student Wallet'
        SINGLE_RIDE = 'single_ride', 'Single Ride'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        DENIED = 'denied', 'Denied'
        EXPIRED = 'expired', 'Expired'
        REVOKED = 'revoked', 'Revoked'

    class ConsentMethod(models.TextChoices):
        DRIVER_INITIATED = 'driver_initiated', 'Driver Initiated'
        ADMIN_REQUEST = 'admin_request', 'Admin Request'
        ADMIN_APPROVED = 'admin_approved', 'Admin Approved'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='statement_requests',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='statement_requests_created',
    )
    campus = models.ForeignKey(
        'accounts.Campus', on_delete=models.SET_NULL, null=True, blank=True,
    )
    scope = models.CharField(max_length=30, choices=Scope.choices, default=Scope.DRIVER_EARNINGS)
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    ride = models.ForeignKey('rides.Ride', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    consent_method = models.CharField(max_length=30, choices=ConsentMethod.choices)
    approved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    download_count = models.PositiveIntegerField(default=0)
    last_downloaded_at = models.DateTimeField(null=True, blank=True)
    last_downloaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='statement_downloads',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'statement_access_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f'StatementAccess({self.subject_id} {self.status})'

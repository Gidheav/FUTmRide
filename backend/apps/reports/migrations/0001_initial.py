# Generated manually for apps.reports

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0012_auditlog'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('rides', '0005_driver_saved_routes'),
    ]

    operations = [
        migrations.CreateModel(
            name='ScheduledReport',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=120)),
                ('report_key', models.CharField(db_index=True, max_length=80)),
                ('format', models.CharField(default='csv', max_length=10)),
                ('period', models.CharField(default='30D', max_length=10)),
                ('filters', models.JSONField(blank=True, default=dict)),
                ('frequency', models.CharField(choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('monthly', 'Monthly'), ('quarterly', 'Quarterly')], default='weekly', max_length=20)),
                ('day_of_week', models.PositiveSmallIntegerField(default=0)),
                ('day_of_month', models.PositiveSmallIntegerField(default=1)),
                ('hour', models.PositiveSmallIntegerField(default=8)),
                ('minute', models.PositiveSmallIntegerField(default=0)),
                ('recipients', models.JSONField(blank=True, default=list)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('last_run_at', models.DateTimeField(blank=True, null=True)),
                ('next_run_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('last_status', models.CharField(blank=True, max_length=20)),
                ('last_error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('campus', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='scheduled_reports', to='accounts.campus')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='scheduled_reports', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'scheduled_reports',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ReportRun',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('report_key', models.CharField(db_index=True, max_length=80)),
                ('report_title', models.CharField(max_length=200)),
                ('category', models.CharField(db_index=True, max_length=40)),
                ('format', models.CharField(db_index=True, max_length=10)),
                ('period', models.CharField(default='30D', max_length=10)),
                ('filters', models.JSONField(blank=True, default=dict)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('running', 'Running'), ('success', 'Success'), ('failed', 'Failed')], db_index=True, default='pending', max_length=20)),
                ('row_count', models.PositiveIntegerField(default=0)),
                ('file', models.FileField(blank=True, null=True, upload_to='reports/runs/%Y/%m/')),
                ('file_size', models.PositiveIntegerField(default=0)),
                ('error_message', models.TextField(blank=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('campus', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='report_runs', to='accounts.campus')),
                ('requested_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='report_runs', to=settings.AUTH_USER_MODEL)),
                ('scheduled_report', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='runs', to='reports.scheduledreport')),
            ],
            options={
                'db_table': 'report_runs',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='StatementAccessRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('scope', models.CharField(choices=[('driver_earnings', 'Driver Earnings'), ('student_wallet', 'Student Wallet'), ('single_ride', 'Single Ride')], default='driver_earnings', max_length=30)),
                ('period_start', models.DateTimeField()),
                ('period_end', models.DateTimeField()),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('denied', 'Denied'), ('expired', 'Expired'), ('revoked', 'Revoked')], db_index=True, default='pending', max_length=20)),
                ('consent_method', models.CharField(choices=[('driver_initiated', 'Driver Initiated'), ('admin_request', 'Admin Request'), ('admin_approved', 'Admin Approved')], max_length=30)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('download_count', models.PositiveIntegerField(default=0)),
                ('last_downloaded_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('campus', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='accounts.campus')),
                ('last_downloaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='statement_downloads', to=settings.AUTH_USER_MODEL)),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='statement_requests_created', to=settings.AUTH_USER_MODEL)),
                ('ride', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='rides.ride')),
                ('subject', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='statement_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'statement_access_requests',
                'ordering': ['-created_at'],
            },
        ),
    ]

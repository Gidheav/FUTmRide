import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_add_primary_gateway'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('action', models.CharField(choices=[
                    ('login', 'Login'),
                    ('logout', 'Logout'),
                    ('password_change', 'Password Change'),
                    ('role_change', 'Role Change'),
                    ('wallet_credit', 'Wallet Credit'),
                    ('wallet_debit', 'Wallet Debit'),
                    ('payment_webhook', 'Payment Webhook'),
                    ('integration_update', 'Integration Update'),
                    ('user_update', 'User Update'),
                    ('other', 'Other'),
                ], db_index=True, max_length=40)),
                ('target_type', models.CharField(blank=True, max_length=80)),
                ('target_id', models.CharField(blank=True, db_index=True, max_length=64)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('actor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='audit_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'audit_logs',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['action', 'created_at'], name='audit_logs_action_created_idx'),
                ],
            },
        ),
    ]

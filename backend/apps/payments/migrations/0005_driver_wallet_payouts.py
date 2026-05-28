from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0004_wallettransaction_transfer_sources'),
    ]

    operations = [
        migrations.AddField(
            model_name='wallettransaction',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('completed', 'Completed'),
                    ('failed', 'Failed'),
                    ('reversed', 'Reversed'),
                ],
                default='completed',
                max_length=20,
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='wallettransaction',
            index=models.Index(fields=['user', 'status'], name='wallet_user_status_idx'),
        ),
        migrations.CreateModel(
            name='DriverPayoutMethod',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('bank_name', models.CharField(max_length=120)),
                ('bank_code', models.CharField(blank=True, max_length=20)),
                ('account_number', models.CharField(max_length=20)),
                ('account_name', models.CharField(max_length=120)),
                ('is_verified', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='driver_payout_method', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'driver_payout_methods',
            },
        ),
        migrations.CreateModel(
            name='DriverWithdrawal',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('reference', models.CharField(db_index=True, max_length=40, unique=True)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('fee', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], db_index=True, default='pending', max_length=20)),
                ('bank_name', models.CharField(blank=True, max_length=120)),
                ('account_number_last4', models.CharField(blank=True, max_length=4)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('payout_method', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='withdrawals', to='payments.driverpayoutmethod')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='driver_withdrawals', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'driver_withdrawals',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.AddIndex(
            model_name='driverwithdrawal',
            index=models.Index(fields=['user', 'status'], name='driver_with_user_idx'),
        ),
        migrations.AddIndex(
            model_name='driverwithdrawal',
            index=models.Index(fields=['reference'], name='driver_with_ref_idx'),
        ),
    ]

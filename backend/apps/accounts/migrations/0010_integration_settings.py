from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_user_settings'),
    ]

    operations = [
        migrations.CreateModel(
            name='IntegrationSettings',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('payments_enabled', models.BooleanField(default=True)),
                ('paystack_enabled', models.BooleanField(default=True)),
                ('flutterwave_enabled', models.BooleanField(default=True)),
                ('notifications_enabled', models.BooleanField(default=True)),
                ('email_enabled', models.BooleanField(default=True)),
                ('sms_enabled', models.BooleanField(default=True)),
                ('push_enabled', models.BooleanField(default=True)),
                ('fcm_enabled', models.BooleanField(default=True)),
                ('expo_enabled', models.BooleanField(default=True)),
                ('routing_enabled', models.BooleanField(default=True)),
                ('auth_google_enabled', models.BooleanField(default=False)),
                ('auth_apple_enabled', models.BooleanField(default=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='integration_settings_updates', to='accounts.user')),
            ],
            options={
                'db_table': 'integration_settings',
                'verbose_name': 'Integration Settings',
                'verbose_name_plural': 'Integration Settings',
            },
        ),
    ]

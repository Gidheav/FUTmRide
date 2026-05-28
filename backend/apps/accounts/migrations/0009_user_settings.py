from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_driver_daily_goal_target'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('language', models.CharField(default='en', max_length=10)),
                ('theme_mode', models.CharField(choices=[('system', 'System'), ('light', 'Light'), ('dark', 'Dark')], default='system', max_length=10)),
                ('push_enabled', models.BooleanField(default=True)),
                ('navigation_app', models.CharField(choices=[('google_maps', 'Google Maps')], default='google_maps', max_length=30)),
                ('biometric_enabled', models.BooleanField(default=False)),
                ('two_factor_enabled', models.BooleanField(default=False)),
                ('two_factor_methods', models.JSONField(blank=True, default=list)),
                ('totp_secret', models.CharField(blank=True, max_length=64)),
                ('totp_confirmed_at', models.DateTimeField(blank=True, null=True)),
                ('backup_codes', models.JSONField(blank=True, default=list)),
                ('pin_hash', models.CharField(blank=True, max_length=128)),
                ('pin_updated_at', models.DateTimeField(blank=True, null=True)),
                ('active_device_id', models.CharField(blank=True, max_length=128)),
                ('active_device_platform', models.CharField(blank=True, max_length=40)),
                ('active_device_name', models.CharField(blank=True, max_length=120)),
                ('active_device_last_seen', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='settings', to='accounts.user')),
            ],
            options={
                'db_table': 'user_settings',
            },
        ),
    ]

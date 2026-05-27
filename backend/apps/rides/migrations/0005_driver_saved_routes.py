from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_driverprofile_fleet_fields'),
        ('rides', '0004_garageride_completed_at'),
    ]

    operations = [
        migrations.CreateModel(
            name='DriverSavedRoute',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(blank=True, max_length=80)),
                ('origin_address', models.CharField(max_length=255)),
                ('origin_latitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('origin_longitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('destination_address', models.CharField(max_length=255)),
                ('destination_latitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('destination_longitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('distance_km', models.DecimalField(decimal_places=2, max_digits=8)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('driver', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='saved_routes', to='accounts.user')),
            ],
            options={
                'db_table': 'driver_saved_routes',
                'ordering': ['-last_used_at', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='driversavedroute',
            index=models.Index(fields=['driver', 'created_at'], name='driver_sav_driver__e4934d_idx'),
        ),
        migrations.AddIndex(
            model_name='driversavedroute',
            index=models.Index(fields=['driver', 'last_used_at'], name='driver_sav_driver__e0f2a2_idx'),
        ),
    ]

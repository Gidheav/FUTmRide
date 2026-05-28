from django.db import migrations, models
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('tracking', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='DispatchIncidentLog',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('incident_key', models.CharField(max_length=80, unique=True, db_index=True)),
                ('incident_type', models.CharField(max_length=60, db_index=True)),
                ('severity', models.CharField(max_length=20, db_index=True)),
                ('campus_id', models.UUIDField(null=True, blank=True, db_index=True)),
                ('ride_id', models.UUIDField(null=True, blank=True, db_index=True)),
                ('driver_id', models.UUIDField(null=True, blank=True, db_index=True)),
                ('message', models.TextField()),
                ('latitude', models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)),
                ('longitude', models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)),
                ('first_seen_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('last_seen_at', models.DateTimeField(auto_now=True, db_index=True)),
                ('metadata', models.JSONField(default=dict, blank=True)),
            ],
            options={
                'db_table': 'dispatch_incident_logs',
                'ordering': ['-last_seen_at'],
            },
        ),
        migrations.AddIndex(
            model_name='dispatchincidentlog',
            index=models.Index(fields=['campus_id', 'last_seen_at'], name='dispatch_campus_seen_idx'),
        ),
    ]

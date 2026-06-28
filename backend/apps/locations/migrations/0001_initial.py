import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0016_alter_user_profile_photo'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Location',
            fields=[
                ('id', models.CharField(max_length=20, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('description', models.CharField(max_length=300)),
                ('latitude', models.DecimalField(decimal_places=8, max_digits=12)),
                ('longitude', models.DecimalField(decimal_places=8, max_digits=12)),
                ('category', models.CharField(
                    choices=[
                        ('lecture', 'Lecture Theatre'),
                        ('hostel', 'Hostel'),
                        ('gate', 'Gate'),
                        ('library', 'Library'),
                        ('blocks', 'Admin / General Block'),
                        ('medical', 'Medical Centre'),
                        ('sports', 'Sports Facility'),
                        ('ict', 'ICT Centre'),
                        ('canteen', 'Canteen / Cafeteria'),
                        ('mosque', 'Mosque'),
                        ('laboratory', 'Laboratory'),
                    ],
                    db_index=True,
                    max_length=30,
                )),
                ('campus', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='locations',
                    to='accounts.campus',
                )),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Location',
                'verbose_name_plural': 'Locations',
                'db_table': 'locations',
                'ordering': ['category', 'name'],
            },
        ),
        migrations.CreateModel(
            name='LocationSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('version', models.PositiveIntegerField(unique=True)),
                ('checksum', models.CharField(max_length=64)),
                ('size_bytes', models.PositiveIntegerField()),
                ('published_at', models.DateTimeField(auto_now_add=True)),
                ('published_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='location_snapshots',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('data', models.BinaryField()),
                ('is_current', models.BooleanField(db_index=True, default=False)),
            ],
            options={
                'verbose_name': 'Location Snapshot',
                'verbose_name_plural': 'Location Snapshots',
                'db_table': 'location_snapshots',
                'ordering': ['-version'],
            },
        ),
    ]

from django.db import migrations


VEHICLE_SEAT_CAPACITY = {
    'motorbike': 2,
    'tricycle': 4,
    'sedan': 5,
    'mpv': 9,
    'minibus': 14,
    'coach': 40,
}


def forwards(apps, schema_editor):
    DriverProfile = apps.get_model('accounts', 'DriverProfile')
    for vehicle_type, seats in VEHICLE_SEAT_CAPACITY.items():
        DriverProfile.objects.filter(vehicle_type=vehicle_type).update(vehicle_seats=seats)


def backwards(apps, schema_editor):
    DriverProfile = apps.get_model('accounts', 'DriverProfile')
    DriverProfile.objects.filter(vehicle_type='motorbike').update(vehicle_seats=1)
    DriverProfile.objects.filter(vehicle_type='tricycle').update(vehicle_seats=3)
    DriverProfile.objects.filter(vehicle_type='sedan').update(vehicle_seats=4)
    DriverProfile.objects.filter(vehicle_type='mpv').update(vehicle_seats=6)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_backfill_notification_defaults'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
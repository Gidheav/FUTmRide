from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_usersettings_notif_driver_arrived_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='usersettings',
            name='offline_pin_salt',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='usersettings',
            name='offline_pin_hash',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='usersettings',
            name='offline_pin_iterations',
            field=models.PositiveIntegerField(default=2500),
        ),
    ]

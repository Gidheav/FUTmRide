from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_studentsignupverificationsession'),
    ]

    operations = [
        migrations.AddField(
            model_name='driverprofile',
            name='maintenance_status',
            field=models.CharField(choices=[('active', 'Active'), ('in_service', 'In-Service'), ('grounded', 'Grounded'), ('in_shop', 'In Shop')], default='active', max_length=20, db_index=True),
        ),
        migrations.AddField(
            model_name='driverprofile',
            name='last_service_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='driverprofile',
            name='service_due_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='driverprofile',
            name='odometer_km',
            field=models.PositiveIntegerField(default=0),
        ),
    ]

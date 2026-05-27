from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rides', '0003_garage_ride_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='garageride',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('ride_requested', 'Ride Requested'),
                    ('driver_assigned', 'Driver Assigned'),
                    ('driver_arrived', 'Driver Arrived'),
                    ('trip_started', 'Trip Started'),
                    ('trip_completed', 'Trip Completed'),
                    ('ride_cancelled', 'Ride Cancelled'),
                    ('payment_received', 'Payment Received'),
                    ('account_approved', 'Account Approved'),
                    ('verification_submitted', 'Verification Submitted'),
                    ('broadcast', 'Broadcast'),
                    ('system_alert', 'System Alert'),
                    ('support_ticket', 'Support Ticket'),
                    ('general', 'General'),
                ],
                max_length=30,
            ),
        ),
    ]

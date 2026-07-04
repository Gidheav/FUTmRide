# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0004_inappannouncement_campus'),
    ]

    operations = [
        migrations.AddField(
            model_name='inappannouncement',
            name='push_sent',
            field=models.BooleanField(default=False, editable=False),
        ),
        migrations.AddField(
            model_name='inappannouncement',
            name='send_push_notification',
            field=models.BooleanField(default=False, help_text='If checked, this announcement will also be sent to the notification page and as a push notification.'),
        ),
    ]

# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0005_inappannouncement_push_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='inappannouncement',
            name='audience',
            field=models.CharField(choices=[('student', 'Student'), ('driver', 'Driver'), ('all', 'All')], default='all', help_text='Who should see this announcement (Student, Driver, or All).', max_length=20),
        ),
    ]

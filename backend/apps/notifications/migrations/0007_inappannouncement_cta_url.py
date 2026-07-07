# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0006_inappannouncement_audience'),
    ]

    operations = [
        migrations.AddField(
            model_name='inappannouncement',
            name='cta_url',
            field=models.URLField(blank=True, help_text='Optional URL opened by the announcement action button.'),
        ),
    ]

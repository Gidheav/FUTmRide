from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_alter_user_profile_photo'),
        ('notifications', '0003_inappannouncement'),
    ]

    operations = [
        migrations.AddField(
            model_name='inappannouncement',
            name='campus',
            field=models.ForeignKey(
                blank=True,
                help_text='Optional campus scope. Leave blank for a global student announcement.',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='in_app_announcements',
                to='accounts.campus',
            ),
        ),
    ]

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_support_ticket_notification_type'),
    ]

    operations = [
        migrations.CreateModel(
            name='InAppAnnouncement',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('campaign_id', models.CharField(db_index=True, help_text='Stable ID used by mobile clients to show this campaign once.', max_length=80, unique=True)),
                ('title', models.CharField(max_length=120)),
                ('body', models.TextField()),
                ('image_url', models.URLField(blank=True)),
                ('icon_name', models.CharField(blank=True, default='campaign', help_text='Optional MaterialIcons name used when no image URL is supplied.', max_length=50)),
                ('cta_label', models.CharField(default='Got it', max_length=30)),
                ('is_active', models.BooleanField(db_index=True, default=False)),
                ('starts_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('ends_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('priority', models.PositiveSmallIntegerField(db_index=True, default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'in_app_announcements',
                'ordering': ['-priority', '-created_at'],
                'indexes': [
                    models.Index(fields=['is_active', 'starts_at', 'ends_at'], name='in_app_anno_is_acti_52531d_idx'),
                ],
            },
        ),
    ]

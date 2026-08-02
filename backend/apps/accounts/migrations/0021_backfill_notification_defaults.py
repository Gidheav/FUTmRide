"""
Data migration: set all existing notification preference fields to True.

Before this fix, every field defaulted to False — which silently blocked
all push notifications once a UserSettings row was created (e.g. by
visiting the Notification Settings page).  This migration back-fills
existing rows so no user is left with notifications unexpectedly disabled.
"""
from django.db import migrations


def backfill_notification_defaults(apps, schema_editor):
    UserSettings = apps.get_model('accounts', 'UserSettings')
    UserSettings.objects.all().update(
        push_enabled=True,
        notif_sound_enabled=True,
        notif_ride_requested=True,
        notif_driver_assigned=True,
        notif_driver_en_route=True,
        notif_driver_arrived=True,
        notif_trip_started=True,
        notif_trip_completed=True,
        notif_ride_cancelled=True,
        notif_wallet_credit=True,
        notif_wallet_debit=True,
        notif_promotions=True,
    )


def reverse_noop(apps, schema_editor):
    pass  # No sensible reverse — don't revert to broken state


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0020_fix_notification_defaults_to_true'),
    ]

    operations = [
        migrations.RunPython(backfill_notification_defaults, reverse_noop),
    ]

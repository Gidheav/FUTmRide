from django.apps import AppConfig


class RidesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.rides'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(self._register_periodic_tasks, sender=self)

    def _register_periodic_tasks(self, **kwargs):
        try:
            from django_celery_beat.models import PeriodicTask, IntervalSchedule
            every_minute, _ = IntervalSchedule.objects.get_or_create(
                every=1, period=IntervalSchedule.MINUTES
            )
            every_hour, _ = IntervalSchedule.objects.get_or_create(
                every=1, period=IntervalSchedule.HOURS
            )
            every_day, _ = IntervalSchedule.objects.get_or_create(
                every=24, period=IntervalSchedule.HOURS
            )
            tasks = [
                ('Cancel expired ride requests', 'rides.expire_unassigned_rides', every_minute),
                ('Close expired scheduled rides', 'rides.auto_close_expired_scheduled_rides', every_minute),
                ('Cleanup abandoned gateway transactions', 'payments.cleanup_abandoned_gateway_transactions', every_hour),
                ('Cleanup expired OTPs', 'accounts.cleanup_expired_otps', every_day),
            ]
            for name, task, schedule in tasks:
                PeriodicTask.objects.update_or_create(
                    name=name,
                    defaults={'task': task, 'interval': schedule, 'enabled': True},
                )
        except Exception:
            pass

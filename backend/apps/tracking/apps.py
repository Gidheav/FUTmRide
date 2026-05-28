from django.apps import AppConfig


class TrackingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tracking'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(self._register_periodic_tasks, sender=self)

    def _register_periodic_tasks(self, **kwargs):
        try:
            from django_celery_beat.models import PeriodicTask, IntervalSchedule
            every_minute, _ = IntervalSchedule.objects.get_or_create(
                every=1, period=IntervalSchedule.MINUTES
            )
            tasks = [
                ('Dispatch incident scan', 'tracking.compute_dispatch_incidents', every_minute),
            ]
            for name, task, schedule in tasks:
                PeriodicTask.objects.get_or_create(
                    name=name,
                    defaults={'task': task, 'interval': schedule, 'enabled': True},
                )
        except Exception:
            pass

from django.apps import AppConfig


class ReportsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.reports'
    verbose_name = 'Financial Reports'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(self._register_periodic_tasks, sender=self)

    def _register_periodic_tasks(self, **kwargs):
        try:
            from django_celery_beat.models import PeriodicTask, IntervalSchedule
            every_15_min, _ = IntervalSchedule.objects.get_or_create(
                every=15, period=IntervalSchedule.MINUTES,
            )
            PeriodicTask.objects.get_or_create(
                name='Process due scheduled reports',
                defaults={
                    'task': 'reports.process_due_scheduled_reports',
                    'interval': every_15_min,
                    'enabled': True,
                },
            )
        except Exception:
            pass

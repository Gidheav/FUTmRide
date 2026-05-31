import logging

from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger('apps.reports')


@shared_task(bind=True, max_retries=2, name='reports.generate_report')
def generate_report_task(self, run_id: str):
    from apps.reports.models import ReportRun
    from apps.reports.services import execute_report_run

    try:
        run = ReportRun.objects.get(id=run_id)
    except ReportRun.DoesNotExist:
        logger.error('report_run_not_found id=%s', run_id)
        return

    try:
        execute_report_run(run)
        if run.scheduled_report_id and run.status == ReportRun.Status.SUCCESS:
            _email_scheduled_report(run)
    except Exception as exc:
        logger.exception('generate_report_task_failed id=%s', run_id)
        raise self.retry(exc=exc, countdown=30)


@shared_task(name='reports.process_due_scheduled_reports')
def process_due_scheduled_reports():
    from apps.reports.services import process_due_schedules
    process_due_schedules()


def _email_scheduled_report(run):
    schedule = run.scheduled_report
    if not schedule or not schedule.recipients:
        return
    recipients = [r for r in schedule.recipients if isinstance(r, str) and '@' in r]
    if not recipients:
        return
    try:
        send_mail(
            subject=f'LR-Ride Report: {run.report_title}',
            message=f'Your scheduled report "{run.report_title}" is ready.\nStatus: {run.status}\nRows: {run.row_count}',
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@lrride.app'),
            recipient_list=recipients,
            fail_silently=True,
        )
    except Exception:
        logger.exception('scheduled_report_email_failed run=%s', run.id)

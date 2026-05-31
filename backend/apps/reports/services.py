"""Report generation orchestration."""
from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone

from apps.accounts.audit import log_audit
from apps.reports.catalog import CATALOG_BY_KEY, PACKAGE_CONTENTS
from apps.reports.context import resolve_scope
from apps.reports.export import build_file_content, export_csv, export_zip, save_report_file
from apps.reports.models import ReportRun, ScheduledReport, StatementAccessRequest
from apps.reports.queries import run_query

logger = logging.getLogger('apps.reports')

VALID_FORMATS = frozenset({'csv', 'pdf', 'xlsx', 'zip'})


def _compute_next_run(schedule: ScheduledReport, from_dt=None):
    from_dt = from_dt or timezone.now()
    freq = schedule.frequency
    hour = schedule.hour
    minute = schedule.minute

    if freq == ScheduledReport.Frequency.DAILY:
        nxt = from_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if nxt <= from_dt:
            nxt += timedelta(days=1)
        return nxt

    if freq == ScheduledReport.Frequency.WEEKLY:
        nxt = from_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
        days_ahead = (schedule.day_of_week - nxt.weekday()) % 7
        if days_ahead == 0 and nxt <= from_dt:
            days_ahead = 7
        return nxt + timedelta(days=days_ahead)

    if freq == ScheduledReport.Frequency.MONTHLY:
        day = min(schedule.day_of_month, 28)
        nxt = from_dt.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)
        if nxt <= from_dt:
            month = nxt.month + 1
            year = nxt.year
            if month > 12:
                month = 1
                year += 1
            nxt = nxt.replace(year=year, month=month)
        return nxt

    # quarterly — first day of next quarter month
    q_month = ((from_dt.month - 1) // 3 + 1) * 3 + 1
    year = from_dt.year
    if q_month > 12:
        q_month = 1
        year += 1
    day = min(schedule.day_of_month, 28)
    nxt = from_dt.replace(year=year, month=q_month, day=day, hour=hour, minute=minute, second=0, microsecond=0)
    if nxt <= from_dt:
        q_month += 3
        if q_month > 12:
            q_month -= 12
            year += 1
        nxt = nxt.replace(year=year, month=q_month)
    return nxt


def create_report_run(
    user,
    report_key: str,
    fmt: str = 'csv',
    period: str = '30D',
    filters: dict | None = None,
    scheduled_report=None,
    async_run: bool = True,
    request=None,
) -> ReportRun:
    meta = CATALOG_BY_KEY.get(report_key)
    if not meta:
        raise ValueError(f'Unknown report: {report_key}')
    fmt = fmt.lower()
    if fmt not in meta.get('formats', ['csv']):
        raise ValueError(f'Format {fmt} not allowed for {report_key}')

    campus, _, _, period = resolve_scope(user, period)
    if meta.get('consent_required') and not (filters or {}).get('consent_id'):
        raise ValueError('Consent approval required for this report')

    run = ReportRun.objects.create(
        report_key=report_key,
        report_title=meta['title'],
        category=meta['category'],
        format=fmt,
        period=period,
        filters=filters or {},
        campus=campus,
        requested_by=user,
        scheduled_report=scheduled_report,
    )

    if async_run:
        from apps.reports.tasks import generate_report_task
        generate_report_task.delay(str(run.id))
    else:
        execute_report_run(run, request=request)

    return run


def execute_report_run(run: ReportRun, request=None):
    run.status = ReportRun.Status.RUNNING
    run.started_at = timezone.now()
    run.save(update_fields=['status', 'started_at'])

    try:
        campus = run.campus
        _, start, end, _ = resolve_scope(run.requested_by, run.period)
        filters = dict(run.filters or {})

        row_count = 0
        if run.report_key in PACKAGE_CONTENTS:
            content, _ = _generate_package(run.report_key, campus, start, end, filters)
            ext = 'zip'
            row_count = len(PACKAGE_CONTENTS.get(run.report_key, []))
        else:
            headers, rows, meta = run_query(run.report_key, campus, start, end, filters)
            content, _ = build_file_content(run.format, run.report_title, headers, rows, meta)
            ext = run.format if run.format != 'zip' else 'zip'
            row_count = len(rows)

        save_report_file(run, content, ext)
        run.row_count = row_count
        run.status = ReportRun.Status.SUCCESS
        run.completed_at = timezone.now()
        run.save(update_fields=['file', 'file_size', 'row_count', 'status', 'completed_at'])

        log_audit(
            request,
            'other',
            target_type='report_run',
            target_id=str(run.id),
            metadata={'report_key': run.report_key, 'format': run.format, 'rows': run.row_count},
            actor=run.requested_by,
        )
    except Exception as exc:
        logger.exception('report_run_failed id=%s', run.id)
        run.status = ReportRun.Status.FAILED
        run.error_message = str(exc)[:2000]
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'completed_at'])
        raise


def _generate_package(package_key: str, campus, start, end, filters: dict) -> tuple[bytes, str]:
    keys = PACKAGE_CONTENTS.get(package_key, [])
    files = []
    for key in keys:
        meta = CATALOG_BY_KEY.get(key, {})
        title = meta.get('title', key)
        headers, rows, _ = run_query(key, campus, start, end, filters)
        inner = export_csv(headers, rows)
        files.append((f'{key}.csv', inner))
    return export_zip(files), 'application/zip'


def process_due_schedules():
    now = timezone.now()
    due = ScheduledReport.objects.filter(is_active=True, next_run_at__lte=now)
    for schedule in due:
        try:
            run = create_report_run(
                user=schedule.created_by,
                report_key=schedule.report_key,
                fmt=schedule.format,
                period=schedule.period,
                filters=schedule.filters,
                scheduled_report=schedule,
                async_run=True,
            )
            schedule.last_run_at = now
            schedule.last_status = 'queued'
            schedule.next_run_at = _compute_next_run(schedule, now)
            schedule.save(update_fields=['last_run_at', 'last_status', 'next_run_at'])
            logger.info('scheduled_report_queued schedule=%s run=%s', schedule.id, run.id)
        except Exception as exc:
            schedule.last_status = 'failed'
            schedule.last_error = str(exc)[:500]
            schedule.next_run_at = _compute_next_run(schedule, now)
            schedule.save(update_fields=['last_status', 'last_error', 'next_run_at'])
            logger.exception('scheduled_report_failed schedule=%s', schedule.id)


def approve_statement_request(req: StatementAccessRequest, approver, notes: str = ''):
    req.status = StatementAccessRequest.Status.APPROVED
    req.approved_at = timezone.now()
    req.expires_at = timezone.now() + timedelta(days=30)
    if notes:
        req.notes = notes
    req.save(update_fields=['status', 'approved_at', 'expires_at', 'notes', 'updated_at'])


def deny_statement_request(req: StatementAccessRequest, notes: str = ''):
    req.status = StatementAccessRequest.Status.DENIED
    if notes:
        req.notes = notes
    req.save(update_fields=['status', 'notes', 'updated_at'])

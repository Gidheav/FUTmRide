"""Financial reports API — catalog, generation, schedules, consent."""
from __future__ import annotations

import mimetypes

from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.payments.admin_finance import _resolve_campus
from apps.reports.catalog import PACKAGE_CONTENTS, REPORT_CATALOG, REPORT_CATEGORIES
from apps.reports.models import ReportRun, ScheduledReport, StatementAccessRequest
from apps.reports.services import (
    approve_statement_request,
    create_report_run,
    deny_statement_request,
    _compute_next_run,
)


def _serialize_run(run: ReportRun) -> dict:
    return {
        'id': str(run.id),
        'report_key': run.report_key,
        'report_title': run.report_title,
        'category': run.category,
        'format': run.format,
        'period': run.period,
        'status': run.status,
        'row_count': run.row_count,
        'file_size': run.file_size,
        'error_message': run.error_message,
        'created_at': run.created_at.isoformat() if run.created_at else None,
        'completed_at': run.completed_at.isoformat() if run.completed_at else None,
        'has_file': bool(run.file),
    }


def _serialize_schedule(s: ScheduledReport) -> dict:
    return {
        'id': str(s.id),
        'name': s.name,
        'report_key': s.report_key,
        'format': s.format,
        'period': s.period,
        'frequency': s.frequency,
        'day_of_week': s.day_of_week,
        'day_of_month': s.day_of_month,
        'hour': s.hour,
        'minute': s.minute,
        'recipients': s.recipients or [],
        'is_active': s.is_active,
        'last_run_at': s.last_run_at.isoformat() if s.last_run_at else None,
        'next_run_at': s.next_run_at.isoformat() if s.next_run_at else None,
        'last_status': s.last_status,
        'last_error': s.last_error,
        'created_at': s.created_at.isoformat() if s.created_at else None,
    }


def _serialize_consent(req: StatementAccessRequest) -> dict:
    subject = req.subject
    name = getattr(subject, 'full_name', None) or getattr(subject, 'email', str(req.subject_id))
    return {
        'id': str(req.id),
        'subject_id': str(req.subject_id),
        'subject_name': name[:3] + '***' if name else '***',
        'scope': req.scope,
        'period_start': req.period_start.isoformat(),
        'period_end': req.period_end.isoformat(),
        'status': req.status,
        'consent_method': req.consent_method,
        'approved_at': req.approved_at.isoformat() if req.approved_at else None,
        'expires_at': req.expires_at.isoformat() if req.expires_at else None,
        'download_count': req.download_count,
        'notes': req.notes,
        'created_at': req.created_at.isoformat(),
        'ride_id': str(req.ride_id) if req.ride_id else None,
    }


class ReportCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        packages = {k: v for k, v in PACKAGE_CONTENTS.items()}
        return Response({
            'categories': REPORT_CATEGORIES,
            'reports': REPORT_CATALOG,
            'packages': packages,
        })


class ReportGenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request):
        data = request.data or {}
        report_key = data.get('report_key', '').strip()
        fmt = (data.get('format') or 'csv').lower()
        period = data.get('period') or '30D'
        filters = data.get('filters') or {}
        async_run = data.get('async', True)

        if not report_key:
            return Response({'detail': 'report_key required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            run = create_report_run(
                user=request.user,
                report_key=report_key,
                fmt=fmt,
                period=period,
                filters=filters,
                async_run=async_run,
                request=request,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(_serialize_run(run), status=status.HTTP_202_ACCEPTED if async_run else status.HTTP_201_CREATED)


class ReportRunListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        campus = _resolve_campus(request.user)
        qs = ReportRun.objects.all()
        if campus:
            qs = qs.filter(campus=campus)
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        limit = min(int(request.query_params.get('limit', 50)), 200)
        runs = qs.order_by('-created_at')[:limit]
        return Response({'results': [_serialize_run(r) for r in runs]})


class ReportRunDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request, run_id):
        campus = _resolve_campus(request.user)
        try:
            run = ReportRun.objects.get(id=run_id)
        except ReportRun.DoesNotExist:
            raise Http404
        if campus and run.campus_id and run.campus_id != campus.id:
            raise Http404
        return Response(_serialize_run(run))


class ReportRunDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request, run_id):
        campus = _resolve_campus(request.user)
        try:
            run = ReportRun.objects.get(id=run_id)
        except ReportRun.DoesNotExist:
            raise Http404
        if campus and run.campus_id and run.campus_id != campus.id:
            raise Http404
        if run.status != ReportRun.Status.SUCCESS or not run.file:
            return Response({'detail': 'Report not ready'}, status=status.HTTP_404_NOT_FOUND)

        content_type, _ = mimetypes.guess_type(run.file.name)
        return FileResponse(run.file.open('rb'), as_attachment=True, filename=run.file.name.split('/')[-1], content_type=content_type or 'application/octet-stream')


class ScheduledReportListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        campus = _resolve_campus(request.user)
        qs = ScheduledReport.objects.all()
        if campus:
            qs = qs.filter(campus=campus)
        return Response({'results': [_serialize_schedule(s) for s in qs.order_by('-created_at')]})

    def post(self, request):
        data = request.data or {}
        name = (data.get('name') or '').strip()
        report_key = (data.get('report_key') or '').strip()
        if not name or not report_key:
            return Response({'detail': 'name and report_key required'}, status=status.HTTP_400_BAD_REQUEST)

        campus = _resolve_campus(request.user)
        schedule = ScheduledReport.objects.create(
            name=name,
            report_key=report_key,
            format=data.get('format') or 'csv',
            period=data.get('period') or '30D',
            filters=data.get('filters') or {},
            frequency=data.get('frequency') or ScheduledReport.Frequency.WEEKLY,
            day_of_week=int(data.get('day_of_week', 0)),
            day_of_month=int(data.get('day_of_month', 1)),
            hour=int(data.get('hour', 8)),
            minute=int(data.get('minute', 0)),
            recipients=data.get('recipients') or [],
            is_active=data.get('is_active', True),
            campus=campus,
            created_by=request.user,
        )
        schedule.next_run_at = _compute_next_run(schedule)
        schedule.save(update_fields=['next_run_at'])
        return Response(_serialize_schedule(schedule), status=status.HTTP_201_CREATED)


class ScheduledReportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def patch(self, request, schedule_id):
        campus = _resolve_campus(request.user)
        try:
            schedule = ScheduledReport.objects.get(id=schedule_id)
        except ScheduledReport.DoesNotExist:
            raise Http404
        if campus and schedule.campus_id and schedule.campus_id != campus.id:
            raise Http404

        data = request.data or {}
        for field in ('name', 'format', 'period', 'frequency', 'is_active', 'filters', 'recipients'):
            if field in data:
                setattr(schedule, field, data[field])
        for field in ('day_of_week', 'day_of_month', 'hour', 'minute'):
            if field in data:
                setattr(schedule, field, int(data[field]))
        if 'report_key' in data:
            schedule.report_key = data['report_key']
        schedule.save()
        if any(k in data for k in ('frequency', 'day_of_week', 'day_of_month', 'hour', 'minute', 'is_active')):
            schedule.next_run_at = _compute_next_run(schedule)
            schedule.save(update_fields=['next_run_at'])
        return Response(_serialize_schedule(schedule))

    def delete(self, request, schedule_id):
        campus = _resolve_campus(request.user)
        try:
            schedule = ScheduledReport.objects.get(id=schedule_id)
        except ScheduledReport.DoesNotExist:
            raise Http404
        if campus and schedule.campus_id and schedule.campus_id != campus.id:
            raise Http404
        schedule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StatementAccessListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        campus = _resolve_campus(request.user)
        qs = StatementAccessRequest.objects.select_related('subject')
        if campus:
            qs = qs.filter(campus=campus)
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response({'results': [_serialize_consent(r) for r in qs.order_by('-created_at')[:100]]})

    def post(self, request):
        data = request.data or {}
        subject_id = data.get('subject_id')
        if not subject_id:
            return Response({'detail': 'subject_id required'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.accounts.models import User
        try:
            subject = User.objects.get(id=subject_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        campus = _resolve_campus(request.user)
        req = StatementAccessRequest.objects.create(
            subject=subject,
            requested_by=request.user,
            campus=campus,
            scope=data.get('scope') or StatementAccessRequest.Scope.DRIVER_EARNINGS,
            period_start=data.get('period_start') or timezone.now(),
            period_end=data.get('period_end') or timezone.now(),
            ride_id=data.get('ride_id'),
            consent_method=data.get('consent_method') or StatementAccessRequest.ConsentMethod.ADMIN_REQUEST,
            notes=data.get('notes') or '',
        )
        return Response(_serialize_consent(req), status=status.HTTP_201_CREATED)


class StatementAccessActionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, request_id, action):
        campus = _resolve_campus(request.user)
        try:
            req = StatementAccessRequest.objects.get(id=request_id)
        except StatementAccessRequest.DoesNotExist:
            raise Http404
        if campus and req.campus_id and req.campus_id != campus.id:
            raise Http404

        notes = (request.data or {}).get('notes', '')
        if action == 'approve':
            approve_statement_request(req, request.user, notes)
        elif action == 'deny':
            deny_statement_request(req, notes)
        else:
            return Response({'detail': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_serialize_consent(req))


class StatementAccessGenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, request_id):
        campus = _resolve_campus(request.user)
        try:
            req = StatementAccessRequest.objects.get(id=request_id)
        except StatementAccessRequest.DoesNotExist:
            raise Http404
        if campus and req.campus_id and req.campus_id != campus.id:
            raise Http404
        if req.status != StatementAccessRequest.Status.APPROVED:
            return Response({'detail': 'Consent not approved'}, status=status.HTTP_400_BAD_REQUEST)
        if req.expires_at and req.expires_at < timezone.now():
            return Response({'detail': 'Consent expired'}, status=status.HTTP_400_BAD_REQUEST)

        scope_map = {
            StatementAccessRequest.Scope.DRIVER_EARNINGS: 'driver_earnings_statement',
            StatementAccessRequest.Scope.STUDENT_WALLET: 'student_wallet_statement',
            StatementAccessRequest.Scope.SINGLE_RIDE: 'single_ride_receipt',
        }
        report_key = scope_map.get(req.scope, 'driver_earnings_statement')
        fmt = (request.data or {}).get('format') or 'pdf'
        filters = {'consent_id': str(req.id)}
        if req.ride_id:
            filters['ride_id'] = str(req.ride_id)

        run = create_report_run(
            user=request.user,
            report_key=report_key,
            fmt=fmt,
            period='ALL',
            filters=filters,
            async_run=False,
            request=request,
        )
        req.download_count += 1
        req.last_downloaded_at = timezone.now()
        req.last_downloaded_by = request.user
        req.save(update_fields=['download_count', 'last_downloaded_at', 'last_downloaded_by'])
        return Response(_serialize_run(run), status=status.HTTP_201_CREATED)

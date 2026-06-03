"""Campus admin driver payouts — aggregate oversight, privacy-safe."""
from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.payments.admin_finance import (
    VALID_PERIODS,
    _mask_reference,
    _period_bounds,
    _resolve_campus,
    _to_kobo,
    _withdrawal_qs,
)
from apps.payments.models import DriverWithdrawal

STATUS_LABELS = {
    DriverWithdrawal.Status.PENDING: 'Pending',
    DriverWithdrawal.Status.PROCESSING: 'Processing',
    DriverWithdrawal.Status.COMPLETED: 'Completed',
    DriverWithdrawal.Status.FAILED: 'Failed',
    DriverWithdrawal.Status.CANCELLED: 'Cancelled',
}


def _driver_hint(user_id) -> str:
    uid = str(user_id).replace('-', '')
    return f'Driver ···{uid[-4:]}'


def _serialize_payout(wdr: DriverWithdrawal) -> dict:
    sla_hours = None
    if wdr.processed_at and wdr.requested_at:
        sla_hours = round((wdr.processed_at - wdr.requested_at).total_seconds() / 3600, 1)
    needs_action = wdr.status in (
        DriverWithdrawal.Status.PENDING,
        DriverWithdrawal.Status.PROCESSING,
        DriverWithdrawal.Status.FAILED,
    )
    return {
        'id': str(wdr.id),
        'reference_masked': _mask_reference(wdr.reference),
        'amount_kobo': _to_kobo(wdr.amount),
        'fee_kobo': _to_kobo(wdr.fee),
        'status': wdr.status,
        'status_label': STATUS_LABELS.get(wdr.status, wdr.status),
        'bank_name': wdr.bank_name or 'Unknown',
        'account_last4': wdr.account_number_last4 or '****',
        'driver_hint': _driver_hint(wdr.user_id),
        'requested_at': wdr.requested_at.isoformat() if wdr.requested_at else None,
        'processed_at': wdr.processed_at.isoformat() if wdr.processed_at else None,
        'sla_hours': sla_hours,
        'needs_action': needs_action,
    }


def _compute_payout_kpis(campus, start, end, prev_start, prev_end):
    qs = _withdrawal_qs(campus, start, end)
    prev_qs = _withdrawal_qs(campus, prev_start, prev_end)

    completed = qs.filter(status=DriverWithdrawal.Status.COMPLETED)
    prev_completed = prev_qs.filter(status=DriverWithdrawal.Status.COMPLETED)

    total_paid = completed.aggregate(t=Sum('amount'))['t'] or Decimal('0')
    prev_paid = prev_completed.aggregate(t=Sum('amount'))['t'] or Decimal('0')
    prev_paid_kobo = _to_kobo(prev_paid)
    total_kobo = _to_kobo(total_paid)
    delta_pct = round((total_kobo - prev_paid_kobo) / prev_paid_kobo * 100, 1) if prev_paid_kobo else 0

    fees = qs.aggregate(t=Sum('fee'))['t'] or Decimal('0')
    pending = qs.filter(status__in=[DriverWithdrawal.Status.PENDING, DriverWithdrawal.Status.PROCESSING]).count()
    failed = qs.filter(status__in=[DriverWithdrawal.Status.FAILED, DriverWithdrawal.Status.CANCELLED]).count()

    sla_avg = None
    sla_qs = completed.filter(processed_at__isnull=False)
    if sla_qs.exists():
        # Approximate via DB if possible — fallback in Python for sqlite
        total_hrs = 0.0
        n = 0
        for w in sla_qs[:500]:
            if w.processed_at and w.requested_at:
                total_hrs += (w.processed_at - w.requested_at).total_seconds() / 3600
                n += 1
        if n:
            sla_avg = round(total_hrs / n, 1)

    return {
        'total_paid_kobo': total_kobo,
        'completed_count': completed.count(),
        'pending_count': pending,
        'failed_count': failed,
        'total_fees_kobo': _to_kobo(fees),
        'avg_sla_hours': sla_avg,
        'prev_total_paid_kobo': prev_paid_kobo,
        'delta_pct': delta_pct,
    }


class FinancePayoutsView(APIView):
    """GET driver payout queue and aggregates for campus admin."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        period = request.query_params.get('period', '30D')
        if period not in VALID_PERIODS:
            period = '30D'
        status_filter = request.query_params.get('status', 'ALL').upper()
        needs_action_only = request.query_params.get('needs_action', '').lower() in ('1', 'true', 'yes')
        search = (request.query_params.get('search') or '').strip().lower()
        page = max(int(request.query_params.get('page', 1)), 1)
        page_size = min(max(int(request.query_params.get('page_size', 50)), 1), 100)

        campus = _resolve_campus(request.user)
        start, end, prev_start, prev_end = _period_bounds(period)

        qs = _withdrawal_qs(campus, start, end).select_related('user').order_by('-requested_at')

        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter.lower())
        if needs_action_only:
            qs = qs.filter(status__in=[
                DriverWithdrawal.Status.PENDING,
                DriverWithdrawal.Status.PROCESSING,
                DriverWithdrawal.Status.FAILED,
            ])

        if search:
            qs = qs.filter(Q(reference__icontains=search) | Q(bank_name__icontains=search))

        count = qs.count()
        total_pages = max((count + page_size - 1) // page_size, 1)
        offset = (page - 1) * page_size
        page_qs = qs[offset:offset + page_size]

        by_bank = list(
            _withdrawal_qs(campus, start, end)
            .filter(status=DriverWithdrawal.Status.COMPLETED)
            .values('bank_name')
            .annotate(count=Count('id'), total=Sum('amount'))
            .order_by('-total')[:8]
        )
        by_bank_payload = [
            {
                'bank_name': row['bank_name'] or 'Unknown',
                'count': row['count'],
                'total_kobo': _to_kobo(row['total']),
            }
            for row in by_bank
        ]

        return Response({
            'period': period,
            'campus_scoped': campus is not None,
            'kpis': _compute_payout_kpis(campus, start, end, prev_start, prev_end),
            'by_bank': by_bank_payload,
            'count': count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'results': [_serialize_payout(w) for w in page_qs],
        })


class FinancePayoutsExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        import csv
        import io

        period = request.query_params.get('period', '30D')
        if period not in VALID_PERIODS:
            period = '30D'
        campus = _resolve_campus(request.user)
        start, end, _, _ = _period_bounds(period)
        qs = _withdrawal_qs(campus, start, end).order_by('-requested_at')[:5000]

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            'Reference', 'Status', 'Amount (NGN)', 'Fee (NGN)', 'Bank',
            'Account Last4', 'Driver Hint', 'Requested', 'Processed', 'SLA Hours',
        ])
        for w in qs:
            row = _serialize_payout(w)
            writer.writerow([
                row['reference_masked'],
                row['status_label'],
                f'{row["amount_kobo"] / 100:.2f}',
                f'{row["fee_kobo"] / 100:.2f}',
                row['bank_name'],
                row['account_last4'],
                row['driver_hint'],
                row['requested_at'],
                row['processed_at'] or '',
                row['sla_hours'] or '',
            ])

        resp = HttpResponse(buf.getvalue(), content_type='text/csv; charset=utf-8-sig')
        resp['Content-Disposition'] = f'attachment; filename="lr_ride_payouts_{period.lower()}.csv"'
        return resp

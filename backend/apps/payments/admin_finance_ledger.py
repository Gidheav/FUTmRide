"""
Platform ledger API — privacy-safe unified event stream for campus admin finance.
Merges ride settlements, gateway top-ups, driver withdrawals, refunds, and disputes.
"""
from __future__ import annotations

import csv
import io
import logging

from django.http import HttpResponse
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserRole
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.payments.models import DriverWithdrawal, GatewayTransaction, WalletTransaction
from apps.rides.models import Ride, RideStatus

from .admin_finance import (
    VALID_PERIODS,
    _mask_reference,
    _period_bounds,
    _resolve_campus,
    _route_hint,
    _to_kobo,
)

logger = logging.getLogger('apps.payments')

LEDGER_EVENT_TYPES = frozenset({
    'ride_settlement',
    'gateway_topup',
    'gateway_failure',
    'driver_withdrawal',
    'ride_refund',
    'dispute_case',
})

SOURCE_FILTERS = frozenset({'ALL', 'RIDE', 'GATEWAY', 'WITHDRAWAL', 'REFUND', 'DISPUTE'})
STATUS_FILTERS = frozenset({'ALL', 'SUCCESS', 'FAILED', 'PENDING', 'PROCESSING', 'DISPUTED', 'NEEDS_ACTION'})

EVENT_LABELS = {
    'ride_settlement': 'Ride Settlement',
    'gateway_topup': 'Wallet Top-up',
    'gateway_failure': 'Top-up Failed',
    'driver_withdrawal': 'Driver Withdrawal',
    'ride_refund': 'Ride Refund',
    'dispute_case': 'Dispute Case',
}

EVENT_ICONS = {
    'ride_settlement': 'local_taxi',
    'gateway_topup': 'account_balance_wallet',
    'gateway_failure': 'error_outline',
    'driver_withdrawal': 'send',
    'ride_refund': 'undo',
    'dispute_case': 'gavel',
}


def _gw_ui_status(gateway_status: str) -> str:
    if gateway_status == GatewayTransaction.GatewayStatus.SUCCESS:
        return 'SUCCESS'
    if gateway_status in (
        GatewayTransaction.GatewayStatus.FAILED,
        GatewayTransaction.GatewayStatus.ABANDONED,
        GatewayTransaction.GatewayStatus.REVERSED,
    ):
        return 'FAILED'
    if gateway_status == GatewayTransaction.GatewayStatus.PENDING:
        return 'PROCESSING'
    return 'PENDING'


def _wdr_ui_status(status: str) -> str:
    mapping = {
        DriverWithdrawal.Status.COMPLETED: 'SUCCESS',
        DriverWithdrawal.Status.FAILED: 'FAILED',
        DriverWithdrawal.Status.CANCELLED: 'FAILED',
        DriverWithdrawal.Status.PROCESSING: 'PROCESSING',
    }
    return mapping.get(status, 'PENDING')


def _ride_in_campus(ride, campus) -> bool:
    if campus is None:
        return True
    try:
        return ride.student.student_profile.campus_id == campus.id
    except Exception:
        return False


def _dispute_block(ride, include_full_ref: bool = False):
    existing_refund = WalletTransaction.objects.filter(
        ride=ride,
        source=WalletTransaction.Source.RIDE_REFUND,
        transaction_type=WalletTransaction.TransactionType.CREDIT,
    ).exists()
    can_refund = (
        ride.status == RideStatus.DISPUTED
        and ride.payment_method == 'wallet'
        and ride.is_paid
        and not existing_refund
    )
    return {
        'ride_id': str(ride.id),
        'ride_reference': ride.reference if include_full_ref else _mask_reference(ride.reference),
        'dispute_opened_at': (ride.updated_at or ride.requested_at).isoformat(),
        'can_refund': can_refund,
        'can_resolve': ride.status == RideStatus.DISPUTED,
        'party_hint': 'student',
        'fare_kobo': _to_kobo(ride.total_fare or 0),
        'commission_kobo': _to_kobo(ride.platform_commission or 0),
        'driver_earnings_kobo': _to_kobo(ride.driver_earnings or 0),
    }


def _serialize_ride_settlement(ride, include_full_ref: bool = False):
    completed_at = ride.trip_completed_at
    return {
        'id': f'ride:{ride.id}',
        'event_type': 'ride_settlement',
        'event_label': EVENT_LABELS['ride_settlement'],
        'event_icon': EVENT_ICONS['ride_settlement'],
        'reference_masked': _mask_reference(ride.reference),
        'reference_full': ride.reference if include_full_ref else None,
        'amount_kobo': _to_kobo(ride.platform_commission or 0),
        'status': 'SUCCESS',
        'source_label': 'Ride Payment',
        'source_key': 'RIDE',
        'channel': ride.payment_method or 'wallet',
        'created_at': (completed_at or ride.requested_at).isoformat(),
        'completed_at': completed_at.isoformat() if completed_at else None,
        'needs_action': False,
        'context': {
            'vehicle_type': ride.vehicle_type_requested,
            'route_hint': _route_hint(ride.pickup_address, ride.dropoff_address),
            'ride_id': str(ride.id),
            'fare_kobo': _to_kobo(ride.total_fare or 0),
            'commission_kobo': _to_kobo(ride.platform_commission or 0),
        },
        'dispute': None,
        'timeline': [
            {'label': 'Ride requested', 'time': ride.requested_at.isoformat() if ride.requested_at else None, 'done': True},
            {'label': 'Trip completed', 'time': completed_at.isoformat() if completed_at else None, 'done': bool(completed_at)},
            {'label': 'Commission recorded', 'time': completed_at.isoformat() if completed_at else None, 'done': bool(completed_at)},
        ],
    }


def _serialize_dispute(ride, include_full_ref: bool = False):
    return {
        'id': f'dispute:{ride.id}',
        'event_type': 'dispute_case',
        'event_label': EVENT_LABELS['dispute_case'],
        'event_icon': EVENT_ICONS['dispute_case'],
        'reference_masked': _mask_reference(ride.reference),
        'reference_full': ride.reference if include_full_ref else None,
        'amount_kobo': _to_kobo(ride.platform_commission or ride.total_fare or 0),
        'status': 'DISPUTED',
        'source_label': 'Dispute',
        'source_key': 'DISPUTE',
        'channel': ride.payment_method or 'wallet',
        'created_at': (ride.updated_at or ride.requested_at).isoformat(),
        'completed_at': None,
        'needs_action': True,
        'context': {
            'vehicle_type': ride.vehicle_type_requested,
            'route_hint': _route_hint(ride.pickup_address, ride.dropoff_address),
            'ride_id': str(ride.id),
            'fare_kobo': _to_kobo(ride.total_fare or 0),
            'commission_kobo': _to_kobo(ride.platform_commission or 0),
        },
        'dispute': _dispute_block(ride, include_full_ref=include_full_ref),
        'timeline': [
            {'label': 'Ride completed', 'time': ride.trip_completed_at.isoformat() if ride.trip_completed_at else None, 'done': True},
            {'label': 'Dispute opened', 'time': ride.updated_at.isoformat() if ride.updated_at else None, 'done': True},
            {'label': 'Awaiting resolution', 'time': None, 'done': False},
        ],
    }


def _serialize_gateway(gw, include_full_ref: bool = False):
    ui_status = _gw_ui_status(gw.gateway_status)
    is_success = ui_status == 'SUCCESS'
    event_type = 'gateway_topup' if is_success else 'gateway_failure'
    return {
        'id': f'gateway:{gw.id}',
        'event_type': event_type,
        'event_label': EVENT_LABELS[event_type],
        'event_icon': EVENT_ICONS[event_type],
        'reference_masked': _mask_reference(gw.internal_reference),
        'reference_full': gw.internal_reference if include_full_ref else None,
        'amount_kobo': _to_kobo(gw.amount),
        'status': ui_status,
        'source_label': f'{gw.gateway.title()} Top-up',
        'source_key': 'GATEWAY',
        'channel': gw.channel or gw.gateway,
        'created_at': gw.created_at.isoformat(),
        'completed_at': gw.webhook_received_at.isoformat() if gw.webhook_received_at else None,
        'needs_action': ui_status in ('FAILED', 'PENDING', 'PROCESSING'),
        'context': {
            'gateway': gw.gateway,
            'wallet_credited': gw.wallet_credited,
        },
        'dispute': None,
        'timeline': [
            {'label': 'Initiated', 'time': gw.created_at.isoformat(), 'done': True},
            {'label': 'Processing', 'time': None, 'done': ui_status != 'PENDING'},
            {'label': 'Confirmed' if is_success else 'Failed', 'time': gw.webhook_received_at.isoformat() if gw.webhook_received_at else None, 'done': ui_status in ('SUCCESS', 'FAILED')},
        ],
    }


def _serialize_withdrawal(wdr, include_full_ref: bool = False):
    ui_status = _wdr_ui_status(wdr.status)
    return {
        'id': f'withdrawal:{wdr.id}',
        'event_type': 'driver_withdrawal',
        'event_label': EVENT_LABELS['driver_withdrawal'],
        'event_icon': EVENT_ICONS['driver_withdrawal'],
        'reference_masked': _mask_reference(wdr.reference),
        'reference_full': wdr.reference if include_full_ref else None,
        'amount_kobo': _to_kobo(wdr.amount),
        'status': ui_status,
        'source_label': 'Driver Withdrawal',
        'source_key': 'WITHDRAWAL',
        'channel': 'bank',
        'created_at': wdr.requested_at.isoformat(),
        'completed_at': wdr.processed_at.isoformat() if wdr.processed_at else None,
        'needs_action': ui_status in ('FAILED', 'PENDING', 'PROCESSING'),
        'context': {
            'bank_name': wdr.bank_name or 'Bank',
            'account_last4': wdr.account_number_last4 or '',
            'fee_kobo': _to_kobo(wdr.fee or 0),
        },
        'dispute': None,
        'timeline': [
            {'label': 'Requested', 'time': wdr.requested_at.isoformat(), 'done': True},
            {'label': 'Processing', 'time': None, 'done': wdr.status != DriverWithdrawal.Status.PENDING},
            {'label': 'Completed' if ui_status == 'SUCCESS' else 'Outcome', 'time': wdr.processed_at.isoformat() if wdr.processed_at else None, 'done': ui_status in ('SUCCESS', 'FAILED')},
        ],
    }


def _serialize_refund(tx, include_full_ref: bool = False):
    ride = tx.ride
    ref = ride.reference if ride else tx.reference
    return {
        'id': f'refund:{tx.id}',
        'event_type': 'ride_refund',
        'event_label': EVENT_LABELS['ride_refund'],
        'event_icon': EVENT_ICONS['ride_refund'],
        'reference_masked': _mask_reference(ref),
        'reference_full': ref if include_full_ref else None,
        'amount_kobo': _to_kobo(tx.amount),
        'status': 'SUCCESS',
        'source_label': 'Ride Refund',
        'source_key': 'REFUND',
        'channel': 'wallet',
        'created_at': tx.created_at.isoformat(),
        'completed_at': tx.created_at.isoformat(),
        'needs_action': False,
        'context': {
            'ride_id': str(ride.id) if ride else '',
            'route_hint': _route_hint(ride.pickup_address, ride.dropoff_address) if ride else tx.narration,
            'narration': tx.narration,
        },
        'dispute': None,
        'timeline': [
            {'label': 'Refund initiated', 'time': tx.created_at.isoformat(), 'done': True},
            {'label': 'Wallet credited', 'time': tx.created_at.isoformat(), 'done': True},
        ],
    }


def _collect_ledger_events(campus, start, end):
    events = []

    completed = Ride.objects.filter(
        status=RideStatus.COMPLETED,
        trip_completed_at__gte=start,
        trip_completed_at__lt=end,
    ).select_related('student__student_profile')
    if campus is not None:
        completed = completed.filter(student__student_profile__campus=campus)
    for ride in completed:
        events.append(_serialize_ride_settlement(ride))

    disputed = Ride.objects.filter(status=RideStatus.DISPUTED).select_related('student__student_profile')
    if campus is not None:
        disputed = disputed.filter(student__student_profile__campus=campus)
    disputed = disputed.filter(updated_at__gte=start, updated_at__lt=end)
    for ride in disputed:
        events.append(_serialize_dispute(ride))

    gw_qs = GatewayTransaction.objects.filter(created_at__gte=start, created_at__lt=end)
    if campus is not None:
        gw_qs = gw_qs.filter(user__student_profile__campus=campus)
    for gw in gw_qs:
        events.append(_serialize_gateway(gw))

    wdr_qs = DriverWithdrawal.objects.filter(requested_at__gte=start, requested_at__lt=end)
    if campus is not None:
        wdr_qs = wdr_qs.filter(user__driver_profile__campus=campus)
    for wdr in wdr_qs:
        events.append(_serialize_withdrawal(wdr))

    refund_qs = WalletTransaction.objects.filter(
        source=WalletTransaction.Source.RIDE_REFUND,
        created_at__gte=start,
        created_at__lt=end,
    ).select_related('ride')
    if campus is not None:
        refund_qs = refund_qs.filter(
            ride__student__student_profile__campus=campus,
        )
    for tx in refund_qs:
        events.append(_serialize_refund(tx))

    return events


def _apply_filters(events, *, status, source, search, needs_action_only):
    if status == 'NEEDS_ACTION':
        events = [e for e in events if e.get('needs_action')]
    elif status != 'ALL':
        events = [e for e in events if e['status'] == status]

    if needs_action_only:
        events = [e for e in events if e.get('needs_action')]

    if source != 'ALL':
        events = [e for e in events if e['source_key'] == source]

    if search:
        q = search.lower().strip()
        events = [
            e for e in events
            if q in (e.get('reference_masked') or '').lower()
            or q in (e.get('reference_full') or '').lower()
            or q in (e.get('source_label') or '').lower()
            or q in (e.get('context', {}).get('route_hint') or '').lower()
            or q in (e.get('event_label') or '').lower()
        ]

    return events


def _sort_events(events, ordering: str):
    reverse = not ordering.startswith('-')
    key_name = ordering.lstrip('-')
    if key_name == 'amount':
        events.sort(key=lambda e: e['amount_kobo'], reverse=reverse)
    elif key_name == 'status':
        events.sort(key=lambda e: e['status'], reverse=reverse)
    elif key_name == 'event_type':
        events.sort(key=lambda e: e['event_type'], reverse=reverse)
    else:
        events.sort(key=lambda e: e['created_at'] or '', reverse=reverse)
    return events


def _parse_ledger_id(raw_id: str):
    if ':' not in raw_id:
        return None, None
    prefix, pk = raw_id.split(':', 1)
    return prefix, pk


def _get_event_detail(event_id: str, campus, include_full_ref: bool = False):
    prefix, pk = _parse_ledger_id(event_id)
    if not prefix or not pk:
        return None

    if prefix == 'ride':
        try:
            ride = Ride.objects.select_related('student__student_profile').get(pk=pk)
        except Ride.DoesNotExist:
            return None
        if not _ride_in_campus(ride, campus):
            return None
        return _serialize_ride_settlement(ride, include_full_ref=include_full_ref)

    if prefix == 'dispute':
        try:
            ride = Ride.objects.select_related('student__student_profile').get(pk=pk, status=RideStatus.DISPUTED)
        except Ride.DoesNotExist:
            return None
        if not _ride_in_campus(ride, campus):
            return None
        return _serialize_dispute(ride, include_full_ref=True)

    if prefix == 'gateway':
        try:
            gw = GatewayTransaction.objects.get(pk=pk)
        except GatewayTransaction.DoesNotExist:
            return None
        if campus is not None:
            try:
                if gw.user.student_profile.campus_id != campus.id:
                    return None
            except Exception:
                return None
        return _serialize_gateway(gw, include_full_ref=include_full_ref)

    if prefix == 'withdrawal':
        try:
            wdr = DriverWithdrawal.objects.select_related('user__driver_profile').get(pk=pk)
        except DriverWithdrawal.DoesNotExist:
            return None
        if campus is not None:
            try:
                if wdr.user.driver_profile.campus_id != campus.id:
                    return None
            except Exception:
                return None
        return _serialize_withdrawal(wdr, include_full_ref=include_full_ref)

    if prefix == 'refund':
        try:
            tx = WalletTransaction.objects.select_related('ride').get(pk=pk, source=WalletTransaction.Source.RIDE_REFUND)
        except WalletTransaction.DoesNotExist:
            return None
        if campus is not None and tx.ride:
            if not _ride_in_campus(tx.ride, campus):
                return None
        return _serialize_refund(tx, include_full_ref=include_full_ref)

    return None


class FinanceLedgerListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        period = (request.query_params.get('period') or '30D').upper()
        if period not in VALID_PERIODS:
            period = '30D'

        campus = _resolve_campus(request.user)
        if request.user.role == UserRole.CAMPUS_ADMIN and campus is None:
            return Response(
                {'error': {'code': 'NO_CAMPUS', 'message': 'Campus admin profile not found.'}},
                status=403,
            )

        status_f = (request.query_params.get('status') or 'ALL').upper()
        if status_f not in STATUS_FILTERS:
            status_f = 'ALL'

        source_f = (request.query_params.get('source') or 'ALL').upper()
        if source_f not in SOURCE_FILTERS:
            source_f = 'ALL'

        search = (request.query_params.get('search') or '').strip()
        needs_action = request.query_params.get('needs_action', '').lower() in ('1', 'true', 'yes')
        ordering = request.query_params.get('ordering') or '-created_at'

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(100, max(1, int(request.query_params.get('page_size', 25))))
        except (TypeError, ValueError):
            page_size = 25

        start, end, _, _ = _period_bounds(period)
        events = _collect_ledger_events(campus, start, end)
        events = _apply_filters(
            events,
            status=status_f,
            source=source_f,
            search=search,
            needs_action_only=needs_action,
        )
        events = _sort_events(events, ordering)

        total = len(events)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_results = events[start_idx:end_idx]

        return Response({
            'period': period,
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': max(1, (total + page_size - 1) // page_size),
            'results': page_results,
        })


class FinanceLedgerDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request, event_id):
        campus = _resolve_campus(request.user)
        if request.user.role == UserRole.CAMPUS_ADMIN and campus is None:
            return Response(
                {'error': {'code': 'NO_CAMPUS', 'message': 'Campus admin profile not found.'}},
                status=403,
            )

        prefix, _ = _parse_ledger_id(event_id)
        include_full_ref = prefix == 'dispute'
        detail = _get_event_detail(event_id, campus, include_full_ref=include_full_ref)
        if detail is None:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Ledger event not found.'}},
                status=404,
            )
        return Response(detail)


class FinanceLedgerExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        period = (request.query_params.get('period') or '30D').upper()
        if period not in VALID_PERIODS:
            period = '30D'

        campus = _resolve_campus(request.user)
        if request.user.role == UserRole.CAMPUS_ADMIN and campus is None:
            return Response(
                {'error': {'code': 'NO_CAMPUS', 'message': 'Campus admin profile not found.'}},
                status=403,
            )

        status_f = (request.query_params.get('status') or 'ALL').upper()
        source_f = (request.query_params.get('source') or 'ALL').upper()
        search = (request.query_params.get('search') or '').strip()
        needs_action = request.query_params.get('needs_action', '').lower() in ('1', 'true', 'yes')

        start, end, _, _ = _period_bounds(period)
        events = _collect_ledger_events(campus, start, end)
        events = _apply_filters(
            events,
            status=status_f if status_f in STATUS_FILTERS else 'ALL',
            source=source_f if source_f in SOURCE_FILTERS else 'ALL',
            search=search,
            needs_action_only=needs_action,
        )
        events = _sort_events(events, '-created_at')

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            'Event Type', 'Reference (masked)', 'Amount (NGN)', 'Status',
            'Source', 'Channel', 'Context', 'Created', 'Completed',
        ])
        for e in events:
            ctx = e.get('context') or {}
            context_str = ctx.get('route_hint') or ctx.get('gateway') or ctx.get('bank_name') or ''
            writer.writerow([
                e.get('event_label', ''),
                e.get('reference_masked', ''),
                f"{(e.get('amount_kobo') or 0) / 100:.2f}",
                e.get('status', ''),
                e.get('source_label', ''),
                e.get('channel', ''),
                context_str,
                e.get('created_at', ''),
                e.get('completed_at') or '',
            ])

        response = HttpResponse(buffer.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="lr_ride_ledger_{period.lower()}.csv"'
        return response

"""
Campus admin finance overview — aggregated, privacy-safe metrics.
No student/driver PII; banking-style platform treasury view.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CampusAdminProfile, UserRole
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.payments.models import DriverWithdrawal, GatewayTransaction, WalletTransaction
from apps.rides.models import Ride, RideStatus

logger = logging.getLogger('apps.payments')

VALID_PERIODS = frozenset({'1D', '7D', '30D', '90D', 'YTD', '1Y', 'ALL'})

SOURCE_BREAKDOWN = [
    ('Ride Payments', '#10b981'),
    ('Wallet Top-ups', '#3b82f6'),
    ('Platform Commission', '#8b5cf6'),
    ('Refunds', '#f59e0b'),
    ('Driver Withdrawals', '#64748b'),
    ('Promotions', '#ec4899'),
]


def _to_kobo(amount) -> int:
    if amount is None:
        return 0
    return int(Decimal(str(amount)) * 100)


def _pct(part: int, whole: int) -> int:
    return round((part / whole) * 100) if whole > 0 else 0


def _mask_reference(ref: str) -> str:
    ref = (ref or '').strip()
    if len(ref) <= 4:
        return ref
    return f'{ref[:4]}****{ref[-2:]}'


def _route_hint(pickup: str, dropoff: str, max_len: int = 18) -> str:
    def short(addr: str) -> str:
        addr = (addr or '').strip()
        return addr if len(addr) <= max_len else f'{addr[:max_len].rstrip()}…'

    return f'{short(pickup)} → {short(dropoff)}'


def _resolve_campus(user):
    if user.role == UserRole.ADMIN:
        return None
    try:
        return user.campus_admin_profile.campus
    except CampusAdminProfile.DoesNotExist:
        return None


def _period_bounds(period: str, now: datetime | None = None):
    now = now or timezone.now()
    start = now

    if period == '1D':
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == '7D':
        start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == '30D':
        start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == '90D':
        start = (now - timedelta(days=89)).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'YTD':
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == '1Y':
        start = now - timedelta(days=365)
    elif period == 'ALL':
        start = timezone.make_aware(datetime(1970, 1, 1))

    duration = now - start
    prev_end = start
    prev_start = start - duration
    return start, now, prev_start, prev_end


def _bucket_count(period: str) -> int:
    if period == '1D':
        return 24
    if period == '7D':
        return 7
    if period == '30D':
        return 30
    return 12


def _bucket_label(period: str, bucket_start: datetime, index: int) -> str:
    if period == '1D':
        return f'{index}h'
    if period == '7D':
        return bucket_start.strftime('%a')[:2]
    if period in ('30D', '90D'):
        return bucket_start.strftime('%b %d').split(' ')[0]
    return bucket_start.strftime('%b')


def _rides_qs(campus, start=None, end=None):
    qs = Ride.objects.filter(status=RideStatus.COMPLETED)
    if campus is not None:
        qs = qs.filter(student__student_profile__campus=campus)
    if start is not None:
        qs = qs.filter(trip_completed_at__gte=start)
    if end is not None:
        qs = qs.filter(trip_completed_at__lt=end)
    return qs


def _gateway_qs(campus, start=None, end=None):
    qs = GatewayTransaction.objects.all()
    if campus is not None:
        qs = qs.filter(user__student_profile__campus=campus)
    if start is not None:
        qs = qs.filter(created_at__gte=start)
    if end is not None:
        qs = qs.filter(created_at__lt=end)
    return qs


def _withdrawal_qs(campus, start=None, end=None):
    qs = DriverWithdrawal.objects.all()
    if campus is not None:
        qs = qs.filter(user__driver_profile__campus=campus)
    if start is not None:
        qs = qs.filter(requested_at__gte=start)
    if end is not None:
        qs = qs.filter(requested_at__lt=end)
    return qs


def _refund_kobo(campus, start=None, end=None) -> int:
    qs = WalletTransaction.objects.filter(
        source=WalletTransaction.Source.RIDE_REFUND,
        status=WalletTransaction.Status.COMPLETED,
    )
    if campus is not None:
        qs = qs.filter(
            Q(ride__student__student_profile__campus=campus)
            | Q(user__student_profile__campus=campus)
        )
    if start is not None:
        qs = qs.filter(created_at__gte=start)
    if end is not None:
        qs = qs.filter(created_at__lt=end)
    total = qs.aggregate(total=Sum('amount'))['total'] or 0
    return _to_kobo(total)


def _promotion_kobo(campus, start=None, end=None) -> int:
    qs = WalletTransaction.objects.filter(
        source=WalletTransaction.Source.PROMOTION,
        status=WalletTransaction.Status.COMPLETED,
    )
    if campus is not None:
        qs = qs.filter(user__student_profile__campus=campus)
    if start is not None:
        qs = qs.filter(created_at__gte=start)
    if end is not None:
        qs = qs.filter(created_at__lt=end)
    total = qs.aggregate(total=Sum('amount'))['total'] or 0
    return _to_kobo(total)


def _compute_kpis(campus, start, end):
    rides = _rides_qs(campus, start, end)
    gateways = _gateway_qs(campus, start, end)
    withdrawals = _withdrawal_qs(campus, start, end)

    platform_revenue = rides.aggregate(total=Sum('platform_commission'))['total'] or 0
    ride_fare_total = rides.aggregate(total=Sum('total_fare'))['total'] or 0
    ride_count = rides.count()
    avg_fare = rides.aggregate(avg=Avg('total_fare'))['avg'] or 0

    gw_attempts = gateways.count()
    gw_success = gateways.filter(gateway_status=GatewayTransaction.GatewayStatus.SUCCESS).count()
    gw_failed = gateways.filter(
        gateway_status__in=[
            GatewayTransaction.GatewayStatus.FAILED,
            GatewayTransaction.GatewayStatus.ABANDONED,
        ]
    ).count()
    gw_pending = gateways.filter(
        gateway_status__in=[
            GatewayTransaction.GatewayStatus.INITIATED,
            GatewayTransaction.GatewayStatus.PENDING,
        ]
    ).count()

    wdr_count = withdrawals.count()
    wdr_failed = withdrawals.filter(status=DriverWithdrawal.Status.FAILED).count()
    wdr_pending = withdrawals.filter(
        status__in=[DriverWithdrawal.Status.PENDING, DriverWithdrawal.Status.PROCESSING]
    ).count()

    transaction_count = ride_count + gw_attempts + wdr_count
    success_count = ride_count + gw_success + withdrawals.filter(
        status=DriverWithdrawal.Status.COMPLETED
    ).count()
    failed_count = gw_failed + wdr_failed
    pending_count = gw_pending + wdr_pending

    return {
        'platform_revenue_kobo': _to_kobo(platform_revenue),
        'ride_fare_total_kobo': _to_kobo(ride_fare_total),
        'transaction_count': transaction_count,
        'success_count': success_count,
        'success_rate': _pct(success_count, transaction_count),
        'failed_count': failed_count,
        'avg_ride_fare_kobo': _to_kobo(avg_fare),
        'pending_count': pending_count,
        'ride_count': ride_count,
    }


def _revenue_trend(campus, period, start, end):
    buckets = _bucket_count(period)
    span = (end - start).total_seconds()
    if span <= 0:
        span = 1

    result = []
    for i in range(buckets):
        b_start = start + timedelta(seconds=(i / buckets) * span)
        b_end = start + timedelta(seconds=((i + 1) / buckets) * span)
        agg = _rides_qs(campus, b_start, b_end).aggregate(
            commission=Sum('platform_commission'),
            rides=Count('id'),
        )
        result.append({
            'label': _bucket_label(period, b_start, i),
            'value_kobo': _to_kobo(agg['commission'] or 0),
            'ride_count': agg['rides'] or 0,
        })
    return result


def _source_breakdown(campus, start, end):
    rides = _rides_qs(campus, start, end)
    gateways = _gateway_qs(campus, start, end)
    withdrawals = _withdrawal_qs(campus, start, end)

    segments = {
        'Ride Payments': _to_kobo(rides.aggregate(t=Sum('total_fare'))['t'] or 0),
        'Wallet Top-ups': _to_kobo(
            gateways.filter(gateway_status=GatewayTransaction.GatewayStatus.SUCCESS)
            .aggregate(t=Sum('amount'))['t'] or 0
        ),
        'Platform Commission': _to_kobo(
            rides.aggregate(t=Sum('platform_commission'))['t'] or 0
        ),
        'Refunds': _refund_kobo(campus, start, end),
        'Driver Withdrawals': _to_kobo(
            withdrawals.filter(status=DriverWithdrawal.Status.COMPLETED)
            .aggregate(t=Sum('amount'))['t'] or 0
        ),
        'Promotions': _promotion_kobo(campus, start, end),
    }

    total = sum(segments.values()) or 1
    color_map = dict(SOURCE_BREAKDOWN)
    return [
        {
            'label': label,
            'value_kobo': value,
            'pct': _pct(value, total),
            'color': color_map.get(label, '#64748b'),
        }
        for label, value in sorted(segments.items(), key=lambda x: x[1], reverse=True)
        if value > 0
    ]


def _top_routes(campus, start, end, limit=5):
    rides = (
        _rides_qs(campus, start, end)
        .values('pickup_address', 'dropoff_address')
        .annotate(
            ride_count=Count('id'),
            revenue_kobo_raw=Sum('platform_commission'),
        )
        .order_by('-ride_count')[:limit]
    )
    return [
        {
            'label': _route_hint(r['pickup_address'], r['dropoff_address']),
            'ride_count': r['ride_count'],
            'revenue_kobo': _to_kobo(r['revenue_kobo_raw'] or 0),
        }
        for r in rides
    ]


def _recent_activity(campus, start, end, limit=8):
    events = []

    for ride in (
        _rides_qs(campus, start, end)
        .order_by('-trip_completed_at')[:limit * 2]
    ):
        events.append({
            'sort_at': ride.trip_completed_at or ride.requested_at,
            'id': str(ride.id),
            'type': 'ride_completed',
            'reference_masked': _mask_reference(ride.reference),
            'status': 'SUCCESS',
            'amount_kobo': _to_kobo(ride.platform_commission or 0),
            'meta': {
                'vehicle_type': ride.vehicle_type_requested,
                'route_hint': _route_hint(ride.pickup_address, ride.dropoff_address),
            },
        })

    for gw in (
        _gateway_qs(campus, start, end)
        .order_by('-created_at')[:limit * 2]
    ):
        status = 'SUCCESS' if gw.gateway_status == GatewayTransaction.GatewayStatus.SUCCESS else (
            'FAILED' if gw.gateway_status in (
                GatewayTransaction.GatewayStatus.FAILED,
                GatewayTransaction.GatewayStatus.ABANDONED,
            ) else 'PENDING'
        )
        events.append({
            'sort_at': gw.created_at,
            'id': str(gw.id),
            'type': 'wallet_topup',
            'reference_masked': _mask_reference(gw.internal_reference),
            'status': status,
            'amount_kobo': _to_kobo(gw.amount),
            'meta': {
                'gateway': gw.gateway,
                'channel': gw.channel or gw.gateway,
            },
        })

    for wdr in (
        _withdrawal_qs(campus, start, end)
        .order_by('-requested_at')[:limit * 2]
    ):
        status_map = {
            DriverWithdrawal.Status.COMPLETED: 'SUCCESS',
            DriverWithdrawal.Status.FAILED: 'FAILED',
            DriverWithdrawal.Status.CANCELLED: 'FAILED',
        }
        events.append({
            'sort_at': wdr.requested_at,
            'id': str(wdr.id),
            'type': 'driver_withdrawal',
            'reference_masked': _mask_reference(wdr.reference),
            'status': status_map.get(wdr.status, 'PENDING'),
            'amount_kobo': _to_kobo(wdr.amount),
            'meta': {
                'bank_name': wdr.bank_name or 'Bank',
            },
        })

    events.sort(key=lambda e: e['sort_at'] or timezone.now(), reverse=True)
    result = []
    for evt in events[:limit]:
        item = {k: v for k, v in evt.items() if k != 'sort_at'}
        result.append(item)
    return result


class FinanceOverviewView(APIView):
    """Aggregated finance overview for campus admin — no user PII."""

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

        start, end, prev_start, prev_end = _period_bounds(period)
        current = _compute_kpis(campus, start, end)
        if period == 'ALL':
            previous = {
                'platform_revenue_kobo': 0,
                'ride_fare_total_kobo': 0,
                'transaction_count': 0,
                'success_count': 0,
                'success_rate': 0,
                'failed_count': 0,
                'avg_ride_fare_kobo': 0,
                'pending_count': 0,
                'ride_count': 0,
            }
        else:
            previous = _compute_kpis(campus, prev_start, prev_end)

        def delta(cur_key, prev_key):
            cur = current[cur_key]
            prev = previous[prev_key]
            return _pct(cur - prev, prev or 1)

        trend = _revenue_trend(campus, period, start, end)
        breakdown = _source_breakdown(campus, start, end)
        top_routes = _top_routes(campus, start, end)
        activity = _recent_activity(campus, start, end)

        return Response({
            'period': period,
            'campus_scoped': campus is not None,
            'kpis': {
                **current,
                'prev_platform_revenue_kobo': previous['platform_revenue_kobo'],
                'prev_transaction_count': previous['transaction_count'],
                'prev_success_rate': previous['success_rate'],
                'prev_failed_count': previous['failed_count'],
                'prev_avg_ride_fare_kobo': previous['avg_ride_fare_kobo'],
                'revenue_delta_pct': delta('platform_revenue_kobo', 'platform_revenue_kobo'),
                'transaction_delta_pct': delta('transaction_count', 'transaction_count'),
                'success_rate_delta': current['success_rate'] - previous['success_rate'],
                'failed_delta_pct': delta('failed_count', 'failed_count'),
            },
            'revenue_trend': trend,
            'source_breakdown': breakdown,
            'top_routes': top_routes,
            'recent_activity': activity,
            'volume_by_period': [
                {'label': b['label'], 'value_kobo': b['value_kobo'], 'ride_count': b['ride_count']}
                for b in trend
            ],
        })

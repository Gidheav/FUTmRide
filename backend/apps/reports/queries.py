"""Report data queries — campus-scoped, privacy-safe aggregates."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import ExtractHour, TruncDate, TruncMonth
from django.utils import timezone

from apps.accounts.models import AuditLog, Campus, User, UserRole
from apps.payments.admin_finance import _mask_reference, _route_hint
from apps.payments.admin_finance_ledger import _collect_ledger_events
from apps.payments.models import DriverWithdrawal, GatewayTransaction, WalletTransaction, WebhookEvent
from apps.rides.models import Ride, RideStatus


def _dec(v) -> Decimal:
    if v is None:
        return Decimal('0')
    return Decimal(str(v))


def _fmt_money(v) -> Decimal:
    return _dec(v)


def _ride_qs(campus, start, end, status=None):
    qs = Ride.objects.all()
    if campus is not None:
        qs = qs.filter(student__student_profile__campus=campus)
    if start:
        qs = qs.filter(requested_at__gte=start)
    if end:
        qs = qs.filter(requested_at__lt=end)
    if status:
        qs = qs.filter(status=status)
    return qs


def _gw_qs(campus, start, end):
    qs = GatewayTransaction.objects.all()
    if campus is not None:
        qs = qs.filter(user__student_profile__campus=campus)
    if start:
        qs = qs.filter(created_at__gte=start)
    if end:
        qs = qs.filter(created_at__lt=end)
    return qs


def _wdr_qs(campus, start, end):
    qs = DriverWithdrawal.objects.all()
    if campus is not None:
        qs = qs.filter(user__driver_profile__campus=campus)
    if start:
        qs = qs.filter(requested_at__gte=start)
    if end:
        qs = qs.filter(requested_at__lt=end)
    return qs


def _wallet_qs(campus, start, end, **filters):
    qs = WalletTransaction.objects.select_related('ride')
    if campus is not None:
        qs = qs.filter(
            Q(ride__student__student_profile__campus=campus)
            | Q(user__student_profile__campus=campus)
            | Q(user__driver_profile__campus=campus)
        )
    if start:
        qs = qs.filter(created_at__gte=start)
    if end:
        qs = qs.filter(created_at__lt=end)
    for k, v in filters.items():
        qs = qs.filter(**{k: v})
    return qs


def run_query(report_key: str, campus, start, end, filters: dict | None = None):
    filters = filters or {}
    handlers = {
        'platform_ledger': _platform_ledger,
        'commission_summary': _commission_summary,
        'gross_ride_volume': _gross_ride_volume,
        'net_settlement': _net_settlement,
        'daily_cash_position': _daily_cash_position,
        'monthly_revenue': _monthly_revenue,
        'quarterly_executive': _quarterly_executive,
        'ytd_revenue': _ytd_revenue,
        'campus_comparison': _campus_comparison,
        'revenue_by_vehicle': _revenue_by_vehicle,
        'completed_rides_register': _completed_rides_register,
        'cancelled_rides_analysis': _cancelled_rides_analysis,
        'avg_fare_trend': _avg_fare_trend,
        'surge_impact': _surge_impact,
        'distance_duration_stats': _distance_duration_stats,
        'peak_hours': _peak_hours,
        'route_performance': _route_performance,
        'no_show_summary': _no_show_summary,
        'completion_rate': _completion_rate,
        'payment_method_mix': _payment_method_mix,
        'gateway_reconciliation': _gateway_reconciliation,
        'topup_success_rate': _topup_success_rate,
        'failed_topups': _failed_topups,
        'topup_by_channel': _topup_by_channel,
        'webhook_log': _webhook_log,
        'gateway_settlement_lag': _gateway_settlement_lag,
        'duplicate_idempotency': _duplicate_idempotency,
        'chargeback_register': _chargeback_register,
        'driver_withdrawal_summary': _driver_withdrawal_summary,
        'pending_payouts': _pending_payouts,
        'failed_payouts': _failed_payouts,
        'payout_fees': _payout_fees,
        'driver_earnings_pool': _driver_earnings_pool,
        'commission_driver_share': _commission_driver_share,
        'payout_sla': _payout_sla,
        'bank_distribution': _bank_distribution,
        'dispute_register': _dispute_register,
        'open_disputes_aging': _open_disputes_aging,
        'refunds_issued': _refunds_issued,
        'refund_reason_analysis': _refund_reason_analysis,
        'admin_refund_actions': _admin_refund_actions,
        'dispute_resolution_sla': _dispute_resolution_sla,
        'failed_transactions_master': _failed_transactions_master,
        'needs_action_queue': _needs_action_queue,
        'anomaly_detection': _anomaly_detection,
        'wallet_integrity': _wallet_integrity,
        'orphan_transactions': _orphan_transactions,
        'stale_pending': _stale_pending,
        'admin_audit_trail': _admin_audit_trail,
        'statement_access_log': _statement_access_log,
        'report_generation_log': _report_generation_log,
        'ndpr_consent_register': _ndpr_consent_register,
        'role_access_changes': _role_access_changes,
        'ip_session_audit': _ip_session_audit,
        'student_topup_volume': _student_topup_volume,
        'student_ride_payment_volume': _student_ride_payment_volume,
        'student_refund_volume': _student_refund_volume,
        'promotional_credits': _promotional_credits,
        'rides_by_zone': _rides_by_zone,
        'garage_scan_summary': _garage_scan_summary,
        'drivers_vs_volume': _drivers_vs_volume,
        'vehicle_utilization': _vehicle_utilization,
        'driver_earnings_statement': _personal_statement,
        'driver_tax_summary': _personal_statement,
        'student_wallet_statement': _personal_statement,
        'single_ride_receipt': _single_ride_receipt,
    }
    fn = handlers.get(report_key)
    if not fn:
        return ['Message'], [['Report handler not implemented']], {}
    return fn(campus, start, end, filters)


def _meta(campus, start, end, extra=None):
    m = {
        'Period Start': start.isoformat() if start else 'ALL',
        'Period End': end.isoformat() if end else 'NOW',
        'Campus Scope': campus.name if campus else 'All Campuses',
    }
    if extra:
        m.update(extra)
    return m


def _platform_ledger(campus, start, end, filters):
    events = _collect_ledger_events(campus, start, end)
    headers = ['Event', 'Reference', 'Amount (NGN)', 'Status', 'Source', 'Context', 'Created']
    rows = []
    for e in events:
        ctx = e.get('context') or {}
        hint = ctx.get('route_hint') or ctx.get('gateway') or ctx.get('bank_name') or ''
        rows.append([
            e.get('event_label'), e.get('reference_masked'), _fmt_money(_dec(e.get('amount_kobo', 0)) / 100),
            e.get('status'), e.get('source_label'), hint, e.get('created_at'),
        ])
    return headers, rows, _meta(campus, start, end, {'Rows': len(rows)})


def _commission_summary(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    agg = qs.aggregate(
        rides=Count('id'),
        commission=Sum('platform_commission'),
        fares=Sum('total_fare'),
        driver=Sum('driver_earnings'),
    )
    promos = _dec(_wallet_qs(campus, start, end, source=WalletTransaction.Source.PROMOTION).aggregate(t=Sum('amount'))['t'])
    
    gw_success = _gw_qs(campus, start, end).filter(gateway_status=GatewayTransaction.GatewayStatus.SUCCESS).aggregate(vol=Sum('amount'))['vol']
    gateway_fees = _dec(gw_success) * Decimal('0.015')

    headers = ['Metric', 'Value']
    rows = [
        ['Completed Rides', agg['rides'] or 0],
        ['Gross Fares (NGN)', _fmt_money(agg['fares'])],
        ['Platform Commission (NGN)', _fmt_money(agg['commission'])],
        ['Driver Payouts (NGN)', _fmt_money(agg['driver'])],
        ['Promos/Contra-Revenue (NGN)', _fmt_money(promos)],
        ['Estimated Gateway Fees (NGN)', _fmt_money(gateway_fees)],
        ['Net Revenue (NGN)', _fmt_money(_dec(agg['commission']) - promos - gateway_fees)],
        ['Avg Commission/Ride', _fmt_money(_dec(agg['commission']) / max(agg['rides'] or 1, 1))],
    ]
    return headers, rows, _meta(campus, start, end)


def _gross_ride_volume(campus, start, end, filters):
    return _commission_summary(campus, start, end, filters)


def _net_settlement(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    commission = _dec(qs.aggregate(t=Sum('platform_commission'))['t'])
    refunds = _dec(_wallet_qs(campus, start, end, source=WalletTransaction.Source.RIDE_REFUND).aggregate(t=Sum('amount'))['t'])
    headers = ['Line Item', 'Amount (NGN)']
    rows = [
        ['Platform Commission', _fmt_money(commission)],
        ['Refunds Issued', _fmt_money(refunds)],
        ['Net Settlement', _fmt_money(commission - refunds)],
    ]
    return headers, rows, _meta(campus, start, end)


def _daily_cash_position(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED).annotate(day=TruncDate('trip_completed_at'))
    daily_rides = {
        row['day']: row 
        for row in qs.values('day').annotate(rides=Count('id'), commission=Sum('platform_commission'), fares=Sum('total_fare'))
    }

    gw_qs = _gw_qs(campus, start, end).filter(gateway_status=GatewayTransaction.GatewayStatus.SUCCESS).annotate(day=TruncDate('created_at'))
    daily_topups = {row['day']: row['vol'] for row in gw_qs.values('day').annotate(vol=Sum('amount'))}

    wdr_qs = _wdr_qs(campus, start, end).filter(status=DriverWithdrawal.Status.COMPLETED).annotate(day=TruncDate('processed_at'))
    daily_wdr = {row['day']: row['vol'] for row in wdr_qs.values('day').annotate(vol=Sum('amount'))}

    ref_qs = _wallet_qs(campus, start, end, source=WalletTransaction.Source.RIDE_REFUND).annotate(day=TruncDate('created_at'))
    daily_ref = {row['day']: row['vol'] for row in ref_qs.values('day').annotate(vol=Sum('amount'))}

    all_days = sorted(list(set(daily_rides.keys()) | set(daily_topups.keys()) | set(daily_wdr.keys()) | set(daily_ref.keys())))
    headers = ['Date', 'Rides', 'Gross Fares (NGN)', 'Commission (NGN)', 'Cash Inflow (Top-ups)', 'Cash Outflow (Withdrawals)', 'Refunds Issued', 'Net Cash Position']
    rows = []
    for d in all_days:
        if not d: continue
        r = daily_rides.get(d, {})
        inflow = _dec(daily_topups.get(d, 0))
        outflow = _dec(daily_wdr.get(d, 0))
        refunds = _dec(daily_ref.get(d, 0))
        net = inflow - outflow
        rows.append([
            d, r.get('rides', 0), _dec(r.get('fares', 0)), _dec(r.get('commission', 0)),
            inflow, outflow, refunds, net
        ])
    return headers, rows, _meta(campus, start, end)


def _monthly_revenue(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED).annotate(month=TruncMonth('trip_completed_at'))
    data = list(qs.values('month').annotate(rides=Count('id'), commission=Sum('platform_commission'), fares=Sum('total_fare')).order_by('month'))
    headers = ['Month', 'Rides', 'Gross Fares (NGN)', 'Commission (NGN)', 'Take Rate %', 'MoM Growth %']
    rows = []
    prev_commission = None
    for row in data:
        fares = _dec(row['fares'])
        comm = _dec(row['commission'])
        take_rate = (comm / fares * 100) if fares else Decimal('0')
        growth = ((comm - prev_commission) / prev_commission * 100) if prev_commission else Decimal('0')
        prev_commission = comm
        rows.append([
            row['month'].strftime('%Y-%m') if row['month'] else '', 
            row['rides'], fares, comm, f'{take_rate:.1f}', f'{growth:.1f}' if prev_commission else '-'
        ])
    return headers, rows, _meta(campus, start, end)


def _quarterly_executive(campus, start, end, filters):
    h, r, m = _commission_summary(campus, start, end, filters)
    h2, r2, _ = _net_settlement(campus, start, end, filters)
    return ['Section', 'Metric', 'Value'], [
        ['Summary'] + r[0], ['Summary'] + r[1], ['Net'] + r2[2],
    ], _meta(campus, start, end, {'Report': 'Executive Summary'})


def _ytd_revenue(campus, start, end, filters):
    now = timezone.now()
    ytd_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return _monthly_revenue(campus, ytd_start, now, filters)


def _campus_comparison(campus, start, end, filters):
    headers = ['Campus', 'Completed Rides', 'Commission (NGN)', 'Avg Fare (NGN)']
    rows = []
    campuses = Campus.objects.filter(id=campus.id) if campus else Campus.objects.all()
    for c in campuses:
        qs = Ride.objects.filter(status=RideStatus.COMPLETED, student__student_profile__campus=c)
        if start:
            qs = qs.filter(trip_completed_at__gte=start)
        if end:
            qs = qs.filter(trip_completed_at__lt=end)
        agg = qs.aggregate(rides=Count('id'), commission=Sum('platform_commission'), avg_fare=Avg('total_fare'))
        rows.append([c.name, agg['rides'] or 0, _fmt_money(agg['commission']), _fmt_money(agg['avg_fare'])])
    return headers, rows, _meta(campus, start, end)


def _revenue_by_vehicle(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    headers = ['Vehicle Type', 'Rides', 'Commission (NGN)', 'Share %']
    rows = []
    total = _dec(qs.aggregate(t=Sum('platform_commission'))['t']) or Decimal('1')
    for row in qs.values('vehicle_type_requested').annotate(
        rides=Count('id'), commission=Sum('platform_commission'),
    ).order_by('-commission'):
        share = float(_dec(row['commission']) / total * 100)
        rows.append([row['vehicle_type_requested'], row['rides'], _fmt_money(row['commission']), f'{share:.1f}'])
    return headers, rows, _meta(campus, start, end)


def _completed_rides_register(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    headers = ['Reference', 'Route', 'Vehicle', 'Base Fare', 'Surge Multiplier', 'Total Fare', 'Platform Commission', 'Driver Earnings', 'Payment', 'Completed']
    rows = []
    for ride in qs.order_by('-trip_completed_at')[:2000]:
        rows.append([
            _mask_reference(ride.reference),
            _route_hint(ride.pickup_address, ride.dropoff_address),
            ride.vehicle_type_requested,
            _fmt_money(ride.base_fare), ride.surge_multiplier,
            _fmt_money(ride.total_fare), _fmt_money(ride.platform_commission),
            _fmt_money(ride.driver_earnings), ride.payment_method, ride.trip_completed_at,
        ])
    return headers, rows, _meta(campus, start, end)


def _cancelled_rides_analysis(campus, start, end, filters):
    cancelled = [
        RideStatus.CANCELLED_BY_STUDENT, RideStatus.CANCELLED_BY_DRIVER,
        RideStatus.CANCELLED_NO_DRIVER, RideStatus.CANCELLED_NO_SHOW,
    ]
    qs = _ride_qs(campus, start, end).filter(status__in=cancelled)
    headers = ['Status', 'Count', 'Lost Fare (NGN)']
    rows = []
    for row in qs.values('status').annotate(count=Count('id'), lost=Sum('total_fare')).order_by('-count'):
        rows.append([row['status'], row['count'], _fmt_money(row['lost'])])
    return headers, rows, _meta(campus, start, end)


def _avg_fare_trend(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED).annotate(day=TruncDate('trip_completed_at'))
    headers = ['Date', 'Avg Fare (NGN)', 'Rides']
    rows = []
    for row in qs.values('day').annotate(avg_fare=Avg('total_fare'), rides=Count('id')).order_by('day'):
        rows.append([row['day'], _fmt_money(row['avg_fare']), row['rides']])
    return headers, rows, _meta(campus, start, end)


def _surge_impact(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    headers = ['Surge Bracket', 'Rides', 'Avg Fare (NGN)', 'Commission (NGN)']
    rows = []
    for label, cond in [('Normal (1.0x)', Q(surge_multiplier__lte=1)), ('Surged (>1.0x)', Q(surge_multiplier__gt=1))]:
        sub = qs.filter(cond)
        agg = sub.aggregate(rides=Count('id'), avg_fare=Avg('total_fare'), commission=Sum('platform_commission'))
        rows.append([label, agg['rides'] or 0, _fmt_money(agg['avg_fare']), _fmt_money(agg['commission'])])
    return headers, rows, _meta(campus, start, end)


def _distance_duration_stats(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    agg = qs.aggregate(
        avg_km=Avg('actual_distance_km'), avg_min=Avg('actual_duration_minutes'),
        total_km=Sum('actual_distance_km'),
    )
    headers = ['Metric', 'Value']
    rows = [
        ['Avg Distance (km)', f'{_dec(agg["avg_km"]):.2f}'],
        ['Avg Duration (min)', f'{_dec(agg["avg_min"]):.1f}'],
        ['Total Distance (km)', f'{_dec(agg["total_km"]):.2f}'],
    ]
    return headers, rows, _meta(campus, start, end)


def _peak_hours(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED).annotate(hour=ExtractHour('requested_at'))
    headers = ['Hour', 'Rides', 'Commission (NGN)']
    rows = []
    for row in qs.values('hour').annotate(rides=Count('id'), commission=Sum('platform_commission')).order_by('hour'):
        rows.append([f'{row["hour"]:02d}:00', row['rides'], _fmt_money(row['commission'])])
    return headers, rows, _meta(campus, start, end)


def _route_performance(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    headers = ['Route', 'Rides', 'Commission (NGN)']
    rows = []
    for row in qs.values('pickup_address', 'dropoff_address').annotate(
        rides=Count('id'), commission=Sum('platform_commission'),
    ).order_by('-rides')[:50]:
        rows.append([_route_hint(row['pickup_address'], row['dropoff_address']), row['rides'], _fmt_money(row['commission'])])
    return headers, rows, _meta(campus, start, end)


def _no_show_summary(campus, start, end, filters):
    qs = _ride_qs(campus, start, end).filter(status=RideStatus.CANCELLED_NO_SHOW)
    agg = qs.aggregate(count=Count('id'), fees=Sum('no_show_fee_amount'))
    headers = ['Metric', 'Value']
    rows = [
        ['No-Show Cancellations', agg['count'] or 0],
        ['Fees Collected (NGN)', _fmt_money(agg['fees'])],
    ]
    return headers, rows, _meta(campus, start, end)


def _completion_rate(campus, start, end, filters):
    total = _ride_qs(campus, start, end).count()
    completed = _ride_qs(campus, start, end, RideStatus.COMPLETED).count()
    rate = round(completed / total * 100, 2) if total else 0
    headers = ['Metric', 'Value']
    rows = [['Total Requests', total], ['Completed', completed], ['Completion Rate %', rate]]
    return headers, rows, _meta(campus, start, end)


def _payment_method_mix(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    headers = ['Payment Method', 'Rides', 'Total Fare (NGN)']
    rows = []
    for row in qs.values('payment_method').annotate(rides=Count('id'), fares=Sum('total_fare')).order_by('-rides'):
        rows.append([row['payment_method'], row['rides'], _fmt_money(row['fares'])])
    return headers, rows, _meta(campus, start, end)


def _gateway_reconciliation(campus, start, end, filters):
    headers = ['Gateway', 'Attempts', 'Success', 'Failed', 'Volume (NGN)', 'Credited']
    rows = []
    for gw in GatewayTransaction.Gateway.values:
        qs = _gw_qs(campus, start, end).filter(gateway=gw)
        success = qs.filter(gateway_status=GatewayTransaction.GatewayStatus.SUCCESS)
        rows.append([
            gw, qs.count(), success.count(),
            qs.filter(gateway_status__in=['failed', 'abandoned']).count(),
            _fmt_money(success.aggregate(t=Sum('amount'))['t']),
            success.filter(wallet_credited=True).count(),
        ])
    return headers, rows, _meta(campus, start, end)


def _topup_success_rate(campus, start, end, filters):
    return _gateway_reconciliation(campus, start, end, filters)


def _failed_topups(campus, start, end, filters):
    qs = _gw_qs(campus, start, end).filter(
        gateway_status__in=[GatewayTransaction.GatewayStatus.FAILED, GatewayTransaction.GatewayStatus.ABANDONED],
    )
    headers = ['Reference', 'Gateway', 'Amount', 'Status', 'Channel', 'Created']
    rows = [[_mask_reference(g.internal_reference), g.gateway, _fmt_money(g.amount), g.gateway_status, g.channel, g.created_at] for g in qs[:2000]]
    return headers, rows, _meta(campus, start, end)


def _topup_by_channel(campus, start, end, filters):
    qs = _gw_qs(campus, start, end).filter(gateway_status=GatewayTransaction.GatewayStatus.SUCCESS)
    headers = ['Channel', 'Count', 'Volume (NGN)']
    rows = []
    for row in qs.values('channel').annotate(count=Count('id'), vol=Sum('amount')).order_by('-vol'):
        rows.append([row['channel'] or 'unknown', row['count'], _fmt_money(row['vol'])])
    return headers, rows, _meta(campus, start, end)


def _webhook_log(campus, start, end, filters):
    qs = WebhookEvent.objects.all()
    if start:
        qs = qs.filter(received_at__gte=start)
    if end:
        qs = qs.filter(received_at__lt=end)
    headers = ['Gateway', 'Event ID', 'Reference', 'Received']
    rows = [[w.gateway, w.event_id, w.reference or '', w.received_at] for w in qs.order_by('-received_at')[:2000]]
    return headers, rows, _meta(campus, start, end)


def _gateway_settlement_lag(campus, start, end, filters):
    qs = _gw_qs(campus, start, end).filter(
        gateway_status=GatewayTransaction.GatewayStatus.SUCCESS,
        webhook_received_at__isnull=False,
    )
    headers = ['Reference', 'Gateway', 'Amount', 'Initiated', 'Credited', 'Lag (sec)']
    rows = []
    for g in qs.order_by('-created_at')[:1000]:
        lag = (g.webhook_received_at - g.created_at).total_seconds() if g.webhook_received_at else 0
        rows.append([_mask_reference(g.internal_reference), g.gateway, _fmt_money(g.amount), g.created_at, g.webhook_received_at, int(lag)])
    return headers, rows, _meta(campus, start, end)


def _duplicate_idempotency(campus, start, end, filters):
    qs = _gw_qs(campus, start, end).exclude(idempotency_key__isnull=True).exclude(idempotency_key='')
    headers = ['Idempotency Key', 'Count', 'References']
    rows = []
    for row in qs.values('idempotency_key').annotate(c=Count('id')).filter(c__gt=1):
        refs = list(qs.filter(idempotency_key=row['idempotency_key']).values_list('internal_reference', flat=True)[:5])
        rows.append([row['idempotency_key'], row['c'], ', '.join(_mask_reference(r) for r in refs)])
    return headers, rows, _meta(campus, start, end)


def _chargeback_register(campus, start, end, filters):
    qs = _gw_qs(campus, start, end).filter(gateway_status=GatewayTransaction.GatewayStatus.REVERSED)
    headers = ['Reference', 'Gateway', 'Amount', 'Updated']
    rows = [[_mask_reference(g.internal_reference), g.gateway, _fmt_money(g.amount), g.updated_at] for g in qs]
    return headers, rows, _meta(campus, start, end)


def _driver_withdrawal_summary(campus, start, end, filters):
    qs = _wdr_qs(campus, start, end).filter(status=DriverWithdrawal.Status.COMPLETED)
    agg = qs.aggregate(count=Count('id'), total=Sum('amount'), fees=Sum('fee'))
    headers = ['Metric', 'Value']
    rows = [
        ['Completed Withdrawals', agg['count'] or 0],
        ['Total Paid (NGN)', _fmt_money(agg['total'])],
        ['Total Fees (NGN)', _fmt_money(agg['fees'])],
    ]
    return headers, rows, _meta(campus, start, end)


def _pending_payouts(campus, start, end, filters):
    qs = _wdr_qs(campus, start, end).filter(status__in=[DriverWithdrawal.Status.PENDING, DriverWithdrawal.Status.PROCESSING])
    headers = ['Reference', 'Amount', 'Status', 'Bank', 'Requested']
    rows = [[_mask_reference(w.reference), _fmt_money(w.amount), w.status, w.bank_name, w.requested_at] for w in qs]
    return headers, rows, _meta(campus, start, end)


def _failed_payouts(campus, start, end, filters):
    qs = _wdr_qs(campus, start, end).filter(status__in=[DriverWithdrawal.Status.FAILED, DriverWithdrawal.Status.CANCELLED])
    headers = ['Reference', 'Amount', 'Status', 'Bank', 'Requested']
    rows = [[_mask_reference(w.reference), _fmt_money(w.amount), w.status, w.bank_name, w.requested_at] for w in qs]
    return headers, rows, _meta(campus, start, end)


def _payout_fees(campus, start, end, filters):
    qs = _wdr_qs(campus, start, end)
    agg = qs.aggregate(fees=Sum('fee'), count=Count('id'))
    headers = ['Metric', 'Value']
    rows = [['Withdrawals', agg['count'] or 0], ['Total Fees (NGN)', _fmt_money(agg['fees'])]]
    return headers, rows, _meta(campus, start, end)


def _driver_earnings_pool(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    agg = qs.aggregate(total=Sum('driver_earnings'), rides=Count('id'))
    wdr_qs = _wdr_qs(campus, start, end).filter(status=DriverWithdrawal.Status.COMPLETED)
    wdr_agg = wdr_qs.aggregate(total=Sum('amount'))
    
    earnings = _dec(agg['total'])
    withdrawals = _dec(wdr_agg['total'])
    liability = earnings - withdrawals
    
    headers = ['Metric', 'Value']
    rows = [
        ['Completed Rides', agg['rides'] or 0],
        ['Total Driver Earnings (NGN)', _fmt_money(earnings)],
        ['Total Withdrawals (NGN)', _fmt_money(withdrawals)],
        ['Current Liability Owed (NGN)', _fmt_money(liability)]
    ]
    return headers, rows, _meta(campus, start, end)


def _commission_driver_share(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    agg = qs.aggregate(commission=Sum('platform_commission'), driver=Sum('driver_earnings'), fares=Sum('total_fare'))
    headers = ['Party', 'Amount (NGN)', 'Share %']
    fares = _dec(agg['fares']) or Decimal('1')
    rows = [
        ['Platform Commission', _fmt_money(agg['commission']), f'{float(_dec(agg["commission"])/fares*100):.1f}'],
        ['Driver Earnings', _fmt_money(agg['driver']), f'{float(_dec(agg["driver"])/fares*100):.1f}'],
        ['Gross Fares', _fmt_money(agg['fares']), '100.0'],
    ]
    return headers, rows, _meta(campus, start, end)


def _payout_sla(campus, start, end, filters):
    qs = _wdr_qs(campus, start, end).filter(status=DriverWithdrawal.Status.COMPLETED, processed_at__isnull=False)
    headers = ['Reference', 'Amount', 'Requested', 'Processed', 'Hours']
    rows = []
    for w in qs.order_by('-requested_at')[:1000]:
        hrs = (w.processed_at - w.requested_at).total_seconds() / 3600
        rows.append([_mask_reference(w.reference), _fmt_money(w.amount), w.requested_at, w.processed_at, f'{hrs:.1f}'])
    return headers, rows, _meta(campus, start, end)


def _bank_distribution(campus, start, end, filters):
    qs = _wdr_qs(campus, start, end).filter(status=DriverWithdrawal.Status.COMPLETED)
    headers = ['Bank', 'Count', 'Total (NGN)']
    rows = []
    for row in qs.values('bank_name').annotate(count=Count('id'), total=Sum('amount')).order_by('-total'):
        rows.append([row['bank_name'] or 'Unknown', row['count'], _fmt_money(row['total'])])
    return headers, rows, _meta(campus, start, end)


def _dispute_register(campus, start, end, filters):
    qs = _ride_qs(campus, start, end).filter(status=RideStatus.DISPUTED)
    headers = ['Reference', 'Route', 'Fare', 'Commission', 'Updated']
    rows = [[_mask_reference(r.reference), _route_hint(r.pickup_address, r.dropoff_address), _fmt_money(r.total_fare), _fmt_money(r.platform_commission), r.updated_at] for r in qs]
    return headers, rows, _meta(campus, start, end)


def _open_disputes_aging(campus, start, end, filters):
    now = timezone.now()
    qs = Ride.objects.filter(status=RideStatus.DISPUTED)
    if campus:
        qs = qs.filter(student__student_profile__campus=campus)
    headers = ['Reference', 'Days Open', 'Fare (NGN)', 'Last Updated']
    rows = []
    for r in qs:
        days = (now - (r.updated_at or r.requested_at)).days
        rows.append([_mask_reference(r.reference), days, _fmt_money(r.total_fare), r.updated_at])
    return headers, rows, _meta(campus, start, end)


def _refunds_issued(campus, start, end, filters):
    qs = _wallet_qs(campus, start, end, source=WalletTransaction.Source.RIDE_REFUND)
    headers = ['Reference', 'Ride Ref', 'Amount', 'Narration', 'Date']
    rows = []
    for tx in qs.order_by('-created_at')[:2000]:
        rows.append([tx.reference, _mask_reference(tx.ride.reference) if tx.ride else '', _fmt_money(tx.amount), tx.narration, tx.created_at])
    return headers, rows, _meta(campus, start, end)


def _refund_reason_analysis(campus, start, end, filters):
    qs = _ride_qs(campus, start, end).filter(status__in=[
        RideStatus.CANCELLED_BY_STUDENT, RideStatus.CANCELLED_BY_DRIVER, RideStatus.CANCELLED_NO_SHOW,
    ])
    headers = ['Cancellation Status', 'Count']
    rows = [[row['status'], row['c']] for row in qs.values('status').annotate(c=Count('id')).order_by('-c')]
    return headers, rows, _meta(campus, start, end)


def _admin_refund_actions(campus, start, end, filters):
    qs = AuditLog.objects.filter(action=AuditLog.Action.WALLET_CREDIT, metadata__operation='admin_dispute_refund')
    if start:
        qs = qs.filter(created_at__gte=start)
    if end:
        qs = qs.filter(created_at__lt=end)
    headers = ['Date', 'Actor', 'Ride Ref', 'Amount', 'IP']
    rows = []
    for log in qs.order_by('-created_at')[:500]:
        meta = log.metadata or {}
        rows.append([log.created_at, log.actor_id, meta.get('ride_reference', ''), meta.get('amount', ''), log.ip_address])
    return headers, rows, _meta(campus, start, end)


def _dispute_resolution_sla(campus, start, end, filters):
    return _open_disputes_aging(campus, start, end, filters)


def _failed_transactions_master(campus, start, end, filters):
    events = _collect_ledger_events(campus, start, end)
    failed = [e for e in events if e.get('status') == 'FAILED']
    headers = ['Event', 'Reference', 'Amount', 'Source', 'Created']
    rows = [[e.get('event_label'), e.get('reference_masked'), _fmt_money(_dec(e.get('amount_kobo', 0))/100), e.get('source_label'), e.get('created_at')] for e in failed]
    return headers, rows, _meta(campus, start, end)


def _needs_action_queue(campus, start, end, filters):
    events = _collect_ledger_events(campus, start, end)
    items = [e for e in events if e.get('needs_action')]
    headers = ['Event', 'Reference', 'Status', 'Source', 'Created']
    rows = [[e.get('event_label'), e.get('reference_masked'), e.get('status'), e.get('source_label'), e.get('created_at')] for e in items]
    return headers, rows, _meta(campus, start, end)


def _anomaly_detection(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED).annotate(day=TruncDate('trip_completed_at'))
    headers = ['Date', 'Rides', 'Flag']
    rows = []
    daily = list(qs.values('day').annotate(rides=Count('id')).order_by('day'))
    if not daily:
        return headers, rows, _meta(campus, start, end)
    avg = sum(d['rides'] for d in daily) / len(daily)
    for d in daily:
        flag = 'SPIKE' if d['rides'] > avg * 2 else ('LOW' if d['rides'] < avg * 0.5 else 'NORMAL')
        rows.append([d['day'], d['rides'], flag])
    return headers, rows, _meta(campus, start, end, {'Avg Daily Rides': f'{avg:.1f}'})


def _wallet_integrity(campus, start, end, filters):
    qs = _wallet_qs(campus, start, end)
    headers = ['Metric', 'Value']
    rows = [
        ['Wallet Transactions', qs.count()],
        ['Credits', qs.filter(transaction_type=WalletTransaction.TransactionType.CREDIT).count()],
        ['Debits', qs.filter(transaction_type=WalletTransaction.TransactionType.DEBIT).count()],
    ]
    return headers, rows, _meta(campus, start, end)


def _orphan_transactions(campus, start, end, filters):
    qs = _wallet_qs(campus, start, end).filter(ride__isnull=True, source=WalletTransaction.Source.RIDE_PAYMENT)
    headers = ['Reference', 'Source', 'Amount', 'Date']
    rows = [[tx.reference, tx.source, _fmt_money(tx.amount), tx.created_at] for tx in qs[:1000]]
    return headers, rows, _meta(campus, start, end)


def _stale_pending(campus, start, end, filters):
    cutoff = timezone.now() - timedelta(hours=24)
    gw = _gw_qs(campus, start, end).filter(
        gateway_status__in=[GatewayTransaction.GatewayStatus.PENDING, GatewayTransaction.GatewayStatus.INITIATED],
        created_at__lt=cutoff,
    )
    wdr = _wdr_qs(campus, start, end).filter(status=DriverWithdrawal.Status.PENDING, requested_at__lt=cutoff)
    headers = ['Type', 'Reference', 'Amount', 'Created']
    rows = [['Gateway', _mask_reference(g.internal_reference), _fmt_money(g.amount), g.created_at] for g in gw]
    rows += [['Withdrawal', _mask_reference(w.reference), _fmt_money(w.amount), w.requested_at] for w in wdr]
    return headers, rows, _meta(campus, start, end)


def _admin_audit_trail(campus, start, end, filters):
    qs = AuditLog.objects.all()
    if start:
        qs = qs.filter(created_at__gte=start)
    if end:
        qs = qs.filter(created_at__lt=end)
    headers = ['Date', 'Action', 'Actor', 'Target', 'IP', 'Metadata']
    rows = []
    for log in qs.order_by('-created_at')[:2000]:
        rows.append([log.created_at, log.action, str(log.actor_id or ''), f'{log.target_type}:{log.target_id}', log.ip_address, str(log.metadata)[:120]])
    return headers, rows, _meta(campus, start, end)


def _statement_access_log(campus, start, end, filters):
    from apps.reports.models import StatementAccessRequest
    qs = StatementAccessRequest.objects.filter(download_count__gt=0)
    if campus:
        qs = qs.filter(campus=campus)
    headers = ['Subject', 'Scope', 'Period', 'Downloads', 'Last Download', 'By']
    rows = []
    for s in qs.order_by('-last_downloaded_at')[:500]:
        rows.append([str(s.subject_id)[:8] + '***', s.scope, f'{s.period_start.date()}–{s.period_end.date()}', s.download_count, s.last_downloaded_at, str(s.last_downloaded_by_id or '')])
    return headers, rows, _meta(campus, start, end)


def _report_generation_log(campus, start, end, filters):
    from apps.reports.models import ReportRun
    qs = ReportRun.objects.all()
    if campus:
        qs = qs.filter(campus=campus)
    if start:
        qs = qs.filter(created_at__gte=start)
    if end:
        qs = qs.filter(created_at__lt=end)
    headers = ['Date', 'Report', 'Format', 'Status', 'Rows', 'By']
    rows = []
    for r in qs.order_by('-created_at')[:2000]:
        rows.append([r.created_at, r.report_key, r.format, r.status, r.row_count, str(r.requested_by_id or '')])
    return headers, rows, _meta(campus, start, end)


def _ndpr_consent_register(campus, start, end, filters):
    qs = User.objects.filter(data_consent_given=True).exclude(role__in=[UserRole.ADMIN, UserRole.CAMPUS_ADMIN])
    if campus:
        qs = qs.filter(Q(student_profile__campus=campus) | Q(driver_profile__campus=campus))
    headers = ['Role', 'Consent Given', 'Consent Date', 'User ID']
    rows = [[u.role, u.data_consent_given, u.data_consent_timestamp, str(u.id)] for u in qs[:2000]]
    return headers, rows, _meta(campus, start, end)


def _role_access_changes(campus, start, end, filters):
    qs = AuditLog.objects.filter(action=AuditLog.Action.ROLE_CHANGE)
    if start:
        qs = qs.filter(created_at__gte=start)
    if end:
        qs = qs.filter(created_at__lt=end)
    headers = ['Date', 'Actor', 'Target', 'Metadata', 'IP']
    rows = [[l.created_at, str(l.actor_id or ''), l.target_id, str(l.metadata)[:100], l.ip_address] for l in qs[:500]]
    return headers, rows, _meta(campus, start, end)


def _ip_session_audit(campus, start, end, filters):
    return _admin_audit_trail(campus, start, end, filters)


def _student_topup_volume(campus, start, end, filters):
    qs = _gw_qs(campus, start, end).filter(gateway_status=GatewayTransaction.GatewayStatus.SUCCESS)
    agg = qs.aggregate(count=Count('id'), vol=Sum('amount'))
    headers = ['Metric', 'Value']
    rows = [['Successful Top-Ups', agg['count'] or 0], ['Volume (NGN)', _fmt_money(agg['vol'])]]
    return headers, rows, _meta(campus, start, end)


def _student_ride_payment_volume(campus, start, end, filters):
    qs = _wallet_qs(campus, start, end, source=WalletTransaction.Source.RIDE_PAYMENT, transaction_type=WalletTransaction.TransactionType.DEBIT)
    agg = qs.aggregate(count=Count('id'), vol=Sum('amount'))
    headers = ['Metric', 'Value']
    rows = [['Ride Payments', agg['count'] or 0], ['Volume (NGN)', _fmt_money(agg['vol'])]]
    return headers, rows, _meta(campus, start, end)


def _student_refund_volume(campus, start, end, filters):
    return _refunds_issued(campus, start, end, filters)


def _promotional_credits(campus, start, end, filters):
    qs = _wallet_qs(campus, start, end, source=WalletTransaction.Source.PROMOTION)
    agg = qs.aggregate(count=Count('id'), vol=Sum('amount'))
    headers = ['Metric', 'Value']
    rows = [['Promotions', agg['count'] or 0], ['Volume (NGN)', _fmt_money(agg['vol'])]]
    return headers, rows, _meta(campus, start, end)


def _rides_by_zone(campus, start, end, filters):
    qs = _ride_qs(campus, start, end, RideStatus.COMPLETED)
    headers = ['Pickup Area', 'Rides', 'Commission (NGN)']
    rows = []
    for row in qs.values('pickup_address').annotate(rides=Count('id'), commission=Sum('platform_commission')).order_by('-rides')[:100]:
        addr = (row['pickup_address'] or '')[:40]
        rows.append([addr, row['rides'], _fmt_money(row['commission'])])
    return headers, rows, _meta(campus, start, end)


def _garage_scan_summary(campus, start, end, filters):
    try:
        from apps.rides.garage_models import GarageRide
        qs = GarageRide.objects.all()
        if start:
            qs = qs.filter(created_at__gte=start)
        if end:
            qs = qs.filter(created_at__lt=end)
        headers = ['Status', 'Count']
        rows = [[row['status'], row['c']] for row in qs.values('status').annotate(c=Count('id'))]
    except Exception:
        headers, rows = ['Message'], [['Garage module data unavailable']]
    return headers, rows, _meta(campus, start, end)


def _drivers_vs_volume(campus, start, end, filters):
    rides = _ride_qs(campus, start, end, RideStatus.COMPLETED).count()
    from apps.accounts.models import DriverProfile
    drivers = DriverProfile.objects.filter(is_online=True)
    if campus:
        drivers = drivers.filter(campus=campus)
    online = drivers.count()
    headers = ['Metric', 'Value']
    rows = [['Completed Rides', rides], ['Drivers Online Now', online], ['Rides per Online Driver', round(rides / max(online, 1), 2)]]
    return headers, rows, _meta(campus, start, end)


def _vehicle_utilization(campus, start, end, filters):
    return _revenue_by_vehicle(campus, start, end, filters)


def _personal_statement(campus, start, end, filters):
    consent_id = filters.get('consent_id')
    if not consent_id:
        return ['Error'], [['Consent approval required for personal statements']], {}
    from apps.reports.models import StatementAccessRequest
    try:
        req = StatementAccessRequest.objects.select_related('subject').get(id=consent_id, status=StatementAccessRequest.Status.APPROVED)
    except StatementAccessRequest.DoesNotExist:
        return ['Error'], [['Invalid or expired consent request']], {}
    if req.expires_at and req.expires_at < timezone.now():
        return ['Error'], [['Consent request has expired']], {}
    qs = WalletTransaction.objects.filter(user=req.subject, created_at__gte=req.period_start, created_at__lt=req.period_end)
    headers = ['Date', 'Reference', 'Type', 'Source', 'Amount (NGN)', 'Balance After', 'Narration']
    rows = []
    for tx in qs.order_by('created_at'):
        rows.append([tx.created_at, tx.reference, tx.transaction_type, tx.source, _fmt_money(tx.amount), _fmt_money(tx.balance_after), tx.narration])
    return headers, rows, _meta(campus, req.period_start, req.period_end, {
        'Subject': req.subject.full_name if hasattr(req.subject, 'full_name') else str(req.subject_id),
        'Scope': req.scope,
    })


def _single_ride_receipt(campus, start, end, filters):
    ride_id = filters.get('ride_id') or filters.get('consent_id')
    if not ride_id:
        return ['Error'], [['Ride ID required']], {}
    try:
        ride = Ride.objects.get(id=ride_id)
    except Ride.DoesNotExist:
        return ['Error'], [['Ride not found']], {}
    headers = ['Field', 'Value']
    rows = [
        ['Reference', ride.reference], ['Status', ride.status], ['Fare', _fmt_money(ride.total_fare)],
        ['Commission', _fmt_money(ride.platform_commission)], ['Route', _route_hint(ride.pickup_address, ride.dropoff_address)],
        ['Completed', ride.trip_completed_at],
    ]
    return headers, rows, _meta(campus, start, end)

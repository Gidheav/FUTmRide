// ─────────────────────────────────────────────────────────────────────────────
// OverviewTab.tsx — Hub Overview tab (LR-Ride platform treasury view)
// Privacy-safe: aggregated KPIs, anonymized activity, no student/driver PII
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useMemo } from 'react';
import type { FinanceOverview } from '../../types/financial.types';
import { compact, cMeta } from '../../helpers/hub.helpers';
import { KPICard }    from '../../components/KPICard';
import { TrendBadge } from '../../components/TrendBadge';
import { Card }       from '../../components/Card';
import { AreaChart }  from '../../components/Charts';
import { BarViz }     from '../../components/Charts';
import { Donut }      from '../../components/Charts';
import { StatusPill } from '../../components/StatusBadge';
import Icon from '../../../../components/common/Icon';

import { T } from '../../../theme';

const ACTIVITY_META: Record<string, { icon: string; title: string; sub: (meta: Record<string, string>) => string }> = {
  ride_completed: {
    icon: 'local_taxi',
    title: 'Ride completed',
    sub: (m) => m.route_hint || m.vehicle_type || 'Campus ride',
  },
  wallet_topup: {
    icon: 'account_balance_wallet',
    title: 'Wallet top-up',
    sub: (m) => (m.gateway ? `${m.gateway} · ${m.channel || 'gateway'}` : 'Payment gateway'),
  },
  driver_withdrawal: {
    icon: 'send',
    title: 'Driver withdrawal',
    sub: (m) => m.bank_name || 'Payout request',
  },
};

export const OverviewTab = memo(({
  overview,
  loading,
}: {
  overview: FinanceOverview | null;
  loading: boolean;
}) => {
  const kpis = overview?.kpis;

  const revSpark = useMemo(
    () => (overview?.revenue_trend ?? []).map((b) => b.value_kobo / 100),
    [overview],
  );

  const txnSpark = useMemo(
    () => (overview?.volume_by_period ?? []).map((b) => b.ride_count),
    [overview],
  );

  const revChart = useMemo(
    () => (overview?.revenue_trend ?? []).map((b) => ({ label: b.label, value: b.value_kobo })),
    [overview],
  );

  const catData = useMemo(
    () => (overview?.source_breakdown ?? []).map((c) => ({
      label: c.label,
      value: c.value_kobo,
      pct: c.pct,
      color: c.color || cMeta(c.label).dot,
    })),
    [overview],
  );

  const topRoutes = overview?.top_routes ?? [];
  const activity  = overview?.recent_activity ?? [];
  const maxRoute  = topRoutes[0]?.revenue_kobo || 1;

  if (loading && !overview) {
    return (
      <p className="text-xs font-sans text-slate-500 text-center py-16">Loading platform overview…</p>
    );
  }

  if (!overview || !kpis) {
    return (
      <p className="text-xs font-sans text-slate-500 text-center py-16">Unable to load finance overview.</p>
    );
  }

  const revenue = kpis.platform_revenue_kobo;
  const prevRevenue = kpis.prev_platform_revenue_kobo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" style={{ gap: 2 }}>
        <KPICard
          label="Platform Revenue"
          value={Math.round(revenue / 100)}
          sub={`vs ${compact(prevRevenue)} prev period`}
          spark={revSpark}
          color={T.accent}
          icon="payments"
          delta={kpis.revenue_delta_pct}
          prefix="₦"
        />
        <KPICard
          label="Transactions"
          value={kpis.transaction_count}
          sub={`${kpis.ride_count} rides completed`}
          spark={txnSpark}
          color={T.blue}
          icon="receipt_long"
          delta={kpis.transaction_delta_pct}
        />
        <KPICard
          label="Success Rate"
          value={kpis.success_rate}
          sub={`was ${kpis.prev_success_rate}% prev period`}
          spark={[kpis.prev_success_rate, kpis.success_rate]}
          color={T.purple}
          icon="verified"
          delta={kpis.success_rate_delta}
          prefix="%"
        />
        <KPICard
          label="Failed"
          value={kpis.failed_count}
          sub="need attention"
          spark={[kpis.prev_failed_count, kpis.failed_count]}
          color={T.error}
          icon="cancel"
          delta={kpis.failed_delta_pct}
        />
        <KPICard
          label="Avg Ride Fare"
          value={Math.round(kpis.avg_ride_fare_kobo / 100)}
          sub={`${kpis.ride_count} completed rides`}
          spark={revSpark.length ? revSpark : [0]}
          color={T.warn}
          icon="star"
          prefix="₦"
        />
        <KPICard
          label="Pending"
          value={kpis.pending_count}
          sub="awaiting confirmation"
          spark={Array(10).fill(kpis.pending_count)}
          color={T.textMuted}
          icon="hourglass_top"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3" style={{ gap: 2 }}>
        <Card className="xl:col-span-2 p-6" glow={T.accent}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-widest" style={{ color: T.textMuted }}>
                Revenue Trend
              </p>
              <p className="text-2xl font-mono font-bold mt-1" style={{ color: T.accent }}>{compact(revenue)}</p>
            </div>
            <div className="flex items-center gap-2">
              <TrendBadge delta={kpis.revenue_delta_pct} />
              <span className="text-[10px] font-sans" style={{ color: T.textMuted }}>vs prev period</span>
            </div>
          </div>
          <AreaChart data={revChart} color={T.accent} h={160} />
        </Card>
        <Card className="p-6">
          <p className="text-[10px] font-sans font-semibold uppercase tracking-widest mb-4" style={{ color: T.textMuted }}>
            Revenue Breakdown
          </p>
          <div className="flex flex-col items-center gap-4">
            <Donut
              segs={catData.length > 0 ? catData : [{ label: 'None', value: 1, color: '#1e293b' }]}
              size={140}
              thick={24}
            />
            <div className="w-full space-y-2">
              {catData.slice(0, 5).map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-xs font-sans text-slate-400 flex-1 truncate">{c.label}</span>
                  <span className="text-xs font-mono font-bold text-slate-300">{c.pct}%</span>
                  <span className="text-[10px] font-mono text-slate-600">{compact(c.value)}</span>
                </div>
              ))}
              {catData.length === 0 && <p className="text-xs text-slate-600 text-center">No data</p>}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 2 }}>
        <Card className="lg:col-span-2">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest">
              Platform Activity
            </span>
            <span className="text-[10px] font-sans text-slate-600">{kpis.transaction_count} events this period</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {activity.length === 0
              ? <p className="text-xs font-sans text-slate-600 text-center py-8">No activity in this period</p>
              : activity.map((evt) => {
                const meta = ACTIVITY_META[evt.type] ?? ACTIVITY_META.ride_completed;
                return (
                  <div key={evt.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-800/30 transition-colors">
                    <div
                      className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}
                    >
                      <Icon name={meta.icon} size={14} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-300 truncate">{meta.title}</p>
                      <p className="text-[10px] font-mono text-slate-600 truncate">
                        {evt.reference_masked} · {meta.sub(evt.meta)}
                      </p>
                    </div>
                    <StatusPill status={evt.status} />
                    <span className="text-xs font-mono font-bold text-emerald-400 flex-shrink-0">
                      {compact(evt.amount_kobo)}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Top Routes
          </p>
          <div className="space-y-3">
            {topRoutes.length === 0
              ? <p className="text-xs font-sans text-slate-600 text-center py-4">No routes in this period</p>
              : topRoutes.map((route, i) => (
                <div key={route.label} className="flex items-center gap-2">
                  <span className="text-sm w-4 flex-shrink-0">
                    {i < 3
                      ? ['🥇', '🥈', '🥉'][i]
                      : <span className="text-[9px] font-mono text-slate-600">#{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-300 truncate">{route.label}</p>
                    <p className="text-[10px] font-mono text-slate-600">{route.ride_count} rides</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 flex-shrink-0">
                    {compact(route.revenue_kobo)}
                  </span>
                </div>
              ))}
          </div>
          {topRoutes.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/60">
              <div className="h-1.5 bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500/70"
                  style={{ width: `${Math.round((topRoutes[0].revenue_kobo / maxRoute) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] font-mono text-slate-600 mt-1.5">Leading route share</p>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest mb-4">
          Ride Volume by Period
        </p>
        <BarViz
          data={(overview.volume_by_period ?? []).map((d) => ({
            label: d.label,
            value: d.ride_count,
          }))}
          color="#3b82f6"
          h={80}
        />
      </Card>
    </div>
  );
});
OverviewTab.displayName = 'OverviewTab';

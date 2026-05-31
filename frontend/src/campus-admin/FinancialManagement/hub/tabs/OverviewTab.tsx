// ─────────────────────────────────────────────────────────────────────────────
// OverviewTab.tsx — Hub Overview tab
// Source: FinancialSanctum lines 621–759
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useMemo, useCallback } from 'react';
import type { Tx, Period } from '../../types/financial.types';
import { periodStart, pct, compact, fmtD, cMeta } from '../../helpers/hub.helpers';
import { KPICard }    from '../../components/KPICard';
import { TrendBadge } from '../../components/TrendBadge';
import { Card }       from '../../components/Card';
import { AreaChart }  from '../../components/Charts';
import { BarViz }     from '../../components/Charts';
import { Donut }      from '../../components/Charts';
import { Avatar }     from '../../components/Avatar';
import { StatusPill } from '../../components/StatusBadge';
import Icon from '../../../../components/common/Icon';

const THIN: React.CSSProperties = { scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' };

export const OverviewTab = memo(({ txs, period }: { txs: Tx[]; period: Period }) => {
  const start      = useMemo(() => periodStart(period), [period]);
  const current    = useMemo(() => txs.filter(t => t.created_at && new Date(t.created_at) >= start), [txs, start]);
  const success    = useMemo(() => current.filter(t => t.status === 'SUCCESS'), [current]);
  const prevStart  = useMemo(() => { const len = Date.now() - start.getTime(); return new Date(start.getTime() - len); }, [start]);
  const prev       = useMemo(() => txs.filter(t => t.created_at && new Date(t.created_at) >= prevStart && new Date(t.created_at) < start), [txs, prevStart, start]);
  const prevSucc   = useMemo(() => prev.filter(t => t.status === 'SUCCESS'), [prev]);
  const revenue     = useMemo(() => success.reduce((s, t) => s + t.amount, 0), [success]);
  const prevRevenue = useMemo(() => prevSucc.reduce((s, t) => s + t.amount, 0), [prevSucc]);
  const revDelta    = pct(revenue - prevRevenue, prevRevenue || 1);
  const txDelta     = pct(current.length - prev.length, prev.length || 1);
  const failCount   = current.filter(t => t.status === 'FAILED').length;
  const prevFail    = prev.filter(t => t.status === 'FAILED').length;
  const failDelta   = pct(failCount - prevFail, prevFail || 1);
  const sucRate     = pct(success.length, current.length || 1);
  const prevSucRate = pct(prevSucc.length, prev.length || 1);

  const makeSpark = useCallback((subset: Tx[]) => {
    const BUCKETS = 10;
    const len = Date.now() - start.getTime();
    return Array.from({ length: BUCKETS }, (_, i) => {
      const s = new Date(start.getTime() + (i / BUCKETS) * len);
      const e = new Date(start.getTime() + ((i + 1) / BUCKETS) * len);
      return subset.filter(t => t.created_at && new Date(t.created_at) >= s && new Date(t.created_at) < e).reduce((acc, t) => acc + t.amount, 0);
    });
  }, [start]);

  const revSpark = useMemo(() => makeSpark(success), [makeSpark, success]);
  const txnSpark = useMemo(() => makeSpark(current).map(v => v / 100), [makeSpark, current]);

  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    success.forEach(t => { const c = t.metadata?.giving_category || 'General'; map[c] = (map[c] || 0) + t.amount; });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map).map(([label, value]) => ({ label, value, pct: pct(value, total), color: cMeta(label).dot })).sort((a, b) => b.value - a.value);
  }, [success]);

  const revChart = useMemo(() => {
    const BUCKETS = period === '1D' ? 24 : period === '7D' ? 7 : period === '30D' ? 30 : 12;
    const len = Date.now() - start.getTime();
    return Array.from({ length: BUCKETS }, (_, i) => {
      const s = new Date(start.getTime() + (i / BUCKETS) * len);
      const e = new Date(start.getTime() + ((i + 1) / BUCKETS) * len);
      const v = success.filter(t => t.paid_at && new Date(t.paid_at) >= s && new Date(t.paid_at) < e).reduce((acc, t) => acc + t.amount, 0);
      let lbl = '';
      if (period === '1D') lbl = `${i}h`;
      else if (period === '7D') lbl = s.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
      else lbl = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).split(' ')[0];
      return { label: lbl, value: v };
    });
  }, [success, start, period]);

  const recent = useMemo(() => [...current].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 8), [current]);
  const topG   = useMemo(() => {
    const m: Record<string, { name: string; total: number; count: number }> = {};
    success.forEach(t => { if (!m[t.user_email]) m[t.user_email] = { name: t.user_name || t.user_email, total: 0, count: 0 }; m[t.user_email].total += t.amount; m[t.user_email].count++; });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [success]);

  const maxG      = topG[0]?.total || 1;
  const avgGift   = success.length ? Math.round(revenue / success.length) : 0;
  const pendCount = current.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING').length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard label="Total Revenue"  value={Math.round(revenue/100)}     sub={`vs ${compact(prevRevenue)} prev period`}  spark={revSpark.map(v=>v/100)} color="#10b981" icon="payments"       delta={revDelta}          prefix="₦" />
        <KPICard label="Transactions"   value={current.length}              sub={`${success.length} successful`}            spark={txnSpark}               color="#3b82f6" icon="receipt_long"   delta={txDelta}                />
        <KPICard label="Success Rate"   value={sucRate}                     sub={`was ${prevSucRate}% prev period`}          spark={[prevSucRate,sucRate]}   color="#a78bfa" icon="verified"       delta={sucRate-prevSucRate} prefix="%" />
        <KPICard label="Failed"         value={failCount}                   sub="need attention"                             spark={[prevFail,failCount]}    color="#f87171" icon="cancel"         delta={failDelta}               />
        <KPICard label="Avg Gift"       value={Math.round(avgGift/100)}     sub={`${success.length} unique donors`}          spark={revSpark.map((v,i)=>v/(revChart[i]?.value||1)||0)} color="#fbbf24" icon="star" prefix="₦" />
        <KPICard label="Pending"        value={pendCount}                   sub="awaiting confirmation"                      spark={Array(10).fill(pendCount)} color="#94a3b8" icon="hourglass_top" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-5" glow="#10b981">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest">Revenue Trend</p>
              <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">{compact(revenue)}</p>
            </div>
            <div className="flex items-center gap-2">
              <TrendBadge delta={revDelta} />
              <span className="text-[10px] font-sans text-slate-600">vs prev period</span>
            </div>
          </div>
          <AreaChart data={revChart} color="#10b981" h={160} />
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest mb-4">Giving Breakdown</p>
          <div className="flex flex-col items-center gap-4">
            <Donut segs={catData.length > 0 ? catData : [{ label: 'None', value: 1, color: '#1e293b' }]} size={140} thick={24} />
            <div className="w-full space-y-2">
              {catData.slice(0, 5).map(c => (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest">Recent Activity</span>
            <span className="text-[10px] font-sans text-slate-600">{current.length} total this period</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {recent.length === 0
              ? <p className="text-xs font-sans text-slate-600 text-center py-8">No transactions in this period</p>
              : recent.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
                  <Avatar id={t.id} name={t.user_name || t.user_email} cls="w-7 h-7 text-[10px]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-300 truncate">{t.user_name || t.user_email}</p>
                    <p className="text-[10px] font-mono text-slate-600 truncate">{t.reference}</p>
                  </div>
                  <StatusPill status={t.status} />
                  <span className="text-xs font-mono font-bold text-emerald-400 flex-shrink-0">{compact(t.amount)}</span>
                </div>
              ))}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest mb-4">Top Givers</p>
          <div className="space-y-3">
            {topG.length === 0
              ? <p className="text-xs font-sans text-slate-600 text-center py-4">No givers in this period</p>
              : topG.map((g, i) => (
                <div key={g.name} className="flex items-center gap-2">
                  <span className="text-sm w-4 flex-shrink-0">{i < 3 ? ['🥇','🥈','🥉'][i] : <span className="text-[9px] font-mono text-slate-600">#{i+1}</span>}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-300 truncate">{g.name}</p>
                    <p className="text-[10px] font-mono text-slate-600">{g.count} gifts</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 flex-shrink-0">{compact(g.total)}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest mb-4">Transaction Volume by Period</p>
        <BarViz data={revChart.map(d => ({ label: d.label, value: d.value }))} color="#3b82f6" h={80} />
      </Card>
    </div>
  );
});
OverviewTab.displayName = 'OverviewTab';
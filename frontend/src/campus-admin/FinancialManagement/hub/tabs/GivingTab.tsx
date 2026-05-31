// ─────────────────────────────────────────────────────────────────────────────
// GivingTab.tsx — Hub Giving tab
// Source: FinancialSanctum lines 978–1066
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useMemo } from 'react';
import type { Tx, Period } from '../../types/financial.types';
import { periodStart, pct, compact, fmtD, cMeta } from '../../helpers/hub.helpers';
import { Card }   from '../../components/Card';
import { Bar }    from '../../components/ProgressBar';
import { Donut }  from '../../components/Charts';
import { Avatar } from '../../components/Avatar';
import Icon from '../../../../components/common/Icon';
import { THIN } from '../../constants/hub.constants';

export const GivingTab = memo(({ txs, period }: { txs: Tx[]; period: Period }) => {
  const start   = useMemo(() => periodStart(period), [period]);
  const current = useMemo(() => txs.filter(t => t.created_at && new Date(t.created_at) >= start), [txs, start]);
  const success = useMemo(() => current.filter(t => t.status === 'SUCCESS'), [current]);

  const catBreakdown = useMemo(() => {
    const m: Record<string, { total: number; count: number; recurring: number }> = {};
    success.forEach(t => { const c = t.metadata?.giving_category || 'General'; if (!m[c]) m[c] = { total:0, count:0, recurring:0 }; m[c].total += t.amount; m[c].count++; if (t.metadata?.recurring) m[c].recurring++; });
    const grand = Object.values(m).reduce((s, v) => s + v.total, 0) || 1;
    return Object.entries(m).map(([cat, v]) => ({ cat, ...v, pctOfTotal: pct(v.total, grand) })).sort((a, b) => b.total - a.total);
  }, [success]);

  const topGivers = useMemo(() => {
    const m: Record<string, { name: string; email: string; total: number; count: number; lastDate: string|null }> = {};
    success.forEach(t => { if (!m[t.user_email]) m[t.user_email] = { name:t.user_name||t.user_email, email:t.user_email, total:0, count:0, lastDate:null }; m[t.user_email].total += t.amount; m[t.user_email].count++; if (!m[t.user_email].lastDate || (t.paid_at && t.paid_at > m[t.user_email].lastDate!)) m[t.user_email].lastDate = t.paid_at||null; });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 15);
  }, [success]);

  const maxG           = topGivers[0]?.total || 1;
  const recurringCount = success.filter(t => t.metadata?.recurring).length;
  const oneTimeCount   = success.length - recurringCount;
  const uniqueGivers   = new Set(success.map(t => t.user_email)).size;
  const totalRevenue   = success.reduce((s, t) => s + t.amount, 0);
  const avgGift        = success.length ? totalRevenue / success.length : 0;
  const donutSegs      = catBreakdown.map(c => ({ label: c.cat, value: c.total, color: cMeta(c.cat).dot }));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Raised',    value:compact(totalRevenue), icon:'payments',    color:'#10b981' },
          { label:'Unique Givers',   value:String(uniqueGivers),  icon:'people',      color:'#3b82f6' },
          { label:'Avg Gift',        value:compact(avgGift),      icon:'show_chart',  color:'#f59e0b' },
          { label:'Recurring Gifts', value:String(recurringCount),icon:'autorenew',   color:'#a78bfa' },
        ].map(s => (
          <Card key={s.label} className="p-4" glow={s.color}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">{s.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:`${s.color}22`}}><Icon name={s.icon} size={14} style={{color:s.color}} /></div>
            </div>
            <p className="text-xl font-mono font-bold" style={{color:s.color}}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Category breakdown + side cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <p className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest mb-4">Giving by Category</p>
          <div className="space-y-4">
            {catBreakdown.map(c => { const cm = cMeta(c.cat); return (
              <div key={c.cat}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:cm.dot}} />
                    <span className="text-sm font-sans font-semibold text-slate-300">{c.cat}</span>
                    <span className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded-sm border ${cm.badge}`}>{c.count} gifts</span>
                    {c.recurring > 0 && <span className="text-[10px] font-sans text-slate-600">{c.recurring} recurring</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-400">{c.pctOfTotal}%</span>
                    <span className="text-sm font-mono font-bold" style={{color:cm.dot}}>{compact(c.total)}</span>
                  </div>
                </div>
                <Bar v={c.pctOfTotal} color={cm.dot} h={6} />
              </div>
            );})}
            {catBreakdown.length === 0 && <p className="text-xs font-sans text-slate-600 py-4 text-center">No giving data in this period</p>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest mb-4">Distribution</p>
            <div className="flex justify-center mb-4">
              <Donut segs={donutSegs.length > 0 ? donutSegs : [{label:'None',value:1,color:'#1e293b'}]} size={130} thick={22} />
            </div>
            <div className="space-y-1.5">
              {donutSegs.slice(0,4).map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:s.color}} />
                  <span className="text-[10px] font-sans text-slate-500 flex-1">{s.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{pct(s.value, totalRevenue)}%</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest mb-3">One-time vs Recurring</p>
            <div className="space-y-2">
              {[
                { label:'One-time',  count:oneTimeCount,   pctV:pct(oneTimeCount,   success.length||1), color:'#3b82f6' },
                { label:'Recurring', count:recurringCount, pctV:pct(recurringCount, success.length||1), color:'#a78bfa' },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-sans text-slate-500">{r.label}</span>
                    <span className="text-[10px] font-mono font-bold" style={{color:r.color}}>{r.count} · {r.pctV}%</span>
                  </div>
                  <Bar v={r.pctV} color={r.color} h={5} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Top givers leaderboard */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">Top Givers Leaderboard</span>
          <span className="text-[10px] font-sans text-slate-600">{topGivers.length} donors</span>
        </div>
        <div className="overflow-x-auto" style={THIN}>
          <table className="w-full min-w-[500px] border-collapse">
            <thead><tr className="border-b border-slate-800/60">
              {['RK','DONOR','TOTAL GIVEN','GIFTS','AVG GIFT','LAST GIFT','SHARE'].map((h,hi) => (
                <th key={h} className={`px-3 py-2.5 text-left ${hi===0?'pl-5':''} ${hi===2?'hidden md:table-cell':''} ${hi===3?'hidden sm:table-cell':''} ${hi===4?'hidden lg:table-cell':''} ${hi===5?'hidden xl:table-cell':''} ${hi===6?'px-5':''}`}>
                  <span className="text-[9px] font-sans font-semibold uppercase tracking-widest text-slate-600">{h}</span>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {topGivers.map((g, i) => (
                <tr key={g.email} className={`border-b border-slate-900/60 hover:bg-slate-800/30 transition-colors ${i%2===0?'bg-slate-950':'bg-slate-900/20'}`}>
                  <td className="pl-5 pr-3 py-2.5">{i < 3 ? <span className="text-base">{['🥇','🥈','🥉'][i]}</span> : <span className="text-[10px] font-mono text-slate-600">#{i+1}</span>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar id={g.email} name={g.name} cls="w-7 h-7 text-[10px]" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate">{g.name}</p>
                        <p className="text-[10px] font-mono text-slate-600 truncate hidden sm:block">{g.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell"><span className="text-sm font-mono font-bold text-emerald-400">{compact(g.total)}</span></td>
                  <td className="px-3 py-2.5 hidden sm:table-cell"><span className="text-xs font-mono text-slate-400">{g.count}</span></td>
                  <td className="px-3 py-2.5 hidden lg:table-cell"><span className="text-xs font-mono text-slate-500">{compact(g.total / g.count)}</span></td>
                  <td className="px-3 py-2.5 hidden xl:table-cell"><span className="text-[10px] font-mono text-slate-600">{fmtD(g.lastDate)}</span></td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Bar v={pct(g.total, maxG)} color="#10b981" h={4} />
                      <span className="text-[10px] font-mono text-slate-600 w-8 flex-shrink-0">{pct(g.total, totalRevenue||1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
});
GivingTab.displayName = 'GivingTab';
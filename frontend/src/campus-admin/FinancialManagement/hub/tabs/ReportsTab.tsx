// ─────────────────────────────────────────────────────────────────────────────
// ReportsTab.tsx — Hub Reports tab
// Source: FinancialSanctum lines 1180–1226
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useState } from 'react';
import type { Tx } from '../../types/financial.types';
import { fmtD, exportCSV } from '../../helpers/hub.helpers';
import { Card } from '../../components/Card';
import Icon from '../../../../components/common/Icon';

const REPORTS = [
  { id:'transactions', icon:'receipt_long',        title:'Full Transactions',    desc:'All payments with status, amounts, user data and timestamps.',                    tag:'CSV',  color:'#10b981' },
  { id:'giving',       icon:'volunteer_activism',   title:'Giving Summary',       desc:'Aggregated giving by category, donor and time period.',                           tag:'PDF',  color:'#3b82f6' },
  { id:'budget',       icon:'account_balance',      title:'Budget vs Actual',     desc:'Dept-level budget allocation, expenditure and variance analysis.',                tag:'XLSX', color:'#8b5cf6' },
  { id:'members',      icon:'groups',               title:'Member Giving History',desc:'Individual donor records, LTV, frequency and last gift date.',                    tag:'CSV',  color:'#f59e0b' },
  { id:'monthly',      icon:'bar_chart',            title:'Monthly Revenue',      desc:'Month-by-month revenue for the current fiscal year.',                             tag:'PDF',  color:'#ec4899' },
  { id:'audit',        icon:'policy',               title:'Audit Trail',          desc:'Full immutable log of all financial mutations and admin actions.',                 tag:'PDF',  color:'#64748b' },
  { id:'failed',       icon:'cancel',               title:'Failed Transactions',  desc:'All failed / declined payments with error codes and retry status.',               tag:'CSV',  color:'#ef4444' },
  { id:'tax',          icon:'receipt',              title:'Tax / Donation Report',desc:'Donor receipts and donation summary for tax compliance filing.',                  tag:'PDF',  color:'#0ea5e9' },
] as const;

export const ReportsTab = memo(({ txs }: { txs: Tx[] }) => {
  const [gen, setGen] = useState<string|null>(null);

  const go = (id: string) => {
    setGen(id);
    setTimeout(() => {
      setGen(null);
      if (id === 'transactions') exportCSV(txs);
    }, 1400);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-display font-semibold text-slate-800 dark:text-slate-300">Financial Reports</h2>
          <p className="text-[10px] font-sans text-slate-600 mt-0.5">Generate, download and schedule financial reports</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-sans text-slate-600">
          <Icon name="schedule" size={12} />
          <span>Data current as of {fmtD(new Date().toISOString())}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORTS.map(r => (
          <Card key={r.id} className="overflow-hidden hover:border-slate-700 transition-all group cursor-pointer" glow={r.color}>
            <div className="h-0.5 w-full" style={{ background:`linear-gradient(90deg, ${r.color}80, ${r.color}20)` }} />
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:`${r.color}22`}}>
                  <Icon name={r.icon} size={18} style={{color:r.color}} />
                </div>
                <span className="text-[9px] font-sans font-semibold border rounded-sm px-1.5 py-0.5"
                  style={{color:r.color,borderColor:`${r.color}44`,background:`${r.color}11`}}>
                  {r.tag}
                </span>
              </div>
              <h3 className="text-xs font-sans font-semibold text-slate-800 dark:text-slate-200 mb-1">{r.title}</h3>
              <p className="text-[10px] font-sans text-slate-600 leading-relaxed mb-4">{r.desc}</p>
              <button onClick={() => go(r.id)} disabled={gen === r.id}
                className="w-full h-8 rounded-lg text-[10px] font-sans font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={gen===r.id
                  ? {background:'#1e293b',color:'#475569'}
                  : {background:`${r.color}22`,color:r.color,border:`1px solid ${r.color}44`}}>
                {gen===r.id
                  ? <><div className="w-3 h-3 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />GENERATING…</>
                  : <><Icon name="download" size={12} />GENERATE {r.tag}</>}
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">Scheduled Reports</span>
          <button className="flex items-center gap-1 text-[10px] font-sans text-emerald-500 hover:text-emerald-400 transition-colors">
            <Icon name="add" size={12} />NEW SCHEDULE
          </button>
        </div>
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mb-3">
            <Icon name="schedule_send" size={26} className="text-slate-600" />
          </div>
          <p className="text-sm font-sans font-semibold text-slate-500">No scheduled reports configured</p>
          <p className="text-xs font-sans text-slate-600 mt-1.5 max-w-xs">Set up automatic weekly or monthly reports delivered directly to your inbox.</p>
          <button className="mt-5 flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-700/60 text-emerald-400 text-[10px] font-sans font-semibold px-4 py-2 rounded-lg hover:bg-emerald-900/60 transition-colors">
            <Icon name="add" size={12} />CREATE SCHEDULE
          </button>
        </div>
      </Card>
    </div>
  );
});
ReportsTab.displayName = 'ReportsTab';
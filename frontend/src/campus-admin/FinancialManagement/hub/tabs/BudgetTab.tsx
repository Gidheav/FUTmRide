// ─────────────────────────────────────────────────────────────────────────────
// BudgetTab.tsx — Hub Budget tab
// Source: FinancialSanctum lines 1072–1119
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useState, useEffect } from 'react';
import { nairaFull, pct } from '../../helpers/hub.helpers';
import { Card } from '../../components/Card';
import { Bar }  from '../../components/ProgressBar';
import Icon from '../../../../components/common/Icon';
import { apiService } from '../../../../services/api.service';
import type { BudgetLine } from '../../types/financial.types';

interface BudgetSummary {
  total_allocated: number;
  total_spent: number;
  total_remaining: number;
  budget_usage_percent: number;
  allocations: BudgetLine[];
}

interface FundReserve {
  id: string;
  name: string;
  balance: number;
  icon: string;
  color: string;
  note: string;
}

export const BudgetTab = memo(() => {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [reserves, setReserves] = useState<FundReserve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBudgetData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch budget summary (allocations + calculated totals)
        const summaryRes = await apiService.get<BudgetSummary>('/budget/summary/');
        setSummary(summaryRes);

        // Fetch fund reserves
        const reservesRes = await apiService.get<FundReserve[]>('/budget/reserves/');
        setReserves(reservesRes);
      } catch (err) {
        console.error('[BudgetTab] Failed to fetch budget data:', err);
        setError('Failed to load budget data');
      } finally {
        setLoading(false);
      }
    };

    fetchBudgetData();
  }, []);

  // Show skeleton while loading
  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 h-32 bg-slate-800/30 animate-pulse"><div /></Card>
          ))}
        </div>
        <Card className="p-5 h-64 bg-slate-800/30 animate-pulse"><div /></Card>
      </div>
    );
  }

  // Show error state
  if (error || !summary) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="p-6 border-red-800/30" glow="#ef4444">
          <p className="text-red-400">⚠️ {error || 'Unable to load budget data'}</p>
        </Card>
      </div>
    );
  }

  // Extract data
  const budgetLines = summary.allocations || [];
  const totalAlloc = summary.total_allocated || 0;
  const totalSpent = summary.total_spent || 0;
  const remaining = summary.total_remaining || 0;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Total Budget', value:nairaFull(totalAlloc), icon:'account_balance',               color:'#94a3b8'                          },
          { label:'Total Spent',  value:nairaFull(totalSpent), icon:'payments',                      color:'#10b981'                          },
          { label:'Remaining',    value:nairaFull(remaining),  icon:remaining>=0?'savings':'warning', color:remaining>=0?'#3b82f6':'#ef4444'  },
        ].map(s => (
          <Card key={s.label} className="p-5" glow={s.color}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">{s.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:`${s.color}22`}}>
                <Icon name={s.icon} size={16} style={{color:s.color}} />
              </div>
            </div>
            <p className="text-xl font-mono font-bold" style={{color:s.color}}>{s.value}</p>
            {s.label === 'Total Spent' && (
              <div className="mt-3">
                <Bar v={summary.budget_usage_percent} color="#10b981" h={5} />
                <p className="text-[10px] font-sans text-slate-600 mt-1.5">{summary.budget_usage_percent}% of annual budget consumed</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Department breakdown */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">Budget vs Actual — Dept Breakdown</span>
          <button className="flex items-center gap-1 text-[10px] font-sans text-slate-600 hover:text-emerald-400 transition-colors"><Icon name="edit" size={11} />EDIT</button>
        </div>
        <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-5 py-2 border-b border-slate-800/60 bg-slate-800/20">
          {['DEPARTMENT','ALLOCATED','SPENT','VARIANCE','USAGE'].map(h => (
            <span key={h} className="text-[9px] font-sans font-semibold uppercase tracking-widest text-slate-600">{h}</span>
          ))}
        </div>
        {budgetLines.map(b => {
          const allocated = typeof b.allocated_amount === 'string' ? parseFloat(b.allocated_amount) : b.allocated_amount || 0;
          const spent = typeof b.spent === 'string' ? parseFloat(b.spent) : b.spent || 0;
          const p   = pct(spent, allocated);
          const over = spent > allocated;
          const rem  = allocated - spent;
          const dept = b.department || 'Unknown';
          const color = b.color || '#64748b';
          const icon = b.icon || 'account_balance';

          return (
            <div key={dept} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 items-center px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:`${color}22`}}>
                    <Icon name={icon} size={16} style={{color}} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-300 truncate">{dept}</p>
                    <Bar v={p} color={over?'#ef4444':color} h={3} />
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-500">{nairaFull(allocated)}</span>
                <span className="text-xs font-mono font-bold text-slate-300">{nairaFull(spent)}</span>
                <span className={`text-xs font-mono font-bold ${rem<0?'text-red-400':'text-emerald-400'}`}>{rem<0?'▲':'▼'} {nairaFull(Math.abs(rem))}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-mono font-bold ${over?'text-red-400':p>80?'text-amber-400':'text-slate-300'}`}>{p}%</span>
                  {over && <Icon name="warning" size={12} className="text-red-500" />}
                </div>
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 items-center px-5 py-3.5 bg-slate-800/30 border-t border-slate-700">
          <span className="text-xs font-sans font-semibold text-slate-400">TOTALS</span>
          <span className="text-xs font-mono font-bold text-slate-400">{nairaFull(totalAlloc)}</span>
          <span className="text-xs font-mono font-bold text-emerald-400">{nairaFull(totalSpent)}</span>
          <span className={`text-xs font-mono font-bold ${remaining<0?'text-red-400':'text-blue-400'}`}>{nairaFull(remaining)}</span>
          <span className="text-sm font-mono font-bold text-slate-300">{summary.budget_usage_percent}%</span>
        </div>
      </Card>

      {/* Fund reserves */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-800">
          <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">Designated Fund Reserves</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          {reserves.length > 0 ? (
            reserves.map(f => (
              <div key={f.id} className="flex items-center gap-4 p-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:`${f.color}22`}}>
                  <Icon name={f.icon} size={22} style={{color:f.color}} />
                </div>
                <div>
                  <p className="text-[10px] font-sans font-semibold text-slate-600 uppercase tracking-widest">{f.name}</p>
                  <p className="text-xl font-mono font-bold mt-0.5" style={{color:f.color}}>{nairaFull(f.balance)}</p>
                  <p className="text-[10px] font-sans text-slate-600 mt-0.5">{f.note}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 p-5 text-center text-slate-600">No fund reserves configured</div>
          )}
        </div>
      </Card>
    </div>
  );
});
BudgetTab.displayName = 'BudgetTab';

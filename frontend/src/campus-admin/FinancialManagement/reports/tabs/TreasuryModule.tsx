// ─────────────────────────────────────────────────────────────────────────────
// TreasuryModule.tsx — Treasury tab for FinancialReports
// Cash positions, investments, fund reserves
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import Icon from '../../../../components/common/Icon';

const G = '#10b981';

const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: decimals }).format(n);

const fmtShort = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const compact = (n: number): string => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return ngn(n);
};

const SCard = memo(({ children, className = '', gold = false, style = {} }: {
  children: React.ReactNode;
  className?: string;
  gold?: boolean;
  style?: React.CSSProperties;
}) => (
  <div className={`fs-card relative overflow-hidden ${className}`} style={{ boxShadow: gold ? '0 0 0 1px rgba(16,185,129,0.22), 0 4px 24px rgba(16,185,129,0.09)' : '0 4px 16px rgba(0,0,0,0.25)', ...style }}>
    {gold && <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,#10b98160,transparent)' }} />}
    {children}
  </div>
));
SCard.displayName = 'SCard';

const SBar = memo(({ v, color = G, h = 4 }: { v: number; color?: string; h?: number }) => (
  <div className="fs-bar-track w-full rounded-full overflow-hidden" style={{ height: h }}>
    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, v))}%`, background: color }} />
  </div>
));
SBar.displayName = 'SBar';

const Pill = memo(({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
    style={{ color, background: bg, border: `1px solid ${color}33` }}>
    {label}
  </span>
));
Pill.displayName = 'Pill';

const TreasuryModule: React.FC = () => {
  const cashAccounts = [
    { bank: 'GTBank', acct: '012-345-6789', balance: 8420000, type: 'Current', currency: 'NGN', interest: 0, lastReconciled: '2025-05-28', color: '#10b981' },
    { bank: 'Zenith Bank', acct: '112-233-4455', balance: 3150000, type: 'Current', currency: 'NGN', interest: 0, lastReconciled: '2025-05-28', color: '#3b82f6' },
    { bank: 'Petty Cash', acct: 'Safe-001', balance: 125000, type: 'Petty Cash', currency: 'NGN', interest: 0, lastReconciled: '2025-05-30', color: '#64748b' },
  ];
  const investments = [
    { name: 'FGN Savings Bond', issuer: 'DMO / Federal Govt', maturity: '2027-06-15', face_value: 25000000, coupon: 12.5, current_value: 25000000, ytd_income: 1562500, status: 'Active', color: '#10b981' },
    { name: '91-Day Treasury Bills', issuer: 'CBN (via Zenith)', maturity: '2025-08-10', face_value: 10000000, coupon: 18.2, current_value: 10000000, ytd_income: 455000, status: 'Active', color: '#60a5fa' },
  ];
  const funds = [
    { name: 'General Fund', balance: 42000000, restricted: false, purpose: 'Unrestricted operations', manager: 'Board of Trustees', ytd_in: 5200000, ytd_out: 3100000 },
    { name: 'Building Fund', balance: 8660000, restricted: true, purpose: 'New sanctuary construction', manager: 'Building Committee', ytd_in: 2400000, ytd_out: 0 },
    { name: 'Missions Fund', balance: 1650000, restricted: true, purpose: 'Kenya & West Africa missions', manager: 'Mission Director', ytd_in: 600000, ytd_out: 600000 },
    { name: 'Endowment Fund', balance: 30000000, restricted: true, purpose: 'Permanent corpus — income only', manager: 'Finance Board', ytd_in: 0, ytd_out: 0 },
  ];
  const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0);
  const totalInvest = investments.reduce((s, i) => s + i.current_value, 0);
  const totalIncome = investments.reduce((s, i) => s + i.ytd_income, 0);

  return (
    <div className="p-5 space-y-5 overflow-y-auto h-full fs-slide" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Total Cash', v: totalCash, c: '#10b981', i: 'account_balance_wallet' },
          { l: 'Investments', v: totalInvest, c: '#10b981', i: 'show_chart' },
          { l: 'Investment Income YTD', v: totalIncome, c: '#60a5fa', i: 'trending_up' },
          { l: 'Total Liquid Assets', v: totalCash + totalInvest, c: '#a78bfa', i: 'savings' }
        ].map(k => (
          <SCard key={k.l} className="p-4" gold={k.l === 'Total Cash'}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] fs-text3 uppercase font-bold tracking-widest">{k.l}</span>
              <Icon name={k.i} size={14} style={{ color: k.c }} />
            </div>
            <p className="text-xl font-black font-mono" style={{ color: k.c }}>{compact(k.v)}</p>
          </SCard>
        ))}
      </div>

      {/* Cash accounts */}
      <SCard>
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold fs-text2">Bank Account Positions</p>
            <p className="text-[10px] fs-text3">Live balances as at {fmtShort(new Date().toISOString())}</p>
          </div>
          <button className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            <Icon name="sync" size={11} />Reconcile All
          </button>
        </div>
        <div className="divide-y divide-slate-900/40">
          {cashAccounts.map(a => (
            <div key={a.bank} className="p-4 flex items-center gap-4 fs-hover transition-colors">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}20`, border: `1px solid ${a.color}40` }}>
                <Icon name="account_balance" size={18} style={{ color: a.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold fs-text1">{a.bank}</p>
                <p className="text-[10px] font-mono fs-text3">{a.acct} · {a.type}</p>
              </div>
              <div className="text-center hidden md:block">
                <p className="text-[9px] fs-text3">Last Reconciled</p>
                <p className="text-[10px] font-mono fs-text2">{fmtShort(a.lastReconciled)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black font-mono" style={{ color: a.color }}>{ngn(a.balance)}</p>
                <p className="text-[9px] fs-text3">{a.currency}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-800 flex justify-between" style={{ background: 'rgba(16,185,129,0.04)' }}>
          <span className="text-xs font-bold fs-text2">TOTAL CASH POSITION</span>
          <span className="text-sm font-black font-mono text-emerald-300">{ngn(totalCash)}</span>
        </div>
      </SCard>

      {/* Investment portfolio */}
      <SCard>
        <div className="px-5 py-3 border-b border-slate-800">
          <p className="text-xs font-bold fs-text2">Investment Portfolio</p>
        </div>
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="fs-thead">
                {['INSTRUMENT', 'ISSUER', 'MATURITY', 'FACE VALUE', 'COUPON RATE', 'YTD INCOME', 'STATUS'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left">
                    <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {investments.map((inv, i) => (
                <tr key={inv.name} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                  <td className="px-4 py-3"><span className="text-xs font-bold fs-text1">{inv.name}</span></td>
                  <td className="px-4 py-3"><span className="text-[11px] fs-text3">{inv.issuer}</span></td>
                  <td className="px-4 py-3"><span className="text-[11px] font-mono fs-text2">{fmtShort(inv.maturity)}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-mono font-bold fs-text2">{ngn(inv.face_value)}</span></td>
                  <td className="px-4 py-3"><span className="text-xs font-mono text-emerald-400">{inv.coupon}%</span></td>
                  <td className="px-4 py-3"><span className="text-xs font-mono font-bold" style={{ color: inv.color }}>{ngn(inv.ytd_income)}</span></td>
                  <td className="px-4 py-3"><Pill label={inv.status} color="#10b981" bg="rgba(16,185,129,0.12)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SCard>

      {/* Fund balances */}
      <SCard>
        <div className="px-5 py-3 border-b border-slate-800">
          <p className="text-xs font-bold fs-text2">Designated Fund Balances</p>
        </div>
        <div className="divide-y divide-slate-900/40">
          {funds.map(f => (
            <div key={f.name} className="p-4 flex items-center gap-4 fs-hover transition-colors">
              <div className="w-3 h-12 rounded-full flex-shrink-0" style={{ background: f.restricted ? 'rgba(16,185,129,0.6)' : 'rgba(16,185,129,0.6)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold fs-text1">{f.name}</p>
                  <Pill label={f.restricted ? 'RESTRICTED' : 'UNRESTRICTED'} color="#10b981" bg={f.restricted ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.1)'} />
                </div>
                <p className="text-[10px] fs-text3 mt-0.5">{f.purpose} · Manager: {f.manager}</p>
                <div className="flex gap-4 mt-1">
                  <span className="text-[10px] font-mono text-emerald-400">+{ngn(f.ytd_in)} in</span>
                  <span className="text-[10px] font-mono text-red-400">-{ngn(f.ytd_out)} out</span>
                </div>
              </div>
              <p className="text-xl font-black font-mono text-emerald-300 flex-shrink-0">{compact(f.balance)}</p>
            </div>
          ))}
        </div>
      </SCard>
    </div>
  );
};

export default TreasuryModule;

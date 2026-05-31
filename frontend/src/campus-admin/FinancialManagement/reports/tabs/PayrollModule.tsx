// ─────────────────────────────────────────────────────────────────────────────
// PayrollModule.tsx — Payroll tab for FinancialReports
// Staff register, salary schedule, PAYE, pension, deductions
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, memo } from 'react';
import Icon from '../../../../components/common/Icon';

const G = '#10b981';

const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: decimals }).format(n);

const fmtShort = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const compact = (n: number): string => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return ngn(n);
};
const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';

const SCard = memo(({ children, className = '', style = {} }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div className={`fs-card relative overflow-hidden ${className}`} style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.25)', ...style }}>
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

// Staff data
const staff = [
  { id: 'STF-001', name: 'Rev. Dr. John O. Adeyemi', role: 'Senior Pastor', department: 'Leadership', grade: 'Grade A', basic_salary: 850000, housing: 212500, transport: 50000, other_allowances: 120000, gross_income: 1232500, paye: 156250, pension_emp: 61625, pension_org: 61625, nhis: 12325, union_due: 5000, net_pay: 997300, bank: 'GTBank', acct_no: '0123456789', start_date: '2010-01-15', status: 'active', tin: 'TIN-001-2345' },
  { id: 'STF-002', name: 'Mrs. Grace O. Chukwu', role: 'Adminstrator', department: 'Administration', grade: 'Grade C', basic_salary: 250000, housing: 62500, transport: 20000, other_allowances: 35000, gross_income: 367500, paye: 36750, pension_emp: 18375, pension_org: 18375, nhis: 3675, union_due: 2500, net_pay: 306200, bank: 'Access Bank', acct_no: '9876543210', start_date: '2018-06-01', status: 'active', tin: 'TIN-002-6789' },
  { id: 'STF-003', name: 'Mr. Emmanuel T. Okonkwo', role: 'Finance Manager', department: 'Finance', grade: 'Grade B', basic_salary: 450000, housing: 112500, transport: 35000, other_allowances: 65000, gross_income: 662500, paye: 82500, pension_emp: 33125, pension_org: 33125, nhis: 6625, union_due: 3500, net_pay: 536750, bank: 'Zenith Bank', acct_no: '1122334455', start_date: '2019-03-10', status: 'active', tin: 'TIN-003-1122' },
  { id: 'STF-004', name: 'Miss Sarah A. Musa', role: 'Media Coordinator', department: 'Media', grade: 'Grade D', basic_salary: 180000, housing: 45000, transport: 15000, other_allowances: 25000, gross_income: 265000, paye: 26500, pension_emp: 13250, pension_org: 13250, nhis: 2650, union_due: 2000, net_pay: 220600, bank: 'UBA', acct_no: '5544332211', start_date: '2021-08-15', status: 'active', tin: 'TIN-004-3344' },
  { id: 'STF-005', name: 'Mr. David O. Ibrahim', role: 'Facility Manager', department: 'Operations', grade: 'Grade C', basic_salary: 220000, housing: 55000, transport: 18000, other_allowances: 32000, gross_income: 325000, paye: 32500, pension_emp: 16250, pension_org: 16250, nhis: 3250, union_due: 2200, net_pay: 270800, bank: 'Ecobank', acct_no: '6655443322', start_date: '2020-02-01', status: 'active', tin: 'TIN-005-5566' },
  { id: 'STF-006', name: 'Mrs. Funke B. Adebayo', role: 'Worship Leader', department: 'Worship', grade: 'Grade C', basic_salary: 280000, housing: 70000, transport: 22000, other_allowances: 40000, gross_income: 412000, paye: 51500, pension_emp: 20600, pension_org: 20600, nhis: 4120, union_due: 2800, net_pay: 333980, bank: 'Fidelity', acct_no: '7788990011', start_date: '2017-09-01', status: 'active', tin: 'TIN-006-7788' },
  { id: 'STF-007', name: 'Mr. Peter N. Okafor', role: 'Security Officer', department: 'Operations', grade: 'Grade E', basic_salary: 90000, housing: 22500, transport: 10000, other_allowances: 15000, gross_income: 137500, paye: 8250, pension_emp: 6875, pension_org: 6875, nhis: 1375, union_due: 1000, net_pay: 120000, bank: 'First Bank', acct_no: '8899001122', start_date: '2022-04-01', status: 'active', tin: 'TIN-007-9900' },
  { id: 'STF-008', name: 'Miss Ruth A. Okwu', role: 'Children Ministry', department: 'Ministry', grade: 'Grade D', basic_salary: 150000, housing: 37500, transport: 12000, other_allowances: 20000, gross_income: 219500, paye: 16462, pension_emp: 10975, pension_org: 10975, nhis: 2195, union_due: 1500, net_pay: 188368, bank: 'Sterling', acct_no: '9900112233', start_date: '2023-01-10', status: 'active', tin: 'TIN-008-1122' },
];

// Payroll summary
const payrollSummary = {
  month: 'May 2025',
  total_gross: 3734500,
  total_paye: 414712,
  total_pension_emp: 186725,
  total_pension_org: 186725,
  total_nhis: 37345,
  total_union: 18500,
  total_net: 2876198,
  staff_count: 8,
  avg_net: 359525,
};

// PAYE brackets (simplified Nigeria)
const payeBrackets = [
  { min: 0, max: 30000, rate: 1 },
  { min: 30000, max: 50000, rate: 11 },
  { min: 50000, max: 80000, rate: 15 },
  { min: 80000, max: 150000, rate: 19 },
  { min: 150000, max: 300000, rate: 21 },
  { min: 300000, max: 500000, rate: 24 },
  { min: 500000, max: 999999999, rate: 24 },
];

const PayrollModule: React.FC = () => {
  const [view, setView] = useState<'staff' | 'summary' | 'paye'>('staff');
  const [deptF, setDeptF] = useState('all');

  const filteredStaff = deptF === 'all' ? staff : staff.filter(s => s.department === deptF);
  const deptOptions = [...new Set(staff.map(s => s.department))];

  return (
    <div className="flex flex-col h-full overflow-hidden fs-slide">
      <div className="fs-toolbar px-5 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border fs-divider">
          {([
            ['staff', 'Staff Register'],
            ['summary', 'Payroll Summary'],
            ['paye', 'PAYE Schedule']
          ] as [typeof view, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 text-[11px] font-bold transition-all ${view === k ? 'text-black' : 'fs-text3 hover:fs-text2'}`}
              style={view === k ? { background: G } : {}}>
              {l}
            </button>
          ))}
        </div>
        {view === 'staff' && (
          <select value={deptF} onChange={e => setDeptF(e.target.value)} className="fs-input px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none">
            <option value="all">All Departments</option>
            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/50 text-emerald-400 text-[10px] font-bold hover:bg-emerald-900/20 transition-colors">
          <Icon name="person_add" size={11} />ADD STAFF
        </button>
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Total Gross', v: payrollSummary.total_gross, c: '#10b981', i: 'payments' },
          { l: 'Total PAYE', v: payrollSummary.total_paye, c: '#f59e0b', i: 'receipt_long' },
          { l: 'Total Net Pay', v: payrollSummary.total_net, c: '#3b82f6', i: 'account_balance_wallet' },
          { l: 'Staff Count', v: payrollSummary.staff_count, c: '#8b5cf6', i: 'people' }
        ].map(k => (
          <SCard key={k.l} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] fs-text3 uppercase font-bold tracking-widest">{k.l}</span>
              <Icon name={k.i} size={12} style={{ color: k.c }} />
            </div>
            <p className="text-lg font-black font-mono" style={{ color: k.c }}>
              {k.l === 'Staff Count' ? k.v : compact(k.v)}
            </p>
          </SCard>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
        {view === 'staff' && (
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
            <table className="w-full min-w-[950px] border-collapse">
              <thead className="sticky top-0 z-10 fs-thead">
                <tr>
                  {['STAFF', 'ROLE', 'DEPT', 'GRADE', 'BASIC', 'HOUSING', 'TRANSPORT', 'ALLOWANCES', 'GROSS', 'PAYE', 'PENSION', 'NHS', 'NET PAY', 'STATUS'].map(h => (
                    <th key={h} className="px-2 py-2 text-left">
                      <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s, i) => (
                  <tr key={s.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                    <td className="px-2 py-2.5">
                      <p className="text-xs font-bold fs-text1">{s.name}</p>
                      <p className="text-[9px] font-mono fs-text3">{s.tin}</p>
                    </td>
                    <td className="px-2 py-2.5"><span className="text-[10px] fs-text3">{s.role}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] fs-text3">{s.department}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] font-mono text-emerald-400">{s.grade}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] font-mono fs-text2">{ngn(s.basic_salary)}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] font-mono fs-text3">{ngn(s.housing)}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] font-mono fs-text3">{ngn(s.transport)}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] font-mono fs-text3">{ngn(s.other_allowances)}</span></td>
                    <td className="px-2 py-2.5"><span className="text-xs font-mono font-bold text-emerald-400">{ngn(s.gross_income)}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] font-mono text-amber-400">{ngn(s.paye)}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] font-mono text-red-400">{ngn(s.pension_emp)}</span></td>
                    <td className="px-2 py-2.5"><span className="text-[10px] font-mono text-red-400/80">{ngn(s.nhis)}</span></td>
                    <td className="px-2 py-2.5"><span className="text-xs font-mono font-bold text-blue-400">{ngn(s.net_pay)}</span></td>
                    <td className="px-2 py-2.5"><Pill label={s.status.toUpperCase()} color="#10b981" bg="rgba(16,185,129,0.12)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'summary' && (
          <div className="p-5 space-y-4">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Payroll Summary — {payrollSummary.month}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                {[
                  { l: 'Total Gross Income', v: payrollSummary.total_gross, c: '#10b981' },
                  { l: 'Total PAYE Deducted', v: payrollSummary.total_paye, c: '#f59e0b' },
                  { l: 'Total Pension (Employee)', v: payrollSummary.total_pension_emp, c: '#f87171' },
                  { l: 'Total Pension (Organization)', v: payrollSummary.total_pension_org, c: '#f87171' },
                  { l: 'Total NHIS', v: payrollSummary.total_nhis, c: '#64748b' },
                  { l: 'Total Union Dues', v: payrollSummary.total_union, c: '#64748b' },
                  { l: 'Total Net Pay', v: payrollSummary.total_net, c: '#3b82f6' },
                  { l: 'Average Net Pay', v: payrollSummary.avg_net, c: '#8b5cf6' },
                ].map(item => (
                  <div key={item.l} className="p-4 text-center">
                    <p className="text-[9px] fs-text3 uppercase tracking-widest mb-1">{item.l}</p>
                    <p className="text-xl font-black font-mono" style={{ color: item.c }}>{compact(item.v)}</p>
                  </div>
                ))}
              </div>
            </SCard>

            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Cost Analysis</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs fs-text3">Total Personnel Cost (Gross + Org Pension)</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">{compact(payrollSummary.total_gross + payrollSummary.total_pension_org)}</span>
                </div>
                <SBar v={parseFloat(pct(payrollSummary.total_gross, payrollSummary.total_gross + payrollSummary.total_pension_org))} color="#10b981" h={6} />
                <div className="flex gap-4 text-[10px]">
                  <span className="fs-text3">Gross: <span className="font-mono text-emerald-400">{pct(payrollSummary.total_gross, payrollSummary.total_gross + payrollSummary.total_pension_org)}%</span></span>
                  <span className="fs-text3">Org Pension: <span className="font-mono text-red-400">{pct(payrollSummary.total_pension_org, payrollSummary.total_gross + payrollSummary.total_pension_org)}%</span></span>
                </div>
              </div>
            </SCard>
          </div>
        )}

        {view === 'paye' && (
          <div className="p-5 space-y-4">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">PAYE (Pay-As-You-Earn) Brackets</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[500px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['MONTHLY INCOME (₦)', 'TAX RATE (%)', 'MONTHLY TAX (₦)'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payeBrackets.map((b, i) => (
                      <tr key={i} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-mono fs-text2">
                            {b.min === 0 ? '0' : ngn(b.min)} — {ngn(b.max)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><span className="text-xs font-mono text-amber-400">{b.rate}%</span></td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-mono text-emerald-400">
                            {b.rate === 1 ? '1% of taxable income' : `${b.rate}% of excess over ₦${b.min.toLocaleString()}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SCard>

            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Monthly PAYE Deduction by Staff</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[500px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['STAFF', 'GROSS INCOME', 'TAXABLE', 'PAYE RATE', 'MONTHLY PAYE'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.sort((a, b) => b.paye - a.paye).map((s, i) => (
                      <tr key={s.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-2.5"><span className="text-xs font-bold fs-text1">{s.name}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[11px] font-mono fs-text2">{ngn(s.gross_income)}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[11px] font-mono text-amber-400">{ngn(s.gross_income - 200000)}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[11px] font-mono fs-text3">{pct(s.paye, s.gross_income - 200000)}%</span></td>
                        <td className="px-4 py-2.5"><span className="text-xs font-mono font-bold text-amber-400">{ngn(s.paye)}</span></td>
                      </tr>
                    ))}
                    <tr className="fs-thead">
                      <td className="px-4 py-3 text-right"><span className="text-xs font-bold">TOTAL</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-mono font-bold text-emerald-400">{ngn(payrollSummary.total_gross)}</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-mono text-amber-400">—</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-mono">—</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-mono font-bold text-amber-400">{ngn(payrollSummary.total_paye)}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollModule;

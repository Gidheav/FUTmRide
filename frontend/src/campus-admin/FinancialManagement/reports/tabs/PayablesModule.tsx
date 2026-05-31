// ─────────────────────────────────────────────────────────────────────────────
// PayablesModule.tsx — Accounts Payable tab for FinancialReports
// Vendors, bills, aging schedule
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, memo } from 'react';
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

const BillStatusPill = memo(({ status }: { status: string }) => {
  const M: Record<string, { c: string; b: string }> = {
    draft: { c: '#64748b', b: 'rgba(100,116,139,0.15)' },
    pending: { c: '#60a5fa', b: 'rgba(96,165,250,0.15)' },
    approved: { c: '#a78bfa', b: 'rgba(167,139,250,0.15)' },
    paid: { c: '#10b981', b: 'rgba(16,185,129,0.15)' },
    overdue: { c: '#f87171', b: 'rgba(248,113,113,0.15)' },
    disputed: { c: '#34d399', b: 'rgba(251,191,36,0.15)' },
  };
  const meta = M[status] || { c: '#64748b', b: 'rgba(100,116,139,0.15)' };
  return <Pill label={status.toUpperCase()} color={meta.c} bg={meta.b} />;
});
BillStatusPill.displayName = 'BillStatusPill';

// Vendors data
const vendors = [
  { id: 'VND-001', name: 'TechPro Nigeria Ltd', email: 'accounts@techpro.ng', phone: '08012345678', bank: 'GTBank', account_no: '0123456789', bank_code: '058', category: 'Technology', terms: 30, balance_owed: 1110000, ytd_paid: 3840000, status: 'active', tax_id: '12345678-0001' },
  { id: 'VND-002', name: 'CleanSweep Services', email: 'billing@cleansweep.ng', phone: '08098765432', bank: 'Access Bank', account_no: '9876543210', bank_code: '044', category: 'Facilities', terms: 14, balance_owed: 0, ytd_paid: 480000, status: 'active', tax_id: '98765432-0002' },
  { id: 'VND-003', name: 'Stanbic IBTC Bank', email: 'loans@stanbic.com', phone: '01-2806000', bank: 'Stanbic IBTC', account_no: '0001112223', bank_code: '221', category: 'Financial', terms: 0, balance_owed: 15000000, ytd_paid: 900000, status: 'active', tax_id: 'RC-000234-FIN' },
  { id: 'VND-004', name: 'NEPA / IKEDC', email: 'billing@ikedc.com', phone: '0700-IKEDC-00', bank: 'First Bank', account_no: '2031900042', bank_code: '011', category: 'Utilities', terms: 30, balance_owed: 92000, ytd_paid: 1260000, status: 'active', tax_id: 'GOV-POWER-001' },
  { id: 'VND-005', name: 'Ola & Co. Chartered Accountants', email: 'audit@olaandco.ng', phone: '01-7654321', bank: 'Zenith Bank', account_no: '1122334455', bank_code: '057', category: 'Professional', terms: 30, balance_owed: 240000, ytd_paid: 580000, status: 'active', tax_id: 'ICAN-000892' },
  { id: 'VND-006', name: 'Gospel Print House', email: 'orders@gospelprint.ng', phone: '09011223344', bank: 'UBA', account_no: '5544332211', bank_code: '033', category: 'Printing', terms: 7, balance_owed: 45000, ytd_paid: 320000, status: 'active', tax_id: 'RC-088-PRINT' },
  { id: 'VND-007', name: 'Swift Couriers Nigeria', email: 'invoices@swiftng.com', phone: '08033219988', bank: 'Ecobank', account_no: '8877665544', bank_code: '050', category: 'Logistics', terms: 14, balance_owed: 0, ytd_paid: 124000, status: 'inactive', tax_id: 'RC-COURIER-88' },
  { id: 'VND-008', name: 'Arise FM / Radio', email: 'ads@arisefm.ng', phone: '01-8001234', bank: 'GTBank', account_no: '0099887766', bank_code: '058', category: 'Media', terms: 30, balance_owed: 312000, ytd_paid: 840000, status: 'active', tax_id: 'NBC-ARISE-2020' },
];

// Bills data
const bills = [
  { id: 'BILL-001', vendor_id: 'VND-001', vendor_name: 'TechPro Nigeria Ltd', reference: 'INV-TP-2025-089', description: 'LED Projector + Audio Mixer', amount: 1200000, due_date: '2025-02-14', issue_date: '2025-01-15', status: 'paid', category: 'Technology', vat: 90000, wht: 12000 },
  { id: 'BILL-002', vendor_id: 'VND-004', vendor_name: 'NEPA / IKEDC', reference: 'IKEDC-JAN-2025', description: 'January Electricity Bill', amount: 92000, due_date: '2025-02-05', issue_date: '2025-01-25', status: 'overdue', category: 'Utilities', vat: 0, wht: 0 },
  { id: 'BILL-003', vendor_id: 'VND-005', vendor_name: 'Ola & Co. Chartered Accountants', reference: 'OLA-2025-Q1-AUDIT', description: 'Q1 Audit & Compliance Review', amount: 240000, due_date: '2025-04-30', issue_date: '2025-04-01', status: 'approved', category: 'Professional', vat: 36000, wht: 12000 },
  { id: 'BILL-004', vendor_id: 'VND-003', vendor_name: 'Stanbic IBTC Bank', reference: 'LOAN-INT-MAY25', description: 'May Loan Interest Payment', amount: 75000, due_date: '2025-05-31', issue_date: '2025-05-01', status: 'paid', category: 'Finance', vat: 0, wht: 0 },
  { id: 'BILL-005', vendor_id: 'VND-008', vendor_name: 'Arise FM / Radio', reference: 'ARISEFM-ADV-2025', description: 'Q2 Radio Outreach Advertising', amount: 312000, due_date: '2025-06-15', issue_date: '2025-05-15', status: 'pending', category: 'Media', vat: 46800, wht: 15600 },
  { id: 'BILL-006', vendor_id: 'VND-002', vendor_name: 'CleanSweep Services', reference: 'CS-MAY-2025', description: 'May Cleaning & Sanitation', amount: 80000, due_date: '2025-05-31', issue_date: '2025-05-25', status: 'paid', category: 'Facilities', vat: 0, wht: 0 },
  { id: 'BILL-007', vendor_id: 'VND-006', vendor_name: 'Gospel Print House', reference: 'GPH-INV-0482', description: 'May Bulletins & Programs (2,000 copies)', amount: 45000, due_date: '2025-05-28', issue_date: '2025-05-20', status: 'pending', category: 'Printing', vat: 6750, wht: 2250 },
  { id: 'BILL-008', vendor_id: 'VND-001', vendor_name: 'TechPro Nigeria Ltd', reference: 'INV-TP-2025-142', description: 'Annual Software Licenses (Church Suite)', amount: 480000, due_date: '2025-07-01', issue_date: '2025-06-01', status: 'draft', category: 'Technology', vat: 72000, wht: 24000 },
];

const PayablesModule: React.FC = () => {
  const [view, setView] = useState<'bills' | 'vendors' | 'aging'>('bills');
  const [statusF, setStatusF] = useState('all');

  const filteredBills = statusF === 'all' ? bills : bills.filter(b => b.status === statusF);
  const now = new Date();

  const agingBuckets = {
    current: bills.filter(b => b.status !== 'paid' && new Date(b.due_date) >= now).reduce((s, b) => s + b.amount, 0),
    b31: bills.filter(b => b.status === 'overdue' && Math.floor((now.getTime() - new Date(b.due_date).getTime()) / 86400000) <= 30).reduce((s, b) => s + b.amount, 0),
    b61: bills.filter(b => b.status === 'overdue' && Math.floor((now.getTime() - new Date(b.due_date).getTime()) / 86400000) > 30 && Math.floor((now.getTime() - new Date(b.due_date).getTime()) / 86400000) <= 60).reduce((s, b) => s + b.amount, 0),
    b90: bills.filter(b => b.status === 'overdue' && Math.floor((now.getTime() - new Date(b.due_date).getTime()) / 86400000) > 60).reduce((s, b) => s + b.amount, 0),
  };
  const totalOwed = bills.filter(b => b.status !== 'paid' && b.status !== 'draft').reduce((s, b) => s + b.amount, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden fs-slide">
      <div className="fs-toolbar px-5 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border fs-divider">
          {([
            ['bills', 'Bills'],
            ['vendors', 'Vendors'],
            ['aging', 'Aging']
          ] as [typeof view, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 text-[11px] font-bold transition-all ${view === k ? 'text-black' : 'fs-text3 hover:fs-text2'}`}
              style={view === k ? { background: G } : {}}>
              {l}
            </button>
          ))}
        </div>
        {view === 'bills' && (
          <select value={statusF} onChange={e => setStatusF(e.target.value)} className="fs-input px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none">
            <option value="all">All Status</option>
            {['draft', 'pending', 'approved', 'paid', 'overdue', 'disputed'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        )}
        <span className="ml-auto text-[10px] fs-text3">Total Payable: <span className="text-emerald-400 font-mono font-bold">{ngn(totalOwed)}</span></span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
        {view === 'bills' && (
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
            <table className="w-full min-w-[800px] border-collapse">
              <thead className="sticky top-0 z-10 fs-thead">
                <tr>
                  {['REF', 'VENDOR', 'DESCRIPTION', 'AMOUNT', 'DUE DATE', 'VAT', 'WHT', 'STATUS', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left">
                      <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((b, i) => {
                  const days = Math.floor((now.getTime() - new Date(b.due_date).getTime()) / 86400000);
                  return (
                    <tr key={b.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                      <td className="px-4 py-2.5"><span className="text-[10px] font-mono text-emerald-400">{b.reference}</span></td>
                      <td className="px-4 py-2.5"><span className="text-xs fs-text2 truncate max-w-[120px] block">{b.vendor_name}</span></td>
                      <td className="px-4 py-2.5"><span className="text-[11px] fs-text2 truncate max-w-[180px] block">{b.description}</span></td>
                      <td className="px-4 py-2.5"><span className="text-sm font-mono font-bold fs-text1">{ngn(b.amount)}</span></td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-mono ${b.status === 'overdue' ? 'text-red-400' : 'fs-text3'}`}>
                          {fmtShort(b.due_date)}
                          {b.status === 'overdue' && <span className="text-red-500 ml-1">(+{days}d)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><span className="text-[10px] font-mono fs-text3">{b.vat > 0 ? ngn(b.vat) : '—'}</span></td>
                      <td className="px-4 py-2.5"><span className="text-[10px] font-mono fs-text3">{b.wht > 0 ? ngn(b.wht) : '—'}</span></td>
                      <td className="px-4 py-2.5"><BillStatusPill status={b.status} /></td>
                      <td className="px-4 py-2.5"><button className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono">VIEW</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === 'vendors' && (
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
            <table className="w-full min-w-[700px] border-collapse">
              <thead className="sticky top-0 z-10 fs-thead">
                <tr>
                  {['VENDOR', 'EMAIL', 'CATEGORY', 'TERMS', 'BALANCE OWED', 'YTD PAID', 'STATUS'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left">
                      <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, i) => (
                  <tr key={v.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold fs-text1">{v.name}</p>
                      <p className="text-[10px] font-mono fs-text3">{v.tax_id}</p>
                    </td>
                    <td className="px-4 py-3"><span className="text-[10px] fs-text3">{v.email}</span></td>
                    <td className="px-4 py-3"><span className="text-[10px] fs-text3">{v.category}</span></td>
                    <td className="px-4 py-3"><span className="text-[10px] font-mono fs-text2">Net {v.terms}d</span></td>
                    <td className="px-4 py-3"><span className={`text-xs font-mono font-bold ${v.balance_owed > 0 ? 'text-red-400' : 'fs-text3'}`}>{v.balance_owed > 0 ? ngn(v.balance_owed) : 'Nil'}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-emerald-400">{ngn(v.ytd_paid)}</span></td>
                    <td className="px-4 py-3"><Pill label={v.status.toUpperCase()} color={v.status === 'active' ? '#10b981' : '#64748b'} bg={v.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'aging' && (
          <div className="p-5 space-y-4">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Accounts Payable Aging Analysis</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-slate-800">
                {[
                  { label: 'Current (not yet due)', amount: agingBuckets.current, color: '#10b981' },
                  { label: '1–30 Days Overdue', amount: agingBuckets.b31, color: '#10b981' },
                  { label: '31–60 Days Overdue', amount: agingBuckets.b61, color: '#fb923c' },
                  { label: '60+ Days Overdue', amount: agingBuckets.b90, color: '#f87171' },
                ].map(b => (
                  <div key={b.label} className="p-5 text-center">
                    <p className="text-[9px] fs-text3 uppercase tracking-widest mb-2">{b.label}</p>
                    <p className="text-2xl font-black font-mono" style={{ color: b.color }}>{compact(b.amount)}</p>
                    <p className="text-[10px] fs-text3 mt-1">{pct(b.amount, totalOwed || 1)}% of total</p>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-slate-800 flex justify-between" style={{ background: 'rgba(16,185,129,0.04)' }}>
                <span className="text-xs font-bold fs-text2">TOTAL OUTSTANDING</span>
                <span className="text-sm font-black font-mono text-emerald-300">{ngn(totalOwed)}</span>
              </div>
            </SCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayablesModule;

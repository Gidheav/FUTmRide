// ─────────────────────────────────────────────────────────────────────────────
// LedgerModule.tsx — General Ledger tab for FinancialReports
// Full implementation based on FinancialSanctum
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, memo } from 'react';
import Icon from '../../../../components/common/Icon';

const G = '#10b981';

interface Account {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  subtype: string;
  balance: number;
  normal: 'debit' | 'credit';
  description: string;
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  narration: string;
  lines: { account_code: string; account_name: string; debit: number; credit: number }[];
  posted: boolean;
  approved_by: string;
  created_by: string;
  total: number;
}

const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: decimals }).format(n);

const fmtD = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const compact = (n: number): string => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return ngn(n);
};
const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';
const abs = Math.abs;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Chart of Accounts
const CHART_OF_ACCOUNTS: Account[] = [
  { code: '1000', name: 'Cash & Bank — GTBank', type: 'asset', subtype: 'Current Asset', balance: 8420000, normal: 'debit', description: 'Primary operating account' },
  { code: '1010', name: 'Cash & Bank — Zenith', type: 'asset', subtype: 'Current Asset', balance: 3150000, normal: 'debit', description: 'Secondary operating account' },
  { code: '1020', name: 'Petty Cash', type: 'asset', subtype: 'Current Asset', balance: 125000, normal: 'debit', description: 'Office petty cash float' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'Current Asset', balance: 2280000, normal: 'debit', description: 'Amounts owed to ministry' },
  { code: '1200', name: 'Prepaid Expenses', type: 'asset', subtype: 'Current Asset', balance: 640000, normal: 'debit', description: 'Advance payments' },
  { code: '1300', name: 'Inventory — Merchandise', type: 'asset', subtype: 'Current Asset', balance: 380000, normal: 'debit', description: 'Books, CDs, merchandise' },
  { code: '1500', name: 'Land & Building', type: 'asset', subtype: 'Fixed Asset', balance: 85000000, normal: 'debit', description: 'Church property at Plot 42' },
  { code: '1510', name: 'Acc. Depr — Building', type: 'asset', subtype: 'Contra Asset', balance: -4250000, normal: 'credit', description: 'Accumulated depreciation on building' },
  { code: '1520', name: 'Equipment & Furniture', type: 'asset', subtype: 'Fixed Asset', balance: 9800000, normal: 'debit', description: 'AV, office, musical equipment' },
  { code: '1530', name: 'Acc. Depr — Equipment', type: 'asset', subtype: 'Contra Asset', balance: -3920000, normal: 'credit', description: 'Accumulated depreciation on equipment' },
  { code: '1540', name: 'Motor Vehicles', type: 'asset', subtype: 'Fixed Asset', balance: 12500000, normal: 'debit', description: 'Ministry vehicles (3)' },
  { code: '1550', name: 'Acc. Depr — Vehicles', type: 'asset', subtype: 'Contra Asset', balance: -5000000, normal: 'credit', description: 'Accumulated depreciation on vehicles' },
  { code: '1600', name: 'Investments — FGN Bonds', type: 'asset', subtype: 'Long-term Investment', balance: 25000000, normal: 'debit', description: 'FGN savings bonds portfolio' },
  { code: '1610', name: 'Investments — T-Bills', type: 'asset', subtype: 'Short-term Investment', balance: 10000000, normal: 'debit', description: 'Treasury bills (90-day rolling)' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'Current Liability', balance: 1840000, normal: 'credit', description: 'Outstanding vendor bills' },
  { code: '2100', name: 'Accrued Expenses', type: 'liability', subtype: 'Current Liability', balance: 920000, normal: 'credit', description: 'Accrued but unpaid expenses' },
  { code: '2200', name: 'VAT Payable', type: 'liability', subtype: 'Current Liability', balance: 214000, normal: 'credit', description: 'Output VAT collected, net of input' },
  { code: '2210', name: 'WHT Payable', type: 'liability', subtype: 'Current Liability', balance: 87000, normal: 'credit', description: 'Withholding tax deducted at source' },
  { code: '2300', name: 'PAYE Payable', type: 'liability', subtype: 'Current Liability', balance: 340000, normal: 'credit', description: 'Staff PAYE due to FIRS' },
  { code: '2310', name: 'Pension Payable', type: 'liability', subtype: 'Current Liability', balance: 280000, normal: 'credit', description: 'Staff & employer pension contributions' },
  { code: '2400', name: 'Deferred Revenue', type: 'liability', subtype: 'Current Liability', balance: 1200000, normal: 'credit', description: 'Unearned program fees' },
  { code: '2500', name: 'Long-term Loan', type: 'liability', subtype: 'Long-term Liability', balance: 15000000, normal: 'credit', description: 'Building renovation loan (Bank)' },
  { code: '3000', name: 'General Fund Balance', type: 'equity', subtype: 'Unrestricted Net Assets', balance: 42000000, normal: 'credit', description: 'Unrestricted accumulated surplus' },
  { code: '3100', name: 'Building Fund', type: 'equity', subtype: 'Restricted Net Assets', balance: 8660000, normal: 'credit', description: 'Designated for new sanctuary' },
  { code: '3200', name: 'Missions Fund', type: 'equity', subtype: 'Restricted Net Assets', balance: 1650000, normal: 'credit', description: 'Missionary support — Kenya' },
  { code: '3300', name: 'Endowment Fund', type: 'equity', subtype: 'Permanently Restricted', balance: 30000000, normal: 'credit', description: 'Permanent endowment corpus' },
  { code: '4000', name: 'Tithes & Offerings', type: 'revenue', subtype: 'Ministry Revenue', balance: 38420000, normal: 'credit', description: 'Regular giving receipts' },
  { code: '4100', name: 'Project Offerings', type: 'revenue', subtype: 'Project Revenue', balance: 12850000, normal: 'credit', description: 'Special project giving' },
  { code: '4200', name: 'Fundraising Revenue', type: 'revenue', subtype: 'Special Revenue', balance: 6740000, normal: 'credit', description: 'Events & fundraising proceeds' },
  { code: '4300', name: 'Program Fees', type: 'revenue', subtype: 'Service Revenue', balance: 2180000, normal: 'credit', description: 'Youth, music, language programs' },
  { code: '4400', name: 'Investment Income', type: 'revenue', subtype: 'Other Revenue', balance: 3250000, normal: 'credit', description: 'Bond interest + T-bill yields' },
  { code: '4500', name: 'Rental Income', type: 'revenue', subtype: 'Other Revenue', balance: 840000, normal: 'credit', description: 'Hall & facility rentals' },
  { code: '4600', name: 'Merchandise Sales', type: 'revenue', subtype: 'Other Revenue', balance: 420000, normal: 'credit', description: 'Books, CDs, branded merchandise' },
  { code: '5000', name: 'Pastoral Salaries', type: 'expense', subtype: 'Personnel', balance: 18600000, normal: 'debit', description: 'Lead & associate pastor compensation' },
  { code: '5010', name: 'Staff Salaries', type: 'expense', subtype: 'Personnel', balance: 9840000, normal: 'debit', description: 'Administrative & support staff' },
  { code: '5020', name: 'Pension — Employer', type: 'expense', subtype: 'Personnel', balance: 1428000, normal: 'debit', description: '10% employer pension contribution' },
  { code: '5030', name: 'Staff Benefits', type: 'expense', subtype: 'Personnel', balance: 840000, normal: 'debit', description: 'HMO, transport, housing allowances' },
  { code: '5100', name: 'Building & Maintenance', type: 'expense', subtype: 'Operations', balance: 4820000, normal: 'debit', description: 'Repairs, upkeep, utilities' },
  { code: '5110', name: 'Utilities', type: 'expense', subtype: 'Operations', balance: 1840000, normal: 'debit', description: 'Electricity, water, internet' },
  { code: '5200', name: 'Media & Technology', type: 'expense', subtype: 'Ministry', balance: 3180000, normal: 'debit', description: 'Streaming, equipment, software' },
  { code: '5210', name: 'Printing & Stationery', type: 'expense', subtype: 'Operations', balance: 640000, normal: 'debit', description: 'Bulletins, admin forms' },
  { code: '5300', name: 'Mission & Outreach', type: 'expense', subtype: 'Ministry', balance: 4200000, normal: 'debit', description: 'Evangelism, missions giving' },
  { code: '5400', name: 'Youth & Programs', type: 'expense', subtype: 'Ministry', balance: 2840000, normal: 'debit', description: 'Youth ministry operating costs' },
  { code: '5500', name: 'Travel & Transport', type: 'expense', subtype: 'Operations', balance: 1240000, normal: 'debit', description: 'Ministry travel, vehicle running costs' },
  { code: '5600', name: 'Professional Fees', type: 'expense', subtype: 'Administration', balance: 580000, normal: 'debit', description: 'Audit, legal, consulting fees' },
  { code: '5700', name: 'Bank Charges', type: 'expense', subtype: 'Finance', balance: 124000, normal: 'debit', description: 'Transaction fees, transfer charges' },
  { code: '5710', name: 'Interest Expense', type: 'expense', subtype: 'Finance', balance: 900000, normal: 'debit', description: 'Loan interest payments' },
  { code: '5800', name: 'Depreciation', type: 'expense', subtype: 'Non-cash', balance: 2380000, normal: 'debit', description: 'Annual depreciation charge' },
  { code: '5900', name: 'Benevolence & Welfare', type: 'expense', subtype: 'Ministry', balance: 1680000, normal: 'debit', description: 'Congregant welfare payments' },
];

const JOURNAL_ENTRIES: JournalEntry[] = [
  { id: 'JNL-001', date: '2025-01-05', reference: 'JNL-2025-001', description: 'January Tithes & Offerings', narration: 'Recording of weekly offering collection deposited to GTBank', lines: [{ account_code: '1000', account_name: 'Cash & Bank — GTBank', debit: 3240000, credit: 0 }, { account_code: '4000', account_name: 'Tithes & Offerings', debit: 0, credit: 3240000 }], posted: true, approved_by: 'Elder James', created_by: 'Accountant Mary', total: 3240000 },
  { id: 'JNL-002', date: '2025-01-10', reference: 'JNL-2025-002', description: 'Pastoral Salary Payment — January', narration: 'Net salary disbursement after PAYE and pension deductions', lines: [{ account_code: '5000', account_name: 'Pastoral Salaries', debit: 2100000, credit: 0 }, { account_code: '2300', account_name: 'PAYE Payable', debit: 0, credit: 280000 }, { account_code: '2310', account_name: 'Pension Payable', debit: 0, credit: 210000 }, { account_code: '1000', account_name: 'Cash & Bank — GTBank', debit: 0, credit: 1610000 }], posted: true, approved_by: 'Senior Pastor', created_by: 'Accountant Mary', total: 2100000 },
  { id: 'JNL-003', date: '2025-01-15', reference: 'JNL-2025-003', description: 'Media Equipment Purchase', narration: 'Purchase of LED projector and audio mixer from TechPro Nig Ltd', lines: [{ account_code: '1520', account_name: 'Equipment & Furniture', debit: 1200000, credit: 0 }, { account_code: '2200', account_name: 'VAT Payable', debit: 0, credit: 90000 }, { account_code: '2000', account_name: 'Accounts Payable', debit: 0, credit: 1110000 }], posted: true, approved_by: 'Elder James', created_by: 'Accountant Mary', total: 1200000 },
  { id: 'JNL-004', date: '2025-02-01', reference: 'JNL-2025-004', description: 'Building Fund Offering Transfer', narration: 'Special building offering received and allocated to Building Fund', lines: [{ account_code: '1000', account_name: 'Cash & Bank — GTBank', debit: 800000, credit: 0 }, { account_code: '3100', account_name: 'Building Fund', debit: 0, credit: 800000 }], posted: true, approved_by: 'Board Chair', created_by: 'Accountant Mary', total: 800000 },
  { id: 'JNL-005', date: '2025-02-14', reference: 'JNL-2025-005', description: 'T-Bill Investment', narration: 'Purchase of 90-day Treasury Bills via Zenith Bank capital markets desk', lines: [{ account_code: '1610', account_name: 'Investments — T-Bills', debit: 5000000, credit: 0 }, { account_code: '1010', account_name: 'Cash & Bank — Zenith', debit: 0, credit: 5000000 }], posted: true, approved_by: 'Board Finance', created_by: 'Treasurer', total: 5000000 },
  { id: 'JNL-006', date: '2025-03-01', reference: 'JNL-2025-006', description: 'Missions Giving — Kenya', narration: 'Quarterly remittance to Nairobi missions partner', lines: [{ account_code: '5300', account_name: 'Mission & Outreach', debit: 600000, credit: 0 }, { account_code: '1000', account_name: 'Cash & Bank — GTBank', debit: 0, credit: 600000 }], posted: true, approved_by: 'Elder James', created_by: 'Accountant Mary', total: 600000 },
  { id: 'JNL-007', date: '2025-03-15', reference: 'JNL-2025-007', description: 'Depreciation — Q1 Charge', narration: 'Quarterly depreciation on building, equipment and vehicles', lines: [{ account_code: '5800', account_name: 'Depreciation', debit: 595000, credit: 0 }, { account_code: '1510', account_name: 'Acc. Depr — Building', debit: 0, credit: 212500 }, { account_code: '1530', account_name: 'Acc. Depr — Equipment', debit: 0, credit: 245000 }, { account_code: '1550', account_name: 'Acc. Depr — Vehicles', debit: 0, credit: 137500 }], posted: true, approved_by: 'Accountant Mary', created_by: 'Accountant Mary', total: 595000 },
  { id: 'JNL-008', date: '2025-04-05', reference: 'JNL-2025-008', description: 'Easter Convention Revenue', narration: 'Convention registration fees and special offerings received', lines: [{ account_code: '1000', account_name: 'Cash & Bank — GTBank', debit: 2840000, credit: 0 }, { account_code: '4200', account_name: 'Fundraising Revenue', debit: 0, credit: 2840000 }], posted: true, approved_by: 'Board Chair', created_by: 'Treasurer', total: 2840000 },
  { id: 'JNL-009', date: '2025-04-20', reference: 'JNL-2025-009', description: 'Loan Interest Payment', narration: 'Monthly interest on building renovation loan — Stanbic Bank', lines: [{ account_code: '5710', account_name: 'Interest Expense', debit: 75000, credit: 0 }, { account_code: '1000', account_name: 'Cash & Bank — GTBank', debit: 0, credit: 75000 }], posted: true, approved_by: 'Elder James', created_by: 'Accountant Mary', total: 75000 },
  { id: 'JNL-010', date: '2025-05-01', reference: 'JNL-2025-010', description: 'PAYE Remittance — April', narration: 'PAYE deducted from staff salaries remitted to FIRS', lines: [{ account_code: '2300', account_name: 'PAYE Payable', debit: 340000, credit: 0 }, { account_code: '1000', account_name: 'Cash & Bank — GTBank', debit: 0, credit: 340000 }], posted: true, approved_by: 'Accountant Mary', created_by: 'Accountant Mary', total: 340000 },
  { id: 'JNL-011', date: '2025-05-10', reference: 'JNL-2025-011', description: 'Investment Income — Bond Interest', narration: 'Semi-annual coupon received on FGN Bond portfolio', lines: [{ account_code: '1000', account_name: 'Cash & Bank — GTBank', debit: 1125000, credit: 0 }, { account_code: '4400', account_name: 'Investment Income', debit: 0, credit: 1125000 }], posted: true, approved_by: 'Board Finance', created_by: 'Treasurer', total: 1125000 },
  { id: 'JNL-012', date: '2025-06-01', reference: 'JNL-2025-012', description: 'Accrual — June Utilities', narration: 'Accrual for June electricity and internet bills (not yet invoiced)', lines: [{ account_code: '5110', account_name: 'Utilities', debit: 180000, credit: 0 }, { account_code: '2100', account_name: 'Accrued Expenses', debit: 0, credit: 180000 }], posted: false, approved_by: '', created_by: 'Accountant Mary', total: 180000 },
];

const SCard = memo(({ children, className = '', gold = false, highlight = false, style = {} }: {
  children: React.ReactNode;
  className?: string;
  gold?: boolean;
  highlight?: boolean;
  style?: React.CSSProperties;
}) => {
  const isHl = highlight || gold;
  return (
    <div className={`fs-card relative overflow-hidden ${className}`}
      style={{
        boxShadow: isHl 
          ? '0 0 0 1px rgba(16,185,129,0.22), 0 4px 24px rgba(16,185,129,0.09)'
          : 'var(--card-shadow, 0 1px 3px rgba(0,0,0,0.1))',
        ...style
      }}>
      {isHl && <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,#10b98160,transparent)' }} />}
      {children}
    </div>
  );
});
SCard.displayName = 'SCard';

const Pill = memo(({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
    style={{ color, background: bg, border: `1px solid ${color}33` }}>
    {label}
  </span>
));
Pill.displayName = 'Pill';

const AccountTypeBadge = memo(({ type }: { type: Account['type'] }) => {
  const M = {
    asset: { c: '#10b981', b: 'rgba(16,185,129,0.12)' },
    liability: { c: '#f87171', b: 'rgba(248,113,113,0.12)' },
    equity: { c: '#a78bfa', b: 'rgba(167,139,250,0.12)' },
    revenue: { c: '#34d399', b: 'rgba(251,191,36,0.12)' },
    expense: { c: '#fb923c', b: 'rgba(251,146,60,0.12)' },
  };
  return <Pill label={type} color={M[type].c} bg={M[type].b} />;
});
AccountTypeBadge.displayName = 'AccountTypeBadge';

const LedgerModule: React.FC = () => {
  const [view, setView] = useState<'coa' | 'journal' | 'trial'>('coa');
  const [search, setSearch] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const coa = useMemo(() => {
    let list = CHART_OF_ACCOUNTS;
    if (typeF !== 'all') list = list.filter(a => a.type === typeF);
    if (search) list = list.filter(a => a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [typeF, search]);

  const trialBalance = useMemo(() => {
    const debits = CHART_OF_ACCOUNTS.filter(a => a.balance > 0 && a.normal === 'debit').reduce((s, a) => s + a.balance, 0);
    const credits = CHART_OF_ACCOUNTS.filter(a => a.balance > 0 && a.normal === 'credit').reduce((s, a) => s + a.balance, 0);
    const negDebs = CHART_OF_ACCOUNTS.filter(a => a.balance < 0 && a.normal === 'debit').reduce((s, a) => s + a.balance, 0);
    const negCreds = CHART_OF_ACCOUNTS.filter(a => a.balance < 0 && a.normal === 'credit').reduce((s, a) => s + a.balance, 0);
    return { debits: debits + abs(negCreds), credits: credits + abs(negDebs) };
  }, []);

  const jnlSearch = search.toLowerCase();
  const journals = JOURNAL_ENTRIES.filter(j =>
    !search || j.reference.toLowerCase().includes(jnlSearch) || j.description.toLowerCase().includes(jnlSearch)
  );

  const totalsByType = useMemo(() => {
    const out: Record<string, number> = {};
    CHART_OF_ACCOUNTS.forEach(a => { out[a.type] = (out[a.type] || 0) + a.balance; });
    return out;
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden fs-slide">
      {/* Toolbar */}
      <div className="fs-toolbar px-5 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border fs-divider">
          {([
            ['coa', 'Chart of Accounts'],
            ['journal', 'Journal Entries'],
            ['trial', 'Trial Balance']
          ] as [typeof view, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 text-[11px] font-bold transition-all ${view === k ? 'text-black' : 'fs-text3 hover:fs-text2'}`}
              style={view === k ? { background: G } : {}}>
              {l}
            </button>
          ))}
        </div>
        {view !== 'trial' && (
          <div className="relative">
            <Icon name="search" size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 fs-text3" />
            <input type="text" placeholder={view === 'coa' ? 'Code or name…' : 'Ref or description…'} value={search} onChange={e => setSearch(e.target.value)}
              className="fs-input w-44 pl-8 pr-3 py-1.5 rounded-lg text-[11px] focus:outline-none" />
          </div>
        )}
        {view === 'coa' && (
          <select value={typeF} onChange={e => setTypeF(e.target.value)} className="fs-input px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none">
            <option value="all">All Types</option>
            {['asset', 'liability', 'equity', 'revenue', 'expense'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        )}
        <span className="ml-auto text-[10px] fs-text3">{view === 'coa' ? `${coa.length} accounts` : view === 'journal' ? `${journals.length} entries` : ''}</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
        {/* CHART OF ACCOUNTS */}
        {view === 'coa' && (
          <div>
            {/* Type summaries */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-4 fs-divider">
              {[
                ['asset', '#10b981'],
                ['liability', '#f87171'],
                ['equity', '#a78bfa'],
                ['revenue', '#10b981'],
                ['expense', '#fb923c']
              ].map(([t, c]) => (
                <div key={t} onClick={() => setTypeF(typeF === t ? 'all' : t)} className="p-2.5 rounded-lg cursor-pointer transition-all fs-card" style={{ border: `1px solid ${typeF === t ? c + '40' : 'var(--fh-border2,#e2e8f0)'}` }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: c }}>{t}</p>
                  <p className="text-base font-black mt-1 font-mono" style={{ color: c }}>{compact(abs(totalsByType[t] || 0))}</p>
                </div>
              ))}
            </div>
            <table className="w-full min-w-[700px] border-collapse">
              <thead className="sticky top-0 z-10 fs-thead">
                <tr>
                  {['CODE', 'ACCOUNT NAME', 'TYPE', 'SUBTYPE', 'NORMAL BAL.', 'BALANCE (₦)', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left"><span className="text-[9px] font-bold fs-text3 uppercase tracking-widest">{h}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coa.map((a, i) => (
                  <React.Fragment key={a.code}>
                    <tr className={`border-b border-opacity-30 cursor-pointer transition-colors ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'} ${expanded === a.code ? 'border-emerald-900/30' : 'fs-hover'}`}
                      onClick={() => setExpanded(expanded === a.code ? null : a.code)}>
                      <td className="px-4 py-2.5"><span className="text-[11px] font-mono font-bold" style={{ color: G }}>{a.code}</span></td>
                      <td className="px-4 py-2.5"><span className="text-xs font-sans fs-text2">{a.name}</span></td>
                      <td className="px-4 py-2.5"><AccountTypeBadge type={a.type} /></td>
                      <td className="px-4 py-2.5"><span className="text-[10px] fs-text3">{a.subtype}</span></td>
                      <td className="px-4 py-2.5"><span className={`text-[10px] font-mono font-bold uppercase ${a.normal === 'debit' ? 'text-blue-400' : 'text-emerald-400'}`}>{a.normal}</span></td>
                      <td className="px-4 py-2.5">
                        <span className={`text-sm font-mono font-black ${a.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {a.balance < 0 ? `(${ngn(abs(a.balance))})` : `${ngn(a.balance)}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><Icon name={expanded === a.code ? 'expand_less' : 'expand_more'} size={14} className="fs-text3" /></td>
                    </tr>
                    {expanded === a.code && (
                      <tr className="border-b border-emerald-900/20">
                        <td colSpan={7} className="px-6 py-3" style={{ background: 'rgba(16,185,129,0.04)' }}>
                          <div className="flex items-start gap-6">
                            <div><p className="text-[9px] fs-text3 uppercase tracking-widest mb-1">Description</p><p className="text-xs fs-text2">{a.description}</p></div>
                            <div><p className="text-[9px] fs-text3 uppercase tracking-widest mb-1">Account Code</p><p className="text-xs font-mono text-emerald-400">{a.code}</p></div>
                            <div><p className="text-[9px] fs-text3 uppercase tracking-widest mb-1">Classification</p><p className="text-xs font-mono fs-text2">{a.type} / {a.subtype}</p></div>
                            {(a.type === 'expense' || a.type === 'revenue') && (
                              <div><p className="text-[9px] fs-text3 uppercase tracking-widest mb-1">YTD Activity</p><p className="text-xs font-mono text-emerald-400">{ngn(abs(a.balance))}</p></div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* JOURNAL ENTRIES */}
        {view === 'journal' && (
          <div className="p-4 space-y-3">
            {journals.map(jnl => (
              <SCard key={jnl.id} className="overflow-hidden" gold={!jnl.posted}>
                <div className="h-px w-full" style={{ background: jnl.posted ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.4)' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold" style={{ color: G }}>{jnl.reference}</span>
                        <Pill label={jnl.posted ? 'POSTED' : 'DRAFT'} color="#10b981" bg={jnl.posted ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.12)'} />
                      </div>
                      <p className="text-sm font-bold fs-text1 mt-1">{jnl.description}</p>
                      <p className="text-[10px] fs-text3 mt-0.5">{fmtD(jnl.date)} · By {jnl.created_by}{jnl.approved_by && ` · Approved: ${jnl.approved_by}`}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-mono font-black fs-green">{ngn(jnl.total)}</p>
                      <p className="text-[9px] fs-text3">{jnl.lines.length} lines</p>
                    </div>
                  </div>
                  <p className="text-[10px] fs-text3 mb-3 italic">{jnl.narration}</p>
                  {/* Debit/Credit lines */}
                  <div className="fs-card rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[80px_1fr_120px_120px] gap-0 px-3 py-1.5 fs-thead">
                      {['ACCT', 'ACCOUNT', 'DEBIT (₦)', 'CREDIT (₦)'].map(h => <span key={h} className="text-[9px] font-bold fs-text3 uppercase tracking-widest">{h}</span>)}
                    </div>
                    {jnl.lines.map((l, li) => (
                      <div key={li} className={`grid grid-cols-[80px_1fr_120px_120px] gap-0 px-3 py-2 fs-divider ${li % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <span className="text-[10px] font-mono" style={{ color: G }}>{l.account_code}</span>
                        <span className="text-[11px] fs-text2 truncate pr-2">{l.account_name}</span>
                        <span className="text-[11px] font-mono font-bold text-blue-400 text-right">{l.debit > 0 ? ngn(l.debit) : '—'}</span>
                        <span className="text-[11px] font-mono font-bold text-emerald-400 text-right">{l.credit > 0 ? ngn(l.credit) : '—'}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-[80px_1fr_120px_120px] gap-0 px-3 py-2 fs-divider" style={{ background: 'rgba(30,41,59,0.6)' }}>
                      <span /><span className="text-[9px] font-bold fs-text3 uppercase">TOTALS</span>
                      <span className="text-xs font-mono font-black text-blue-300 text-right">{ngn(jnl.lines.reduce((s, l) => s + l.debit, 0))}</span>
                      <span className="text-xs font-mono font-black text-emerald-300 text-right">{ngn(jnl.lines.reduce((s, l) => s + l.credit, 0))}</span>
                    </div>
                  </div>
                </div>
              </SCard>
            ))}
          </div>
        )}

        {/* TRIAL BALANCE */}
        {view === 'trial' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold fs-text1">Trial Balance</h3>
                <p className="text-[10px] fs-text3">As at {fmtD(new Date().toISOString())} · {CHART_OF_ACCOUNTS.length} accounts</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill label={trialBalance.debits === trialBalance.credits ? 'BALANCED' : 'UNBALANCED'} color={trialBalance.debits === trialBalance.credits ? '#10b981' : '#f87171'} bg={trialBalance.debits === trialBalance.credits ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)'} />
              </div>
            </div>
            <div className="fs-card rounded-xl overflow-hidden">
              <div className="grid grid-cols-[100px_1fr_160px_160px] gap-0 px-4 py-2.5 fs-thead">
                {['CODE', 'ACCOUNT NAME', 'DEBIT (₦)', 'CREDIT (₦)'].map(h => <span key={h} className="text-[9px] font-bold fs-text3 uppercase tracking-widest">{h}</span>)}
              </div>
              {CHART_OF_ACCOUNTS.map((a, i) => {
                const isDebit = (a.normal === 'debit' && a.balance > 0) || (a.normal === 'credit' && a.balance < 0);
                const isCredit = (a.normal === 'credit' && a.balance > 0) || (a.normal === 'debit' && a.balance < 0);
                return (
                  <div key={a.code} className={`grid grid-cols-[100px_1fr_160px_160px] gap-0 px-4 py-2 fs-divider ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                    <span className="text-[10px] font-mono text-emerald-400">{a.code}</span>
                    <span className="text-[11px] fs-text2 pr-4 truncate">{a.name}</span>
                    <span className="text-[11px] font-mono text-blue-400 text-right pr-4">{isDebit ? ngn(abs(a.balance)) : ''}</span>
                    <span className="text-[11px] font-mono text-emerald-400 text-right">{isCredit ? ngn(abs(a.balance)) : ''}</span>
                  </div>
                );
              })}
              {/* Totals */}
              <div className="grid grid-cols-[100px_1fr_160px_160px] gap-0 px-4 py-3 fs-divider" style={{ background: 'rgba(16,185,129,0.06)', borderTopWidth: 2, borderTopColor: 'rgba(16,185,129,0.4)' }}>
                <span /><span className="text-xs font-black fs-text2 uppercase tracking-widest">GRAND TOTALS</span>
                <span className="text-sm font-black text-blue-300 text-right pr-4">{ngn(trialBalance.debits)}</span>
                <span className="text-sm font-black text-emerald-300 text-right">{ngn(trialBalance.credits)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LedgerModule;

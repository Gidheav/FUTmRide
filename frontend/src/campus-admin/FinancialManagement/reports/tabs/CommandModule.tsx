// ─────────────────────────────────────────────────────────────────────────────
// CommandModule.tsx — Command Center tab for FinancialReports
// Full implementation based on FinancialSanctum
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, memo } from 'react';
import Icon from '../../../../components/common/Icon';

// Design tokens
const G = '#10b981';
const G2 = '#34d399';
const G3 = '#064e3b';

// Types
interface Account {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  subtype: string;
  balance: number;
  normal: 'debit' | 'credit';
  description: string;
}

interface Bill {
  id: string;
  vendor_id: string;
  vendor_name: string;
  reference: string;
  description: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue' | 'disputed';
  category: string;
  vat: number;
  wht: number;
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

// Formatters
const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: decimals }).format(n);

const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';
const fmtD = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const num = (n: number) => n.toLocaleString('en-NG');
const abs = Math.abs;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const compact = (n: number): string => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return ngn(n);
};

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

// Bills
const BILLS: Bill[] = [
  { id: 'BILL-001', vendor_id: 'VND-001', vendor_name: 'TechPro Nigeria Ltd', reference: 'INV-TP-2025-089', description: 'LED Projector + Audio Mixer', amount: 1200000, due_date: '2025-02-14', issue_date: '2025-01-15', status: 'paid', category: 'Technology', vat: 90000, wht: 12000 },
  { id: 'BILL-002', vendor_id: 'VND-004', vendor_name: 'NEPA / IKEDC', reference: 'IKEDC-JAN-2025', description: 'January Electricity Bill', amount: 92000, due_date: '2025-02-05', issue_date: '2025-01-25', status: 'overdue', category: 'Utilities', vat: 0, wht: 0 },
  { id: 'BILL-003', vendor_id: 'VND-005', vendor_name: 'Ola & Co. Chartered Accountants', reference: 'OLA-2025-Q1-AUDIT', description: 'Q1 Audit & Compliance Review', amount: 240000, due_date: '2025-04-30', issue_date: '2025-04-01', status: 'approved', category: 'Professional', vat: 36000, wht: 12000 },
  { id: 'BILL-004', vendor_id: 'VND-003', vendor_name: 'Stanbic IBTC Bank', reference: 'LOAN-INT-MAY25', description: 'May Loan Interest Payment', amount: 75000, due_date: '2025-05-31', issue_date: '2025-05-01', status: 'paid', category: 'Finance', vat: 0, wht: 0 },
  { id: 'BILL-005', vendor_id: 'VND-008', vendor_name: 'Arise FM / Radio', reference: 'ARISEFM-ADV-2025', description: 'Q2 Radio Outreach Advertising', amount: 312000, due_date: '2025-06-15', issue_date: '2025-05-15', status: 'pending', category: 'Media', vat: 46800, wht: 15600 },
  { id: 'BILL-006', vendor_id: 'VND-002', vendor_name: 'CleanSweep Services', reference: 'CS-MAY-2025', description: 'May Cleaning & Sanitation', amount: 80000, due_date: '2025-05-31', issue_date: '2025-05-25', status: 'paid', category: 'Facilities', vat: 0, wht: 0 },
  { id: 'BILL-007', vendor_id: 'VND-006', vendor_name: 'Gospel Print House', reference: 'GPH-INV-0482', description: 'May Bulletins & Programs (2,000 copies)', amount: 45000, due_date: '2025-05-28', issue_date: '2025-05-20', status: 'pending', category: 'Printing', vat: 6750, wht: 2250 },
  { id: 'BILL-008', vendor_id: 'VND-001', vendor_name: 'TechPro Nigeria Ltd', reference: 'INV-TP-2025-142', description: 'Annual Software Licenses (Church Suite)', amount: 480000, due_date: '2025-07-01', issue_date: '2025-06-01', status: 'draft', category: 'Technology', vat: 72000, wht: 24000 },
];

// Journal entries
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

// UI Components
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
          : '0 4px 16px rgba(0,0,0,0.25)',
        ...style
      }}>
      {isHl && <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,#10b98160,transparent)' }} />}
      {children}
    </div>
  );
});
SCard.displayName = 'SCard';

const SBar = memo(({ v, color = G, h = 4 }: { v: number; color?: string; h?: number }) => (
  <div className="fs-bar-track w-full rounded-full overflow-hidden" style={{ height: h }}>
    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clamp(v, 0, 100)}%`, background: color }} />
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

const SectionHeader = memo(({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="text-sm font-bold fs-text1 tracking-tight" style={{ fontFamily: 'Roboto Mono, monospace' }}>{title}</h3>
      {subtitle && <p className="text-[10px] fs-text3 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
));
SectionHeader.displayName = 'SectionHeader';

// Mini line chart
const MiniLine = memo(({ pts, color = G, w = 80, h = 32 }: { pts: number[]; color?: string; w?: number; h?: number }) => {
  if (pts.length < 2) return null;
  const max = Math.max(...pts) || 1;
  const min = Math.min(...pts);
  const range = max - min || 1;
  const coords = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / range) * h}`);
  const area = [`0,${h}`, ...coords, `${w},${h}`].join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <defs>
        <linearGradient id={`ml-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#ml-${color.replace('#', '')})`} />
      <polyline points={coords.join(' ')} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});
MiniLine.displayName = 'MiniLine';

// Main Component
const CommandModule: React.FC = () => {
  const totalRevenue = CHART_OF_ACCOUNTS.filter(a => a.type === 'revenue').reduce((s, a) => s + a.balance, 0);
  const totalExpenses = CHART_OF_ACCOUNTS.filter(a => a.type === 'expense').reduce((s, a) => s + a.balance, 0);
  const netSurplus = totalRevenue - totalExpenses;
  const totalAssets = CHART_OF_ACCOUNTS.filter(a => a.type === 'asset').reduce((s, a) => s + a.balance, 0);
  const totalLiab = CHART_OF_ACCOUNTS.filter(a => a.type === 'liability').reduce((s, a) => s + a.balance, 0);
  const totalEquity = CHART_OF_ACCOUNTS.filter(a => a.type === 'equity').reduce((s, a) => s + a.balance, 0);
  const cashBal = 8420000 + 3150000 + 125000;
  const currentAssets = 8420000 + 3150000 + 125000 + 2280000 + 640000 + 380000 + 10000000;
  const currentLiab = 1840000 + 920000 + 214000 + 87000 + 340000 + 280000 + 1200000;
  const currentRatio = (currentAssets / currentLiab).toFixed(2);
  const debtToEquity = (totalLiab / abs(totalEquity)).toFixed(2);
  const grossMargin = ((totalRevenue - 18600000 - 9840000) / totalRevenue * 100).toFixed(1);
  const netMargin = (netSurplus / totalRevenue * 100).toFixed(1);
  const overdueCount = BILLS.filter(b => b.status === 'overdue').length;
  const overdueAmt = BILLS.filter(b => b.status === 'overdue').reduce((s, b) => s + b.amount, 0);
  const pendingJnl = JOURNAL_ENTRIES.filter(j => !j.posted).length;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const revTrend = [3240000, 3850000, 3100000, 5080000, 3620000, 3240000, 3900000, 4200000, 3800000, 4100000, 4400000, 3950000];
  const expTrend = [2800000, 3100000, 2700000, 3200000, 3000000, 2800000, 3200000, 3400000, 3000000, 3500000, 3800000, 3200000];
  const cashTrend = [9200000, 10100000, 9800000, 11200000, 10800000, 11695000, 12100000, 11500000, 12400000, 12100000, 13000000, 11695000];

  const RATIOS = [
    { label: 'Current Ratio', value: currentRatio, target: '> 1.5', good: parseFloat(currentRatio) >= 1.5, desc: 'Short-term liquidity', icon: 'water_drop' },
    { label: 'Debt / Equity', value: debtToEquity, target: '< 0.5', good: parseFloat(debtToEquity) <= 0.5, desc: 'Financial leverage', icon: 'balance' },
    { label: 'Gross Margin', value: `${grossMargin}%`, target: '> 40%', good: parseFloat(grossMargin) >= 40, desc: 'After personnel costs', icon: 'trending_up' },
    { label: 'Net Surplus Margin', value: `${netMargin}%`, target: '> 15%', good: parseFloat(netMargin) >= 15, desc: 'Bottom line efficiency', icon: 'savings' },
  ];

  const HEALTH_SCORE = RATIOS.filter(r => r.good).length * 25;

  return (
    <div className="p-5 space-y-5 fs-slide">
      {/* Health Banner */}
      <div className="fs-health-banner rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5" style={{ background: 'radial-gradient(circle at right, #10b981, transparent)' }} />
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)' }}>
          <span className="text-2xl font-black fs-green" style={{ fontFamily: 'Roboto Mono, monospace' }}>{HEALTH_SCORE}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold fs-text1">Financial Health Score — {HEALTH_SCORE >= 75 ? 'STRONG' : HEALTH_SCORE >= 50 ? 'ADEQUATE' : 'NEEDS ATTENTION'}</p>
          <p className="text-[11px] fs-text3 mt-1">Based on 4 core financial ratios · Fiscal Year 2025 · As of {fmtD(new Date().toISOString())}</p>
          <div className="flex gap-1 mt-2">
            {[25, 50, 75, 100].map(t => (
              <div key={t} className={`h-1.5 flex-1 rounded-sm transition-all ${HEALTH_SCORE < t ? 'fs-bar-track' : ''}`} style={{ background: HEALTH_SCORE >= t ? G : undefined }} />
            ))}
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-2xl font-black fs-green">{compact(netSurplus)}</p>
          <p className="text-[10px] fs-text3">YTD Net Surplus</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Revenue', v: totalRevenue, sub: 'YTD gross income', color: '#10b981', pts: revTrend, icon: 'trending_up' },
          { label: 'Total Expenses', v: totalExpenses, sub: 'YTD operating costs', color: '#fb923c', pts: expTrend, icon: 'trending_down' },
          { label: 'Net Surplus', v: netSurplus, sub: 'Revenue minus expenses', color: netSurplus >= 0 ? '#10b981' : '#f87171', pts: revTrend.map((r, i) => r - expTrend[i]), icon: 'savings' },
          { label: 'Total Assets', v: totalAssets, sub: 'Gross asset base', color: '#60a5fa', pts: [totalAssets * 0.9, totalAssets], icon: 'domain' },
          { label: 'Cash & Equivalents', v: cashBal, sub: 'Liquid reserves', color: '#10b981', pts: cashTrend, icon: 'account_balance_wallet' },
          { label: 'Total Equity', v: abs(totalEquity), sub: 'Net fund balances', color: '#a78bfa', pts: [abs(totalEquity) * 0.8, abs(totalEquity)], icon: 'pie_chart' },
        ].map(k => (
          <SCard key={k.label} className="p-4 flex flex-col gap-3" gold={k.label === 'Net Surplus'}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold fs-text3 uppercase tracking-widest">{k.label}</span>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${k.color}22` }}>
                <Icon name={k.icon} size={12} style={{ color: k.color }} />
              </div>
            </div>
            <p className="text-lg font-black tracking-tight" style={{ color: k.color, fontFamily: 'Roboto Mono, monospace' }}>{compact(k.v)}</p>
            <div className="flex items-end justify-between">
              <p className="text-[9px] fs-text3">{k.sub}</p>
              <MiniLine pts={k.pts} color={k.color} w={60} h={20} />
            </div>
          </SCard>
        ))}
      </div>

      {/* Ratios + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SCard className="p-5 lg:col-span-2">
          <SectionHeader title="Key Financial Ratios" subtitle="Benchmarked against best-practice nonprofit standards" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RATIOS.map(r => (
              <div key={r.label} className={`p-3 rounded-lg ${r.good ? 'fs-ratio-good' : 'fs-ratio-bad'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold fs-text3 uppercase tracking-wider">{r.label}</span>
                  <span className={`text-[9px] font-bold ${r.good ? 'text-emerald-500' : 'text-red-400'}`}>{r.good ? '✓ HEALTHY' : '⚠ REVIEW'}</span>
                </div>
                <p className="text-2xl font-black" style={{ color: r.good ? '#10b981' : '#f87171', fontFamily: 'Roboto Mono, monospace' }}>{r.value}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[9px] fs-text3">{r.desc}</p>
                  <p className="text-[9px] font-mono fs-text3">target: {r.target}</p>
                </div>
              </div>
            ))}
          </div>
          {/* 12-month comparative bars */}
          <div className="mt-5">
            <p className="text-[9px] font-bold fs-text3 uppercase tracking-widest mb-3">12-Month Revenue vs Expenses</p>
            <div className="flex items-end gap-1.5 h-20">
              {MONTHS.map((m, i) => {
                const maxV = Math.max(...revTrend, ...expTrend);
                const rh = Math.round((revTrend[i] / maxV) * 72);
                const eh = Math.round((expTrend[i] / maxV) * 72);
                return (
                  <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex items-end justify-center gap-px" style={{ height: 72 }}>
                      <div className="rounded-t flex-1" style={{ height: rh, background: 'rgba(16,185,129,0.6)', minWidth: 4 }} />
                      <div className="rounded-t flex-1" style={{ height: eh, background: 'rgba(251,146,60,0.4)', minWidth: 4 }} />
                    </div>
                    <span className="text-[7px] fs-text3">{m}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-2">
              <span className="text-[9px] fs-text3 flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'rgba(16,185,129,0.6)' }} />Revenue</span>
              <span className="text-[9px] fs-text3 flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'rgba(251,146,60,0.4)' }} />Expenses</span>
            </div>
          </div>
        </SCard>

        <div className="space-y-3">
          <SCard className="p-4">
            <p className="text-[9px] font-bold fs-text3 uppercase tracking-widest mb-3">Action Items</p>
            <div className="space-y-2">
              {[
                { icon: 'warning', label: `${overdueCount} overdue ${overdueCount === 1 ? 'bill' : 'bills'}`, amount: ngn(overdueAmt), color: '#f87171', link: 'payables' },
                { icon: 'pending_actions', label: `${pendingJnl} unposted journal ${pendingJnl === 1 ? 'entry' : 'entries'}`, amount: '', color: '#34d399', link: 'ledger' },
                { icon: 'account_balance', label: 'VAT return due in 8 days', amount: ngn(214000), color: '#fb923c', link: 'tax' },
                { icon: 'person', label: 'PAYE remittance pending', amount: ngn(340000), color: '#60a5fa', link: 'payroll' },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer fs-hover fs-inset transition-colors" style={{ border: `1px solid ${a.color}22` }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}15` }}>
                    <Icon name={a.icon} size={13} style={{ color: a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] fs-text2 truncate">{a.label}</p>
                    {a.amount && <p className="text-[10px] font-mono" style={{ color: a.color }}>{a.amount}</p>}
                  </div>
                  <Icon name="chevron_right" size={12} className="fs-text3 flex-shrink-0" />
                </div>
              ))}
            </div>
          </SCard>

          <SCard className="p-4">
            <p className="text-[9px] font-bold fs-text3 uppercase tracking-widest mb-3">Cash Runway</p>
            <p className="text-3xl font-black fs-green" style={{ fontFamily: 'Roboto Mono, monospace' }}>{Math.round(cashBal / (totalExpenses / 12))} <span className="text-sm fs-text3">months</span></p>
            <p className="text-[10px] fs-text3 mt-1">At current burn rate of {compact(totalExpenses / 12)}/mo</p>
            <div className="mt-3">
              <SBar v={Math.min(100, (cashBal / (totalExpenses / 12)) / 24 * 100)} color={G} h={6} />
              <p className="text-[9px] fs-text3 mt-1">vs 24-month target runway</p>
            </div>
          </SCard>

          <SCard className="p-4">
            <p className="text-[9px] font-bold fs-text3 uppercase tracking-widest mb-3">Fund Allocation</p>
            <div className="space-y-2">
              {[
                { name: 'General Fund', amt: 42000000, color: '#10b981' },
                { name: 'Building Fund', amt: 8660000, color: '#3b82f6' },
                { name: 'Endowment', amt: 30000000, color: '#a78bfa' },
                { name: 'Missions Fund', amt: 1650000, color: '#10b981' },
              ].map(f => {
                const total = 82310000;
                return (
                  <div key={f.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] fs-text3">{f.name}</span>
                      <span className="text-[10px] font-mono" style={{ color: f.color }}>{compact(f.amt)}</span>
                    </div>
                    <SBar v={parseFloat(pct(f.amt, total))} color={f.color} h={3} />
                  </div>
                );
              })}
            </div>
          </SCard>
        </div>
      </div>
    </div>
  );
};

export default CommandModule;

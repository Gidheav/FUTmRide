// ─────────────────────────────────────────────────────────────────────────────
// reports.constants.ts
// All module-scope constants for FinancialReports (FinancialSanctum)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type {
  SanctumTab, Account, JournalEntry, Vendor, Bill,
  FixedAsset, StaffMember, VatEntry, AuditLog,
} from '../types/financial.types';

// ─── Tab definitions ──────────────────────────────────────────────────────────

export const SANCTUM_TABS: { key: SanctumTab; icon: string; label: string; badge?: string }[] = [
  { key: 'command',    icon: 'hub',             label: 'Command'    },
  { key: 'ledger',     icon: 'book',            label: 'Ledger'     },
  { key: 'statements', icon: 'analytics',       label: 'Statements' },
  { key: 'treasury',   icon: 'account_balance', label: 'Treasury'   },
  { key: 'payables',   icon: 'request_quote',   label: 'Payables'   },
  { key: 'assets',     icon: 'domain',          label: 'Assets'     },
  { key: 'payroll',    icon: 'badge',           label: 'Payroll'    },
  { key: 'tax',        icon: 'receipt_long',    label: 'Tax'        },
  { key: 'audit',      icon: 'verified_user',   label: 'Audit'      },
  { key: 'board',      icon: 'summarize',       label: 'Board Pack' },
];

// ─── Emerald accent tokens ────────────────────────────────────────────────────

export const G  = '#10b981'; // emerald primary
export const G2 = '#34d399'; // emerald light
export const G3 = '#064e3b'; // emerald dark

// ─── Scroll styles ────────────────────────────────────────────────────────────

export const THIN_DARK:  React.CSSProperties = { scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' };
export const THIN_LIGHT: React.CSSProperties = { scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' };

// ─── CSS injection string ─────────────────────────────────────────────────────

export const FS_CSS = `
/* ── DARK MODE ── */
.fs.dark { background: #020617; }
.fs.dark .fs-page { background: #020617; }
.fs.dark .fs-card { background: #0f172a; border: 1px solid #1e293b !important; border-radius: 12px; }
.fs.dark .fs-topbar { background: #0a0f1e; border-bottom: 1px solid #1a2540; }
.fs.dark .fs-toolbar { background: #0f172a; border-bottom: 1px solid #1e293b; }
.fs.dark .fs-thead { background: #0f172a; border-bottom: 1px solid #1e293b; }
.fs.dark .fs-tr-even { background: #020617; }
.fs.dark .fs-tr-odd  { background: rgba(15,23,42,0.5); }
.fs.dark .fs-tr-even:hover,.fs.dark .fs-tr-odd:hover { background: rgba(30,41,59,0.5); }
.fs.dark .fs-bar-track { background: #1e293b; }
.fs.dark .fs-input {
  background: rgba(30,41,59,0.8) !important;
  border: 1px solid #334155 !important;
  color: #cbd5e1 !important;
}
.fs.dark .fs-input::placeholder { color: #334155 !important; }
.fs.dark .fs-text1 { color: #f1f5f9; }
.fs.dark .fs-text2 { color: #94a3b8; }
.fs.dark .fs-text3 { color: #64748b; }
.fs.dark .fs-text4 { color: #334155; }
.fs.dark .fs-divider { border-bottom: 1px solid #1e293b; border-top: 1px solid transparent; }
.fs.light .fs-divider { border-bottom: 1px solid #d1fae5; border-top: 1px solid transparent; }
.fs.dark .fs-tab-bar { border-top: 1px solid rgba(30,41,59,0.5); }
.fs.dark .fs-tab-btn { color: #475569; }
.fs.dark .fs-tab-btn.active { color: #10b981; border-color: #10b981; }
.fs.dark .fs-stat-chip { background: rgba(30,41,59,0.6); }
.fs.dark .fs-panel-footer { background: rgba(16,185,129,0.05); border-top: 1px solid #1e293b; }
.fs.dark .fs-hover:hover { background: rgba(30,41,59,0.4); }
.fs.dark .fs-col-sep { border-left: 1px solid #1e293b; }

/* ── LIGHT MODE ── */
.fs.light { background: #f0fdf4; }
.fs.light .fs-page { background: #f0fdf4; }
.fs.light .fs-card { background: #ffffff; border: 1px solid #d1fae5; border-radius: 12px; box-shadow: 0 1px 8px rgba(16,185,129,0.06); }
.fs.light .fs-topbar { background: #ffffff; border-bottom: 1px solid #d1fae5; }
.fs.light .fs-toolbar { background: #f8fffe; border-bottom: 1px solid #d1fae5; }
.fs.light .fs-thead { background: #f0fdf4; border-bottom: 1px solid #d1fae5; }
.fs.light .fs-tr-even { background: #ffffff; }
.fs.light .fs-tr-odd  { background: #f8fffe; }
.fs.light .fs-tr-even:hover,.fs.light .fs-tr-odd:hover { background: #ecfdf5; }
.fs.light .fs-bar-track { background: #d1fae5; }
.fs.light .fs-input {
  background: #f0fdf4 !important;
  border: 1px solid #a7f3d0 !important;
  color: #064e3b !important;
}
.fs.light .fs-input::placeholder { color: #a7f3d0 !important; }
.fs.light .fs-text1 { color: #064e3b; }
.fs.light .fs-text2 { color: #065f46; }
.fs.light .fs-text3 { color: #6b7280; }
.fs.light .fs-text4 { color: #d1fae5; }
.fs.light .fs-divider { border-color: #d1fae5; }
.fs.light .fs-tab-bar { border-top: 1px solid #d1fae5; }
.fs.light .fs-tab-btn { color: #6b7280; }
.fs.light .fs-tab-btn.active { color: #10b981; border-color: #10b981; }
.fs.light .fs-stat-chip { background: #ecfdf5; border: 1px solid #d1fae5; color: #065f46; }
.fs.light .fs-panel-footer { background: rgba(16,185,129,0.04); border-top: 1px solid #d1fae5; }
.fs.light .fs-hover:hover { background: #ecfdf5; }
.fs.light .fs-col-sep { border-left: 1px solid #d1fae5; }

/* ── SHARED ── */
.fs { font-family: 'Roboto Mono', monospace; transition: background 0.25s; }
.fs-input:focus { border-color: #10b981 !important; box-shadow: 0 0 0 2px rgba(16,185,129,0.18) !important; outline: none !important; }
.fs-green { color: #10b981; }
.fs.dark .fs-subtlebg { background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.18); }
.fs.light .fs-subtlebg { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); }
.fs.dark .fs-inset { background: rgba(30,41,59,0.4); border: 1px solid #1e293b; }
.fs.light .fs-inset { background: #f0fdf4; border: 1px solid #d1fae5; }
.fs.dark .fs-ratio-good { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); }
.fs.light .fs-ratio-good { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.25); }
.fs.dark .fs-ratio-bad  { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); }
.fs.light .fs-ratio-bad { background: rgba(248,113,113,0.05); border: 1px solid rgba(248,113,113,0.2); }
.fs.dark .fs-surplus-banner { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); }
.fs.light .fs-surplus-banner { background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.3); }
.fs.dark .fs-kpi-card { background: #0f172a; border: 1px solid #1e293b; }
.fs.light .fs-kpi-card { background: #fff; border: 1px solid #d1fae5; }
.fs.dark  .fs-health-banner { background: linear-gradient(135deg,rgba(16,185,129,0.12),rgba(52,211,153,0.06)); border: 1px solid rgba(16,185,129,0.25); }
.fs.light .fs-health-banner { background: linear-gradient(135deg,rgba(16,185,129,0.10),rgba(240,253,244,0.95)); border: 1px solid rgba(16,185,129,0.3); }
.fs.dark .fs-row-expand { background: rgba(16,185,129,0.04); border-bottom: 1px solid rgba(16,185,129,0.15); }
.fs.light .fs-row-expand { background: rgba(16,185,129,0.03); border-bottom: 1px solid rgba(16,185,129,0.12); }

/* ── LIGHT MODE OVERRIDES FOR HARDCODED TAILWIND CLASSES ── */
/* Only apply these when in light mode - use !important to override hardcoded dark values */
html:not(.dark) .fs.light .border-slate-800, 
.fs.light .border-slate-800 { border-color: #d1fae5 !important; }
html:not(.dark) .fs.light .border-slate-900, 
.fs.light .border-slate-900 { border-color: #d1fae5 !important; }
html:not(.dark) .fs.light .border-slate-900\/60, 
.fs.light .border-slate-900\/60 { border-color: #d1fae580 !important; }
html:not(.dark) .fs.light .border-slate-900\/30, 
.fs.light .border-slate-900\/30 { border-color: #d1fae550 !important; }
html:not(.dark) .fs.light .border-slate-800\/40, 
.fs.light .border-slate-800\/40 { border-color: #d1fae565 !important; }
html:not(.dark) .fs.light .border-slate-800\/60, 
.fs.light .border-slate-800\/60 { border-color: #d1fae580 !important; }
html:not(.dark) .fs.light .bg-slate-800\/60, 
.fs.light .bg-slate-800\/60 { background-color: #f0fdf4 !important; }
html:not(.dark) .fs.light .bg-slate-800\/30, 
.fs.light .bg-slate-800\/30 { background-color: #f0fdf450 !important; }

/* Override inline styles with dark backgrounds - light mode only */
html:not(.dark) .fs.light [style*="rgba(30,41,59,0.4)"], 
.fs.light [style*="rgba(30,41,59,0.4)"] { background-color: #f0fdf4 !important; }
html:not(.dark) .fs.light [style*="rgba(30,41,59,0.5)"], 
.fs.light [style*="rgba(30,41,59,0.5)"] { background-color: #ecfdf5 !important; }
html:not(.dark) .fs.light [style*="rgba(30,41,59,0.6)"], 
.fs.light [style*="rgba(30,41,59,0.6)"] { background-color: #d1fae5 !important; }
html:not(.dark) .fs.light [style*="background: rgba(30,41,59"], 
.fs.light [style*="background: rgba(30,41,59"] { background-color: #f0fdf4 !important; }

/* Ensure dark mode keeps proper dark borders - use html.dark to enforce priority */
html.dark .fs.dark .border-slate-800, 
html.dark .border-slate-800, 
.fs.dark .border-slate-800 { border-color: #1e293b !important; }
html.dark .fs.dark .border-slate-900, 
html.dark .border-slate-900, 
.fs.dark .border-slate-900 { border-color: #0f172a !important; }
html.dark .fs.dark .border-slate-700, 
html.dark .border-slate-700, 
.fs.dark .border-slate-700 { border-color: #334155 !important; }

/* Also handle border-opacity variants used in inline styles */
html.dark .fs [style*="border-color"][style*="slate"],
html.dark .fs [style*="border:"][style*="slate"] { border-color: #1e293b !important; }

/* Background overrides for dark mode inline styles */
html.dark .fs [style*="rgba(30,41,59"],
html.dark .fs [style*="rgba(15,23,42"],
html.dark .fs [style*="background: rgba"][style*="30,41,59"] { background-color: rgba(30,41,59,0.4) !important; }

/* ULTIMATE DARK MODE BORDER FIX - override ALL slate border colors */
/* This must come LAST and use maximum specificity */
html.dark .fs.dark,
html.dark .fs {}
html.dark .fs .border-slate-800,
html.dark .fs .border-slate-800\/60,
html.dark .fs .border-slate-800\/40,
html.dark .fs .border-slate-800\/30,
html.dark .fs .border-slate-900,
html.dark .fs .border-slate-900\/60,
html.dark .fs .border-slate-900\/30,
html.dark .fs .border-slate-700,
html.dark .fs .border-slate-700\/60,
html.dark table .border-slate-800,
html.dark table .border-slate-900,
html.dark div.border-slate-800,
html.dark div.border-slate-900,
html.dark .fs-card.border,
html.dark .fs-card { border-color: #1e293b !important; }

/* Exception - allow emerald/gem borders to stay */
html.dark .fs .border-emerald-500,
html.dark .fs .border-emerald-600,
html.dark .fs .border-emerald-700,
html.dark .fs .border-emerald-800,
html.dark .fs .border-green-500,
html.dark .fs .border-green-600,
html.dark .fs .border-blue-400,
html.dark .fs .border-blue-500 { border-color: unset !important; }

@keyframes fs-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
@keyframes fs-slide-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes fs-spin { to{transform:rotate(360deg)} }
.fs-pulse { animation: fs-pulse 2s ease-in-out infinite; }
.fs-slide { animation: fs-slide-in 0.3s ease; }
.fs-spin { animation: fs-spin 0.8s linear infinite; }
.green-glow { box-shadow: 0 0 0 1px rgba(16,185,129,0.2), 0 4px 24px rgba(16,185,129,0.08); }
.green-line::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,#10b98160,transparent); }
`;

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const CHART_OF_ACCOUNTS: Account[] = [
  // ASSETS
  { code:'1000', name:'Cash & Bank — GTBank', type:'asset', subtype:'Current Asset', balance:8420000, normal:'debit', description:'Primary operating account' },
  { code:'1010', name:'Cash & Bank — Zenith', type:'asset', subtype:'Current Asset', balance:3150000, normal:'debit', description:'Secondary operating account' },
  { code:'1020', name:'Petty Cash', type:'asset', subtype:'Current Asset', balance:125000, normal:'debit', description:'Office petty cash float' },
  { code:'1100', name:'Accounts Receivable', type:'asset', subtype:'Current Asset', balance:2280000, normal:'debit', description:'Amounts owed to ministry' },
  { code:'1200', name:'Prepaid Expenses', type:'asset', subtype:'Current Asset', balance:640000, normal:'debit', description:'Advance payments' },
  { code:'1300', name:'Inventory — Merchandise', type:'asset', subtype:'Current Asset', balance:380000, normal:'debit', description:'Books, CDs, merchandise' },
  { code:'1500', name:'Land & Building', type:'asset', subtype:'Fixed Asset', balance:85000000, normal:'debit', description:'Church property at Plot 42' },
  { code:'1510', name:'Acc. Depr — Building', type:'asset', subtype:'Contra Asset', balance:-4250000, normal:'credit', description:'Accumulated depreciation on building' },
  { code:'1520', name:'Equipment & Furniture', type:'asset', subtype:'Fixed Asset', balance:9800000, normal:'debit', description:'AV, office, musical equipment' },
  { code:'1530', name:'Acc. Depr — Equipment', type:'asset', subtype:'Contra Asset', balance:-3920000, normal:'credit', description:'Accumulated depreciation on equipment' },
  { code:'1540', name:'Motor Vehicles', type:'asset', subtype:'Fixed Asset', balance:12500000, normal:'debit', description:'Ministry vehicles (3)' },
  { code:'1550', name:'Acc. Depr — Vehicles', type:'asset', subtype:'Contra Asset', balance:-5000000, normal:'credit', description:'Accumulated depreciation on vehicles' },
  { code:'1600', name:'Investments — FGN Bonds', type:'asset', subtype:'Long-term Investment', balance:25000000, normal:'debit', description:'FGN savings bonds portfolio' },
  { code:'1610', name:'Investments — T-Bills', type:'asset', subtype:'Short-term Investment', balance:10000000, normal:'debit', description:'Treasury bills (90-day rolling)' },
  // LIABILITIES
  { code:'2000', name:'Accounts Payable', type:'liability', subtype:'Current Liability', balance:1840000, normal:'credit', description:'Outstanding vendor bills' },
  { code:'2100', name:'Accrued Expenses', type:'liability', subtype:'Current Liability', balance:920000, normal:'credit', description:'Accrued but unpaid expenses' },
  { code:'2200', name:'VAT Payable', type:'liability', subtype:'Current Liability', balance:214000, normal:'credit', description:'Output VAT collected, net of input' },
  { code:'2210', name:'WHT Payable', type:'liability', subtype:'Current Liability', balance:87000, normal:'credit', description:'Withholding tax deducted at source' },
  { code:'2300', name:'PAYE Payable', type:'liability', subtype:'Current Liability', balance:340000, normal:'credit', description:'Staff PAYE due to FIRS' },
  { code:'2310', name:'Pension Payable', type:'liability', subtype:'Current Liability', balance:280000, normal:'credit', description:'Staff & employer pension contributions' },
  { code:'2400', name:'Deferred Revenue', type:'liability', subtype:'Current Liability', balance:1200000, normal:'credit', description:'Unearned program fees' },
  { code:'2500', name:'Long-term Loan', type:'liability', subtype:'Long-term Liability', balance:15000000, normal:'credit', description:'Building renovation loan (Bank)' },
  // EQUITY / FUND BALANCES
  { code:'3000', name:'General Fund Balance', type:'equity', subtype:'Unrestricted Net Assets', balance:42000000, normal:'credit', description:'Unrestricted accumulated surplus' },
  { code:'3100', name:'Building Fund', type:'equity', subtype:'Restricted Net Assets', balance:8660000, normal:'credit', description:'Designated for new sanctuary' },
  { code:'3200', name:'Missions Fund', type:'equity', subtype:'Restricted Net Assets', balance:1650000, normal:'credit', description:'Missionary support — Kenya' },
  { code:'3300', name:'Endowment Fund', type:'equity', subtype:'Permanently Restricted', balance:30000000, normal:'credit', description:'Permanent endowment corpus' },
  { code:'3400', name:'Current Year Surplus', type:'equity', subtype:'Retained Surplus', balance:0, normal:'credit', description:'YTD net surplus' },
  // REVENUES
  { code:'4000', name:'Tithes & Offerings', type:'revenue', subtype:'Ministry Revenue', balance:38420000, normal:'credit', description:'Regular giving receipts' },
  { code:'4100', name:'Project Offerings', type:'revenue', subtype:'Project Revenue', balance:12850000, normal:'credit', description:'Special project giving' },
  { code:'4200', name:'Fundraising Revenue', type:'revenue', subtype:'Special Revenue', balance:6740000, normal:'credit', description:'Events & fundraising proceeds' },
  { code:'4300', name:'Program Fees', type:'revenue', subtype:'Service Revenue', balance:2180000, normal:'credit', description:'Youth, music, language programs' },
  { code:'4400', name:'Investment Income', type:'revenue', subtype:'Other Revenue', balance:3250000, normal:'credit', description:'Bond interest + T-bill yields' },
  { code:'4500', name:'Rental Income', type:'revenue', subtype:'Other Revenue', balance:840000, normal:'credit', description:'Hall & facility rentals' },
  { code:'4600', name:'Merchandise Sales', type:'revenue', subtype:'Other Revenue', balance:420000, normal:'credit', description:'Books, CDs, branded merchandise' },
  // EXPENSES
  { code:'5000', name:'Pastoral Salaries', type:'expense', subtype:'Personnel', balance:18600000, normal:'debit', description:'Lead & associate pastor compensation' },
  { code:'5010', name:'Staff Salaries', type:'expense', subtype:'Personnel', balance:9840000, normal:'debit', description:'Administrative & support staff' },
  { code:'5020', name:'Pension — Employer', type:'expense', subtype:'Personnel', balance:1428000, normal:'debit', description:'10% employer pension contribution' },
  { code:'5030', name:'Staff Benefits', type:'expense', subtype:'Personnel', balance:840000, normal:'debit', description:'HMO, transport, housing allowances' },
  { code:'5100', name:'Building & Maintenance', type:'expense', subtype:'Operations', balance:4820000, normal:'debit', description:'Repairs, upkeep, utilities' },
  { code:'5110', name:'Utilities', type:'expense', subtype:'Operations', balance:1840000, normal:'debit', description:'Electricity, water, internet' },
  { code:'5120', name:'Rent & Rates', type:'expense', subtype:'Operations', balance:0, normal:'debit', description:'External space rentals if any' },
  { code:'5200', name:'Media & Technology', type:'expense', subtype:'Ministry', balance:3180000, normal:'debit', description:'Streaming, equipment, software' },
  { code:'5210', name:'Printing & Stationery', type:'expense', subtype:'Operations', balance:640000, normal:'debit', description:'Bulletins, admin forms' },
  { code:'5300', name:'Mission & Outreach', type:'expense', subtype:'Ministry', balance:4200000, normal:'debit', description:'Evangelism, missions giving' },
  { code:'5400', name:'Youth & Programs', type:'expense', subtype:'Ministry', balance:2840000, normal:'debit', description:'Youth ministry operating costs' },
  { code:'5500', name:'Travel & Transport', type:'expense', subtype:'Operations', balance:1240000, normal:'debit', description:'Ministry travel, vehicle running costs' },
  { code:'5600', name:'Professional Fees', type:'expense', subtype:'Administration', balance:580000, normal:'debit', description:'Audit, legal, consulting fees' },
  { code:'5700', name:'Bank Charges', type:'expense', subtype:'Finance', balance:124000, normal:'debit', description:'Transaction fees, transfer charges' },
  { code:'5710', name:'Interest Expense', type:'expense', subtype:'Finance', balance:900000, normal:'debit', description:'Loan interest payments' },
  { code:'5800', name:'Depreciation', type:'expense', subtype:'Non-cash', balance:2380000, normal:'debit', description:'Annual depreciation charge' },
  { code:'5900', name:'Benevolence & Welfare', type:'expense', subtype:'Ministry', balance:1680000, normal:'debit', description:'Congregant welfare payments' },
];

export const JOURNAL_ENTRIES: JournalEntry[] = [
  { id:'JNL-001', date:'2025-01-05', reference:'JNL-2025-001', description:'January Tithes & Offerings', narration:'Recording of weekly offering collection deposited to GTBank', lines:[{account_code:'1000',account_name:'Cash & Bank — GTBank',debit:3240000,credit:0},{account_code:'4000',account_name:'Tithes & Offerings',debit:0,credit:3240000}], posted:true, approved_by:'Elder James', created_by:'Accountant Mary', total:3240000 },
  { id:'JNL-002', date:'2025-01-10', reference:'JNL-2025-002', description:'Pastoral Salary Payment — January', narration:'Net salary disbursement after PAYE and pension deductions', lines:[{account_code:'5000',account_name:'Pastoral Salaries',debit:2100000,credit:0},{account_code:'2300',account_name:'PAYE Payable',debit:0,credit:280000},{account_code:'2310',account_name:'Pension Payable',debit:0,credit:210000},{account_code:'1000',account_name:'Cash & Bank — GTBank',debit:0,credit:1610000}], posted:true, approved_by:'Senior Pastor', created_by:'Accountant Mary', total:2100000 },
  { id:'JNL-003', date:'2025-01-15', reference:'JNL-2025-003', description:'Media Equipment Purchase', narration:'Purchase of LED projector and audio mixer from TechPro Nig Ltd', lines:[{account_code:'1520',account_name:'Equipment & Furniture',debit:1200000,credit:0},{account_code:'2200',account_name:'VAT Payable',debit:0,credit:90000},{account_code:'2000',account_name:'Accounts Payable',debit:0,credit:1110000}], posted:true, approved_by:'Elder James', created_by:'Accountant Mary', total:1200000 },
  { id:'JNL-004', date:'2025-02-01', reference:'JNL-2025-004', description:'Building Fund Offering Transfer', narration:'Special building offering received and allocated to Building Fund', lines:[{account_code:'1000',account_name:'Cash & Bank — GTBank',debit:800000,credit:0},{account_code:'3100',account_name:'Building Fund',debit:0,credit:800000}], posted:true, approved_by:'Board Chair', created_by:'Accountant Mary', total:800000 },
  { id:'JNL-005', date:'2025-02-14', reference:'JNL-2025-005', description:'T-Bill Investment', narration:'Purchase of 90-day Treasury Bills via Zenith Bank capital markets desk', lines:[{account_code:'1610',account_name:'Investments — T-Bills',debit:5000000,credit:0},{account_code:'1010',account_name:'Cash & Bank — Zenith',debit:0,credit:5000000}], posted:true, approved_by:'Board Finance', created_by:'Treasurer', total:5000000 },
  { id:'JNL-006', date:'2025-03-01', reference:'JNL-2025-006', description:'Missions Giving — Kenya', narration:'Quarterly remittance to Nairobi missions partner', lines:[{account_code:'5300',account_name:'Mission & Outreach',debit:600000,credit:0},{account_code:'1000',account_name:'Cash & Bank — GTBank',debit:0,credit:600000}], posted:true, approved_by:'Elder James', created_by:'Accountant Mary', total:600000 },
  { id:'JNL-007', date:'2025-03-15', reference:'JNL-2025-007', description:'Depreciation — Q1 Charge', narration:'Quarterly depreciation on building, equipment and vehicles', lines:[{account_code:'5800',account_name:'Depreciation',debit:595000,credit:0},{account_code:'1510',account_name:'Acc. Depr — Building',debit:0,credit:212500},{account_code:'1530',account_name:'Acc. Depr — Equipment',debit:0,credit:245000},{account_code:'1550',account_name:'Acc. Depr — Vehicles',debit:0,credit:137500}], posted:true, approved_by:'Accountant Mary', created_by:'Accountant Mary', total:595000 },
  { id:'JNL-008', date:'2025-04-05', reference:'JNL-2025-008', description:'Easter Convention Revenue', narration:'Convention registration fees and special offerings received', lines:[{account_code:'1000',account_name:'Cash & Bank — GTBank',debit:2840000,credit:0},{account_code:'4200',account_name:'Fundraising Revenue',debit:0,credit:2840000}], posted:true, approved_by:'Board Chair', created_by:'Treasurer', total:2840000 },
  { id:'JNL-009', date:'2025-04-20', reference:'JNL-2025-009', description:'Loan Interest Payment', narration:'Monthly interest on building renovation loan — Stanbic Bank', lines:[{account_code:'5710',account_name:'Interest Expense',debit:75000,credit:0},{account_code:'1000',account_name:'Cash & Bank — GTBank',debit:0,credit:75000}], posted:true, approved_by:'Elder James', created_by:'Accountant Mary', total:75000 },
  { id:'JNL-010', date:'2025-05-01', reference:'JNL-2025-010', description:'PAYE Remittance — April', narration:'PAYE deducted from staff salaries remitted to FIRS', lines:[{account_code:'2300',account_name:'PAYE Payable',debit:340000,credit:0},{account_code:'1000',account_name:'Cash & Bank — GTBank',debit:0,credit:340000}], posted:true, approved_by:'Accountant Mary', created_by:'Accountant Mary', total:340000 },
  { id:'JNL-011', date:'2025-05-10', reference:'JNL-2025-011', description:'Investment Income — Bond Interest', narration:'Semi-annual coupon received on FGN Bond portfolio', lines:[{account_code:'1000',account_name:'Cash & Bank — GTBank',debit:1125000,credit:0},{account_code:'4400',account_name:'Investment Income',debit:0,credit:1125000}], posted:true, approved_by:'Board Finance', created_by:'Treasurer', total:1125000 },
  { id:'JNL-012', date:'2025-06-01', reference:'JNL-2025-012', description:'Accrual — June Utilities', narration:'Accrual for June electricity and internet bills (not yet invoiced)', lines:[{account_code:'5110',account_name:'Utilities',debit:180000,credit:0},{account_code:'2100',account_name:'Accrued Expenses',debit:0,credit:180000}], posted:false, approved_by:'', created_by:'Accountant Mary', total:180000 },
];

export const VENDORS: Vendor[] = [
  { id:'VND-001', name:'TechPro Nigeria Ltd', email:'accounts@techpro.ng', phone:'08012345678', bank:'GTBank', account_no:'0123456789', bank_code:'058', category:'Technology', terms:30, balance_owed:1110000, ytd_paid:3840000, status:'active', tax_id:'12345678-0001' },
  { id:'VND-002', name:'CleanSweep Services', email:'billing@cleansweep.ng', phone:'08098765432', bank:'Access Bank', account_no:'9876543210', bank_code:'044', category:'Facilities', terms:14, balance_owed:0, ytd_paid:480000, status:'active', tax_id:'98765432-0002' },
  { id:'VND-003', name:'Stanbic IBTC Bank', email:'loans@stanbic.com', phone:'01-2806000', bank:'Stanbic IBTC', account_no:'0001112223', bank_code:'221', category:'Financial', terms:0, balance_owed:15000000, ytd_paid:900000, status:'active', tax_id:'RC-000234-FIN' },
  { id:'VND-004', name:'NEPA / IKEDC', email:'billing@ikedc.com', phone:'0700-IKEDC-00', bank:'First Bank', account_no:'2031900042', bank_code:'011', category:'Utilities', terms:30, balance_owed:92000, ytd_paid:1260000, status:'active', tax_id:'GOV-POWER-001' },
  { id:'VND-005', name:'Ola & Co. Chartered Accountants', email:'audit@olaandco.ng', phone:'01-7654321', bank:'Zenith Bank', account_no:'1122334455', bank_code:'057', category:'Professional', terms:30, balance_owed:240000, ytd_paid:580000, status:'active', tax_id:'ICAN-000892' },
  { id:'VND-006', name:'Gospel Print House', email:'orders@gospelprint.ng', phone:'09011223344', bank:'UBA', account_no:'5544332211', bank_code:'033', category:'Printing', terms:7, balance_owed:45000, ytd_paid:320000, status:'active', tax_id:'RC-088-PRINT' },
  { id:'VND-007', name:'Swift Couriers Nigeria', email:'invoices@swiftng.com', phone:'08033219988', bank:'Ecobank', account_no:'8877665544', bank_code:'050', category:'Logistics', terms:14, balance_owed:0, ytd_paid:124000, status:'inactive', tax_id:'RC-COURIER-88' },
  { id:'VND-008', name:'Arise FM / Radio', email:'ads@arisefm.ng', phone:'01-8001234', bank:'GTBank', account_no:'0099887766', bank_code:'058', category:'Media', terms:30, balance_owed:312000, ytd_paid:840000, status:'active', tax_id:'NBC-ARISE-2020' },
];

export const BILLS: Bill[] = [
  { id:'BILL-001', vendor_id:'VND-001', vendor_name:'TechPro Nigeria Ltd', reference:'INV-TP-2025-089', description:'LED Projector + Audio Mixer', amount:1200000, due_date:'2025-02-14', issue_date:'2025-01-15', status:'paid', category:'Technology', vat:90000, wht:12000 },
  { id:'BILL-002', vendor_id:'VND-004', vendor_name:'NEPA / IKEDC', reference:'IKEDC-JAN-2025', description:'January Electricity Bill', amount:92000, due_date:'2025-02-05', issue_date:'2025-01-25', status:'overdue', category:'Utilities', vat:0, wht:0 },
  { id:'BILL-003', vendor_id:'VND-005', vendor_name:'Ola & Co. Chartered Accountants', reference:'OLA-2025-Q1-AUDIT', description:'Q1 Audit & Compliance Review', amount:240000, due_date:'2025-04-30', issue_date:'2025-04-01', status:'approved', category:'Professional', vat:36000, wht:12000 },
  { id:'BILL-004', vendor_id:'VND-003', vendor_name:'Stanbic IBTC Bank', reference:'LOAN-INT-MAY25', description:'May Loan Interest Payment', amount:75000, due_date:'2025-05-31', issue_date:'2025-05-01', status:'paid', category:'Finance', vat:0, wht:0 },
  { id:'BILL-005', vendor_id:'VND-008', vendor_name:'Arise FM / Radio', reference:'ARISEFM-ADV-2025', description:'Q2 Radio Outreach Advertising', amount:312000, due_date:'2025-06-15', issue_date:'2025-05-15', status:'pending', category:'Media', vat:46800, wht:15600 },
  { id:'BILL-006', vendor_id:'VND-002', vendor_name:'CleanSweep Services', reference:'CS-MAY-2025', description:'May Cleaning & Sanitation', amount:80000, due_date:'2025-05-31', issue_date:'2025-05-25', status:'paid', category:'Facilities', vat:0, wht:0 },
  { id:'BILL-007', vendor_id:'VND-006', vendor_name:'Gospel Print House', reference:'GPH-INV-0482', description:'May Bulletins & Programs (2,000 copies)', amount:45000, due_date:'2025-05-28', issue_date:'2025-05-20', status:'pending', category:'Printing', vat:6750, wht:2250 },
  { id:'BILL-008', vendor_id:'VND-001', vendor_name:'TechPro Nigeria Ltd', reference:'INV-TP-2025-142', description:'Annual Software Licenses (Church Suite)', amount:480000, due_date:'2025-07-01', issue_date:'2025-06-01', status:'draft', category:'Technology', vat:72000, wht:24000 },
];

export const FIXED_ASSETS: FixedAsset[] = [
  { id:'FA-001', name:'Church Main Auditorium', category:'Buildings', code:'BLD-001', acquisition_date:'2008-01-01', acquisition_cost:60000000, useful_life:50, depreciation_method:'straight_line', salvage_value:6000000, accumulated_depreciation:3060000, location:'Plot 42, Victoria Island', status:'active', serial_number:'N/A', supplier:'Eko Builders Ltd' },
  { id:'FA-002', name:'Administrative Block', category:'Buildings', code:'BLD-002', acquisition_date:'2015-06-01', acquisition_cost:25000000, useful_life:50, depreciation_method:'straight_line', salvage_value:2500000, accumulated_depreciation:1190000, location:'Plot 42, Victoria Island', status:'active', serial_number:'N/A', supplier:'Eko Builders Ltd' },
  { id:'FA-003', name:'Toyota Hiace Bus (Church Bus 1)', category:'Motor Vehicles', code:'VEH-001', acquisition_date:'2020-03-15', acquisition_cost:7500000, useful_life:5, depreciation_method:'straight_line', salvage_value:750000, accumulated_depreciation:5250000, location:'Church Compound', status:'active', serial_number:'ABC-123-LG', supplier:'CFAO Motors' },
  { id:'FA-004', name:'Toyota Hilux Pickup', category:'Motor Vehicles', code:'VEH-002', acquisition_date:'2022-08-01', acquisition_cost:5000000, useful_life:5, depreciation_method:'straight_line', salvage_value:500000, accumulated_depreciation:1350000, location:'Church Compound', status:'active', serial_number:'XYZ-456-LG', supplier:'CFAO Motors' },
  { id:'FA-005', name:'Professional Sound System', category:'Equipment', code:'EQP-001', acquisition_date:'2021-01-20', acquisition_cost:3200000, useful_life:8, depreciation_method:'straight_line', salvage_value:320000, accumulated_depreciation:1080000, location:'Main Auditorium', status:'active', serial_number:'SS-YAMAHAMIX-01', supplier:'TechPro Nigeria Ltd' },
  { id:'FA-006', name:'LED Projector & Screen System', category:'Equipment', code:'EQP-002', acquisition_date:'2025-01-15', acquisition_cost:1200000, useful_life:5, depreciation_method:'straight_line', salvage_value:120000, accumulated_depreciation:0, location:'Main Auditorium', status:'active', serial_number:'EPSON-4K-2025', supplier:'TechPro Nigeria Ltd' },
  { id:'FA-007', name:'Office Furniture Set (Admin)', category:'Furniture', code:'FUR-001', acquisition_date:'2019-04-01', acquisition_cost:1800000, useful_life:10, depreciation_method:'straight_line', salvage_value:180000, accumulated_depreciation:936000, location:'Admin Block', status:'active', serial_number:'BATCH-2019-OF', supplier:'Home & Office Nig' },
  { id:'FA-008', name:'Power Generator (100KVA)', category:'Plant & Machinery', code:'PLT-001', acquisition_date:'2018-09-01', acquisition_cost:4500000, useful_life:10, depreciation_method:'reducing_balance', salvage_value:450000, accumulated_depreciation:3150000, location:'Generator House', status:'active', serial_number:'MIKANO-100KVA-18', supplier:'Mikano International' },
];

export const STAFF_MEMBERS: StaffMember[] = [
  { id:'EMP-001', name:'Rev. David Okafor', department:'Pastoral', role:'Senior Pastor', grade:'LP-1', gross_salary:800000, paye:180000, pension_employee:80000, pension_employer:80000, nhf:4000, nsitf:8000, net_pay:528000, bank:'GTBank', account_no:'0123456001', start_date:'2010-01-01', status:'active' },
  { id:'EMP-002', name:'Pastor Emeka Eze', department:'Pastoral', role:'Associate Pastor', grade:'LP-2', gross_salary:500000, paye:90000, pension_employee:50000, pension_employer:50000, nhf:2500, nsitf:5000, net_pay:352500, bank:'Zenith Bank', account_no:'1122334001', start_date:'2015-03-01', status:'active' },
  { id:'EMP-003', name:'Mrs. Chioma Adeyemi', department:'Administration', role:'Church Secretary', grade:'SS-3', gross_salary:250000, paye:32000, pension_employee:25000, pension_employer:25000, nhf:1250, nsitf:2500, net_pay:189250, bank:'Access Bank', account_no:'9876543001', start_date:'2018-06-01', status:'active' },
  { id:'EMP-004', name:'Mr. Tunde Balogun', department:'Finance', role:'Accountant', grade:'SS-2', gross_salary:300000, paye:42000, pension_employee:30000, pension_employer:30000, nhf:1500, nsitf:3000, net_pay:223500, bank:'UBA', account_no:'5544332001', start_date:'2019-01-15', status:'active' },
  { id:'EMP-005', name:'Mr. Segun Adeleke', department:'Media', role:'Media Director', grade:'SS-2', gross_salary:280000, paye:38000, pension_employee:28000, pension_employer:28000, nhf:1400, nsitf:2800, net_pay:209800, bank:'GTBank', account_no:'0199887001', start_date:'2020-09-01', status:'active' },
  { id:'EMP-006', name:'Miss Ngozi Eze', department:'Youth Ministry', role:'Youth Coordinator', grade:'SS-1', gross_salary:180000, paye:18000, pension_employee:18000, pension_employer:18000, nhf:900, nsitf:1800, net_pay:141300, bank:'First Bank', account_no:'3322114001', start_date:'2021-07-01', status:'active' },
  { id:'EMP-007', name:'Mr. Femi Adeola', department:'Facilities', role:'Facility Manager', grade:'SS-1', gross_salary:200000, paye:22000, pension_employee:20000, pension_employer:20000, nhf:1000, nsitf:2000, net_pay:155000, bank:'Ecobank', account_no:'8866554001', start_date:'2017-04-01', status:'active' },
  { id:'EMP-008', name:'Mrs. Yetunde Okonkwo', department:'Pastoral Support', role:'PA to Senior Pastor', grade:'SS-2', gross_salary:260000, paye:34000, pension_employee:26000, pension_employer:26000, nhf:1300, nsitf:2600, net_pay:196100, bank:'GTBank', account_no:'0155443001', start_date:'2016-11-01', status:'active' },
];

export const VAT_ENTRIES: VatEntry[] = [
  { id:'VAT-001', date:'2025-01-15', reference:'INV-TP-2025-089', description:'LED Projector purchase (TechPro)', type:'input', taxable_amount:1110000, vat_amount:90000, rate:7.5, vendor_customer:'TechPro Nigeria Ltd', status:'filed' },
  { id:'VAT-002', date:'2025-01-05', reference:'PROG-FEE-JAN', description:'Program fees collected — January', type:'output', taxable_amount:180000, vat_amount:13500, rate:7.5, vendor_customer:'Various Members', status:'filed' },
  { id:'VAT-003', date:'2025-02-10', reference:'HALL-RENT-FEB', description:'Hall rental fee collected', type:'output', taxable_amount:200000, vat_amount:15000, rate:7.5, vendor_customer:'Covenant Events Ltd', status:'filed' },
  { id:'VAT-004', date:'2025-04-01', reference:'OLA-2025-Q1-AUDIT', description:'Audit fee (Ola & Co.)', type:'input', taxable_amount:240000, vat_amount:18000, rate:7.5, vendor_customer:'Ola & Co. Chartered Accountants', status:'pending' },
  { id:'VAT-005', date:'2025-05-15', reference:'ARISEFM-ADV-2025', description:'Radio advertising (Arise FM)', type:'input', taxable_amount:312000, vat_amount:23400, rate:7.5, vendor_customer:'Arise FM / Radio', status:'pending' },
  { id:'VAT-006', date:'2025-05-01', reference:'PROG-FEE-MAY', description:'Program fees collected — May', type:'output', taxable_amount:220000, vat_amount:16500, rate:7.5, vendor_customer:'Various Members', status:'pending' },
];

export const AUDIT_LOG: AuditLog[] = [
  { id:'AUD-001', timestamp:'2025-05-30T09:14:22', user:'Accountant Mary', action:'Posted Journal Entry', module:'Ledger', entity_id:'JNL-011', before:'draft', after:'posted', ip:'192.168.1.45', severity:'info' },
  { id:'AUD-002', timestamp:'2025-05-28T14:30:00', user:'Treasurer', action:'Approved Bill', module:'Payables', entity_id:'BILL-003', before:'pending', after:'approved', ip:'192.168.1.12', severity:'info' },
  { id:'AUD-003', timestamp:'2025-05-25T11:05:30', user:'Admin User', action:'Modified Journal Entry', module:'Ledger', entity_id:'JNL-009', before:'amount:80000', after:'amount:75000', ip:'192.168.1.45', severity:'warning' },
  { id:'AUD-004', timestamp:'2025-05-20T08:00:00', user:'Accountant Mary', action:'Processed Payroll', module:'Payroll', entity_id:'PAY-MAY-2025', before:'draft', after:'processed', ip:'192.168.1.45', severity:'info' },
  { id:'AUD-005', timestamp:'2025-05-18T16:42:11', user:'Elder James', action:'Approved Withdrawal', module:'Treasury', entity_id:'WDR-008', before:'pending', after:'approved', ip:'192.168.1.88', severity:'info' },
  { id:'AUD-006', timestamp:'2025-05-15T10:11:00', user:'Unknown', action:'Failed Login Attempt', module:'Auth', entity_id:'N/A', before:'', after:'', ip:'41.58.120.99', severity:'critical' },
  { id:'AUD-007', timestamp:'2025-05-14T14:20:00', user:'Board Chair', action:'Approved Budget Amendment', module:'Budget', entity_id:'BUD-2025-Q2', before:'draft', after:'approved', ip:'192.168.1.100', severity:'info' },
  { id:'AUD-008', timestamp:'2025-05-10T09:30:00', user:'Accountant Mary', action:'Exported Financial Data', module:'Reports', entity_id:'RPT-Q1-2025', before:'', after:'CSV export triggered', ip:'192.168.1.45', severity:'warning' },
  { id:'AUD-009', timestamp:'2025-05-05T11:00:00', user:'Accountant Mary', action:'Remitted PAYE', module:'Tax', entity_id:'PAYE-APR-2025', before:'outstanding', after:'remitted', ip:'192.168.1.45', severity:'info' },
  { id:'AUD-010', timestamp:'2025-04-30T17:00:00', user:'Treasurer', action:'Filed VAT Return', module:'Tax', entity_id:'VAT-Q1-2025', before:'pending', after:'filed', ip:'192.168.1.12', severity:'info' },
];
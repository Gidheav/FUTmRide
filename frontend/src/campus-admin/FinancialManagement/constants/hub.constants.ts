// ─────────────────────────────────────────────────────────────────────────────
// hub.constants.ts
// All module-scope constants for FinancialHub (FinancialSanctum.tsx)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type { Period, HubTab, BudgetLine, Tx } from '../types/financial.types';

// ─── Periods ──────────────────────────────────────────────────────────────────

export const PERIODS: { key: Period; label: string }[] = [
  { key: '1D',  label: 'Today'    },
  { key: '7D',  label: '7 Days'   },
  { key: '30D', label: '30 Days'  },
  { key: '90D', label: '90 Days'  },
  { key: 'YTD', label: 'YTD'      },
  { key: '1Y',  label: '1 Year'   },
  { key: 'ALL', label: 'All Time' },
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export const TABS: { key: HubTab; icon: string; label: string }[] = [
  { key: 'overview',     icon: 'dashboard',          label: 'Overview'     },
  { key: 'transactions', icon: 'receipt_long',        label: 'Transactions' },
  // { key: 'giving',       icon: 'volunteer_activism',  label: 'Giving'       }, // HIDDEN FOR PRODUCTION | Will be restored in v2.0
  // { key: 'budget',       icon: 'account_balance',     label: 'Budget'       }, // HIDDEN FOR PRODUCTION | Will be restored in v2.0
  { key: 'members',      icon: 'groups',              label: 'Members'      },
  { key: 'reports',      icon: 'summarize',           label: 'Reports'      },
  { key: 'payouts',      icon: 'send',                label: 'Payouts'      },
];

// ─── Budget lines ─────────────────────────────────────────────────────────────

export const BUDGET_LINES: BudgetLine[] = [
  { department: 'Ministry Operations', icon: 'church',               color: '#10b981', allocated_amount: 5000000, spent: 3820000 },
  { department: 'Media & Technology',  icon: 'cast',                 color: '#8b5cf6', allocated_amount: 2000000, spent: 2180000 },
  { department: 'Youth Programs',      icon: 'groups',               color: '#3b82f6', allocated_amount: 1500000, spent: 920000  },
  { department: 'Missions',            icon: 'flight',               color: '#f59e0b', allocated_amount: 4800000, spent: 3150000 },
  { department: 'Benevolence Fund',    icon: 'favorite',             color: '#ec4899', allocated_amount: 1200000, spent: 740000  },
  { department: 'Administration',      icon: 'admin_panel_settings', color: '#64748b', allocated_amount: 800000,  spent: 610000  },
];

// ─── Category colors ──────────────────────────────────────────────────────────

export const CAT_COLORS: Record<string, { stroke: string; fill: string; badge: string; dot: string }> = {
  Tithes:      { stroke: '#10b981', fill: 'rgba(16,185,129,0.15)',  badge: 'bg-emerald-50 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700', dot: '#10b981' },
  Offerings:   { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.15)',  badge: 'bg-blue-50 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',                  dot: '#3b82f6' },
  Projects:    { stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.15)',  badge: 'bg-violet-50 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700',        dot: '#8b5cf6' },
  Fundraising: { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.15)',  badge: 'bg-amber-50 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',             dot: '#f59e0b' },
  General:     { stroke: '#64748b', fill: 'rgba(100,116,139,0.15)', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600',               dot: '#64748b' },
};

// ─── Transaction status meta ──────────────────────────────────────────────────

export const STATUS_META: Record<string, { dot: string; text: string; bg: string; border: string; label: string }> = {
  SUCCESS:    { dot: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-900/40', border: 'border-emerald-700/60', label: 'Success'    },
  FAILED:     { dot: '#ef4444', text: 'text-red-400',     bg: 'bg-red-900/40',     border: 'border-red-700/60',     label: 'Failed'     },
  PROCESSING: { dot: '#f59e0b', text: 'text-amber-400',   bg: 'bg-amber-900/40',   border: 'border-amber-700/60',   label: 'Processing' },
  PENDING:    { dot: '#60a5fa', text: 'text-blue-400',    bg: 'bg-blue-900/40',    border: 'border-blue-700/60',    label: 'Pending'    },
};

export const DEF_STATUS = {
  dot: '#64748b', text: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-600', label: 'Unknown',
};

// ─── Withdrawal status meta ───────────────────────────────────────────────────

export const WSTATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending:      { color: '#60a5fa', bg: 'bg-blue-900/40',    label: 'Pending'      },
  approved:     { color: '#a78bfa', bg: 'bg-violet-900/40',  label: 'Approved'     },
  processing:   { color: '#f59e0b', bg: 'bg-amber-900/40',   label: 'Processing'   },
  otp_required: { color: '#fb923c', bg: 'bg-orange-900/40',  label: 'OTP Required' },
  completed:    { color: '#10b981', bg: 'bg-emerald-900/40', label: 'Completed'    },
  failed:       { color: '#f87171', bg: 'bg-red-900/40',     label: 'Failed'       },
  cancelled:    { color: '#64748b', bg: 'bg-slate-800',      label: 'Cancelled'    },
  timed_out:    { color: '#f87171', bg: 'bg-red-900/40',     label: 'Timed Out'    },
};

// ─── Stale threshold (30-min Paystack SLA) ────────────────────────────────────

export const STALE_MS = 30 * 60 * 1000;

// ─── Avatar gradients ─────────────────────────────────────────────────────────

export const AVATAR_G = [
  'from-emerald-600 to-teal-500', 'from-blue-600 to-cyan-500',
  'from-violet-600 to-purple-500', 'from-amber-600 to-orange-500',
  'from-rose-600 to-pink-500', 'from-indigo-600 to-blue-500',
];

// ─── Scroll style ─────────────────────────────────────────────────────────────

export const THIN: React.CSSProperties = { scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' };

export const PANEL_W = 420;

// ─── Light-mode CSS ───────────────────────────────────────────────────────────

export const FH_CSS = `
:not(.dark) .fh {
  --fh-bg:        #f8fafc;
  --fh-surface:   #ffffff;
  --fh-surface2:  #f1f5f9;
  --fh-surface3:  #e2e8f0;
  --fh-border:    #e2e8f0;
  --fh-border2:   #cbd5e1;
  --fh-text1:     #0f172a;
  --fh-text2:     #334155;
  --fh-text3:     #64748b;
  --fh-text4:     #94a3b8;
  --fh-input-bg:  #f8fafc;
  --fh-row-even:  #ffffff;
  --fh-row-odd:   #f8fafc;
  --fh-row-hover: #f1f5f9;
  --fh-row-sel:   rgba(16,185,129,0.06);
  --fh-row-sel-border: rgba(16,185,129,0.2);
}
.dark .fh {
  --fh-bg:        #020617;
  --fh-surface:   #0f172a;
  --fh-surface2:  #1e293b;
  --fh-surface3:  #334155;
  --fh-border:    #1e293b;
  --fh-border2:   #334155;
  --fh-text1:     #f1f5f9;
  --fh-text2:     #cbd5e1;
  --fh-text3:     #64748b;
  --fh-text4:     #475569;
  --fh-input-bg:  rgba(30,41,59,0.8);
  --fh-row-even:  #020617;
  --fh-row-odd:   rgba(15,23,42,.3);
  --fh-row-hover: rgba(30,41,59,0.6);
  --fh-row-sel:   rgba(6,78,59,.2);
  --fh-row-sel-border: rgba(6,78,59,.4);
}
.fh { background: var(--fh-bg); }
.fh-bar { background: var(--fh-surface); border-bottom: 1px solid var(--fh-border); }
.fh-tabs { border-top: 1px solid var(--fh-border); }
.fh-card { background: var(--fh-surface) !important; border-color: var(--fh-border) !important; }
.fh-bar-track { background: var(--fh-surface2) !important; }
.fh-toolbar { background: var(--fh-surface) !important; border-bottom: 1px solid var(--fh-border) !important; }
.fh-thead { background: var(--fh-surface2) !important; border-bottom: 1px solid var(--fh-border2) !important; }
.fh-row-even { background: var(--fh-row-even) !important; border-color: var(--fh-border) !important; }
.fh-row-odd  { background: var(--fh-row-odd)  !important; border-color: var(--fh-border) !important; }
.fh-row-even:hover,.fh-row-odd:hover { background: var(--fh-row-hover) !important; }
.fh-row-sel  { background: var(--fh-row-sel)  !important; border-color: var(--fh-row-sel-border) !important; }
.fh-input {
  background: var(--fh-input-bg) !important;
  border-color: var(--fh-border2) !important;
  color: var(--fh-text2) !important;
}
.fh-input::placeholder { color: var(--fh-text4) !important; }
.fh-input:focus { border-color: #10b981 !important; }
.fh-panel { background: var(--fh-surface) !important; border-left-color: var(--fh-border) !important; }
.fh-panel-inner { background: var(--fh-surface2) !important; border-color: var(--fh-border) !important; }
:not(.dark) .fh table thead tr { background: var(--fh-surface2) !important; }
:not(.dark) .fh .fh-divider { border-color: var(--fh-border) !important; }
:not(.dark) .fh { scrollbar-color: #cbd5e1 transparent; }
@keyframes fh-spin { to { transform: rotate(360deg); } }
@keyframes fh-ping { 0%,100%{opacity:.2;transform:scale(1)} 50%{opacity:.4;transform:scale(1.15)} }
@keyframes fh-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
.fh-spin { animation: fh-spin 0.8s linear infinite; }
.fh-ping { animation: fh-ping 1.5s ease-in-out infinite; }
.fh-bounce-1 { animation: fh-bounce 1s ease-in-out infinite; animation-delay:0ms; }
.fh-bounce-2 { animation: fh-bounce 1s ease-in-out infinite; animation-delay:150ms; }
.fh-bounce-3 { animation: fh-bounce 1s ease-in-out infinite; animation-delay:300ms; }
`;

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_NAMES = [
  'Emeka Okafor','Chioma Adeyemi','Tunde Balogun','Ngozi Eze',
  'Segun Adeleke','Amaka Obi','Kola Adesanya','Ifeoma Nwosu',
  'Rotimi Akintola','Yetunde Okonkwo','Babatunde Alabi','Chiamaka Ugwu',
  'Femi Adeola','Nkechi Obiora','Gbenga Olawale','Ada Nnamdi',
  'Sunday Adebayo','Chinwe Osei','Taiwo Fadahunsi','Blessing Onyeka',
];

export const MOCK_CATS = ['Tithes', 'Offerings', 'Projects', 'Fundraising'];

function seed(s: number) {
  let x = s;
  return () => { x = (x * 1664525 + 1013904223) & 0xffffffff; return (x >>> 0) / 4294967296; };
}

export function genMockTransactions(count = 400): Tx[] {
  const rng = seed(42);
  const now  = Date.now();
  const year = 365 * 86400000;
  return Array.from({ length: count }, (_, i) => {
    const r     = rng;
    const name  = MOCK_NAMES[Math.floor(r() * MOCK_NAMES.length)];
    const email = name.toLowerCase().replace(/ /g, '.') + '@email.com';
    const cat   = MOCK_CATS[Math.floor(r() * MOCK_CATS.length)];
    const baseAmounts = [5000, 10000, 20000, 50000, 100000, 200000, 500000];
    const amount = baseAmounts[Math.floor(r() * baseAmounts.length)] * 100;
    const createdAt = new Date(now - r() * year).toISOString();
    const statuses  = ['SUCCESS','SUCCESS','SUCCESS','SUCCESS','FAILED','PENDING','PROCESSING'];
    const status    = statuses[Math.floor(r() * statuses.length)];
    const methods   = ['card','bank_transfer','ussd','bank_transfer','card'];
    return {
      id: `tx_${(i + 1).toString().padStart(6, '0')}`,
      user_email: email,
      user_name: name,
      reference: `FHB-${Date.now().toString(36).toUpperCase()}-${i}`,
      amount,
      currency: 'NGN',
      status,
      status_label: status.charAt(0) + status.slice(1).toLowerCase(),
      payment_method: methods[Math.floor(r() * methods.length)],
      amount_verified: status === 'SUCCESS',
      paid_at: status === 'SUCCESS' ? createdAt : null,
      created_at: createdAt,
      metadata: { giving_category: cat, source: 'giving_page' },
    };
  });
}

export const MOCK_TXS = genMockTransactions(400);
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
  'Ride Payments':       { stroke: '#10b981', fill: 'rgba(16,185,129,0.15)',  badge: 'bg-emerald-50 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700', dot: '#10b981' },
  'Wallet Top-ups':      { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.15)',  badge: 'bg-blue-50 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',                  dot: '#3b82f6' },
  'Platform Commission': { stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.15)',  badge: 'bg-violet-50 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700',        dot: '#8b5cf6' },
  Refunds:               { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.15)',  badge: 'bg-amber-50 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',             dot: '#f59e0b' },
  'Driver Withdrawals':  { stroke: '#64748b', fill: 'rgba(100,116,139,0.15)', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600',               dot: '#64748b' },
  Promotions:            { stroke: '#ec4899', fill: 'rgba(236,72,153,0.15)',  badge: 'bg-pink-50 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-700',                   dot: '#ec4899' },
  General:               { stroke: '#64748b', fill: 'rgba(100,116,139,0.15)', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600',               dot: '#64748b' },
  // Legacy church categories (Reports / mock data)
  Tithes:      { stroke: '#10b981', fill: 'rgba(16,185,129,0.15)',  badge: 'bg-emerald-50 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700', dot: '#10b981' },
  Offerings:   { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.15)',  badge: 'bg-blue-50 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',                  dot: '#3b82f6' },
  Projects:    { stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.15)',  badge: 'bg-violet-50 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700',        dot: '#8b5cf6' },
  Fundraising: { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.15)',  badge: 'bg-amber-50 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',             dot: '#f59e0b' },
};

// ─── Transaction status meta ──────────────────────────────────────────────────

export const STATUS_META: Record<string, { dot: string; text: string; bg: string; border: string; label: string }> = {
  SUCCESS:    { dot: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-900/40', border: 'border-emerald-700/60', label: 'Success'    },
  FAILED:     { dot: '#ef4444', text: 'text-red-400',     bg: 'bg-red-900/40',     border: 'border-red-700/60',     label: 'Failed'     },
  PROCESSING: { dot: '#f59e0b', text: 'text-amber-400',   bg: 'bg-amber-900/40',   border: 'border-amber-700/60',   label: 'Processing' },
  PENDING:    { dot: '#60a5fa', text: 'text-blue-400',    bg: 'bg-blue-900/40',    border: 'border-blue-700/60',    label: 'Pending'    },
  DISPUTED:   { dot: '#f97316', text: 'text-orange-400',  bg: 'bg-orange-900/40',  border: 'border-orange-700/60',  label: 'Disputed'   },
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
.campus-theme-dark .fh,
.campus-theme-light .fh {
  --fh-bg:        var(--theme-bg, #0b0f19);
  --fh-surface:   var(--theme-bgPanel, #111827);
  --fh-surface2:  var(--theme-bgCard, #151c2c);
  --fh-surface3:  var(--theme-bgCardHover, #1a2236);
  --fh-border:    var(--theme-border, #1e293b);
  --fh-border2:   var(--theme-borderLight, #263045);
  --fh-text1:     var(--theme-textPrimary, #e2e8f0);
  --fh-text2:     var(--theme-textSecondary, #94a3b8);
  --fh-text3:     var(--theme-textMuted, #64748b);
  --fh-text4:     var(--theme-textMuted, #64748b);
  --fh-input-bg:  var(--theme-bgInput, #0f1525);
  --fh-accent:    var(--theme-accent, #a855f7);
  --fh-accent-bg: var(--theme-accentBg, rgba(168,85,247,0.12));
  --fh-row-even:  var(--theme-bg, #0b0f19);
  --fh-row-odd:   var(--theme-bgCard, #151c2c);
  --fh-row-hover: var(--theme-bgCardHover, #1a2236);
  --fh-row-sel:   var(--theme-accentBg, rgba(168,85,247,0.12));
  --fh-row-sel-border: var(--theme-borderLight, #263045);
  --fh-font: var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}
.fh { background: var(--fh-bg); font-family: var(--fh-font); }
.fh,
.fh *:not(svg):not(path):not(circle):not(rect):not(line):not(polyline):not(polygon) {
  font-family: var(--fh-font) !important;
}
.fh svg text,
.fh input,
.fh button,
.fh select,
.fh textarea {
  font-family: var(--fh-font) !important;
}
.fh-bar { background: var(--fh-surface); border-bottom: 1px solid var(--fh-border); }
.fh-tabs { border-top: 1px solid var(--fh-border); }
.fh-card {
  background: var(--fh-surface) !important;
  border: 1px solid var(--fh-border) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
/* Tailwind v4 utilities are layered, while the app reset is unlayered.
   Re-apply the Finance spacing utilities so card content does not touch borders. */
.fh .p-1 { padding: 0.25rem !important; }
.fh .p-1\\.5 { padding: 0.375rem !important; }
.fh .p-2 { padding: 0.5rem !important; }
.fh .p-2\\.5 { padding: 0.625rem !important; }
.fh .p-3 { padding: 0.75rem !important; }
.fh .p-4 { padding: 1rem !important; }
.fh .p-5 { padding: 1.25rem !important; }
.fh .p-6 { padding: 1.5rem !important; }
.fh .p-8 { padding: 2rem !important; }
.fh .p-10 { padding: 2.5rem !important; }
.fh .p-12 { padding: 3rem !important; }
.fh .p-16 { padding: 4rem !important; }

.fh .px-0\\.5 { padding-left: 0.125rem !important; padding-right: 0.125rem !important; }
.fh .px-1 { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
.fh .px-1\\.5 { padding-left: 0.375rem !important; padding-right: 0.375rem !important; }
.fh .px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
.fh .px-2\\.5 { padding-left: 0.625rem !important; padding-right: 0.625rem !important; }
.fh .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
.fh .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
.fh .px-5 { padding-left: 1.25rem !important; padding-right: 1.25rem !important; }
.fh .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
.fh .px-8 { padding-left: 2rem !important; padding-right: 2rem !important; }
.fh .px-10 { padding-left: 2.5rem !important; padding-right: 2.5rem !important; }

.fh .py-0\\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
.fh .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
.fh .py-1\\.5 { padding-top: 0.375rem !important; padding-bottom: 0.375rem !important; }
.fh .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
.fh .py-2\\.5 { padding-top: 0.625rem !important; padding-bottom: 0.625rem !important; }
.fh .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
.fh .py-3\\.5 { padding-top: 0.875rem !important; padding-bottom: 0.875rem !important; }
.fh .py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
.fh .py-5 { padding-top: 1.25rem !important; padding-bottom: 1.25rem !important; }
.fh .py-6 { padding-top: 1.5rem !important; padding-bottom: 1.5rem !important; }
.fh .py-8 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
.fh .py-10 { padding-top: 2.5rem !important; padding-bottom: 2.5rem !important; }
.fh .py-12 { padding-top: 3rem !important; padding-bottom: 3rem !important; }
.fh .py-16 { padding-top: 4rem !important; padding-bottom: 4rem !important; }
.fh .py-20 { padding-top: 5rem !important; padding-bottom: 5rem !important; }

.fh .pt-1 { padding-top: 0.25rem !important; }
.fh .pt-2 { padding-top: 0.5rem !important; }
.fh .pb-3 { padding-bottom: 0.75rem !important; }
.fh .pl-4 { padding-left: 1rem !important; }
.fh .pl-5 { padding-left: 1.25rem !important; }
.fh .pl-8 { padding-left: 2rem !important; }
.fh .pr-2 { padding-right: 0.5rem !important; }
.fh .pr-3 { padding-right: 0.75rem !important; }
.fh .pr-4 { padding-right: 1rem !important; }
.fh .pr-6 { padding-right: 1.5rem !important; }

.fh .mt-0\\.5 { margin-top: 0.125rem !important; }
.fh .mt-1 { margin-top: 0.25rem !important; }
.fh .mt-1\\.5 { margin-top: 0.375rem !important; }
.fh .mt-2 { margin-top: 0.5rem !important; }
.fh .mt-3 { margin-top: 0.75rem !important; }
.fh .mt-4 { margin-top: 1rem !important; }
.fh .mt-5 { margin-top: 1.25rem !important; }
.fh .mb-1 { margin-bottom: 0.25rem !important; }
.fh .mb-1\\.5 { margin-bottom: 0.375rem !important; }
.fh .mb-2 { margin-bottom: 0.5rem !important; }
.fh .mb-3 { margin-bottom: 0.75rem !important; }
.fh .mb-4 { margin-bottom: 1rem !important; }
.fh .mb-5 { margin-bottom: 1.25rem !important; }
.fh .ml-auto { margin-left: auto !important; }
.fh .ml-2 { margin-left: 0.5rem !important; }
.fh .mx-auto { margin-left: auto !important; margin-right: auto !important; }
.fh .my-0\\.5 { margin-top: 0.125rem !important; margin-bottom: 0.125rem !important; }

.fh .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem !important; }
.fh .space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.375rem !important; }
.fh .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem !important; }
.fh .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem !important; }
.fh .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem !important; }
.fh .space-y-5 > :not([hidden]) ~ :not([hidden]) { margin-top: 1.25rem !important; }
.fh-bar-track { background: var(--fh-surface2) !important; border-radius: 0 !important; }
.fh-toolbar { background: var(--fh-surface) !important; border-bottom: 1px solid var(--fh-border) !important; }
.fh-thead { background: var(--fh-surface2) !important; border-bottom: 1px solid var(--fh-border2) !important; }
.fh-row-even { background: var(--fh-row-even) !important; border-color: var(--fh-border) !important; }
.fh-row-odd  { background: var(--fh-row-odd)  !important; border-color: var(--fh-border) !important; }
.fh-row-even:hover,.fh-row-odd:hover { background: var(--fh-row-hover) !important; }
.fh-row-sel  { background: var(--fh-row-sel)  !important; border-color: var(--fh-row-sel-border) !important; }
.fh-input {
  background: var(--fh-input-bg) !important;
  border: 1px solid var(--fh-border2) !important;
  color: var(--fh-text1) !important;
  border-radius: 0 !important;
}
.fh-input::placeholder { color: var(--fh-text4) !important; }
.fh-input:focus { border-color: var(--fh-accent) !important; outline: none !important; box-shadow: 0 0 0 1px var(--fh-accent-bg) !important; }
.fh-panel { background: var(--fh-surface) !important; border-left: 1px solid var(--fh-border) !important; }
.fh-panel-inner { background: var(--fh-surface2) !important; border-color: var(--fh-border) !important; border-radius: 0 !important; }
.fh table thead tr { background: var(--fh-surface2) !important; }
.fh .fh-divider { border-color: var(--fh-border) !important; }
.fh { scrollbar-color: var(--fh-border2) transparent; }
.fh .rounded-md,
.fh .rounded-lg,
.fh .rounded-xl,
.fh .rounded-2xl {
  border-radius: 0 !important;
}
@keyframes fh-spin { to { transform: rotate(360deg); } }
@keyframes fh-ping { 0%,100%{opacity:.2;transform:scale(1)} 50%{opacity:.4;transform:scale(1.15)} }
@keyframes fh-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
.fh-spin { animation: fh-spin 0.8s linear infinite; }
.fh-ping { animation: fh-ping 1.5s ease-in-out infinite; }
.fh-bounce-1 { animation: fh-bounce 1s ease-in-out infinite; animation-delay:0ms; }
.fh-bounce-2 { animation: fh-bounce 1s ease-in-out infinite; animation-delay:150ms; }
.fh-bounce-3 { animation: fh-bounce 1s ease-in-out infinite; animation-delay:300ms; }

/* ─── Reports toolkit (explicit CSS — Tailwind grid/flex/text fail inside .fh) ─── */
.fh-reports-layout {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 520px;
}
@media (min-width: 1024px) {
  .fh-reports-layout { flex-direction: row; }
  .fh-reports-sidebar { width: 13rem; flex-shrink: 0; }
  .fh-reports-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
}
.fh-reports-nav { display: flex; flex-direction: column; gap: 4px; }
.fh-reports-nav-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 600;
  border: 1px solid transparent; background: transparent; cursor: pointer;
  color: var(--fh-text2, #94a3b8); width: 100%;
}
.fh-reports-nav-btn.is-active {
  background: var(--fh-accent-bg, rgba(168,85,247,0.12));
  color: var(--fh-accent, #a855f7);
  border-color: color-mix(in srgb, var(--fh-accent, #a855f7) 35%, transparent);
}
.fh-reports-cat-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; text-align: left; font-size: 10px;
  border: none; background: transparent; cursor: pointer; width: 100%;
  color: var(--fh-text2, #94a3b8);
}
.fh-reports-cat-btn.is-active { color: var(--fh-accent, #a855f7); background: var(--fh-accent-bg, rgba(168,85,247,0.12)); }
.fh-report-search-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: var(--fh-surface, #111827);
  border: 1px solid var(--fh-border, #1e293b);
}
.fh-report-search-wrap { position: relative; flex: 1; min-width: 0; }
.fh-report-search-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--fh-text3, #64748b); pointer-events: none;
}
.fh-report-search-input {
  width: 100%; height: 36px; padding: 0 36px 0 38px;
  font-size: 12px; font-family: inherit;
  background: var(--fh-input-bg, #0f1525) !important;
  border: 1px solid var(--fh-border, #1e293b) !important;
  color: var(--fh-text1, #e2e8f0) !important;
  outline: none;
}
.fh-report-search-input::placeholder { color: var(--fh-text4, #64748b) !important; }
.fh-report-search-input:focus {
  border-color: var(--fh-accent, #a855f7) !important;
  box-shadow: 0 0 0 1px var(--fh-accent-bg, rgba(168,85,247,0.2)) !important;
}
.fh-report-search-clear {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  border: none; background: transparent; cursor: pointer; color: var(--fh-text3, #64748b);
  padding: 4px; display: flex; align-items: center; justify-content: center;
}
.fh-report-search-meta { font-size: 10px; color: var(--fh-text3, #64748b); white-space: nowrap; flex-shrink: 0; }
.fh-reports-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 4px;
  max-height: 620px;
  overflow-y: auto;
  padding-right: 2px;
}
@media (min-width: 640px) { .fh-reports-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .fh-reports-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1280px) { .fh-reports-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.fh .fh-report-card {
  min-height: 10.5rem;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
.fh .fh-report-card.is-selectable { cursor: pointer; }
.fh .fh-report-card.is-selectable .fh-report-card-body { cursor: pointer; }
.fh .fh-report-card.is-expanded {
  outline: 1px solid var(--fh-accent, #a855f7);
  outline-offset: -1px;
}
.fh .fh-report-card.is-expanded .fh-report-card-btn { cursor: pointer; }
.fh-report-card-accent { height: 2px; width: 100%; flex-shrink: 0; }
.fh-report-card-body {
  padding: 10px 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.fh-report-card-clickable {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.fh-report-card-more-hint {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 4px 0 0;
  color: var(--fh-text3, #64748b) !important;
  flex-shrink: 0;
}
.fh-report-card-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 6px; margin-bottom: 8px;
}
.fh-report-card-iconbox {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fh-report-card-badge {
  font-size: 9px; font-weight: 700; padding: 2px 6px;
  border-radius: 2px; border: 1px solid; flex-shrink: 0;
}
.fh-report-card-title {
  font-size: 12px; font-weight: 600; line-height: 1.35;
  margin: 0 0 6px; color: var(--fh-text1, #e2e8f0) !important;
}
.fh-report-card-desc {
  font-size: 10px; line-height: 1.45; margin: 0 0 8px;
  min-height: 2rem; flex: 1;
  color: var(--fh-text2, #94a3b8) !important;
}
.fh-report-card-consent {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  margin: 0 0 10px; color: var(--theme-warn, #f59e0b) !important;
}
.fh-report-card-btn {
  width: 100%; height: 32px; margin-top: auto;
  font-size: 10px; font-weight: 700; letter-spacing: 0.02em;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  cursor: pointer; border-radius: 6px; border: 1px solid;
}
.fh-report-card-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fh-report-card-alt {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 4px; margin-top: 6px; padding-top: 6px;
  border-top: 1px solid var(--fh-border, #1e293b);
}
.fh-report-card-alt-label { font-size: 8px; text-transform: uppercase; color: var(--fh-text3, #64748b) !important; }
.fh-report-card-alt-btn {
  font-size: 9px; font-weight: 600; background: none; border: none;
  cursor: pointer; color: var(--fh-text2, #94a3b8) !important; text-decoration: underline;
  padding: 0;
}
.fh-report-card-alt-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ─── Payouts tab ─── */
.fh-payouts-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@media (min-width: 768px) { .fh-payouts-kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.fh-payout-kpi {
  padding: 16px 18px;
  background: var(--fh-surface, #111827);
  border: 1px solid var(--fh-border, #1e293b);
  min-height: 88px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.fh-payout-kpi-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--fh-text3, #64748b); margin: 0 0 8px;
}
.fh-payout-kpi-value {
  font-size: 22px; font-weight: 700;
  color: var(--fh-text1, #e2e8f0); margin: 0; line-height: 1.1;
}
.fh-payout-toolbar-row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: var(--fh-surface, #111827);
  border: 1px solid var(--fh-border, #1e293b);
}
.fh-payout-filter-select {
  height: 34px; padding: 0 10px; font-size: 11px;
  background: var(--fh-input-bg, #0f1525); border: 1px solid var(--fh-border, #1e293b);
  color: var(--fh-text1, #e2e8f0); outline: none; min-width: 120px;
}
.fh-payout-search-wrap { position: relative; flex: 1; min-width: 160px; }
.fh-payout-search-input {
  width: 100%; height: 34px; padding: 0 12px 0 34px;
  font-size: 11px; background: var(--fh-input-bg, #0f1525);
  border: 1px solid var(--fh-border, #1e293b); color: var(--fh-text1, #e2e8f0); outline: none;
}
.fh-payout-search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  pointer-events: none;
}
.fh-payout-bank-list { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; }
.fh-payout-bank-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 10px; color: var(--fh-text2, #94a3b8);
}
.fh-payout-bank-bar-wrap {
  flex: 1; height: 4px; background: var(--fh-border, #1e293b); margin: 0 10px; overflow: hidden;
}
.fh-payout-bank-bar { height: 100%; background: var(--fh-text3, #64748b); }
.fh-payout-table-wrap { overflow-x: auto; }
.fh-payout-table { width: 100%; min-width: 720px; border-collapse: collapse; }
.fh-payout-table th {
  padding: 10px 14px; text-align: left;
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--fh-text3, #64748b);
  background: var(--fh-surface2, #151c2c);
  border-bottom: 1px solid var(--fh-border, #1e293b);
}
.fh-payout-table td {
  padding: 10px 14px; font-size: 10px; color: var(--fh-text2, #cbd5e1);
  border-bottom: 1px solid var(--fh-border, #1e293b);
}
.fh-payout-table tr.fh-row-even td { background: var(--fh-row-even, #0b0f19); }
.fh-payout-table tr.fh-row-odd td { background: var(--fh-row-odd, #151c2c); }
.fh-payout-status {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase;
  border: 1px solid;
}
.fh-payout-pagination {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-top: 1px solid var(--fh-border, #1e293b);
  font-size: 10px; color: var(--fh-text3, #64748b);
}
.fh-payout-page-btns { display: flex; gap: 6px; }
.fh-payout-page-btn {
  padding: 4px 10px; font-size: 10px; font-weight: 600;
  background: var(--fh-input-bg, #0f1525); border: 1px solid var(--fh-border2, #334155); color: var(--fh-text2, #94a3b8); cursor: pointer;
}
.fh-payout-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.campus-theme-light .fh .text-slate-200,
.campus-theme-light .fh .text-slate-300,
.campus-theme-light .fh .text-white {
  color: var(--fh-text1) !important;
}
.campus-theme-light .fh .text-slate-400,
.campus-theme-light .fh .text-slate-500 {
  color: var(--fh-text2) !important;
}
.campus-theme-light .fh .text-slate-600 {
  color: var(--fh-text3) !important;
}
.campus-theme-light .fh .border-slate-700,
.campus-theme-light .fh .border-slate-800,
.campus-theme-light .fh .border-slate-800\\/40,
.campus-theme-light .fh .border-slate-800\\/60,
.campus-theme-light .fh .border-slate-900,
.campus-theme-light .fh .border-slate-900\\/60 {
  border-color: var(--fh-border) !important;
}
.campus-theme-light .fh .bg-slate-800,
.campus-theme-light .fh .bg-slate-800\\/20,
.campus-theme-light .fh .bg-slate-800\\/30,
.campus-theme-light .fh .bg-slate-800\\/40,
.campus-theme-light .fh .bg-slate-800\\/60,
.campus-theme-light .fh .bg-slate-900,
.campus-theme-light .fh .bg-slate-900\\/20,
.campus-theme-light .fh .bg-slate-900\\/40,
.campus-theme-light .fh .bg-slate-950 {
  background-color: var(--fh-bgCard, var(--fh-surface2)) !important;
}
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

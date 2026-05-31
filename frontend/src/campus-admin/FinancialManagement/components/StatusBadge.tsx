// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge.tsx — status indicator components
// Sources: FinancialSanctum (StatusPill), PaymentRecords (StatusBadge),
//          FinancialReports (BillStatusPill, Pill, AccountTypeBadge)
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import type { Bill, Account } from '../types/financial.types';
import { sMeta as hubSMeta } from '../helpers/hub.helpers';
import { sMeta as recSMeta } from '../helpers/records.helpers';
import Icon from '../../../components/common/Icon'; // adjust path to project Icon component

// ─── StatusPill (Hub — FinancialSanctum) ─────────────────────────────────────

const PILL_LIGHT: Record<string, { bg: string; text: string; border: string }> = {
  SUCCESS:    { bg: 'bg-emerald-50 dark:bg-emerald-900/40',  text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-700/60' },
  FAILED:     { bg: 'bg-red-50 dark:bg-red-900/40',          text: 'text-red-600 dark:text-red-400',         border: 'border-red-200 dark:border-red-700/60'         },
  PROCESSING: { bg: 'bg-amber-50 dark:bg-amber-900/40',      text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-700/60'     },
  PENDING:    { bg: 'bg-blue-50 dark:bg-blue-900/40',        text: 'text-blue-700 dark:text-blue-400',       border: 'border-blue-200 dark:border-blue-700/60'       },
};
const PILL_DEFAULT = { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-600' };

export const StatusPill = memo(({ status }: { status: string }) => {
  const m  = hubSMeta(status);
  const lm = PILL_LIGHT[status?.toUpperCase()] ?? PILL_DEFAULT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-sans font-semibold border ${lm.bg} ${lm.text} ${lm.border}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.dot }} />
      {m.label.toUpperCase()}
    </span>
  );
});
StatusPill.displayName = 'StatusPill';

// ─── StatusBadge (Records — PaymentRecords) ───────────────────────────────────

export const StatusBadge = memo(({ status }: { status: string }) => {
  const m = recSMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// ─── Pill (Reports — generic color pill) ─────────────────────────────────────

export const Pill = memo(({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
    style={{ color, background: bg, border: `1px solid ${color}33` }}>
    {label}
  </span>
));
Pill.displayName = 'Pill';

// ─── BillStatusPill (Reports — FinancialReports) ─────────────────────────────

const BILL_META: Record<Bill['status'], { c: string; b: string }> = {
  draft:    { c: '#64748b', b: 'rgba(100,116,139,0.15)' },
  pending:  { c: '#60a5fa', b: 'rgba(96,165,250,0.15)'  },
  approved: { c: '#a78bfa', b: 'rgba(167,139,250,0.15)' },
  paid:     { c: '#10b981', b: 'rgba(16,185,129,0.15)'  },
  overdue:  { c: '#f87171', b: 'rgba(248,113,113,0.15)' },
  disputed: { c: '#34d399', b: 'rgba(251,191,36,0.15)'  },
};

export const BillStatusPill = memo(({ status }: { status: Bill['status'] }) => {
  const { c, b } = BILL_META[status] ?? { c: '#64748b', b: 'rgba(100,116,139,0.15)' };
  return <Pill label={status.toUpperCase()} color={c} bg={b} />;
});
BillStatusPill.displayName = 'BillStatusPill';

// ─── AccountTypeBadge (Reports — FinancialReports) ───────────────────────────

const ACCT_META: Record<Account['type'], { c: string; b: string }> = {
  asset:     { c: '#10b981', b: 'rgba(16,185,129,0.12)'  },
  liability: { c: '#f87171', b: 'rgba(248,113,113,0.12)' },
  equity:    { c: '#a78bfa', b: 'rgba(167,139,250,0.12)' },
  revenue:   { c: '#34d399', b: 'rgba(251,191,36,0.12)'  },
  expense:   { c: '#fb923c', b: 'rgba(251,146,60,0.12)'  },
};

export const AccountTypeBadge = memo(({ type }: { type: Account['type'] }) => {
  const { c, b } = ACCT_META[type] ?? { c: '#64748b', b: 'rgba(100,116,139,0.12)' };
  return <Pill label={type} color={c} bg={b} />;
});
AccountTypeBadge.displayName = 'AccountTypeBadge';
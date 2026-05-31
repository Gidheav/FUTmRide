// ─────────────────────────────────────────────────────────────────────────────
// records.constants.ts
// All module-scope constants for PaymentRecords
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PAGE_SIZE = 20;

// ─── Status meta ──────────────────────────────────────────────────────────────

export const STATUS_META: Record<string, {
  bg: string; text: string; border: string; dot: string; icon: string; label: string;
}> = {
  SUCCESS:    { bg: 'bg-emerald-50 dark:bg-emerald-500/10',  text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', dot: 'bg-emerald-400',             icon: 'check_circle',  label: 'Success'    },
  FAILED:     { bg: 'bg-red-50 dark:bg-red-500/10',          text: 'text-red-700 dark:text-red-400',         border: 'border-red-200 dark:border-red-500/30',         dot: 'bg-red-400',                 icon: 'cancel',        label: 'Failed'     },
  PROCESSING: { bg: 'bg-amber-50 dark:bg-amber-500/10',      text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-500/30',     dot: 'bg-amber-400',               icon: 'hourglass_top', label: 'Processing' },
  PENDING:    { bg: 'bg-blue-50 dark:bg-blue-500/10',        text: 'text-blue-700 dark:text-blue-400',       border: 'border-blue-200 dark:border-blue-500/30',       dot: 'bg-blue-400',                icon: 'schedule',      label: 'Pending'    },
};

export const DEFAULT_STATUS = {
  bg: 'bg-slate-50 dark:bg-slate-800',
  text: 'text-slate-600 dark:text-slate-400',
  border: 'border-slate-200 dark:border-slate-700',
  dot: 'bg-slate-400',
  icon: 'help',
  label: 'Unknown',
};

// ─── Scroll style ─────────────────────────────────────────────────────────────

export const THIN: React.CSSProperties = { scrollbarWidth: 'thin' };

export const PANEL_W = 420;

// ─── Avatar gradient palette ──────────────────────────────────────────────────

export const AVATAR_COLORS = [
  'from-emerald-500 to-teal-400', 'from-blue-500 to-cyan-400',
  'from-violet-500 to-purple-400', 'from-amber-500 to-orange-400',
  'from-rose-500 to-pink-400', 'from-indigo-500 to-blue-400',
];
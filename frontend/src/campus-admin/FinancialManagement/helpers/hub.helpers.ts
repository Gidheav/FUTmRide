// ─────────────────────────────────────────────────────────────────────────────
// hub.helpers.ts
// Pure utility functions for FinancialHub (FinancialSanctum.tsx)
// ─────────────────────────────────────────────────────────────────────────────

import type { Period, Tx, WithdrawalRecord } from '../types/financial.types';
import { STATUS_META, DEF_STATUS, CAT_COLORS, AVATAR_G, STALE_MS, FH_CSS } from '../constants/hub.constants';

// ─── Currency formatters ──────────────────────────────────────────────────────

export const naira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n / 100);

export const nairaFull = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n / 100);

export const compact = (n: number): string => {
  const v = n / 100;
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `₦${(v / 1_000).toFixed(0)}K`;
  return nairaFull(n);
};

// ─── Date formatters ──────────────────────────────────────────────────────────

export const fmtD = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const fmtDT = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtShort = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

// ─── Meta lookups ─────────────────────────────────────────────────────────────

export const sMeta = (s: string) => STATUS_META[s?.toUpperCase()] ?? DEF_STATUS;
export const cMeta = (c: string) => CAT_COLORS[c] ?? CAT_COLORS.General;

// ─── Avatar ───────────────────────────────────────────────────────────────────

export const avatarGrad = (id: string) =>
  AVATAR_G[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_G.length];

export const initials = (n: string) =>
  n.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

// ─── Math helpers ─────────────────────────────────────────────────────────────

export const pct   = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Period helpers ───────────────────────────────────────────────────────────

export const periodStart = (p: Period, now = new Date()): Date => {
  const d = new Date(now);
  switch (p) {
    case '1D':  d.setHours(0, 0, 0, 0); break;
    case '7D':  d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); break;
    case '30D': d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); break;
    case '90D': d.setDate(d.getDate() - 89); d.setHours(0, 0, 0, 0); break;
    case 'YTD': d.setMonth(0, 1); d.setHours(0, 0, 0, 0); break;
    case '1Y':  d.setFullYear(d.getFullYear() - 1); break;
    case 'ALL': return new Date(0);
  }
  return d;
};

export const periodLabel = (p: Period): string => {
  const now   = new Date();
  const start = periodStart(p, now);
  if (p === 'ALL') return 'All Time';
  if (p === '1D')  return `Today, ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  return `${fmtD(start.toISOString())} – ${fmtD(now.toISOString())}`;
};

// ─── CSV export ───────────────────────────────────────────────────────────────

export const exportCSV = (rows: Tx[]) => {
  const h    = ['ID', 'Name', 'Email', 'Reference', 'Amount (NGN)', 'Currency', 'Status', 'Method', 'Created', 'Paid At'];
  const body = rows.map(t =>
    [t.id, t.user_name, t.user_email, t.reference,
      (t.amount / 100).toFixed(2), t.currency, t.status, t.payment_method || '',
      fmtDT(t.created_at), fmtDT(t.paid_at)]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  const blob = new Blob([[h.join(','), ...body].join('\n')], { type: 'text/csv' });
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: `fh_export_${Date.now()}.csv`,
  }).click();
};

// ─── Withdrawal effective status ──────────────────────────────────────────────

/** Returns the effective display status, substituting 'timed_out' when the
 *  backend hasn't yet expired a stale processing/otp_required row. */
export const effectiveStatus = (w: WithdrawalRecord): string => {
  if (!['processing', 'otp_required'].includes(w.status)) return w.status;
  const lastUpdate = new Date(w.updated_at ?? w.requested_at).getTime();
  return Date.now() - lastUpdate > STALE_MS ? 'timed_out' : w.status;
};

// ─── CSS injection ────────────────────────────────────────────────────────────

let _fhCss = false;
export const injectFHCSS = () => {
  if (_fhCss || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = FH_CSS;
  document.head.appendChild(s);
  _fhCss = true;
};
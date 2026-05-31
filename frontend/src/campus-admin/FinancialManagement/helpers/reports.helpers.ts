// ─────────────────────────────────────────────────────────────────────────────
// reports.helpers.ts
// Pure utility functions for FinancialReports (FinancialSanctum)
// ─────────────────────────────────────────────────────────────────────────────

import { FS_CSS } from '../constants/reports.constants';

// ─── Currency formatter ───────────────────────────────────────────────────────

export const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: decimals,
  }).format(n);

// ─── Math helpers ─────────────────────────────────────────────────────────────

export const pct   = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) : '0.0');
export const abs   = Math.abs;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Date formatters ──────────────────────────────────────────────────────────

export const fmtD = (s: string) =>
  s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const fmtShort = (s: string) =>
  s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

// ─── Number formatter ─────────────────────────────────────────────────────────

export const num = (n: number) => n.toLocaleString('en-NG');

// ─── Compact currency ─────────────────────────────────────────────────────────

export const compact = (n: number): string => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`;
  return ngn(n);
};

// ─── CSS injection ────────────────────────────────────────────────────────────

let _fsCss = false;
export const injectFSCSS = () => {
  if (_fsCss || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = FS_CSS;
  document.head.appendChild(s);
  _fsCss = true;
};
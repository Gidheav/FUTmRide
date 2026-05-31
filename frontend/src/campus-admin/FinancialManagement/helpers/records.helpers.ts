// ─────────────────────────────────────────────────────────────────────────────
// records.helpers.ts
// Pure utility functions for PaymentRecords
// ─────────────────────────────────────────────────────────────────────────────

import type { PaymentTransaction } from '../types/financial.types';
import { STATUS_META, DEFAULT_STATUS, AVATAR_COLORS } from '../constants/records.constants';

// ─── Currency formatter ───────────────────────────────────────────────────────

export const money = (amount: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: (currency || 'NGN').toUpperCase(), maximumFractionDigits: 2,
  }).format(amount / 100);

// ─── Date formatters ──────────────────────────────────────────────────────────

export const fmtD = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const fmtDT = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ─── Status meta lookup ───────────────────────────────────────────────────────

export const sMeta = (status: string) => STATUS_META[status?.toUpperCase()] ?? DEFAULT_STATUS;

// ─── Avatar helpers ───────────────────────────────────────────────────────────

export const initials = (name: string) =>
  name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '??';

export const avatarColor = (id: string) =>
  AVATAR_COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

// ─── CSV export ───────────────────────────────────────────────────────────────

export const exportCSV = (rows: PaymentTransaction[]) => {
  const headers = ['ID', 'Name', 'Email', 'Reference', 'Amount', 'Currency', 'Status', 'Method', 'Created', 'Paid At'];
  const lines = [
    headers.join(','),
    ...rows.map(tx =>
      [tx.id, tx.user_name, tx.user_email, tx.reference,
        (tx.amount / 100).toFixed(2), tx.currency, tx.status,
        tx.payment_method || '', fmtDT(tx.created_at), fmtDT(tx.paid_at)]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: `transactions_${Date.now()}.csv`,
  });
  a.click();
};
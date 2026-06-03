// PayoutsTab — campus admin driver payout oversight (privacy-safe, period-scoped)
import React, { memo, useCallback, useEffect, useState } from 'react';
import type { Period, PayoutListResponse, PayoutStatusFilter, PlatformPayout } from '../../types/financial.types';
import { compact, fmtDT } from '../../helpers/hub.helpers';
import { Card } from '../../components/Card';
import Icon from '../../../../components/common/Icon';
import apiService from '../../../../services/api.service';
import { T } from '../../../theme';

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  completed: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  processing: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  cancelled: { color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

const STATUS_FILTERS: { key: PayoutStatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All statuses' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'FAILED', label: 'Failed' },
];

function StatusPill({ status, label }: { status: string; label: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.cancelled;
  return (
    <span
      className="fh-payout-status"
      style={{ color: s.color, background: s.bg, borderColor: `${s.color}44` }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {label}
    </span>
  );
}

export const PayoutsTab = memo(({
  period,
  onMetaChange,
  onRefreshReady,
}: {
  period: Period;
  onMetaChange?: (meta: { pending: number; failed: number }) => void;
  onRefreshReady?: (fn: () => void) => void;
}) => {
  const [data, setData] = useState<PayoutListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [needsAction, setNeedsAction] = useState(false);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getFinancePayouts({
        period,
        page,
        status: statusFilter,
        search: search.trim() || undefined,
        needs_action: needsAction,
      });
      setData(res);
      onMetaChange?.({ pending: res.kpis.pending_count, failed: res.kpis.failed_count });
    } catch {
      setData(null);
      onMetaChange?.({ pending: 0, failed: 0 });
    } finally {
      setLoading(false);
    }
  }, [period, page, statusFilter, search, needsAction, onMetaChange]);

  useEffect(() => {
    setPage(1);
  }, [period, statusFilter, search, needsAction]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  useEffect(() => {
    onRefreshReady?.(fetchPayouts);
  }, [onRefreshReady, fetchPayouts]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await apiService.downloadPayoutsExport(period);
    } catch {
      /* silent */
    } finally {
      setExporting(false);
    }
  };

  const kpis = data?.kpis;
  const maxBank = Math.max(...(data?.by_bank?.map((b) => b.total_kobo) || [1]), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* KPI strip */}
      <div className="fh-payouts-kpi-grid">
        <Card glow="#64748b" className="fh-payout-kpi">
          <p className="fh-payout-kpi-label">Total paid (period)</p>
          <p className="fh-payout-kpi-value" style={{ color: '#10b981' }}>
            {loading ? '—' : compact(kpis?.total_paid_kobo ?? 0)}
          </p>
          {kpis && kpis.delta_pct !== 0 && (
            <p style={{ fontSize: 9, color: kpis.delta_pct >= 0 ? '#34d399' : '#f87171', margin: '6px 0 0' }}>
              {kpis.delta_pct >= 0 ? '+' : ''}{kpis.delta_pct}% vs prior period
            </p>
          )}
        </Card>
        <Card glow="#f59e0b" className="fh-payout-kpi">
          <p className="fh-payout-kpi-label">Pending queue</p>
          <p className="fh-payout-kpi-value" style={{ color: '#f59e0b' }}>
            {loading ? '—' : (kpis?.pending_count ?? 0)}
          </p>
          <p style={{ fontSize: 9, color: '#64748b', margin: '6px 0 0' }}>Awaiting settlement</p>
        </Card>
        <Card glow="#ef4444" className="fh-payout-kpi">
          <p className="fh-payout-kpi-label">Failed / cancelled</p>
          <p className="fh-payout-kpi-value" style={{ color: '#f87171' }}>
            {loading ? '—' : (kpis?.failed_count ?? 0)}
          </p>
          <p style={{ fontSize: 9, color: '#64748b', margin: '6px 0 0' }}>Requires review</p>
        </Card>
        <Card glow="#3b82f6" className="fh-payout-kpi">
          <p className="fh-payout-kpi-label">Avg payout SLA</p>
          <p className="fh-payout-kpi-value" style={{ color: '#60a5fa' }}>
            {loading ? '—' : kpis?.avg_sla_hours != null ? `${kpis.avg_sla_hours}h` : '—'}
          </p>
          <p style={{ fontSize: 9, color: '#64748b', margin: '6px 0 0' }}>
            Fees: {loading ? '—' : compact(kpis?.total_fees_kobo ?? 0)}
          </p>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {/* Bank distribution */}
        {data?.by_bank && data.by_bank.length > 0 && (
          <Card>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Payouts by bank (completed)
              </p>
            </div>
            <div className="fh-payout-bank-list">
              {data.by_bank.map((b) => (
                <div key={b.bank_name} className="fh-payout-bank-row">
                  <span style={{ minWidth: 100, color: '#e2e8f0', fontWeight: 600 }}>{b.bank_name}</span>
                  <div className="fh-payout-bank-bar-wrap">
                    <div
                      className="fh-payout-bank-bar"
                      style={{ width: `${Math.round((b.total_kobo / maxBank) * 100)}%`, background: '#64748b' }}
                    />
                  </div>
                  <span style={{ fontFamily: 'monospace', color: '#10b981' }}>{compact(b.total_kobo)}</span>
                  <span style={{ color: '#64748b' }}>({b.count})</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Queue table */}
        <Card>
          <div className="fh-payout-toolbar-row">
            <div className="fh-payout-search-wrap">
              <span className="fh-payout-search-icon">
                <Icon name="search" size={14} color="#64748b" />
              </span>
              <input
                type="search"
                className="fh-payout-search-input"
                placeholder="Search reference or bank…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search payouts"
              />
            </div>
            <select
              className="fh-payout-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PayoutStatusFilter)}
              aria-label="Filter by status"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#94a3b8', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={needsAction}
                onChange={(e) => setNeedsAction(e.target.checked)}
              />
              Needs action
            </label>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: '6px 12px', fontSize: 10, fontWeight: 600,
                background: '#0f1525', border: `1px solid ${T.border}`, color: '#94a3b8',
                cursor: exporting ? 'wait' : 'pointer',
              }}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>

          <p style={{ fontSize: 9, color: '#64748b', padding: '8px 14px 0', margin: 0, lineHeight: 1.5 }}>
            Driver bank settlements — masked references only. No student or driver personal profiles.
          </p>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Loading payouts…</div>
          ) : !data?.results?.length ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Icon name="send" size={32} color="#475569" />
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>No payouts in this period</p>
            </div>
          ) : (
            <>
              <div className="fh-payout-table-wrap">
                <table className="fh-payout-table">
                  <thead>
                    <tr>
                      {['Reference', 'Driver', 'Bank', 'Amount', 'Fee', 'Status', 'Requested', 'SLA'].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((row: PlatformPayout, i: number) => (
                      <tr key={row.id} className={i % 2 === 0 ? 'fh-row-even' : 'fh-row-odd'}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#e2e8f0' }}>
                            {row.reference_masked}
                          </span>
                        </td>
                        <td style={{ color: '#94a3b8' }}>{row.driver_hint}</td>
                        <td>
                          {row.bank_name}
                          <span style={{ color: '#64748b' }}> ···{row.account_last4}</span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>
                          {compact(row.amount_kobo)}
                        </td>
                        <td style={{ fontFamily: 'monospace', color: '#64748b' }}>
                          {compact(row.fee_kobo)}
                        </td>
                        <td>
                          <StatusPill status={row.status} label={row.status_label} />
                        </td>
                        <td style={{ color: '#64748b' }}>{fmtDT(row.requested_at)}</td>
                        <td style={{ color: '#64748b' }}>
                          {row.sla_hours != null ? `${row.sla_hours}h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fh-payout-pagination">
                <span>
                  {data.count} payout{data.count !== 1 ? 's' : ''} · page {data.page} of {data.total_pages}
                </span>
                <div className="fh-payout-page-btns">
                  <button
                    type="button"
                    className="fh-payout-page-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="fh-payout-page-btn"
                    disabled={page >= data.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
});
PayoutsTab.displayName = 'PayoutsTab';

export default PayoutsTab;

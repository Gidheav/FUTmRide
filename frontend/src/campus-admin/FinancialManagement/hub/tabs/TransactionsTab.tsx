// ─────────────────────────────────────────────────────────────────────────────
// TransactionsTab.tsx — Platform Ledger (privacy-safe, LR-Ride)
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  memo, useState, useMemo, useCallback, useEffect,
} from 'react';
import type {
  LedgerQueryParams,
  LedgerStatusFilter,
  LedgerSourceFilter,
  Period,
  PlatformLedgerEvent,
  SortDir,
} from '../../types/financial.types';
import { compact, fmtDT, naira } from '../../helpers/hub.helpers';
import { StatusPill } from '../../components/StatusBadge';
import Icon from '../../../../components/common/Icon';
import apiService from '../../../../services/api.service';
import { THIN, PANEL_W } from '../../constants/hub.constants';

type SortK = 'event_type' | 'amount' | 'status' | 'created_at';

const STATUS_OPTS: [LedgerStatusFilter, string][] = [
  ['ALL', 'All Status'],
  ['SUCCESS', 'Success'],
  ['FAILED', 'Failed'],
  ['PROCESSING', 'Processing'],
  ['PENDING', 'Pending'],
  ['DISPUTED', 'Disputed'],
  ['NEEDS_ACTION', 'Needs Action'],
];

const SOURCE_OPTS: [LedgerSourceFilter, string][] = [
  ['ALL', 'All Sources'],
  ['RIDE', 'Rides'],
  ['GATEWAY', 'Top-ups'],
  ['WITHDRAWAL', 'Withdrawals'],
  ['REFUND', 'Refunds'],
  ['DISPUTE', 'Disputes'],
];

function contextHint(evt: PlatformLedgerEvent): string {
  const ctx = evt.context || {};
  if (typeof ctx.route_hint === 'string') return ctx.route_hint;
  if (typeof ctx.gateway === 'string') return String(ctx.gateway);
  if (typeof ctx.bank_name === 'string') return String(ctx.bank_name);
  if (typeof ctx.narration === 'string') return String(ctx.narration);
  return evt.source_label;
}

function resolveRideId(detail: PlatformLedgerEvent | null): string | null {
  if (!detail) return null;
  if (detail.dispute?.ride_id) return detail.dispute.ride_id;
  const ctx = detail.context?.ride_id;
  return typeof ctx === 'string' ? ctx : null;
}

export const TransactionsTab = memo(({
  period,
  externalSearch = '',
  onExportReady,
}: {
  period: Period;
  externalSearch?: string;
  onExportReady?: (fn: () => void) => void;
}) => {
  const [rows, setRows] = useState<PlatformLedgerEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PlatformLedgerEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [statusF, setStatusF] = useState<LedgerStatusFilter>('ALL');
  const [sourceF, setSourceF] = useState<LedgerSourceFilter>('ALL');
  const [search, setSearch] = useState('');
  const [sortK, setSortK] = useState<SortK>('created_at');
  const [sortD, setSortD] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE = 25;

  const [actionMap, setActionMap] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({});
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});

  const effectiveSearch = (externalSearch || search).trim();

  const queryParams = useMemo((): LedgerQueryParams => ({
    period,
    page,
    page_size: PAGE,
    status: statusF,
    source: sourceF,
    search: effectiveSearch || undefined,
    ordering: sortK === 'created_at'
      ? (sortD === 'asc' ? 'created_at' : '-created_at')
      : sortK === 'amount'
        ? (sortD === 'asc' ? 'amount' : '-amount')
        : sortK === 'status'
          ? (sortD === 'asc' ? 'status' : '-status')
          : (sortD === 'asc' ? 'event_type' : '-event_type'),
  }), [period, page, statusF, sourceF, effectiveSearch, sortK, sortD]);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const qs = apiService.buildLedgerQuery(queryParams);
      const res = await apiService.get<{
        count: number;
        total_pages: number;
        results: PlatformLedgerEvent[];
      }>(`payments/admin/finance/ledger/?${qs}`);
      setRows(res.results ?? []);
      setTotalCount(res.count ?? 0);
      setTotalPages(res.total_pages ?? 1);
    } catch {
      setRows([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  useEffect(() => {
    if (externalSearch) setPage(1);
  }, [externalSearch]);

  const fetchDetail = useCallback(async (eventId: string) => {
    setDetailLoading(true);
    try {
      const res = await apiService.get<PlatformLedgerEvent>(
        `payments/admin/finance/ledger/${encodeURIComponent(eventId)}/`,
      );
      setDetail(res);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = useCallback((evt: PlatformLedgerEvent) => {
    if (detail?.id === evt.id) {
      setDetail(null);
      return;
    }
    setDetail(evt);
    fetchDetail(evt.id);
  }, [detail?.id, fetchDetail]);

  const handleExport = useCallback(async () => {
    try {
      await apiService.downloadLedgerExport({
        period,
        status: statusF,
        source: sourceF,
        search: effectiveSearch || undefined,
        needs_action: statusF === 'NEEDS_ACTION',
      });
    } catch {
      /* silent */
    }
  }, [period, statusF, sourceF, effectiveSearch]);

  useEffect(() => {
    onExportReady?.(handleExport);
  }, [handleExport, onExportReady]);

  const sortBy = (k: SortK) => {
    setSortD((p) => (sortK === k ? (p === 'asc' ? 'desc' : 'asc') : 'desc'));
    setSortK(k);
    setPage(1);
  };

  const Th = ({ label, k, cls = '' }: { label: string; k: SortK; cls?: string }) => (
    <th
      className={`px-4 py-3 text-left cursor-pointer select-none group hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${cls}`}
      onClick={() => sortBy(k)}
    >
      <div className="flex items-center gap-1">
        <span className={`text-[9px] font-sans font-semibold uppercase tracking-widest ${sortK === k ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-600'}`}>
          {label}
        </span>
        <Icon
          name={sortK === k ? (sortD === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
          size={10}
          className={sortK === k ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-700 group-hover:text-slate-600 dark:group-hover:text-slate-500'}
        />
      </div>
    </th>
  );

  const panelOpen = !!detail;
  const rideId = resolveRideId(detail);

  const runRefund = async () => {
    if (!rideId || !detail) return;
    const key = detail.id;
    setActionMap((p) => ({ ...p, [key]: 'loading' }));
    setActionMsg((p) => ({ ...p, [key]: '' }));
    try {
      await apiService.post(`payments/admin/rides/${rideId}/refund/`, {});
      setActionMap((p) => ({ ...p, [key]: 'done' }));
      setActionMsg((p) => ({ ...p, [key]: 'Refund credited to student wallet.' }));
      fetchDetail(detail.id);
      fetchLedger();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; error?: { message?: string } } }; message?: string };
      setActionMap((p) => ({ ...p, [key]: 'error' }));
      setActionMsg((p) => ({
        ...p,
        [key]: err?.response?.data?.detail
          ?? err?.response?.data?.error?.message
          ?? err?.message
          ?? 'Refund failed.',
      }));
    }
  };

  const runResolve = async () => {
    if (!rideId || !detail) return;
    const key = `${detail.id}-resolve`;
    setActionMap((p) => ({ ...p, [key]: 'loading' }));
    setActionMsg((p) => ({ ...p, [key]: '' }));
    try {
      await apiService.post(`payments/admin/rides/${rideId}/resolve-dispute/`, {});
      setActionMap((p) => ({ ...p, [key]: 'done' }));
      setActionMsg((p) => ({ ...p, [key]: 'Dispute marked as resolved.' }));
      setDetail(null);
      fetchLedger();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; error?: { message?: string } } }; message?: string };
      setActionMap((p) => ({ ...p, [key]: 'error' }));
      setActionMsg((p) => ({
        ...p,
        [key]: err?.response?.data?.detail
          ?? err?.response?.data?.error?.message
          ?? err?.message
          ?? 'Resolution failed.',
      }));
    }
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="fh-toolbar px-6 py-3 flex items-center gap-2 flex-shrink-0 overflow-x-auto" style={THIN}>
          {!externalSearch && (
            <div className="relative w-52 flex-shrink-0">
              <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" />
              <input
                type="text"
                placeholder="Ref · route · source…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="fh-input w-full pl-8 pr-6 py-1.5 rounded-md text-xs font-sans focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400">
                  <Icon name="close" size={11} />
                </button>
              )}
            </div>
          )}
          <select
            value={statusF}
            onChange={(e) => { setStatusF(e.target.value as LedgerStatusFilter); setPage(1); }}
            className="fh-input flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-sans focus:outline-none focus:border-emerald-600"
          >
            {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select
            value={sourceF}
            onChange={(e) => { setSourceF(e.target.value as LedgerSourceFilter); setPage(1); }}
            className="fh-input flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-sans focus:outline-none focus:border-emerald-600"
          >
            {SOURCE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button
            type="button"
            onClick={handleExport}
            className="fh-input flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans hover:border-emerald-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <Icon name="download" size={12} />CSV
          </button>
          <span className="ml-auto flex-shrink-0 text-[10px] font-sans text-slate-500 dark:text-slate-600">
            {loading ? 'Loading…' : `${totalCount} records`}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-auto" style={THIN}>
          <table className="w-full border-collapse min-w-[640px]">
            <thead className="sticky top-0 z-10">
              <tr className="fh-thead">
                <Th label="Event" k="event_type" />
                <Th label="Reference" k="created_at" cls={panelOpen ? 'hidden 2xl:table-cell' : 'hidden md:table-cell'} />
                <Th label="Amount" k="amount" />
                <Th label="Status" k="status" cls={panelOpen ? 'hidden xl:table-cell' : 'hidden sm:table-cell'} />
                <th className={`px-4 py-3 text-left ${panelOpen ? 'hidden' : 'hidden lg:table-cell'}`}>
                  <span className="text-[9px] font-sans font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-600">Source</span>
                </th>
                <Th label="Date" k="created_at" cls={panelOpen ? 'hidden' : 'hidden xl:table-cell'} />
                <th className="px-4 py-3 text-right">
                  <span className="text-[9px] font-sans font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-600">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-20">
                      <Icon name="receipt_long" size={32} className="text-slate-700 mb-3" />
                      <p className="text-xs font-sans text-slate-600">No platform events found</p>
                    </div>
                  </td>
                </tr>
              ) : rows.map((evt, i) => {
                const sel = detail?.id === evt.id;
                return (
                  <tr
                    key={evt.id}
                    onClick={() => openDetail(evt)}
                    className={`border-b cursor-pointer transition-colors ${sel ? 'fh-row-sel' : i % 2 === 0 ? 'fh-row-even' : 'fh-row-odd'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}
                        >
                          <Icon name={evt.event_icon || 'receipt_long'} size={14} className="text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${sel ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {evt.event_label}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-600 truncate hidden sm:block">
                            {contextHint(evt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${panelOpen ? 'hidden 2xl:table-cell' : 'hidden md:table-cell'}`}>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded truncate block max-w-[160px]">
                        {evt.reference_masked}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono font-bold ${evt.status === 'SUCCESS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {compact(evt.amount_kobo)}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 ${panelOpen ? 'hidden xl:table-cell' : 'hidden sm:table-cell'}`}>
                      <StatusPill status={evt.status} />
                    </td>
                    <td className={`px-3 py-2.5 ${panelOpen ? 'hidden' : 'hidden lg:table-cell'}`}>
                      <span className="text-[10px] font-sans text-slate-500 dark:text-slate-500">{evt.source_label}</span>
                    </td>
                    <td className={`px-3 py-2.5 ${panelOpen ? 'hidden' : 'hidden xl:table-cell'}`}>
                      <span className="text-[10px] font-mono text-slate-500">
                        {evt.created_at ? new Date(evt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDetail(evt); }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-sans font-semibold border transition-all ${sel ? 'bg-emerald-500 text-black border-emerald-400' : 'border-slate-700 text-slate-500 hover:border-emerald-600 hover:text-emerald-500'}`}
                      >
                        {sel ? 'Close' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-sans text-slate-500 dark:text-slate-600">
              Page {page}/{totalPages} · {totalCount} records
            </span>
            <div className="flex gap-1">
              <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
                <Icon name="chevron_left" size={13} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + idx;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded text-[10px] font-sans font-semibold transition-colors ${p === page ? 'bg-emerald-500 text-black' : 'border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
                <Icon name="chevron_right" size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        className="hidden md:flex flex-col flex-shrink-0 fh-panel overflow-hidden"
        style={{ width: panelOpen ? PANEL_W : 0, minWidth: panelOpen ? PANEL_W : 0, transition: 'width 280ms ease,min-width 280ms ease' }}
      >
        <div className="flex flex-col h-full" style={{ width: PANEL_W, minWidth: PANEL_W }}>
          {detail && (
            <>
              <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-11 h-11 flex items-center justify-center"
                      style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}
                    >
                      <Icon name={detail.event_icon || 'receipt_long'} size={22} className="text-violet-400" />
                    </div>
                    <button type="button" onClick={() => setDetail(null)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{detail.event_label}</h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">
                    {detail.reference_full || detail.reference_masked}
                  </p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <StatusPill status={detail.status} />
                    {detail.needs_action && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/60 px-2 py-0.5 rounded-sm">
                        <Icon name="priority_high" size={10} />NEEDS ACTION
                      </span>
                    )}
                  </div>
                  <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-[10px] font-sans text-slate-500">AMOUNT</span>
                    <span className={`text-2xl font-mono font-bold ${detail.status === 'SUCCESS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {naira(detail.amount_kobo)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={THIN}>
                {detailLoading && (
                  <p className="text-[10px] font-sans text-slate-500">Refreshing details…</p>
                )}

                <div>
                  <p className="text-[9px] font-sans font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">EVENT DETAILS</p>
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/60 overflow-hidden">
                    {[
                      { k: 'REF', v: detail.reference_full || detail.reference_masked, mono: true },
                      { k: 'ID', v: detail.id, mono: true },
                      { k: 'SRC', v: detail.source_label, mono: false },
                      { k: 'CH', v: detail.channel || '—', mono: false },
                      { k: 'CRE', v: fmtDT(detail.created_at), mono: false },
                      { k: 'CMP', v: fmtDT(detail.completed_at), mono: false },
                    ].map((r) => (
                      <div key={r.k} className="flex items-start gap-3 px-4 py-2">
                        <span className="text-[9px] font-sans font-semibold text-slate-600 w-8 flex-shrink-0 mt-0.5">{r.k}</span>
                        <span className={`text-xs font-mono text-slate-600 dark:text-slate-400 break-all flex-1 ${r.mono ? 'text-[10px] text-slate-500' : ''}`}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {Object.keys(detail.context || {}).length > 0 && (
                  <div>
                    <p className="text-[9px] font-sans font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">CONTEXT</p>
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/60 overflow-hidden">
                      {Object.entries(detail.context).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-3 px-4 py-2">
                          <span className="text-[10px] font-mono text-slate-600 w-32 flex-shrink-0 truncate">{k}</span>
                          <span className="text-[10px] font-mono text-slate-500 break-all flex-1">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.dispute && (
                  <div>
                    <p className="text-[9px] font-sans font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">DISPUTE RESOLUTION</p>
                    <div className="bg-orange-950/20 rounded-lg border border-orange-900/40 p-4 space-y-2">
                      <p className="text-xs font-sans text-slate-300">
                        Ride <span className="font-mono">{detail.dispute.ride_reference}</span>
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase">Fare</p>
                          <p className="text-xs font-mono text-slate-300">{compact(detail.dispute.fare_kobo)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase">Commission</p>
                          <p className="text-xs font-mono text-slate-300">{compact(detail.dispute.commission_kobo)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase">Driver</p>
                          <p className="text-xs font-mono text-slate-300">{compact(detail.dispute.driver_earnings_kobo)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(detail.timeline?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[9px] font-sans font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">STATUS TIMELINE</p>
                    <div className="space-y-0">
                      {detail.timeline!.map((s, i, arr) => (
                        <div key={s.label} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-emerald-900/40 border border-emerald-700/60' : 'bg-slate-800 border border-slate-700'}`}>
                              {s.done
                                ? <Icon name="check" size={12} className="text-emerald-400" />
                                : <div className="w-2 h-2 rounded-full bg-slate-700" />}
                            </div>
                            {i < arr.length - 1 && (
                              <div className={`w-px flex-1 my-0.5 ${s.done ? 'bg-emerald-800/60' : 'bg-slate-800'}`} style={{ minHeight: 16 }} />
                            )}
                          </div>
                          <div className="pb-3">
                            <p className={`text-xs font-sans font-semibold ${s.done ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</p>
                            {s.time && <p className="text-[10px] font-mono text-slate-600">{fmtDT(s.time)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.dispute?.can_refund && (() => {
                  const rs = actionMap[detail.id] ?? 'idle';
                  const msg = actionMsg[detail.id] ?? '';
                  if (rs === 'done') {
                    return (
                      <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-emerald-700/50 bg-emerald-900/20 text-xs font-sans text-emerald-400">
                        <Icon name="check_circle" size={13} />Refund Issued
                      </div>
                    );
                  }
                  return (
                    <>
                      <button
                        type="button"
                        onClick={runRefund}
                        disabled={rs === 'loading'}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs font-sans transition-colors ${rs === 'loading' ? 'border-slate-700 bg-slate-800/40 text-slate-500 cursor-wait' : 'border-red-900/60 bg-red-900/20 text-red-400 hover:bg-red-900/40 cursor-pointer'}`}
                      >
                        {rs === 'loading'
                          ? <><div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />Processing refund…</>
                          : <><Icon name="undo" size={13} />Issue Ride Refund</>}
                        <Icon name="chevron_right" size={11} className="ml-auto opacity-50" />
                      </button>
                      {rs === 'error' && msg && <p className="text-[10px] font-sans text-red-400 px-1">{msg}</p>}
                    </>
                  );
                })()}

                {detail.dispute?.can_resolve && (() => {
                  const key = `${detail.id}-resolve`;
                  const rs = actionMap[key] ?? 'idle';
                  const msg = actionMsg[key] ?? '';
                  if (rs === 'done') return null;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={runResolve}
                        disabled={rs === 'loading'}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs font-sans transition-colors ${rs === 'loading' ? 'border-slate-700 bg-slate-800/40 text-slate-500 cursor-wait' : 'border-emerald-900/60 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/30 cursor-pointer'}`}
                      >
                        {rs === 'loading'
                          ? <><div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />Resolving…</>
                          : <><Icon name="gavel" size={13} />Mark Dispute Resolved</>}
                        <Icon name="chevron_right" size={11} className="ml-auto opacity-50" />
                      </button>
                      {rs === 'error' && msg && <p className="text-[10px] font-sans text-red-400 px-1">{msg}</p>}
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
TransactionsTab.displayName = 'TransactionsTab';

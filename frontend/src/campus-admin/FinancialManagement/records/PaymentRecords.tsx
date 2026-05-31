// ─────────────────────────────────────────────────────────────────────────────
// records/PaymentRecords.tsx — thin orchestrator shell
// Source: PaymentRecords lines 384–695
// Destination: src/admin/FinancialManagement/records/PaymentRecords.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { PaymentTransaction, SortKey, SortDir } from '../types/financial.types';
import { money, fmtDT, exportCSV } from '../helpers/records.helpers';
import { TableRow }    from './components/TableRow';
import { PanelContent } from './components/PanelContent';
import { StatusBadge }  from '../components/StatusBadge';
import { SkeletonRow }  from '../components/SkeletonLoaders';
import { Spark as Sparkline }    from '../components/Charts';
import Icon from '../../../components/common/Icon';
import apiService from '../../../services/api.service';
import { THIN, PANEL_W, PAGE_SIZE } from '../constants/records.constants';

// Records has its own local SortTh (typed to records SortKey which includes 'paid_at')
const SortTh = ({ label, col, sk, sd, onSort, cls = '' }: {
  label: string; col: SortKey; sk: SortKey; sd: SortDir;
  onSort: (k: SortKey) => void; cls?: string;
}) => (
  <th
    className={`px-4 py-3 text-left cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group ${cls}`}
    onClick={() => onSort(col)}
  >
    <div className="flex items-center gap-1">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${sk === col ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>{label}</span>
      <Icon
        name={sk === col ? (sd === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
        size={11}
        className={sk === col ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}
      />
    </div>
  </th>
);

const PaymentRecords: React.FC = () => {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [detail,       setDetail]       = useState<PaymentTransaction | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search,       setSearch]       = useState('');
  const [sortKey,      setSortKey]      = useState<SortKey>('created_at');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
  const [page,         setPage]         = useState(1);

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const q = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
        const res = await apiService.get<any>(`/payments/admin/transactions/${q}`);
        if (!dead) setTransactions(res?.results ?? res ?? []);
      } catch (e: any) {
        if (!dead) setError(e?.response?.data?.message || 'Failed to load transactions.');
      } finally { if (!dead) setLoading(false); }
    })();
    return () => { dead = true; };
  }, [statusFilter]);

  const handleSort = useCallback((k: SortKey) => {
    setSortDir(p => sortKey === k ? (p === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortKey(k);
    setPage(1);
  }, [sortKey]);

  const openPanel  = useCallback((tx: PaymentTransaction) => { setDetail(p => p?.id === tx.id ? null : tx); }, []);
  const closePanel = useCallback(() => setDetail(null), []);

  const processed = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = transactions;
    if (q) list = list.filter(tx =>
      tx.reference.toLowerCase().includes(q) ||
      tx.user_email.toLowerCase().includes(q) ||
      (tx.user_name || '').toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'user_name':  av = a.user_name;     bv = b.user_name;     break;
        case 'amount':     av = a.amount;         bv = b.amount;        break;
        case 'status':     av = a.status;         bv = b.status;        break;
        case 'created_at': av = a.created_at||''; bv = b.created_at||''; break;
        case 'paid_at':    av = a.paid_at||'';    bv = b.paid_at||'';   break;
        default: av = ''; bv = '';
      }
      const c = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? c : -c;
    });
  }, [transactions, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const paginated  = useMemo(() => processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [processed, page]);

  const summary = useMemo(() => {
    const success    = transactions.filter(t => t.status === 'SUCCESS');
    const failed     = transactions.filter(t => t.status === 'FAILED').length;
    const processing = transactions.filter(t => t.status === 'PROCESSING' || t.status === 'PENDING').length;
    const revenue    = success.reduce((s, t) => s + t.amount, 0);
    const now = Date.now();
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const day = now - (6 - i) * 86400000;
      return success
        .filter(t => t.paid_at && Math.abs(new Date(t.paid_at).getTime() - day) < 43200000)
        .reduce((s, t) => s + t.amount, 0);
    });
    return { total: transactions.length, success: success.length, failed, processing, revenue, sparkline: buckets };
  }, [transactions]);

  const panelOpen = !!detail;

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-300">

      {/* ══════════════ LEFT COLUMN ══════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── Page Header ── */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Icon name="receipt_long" size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">Payment Records</h1>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 hidden sm:block">All transactions processed on this platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportCSV(processed)}
                className="hidden sm:flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg text-sm font-semibold hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <Icon name="download" size={14} />Export CSV
              </button>
              <button
                onClick={() => { setLoading(true); setStatusFilter(p => p); }}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
              >
                <Icon name="refresh" size={14} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Revenue', value: money(summary.revenue, 'NGN'),
                icon: 'payments',     color: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-50 dark:bg-emerald-500/10',
                border: 'border-emerald-100 dark:border-emerald-500/20',
                sparkColor: '#10b981', note: `${summary.success} successful` },
              { label: 'Transactions', value: String(summary.total),
                icon: 'receipt',      color: 'text-slate-700 dark:text-slate-300',
                bg: 'bg-slate-50 dark:bg-slate-800/60',
                border: 'border-slate-100 dark:border-slate-700',
                sparkColor: '#64748b', note: 'all time' },
              { label: 'Failed',       value: String(summary.failed),
                icon: 'cancel',       color: 'text-red-600 dark:text-red-400',
                bg: 'bg-red-50 dark:bg-red-500/10',
                border: 'border-red-100 dark:border-red-500/20',
                sparkColor: '#ef4444', note: summary.total > 0 ? `${Math.round((summary.failed / summary.total) * 100)}% failure rate` : '—' },
              { label: 'In Progress',  value: String(summary.processing),
                icon: 'hourglass_top', color: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-50 dark:bg-amber-500/10',
                border: 'border-amber-100 dark:border-amber-500/20',
                sparkColor: '#f59e0b', note: 'pending/processing' },
            ].map(s => (
              <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border ${s.border} ${s.bg} transition-colors`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color} mt-0.5 truncate`}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{s.note}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                    <Icon name={s.icon} size={16} className={s.color} />
                  </div>
                  <Sparkline pts={summary.sparkline} color={s.sparkColor} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-2.5 flex-shrink-0 flex items-center gap-2 overflow-x-auto transition-colors" style={THIN}>
          <div className="relative flex-shrink-0 w-48 sm:w-64">
            <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Reference, email, name…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:focus:ring-emerald-500 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400">
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="flex-shrink-0 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:focus:ring-emerald-500 transition-colors"
          >
            <option value="ALL">All Status</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING">Pending</option>
          </select>
          <span className="ml-auto flex-shrink-0 text-xs text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
            {processed.length} / {transactions.length} records
          </span>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto overflow-x-auto" style={THIN}>
          <table className="w-full min-w-[360px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-slate-950/40 transition-colors">
              <tr>
                <SortTh label="User"    col="user_name"  sk={sortKey} sd={sortDir} onSort={handleSort} cls="px-4" />
                <th className={`px-4 py-3 text-left ${panelOpen ? 'hidden 2xl:table-cell' : 'hidden md:table-cell'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Reference</span>
                </th>
                <SortTh label="Amount"  col="amount"     sk={sortKey} sd={sortDir} onSort={handleSort} cls="px-4" />
                <SortTh label="Status"  col="status"     sk={sortKey} sd={sortDir} onSort={handleSort} cls={`${panelOpen ? 'hidden xl:table-cell' : 'hidden sm:table-cell'}`} />
                <th className={`px-4 py-3 text-left ${panelOpen ? 'hidden' : 'hidden lg:table-cell'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Method</span>
                </th>
                <SortTh label="Created" col="created_at" sk={sortKey} sd={sortDir} onSort={handleSort} cls={`${panelOpen ? 'hidden' : 'hidden xl:table-cell'}`} />
                <th className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} i={i} />)
                : error
                  ? (
                    <tr><td colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Icon name="error_outline" size={36} className="text-red-300 dark:text-red-700 mb-3" />
                        <p className="text-sm font-semibold text-red-500 dark:text-red-400">{error}</p>
                      </div>
                    </td></tr>
                  )
                  : paginated.length === 0
                    ? (
                      <tr><td colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                            <Icon name="receipt_long" size={26} className="text-slate-300 dark:text-slate-600" />
                          </div>
                          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No transactions found</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your filters.</p>
                        </div>
                      </td></tr>
                    )
                    : paginated.map((tx, i) => (
                      <TableRow key={tx.id} tx={tx} idx={i}
                        selected={detail?.id === tx.id}
                        panelOpen={panelOpen}
                        onOpen={openPanel}
                      />
                    ))
              }
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 flex items-center justify-between transition-colors">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Page {page} of {totalPages} · {processed.length} records
            </span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Icon name="chevron_left" size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                      p === page
                        ? 'bg-emerald-500 text-white'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Icon name="chevron_right" size={14} />
              </button>
            </div>
          </div>
        )}

      </div>{/* end LEFT */}

      {/* ══════════════ RIGHT — DESKTOP DETAIL PANEL ══════════════ */}
      <div
        className="hidden md:flex flex-col flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 overflow-hidden transition-colors"
        style={{
          width:      panelOpen ? PANEL_W : 0,
          minWidth:   panelOpen ? PANEL_W : 0,
          transition: 'width 300ms ease, min-width 300ms ease',
        }}
      >
        <div className="flex flex-col h-full" style={{ width: PANEL_W, minWidth: PANEL_W }}>
          {detail && <PanelContent tx={detail} onClose={closePanel} />}
        </div>
      </div>

      {/* ══════════════ MOBILE bottom sheet ══════════════ */}
      <div
        onClick={closePanel}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden ${panelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl dark:shadow-slate-950/80 flex flex-col md:hidden transition-transform duration-300 ${panelOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '90dvh' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        {detail && <PanelContent tx={detail} onClose={closePanel} />}
      </div>

    </div>
  );
};

export default PaymentRecords;
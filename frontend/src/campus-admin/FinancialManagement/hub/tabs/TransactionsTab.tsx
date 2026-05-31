// ─────────────────────────────────────────────────────────────────────────────
// TransactionsTab.tsx — Hub Transactions tab
// Source: FinancialSanctum lines 765–972
// Critical: sliding detail panel (PANEL_W=420), refund flow, inline Th
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useState, useMemo, useCallback, useRef } from 'react';
import type { Tx, Period, SortDir } from '../../types/financial.types';
import { periodStart, pct, compact, naira, fmtDT, exportCSV } from '../../helpers/hub.helpers';
import { Avatar }     from '../../components/Avatar';
import { StatusPill } from '../../components/StatusBadge';
import Icon from '../../../../components/common/Icon';
import apiService from '../../../../services/api.service';
import { THIN, PANEL_W } from '../../constants/hub.constants';

type SortK = 'user_name' | 'amount' | 'status' | 'created_at';

export const TransactionsTab = memo(({ txs, period }: { txs: Tx[]; period: Period }) => {
  const [detail,    setDetail]    = useState<Tx | null>(null);
  const [statusF,   setStatusF]   = useState('ALL');
  const [methodF,   setMethodF]   = useState('ALL');
  const [search,    setSearch]    = useState('');
  const [sortK,     setSortK]     = useState<SortK>('created_at');
  const [sortD,     setSortD]     = useState<SortDir>('desc');
  const [page,      setPage]      = useState(1);
  const PAGE                      = 25;
  const [refundMap, setRefundMap] = useState<Record<string, 'idle'|'loading'|'done'|'error'>>({});
  const [refundMsg, setRefundMsg] = useState<Record<string, string>>({});

  const start    = useMemo(() => periodStart(period), [period]);
  const current  = useMemo(() => txs.filter(t => t.created_at && new Date(t.created_at) >= start), [txs, start]);
  const methods  = useMemo(() => Array.from(new Set(current.map(t => t.payment_method).filter(Boolean))) as string[], [current]);

  const processed = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = current;
    if (statusF !== 'ALL') list = list.filter(t => t.status === statusF);
    if (methodF !== 'ALL') list = list.filter(t => t.payment_method === methodF);
    if (q) list = list.filter(t => t.reference.toLowerCase().includes(q) || t.user_email.toLowerCase().includes(q) || (t.user_name||'').toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortK === 'user_name') { av = a.user_name; bv = b.user_name; }
      else if (sortK === 'amount') { av = a.amount; bv = b.amount; }
      else if (sortK === 'status') { av = a.status; bv = b.status; }
      else { av = a.created_at||''; bv = b.created_at||''; }
      const c = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortD === 'asc' ? c : -c;
    });
  }, [current, statusF, methodF, search, sortK, sortD]);

  const paginated  = useMemo(() => processed.slice((page-1)*PAGE, page*PAGE), [processed, page]);
  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE));
  const panelOpen  = !!detail;

  const sortBy = (k: SortK) => {
    setSortD(p => sortK === k ? (p === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortK(k);
    setPage(1);
  };

  // Inline Th — intentionally kept local (typed to SortK, not global SortKey)
  const Th = ({ label, k, cls = '' }: { label: string; k: SortK; cls?: string }) => (
    <th className={`px-3 py-2.5 text-left cursor-pointer select-none group hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${cls}`} onClick={() => sortBy(k)}>
      <div className="flex items-center gap-1">
        <span className={`text-[9px] font-sans font-semibold uppercase tracking-widest ${sortK===k ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-600'}`}>{label}</span>
        <Icon name={sortK===k ? (sortD==='asc'?'arrow_upward':'arrow_downward') : 'unfold_more'} size={10} className={sortK===k ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-700 group-hover:text-slate-600 dark:group-hover:text-slate-500'} />
      </div>
    </th>
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── LEFT: table ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="fh-toolbar px-4 py-2.5 flex items-center gap-2 flex-shrink-0 overflow-x-auto" style={THIN}>
          <div className="relative w-52 flex-shrink-0">
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" />
            <input type="text" placeholder="Ref · email · name…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="fh-input w-full pl-8 pr-6 py-1.5 rounded-md text-xs font-sans focus:outline-none focus:ring-1 focus:ring-emerald-600/30" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"><Icon name="close" size={11} /></button>}
          </div>
          {[
            { val: statusF, opts: [['ALL','All Status'],['SUCCESS','Success'],['FAILED','Failed'],['PROCESSING','Processing'],['PENDING','Pending']], set: (v:string)=>{setStatusF(v);setPage(1);} },
            { val: methodF, opts: [['ALL','All Methods'],...methods.map(m=>[m,m])], set: (v:string)=>{setMethodF(v);setPage(1);} },
          ].map((f, i) => (
            <select key={i} value={f.val} onChange={e => f.set(e.target.value)} className="fh-input flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-sans focus:outline-none focus:border-emerald-600">
              {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <button onClick={() => exportCSV(processed)} className="fh-input flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans hover:border-emerald-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            <Icon name="download" size={12} />CSV
          </button>
          <span className="ml-auto flex-shrink-0 text-[10px] font-sans text-slate-500 dark:text-slate-600">{processed.length} records</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto overflow-x-auto" style={THIN}>
          <table className="w-full border-collapse min-w-[560px]">
            <thead className="sticky top-0 z-10">
              <tr className="fh-thead">
                <Th label="NAME"   k="user_name"  />
                <Th label="REF"    k="created_at" cls={panelOpen ? 'hidden 2xl:table-cell' : 'hidden md:table-cell'} />
                <Th label="AMOUNT" k="amount"     />
                <Th label="STATUS" k="status"     cls={panelOpen ? 'hidden xl:table-cell' : 'hidden sm:table-cell'} />
                <th className={`px-3 py-2.5 text-left ${panelOpen ? 'hidden' : 'hidden lg:table-cell'}`}><span className="text-[9px] font-sans font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-600">METHOD</span></th>
                <Th label="DATE"   k="created_at" cls={panelOpen ? 'hidden' : 'hidden xl:table-cell'} />
                <th className="px-3 py-2.5 text-right"><span className="text-[9px] font-sans font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-600">ACTION</span></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0
                ? <tr><td colSpan={7}><div className="flex flex-col items-center justify-center py-20"><Icon name="receipt_long" size={32} className="text-slate-700 mb-3" /><p className="text-xs font-sans text-slate-600">No transactions found</p></div></td></tr>
                : paginated.map((t, i) => {
                  const sel = detail?.id === t.id;
                  return (
                    <tr key={t.id} onClick={() => setDetail(p => p?.id === t.id ? null : t)}
                      className={`border-b cursor-pointer transition-colors ${sel ? 'fh-row-sel' : i%2===0 ? 'fh-row-even' : 'fh-row-odd'}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar id={t.id} name={t.user_name||t.user_email} cls="w-7 h-7 text-[10px]" />
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold truncate ${sel ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{t.user_name||t.user_email}</p>
                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-600 truncate hidden sm:block">{t.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-2.5 ${panelOpen ? 'hidden 2xl:table-cell' : 'hidden md:table-cell'}`}>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded truncate block max-w-[160px]">{t.reference}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-mono font-bold ${t.status==='SUCCESS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>{compact(t.amount)}</span>
                      </td>
                      <td className={`px-3 py-2.5 ${panelOpen ? 'hidden xl:table-cell' : 'hidden sm:table-cell'}`}><StatusPill status={t.status} /></td>
                      <td className={`px-3 py-2.5 ${panelOpen ? 'hidden' : 'hidden lg:table-cell'}`}><span className="text-[10px] font-sans text-slate-500 dark:text-slate-500">{t.payment_method||'—'}</span></td>
                      <td className={`px-3 py-2.5 ${panelOpen ? 'hidden' : 'hidden xl:table-cell'}`}><span className="text-[10px] font-mono text-slate-500">{t.created_at ? new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'}</span></td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={e => { e.stopPropagation(); setDetail(p => p?.id === t.id ? null : t); }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-sans font-semibold border transition-all ${sel ? 'bg-emerald-500 text-black border-emerald-400' : 'border-slate-700 text-slate-500 hover:border-emerald-600 hover:text-emerald-500'}`}>
                          {sel ? 'Close' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-sans text-slate-500 dark:text-slate-600">Page {page}/{totalPages} · {processed.length} records</span>
            <div className="flex gap-1">
              <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="p-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"><Icon name="chevron_left" size={13} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => { const p = Math.max(1, Math.min(page-2, totalPages-4)) + i; return <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded text-[10px] font-sans font-semibold transition-colors ${p===page ? 'bg-emerald-500 text-black' : 'border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{p}</button>; })}
              <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)} className="p-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"><Icon name="chevron_right" size={13} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: sliding detail panel ── */}
      <div className="hidden md:flex flex-col flex-shrink-0 fh-panel overflow-hidden"
        style={{ width: panelOpen ? PANEL_W : 0, minWidth: panelOpen ? PANEL_W : 0, transition: 'width 280ms ease,min-width 280ms ease' }}>
        <div className="flex flex-col h-full" style={{ width: PANEL_W, minWidth: PANEL_W }}>
          {detail && (
            <>
              {/* Panel header */}
              <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between mb-4">
                    <Avatar id={detail.id} name={detail.user_name||detail.user_email} cls="w-11 h-11 text-sm" />
                    <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><Icon name="close" size={16} /></button>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{detail.user_name||'Unknown'}</h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">{detail.user_email}</p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <StatusPill status={detail.status} />
                    {detail.amount_verified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/60 px-2 py-0.5 rounded-sm">
                        <Icon name="verified" size={10} />VERIFIED
                      </span>
                    )}
                  </div>
                  <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-[10px] font-sans text-slate-500">AMOUNT</span>
                    <span className={`text-2xl font-mono font-bold ${detail.status==='SUCCESS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{naira(detail.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={THIN}>
                {/* Transaction details */}
                <div>
                  <p className="text-[9px] font-sans font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">TRANSACTION DETAILS</p>
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/60 overflow-hidden">
                    {[
                      { k:'TAG', v:detail.reference,            mono:true  },
                      { k:'ID',  v:detail.id,                   mono:true  },
                      { k:'MTD', v:detail.payment_method||'—',  mono:false },
                      { k:'CUR', v:detail.currency,             mono:false },
                      { k:'CRE', v:fmtDT(detail.created_at),    mono:false },
                      { k:'PAI', v:fmtDT(detail.paid_at),       mono:false },
                    ].map(r => (
                      <div key={r.k} className="flex items-start gap-3 px-4 py-2">
                        <span className="text-[9px] font-sans font-semibold text-slate-600 w-8 flex-shrink-0 mt-0.5">{r.k}</span>
                        <span className={`text-xs font-mono text-slate-600 dark:text-slate-400 break-all flex-1 ${r.mono ? 'text-[10px] text-slate-500' : ''}`}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metadata */}
                {detail.metadata && Object.keys(detail.metadata).length > 0 && (
                  <div>
                    <p className="text-[9px] font-sans font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-2">METADATA</p>
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/60 overflow-hidden">
                      {Object.entries(detail.metadata).map(([k,v]) => (
                        <div key={k} className="flex items-start gap-3 px-4 py-2">
                          <span className="text-[10px] font-mono text-slate-600 w-32 flex-shrink-0 truncate">{k}</span>
                          <span className="text-[10px] font-mono text-slate-500 break-all flex-1">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status timeline */}
                <div>
                  <p className="text-[9px] font-sans font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">STATUS TIMELINE</p>
                  <div className="space-y-0">
                    {[
                      { label:'Created',    time: detail.created_at, done: true },
                      { label:'Processing', time: null,              done: detail.status !== 'PENDING' },
                      { label:'Confirmed',  time: detail.paid_at,    done: detail.status === 'SUCCESS' },
                    ].map((s, i, arr) => (
                      <div key={s.label} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-emerald-900/40 border border-emerald-700/60' : 'bg-slate-800 border border-slate-700'}`}>
                            {s.done
                              ? <Icon name="check" size={12} className="text-emerald-400" />
                              : <div className="w-2 h-2 rounded-full bg-slate-700" />}
                          </div>
                          {i < arr.length - 1 && <div className={`w-px flex-1 my-0.5 ${s.done ? 'bg-emerald-800/60' : 'bg-slate-800'}`} style={{ minHeight: 16 }} />}
                        </div>
                        <div className="pb-3">
                          <p className={`text-xs font-sans font-semibold ${s.done ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</p>
                          {s.time && <p className="text-[10px] font-mono text-slate-600">{fmtDT(s.time)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Refund */}
                {detail.status === 'SUCCESS' && (() => {
                  const rs  = refundMap[detail.id] ?? 'idle';
                  const msg = refundMsg[detail.id] ?? '';
                  const handleRefund = async () => {
                    setRefundMap(p => ({ ...p, [detail.id]: 'loading' }));
                    setRefundMsg(p => ({ ...p, [detail.id]: '' }));
                    try {
                      await apiService.post(`payments/admin/transactions/${detail.id}/refund/`, {});
                      setRefundMap(p => ({ ...p, [detail.id]: 'done' }));
                      setRefundMsg(p => ({ ...p, [detail.id]: 'Refund initiated successfully.' }));
                    } catch (e: any) {
                      setRefundMap(p => ({ ...p, [detail.id]: 'error' }));
                      setRefundMsg(p => ({ ...p, [detail.id]: e?.response?.data?.detail ?? e?.message ?? 'Refund failed.' }));
                    }
                  };
                  if (rs === 'done') return (
                    <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-emerald-700/50 bg-emerald-900/20 text-xs font-sans text-emerald-400 cursor-default">
                      <Icon name="check_circle" size={13} />Refund Initiated<span className="ml-auto text-[10px] text-emerald-600 font-sans">Completed</span>
                    </div>
                  );
                  return (
                    <>
                      <button onClick={handleRefund} disabled={rs === 'loading'}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs font-sans transition-colors ${rs === 'loading' ? 'border-slate-700 bg-slate-800/40 text-slate-500 cursor-wait' : 'border-red-900/60 bg-red-900/20 text-red-400 hover:bg-red-900/40 cursor-pointer'}`}>
                        {rs === 'loading'
                          ? <><div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />Processing refund…</>
                          : <><Icon name="undo" size={13} />Initiate Refund</>}
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
// ─────────────────────────────────────────────────────────────────────────────
// MembersTab.tsx — Hub Members tab
// Source: FinancialSanctum lines 1125–1174
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useState, useMemo } from 'react';
import type { Tx } from '../../types/financial.types';
import { compact, fmtD, pct } from '../../helpers/hub.helpers';
import { Avatar } from '../../components/Avatar';
import { Bar }    from '../../components/ProgressBar';
import Icon from '../../../../components/common/Icon';
import { THIN } from '../../constants/hub.constants';

const TIER_STYLE: Record<string,string> = {
  Major:      'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/60',
  Regular:    'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/60',
  Occasional: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-500 border-slate-200 dark:border-slate-700',
};

export const MembersTab = memo(({ txs }: { txs: Tx[] }) => {
  const [search, setSearch] = useState('');
  const [seg,    setSeg]    = useState('ALL');

  const members = useMemo(() => {
    const m: Record<string, { id:string;name:string;email:string;total:number;count:number;lastDate:string|null;firstDate:string|null;cats:Set<string> }> = {};
    txs.filter(t => t.status === 'SUCCESS').forEach(t => {
      const k = t.user_email;
      if (!m[k]) m[k] = { id:t.id, name:t.user_name||t.user_email, email:t.user_email, total:0, count:0, lastDate:null, firstDate:null, cats:new Set() };
      m[k].total += t.amount; m[k].count++;
      if (!m[k].lastDate  || (t.paid_at && t.paid_at > m[k].lastDate!))  m[k].lastDate  = t.paid_at||null;
      if (!m[k].firstDate || (t.paid_at && t.paid_at < m[k].firstDate!)) m[k].firstDate = t.paid_at||null;
      if (t.metadata?.giving_category) m[k].cats.add(t.metadata.giving_category);
    });
    return Object.values(m).map(m => ({
      ...m,
      avg: m.total / m.count,
      tier: m.total >= 1000000 ? 'Major' : m.total >= 200000 ? 'Regular' : 'Occasional',
      categories: Array.from(m.cats),
    })).sort((a, b) => b.total - a.total);
  }, [txs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter(m => seg === 'ALL' || m.tier === seg).filter(m => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members, seg, search]);

  const maxTotal = members[0]?.total || 1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="fh-toolbar px-4 py-2.5 flex-shrink-0 flex items-center gap-2 overflow-x-auto" style={THIN}>
        <div className="relative w-52 flex-shrink-0">
          <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" />
          <input type="text" placeholder="Name or email…" value={search} onChange={e => setSearch(e.target.value)}
            className="fh-input w-full pl-8 pr-6 py-1.5 rounded-md text-xs font-sans focus:outline-none focus:border-emerald-600" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"><Icon name="close" size={11} /></button>}
        </div>
        {['ALL','Major','Regular','Occasional'].map(s => (
          <button key={s} onClick={() => setSeg(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-md text-[10px] font-sans font-semibold border transition-colors ${seg===s?'bg-emerald-500 text-black border-emerald-400':'fh-input'}`}>
            {s}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-sans text-slate-500 dark:text-slate-600">{filtered.length} members</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto overflow-x-auto" style={THIN}>
        <table className="w-full border-collapse min-w-[640px]">
          <thead className="sticky top-0 z-10">
            <tr className="fh-thead">
              {['#','MEMBER','TIER','TOTAL GIVEN','GIFTS','AVG GIFT','FIRST GIFT','LAST GIFT','LTV BAR'].map((h, hi) => (
                <th key={h} className={`px-3 py-2.5 text-left ${hi===0?'pl-4 pr-2 w-8':''} ${hi===2?'hidden sm:table-cell':''} ${hi===5?'hidden md:table-cell':''} ${hi===6?'hidden lg:table-cell':''} ${hi===7?'hidden xl:table-cell':''} ${hi===8?'px-4':''}`}>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-slate-600">{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={9}><div className="flex flex-col items-center justify-center py-20"><Icon name="groups" size={32} className="text-slate-300 dark:text-slate-700 mb-3" /><p className="text-xs font-sans text-slate-400 dark:text-slate-600">No members found</p></div></td></tr>
              : filtered.map((m, i) => (
                <tr key={m.email} className={`border-b cursor-pointer transition-colors ${i%2===0?'fh-row-even':'fh-row-odd'}`}>
                  <td className="pl-4 pr-2 py-2.5">{i<3?<span className="text-base">{['🥇','🥈','🥉'][i]}</span>:<span className="text-[9px] font-mono text-slate-400 dark:text-slate-700">{String(i+1).padStart(2,'0')}</span>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar id={m.email} name={m.name} cls="w-7 h-7 text-[10px]" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{m.name}</p>
                        <p className="text-[10px] font-mono text-slate-500 dark:text-slate-600 truncate hidden sm:block">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    <span className={`text-[10px] font-sans font-semibold border px-2 py-0.5 rounded-sm ${TIER_STYLE[m.tier]}`}>{m.tier.toUpperCase()}</span>
                  </td>
                  <td className="px-3 py-2.5"><span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{compact(m.total)}</span></td>
                  <td className="px-3 py-2.5 hidden sm:table-cell"><span className="text-xs font-mono text-slate-500">{m.count}</span></td>
                  <td className="px-3 py-2.5 hidden md:table-cell"><span className="text-xs font-mono text-slate-500">{compact(m.avg)}</span></td>
                  <td className="px-3 py-2.5 hidden lg:table-cell"><span className="text-[10px] font-mono text-slate-500 dark:text-slate-600">{fmtD(m.firstDate)}</span></td>
                  <td className="px-3 py-2.5 hidden xl:table-cell"><span className="text-[10px] font-mono text-slate-500 dark:text-slate-600">{fmtD(m.lastDate)}</span></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24"><Bar v={pct(m.total, maxTotal)} color="#10b981" h={4} /></div>
                      <span className="text-[9px] font-mono text-slate-500 dark:text-slate-600">{pct(m.total, maxTotal)}%</span>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
});
MembersTab.displayName = 'MembersTab';
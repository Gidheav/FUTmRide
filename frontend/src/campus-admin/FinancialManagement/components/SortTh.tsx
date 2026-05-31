// ─────────────────────────────────────────────────────────────────────────────
// SortTh.tsx — sortable table header cell
// Source: PaymentRecords
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import type { SortKey, SortDir } from '../types/financial.types';
import Icon from '../../../components/common/Icon';

export const SortTh = memo(({ label, col, sk, sd, onSort, cls = '' }: {
  label: string; col: SortKey; sk: SortKey; sd: SortDir;
  onSort: (k: SortKey) => void; cls?: string;
}) => (
  <th
    className={`px-4 py-3 text-left cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors group ${cls}`}
    onClick={() => onSort(col)}>
    <div className="flex items-center gap-1">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${
        sk === col ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
      }`}>
        {label}
      </span>
      <Icon
        name={sk === col ? (sd === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
        size={11}
        className={sk === col
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}
      />
    </div>
  </th>
));
SortTh.displayName = 'SortTh';
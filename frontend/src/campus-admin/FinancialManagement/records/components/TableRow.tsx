// ─────────────────────────────────────────────────────────────────────────────
// TableRow.tsx — individual transaction row for PaymentRecords
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import type { PaymentTransaction } from '../../types/financial.types';
import { money, fmtD, sMeta, initials, avatarColor } from '../../helpers/records.helpers';
import Icon from '../../../../components/common/Icon';

interface TableRowProps {
  tx: PaymentTransaction;
  idx: number;
  selected: boolean;
  panelOpen: boolean;
  onOpen: (tx: PaymentTransaction) => void;
}

const TableRow: React.FC<TableRowProps> = ({ tx, idx, selected, panelOpen, onOpen }) => {
  const meta = sMeta(tx.status);
  const avatarGradient = avatarColor(tx.id);

  return (
    <tr
      className={`
        border-b border-slate-100 dark:border-slate-800 cursor-pointer
        transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60
        ${selected ? 'bg-emerald-50/50 dark:bg-emerald-500/10' : ''}
      `}
      onClick={() => onOpen(tx)}
    >
      {/* User */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center flex-shrink-0`}>
            <span className="text-[10px] font-bold text-white">{initials(tx.user_name)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
              {tx.user_name || '—'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
              {tx.user_email}
            </p>
          </div>
        </div>
      </td>

      {/* Reference */}
      <td className={`px-4 py-3 ${panelOpen ? 'hidden 2xl:table-cell' : 'hidden md:table-cell'}`}>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          {tx.reference.slice(0, 12)}...
        </span>
      </td>

      {/* Amount */}
      <td className="px-4 py-3">
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {money(tx.amount, tx.currency)}
        </span>
      </td>

      {/* Status */}
      <td className={`px-4 py-3 ${panelOpen ? 'hidden xl:table-cell' : 'hidden sm:table-cell'}`}>
        <span className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
          ${meta.bg} ${meta.text} ${meta.border} border
        `}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>

      {/* Method */}
      <td className={`px-4 py-3 ${panelOpen ? 'hidden' : 'hidden lg:table-cell'}`}>
        <div className="flex items-center gap-1.5">
          <Icon
            name={tx.payment_method === 'card' ? 'credit_card' : tx.payment_method === 'bank' ? 'account_balance' : 'payments'}
            size={14}
            className="text-slate-400 dark:text-slate-500"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
            {tx.payment_method || '—'}
          </span>
        </div>
      </td>

      {/* Created */}
      <td className={`px-4 py-3 ${panelOpen ? 'hidden' : 'hidden xl:table-cell'}`}>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {fmtD(tx.created_at)}
        </span>
      </td>

      {/* Action */}
      <td className="px-4 py-3 text-right">
        <button
          className={`
            p-1.5 rounded-lg transition-colors
            ${selected
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }
          `}
        >
          <Icon name={selected ? 'expand_less' : 'expand_more'} size={18} />
        </button>
      </td>
    </tr>
  );
};

export { TableRow };
export default TableRow;

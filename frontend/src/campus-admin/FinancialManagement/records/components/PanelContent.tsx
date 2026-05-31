// ─────────────────────────────────────────────────────────────────────────────
// PanelContent.tsx — detail panel for PaymentRecords
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type { PaymentTransaction } from '../../types/financial.types';
import { money, fmtDT, sMeta, initials, avatarColor } from '../../helpers/records.helpers';
import Icon from '../../../../components/common/Icon';

interface PanelContentProps {
  tx: PaymentTransaction;
  onClose: () => void;
}

const PanelContent: React.FC<PanelContentProps> = ({ tx, onClose }) => {
  const meta = sMeta(tx.status);
  const avatarGradient = avatarColor(tx.id);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Transaction Details</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* User info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center flex-shrink-0`}>
            <span className="text-sm font-bold text-white">{initials(tx.user_name)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-800 dark:text-slate-200 truncate">
              {tx.user_name || '—'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {tx.user_email}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div className="text-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            Amount Paid
          </p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {money(tx.amount, tx.currency)}
          </p>
          <div className={`
            inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide
            ${meta.bg} ${meta.text} ${meta.border} border
          `}>
            <Icon name={meta.icon} size={12} />
            {meta.label}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Transaction Details
          </h3>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            <DetailRow icon="tag" label="Reference" value={tx.reference} />
            <DetailRow icon="payments" label="Currency" value={tx.currency} />
            <DetailRow 
              icon={tx.payment_method === 'card' ? 'credit_card' : tx.payment_method === 'bank' ? 'account_balance' : 'payments'} 
              label="Payment Method" 
              value={tx.payment_method ? tx.payment_method.charAt(0).toUpperCase() + tx.payment_method.slice(1) : '—'} 
            />
            <DetailRow 
              icon="verified_user" 
              label="Verified" 
              value={tx.amount_verified ? 'Yes' : 'No'} 
              valueColor={tx.amount_verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}
            />
          </div>
        </div>

        {/* Timestamps */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Timeline
          </h3>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            <DetailRow icon="schedule" label="Created" value={fmtDT(tx.created_at)} />
            <DetailRow icon="check_circle" label="Paid At" value={fmtDT(tx.paid_at)} />
            {tx.updated_at && <DetailRow icon="update" label="Updated" value={fmtDT(tx.updated_at)} />}
          </div>
        </div>

        {/* Metadata */}
        {tx.metadata && Object.keys(tx.metadata).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Additional Info
            </h3>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <pre className="text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(tx.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <button
          onClick={() => {
            navigator.clipboard.writeText(tx.id);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <Icon name="content_copy" size={16} />
          Copy Transaction ID
        </button>
      </div>
    </>
  );
};

// Helper component for detail rows
const DetailRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}> = ({ icon, label, value, valueColor }) => (
  <div className="flex items-center justify-between px-3 py-2.5">
    <div className="flex items-center gap-2">
      <Icon name={icon} size={16} className="text-slate-400 dark:text-slate-500" />
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    </div>
    <span className={`text-sm font-medium text-slate-800 dark:text-slate-200 ${valueColor || ''}`}>
      {value}
    </span>
  </div>
);

export { PanelContent };
export default PanelContent;

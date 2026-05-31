// ─────────────────────────────────────────────────────────────────────────────
// PeriodSelector.tsx
// Source: FinancialSanctum
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import type { Period } from '../types/financial.types';
import { PERIODS }     from '../constants/hub.constants';

export const PeriodSelector = memo(({ value, onChange }: {
  value: Period; onChange: (p: Period) => void;
}) => (
  <div
    className="flex items-center gap-0 border rounded-lg overflow-hidden p-0.5"
    style={{ background: 'var(--fh-surface2)', borderColor: 'var(--fh-border2)' }}>
    {PERIODS.map(p => (
      <button
        key={p.key}
        onClick={() => onChange(p.key)}
        className={`px-2.5 py-1 text-[10px] font-sans font-semibold transition-all rounded-md whitespace-nowrap ${
          value === p.key ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:text-slate-300'
        }`}
        style={value !== p.key ? { color: 'var(--fh-text3)' } : {}}>
        {p.label.replace(' ', '\u00a0')}
      </button>
    ))}
  </div>
));
PeriodSelector.displayName = 'PeriodSelector';
// ─────────────────────────────────────────────────────────────────────────────
// TrendBadge.tsx
// Source: FinancialSanctum
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import Icon from '../../../components/common/Icon';

export const TrendBadge = memo(({ delta, inverted = false }: {
  delta: number; inverted?: boolean;
}) => {
  const good = inverted ? delta <= 0 : delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon name={delta >= 0 ? 'arrow_drop_up' : 'arrow_drop_down'} size={14} />
      {Math.abs(delta)}%
    </span>
  );
});
TrendBadge.displayName = 'TrendBadge';
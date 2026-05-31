// ─────────────────────────────────────────────────────────────────────────────
// ProgressBar.tsx — progress / bar components
// Sources: FinancialSanctum (Bar), FinancialReports (SBar)
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import { clamp } from '../helpers/hub.helpers';
import { clamp as fsClamp } from '../helpers/reports.helpers';

// ─── Bar (Hub) ────────────────────────────────────────────────────────────────

export const Bar = memo(({ v, color = '#10b981', track = '#1e293b', h = 4 }: {
  v: number; color?: string; track?: string; h?: number;
}) => (
  <div className="fh-bar-track w-full rounded-full overflow-hidden"
    style={{ height: h, background: track }}>
    <div className="h-full rounded-full transition-all duration-700"
      style={{ width: `${clamp(v, 0, 100)}%`, background: color }} />
  </div>
));
Bar.displayName = 'Bar';

// ─── SBar (Reports) ───────────────────────────────────────────────────────────

export const SBar = memo(({ v, color = '#10b981', h = 4 }: {
  v: number; color?: string; h?: number;
}) => (
  <div className="fs-bar-track w-full rounded-full overflow-hidden" style={{ height: h }}>
    <div className="h-full rounded-full transition-all duration-700"
      style={{ width: `${fsClamp(v, 0, 100)}%`, background: color }} />
  </div>
));
SBar.displayName = 'SBar';
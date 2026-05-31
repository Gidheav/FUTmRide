// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader.tsx — section header components
// Sources: FinancialReports (FSSectionHeader), FinancialDashboard (ObsSectionHeader)
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';

// ─── FSSectionHeader (Reports — uses fs-text CSS classes) ────────────────────

export const FSSectionHeader = memo(({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="text-sm font-bold fs-text1 tracking-tight"
        style={{ fontFamily: 'Roboto Mono, monospace' }}>
        {title}
      </h3>
      {subtitle && <p className="text-[10px] fs-text3 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
));
FSSectionHeader.displayName = 'FSSectionHeader';

// ─── ObsSectionHeader (Dashboard — uses obs-section CSS classes) ──────────────

export const ObsSectionHeader = memo(({ title, desc, right }: {
  title: string; desc?: string; right?: React.ReactNode;
}) => (
  <div className="obs-section-hd">
    <div className="obs-section-accent" />
    <div>
      <div className="obs-section-title">{title}</div>
      {desc && <div className="obs-section-desc">{desc}</div>}
    </div>
    {right && <div className="obs-section-right">{right}</div>}
  </div>
));
ObsSectionHeader.displayName = 'ObsSectionHeader';
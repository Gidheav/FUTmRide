// ─────────────────────────────────────────────────────────────────────────────
// Card.tsx — surface card for Hub
// Source: FinancialSanctum
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';

export const Card = memo(({ children, className = '', glow = '' }: {
  children: React.ReactNode; className?: string; glow?: string;
}) => (
  <div
    className={`fh-card bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden ${className}`}
    style={glow ? { boxShadow: `0 0 0 1px ${glow}22, 0 4px 24px ${glow}11` } : {}}>
    {glow && (
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${glow}60, transparent)` }} />
    )}
    {children}
  </div>
));
Card.displayName = 'Card';
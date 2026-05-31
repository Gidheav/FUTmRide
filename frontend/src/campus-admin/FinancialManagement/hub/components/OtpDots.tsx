// ─────────────────────────────────────────────────────────────────────────────
// OtpDots.tsx — animated OTP digit-box display
// Source: FinancialSanctum lines 1232–1254
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo } from 'react';

export const OtpDots = memo(({ value, maxLen = 6 }: { value: string; maxLen?: number }) => (
  <div className="flex items-center justify-center gap-2.5 py-1">
    {Array.from({ length: maxLen }, (_, i) => {
      const ch       = value[i] || '';
      const isActive = i === value.length;
      return (
        <div
          key={i}
          className="transition-all duration-100"
          style={{
            width: 44, height: 56, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontFamily: 'monospace', fontWeight: 700,
            border: `2px solid ${ch ? '#f59e0b' : isActive ? 'rgba(245,158,11,0.5)' : '#334155'}`,
            background: ch ? 'rgba(245,158,11,0.12)' : isActive ? 'rgba(245,158,11,0.05)' : '#1e293b',
            color: ch ? '#fbbf24' : '#475569',
            transform: ch ? 'scale(1.05)' : 'scale(1)',
          }}>
          {ch || (isActive ? '|' : '·')}
        </div>
      );
    })}
  </div>
));
OtpDots.displayName = 'OtpDots';
// ─────────────────────────────────────────────────────────────────────────────
// KPICard.tsx — KPI card components
// Sources: FinancialSanctum (KPICard), FinancialReports (SCard),
//          FinancialDashboard (DashKPICard)
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import { useCount }   from '../hooks/useCount';
import { compact }    from '../helpers/hub.helpers';
import { clamp }      from '../helpers/reports.helpers';
import { Spark }      from './Charts';
import { ObsSpark }   from './Charts';
import { TrendBadge } from './TrendBadge';
import { Card }       from './Card';
import Icon from '../../../components/common/Icon'; // adjust path to project Icon component

// ─── KPICard (Hub — animated counter, uses Spark + TrendBadge) ───────────────

export const KPICard = memo(({
  label, value, sub, spark, color, icon, delta, prefix = '',
}: {
  label: string; value: number; sub: string;
  spark: number[]; color: string; icon: string;
  delta?: number; prefix?: string;
}) => {
  const animated = useCount(value, 900);
  const display  = prefix === '₦' ? compact(animated * 100)
    : prefix === '%' ? `${animated}%`
    : animated.toLocaleString();
  return (
    <Card className="p-4 flex flex-col gap-3" glow={color}>
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-sans font-semibold uppercase tracking-widest"
          style={{ color: 'var(--fh-text3)' }}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          {delta !== undefined && (
            <TrendBadge delta={delta} inverted={label.toLowerCase().includes('fail')} />
          )}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${color}22` }}>
            <Icon name={icon} size={14} style={{ color }} />
          </div>
        </div>
      </div>
      <div>
        <p className="text-2xl font-mono font-bold tracking-tight"
          style={{ color: 'var(--fh-text1)' }}>
          {display}
        </p>
        <p className="text-[10px] mt-0.5 font-sans" style={{ color: 'var(--fh-text3)' }}>{sub}</p>
      </div>
      <Spark pts={spark} color={color} w={80} h={24} />
    </Card>
  );
});
KPICard.displayName = 'KPICard';

// ─── SCard (Reports — themed container card, no counter) ─────────────────────

export const SCard = memo(({
  children, className = '', gold = false, highlight = false, style = {},
}: {
  children: React.ReactNode; className?: string;
  gold?: boolean; highlight?: boolean; style?: React.CSSProperties;
}) => {
  // Peek at theme via DOM class; Reports passes theme via context but SCard
  // can't use useTheme here — caller wraps it inside ThemeCtx, so we keep the
  // shadow neutral and let the CSS class handle colours.
  const isHl = highlight || gold;
  return (
    <div
      className={`fs-card relative overflow-hidden ${className}`}
      style={{
        boxShadow: isHl
          ? '0 0 0 1px rgba(16,185,129,0.22), 0 4px 24px rgba(16,185,129,0.09)'
          : '0 4px 16px rgba(0,0,0,0.20)',
        ...style,
      }}>
      {isHl && (
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg,transparent,#10b98160,transparent)' }} />
      )}
      {children}
    </div>
  );
});
SCard.displayName = 'SCard';

// ─── DashKPICard (Dashboard — obs-kpi classes, string value) ─────────────────

export const DashKPICard = memo(({
  label, value, sub, up, icon, color = 'var(--em)', sparkData,
}: {
  label: string; value: string; sub: string;
  up?: boolean; icon: string; color?: string; sparkData?: number[];
}) => (
  <div className="obs-kpi">
    <div className="obs-kpi-accent"
      style={{ background: `linear-gradient(90deg,${color},${color}88)` }} />
    <div className="obs-kpi-icon"><Icon name={icon} size={24} style={{ color: color }} /></div>
    <div className="obs-kpi-label">{label}</div>
    <div className="obs-kpi-value">{value}</div>
    <div className="obs-kpi-sub">
      {up !== undefined && (
        <span className={up ? 'obs-up' : 'obs-dn'}>{up ? '▲' : '▼'}</span>
      )}
      <span className={up === undefined ? 'obs-neu' : up ? 'obs-up' : 'obs-dn'}>{sub}</span>
    </div>
    {sparkData && (
      <div className="obs-kpi-spark">
        <ObsSpark data={sparkData} color={color} w={100} h={24} />
      </div>
    )}
  </div>
));
DashKPICard.displayName = 'DashKPICard';
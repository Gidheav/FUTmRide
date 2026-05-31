// dashboard/components/DashboardSkeleton.tsx
// Suspense fallback for lazy-loaded Observatory sections.

import { memo } from 'react';

const DashboardSkeleton = memo(() => (
  <div className="obs-fadein" style={{ padding: '4px 0' }}>
    {/* KPI row */}
    <div className="obs-kpi-grid" style={{ marginBottom: 18 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="obs-kpi" style={{ minHeight: 100 }}>
          <div className="obs-kpi-accent" style={{ background: 'var(--bg4)' }} />
          <div style={{ height: 10, width: 60, background: 'var(--bg4)', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ height: 24, width: '70%', background: 'var(--bg4)', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 10, width: '50%', background: 'var(--bg4)', borderRadius: 4 }} />
        </div>
      ))}
    </div>
    {/* Card row */}
    <div className="obs-g2" style={{ marginBottom: 14 }}>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="obs-card" style={{ minHeight: 200 }}>
          <div className="obs-card-stripe" style={{ background: 'var(--bg4)' }} />
          <div className="obs-card-hd">
            <div style={{ height: 12, width: 140, background: 'var(--bg4)', borderRadius: 4 }} />
          </div>
          <div style={{ height: 140, background: 'var(--bg4)', borderRadius: 6, opacity: 0.5 }} />
        </div>
      ))}
    </div>
    {/* Wide card */}
    <div className="obs-card obs-gmb" style={{ minHeight: 160 }}>
      <div className="obs-card-stripe" style={{ background: 'var(--bg4)' }} />
      <div className="obs-card-hd">
        <div style={{ height: 12, width: 200, background: 'var(--bg4)', borderRadius: 4 }} />
      </div>
      <div style={{ height: 100, background: 'var(--bg4)', borderRadius: 6, opacity: 0.5 }} />
    </div>
  </div>
));

DashboardSkeleton.displayName = 'DashboardSkeleton';
export default DashboardSkeleton;
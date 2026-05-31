// dashboard/sections/AnalyticsSection.tsx
// "Deep Analytics" — Cohort analysis, benchmarks, YoY comparison & ministry effectiveness.

import { useState, memo } from 'react';
import { ObsSectionHeader } from '../../components/SectionHeader';
import { Donut } from '../../components/DashCharts';
import { fmtK } from '../../helpers/dashboard.helpers';
import { MONTHS, COHORT_DATA, BENCHMARK_DATA } from '../../constants/dashboard.constants';

const AnalyticsSection = memo(() => {
  const [cohortMetric, setCohortMetric] = useState<'retention' | 'giving'>('retention');

  return (
    <div className="obs-fadein">
      <ObsSectionHeader
        title="Deep Analytics"
        desc="Cohort analysis, benchmarks, YoY comparison & ministry effectiveness"
      />

      {/* YoY comparison */}
      <div className="obs-card obs-gmb">
        <div className="obs-card-stripe" />
        <div className="obs-card-hd">
          <span className="obs-card-title">📊 Year-over-Year Giving Comparison</span>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, alignItems: 'center' }}>
            {[
              { y: '2023', c: 'var(--t3)' },
              { y: '2024', c: 'var(--blue)' },
              { y: '2025', c: 'var(--em)' },
            ].map(l => (
              <span key={l.y} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--t3)' }}>
                <span style={{ width: 12, height: 3, background: l.c, borderRadius: 2, display: 'inline-block' }} />
                {l.y}
              </span>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 600 160" style={{ width: '100%', height: 'auto', display: 'block' }}>
          {[
            { year: '2023', data: [1600000, 1700000, 1500000, 2200000, 1900000, 1800000, 1600000, 2000000, 2500000, 2700000, 2400000, 3600000], color: 'var(--t3)' },
            { year: '2024', data: [1900000, 2000000, 1800000, 2600000, 2300000, 2200000, 2000000, 2500000, 3100000, 3400000, 2900000, 4200000], color: 'var(--blue)' },
            { year: '2025', data: [2100000, 2400000, 2050000, 3100000, 2900000, 2500000, 2200000, 2700000, 3400000, 3800000, 3200000, 5100000], color: 'var(--em)' },
          ].map(({ data, color }, si) => {
            const mx = 6000000;
            const pts = data.map((v, i) => `${40 + i * (520 / 11)},${130 - (v / mx) * 110}`).join(' ');
            return (
              <g key={si}>
                <polyline fill="none" stroke={color} strokeWidth={si === 2 ? 2.2 : 1.4}
                  strokeLinejoin="round" opacity={si === 2 ? 1 : si === 1 ? 0.6 : 0.35} points={pts} />
                {si === 2 && data.map((v, i) => (
                  <circle key={i} cx={40 + i * (520 / 11)} cy={130 - (v / mx) * 110} r="3" fill={color} />
                ))}
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <line key={t} x1={40} y1={130 - t * 110} x2={580} y2={130 - t * 110}
              stroke="var(--b2)" strokeWidth="0.8" strokeDasharray="3,4" />
          ))}
          {MONTHS.map((m, i) => (
            <text key={i} x={40 + i * (520 / 11)} y={152} textAnchor="middle"
              style={{ fontSize: 9, fill: 'var(--t3)', fontFamily: 'JetBrains Mono' }}>
              {m}
            </text>
          ))}
        </svg>
      </div>

      {/* Cohort + Benchmark */}
      <div className="obs-g21">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--purple),#ec4899)' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🔬 Member Giving Cohort Retention</span>
            <div className="obs-tab-group">
              <button className={`obs-tab-btn${cohortMetric === 'retention' ? ' act' : ''}`}
                onClick={() => setCohortMetric('retention')}>Retention %</button>
              <button className={`obs-tab-btn${cohortMetric === 'giving' ? ' act' : ''}`}
                onClick={() => setCohortMetric('giving')}>Giving</button>
            </div>
          </div>
          <div className="obs-scroll-x">
            <table style={{ borderCollapse: 'collapse', minWidth: 460 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 9, color: 'var(--t3)', padding: '4px 8px', textAlign: 'left', fontWeight: 700 }}>Cohort</th>
                  {MONTHS.map(m => (
                    <th key={m} style={{ fontSize: 8, color: 'var(--t3)', padding: '3px 3px', textAlign: 'center', fontWeight: 700 }}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COHORT_DATA.map((row) => (
                  <tr key={row.year}>
                    <td style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', padding: '3px 8px', whiteSpace: 'nowrap' }}>
                      {row.year}
                    </td>
                    {MONTHS.map(m => {
                      const val = (row as Record<string, number | string>)[m] as number || 0;
                      const opacity = 0.1 + (val / 100) * 0.9;
                      return (
                        <td key={m} style={{ padding: '2px 2px', textAlign: 'center' }}>
                          <div className="obs-cohort-cell" style={{
                            background: `rgba(16,185,129,${opacity})`,
                            color: val > 70 ? '#fff' : 'var(--em)',
                            minWidth: 30, height: 26,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {val}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8, textAlign: 'center' }}>
            Darker green = higher retention. 2024 cohort shows best 12-month retention (83%) in 5 years.
          </div>
        </div>

        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--cyan),var(--em))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🏆 Peer Benchmark</span>
            <span className="obs-card-badge">vs Similar Churches</span>
          </div>
          {BENCHMARK_DATA.map(b => {
            const churchBetter = b.metric.includes('Admin') ? b.church < b.peer : b.church > b.peer;
            const mx = Math.max(b.church, b.peer) * 1.2;
            return (
              <div key={b.metric} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                  <span style={{ color: 'var(--t2)' }}>{b.metric}</span>
                  <span style={{ color: churchBetter ? 'var(--em)' : 'var(--amber)', fontWeight: 700 }}>
                    {churchBetter ? '▲ Above peer' : '▼ Below peer'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--t3)', width: 32 }}>Ours</span>
                  <div className="obs-prog-track" style={{ flex: 1 }}>
                    <div className="obs-prog-fill g" style={{ width: `${(b.church / mx) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--em)', width: 60, textAlign: 'right' }}>
                    {b.unit === '₦' ? `₦${b.church.toLocaleString()}` : b.church}{b.unit !== '₦' ? b.unit : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--t3)', width: 32 }}>Peer</span>
                  <div className="obs-prog-track" style={{ flex: 1 }}>
                    <div className="obs-prog-fill b" style={{ width: `${(b.peer / mx) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', width: 60, textAlign: 'right' }}>
                    {b.unit === '₦' ? `₦${b.peer.toLocaleString()}` : b.peer}{b.unit !== '₦' ? b.unit : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ministry ROI + Revenue concentration */}
      <div className="obs-g2">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--em),var(--amber))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">⚡ Ministry ROI Matrix</span>
            <span className="obs-card-badge amber">Cost Per Impact</span>
          </div>
          <table className="obs-tbl">
            <thead>
              <tr>
                <th>Ministry</th><th>Budget</th><th>Lives Reached</th><th>Cost/Person</th><th>ROI Score</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Outreach & Missions', budget: 2210000, reach: 3800, roi: 92 },
                { name: 'Children Ministry', budget: 1380000, reach: 420, roi: 78 },
                { name: 'Youth Ministry', budget: 870000, reach: 380, roi: 85 },
                { name: 'Food Bank Program', budget: 640000, reach: 1200, roi: 96 },
                { name: 'Counseling Center', budget: 320000, reach: 180, roi: 88 },
                { name: 'Online Ministry', budget: 420000, reach: 12000, roi: 99 },
                { name: 'Worship & Music', budget: 1650000, reach: 4500, roi: 71 },
              ].map(m => {
                const cpp = Math.round(m.budget / m.reach);
                return (
                  <tr key={m.name}>
                    <td style={{ fontWeight: 600, color: 'var(--t1)' }}>{m.name}</td>
                    <td>{fmtK(m.budget)}</td>
                    <td style={{ color: 'var(--blue)', fontWeight: 600 }}>{m.reach.toLocaleString()}</td>
                    <td style={{ color: 'var(--amber)', fontWeight: 600 }}>₦{cpp.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="obs-prog-track" style={{ width: 50 }}>
                          <div className="obs-prog-fill g" style={{ width: `${m.roi}%` }} />
                        </div>
                        <span className="obs-td-em">{m.roi}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--red),var(--amber))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🎪 Revenue Concentration</span>
            <span className="obs-card-badge red">Concentration Risk</span>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <Donut segments={[
              { color: 'var(--red)', pct: 15.4 },
              { color: 'var(--amber)', pct: 9.4 },
              { color: 'var(--purple)', pct: 6.9 },
              { color: 'var(--blue)', pct: 12.7 },
              { color: 'var(--em)', pct: 55.6 },
            ]} r={55} stroke={14} />
          </div>
          {[
            { label: 'Top 1 Donor', pct: 15.4, color: 'var(--red)' },
            { label: 'Top 2–3 Donors', pct: 16.3, color: 'var(--amber)' },
            { label: 'Top 4–8 Donors', pct: 12.7, color: 'var(--purple)' },
            { label: 'Congregational (rest)', pct: 55.6, color: 'var(--em)' },
          ].map(s => (
            <div key={s.label} className="obs-legend-item">
              <div className="obs-legend-dot" style={{ background: s.color }} />
              <span className="obs-legend-label">{s.label}</span>
              <span className="obs-legend-val">{s.pct}%</span>
            </div>
          ))}
          <div style={{
            background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.25)',
            borderRadius: 8, padding: '8px 10px', marginTop: 8, fontSize: 11, color: 'var(--red)',
          }}>
            ⚠️ Top 3 donors = 28.5% of income. Best practice: &lt;15%. Diversification recommended.
          </div>
        </div>
      </div>
    </div>
  );
});

AnalyticsSection.displayName = 'AnalyticsSection';
export default AnalyticsSection;
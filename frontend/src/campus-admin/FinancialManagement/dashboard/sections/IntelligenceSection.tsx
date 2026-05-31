// dashboard/sections/IntelligenceSection.tsx
// "AI Intelligence" — Pattern detection, correlations & predictive signals.

import { useState, memo } from 'react';
import { ObsSectionHeader } from '../../components/SectionHeader';
import { fmtK } from '../../helpers/dashboard.helpers';
import {
  MONTHLY_DATA, WEEKLY_HEATMAP, TOP_DONORS, INSIGHTS, MONTHS,
} from '../../constants/dashboard.constants';

const IntelligenceSection = memo(() => {
  const [activeInsight, setActiveInsight] = useState<number | null>(null);

  const corrLabels = ['Attendance', 'Giving', 'Events', 'New Members', 'Expenses'];
  const corrMatrix = [
    [1.00, 0.84, 0.62, 0.71, 0.45],
    [0.84, 1.00, 0.58, 0.63, 0.31],
    [0.62, 0.58, 1.00, 0.49, 0.52],
    [0.71, 0.63, 0.49, 1.00, 0.22],
    [0.45, 0.31, 0.52, 0.22, 1.00],
  ];

  const corrColor = (v: number) => {
    if (v >= 0.8) return { bg: 'rgba(16,185,129,0.7)', text: '#fff' };
    if (v >= 0.6) return { bg: 'rgba(16,185,129,0.4)', text: 'var(--em)' };
    if (v >= 0.4) return { bg: 'rgba(245,158,11,0.35)', text: 'var(--amber)' };
    if (v >= 0.2) return { bg: 'rgba(245,158,11,0.15)', text: 'var(--amber)' };
    return { bg: 'var(--bg3)', text: 'var(--t3)' };
  };

  return (
    <div className="obs-fadein">
      <ObsSectionHeader title="AI Intelligence" desc="Pattern detection, correlations & predictive signals" />

      {/* AI Insights grid */}
      <div className="obs-g2 obs-gmb">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--purple),var(--blue))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🧠 Smart Insights</span>
            <span className="obs-card-badge purple">8 Signals</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {INSIGHTS.map((ins, i) => (
              <div key={i} className={`obs-insight ${ins.type}`}
                onClick={() => setActiveInsight(i === activeInsight ? null : i)}>
                <div className="obs-insight-icon">{ins.icon}</div>
                <div>
                  <div className="obs-insight-title">{ins.title}</div>
                  <div className="obs-insight-text">{ins.text}</div>
                  <div className="obs-insight-meta">{ins.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Correlation matrix */}
          <div className="obs-card">
            <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--cyan),var(--blue))' }} />
            <div className="obs-card-hd">
              <span className="obs-card-title">📐 Correlation Matrix</span>
              <span className="obs-card-badge blue">Pearson r</span>
            </div>
            <div className="obs-scroll-x">
              <table style={{ borderCollapse: 'collapse', minWidth: 300 }}>
                <thead>
                  <tr>
                    <th style={{ width: 90, fontSize: 9, color: 'var(--t3)', padding: '4px 6px', textAlign: 'left' }} />
                    {corrLabels.map(l => (
                      <th key={l} style={{
                        fontSize: 8.5, color: 'var(--t3)', padding: '4px 5px',
                        textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap',
                      }}>{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corrMatrix.map((row, ri) => (
                    <tr key={ri}>
                      <td style={{
                        fontSize: 9, color: 'var(--t2)', padding: '4px 6px',
                        whiteSpace: 'nowrap', fontWeight: 700,
                      }}>{corrLabels[ri]}</td>
                      {row.map((v, ci) => {
                        const { bg, text } = corrColor(Math.abs(v));
                        return (
                          <td key={ci} style={{ padding: '3px 4px', textAlign: 'center' }}>
                            <div className="obs-mat-cell" style={{
                              background: bg, color: text,
                              minWidth: 36, height: 28, borderRadius: 5,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700,
                            }}>
                              {v.toFixed(2)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seasonal pattern */}
          <div className="obs-card">
            <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--amber),var(--red))' }} />
            <div className="obs-card-hd">
              <span className="obs-card-title">🌊 Seasonal Giving Index</span>
              <span className="obs-card-badge amber">4-Year Avg</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 3 }}>
              {MONTHLY_DATA.map((d, i) => {
                const normalized = d.giving / Math.max(...MONTHLY_DATA.map(x => x.giving));
                const opacity = 0.15 + normalized * 0.85;
                return (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{
                      height: 60,
                      background: `rgba(16,185,129,${opacity})`,
                      borderRadius: 4, marginBottom: 4,
                      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                      paddingBottom: 4, fontSize: 8, fontWeight: 700,
                      color: normalized > 0.6 ? '#fff' : 'var(--em)',
                      border: '1px solid var(--border)',
                    }}>
                      {Math.round(normalized * 100)}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--t3)' }}>{d.m}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly giving heatmap */}
      <div className="obs-card obs-gmb">
        <div className="obs-card-stripe" />
        <div className="obs-card-hd">
          <span className="obs-card-title">📅 52-Week Giving Heatmap</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: 'var(--t3)' }}>
            <span>Less</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(o => (
              <div key={o} style={{ width: 12, height: 12, borderRadius: 2, background: `rgba(16,185,129,${o})` }} />
            ))}
            <span>More</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 16 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} style={{ height: 18, fontSize: 8, color: 'var(--t3)', lineHeight: '18px' }}>{d}</div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(52,1fr)', gap: 2 }}>
            {WEEKLY_HEATMAP.map((week, wi) =>
              week.map((val, di) => {
                const opacity = 0.1 + (val / 10) * 0.9;
                return (
                  <div key={`${wi}-${di}`} className="obs-hm-cell"
                    style={{
                      height: 18, background: `rgba(16,185,129,${opacity})`,
                      borderRadius: 2, border: '1px solid var(--border)', minWidth: 0,
                    }}
                    title={`Week ${wi + 1} ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][di]}: ${val} gifts`} />
                );
              })
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: 'var(--t3)' }}>
          {MONTHS.map(m => <span key={m}>{m}</span>)}
        </div>
      </div>

      {/* Top donors table + Giving by zone */}
      <div className="obs-g21">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--em),var(--blue))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">👑 Top Donor Intelligence</span>
            <span className="obs-card-badge">Top 8 · {fmtK(TOP_DONORS.reduce((a, d) => a + d.ytd, 0))} YTD</span>
          </div>
          <div className="obs-scroll-x">
            <table className="obs-tbl">
              <thead>
                <tr>
                  <th>#</th><th>Donor / Entity</th><th>Type</th><th>YTD Giving</th><th>% of Total</th><th>MoM</th>
                </tr>
              </thead>
              <tbody>
                {TOP_DONORS.map(d => (
                  <tr key={d.rank}>
                    <td style={{ color: 'var(--t3)', fontWeight: 700 }}>{d.rank}</td>
                    <td style={{ fontWeight: 700, color: 'var(--t1)' }}>{d.name}</td>
                    <td>
                      <span className={`obs-pill ${d.type === 'Corporate' ? 'b' : d.type === 'Foundation' ? 'p' : d.type === 'Memorial' ? 'a' : 'g'}`}>
                        {d.type}
                      </span>
                    </td>
                    <td className="obs-td-em">{fmtK(d.ytd)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="obs-prog-track" style={{ width: 60 }}>
                          <div className="obs-prog-fill g" style={{ width: `${Math.min(d.pct * 3, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>{d.pct}%</span>
                      </div>
                    </td>
                    <td className={d.mom.startsWith('+') ? 'obs-td-em' : 'obs-td-red'}>{d.mom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--purple),var(--em))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">📍 Giving by Zone</span>
          </div>
          {[
            { zone: 'Lekki', giving: 12400000, members: 320, color: 'var(--em)' },
            { zone: 'Victoria Island', giving: 9800000, members: 210, color: 'var(--blue)' },
            { zone: 'Ajah', giving: 8200000, members: 290, color: 'var(--purple)' },
            { zone: 'Ikoyi', giving: 7600000, members: 180, color: 'var(--cyan)' },
            { zone: 'Surulere', giving: 6400000, members: 260, color: 'var(--amber)' },
            { zone: 'Yaba', giving: 5800000, members: 200, color: 'var(--red)' },
            { zone: 'Mainland', giving: 4800000, members: 115, color: 'var(--em2)' },
          ].map(z => (
            <div key={z.zone} className="obs-comp-row">
              <div className="obs-comp-label">{z.zone}</div>
              <div className="obs-comp-track">
                <div className="obs-comp-fill" style={{ width: `${z.giving / 12400000 * 100}%`, background: z.color }} />
              </div>
              <div className="obs-comp-val">{fmtK(z.giving)}</div>
            </div>
          ))}
          <div className="obs-div" />
          <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>
            Per-capita giving highest in:{' '}
            <span style={{ color: 'var(--em)', fontWeight: 700 }}>Victoria Island (₦46,667/member)</span>
          </div>
        </div>
      </div>
    </div>
  );
});

IntelligenceSection.displayName = 'IntelligenceSection';
export default IntelligenceSection;
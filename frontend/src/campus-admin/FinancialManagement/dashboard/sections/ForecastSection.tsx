// dashboard/sections/ForecastSection.tsx
// "Forecast Engine" — 12-month projections, scenario modeling & goal tracking.

import { useState, memo } from 'react';
import { DashKPICard } from '../../components/KPICard';
import { ObsSectionHeader } from '../../components/SectionHeader';
import { Gauge } from '../../components/DashCharts';
import { fmtK } from '../../helpers/dashboard.helpers';
import {
  MONTHS, FORECAST_SCENARIOS, GOALS, UPCOMING_EVENTS,
} from '../../constants/dashboard.constants';

const ForecastSection = memo(() => {
  const [scenario, setScenario] = useState<'optimistic' | 'base' | 'pessimistic'>('base');
  const scenarioColors: { [k: string]: string } = {
    optimistic: 'var(--em)',
    base: 'var(--blue)',
    pessimistic: 'var(--red)',
  };

  const fcData = FORECAST_SCENARIOS[scenario];
  const fcMax = Math.max(...Object.values(FORECAST_SCENARIOS).flat());
  const fcMin = Math.min(...Object.values(FORECAST_SCENARIOS).flat());
  const totalForecast = fcData.reduce((a, v) => a + v, 0);

  return (
    <div className="obs-fadein">
      <ObsSectionHeader
        title="Forecast Engine"
        desc="12-month projections, scenario modeling & goal tracking"
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            {(['optimistic', 'base', 'pessimistic'] as const).map(s => (
              <button key={s} className={`obs-scenario-btn${scenario === s ? ' act' : ''}`}
                onClick={() => setScenario(s)}
                style={{
                  color: scenario === s ? scenarioColors[s] : 'var(--t3)',
                  borderColor: scenario === s ? scenarioColors[s] : 'var(--b2)',
                }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {/* Forecast KPIs */}
      <div className="obs-kpi-grid" style={{ marginBottom: 14 }}>
        {[
          { label: 'Projected Annual Income', val: fmtK(totalForecast), sub: '12-month forecast', icon: '📈', color: scenarioColors[scenario] },
          { label: 'vs Last Year', val: '+14.2%', sub: 'Year-over-year growth', icon: '📊', up: true, color: 'var(--em)' },
          { label: 'Projected Surplus', val: fmtK(totalForecast * 0.22), sub: '22% surplus margin', icon: '💹', up: true, color: 'var(--purple)' },
          { label: 'Break-Even Month', val: 'Mar 2025', sub: 'Revenue covers all costs', icon: '⚖️', color: 'var(--cyan)' },
        ].map((k, i) => (
          <DashKPICard key={i} label={k.label} value={k.val} sub={k.sub} icon={k.icon} color={k.color} up={k.up} />
        ))}
      </div>

      {/* Forecast chart */}
      <div className="obs-card obs-gmb">
        <div className="obs-card-stripe" style={{
          background: `linear-gradient(90deg,${scenarioColors[scenario]},${scenarioColors[scenario]}88)`,
        }} />
        <div className="obs-card-hd">
          <span className="obs-card-title">
            📈 12-Month Income Projection — {scenario.charAt(0).toUpperCase() + scenario.slice(1)} Scenario
          </span>
          <span className="obs-card-badge" style={{
            background: `rgba(${scenario === 'optimistic' ? '16,185,129' : scenario === 'base' ? '59,130,246' : '244,63,94'},.12)`,
            color: scenarioColors[scenario],
            borderColor: `${scenarioColors[scenario]}44`,
          }}>{fmtK(totalForecast)} Total</span>
        </div>
        <div style={{ position: 'relative' }}>
          <svg viewBox="0 0 600 160" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="obs-fcg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={scenarioColors[scenario]} stopOpacity="0.3" />
                <stop offset="100%" stopColor={scenarioColors[scenario]} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Faded scenario lines */}
            {(['optimistic', 'base', 'pessimistic'] as const).filter(s => s !== scenario).map(s => {
              const pts = FORECAST_SCENARIOS[s].map((v, i) =>
                `${40 + i * (560 / 11)},${140 - ((v - fcMin) / (fcMax - fcMin)) * 120}`).join(' ');
              return (
                <polyline key={s} fill="none" stroke={scenarioColors[s]} strokeWidth="1"
                  strokeDasharray="4,4" opacity="0.25" points={pts} />
              );
            })}
            {/* Active scenario */}
            {(() => {
              const pts = fcData.map((v, i) =>
                `${40 + i * (560 / 11)},${140 - ((v - fcMin) / (fcMax - fcMin)) * 120}`);
              const area = `M40,140 L${pts.join(' L')} L${40 + 11 * (560 / 11)},140 Z`;
              const line = pts.join(' ');
              return (
                <>
                  <path d={area} fill="url(#obs-fcg)" />
                  <polyline fill="none" stroke={scenarioColors[scenario]} strokeWidth="2.5"
                    strokeLinejoin="round" strokeLinecap="round" points={line} />
                  {fcData.map((v, i) => (
                    <circle key={i}
                      cx={40 + i * (560 / 11)}
                      cy={140 - ((v - fcMin) / (fcMax - fcMin)) * 120}
                      r="3.5" fill={scenarioColors[scenario]} />
                  ))}
                </>
              );
            })()}
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <line key={t} x1={40} y1={140 - t * 120} x2={600} y2={140 - t * 120}
                stroke="var(--b2)" strokeWidth="0.8" strokeDasharray="3,4" />
            ))}
            {/* X labels */}
            {MONTHS.map((m, i) => (
              <text key={i} x={40 + i * (560 / 11)} y={158} textAnchor="middle"
                style={{ fontSize: 9, fill: 'var(--t3)', fontFamily: 'JetBrains Mono' }}>
                {m}
              </text>
            ))}
            {/* Y labels */}
            {[fcMin, fcMin + (fcMax - fcMin) * 0.5, fcMax].map((v, i) => (
              <text key={i} x={36} y={140 - i * 0.5 * 120 + 3} textAnchor="end"
                style={{ fontSize: 8, fill: 'var(--t3)', fontFamily: 'JetBrains Mono' }}>
                {fmtK(v)}
              </text>
            ))}
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {(['optimistic', 'base', 'pessimistic'] as const).map(s => (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
              color: s === scenario ? 'var(--t1)' : 'var(--t3)',
            }}>
              <div style={{ width: 16, height: 2, background: scenarioColors[s], borderRadius: 1, opacity: s === scenario ? 1 : 0.3 }} />
              <span>{s.charAt(0).toUpperCase() + s.slice(1)}: {fmtK(FORECAST_SCENARIOS[s].reduce((a, v) => a + v, 0))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Goals + Calendar */}
      <div className="obs-g21">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--em),var(--em3))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🎯 Goal Tracker</span>
            <span className="obs-card-badge">5 Active Goals</span>
          </div>
          {GOALS.map(g => {
            const pct = Math.round(g.raised / g.target * 100);
            return (
              <div key={g.name} className="obs-goal">
                <div className="obs-goal-hd">
                  <div className="obs-goal-name">{g.icon} {g.name}</div>
                  <div className="obs-goal-pct">{pct}%</div>
                </div>
                <div className="obs-prog-track" style={{ height: 8, marginBottom: 6 }}>
                  <div className="obs-prog-fill g" style={{ width: `${pct}%` }} />
                </div>
                <div className="obs-goal-meta">
                  <span>{fmtK(g.raised)} of {fmtK(g.target)}</span>
                  <span>Deadline: {g.deadline}</span>
                  <span style={{ color: 'var(--em)', fontWeight: 700 }}>+{fmtK(g.target - g.raised)} needed</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="obs-card">
            <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--amber),var(--red))' }} />
            <div className="obs-card-hd">
              <span className="obs-card-title">📆 Financial Calendar</span>
              <span className="obs-card-badge amber">6 Upcoming</span>
            </div>
            {UPCOMING_EVENTS.map((e, i) => (
              <div key={i} className={`obs-cal-event ${e.type}`}>
                <div className="obs-cal-title">{e.title}</div>
                <div className="obs-cal-meta">
                  {e.date} · {e.days} days away{e.amount && ` · ${e.amount}`}
                </div>
              </div>
            ))}
          </div>

          <div className="obs-card">
            <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--blue),var(--purple))' }} />
            <div className="obs-card-hd">
              <span className="obs-card-title">💧 Cash Runway Model</span>
            </div>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Gauge value={32} max={100} color="var(--blue)" size={130} />
              <div style={{ marginTop: -10 }}>
                <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--t1)' }}>3.2</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>Months Cash Runway</div>
              </div>
            </div>
            <div className="obs-div" />
            {[
              { label: 'Current Cash', val: '₦12.8M' },
              { label: 'Monthly Burn', val: '₦3.9M' },
              { label: 'Target Runway', val: '6.0 months' },
              { label: 'Cash Needed', val: '₦10.6M' },
            ].map(s => (
              <div key={s.label} className="obs-stat-row">
                <span className="obs-stat-label">{s.label}</span>
                <span className="obs-stat-val">{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

ForecastSection.displayName = 'ForecastSection';
export default ForecastSection;
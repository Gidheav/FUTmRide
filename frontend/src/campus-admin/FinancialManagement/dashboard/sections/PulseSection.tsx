// dashboard/sections/PulseSection.tsx
// "Live Pulse" — Real-time activity stream, giving velocity & live metrics.
// NOTE: setInterval for live counters is intentionally kept inside this component — do NOT hoist.

import { useState, useEffect, memo } from 'react';
import { DashKPICard } from '../../components/KPICard';
import { ObsSectionHeader } from '../../components/SectionHeader';
import { AreaChart, Donut, Gauge } from '../../components/DashCharts';
import { fmtK } from '../../helpers/dashboard.helpers';
import { MONTHLY_DATA, ACTIVITY_FEED } from '../../constants/dashboard.constants';

const PulseSection = memo(() => {
  const [todayTotal, setTodayTotal] = useState(4280000);
  const [velocity, setVelocity] = useState(12);

  // Live simulation — intentionally inline per architecture decision
  useEffect(() => {
    const id = setInterval(() => {
      setTodayTotal(p => p + (Math.random() > 0.7 ? Math.round(Math.random() * 80000) : 0));
      setVelocity(Math.round(8 + Math.random() * 10));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const hourlyGiving = [
    120, 80, 60, 40, 30, 20, 15, 25, 180, 820, 1240, 960,
    640, 380, 290, 220, 410, 680, 920, 1100, 840, 600, 380, 240,
  ];
  const maxHourly = Math.max(...hourlyGiving);

  return (
    <div className="obs-fadein">
      <ObsSectionHeader
        title="Live Pulse"
        desc="Real-time activity stream, giving velocity & live metrics"
        right={
          <div className="obs-live-chip">
            <div className="obs-live-dot" />
            <span>LIVE</span>
          </div>
        }
      />

      {/* Live KPIs */}
      <div className="obs-kpi-grid">
        <DashKPICard label="Today's Giving" value={fmtK(todayTotal)} sub="Live counter" up={true} icon="⚡" color="var(--em)" />
        <DashKPICard label="Gifts/Hour" value={`${velocity}`} sub="Current velocity" up={velocity > 10} icon="🔥" color="var(--amber)" />
        <DashKPICard label="This Week" value="₦18.4M" sub="+12% vs last week" up={true} icon="📅" color="var(--blue)" />
        <DashKPICard label="Month-to-Date" value="₦28.7M" sub="On track for target" up={true} icon="📆" color="var(--purple)" />
      </div>

      {/* Hourly giving chart + Activity feed */}
      <div className="obs-g21">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="obs-card">
            <div className="obs-card-stripe" />
            <div className="obs-card-hd">
              <span className="obs-card-title">⚡ Hourly Giving Distribution — Today</span>
              <span className="obs-card-badge">{fmtK(hourlyGiving.reduce((a, v) => a + v * 1000, 0))}</span>
            </div>
            <div style={{ display: 'flex', gap: 2, height: 80, alignItems: 'flex-end', padding: '0 0 0 4px' }}>
              {hourlyGiving.map((v, i) => (
                <div key={i} title={`${i}:00 — ₦${(v * 1000).toLocaleString()}`}
                  style={{
                    flex: 1,
                    background: `rgba(16,185,129,${0.2 + (v / maxHourly) * 0.8})`,
                    borderRadius: '3px 3px 0 0',
                    height: `${(v / maxHourly) * 100}%`,
                    transition: 'height .4s ease',
                    cursor: 'pointer',
                    border: '1px solid rgba(16,185,129,.2)',
                    borderBottom: 'none',
                    minWidth: 0,
                  }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--t3)', marginTop: 4, padding: '0 4px' }}>
              <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
            </div>
          </div>

          {/* Channel split */}
          <div className="obs-card">
            <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--cyan),var(--blue))' }} />
            <div className="obs-card-hd">
              <span className="obs-card-title">💳 Channel Split — Live</span>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Donut segments={[
                { color: 'var(--em)', pct: 42 },
                { color: 'var(--blue)', pct: 31 },
                { color: 'var(--amber)', pct: 15 },
                { color: 'var(--purple)', pct: 12 },
              ]} r={40} stroke={11} />
              <div style={{ flex: 1 }}>
                {[
                  { label: 'Mobile/USSD', pct: 42, color: 'var(--em)' },
                  { label: 'Online Banking', pct: 31, color: 'var(--blue)' },
                  { label: 'Cash', pct: 15, color: 'var(--amber)' },
                  { label: 'POS/Other', pct: 12, color: 'var(--purple)' },
                ].map(c => (
                  <div key={c.label} className="obs-legend-item">
                    <div className="obs-legend-dot" style={{ background: c.color }} />
                    <span className="obs-legend-label">{c.label}</span>
                    <span className="obs-legend-pct">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--em),var(--purple))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🔴 Live Activity Stream</span>
            <span className="obs-card-badge">Real-time</span>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {ACTIVITY_FEED.map((item, i) => (
              <div key={i} className="obs-feed-item">
                <div className="obs-feed-icon" style={{
                  background: item.type === 'giving' ? 'rgba(16,185,129,.15)'
                    : item.type === 'expense' ? 'rgba(244,63,94,.15)' : 'var(--bg2)',
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="obs-feed-text">{item.text}</div>
                  <div className="obs-feed-time">{item.time}</div>
                </div>
                {item.amount && (
                  <div className="obs-feed-amount"
                    style={{ color: item.amount.startsWith('-') ? 'var(--red)' : 'var(--em)' }}>
                    {item.amount}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Velocity gauge + Digital adoption */}
      <div className="obs-g2">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--amber),var(--em))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🌡️ Giving Velocity Gauge</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <Gauge
                value={velocity} max={25}
                color={velocity > 18 ? 'var(--em)' : velocity > 12 ? 'var(--amber)' : 'var(--red)'}
                size={140} />
              <div style={{ marginTop: -8 }}>
                <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--t1)' }}>{velocity}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>Gifts per hour</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {[
                { label: 'Today vs Yesterday', val: '+34%', up: true },
                { label: 'Today vs Avg Sunday', val: '+12%', up: true },
                { label: 'Peak hour today', val: '10 AM', sub: '₦920K in 1hr' },
                { label: 'Largest single gift', val: '₦2.5M', sub: 'Folake Emmanuel' },
                { label: 'Avg gift size', val: '₦28,400', sub: '↑ from ₦22,100' },
                { label: 'Total givers today', val: '151 people', sub: '' },
              ].map(s => (
                <div key={s.label} className="obs-stat-row">
                  <div>
                    <div className="obs-stat-label">{s.label}</div>
                    {s.sub && <div style={{ fontSize: 10, color: 'var(--t3)' }}>{s.sub}</div>}
                  </div>
                  <div className="obs-stat-val" style={{
                    color: s.up === true ? 'var(--em)' : s.up === false ? 'var(--red)' : 'var(--t1)',
                  }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--blue),var(--cyan))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">📲 Digital Adoption Trend</span>
            <span className="obs-card-badge blue">12-Month</span>
          </div>
          <AreaChart
            data={MONTHLY_DATA.map((d, i) => ({
              ...d,
              digital: Math.round(40 + i * 2.3),
              mobile: Math.round(20 + i * 3.2),
            }))}
            keys={['digital', 'mobile']}
            colors={['var(--blue)', 'var(--em)']}
            height={140} />
          <div className="obs-div" />
          <div className="obs-g2" style={{ margin: 0, gap: 8 }}>
            {[
              { label: 'Digital Giving %', val: '68%', color: 'var(--blue)' },
              { label: 'Mobile Giving %', val: '42%', color: 'var(--em)' },
              { label: 'App Downloads', val: '2,840', color: 'var(--purple)' },
              { label: 'Repeat Digital Givers', val: '74%', color: 'var(--cyan)' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg2)', borderRadius: 8, padding: '7px 9px', border: '1px solid var(--b2)',
              }}>
                <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: 'Syne,sans-serif' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

PulseSection.displayName = 'PulseSection';
export default PulseSection;
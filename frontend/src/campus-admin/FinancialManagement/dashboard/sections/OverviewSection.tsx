// dashboard/sections/OverviewSection.tsx
// "Command Overview" — Real-time financial pulse of the church.

import { useState, memo } from 'react';
import { DashKPICard } from '../../components/KPICard';
import { ObsSectionHeader } from '../../components/SectionHeader';
import { AreaChart, BarChart, Donut } from '../../components/DashCharts';
import { useDashCounter } from '../../components/useDashCounter';
import { fmtK } from '../../helpers/dashboard.helpers';
import {
  MONTHLY_DATA, DEPT_SPENDING, FUND_ALLOCATION,
} from '../../constants/dashboard.constants';

const OverviewSection = memo(() => {
  const [period, setPeriod] = useState<'1M' | '3M' | '6M' | '1Y'>('1Y');
  const data = period === '1M' ? MONTHLY_DATA.slice(-1)
    : period === '3M' ? MONTHLY_DATA.slice(-3)
    : period === '6M' ? MONTHLY_DATA.slice(-6)
    : MONTHLY_DATA;

  const totalIncome  = MONTHLY_DATA.reduce((a, d) => a + d.income, 0);
  const totalGiving  = MONTHLY_DATA.reduce((a, d) => a + d.giving, 0);
  const totalExpense = MONTHLY_DATA.reduce((a, d) => a + d.expense, 0);
  const netSurplus   = totalIncome - totalExpense;
  const avIncome     = useDashCounter(Math.round(totalIncome / 1e6 * 10) / 10);

  return (
    <div className="obs-fadein">
      <ObsSectionHeader
        title="Command Overview"
        desc="Real-time financial pulse of the church"
        right={
          <div className="obs-tab-group">
            {(['1M', '3M', '6M', '1Y'] as const).map(p => (
              <button key={p} className={`obs-tab-btn${period === p ? ' act' : ''}`}
                onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
        }
      />

      {/* KPI Row */}
      <div className="obs-kpi-grid">
        <DashKPICard label="Annual Income" value={`₦${avIncome}M`} sub="+18.3% vs last year" up={true}
          icon="💰" sparkData={MONTHLY_DATA.map(d => d.income / 1e6)} />
        <DashKPICard label="Total Giving YTD" value={fmtK(totalGiving)} sub="+24.1% vs last year" up={true}
          icon="🙏" color="var(--blue)" sparkData={MONTHLY_DATA.map(d => d.giving / 1e6)} />
        <DashKPICard label="Net Surplus" value={fmtK(netSurplus)} sub="23.4% surplus margin" up={true}
          icon="📊" color="var(--purple)" sparkData={MONTHLY_DATA.map(d => (d.income - d.expense) / 1e6)} />
        <DashKPICard label="Avg Monthly Expense" value={fmtK(totalExpense / 12)} sub="+6.2% vs last year" up={false}
          icon="📤" color="var(--amber)" sparkData={MONTHLY_DATA.map(d => d.expense / 1e6)} />
      </div>

      {/* Main area chart + Fund donut */}
      <div className="obs-g21">
        <div className="obs-card">
          <div className="obs-card-stripe" />
          <div className="obs-card-hd">
            <span className="obs-card-title">Income vs Expense vs Giving</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, alignItems: 'center' }}>
              {[
                { label: 'Income', color: 'var(--em)' },
                { label: 'Expense', color: 'var(--red)' },
                { label: 'Giving', color: 'var(--blue)' },
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--t3)' }}>
                  <span style={{ width: 12, height: 3, background: l.color, borderRadius: 2, display: 'inline-block' }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <AreaChart
            data={data}
            keys={['income', 'expense', 'giving']}
            colors={['var(--em)', 'var(--red)', 'var(--blue)']}
            height={180} />
        </div>

        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--blue),var(--purple))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">Fund Allocation</span>
            <span className="obs-card-badge">₦55.0M</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Donut segments={FUND_ALLOCATION.map(f => ({ color: f.color, pct: f.pct }))} r={52} stroke={12} />
            <div style={{ width: '100%' }}>
              {FUND_ALLOCATION.map(f => (
                <div key={f.name} className="obs-legend-item">
                  <div className="obs-legend-dot" style={{ background: f.color }} />
                  <span className="obs-legend-label">{f.name}</span>
                  <span className="obs-legend-val">{fmtK(f.val)}</span>
                  <span className="obs-legend-pct">{f.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dept spending + membership */}
      <div className="obs-g21">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--purple),var(--cyan))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">Department Budget vs Actual</span>
            <span className="obs-card-badge">2025 YTD</span>
          </div>
          {DEPT_SPENDING.map(d => {
            const pct = Math.round(d.actual / d.budget * 100);
            const over = pct > 100;
            return (
              <div key={d.name} className="obs-comp-row">
                <div className="obs-comp-label">{d.name}</div>
                <div className="obs-comp-track">
                  <div className="obs-comp-fill" style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: over ? 'linear-gradient(90deg,var(--red),#fb7185)' : d.color,
                  }} />
                </div>
                <div className="obs-comp-val" style={{ color: over ? 'var(--red)' : 'var(--t1)' }}>
                  {fmtK(d.actual)}<span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 3 }}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--amber),var(--em2))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">Membership & Attendance</span>
          </div>
          <BarChart
            data={MONTHLY_DATA.map(d => ({ label: d.m, value: d.attendance }))}
            colors={[
              'var(--em)', 'var(--em2)', 'var(--em3)', 'var(--blue)', 'var(--purple)',
              'var(--cyan)', 'var(--amber)', 'var(--em)', 'var(--em2)', 'var(--em3)',
              'var(--blue)', 'var(--purple)',
            ]}
            height={100} />
          <div className="obs-div" style={{ margin: '10px 0 8px' }} />
          <div className="obs-g2" style={{ margin: 0, gap: 8 }}>
            {[
              { label: 'Total Members', val: '1,575', chg: '+35 this mo' },
              { label: 'Avg Attendance', val: '1,023', chg: '+4.2%' },
              { label: 'New Members', val: '35', chg: 'This month' },
              { label: 'Retention Rate', val: '94.2%', chg: '+1.1%' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--b2)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', fontFamily: 'Syne,sans-serif' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'var(--em)' }}>{s.chg}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly giving segment + Top stats */}
      <div className="obs-g2">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--cyan),var(--blue))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">Giving Channel Breakdown</span>
            <span className="obs-card-badge blue">This Month</span>
          </div>
          {[
            { label: 'Mobile/USSD', pct: 38, color: 'var(--em)', val: 2090000 },
            { label: 'Online Banking', pct: 30, color: 'var(--blue)', val: 1650000 },
            { label: 'Cash Offertory', pct: 18, color: 'var(--amber)', val: 990000 },
            { label: 'POS Terminal', pct: 9, color: 'var(--purple)', val: 495000 },
            { label: 'Crypto/Other', pct: 5, color: 'var(--cyan)', val: 275000 },
          ].map(c => (
            <div key={c.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--t2)' }}>{c.label}</span>
                <span style={{ color: 'var(--t1)', fontWeight: 700 }}>
                  {fmtK(c.val)}{' '}
                  <span style={{ color: 'var(--t3)', fontWeight: 400 }}>({c.pct}%)</span>
                </span>
              </div>
              <div className="obs-prog-track">
                <div className="obs-prog-fill" style={{ width: `${c.pct}%`, background: c.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--em),var(--cyan))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">Financial Health Snapshot</span>
          </div>
          {[
            { label: 'Cash & Equivalents', val: '₦12,800,000', sub: '3.2 months runway' },
            { label: 'Total Assets', val: '₦55,200,000', sub: '+4.2% MoM' },
            { label: 'Total Liabilities', val: '₦6,600,000', sub: 'Debt ratio: 12%' },
            { label: 'Net Worth (Equity)', val: '₦48,600,000', sub: '+₦2.1M this quarter' },
            { label: 'Monthly Cash Flow', val: '₦+2,300,000', sub: 'Positive surplus' },
            { label: 'Investment Portfolio', val: '₦18,400,000', sub: 'FGN Bonds + T-Bills' },
            { label: 'Designated Reserves', val: '₦9,200,000', sub: 'Building + Mission' },
            { label: 'Undesignated Surplus', val: '₦3,600,000', sub: 'Available for use' },
          ].map(s => (
            <div key={s.label} className="obs-stat-row">
              <div>
                <div className="obs-stat-label">{s.label}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>{s.sub}</div>
              </div>
              <div className="obs-stat-val">{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

OverviewSection.displayName = 'OverviewSection';
export default OverviewSection;
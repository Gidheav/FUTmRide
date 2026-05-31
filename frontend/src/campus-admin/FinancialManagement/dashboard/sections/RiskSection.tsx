// dashboard/sections/RiskSection.tsx
// "Risk Observatory" — Risk matrix, health score, compliance tracking & control assessment.

import { useState, memo } from 'react';
import { DashKPICard } from '../../components/KPICard';
import { ObsSectionHeader } from '../../components/SectionHeader';
import { Radar, Gauge } from '../../components/DashCharts';
import { RISK_MATRIX, RADAR_SCORES } from '../../constants/dashboard.constants';

const RiskSection = memo(() => {
  const [selRisk, setSelRisk] = useState<typeof RISK_MATRIX[0] | null>(null);

  const overallScore = Math.round(RADAR_SCORES.reduce((a, s) => a + s.score, 0) / RADAR_SCORES.length);
  const scoreColor = overallScore >= 80 ? 'var(--em)' : overallScore >= 60 ? 'var(--amber)' : 'var(--red)';

  const matrixGrid: string[][] = [
    ['L', 'L', 'M', 'M', 'H'],
    ['L', 'L', 'M', 'H', 'H'],
    ['L', 'M', 'M', 'H', 'C'],
    ['M', 'M', 'H', 'H', 'C'],
    ['M', 'H', 'H', 'C', 'C'],
  ];
  const matrixBg = (l: string) =>
    l === 'C' ? 'rgba(244,63,94,.28)' : l === 'H' ? 'rgba(244,63,94,.13)' : l === 'M' ? 'rgba(245,158,11,.13)' : 'rgba(16,185,129,.13)';
  const matrixColor = (l: string) =>
    l === 'C' || l === 'H' ? 'var(--red)' : l === 'M' ? 'var(--amber)' : 'var(--em)';

  return (
    <div className="obs-fadein">
      <ObsSectionHeader
        title="Risk Observatory"
        desc="Risk matrix, health score, compliance tracking & control assessment"
      />

      {/* Risk KPIs */}
      <div className="obs-kpi-grid">
        <DashKPICard label="Overall Health Score" value={`${overallScore}/100`} sub="Multi-dimensional score" icon="🛡️" color={scoreColor} />
        <DashKPICard label="Critical Risks" value="1" sub="Donor concentration" up={false} icon="🚨" color="var(--red)" />
        <DashKPICard label="High Risks" value="2" sub="Cash flow + Cyber" up={false} icon="⚠️" color="var(--amber)" />
        <DashKPICard label="Compliance Score" value="94%" sub="+2% vs last quarter" up={true} icon="✅" color="var(--em)" />
      </div>

      <div className="obs-g21">
        {/* Risk matrix */}
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--red),var(--amber))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🗺️ Risk Matrix — Likelihood × Impact</span>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 8, fontSize: 10, color: 'var(--t3)', textAlign: 'center' }}>← Likelihood →</div>
              <div style={{ display: 'grid', gridTemplateColumns: '24px repeat(5,1fr)', gap: 3 }}>
                <div />
                {['Very Low', 'Low', 'Med', 'High', 'Very High'].map(l => (
                  <div key={l} style={{ textAlign: 'center', fontSize: 8, color: 'var(--t3)', paddingBottom: 4 }}>{l}</div>
                ))}
                {[...matrixGrid].reverse().map((row, ri) => [
                  <div key={`lbl-${ri}`} style={{
                    fontSize: 8, color: 'var(--t3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '100%',
                  }}>
                    {['V.Low', 'Low', 'Med', 'High', 'V.High'][ri]}
                  </div>,
                  ...row.map((cell, ci) => (
                    <div key={`${ri}-${ci}`} className="obs-risk-cell"
                      style={{ background: matrixBg(cell), color: matrixColor(cell), border: `1px solid ${matrixColor(cell)}44` }}>
                      {cell}
                    </div>
                  )),
                ])}
              </div>
            </div>
            <div style={{ width: 200 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Active Risks
              </div>
              {RISK_MATRIX.slice(0, 6).map((r, i) => (
                <div key={i} className="obs-alert-item"
                  style={{ padding: '6px 0', borderBottom: '1px solid var(--b2)', cursor: 'pointer' }}
                  onClick={() => setSelRisk(r === selRisk ? null : r)}>
                  <div className="obs-alert-dot" style={{ background: matrixColor(r.level) }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)' }}>{r.risk}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>{r.owner}</div>
                  </div>
                  <span className={`obs-pill ${r.level === 'C' || r.level === 'H' ? 'r' : r.level === 'M' ? 'a' : 'g'}`}
                    style={{ marginLeft: 'auto' }}>
                    {r.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {selRisk && (
            <div style={{
              marginTop: 12, background: 'var(--bg2)', borderRadius: 8,
              padding: '10px 12px', border: '1px solid var(--b2)', fontSize: 12,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{selRisk.risk}</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--t3)' }}>Owner: <span style={{ color: 'var(--t1)' }}>{selRisk.owner}</span></span>
                <span style={{ color: 'var(--t3)' }}>Level: <span style={{ color: matrixColor(selRisk.level) }}>
                  {selRisk.level === 'C' ? 'Critical' : selRisk.level === 'H' ? 'High' : selRisk.level === 'M' ? 'Medium' : 'Low'}
                </span></span>
                <span style={{ color: 'var(--t3)' }}>Likelihood: <span style={{ color: 'var(--t1)' }}>{selRisk.likelihood}/5</span></span>
                <span style={{ color: 'var(--t3)' }}>Impact: <span style={{ color: 'var(--t1)' }}>{selRisk.impact}/5</span></span>
              </div>
            </div>
          )}
        </div>

        {/* Radar + Compliance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="obs-card">
            <div className="obs-card-stripe" style={{ background: `linear-gradient(90deg,${scoreColor},var(--blue))` }} />
            <div className="obs-card-hd">
              <span className="obs-card-title">🕸️ Financial Health Radar</span>
              <span className="obs-card-badge" style={{ color: scoreColor, borderColor: scoreColor, background: `${scoreColor}18` }}>
                {overallScore}/100
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Radar scores={RADAR_SCORES} size={180} />
              <div style={{ flex: 1 }}>
                {RADAR_SCORES.map(s => (
                  <div key={s.label} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: 'var(--t2)' }}>{s.label}</span>
                      <span style={{
                        fontWeight: 700,
                        color: s.score >= 80 ? 'var(--em)' : s.score >= 60 ? 'var(--amber)' : 'var(--red)',
                      }}>{s.score}</span>
                    </div>
                    <div className="obs-prog-track">
                      <div className="obs-prog-fill" style={{
                        width: `${s.score}%`,
                        background: s.score >= 80
                          ? 'linear-gradient(90deg,var(--em),var(--em2))'
                          : s.score >= 60
                          ? 'linear-gradient(90deg,var(--amber),#fcd34d)'
                          : 'linear-gradient(90deg,var(--red),#fb7185)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="obs-card">
            <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--purple),var(--blue))' }} />
            <div className="obs-card-hd">
              <span className="obs-card-title">✅ Compliance Scorecard</span>
              <span className="obs-card-badge purple">Q1 2025</span>
            </div>
            {[
              { item: 'Annual Accounts Filed', status: 'Done', icon: '✅' },
              { item: 'CAMA Compliance', status: 'Done', icon: '✅' },
              { item: 'FIRS Tax Returns', status: 'Done', icon: '✅' },
              { item: 'Employee PAYE Remittance', status: 'Current', icon: '✅' },
              { item: 'Pension Contributions', status: 'Current', icon: '✅' },
              { item: 'VAT Filing', status: 'Due Apr 21', icon: '⚠️' },
              { item: 'NSITF Registration', status: 'Pending', icon: '🔴' },
              { item: 'Annual Returns (CAC)', status: 'Due Jun', icon: '⚠️' },
            ].map(c => (
              <div key={c.item} className="obs-stat-row">
                <span className="obs-stat-label">{c.icon} {c.item}</span>
                <span className="obs-stat-val" style={{
                  fontSize: 11,
                  color: c.status === 'Done' || c.status === 'Current' ? 'var(--em)'
                    : c.status === 'Pending' ? 'var(--red)' : 'var(--amber)',
                }}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Liquidity analysis */}
      <div className="obs-g2">
        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--blue),var(--cyan))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">💧 Liquidity Analysis</span>
            <span className="obs-card-badge blue">Stress Test</span>
          </div>
          {[
            { scenario: 'Base Case', runway: '3.2 months', cash: '₦12.8M', color: 'var(--em)' },
            { scenario: '10% Income Drop', runway: '2.8 months', cash: '₦10.9M', color: 'var(--amber)' },
            { scenario: '30% Income Drop', runway: '1.8 months', cash: '₦7.0M', color: 'var(--amber)' },
            { scenario: '50% Income Drop', runway: '0.7 months', cash: '₦2.7M', color: 'var(--red)' },
            { scenario: 'Major Emergency (₦10M)', runway: '0.7 months', cash: '₦2.8M', color: 'var(--red)' },
          ].map(s => (
            <div key={s.scenario} className="obs-stat-row">
              <div>
                <div className="obs-stat-label">{s.scenario}</div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>{s.cash}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.runway}</span>
              </div>
            </div>
          ))}
          <div style={{
            background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.25)',
            borderRadius: 8, padding: '8px 10px', marginTop: 8, fontSize: 11, color: 'var(--blue)',
          }}>
            💡 Recommendation: Increase reserve to 6 months (₦23.4M needed). Current gap: ₦10.6M. Achievable in 6–9 months with systematic allocation.
          </div>
        </div>

        <div className="obs-card">
          <div className="obs-card-stripe" style={{ background: 'linear-gradient(90deg,var(--em),var(--cyan))' }} />
          <div className="obs-card-hd">
            <span className="obs-card-title">🔐 Internal Control Assessment</span>
          </div>
          <table className="obs-tbl">
            <thead>
              <tr><th>Control Area</th><th>Status</th><th>Score</th></tr>
            </thead>
            <tbody>
              {[
                { area: 'Dual Authorization', status: 'Active', score: 95 },
                { area: 'Segregation of Duties', status: 'Active', score: 88 },
                { area: 'Budget Approval Flow', status: 'Active', score: 92 },
                { area: 'Vendor Verification', status: 'Partial', score: 74 },
                { area: 'Digital Access Controls', status: 'Active', score: 90 },
                { area: 'Monthly Reconciliation', status: 'Active', score: 96 },
                { area: 'Petty Cash Controls', status: 'Weak', score: 55 },
                { area: 'Fraud Monitoring', status: 'Active', score: 82 },
              ].map(c => (
                <tr key={c.area}>
                  <td style={{ fontWeight: 600, color: 'var(--t1)' }}>{c.area}</td>
                  <td>
                    <span className={`obs-pill ${c.status === 'Active' ? 'g' : c.status === 'Partial' ? 'a' : 'r'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="obs-prog-track" style={{ width: 50 }}>
                        <div className="obs-prog-fill" style={{
                          width: `${c.score}%`,
                          background: c.score >= 85
                            ? 'linear-gradient(90deg,var(--em),var(--em2))'
                            : c.score >= 65
                            ? 'linear-gradient(90deg,var(--amber),#fcd34d)'
                            : 'linear-gradient(90deg,var(--red),#fb7185)',
                        }} />
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: c.score >= 85 ? 'var(--em)' : c.score >= 65 ? 'var(--amber)' : 'var(--red)',
                      }}>{c.score}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

RiskSection.displayName = 'RiskSection';
export default RiskSection;
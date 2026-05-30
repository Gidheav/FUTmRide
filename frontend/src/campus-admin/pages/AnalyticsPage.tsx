import type { CSSProperties, ReactNode } from 'react'
import { Activity, BarChart3, TrendingUp, Zap, ArrowRight } from 'lucide-react'
import { T } from '../theme'
import { useAnalyticsStore } from '../analyticsStore'

function AnalyticsCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section style={s.settingsCard}>
      <div style={s.settingsCardBody}>
        <div style={s.settingsCardHeader}>
          <h3 style={s.settingsCardTitle}>{title}</h3>
          <p style={s.settingsCardSub}>{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  )
}

function EfficiencyMetricsTab() {
  return (
    <div style={s.intelShell} className="scroll-col">
      <div style={s.intelGrid}>
        {/* 1. Efficiency Heatmap (Span 8) */}
        <section style={{ ...s.glassPanel, gridColumn: 'span 8', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: 400 }}>
          <div style={s.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={s.panelTitle}>Efficiency Heatmap Grid</h2>
              <span style={s.livePill}>LIVE</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={s.legendPill}><span style={{ ...s.legendDot, background: T.accent, boxShadow: `0 0 10px ${T.accent}` }} /> Optimal</span>
              <span style={s.legendPill}><span style={{ ...s.legendDot, background: T.warn, boxShadow: `0 0 10px ${T.warn}` }} /> Sub-optimal</span>
              <span style={s.legendPill}><span style={{ ...s.legendDot, background: T.error, boxShadow: `0 0 10px ${T.error}` }} /> Critical</span>
            </div>
          </div>
          
          <div style={{ padding: 4, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, background: T.bg, flex: 1 }}>
            {Array.from({ length: 96 }).map((_, i) => {
              let bg = T.bgCard;
              if (i % 7 === 0) bg = `${T.accent}40`;
              if (i % 11 === 0) bg = `${T.warn}40`;
              if (i % 23 === 0) bg = `${T.error}60`;
              if (i % 3 === 0 && i % 2 !== 0) bg = `${T.accent}80`;
              if (i === 42 || i === 43) bg = T.error;
              
              return (
                <div key={i} style={{ 
                  aspectRatio: '1/1', 
                  backgroundColor: bg, 
                  border: `1px solid ${T.borderLight}`,
                  borderRadius: 4,
                  transition: 'background-color 0.3s ease'
                }} />
              );
            })}
          </div>
        </section>

        {/* 2. Maintenance Cost Distribution Pie Chart (Span 4) */}
        <section style={{ ...s.glassPanel, gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 16, padding: 16, minHeight: 400 }}>
           <h2 style={{ ...s.panelTitle, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 8 }}>Maint. Cost Distribution</h2>
           
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <div style={{ width: 300, height: 300, borderRadius: '50%', border: `4px solid ${T.borderLight}`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bgCard }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `20px solid ${T.accent}`, clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 0 100%, 0 50%)' }}></div>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `18px solid ${T.blue}`, clipPath: 'polygon(50% 50%, 0 50%, 0 0, 50% 0)' }}></div>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `20px solid ${T.warn}`, clipPath: 'polygon(50% 50%, 0 20%, 0 0, 30% 0)' }}></div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, fontFamily: 'monospace' }}>$42k</span>
                  <span style={{ fontSize: 10, color: T.textSecondary }}>YTD TOTAL</span>
                </div>
              </div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textSecondary }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: T.accent }} />Routine</span><span style={{ color: T.textPrimary }}>65%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textSecondary }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: T.blue }} />Repairs</span><span style={{ color: T.textPrimary }}>25%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textSecondary }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: T.warn }} />Emergency</span><span style={{ color: T.textPrimary }}>10%</span></div>
           </div>
        </section>

        {/* 3. Regional Performance Bar Chart (Span 6) */}
        <section style={{ ...s.glassPanel, gridColumn: 'span 6', display: 'flex', flexDirection: 'column', padding: 16 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 8, marginBottom: 16 }}>
             <h2 style={s.panelTitle}>Regional Performance</h2>
             <select style={s.selectSmall}>
               <option>All Regions</option>
               <option>North</option>
               <option>South</option>
             </select>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 240, position: 'relative', background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 4, padding: '16px 16px 24px 16px' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 16, bottom: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: 0.1, pointerEvents: 'none' }}>
                {[1,2,3,4,5].map(i => <div key={i} style={{ height: 1, width: '100%', background: T.textWhite }} />)}
              </div>
              
              {[
                { label: 'NORTH', val: '80%', color: T.accent },
                { label: 'SOUTH', val: '65%', color: T.blue },
                { label: 'EAST', val: '40%', color: T.warn },
                { label: 'WEST', val: '90%', color: T.accent },
                { label: 'CENTRAL', val: '55%', color: T.blue }
              ].map(bar => (
                <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end', zIndex: 1 }}>
                  <span style={{ fontSize: 10, color: T.textPrimary, fontFamily: 'monospace' }}>{bar.val}</span>
                  <div style={{ width: 40, height: bar.val, background: bar.color, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: 0.8 }} />
                  <span style={{ position: 'absolute', bottom: 4, fontSize: 10, color: T.textSecondary, fontFamily: 'monospace' }}>{bar.label}</span>
                </div>
              ))}
           </div>
        </section>

        {/* 4. Logistical Velocity Line Chart (Span 6) */}
        <section style={{ ...s.glassPanel, gridColumn: 'span 6', display: 'flex', flexDirection: 'column', padding: 16 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 8, marginBottom: 16 }}>
             <h2 style={s.panelTitle}>Logistical Velocity</h2>
             <span style={{ ...s.livePill, animation: 'none', color: T.blue, borderColor: T.blue, background: `${T.blue}1A` }}>AVG: 42 km/h</span>
           </div>
           
           <div style={{ position: 'relative', height: 240, background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 4, overflow: 'hidden' }}>
             <svg viewBox="0 0 100 50" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
               <path d="M0,10 L100,10 M0,25 L100,25 M0,40 L100,40" stroke={T.borderLight} strokeWidth="0.5" fill="none" />
               <path d="M0,35 Q20,15 40,25 T80,10 L100,20 L100,30 L80,20 Q60,30 40,35 T0,45 Z" fill={`${T.accent}20`} />
               <path d="M0,30 Q20,10 40,20 T80,5 L100,15" stroke={T.accent} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
               <path d="M0,40 Q20,30 40,40 T80,30 L100,25" stroke={T.blue} strokeWidth="1" strokeDasharray="2,2" fill="none" vectorEffect="non-scaling-stroke" />
             </svg>
             <div style={{ position: 'absolute', bottom: 8, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textMuted, fontFamily: 'monospace' }}>
               <span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
             </div>
           </div>
        </section>

        {/* 5. Vehicle Performance Leaderboard (Span 12) */}
        <section style={{ ...s.glassPanel, gridColumn: 'span 12', display: 'flex', flexDirection: 'column', maxHeight: 400, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: `1px solid ${T.borderLight}`, background: T.bgPanel }}>
            <h2 style={s.panelTitle}>Vehicle Performance Leaderboard</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Search vehicle..." style={s.filterInput} />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', background: T.bg }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              <thead style={{ color: T.textSecondary, textTransform: 'uppercase', fontSize: 10 }}>
                <tr>
                  {['Rank', 'Vehicle ID', 'Driver', 'Efficiency Score', 'Status'].map((h, idx) => (
                    <th key={h} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.borderLight}`, position: 'sticky', top: 0, background: T.bgPanel, zIndex: 5, textAlign: idx === 3 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ color: T.textSecondary }}>
                {[
                  { rank: 1, id: 'VEH-901', driver: 'Sarah Connor', score: '98.5', status: 'Optimal', color: T.accent },
                  { rank: 2, id: 'VEH-442', driver: 'John Smith', score: '96.2', status: 'Optimal', color: T.accent },
                  { rank: 3, id: 'VEH-118', driver: 'Alice Vance', score: '91.0', status: 'Good', color: T.blue },
                  { rank: 4, id: 'VEH-055', driver: 'Robert F.', score: '85.4', status: 'Warning', color: T.warn },
                  { rank: 5, id: 'VEH-773', driver: 'Mike T.', score: '72.1', status: 'Critical', color: T.error },
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${T.borderLight}`, background: idx % 2 === 0 ? 'transparent' : T.bgCard }}>
                    <td style={{ padding: '10px 16px', color: T.textMuted }}>#{row.rank}</td>
                    <td style={{ padding: '10px 16px', color: T.textPrimary }}>{row.id}</td>
                    <td style={{ padding: '10px 16px' }}>{row.driver}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: T.textPrimary, fontWeight: 700 }}>{row.score}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: row.color }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.color }} />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}


function IntelligenceOpsTab() {
  return (
    <div style={s.intelShell}
      className="scroll-col">
      <div style={s.intelGrid}>
        <section style={{ ...s.glassPanel, gridColumn: 'span 8', display: 'flex', flexDirection: 'column', minHeight: 500, overflow: 'hidden' }}>
          <div style={s.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={s.panelTitle}>Live GIS Topology & Fleet State</h2>
              <span style={s.livePill}>LIVE DATA</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={s.legendPill}><span style={{ ...s.legendDot, background: T.accent, boxShadow: `0 0 10px ${T.accent}` }} /> High Density</span>
              <span style={s.legendPill}><span style={{ ...s.legendDot, background: T.blue, boxShadow: `0 0 10px ${T.blue}` }} /> Active Units</span>
              <span style={s.legendPill}><span style={{ ...s.legendDot, background: T.error, boxShadow: `0 0 10px ${T.error}` }} /> Anomalies</span>
            </div>
          </div>

          <div style={{ position: 'relative', flex: 1, background: T.mapBg }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url("https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1600")', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.4, mixBlendMode: 'luminosity', filter: 'grayscale(1) contrast(1.25)' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgNDBoNDBWMEgwem0zOS0xVjFoLTM4djM4aDM4eiIgZmlsbD0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA1KSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')", opacity: 0.5 }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${T.bg}, transparent)` }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, ${T.bg}, transparent, ${T.bg})` }} />

            <div style={{ position: 'absolute', top: '30%', left: '40%', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20 }}>
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.accentDim}`, boxShadow: `0 0 20px ${T.accent}`, animation: 'pulse 3s ease-in-out infinite' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: T.accent, boxShadow: `0 0 10px ${T.accent}` }} />
                </div>
              </div>
              <div style={{ marginTop: 8, background: T.mapTooltipBg, border: `1px solid ${T.accentDim}`, padding: 8, borderRadius: 6, display: 'none' }} />
            </div>

            <div style={{ position: 'absolute', top: '55%', left: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.warnBg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.error}` }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.error, animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
              </div>
              <span style={s.anomalyLabel}>CONGESTION_SEC_4</span>
            </div>

            <div style={{ position: 'absolute', top: '60%', left: '70%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={s.fleetNodeBig}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.textWhite }} />
              </div>
              <svg style={{ position: 'absolute', top: 12, right: 12, width: 128, height: 64, opacity: 0.5 }} viewBox="0 0 100 50">
                <path d="M0,50 Q20,20 50,30 T100,0" fill="none" stroke={T.blue} strokeDasharray="2 2" strokeWidth="1" />
              </svg>
            </div>
            <div style={{ position: 'absolute', top: '45%', left: '65%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={s.fleetNodeSm}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: T.textWhite }} />
              </div>
            </div>
            <div style={{ position: 'absolute', top: '35%', left: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={s.fleetNodeSm}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: T.textWhite }} />
              </div>
            </div>

            <div style={s.zoneSidebar}>
              <div style={s.zoneHeader}>Zone Hotspots</div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: 10, fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ color: T.textSecondary, borderBottom: `1px solid ${T.borderLight}` }}>
                      <th style={{ paddingBottom: 4, fontWeight: 'normal' }}>ZONE</th>
                      <th style={{ paddingBottom: 4, fontWeight: 'normal', textAlign: 'right' }}>DMD</th>
                      <th style={{ paddingBottom: 4, fontWeight: 'normal', textAlign: 'right' }}>SUP</th>
                      <th style={{ paddingBottom: 4, fontWeight: 'normal', textAlign: 'center' }}>STAT</th>
                    </tr>
                  </thead>
                  <tbody style={{ color: T.textPrimary }}>
                    {[
                      { zone: 'SEC_A', dmd: 842, sup: 412, stat: 'DEF', color: T.error },
                      { zone: 'SEC_B', dmd: 310, sup: 315, stat: 'BAL', color: T.accent, bg: T.bgCard },
                      { zone: 'SEC_C', dmd: 150, sup: 280, stat: 'SUR', color: T.blue },
                      { zone: 'SEC_D', dmd: 95, sup: 90, stat: 'BAL', color: T.accent },
                      { zone: 'SEC_E', dmd: 45, sup: 12, stat: 'DEF', color: T.error },
                      { zone: 'SEC_F', dmd: 120, sup: 125, stat: 'BAL', color: T.accent },
                    ].map(row => (
                      <tr key={row.zone} style={{ borderBottom: `1px solid ${T.borderLight}`, background: row.bg || 'transparent' }}>
                        <td style={{ padding: '8px 0', color: row.color === T.accent ? T.textPrimary : row.color }}>{row.zone}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>{row.dmd}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>{row.sup}</td>
                        <td style={{ padding: '8px 0', textAlign: 'center', color: row.color }}>{row.stat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section style={{ ...s.glassPanel, gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 16, height: 500, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 8 }}>
            <h2 style={s.panelTitle}>Demand vs Supply (24H)</h2>
            <select style={s.selectSmall}>
              <option>Last 24H</option>
              <option>Last 72H</option>
              <option>Last 7D</option>
              <option>Live Ticker</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 16, fontFamily: 'monospace', fontSize: 11, color: T.textSecondary }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: T.accent, border: `1px solid ${T.accentDim}` }} />Supply Volume</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: T.blue, border: `1px solid ${T.blue}` }} />Demand Vol.</span>
          </div>
          <div style={{ position: 'relative', flex: 1, background: T.bgCard, border: `1px solid ${T.borderLight}`, padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'absolute', left: 0, top: 16, bottom: 32, width: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 9, color: T.textMuted, textAlign: 'right', paddingRight: 8, fontFamily: 'monospace' }}>
              <span>5k</span><span>4k</span><span>3k</span><span>2k</span><span>1k</span><span>0</span>
            </div>
            <div style={{ position: 'absolute', left: 32, right: 16, top: 16, bottom: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: 0.1 }}>
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} style={{ height: 1, width: '100%', background: T.textWhite }} />)}
            </div>
            <div style={{ position: 'absolute', left: 32, right: 16, top: 16, bottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
              {[
                { s: '30%', d: '35%' }, { s: '45%', d: '40%' }, { s: '20%', d: '30%' },
                { s: '85%', d: '60%', surge: true }, { s: '65%', d: '70%' }, { s: '40%', d: '55%' },
                { s: '35%', d: '35%' }, { s: '15%', d: '25%' }
              ].map((bar, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%', width: '8%', position: 'relative' }}>
                  <div style={{ width: '50%', background: T.blue, height: bar.s, borderTop: bar.surge ? `2px solid ${T.error}` : 'none' }} />
                  <div style={{ width: '50%', background: T.accent, height: bar.d }} />
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 32, right: 16, bottom: 0, height: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 9, color: T.textMuted, paddingBottom: 4, fontFamily: 'monospace' }}>
              <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={s.metricBox}>
              <span style={s.metricLabel}>Peak Demand</span>
              <span style={{ color: T.blue, fontFamily: 'monospace', fontSize: 14 }}>4,350 <span style={s.metricMeta}>@08:00</span></span>
            </div>
            <div style={s.metricBox}>
              <span style={s.metricLabel}>Max Supply Cap</span>
              <span style={{ color: T.accent, fontFamily: 'monospace', fontSize: 14 }}>3,800 <span style={s.metricMeta}>UNITS</span></span>
            </div>
          </div>
        </section>

        <section style={{ ...s.glassPanel, gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 20, padding: 16 }}>
          <h2 style={{ ...s.panelTitle, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 8 }}>Fleet Composition Matrix</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              {
                label: 'TYPE',
                entries: [
                  { name: 'Sedans (Std)', value: '68%', color: T.accent },
                  { name: 'Vans (HCap)', value: '22%', color: T.blue },
                  { name: 'Micro', value: '10%', color: T.border },
                ],
                slices: [
                  { color: T.accent, clip: 'polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 0 100%, 0 50%)' },
                  { color: T.blue, clip: 'polygon(50% 50%, 0 50%, 0 0, 50% 0)' },
                ],
              },
              {
                label: 'STAT',
                entries: [
                  { name: 'Active', value: '82%', color: T.accent },
                  { name: 'Idle/Chg', value: '15%', color: T.warn },
                  { name: 'Maint/Err', value: '3%', color: T.error },
                ],
                slices: [
                  { color: T.accent, clip: 'polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 0 100%, 0 20%)' },
                  { color: T.warn, clip: 'polygon(50% 50%, 0 20%, 0 0, 30% 0)' },
                  { color: T.error, clip: 'polygon(50% 50%, 30% 0, 50% 0)' },
                ],
              },
              {
                label: 'OCC',
                entries: [
                  { name: '> 75% Full', value: '45%', color: T.blue },
                  { name: '< 75% Full', value: '55%', color: T.borderLight },
                ],
                slices: [
                  { color: T.blue, clip: 'polygon(50% 50%, 50% 0, 100% 0, 100% 60%)' },
                  { color: T.borderLight, clip: 'polygon(50% 50%, 100% 60%, 100% 100%, 0 100%, 0 0, 50% 0)' },
                ],
                meter: true,
              },
            ].map(chart => (
              <div key={chart.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={s.pieShell}>
                  {chart.slices.map((slice, idx) => (
                    <div key={idx} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `4px solid ${slice.color}`, clipPath: slice.clip }} />
                  ))}
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{chart.label}</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'monospace', fontSize: 11 }}>
                  {chart.entries.map(entry => (
                    <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', color: T.textSecondary }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: entry.color }} />{entry.name}</span>
                      <span style={{ color: T.textPrimary }}>{entry.value}</span>
                    </div>
                  ))}
                  {chart.meter && (
                    <div style={{ width: '100%', height: 4, background: T.border, marginTop: 4 }}>
                      <div style={{ height: '100%', width: '45%', background: T.blue }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...s.glassPanel, gridColumn: 'span 8', display: 'flex', flexDirection: 'column', maxHeight: 600, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: `1px solid ${T.borderLight}`, background: T.bgPanel }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={s.panelTitle}>Raw Telemetry & Logistics Log</h2>
              <span style={s.liveDot}>
                <span style={s.livePing} />
                <span style={s.liveCore} />
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Filter grep..." style={s.filterInput} />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', background: T.bg }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              <thead style={{ color: T.textSecondary, textTransform: 'uppercase', fontSize: 10 }}>
                <tr>
                  {['Timestamp', 'Lvl', 'Src Node', 'Payload / Event String', 'Sys Actor'].map((h, idx) => (
                    <th key={h} style={{ padding: '8px 12px', borderBottom: `1px solid ${T.borderLight}`, position: 'sticky', top: 0, background: T.bgPanel, zIndex: 5, textAlign: idx === 4 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ color: T.textSecondary }}>
                {[
                  { lvl: 'CRIT', color: T.error, border: T.error, msg: 'ERR_SURGE_THRESHOLD_EXCEEDED: 45+ pending requests. Queue depth critical.', time: '10:42:15.882', node: 'NODE_B42', actor: 'SYS_AUTO_M', bg: T.warnBg },
                  { lvl: 'WARN', color: T.warn, border: T.warn, msg: "VELOCITY_DROP_DETECTED: Congestion zone matched polygon 'Main_Gate'. v < 5km/h.", time: '10:40:02.114', node: 'VEH_042', actor: 'FLT_OP_DB' },
                  { lvl: 'INFO', color: T.textSecondary, border: T.borderLight, msg: 'Heartbeat sync OK. 1482/1482 nodes active. Latency: 42ms.', time: '10:39:15.001', node: 'SYS_OPT', actor: 'SYS_CORE' },
                  { lvl: 'STAT', color: T.blue, border: T.blue, msg: 'STATE_CHANGE: MAINT -> ACTIVE. Routine diag complete. Hsh: 0x8f2a', time: '10:38:45.332', node: 'VEH_018', actor: 'MAINT_API' },
                  { lvl: 'EXEC', color: T.accent, border: T.accent, msg: 'OPT_PATH_APPLIED: Sector N re-routed. Expected delta Δt = -1.2m.', time: '10:35:10.999', node: 'ROUTER_N', actor: 'SYS_AUTO_R' },
                  { lvl: 'INFO', color: T.textSecondary, border: T.borderLight, msg: 'Batch request processed. n=142. t=12ms.', time: '10:34:22.105', node: 'API_GW', actor: 'EXT_API', faint: true },
                  { lvl: 'INFO', color: T.textSecondary, border: T.borderLight, msg: 'Hourly metric snapshot committed to DB.', time: '10:30:00.000', node: 'SYS_CORE', actor: 'SYS_CRON', faint: true },
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${T.borderLight}`, borderLeft: `2px solid ${row.border}`, background: row.bg || 'transparent', opacity: row.faint ? 0.7 : 1 }}>
                    <td style={{ padding: '6px 12px', color: T.textMuted }}>{row.time}</td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ background: row.lvl === 'INFO' ? T.bgCard : `${row.color}33`, color: row.color, padding: '2px 4px', borderRadius: 2, fontSize: 9, border: `1px solid ${row.color}` }}>{row.lvl}</span>
                    </td>
                    <td style={{ padding: '6px 12px', color: T.blue }}>{row.node}</td>
                    <td style={{ padding: '6px 12px', color: row.color }}>{row.msg}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: row.color }}>{row.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { activeTab } = useAnalyticsStore()

  return (
    <main style={s.main} className="settings-shell">
      <style>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes ping { 0% { transform: scale(1); opacity: 1; } 75%, 100% { transform: scale(2); opacity: 0; } }
        .scroll-col::-webkit-scrollbar { width: 6px; height: 6px; }
        .scroll-col::-webkit-scrollbar-track { background: color-mix(in srgb, var(--theme-border) 40%, transparent); }
        .scroll-col::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--theme-textMuted) 60%, transparent); border-radius: 2px; }
        .scroll-col::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--theme-textSecondary) 70%, transparent); }
      `}</style>
      
      {activeTab === 'intelligence' ? (
        <IntelligenceOpsTab />
      ) : (
        <EfficiencyMetricsTab />
      )}
    </main>
  )
}

const s: Record<string, CSSProperties> = {
  main: {
    position: 'relative',
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '1px 0',
    boxSizing: 'border-box',
    width: '100%',
  },
  header: { marginBottom: 24, position: 'relative', zIndex: 1 },
  kicker: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    background: T.accentBg,
    color: T.textPrimary,
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 14,
  },

  contentGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, position: 'relative', zIndex: 1 },
  contentCol: { display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 },

  intelShell: {
    backgroundColor: T.bg,
    backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wMykiLz48L3N2Zz4=')",
    flex: 1,
    padding: 2,
    minHeight: '100%',
    overflowX: 'hidden',
    boxSizing: 'border-box',
  },
  intelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    gap: 2,
    alignItems: 'stretch',
  },
  glassPanel: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 0,
    backdropFilter: 'blur(20px)',
  },
  panelHeader: {
    padding: 12,
    borderBottom: `1px solid ${T.borderLight}`,
    background: T.bgPanel,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backdropFilter: 'blur(12px)',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: T.textPrimary,
    margin: 0,
  },
  livePill: {
    background: T.accentBg,
    color: T.accent,
    border: `1px solid ${T.accentDim}`,
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 10,
    fontFamily: 'monospace',
    animation: 'pulse 3s ease-in-out infinite',
  },
  legendPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    color: T.textSecondary,
    background: T.bgCard,
    padding: '4px 8px',
    border: `1px solid ${T.borderLight}`,
    borderRadius: 6,
    fontFamily: 'monospace',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  anomalyLabel: {
    marginTop: 4,
    fontSize: 9,
    color: T.error,
    background: T.mapTooltipBg,
    padding: '0 4px',
    border: `1px solid ${T.error}`,
    fontFamily: 'monospace',
  },
  fleetNodeBig: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: T.blue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${T.blue}`,
    boxShadow: `0 0 20px ${T.blue}`,
  },
  fleetNodeSm: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: T.blue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${T.blue}`,
  },
  zoneSidebar: {
    position: 'absolute',
    right: 0,
    top: 48,
    bottom: 0,
    width: 256,
    background: T.mapOverlayBg,
    backdropFilter: 'blur(12px)',
    borderLeft: `1px solid ${T.borderLight}`,
    display: 'flex',
    flexDirection: 'column',
  },
  zoneHeader: {
    padding: '8px 10px',
    borderBottom: `1px solid ${T.borderLight}`,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: T.textSecondary,
  },
  selectSmall: {
    background: T.bgInput,
    border: `1px solid ${T.borderLight}`,
    color: T.textSecondary,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  metricBox: {
    background: T.bgCard,
    border: `1px solid ${T.borderLight}`,
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: 10,
    color: T.textSecondary,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
  },
  metricMeta: {
    fontSize: 10,
    color: T.textMuted,
  },
  pieShell: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    border: `4px solid ${T.borderLight}`,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: T.bgCard,
  },
  liveDot: {
    position: 'relative',
    width: 12,
    height: 12,
  },
  livePing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: T.error,
    opacity: 0.75,
    animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
  },
  liveCore: {
    position: 'absolute',
    inset: 3,
    borderRadius: '50%',
    background: T.error,
  },
  filterInput: {
    background: T.bgInput,
    border: `1px solid ${T.borderLight}`,
    color: T.textPrimary,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 11,
    outline: 'none',
    fontFamily: 'monospace',
  },

  sidebarCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 20,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    alignSelf: 'start',
  },
  sidebarHeader: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  sidebarIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: T.accentBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sidebarTitle: { color: T.textPrimary, fontSize: 15, fontWeight: 700 },
  sidebarText: { color: T.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 1.5 },
  checklist: { display: 'flex', flexDirection: 'column', gap: 14 },
  checkItem: {
    display: 'flex',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    background: 'transparent',
    border: `1px solid ${T.border}`,
  },
  checkIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: T.accentBg,
    flexShrink: 0,
  },
  checkTitle: { color: T.textPrimary, fontSize: 13, fontWeight: 700, marginBottom: 4 },
  checkText: { color: T.textSecondary, fontSize: 12, lineHeight: 1.5 },
  sidebarFooter: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 10,
    borderTop: `1px solid ${T.border}`,
  },
  sidebarFooterText: { color: T.textMuted, fontSize: 12, lineHeight: 1.5 },

  settingsCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  },
  settingsCardBody: {
    padding: '24px 28px',
  },
  settingsCardHeader: {
    marginBottom: 20,
  },
  settingsCardTitle: { color: T.textPrimary, fontSize: 16, fontWeight: 700, margin: 0 },
  settingsCardSub: { color: T.textSecondary, fontSize: 13, margin: '4px 0 0', lineHeight: 1.5 },
}


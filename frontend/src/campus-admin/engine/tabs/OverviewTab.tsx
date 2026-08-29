import type { CSSProperties } from 'react'
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock3,
  Gauge,
  RadioTower,
  Terminal,
  TrendingUp,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { VEHICLE_TYPES } from '../constants'
import type { FareConfig, PlatformSettings } from '../types'

const money = (value: number) => `NGN ${Math.round(value || 0).toLocaleString()}`

const sectionHeader: CSSProperties = {
  padding: '12px 16px',
  borderBottom: `1px solid ${T.border}`,
  background: T.bgCard,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const labelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: T.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const mutedText: CSSProperties = {
  fontSize: 11,
  color: T.textMuted,
  lineHeight: 1.4,
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  tone?: 'neutral' | 'ok' | 'warn'
}) {
  const color = tone === 'ok' ? '#10b981' : tone === 'warn' ? T.warn : T.textPrimary

  return (
    <div style={{ ...campusPanel.card, borderTop: `2px solid ${tone === 'neutral' ? T.borderLight : color}` }}>
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, minHeight: 86 }}>
        <div style={{ minWidth: 0 }}>
          <div style={labelStyle}>{label}</div>
          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color, lineHeight: 1, fontFamily: 'monospace' }}>
            {value}
          </div>
          <div style={{ ...mutedText, marginTop: 8 }}>{sub}</div>
        </div>
        <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bgInput, border: `1px solid ${T.border}`, flexShrink: 0 }}>
          <Icon size={16} color={color} />
        </div>
      </div>
    </div>
  )
}

function StatusPill({ tone, children }: { tone: 'live' | 'pending' | 'empty'; children: string }) {
  const palette = {
    live: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.32)' },
    pending: { color: T.warn, bg: T.warnBg, border: 'rgba(245,158,11,0.32)' },
    empty: { color: T.textMuted, bg: T.bgInput, border: T.border },
  }[tone]

  return (
    <span style={{
      color: palette.color,
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      padding: '3px 8px',
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export function OverviewTab({
  settings,
  liveConfigs,
  scheduledConfigs,
  onGoTariffs,
  onGoSimulation,
}: {
  settings: PlatformSettings
  liveConfigs: Record<string, FareConfig>
  scheduledConfigs: Record<string, FareConfig>
  onGoTariffs: () => void
  onGoSimulation: () => void
}) {
  const liveCount = Object.keys(liveConfigs).length
  const pendingCount = Object.keys(scheduledConfigs).length
  const activeConfigs = Object.values(liveConfigs)
  const avgBase = activeConfigs.length
    ? activeConfigs.reduce((sum, config) => sum + Number(config.base_fare || 0), 0) / activeConfigs.length
    : 0
  const avgPerKm = activeConfigs.length
    ? activeConfigs.reduce((sum, config) => sum + Number(config.per_km_rate || 0), 0) / activeConfigs.length
    : 0
  const surgeEnabled = activeConfigs.filter((config) => config.surge_enabled).length
  const deploymentRows = VEHICLE_TYPES.map((vehicle) => ({
    ...vehicle,
    live: liveConfigs[vehicle.id],
    scheduled: scheduledConfigs[vehicle.id],
  }))
  const configuredRows = deploymentRows.filter((row) => row.live)
  const fareInputs = [
    {
      label: 'Base fare',
      values: configuredRows.map((row) => Number(row.live?.base_fare || 0)),
    },
    {
      label: 'Per km',
      values: configuredRows.map((row) => Number(row.live?.per_km_rate || 0)),
    },
    {
      label: 'Minimum',
      values: configuredRows.map((row) => Number(row.live?.minimum_fare || 0)),
    },
    {
      label: 'Booking',
      values: configuredRows.map((row) => Number(row.live?.booking_fee || 0)),
    },
  ].map((item) => {
    const values = item.values.filter((value) => value > 0)
    return {
      label: item.label,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      avg: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    }
  })

  return (
    <div style={s.shell}>
      <style>{`
        .engine-overview-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 2px;
          align-items: stretch;
          min-height: 0;
        }
        @media (max-width: 980px) {
          .engine-overview-main { grid-template-columns: 1fr; }
        }
        .engine-overview-lower {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
          gap: 2px;
        }
        @media (max-width: 980px) {
          .engine-overview-lower { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={s.kpiGrid}>
        <MetricCard
          label="Live tariffs"
          value={`${liveCount}/${VEHICLE_TYPES.length}`}
          sub="Vehicle classes with active pricing"
          icon={CheckCircle2}
          tone={liveCount ? 'ok' : 'warn'}
        />
        <MetricCard
          label="Commission"
          value={`${(settings.commission_rate * 100).toFixed(1)}%`}
          sub="Platform share applied at estimate time"
          icon={Zap}
        />
        <MetricCard
          label="Avg base fare"
          value={money(avgBase)}
          sub={`Avg distance rate ${money(avgPerKm)} / km`}
          icon={TrendingUp}
        />
        <MetricCard
          label="Pending deploys"
          value={String(pendingCount)}
          sub={pendingCount ? 'Scheduled tariff changes waiting' : 'No scheduled tariff changes'}
          icon={pendingCount ? AlertTriangle : Clock3}
          tone={pendingCount ? 'warn' : 'neutral'}
        />

        {/* Engine Actions Card (moved from side stack) */}
        <div style={{ ...campusPanel.card, borderTop: `2px solid ${T.accent}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'center' }}>
            <div style={{ ...labelStyle, marginBottom: 2 }}>Engine Actions</div>
            <button type="button" onClick={onGoTariffs} style={{ ...campusPanel.btnPrimary, justifyContent: 'center', padding: '6px 12px', minHeight: 28, fontSize: 11 }}>
              <Calculator size={13} />
              Edit tariffs
            </button>
            <button type="button" onClick={onGoSimulation} style={{ ...campusPanel.btnSecondary, justifyContent: 'center', padding: '6px 12px', minHeight: 28, fontSize: 11 }}>
              <Terminal size={13} />
              Run simulation
            </button>
          </div>
        </div>
      </div>

      <div className="engine-overview-main">
        <section style={{ ...campusPanel.card, minHeight: 0 }}>
          <div style={sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RadioTower size={14} color={T.accent} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Tariff Coverage</span>
            </div>
            <span style={{ ...labelStyle, color: pendingCount ? T.warn : T.textMuted }}>
              {pendingCount ? `${pendingCount} pending` : 'stable'}
            </span>
          </div>

          <div style={s.vehicleGrid}>
            {deploymentRows.map(({ id, label, live, scheduled }) => {
              const tone = live ? 'live' : scheduled ? 'pending' : 'empty'
              return (
                <div key={id} style={s.vehicleCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{label}</div>
                      <div style={{ ...mutedText, marginTop: 4 }}>
                        {live ? `${money(Number(live.base_fare))} base` : 'No live tariff'}
                      </div>
                    </div>
                    <StatusPill tone={tone}>{live ? 'live' : scheduled ? 'pending' : 'empty'}</StatusPill>
                  </div>

                  <div style={s.vehicleStats}>
                    <div>
                      <div style={labelStyle}>Per km</div>
                      <div style={s.statValue}>{live ? money(Number(live.per_km_rate)) : '-'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Minimum</div>
                      <div style={s.statValue}>{live ? money(Number(live.minimum_fare)) : '-'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Surge</div>
                      <div style={s.statValue}>{live?.surge_enabled ? `${Number(live.max_surge_multiplier)}x` : 'Off'}</div>
                    </div>
                  </div>

                  {scheduled && (
                    <div style={{ ...mutedText, color: T.warn }}>
                      Deploys {new Date(scheduled.effective_from).toLocaleString()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <aside style={s.sideStack}>
          <section style={{ ...campusPanel.card, flex: 1 }}>
            <div style={sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gauge size={14} color={T.accent} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Global Rules</span>
              </div>
            </div>
            <div style={s.ruleList}>
              {[
                ['Distance provider', settings.distance_provider.toUpperCase()],
                ['Max trip distance', `${settings.max_distance_km} km`],
                ['No-show fee', settings.no_show_fee_enabled ? money(settings.no_show_fee_amount) : 'Off'],
                ['No-show wait', `${settings.no_show_wait_minutes} min`],
                ['Surge-enabled classes', `${surgeEnabled}/${liveCount}`],
              ].map(([label, value]) => (
                <div key={label} style={s.ruleRow}>
                  <span style={labelStyle}>{label}</span>
                  <span style={{ fontSize: 12, color: T.textPrimary, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="engine-overview-lower">
        <section style={campusPanel.card}>
          <div style={sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calculator size={14} color={T.textMuted} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Fare Component Range</span>
            </div>
            <span style={labelStyle}>{configuredRows.length} configured</span>
          </div>
          <div style={s.rangeGrid}>
            {fareInputs.map((item) => (
              <div key={item.label} style={s.rangeCard}>
                <div style={labelStyle}>{item.label}</div>
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div>
                    <div style={s.smallLabel}>Min</div>
                    <div style={s.statValue}>{money(item.min)}</div>
                  </div>
                  <div>
                    <div style={s.smallLabel}>Avg</div>
                    <div style={s.statValue}>{money(item.avg)}</div>
                  </div>
                  <div>
                    <div style={s.smallLabel}>Max</div>
                    <div style={s.statValue}>{money(item.max)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={campusPanel.card}>
          <div style={sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={14} color={T.textMuted} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Operational Checks</span>
            </div>
          </div>
          <div style={s.checkList}>
            {[
              ['Tariff coverage', liveCount === VEHICLE_TYPES.length ? 'Complete' : `${VEHICLE_TYPES.length - liveCount} missing`, liveCount === VEHICLE_TYPES.length],
              ['No-show rule', settings.no_show_fee_enabled ? `${money(settings.no_show_fee_amount)} after ${settings.no_show_wait_minutes} min` : 'Disabled', settings.no_show_fee_enabled],
              ['Distance cap', `${settings.max_distance_km} km`, settings.max_distance_km > 0],
              ['Scheduled changes', pendingCount ? `${pendingCount} waiting` : 'None', pendingCount === 0],
            ].map(([label, value, ok]) => (
              <div key={label as string} style={s.checkRow}>
                <span style={labelStyle}>{label}</span>
                <span style={{ fontSize: 11, color: ok ? T.textPrimary : T.warn, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ ...campusPanel.card, flex: 1, minHeight: 170 }}>
        <div style={sectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock3 size={14} color={T.textMuted} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Deployment Queue</span>
          </div>
          <span style={labelStyle}>{pendingCount ? `${pendingCount} scheduled` : 'clear'}</span>
        </div>
        <div style={s.queueGrid}>
          {deploymentRows.map(({ id, label, live, scheduled }) => (
            <div key={id} style={s.queueRow}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{label}</div>
                <div style={{ ...mutedText, marginTop: 3 }}>
                  {live ? `Live from ${new Date(live.effective_from).toLocaleDateString()}` : 'Awaiting first deployment'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: scheduled ? T.warn : T.textPrimary }}>
                  {scheduled ? 'Scheduled' : live ? 'Live' : 'Empty'}
                </div>
                <div style={{ ...mutedText, marginTop: 3 }}>
                  {scheduled ? new Date(scheduled.effective_from).toLocaleString() : live ? money(Number(live.base_fare)) : '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minHeight: '100%',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 2,
  },
  vehicleGrid: {
    padding: 2,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 2,
  },
  vehicleCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    minHeight: 148,
  },
  vehicleStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  statValue: {
    marginTop: 4,
    fontSize: 11,
    color: T.textPrimary,
    fontWeight: 700,
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
  },
  smallLabel: {
    fontSize: 9,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  sideStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  ruleList: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  ruleRow: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rangeGrid: {
    padding: 2,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 2,
  },
  rangeCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    padding: 14,
    minHeight: 92,
  },
  checkList: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  checkRow: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    padding: '10px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  queueGrid: {
    padding: 2,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 2,
  },
  queueRow: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 70,
  },
}

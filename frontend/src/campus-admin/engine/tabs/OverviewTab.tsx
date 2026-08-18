import { Calculator, CheckCircle, AlertTriangle, Terminal, TrendingUp, Zap } from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { VEHICLE_TYPES } from '../constants'
import type { FareConfig, PlatformSettings } from '../types'

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
  const avgBase = liveCount
    ? Object.values(liveConfigs).reduce((a, c) => a + Number(c.base_fare), 0) / liveCount
    : 0

  const kpiData = [
    { label: 'Live vehicle tariffs', value: `${liveCount} / ${VEHICLE_TYPES.length}`, icon: CheckCircle, color: '#10b981', subtext: 'Active configurations' },
    { label: 'Platform commission', value: `${(settings.commission_rate * 100).toFixed(1)}%`, icon: Zap, color: T.accent, subtext: 'Driver earnings share' },
    { label: 'Avg. base fare', value: `₦${avgBase.toFixed(0)}`, icon: TrendingUp, color: '#3b82f6', subtext: 'All vehicle types' },
    { label: 'Scheduled deploys', value: String(pendingCount), icon: pendingCount ? AlertTriangle : CheckCircle, color: pendingCount ? T.warn : '#10b981', subtext: pendingCount ? 'Pending updates' : 'No pending changes' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px' }}>
      {/* ── Header Section ─────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: T.textWhite, margin: '0 0 8px 0', letterSpacing: -0.5 }}>Pricing Engine</h2>
        <p style={{ fontSize: 13, color: T.textSecondary, margin: 0 }}>Monitor and manage your platform's dynamic pricing configuration</p>
      </div>

      {/* ── Premium KPI Grid ─────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {kpiData.map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              cursor: 'default',
              backgroundColor: kpi.color === '#10b981' ? 'rgba(16, 185, 129, 0.04)' : kpi.color === T.accent ? 'rgba(168, 85, 247, 0.04)' : kpi.color === '#3b82f6' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(245, 158, 11, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  {kpi.label}
                </span>
                <span style={{ fontSize: 28, fontWeight: 800, color: kpi.color, lineHeight: 1, fontFamily: 'monospace', marginBottom: 8 }}>
                  {kpi.value}
                </span>
                <span style={{ fontSize: 11, color: T.textMuted }}>
                  {kpi.subtext}
                </span>
              </div>
              <kpi.icon size={24} color={kpi.color} style={{ opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Engine Status Card ─────────────────────────────── */}
      <div style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.textWhite, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color={T.accent} />
            Engine Status
          </h3>
          <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
            Your pricing engine determines fares for all ride requests. Live tariffs are activated based on their effective date.
          </p>
        </div>

        {/* Vehicle tariffs grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {VEHICLE_TYPES.map((vt) => {
            const live = liveConfigs[vt.id]
            const pending = scheduledConfigs[vt.id]
            const hasConfig = live || pending
            
            return (
              <div
                key={vt.id}
                style={{
                  padding: '16px 14px',
                  border: `1.5px solid ${hasConfig ? T.accent : T.border}`,
                  borderRadius: 6,
                  background: hasConfig ? `rgba(168, 85, 247, 0.04)` : T.bgInput,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{vt.label}</div>
                  <div style={{ fontSize: 11, color: live ? '#10b981' : T.textMuted, marginTop: 4, fontWeight: 600 }}>
                    {live ? `Live · ₦${Number(live.base_fare)}` : 'Not configured'}
                  </div>
                </div>
                {pending && (
                  <div style={{ fontSize: 10, color: T.warn, fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: 4 }}>
                    ⏱ Pending update
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onGoTariffs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              background: T.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: T.fontFamily,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { (e.target as any).style.opacity = '0.9' }}
            onMouseLeave={(e) => { (e.target as any).style.opacity = '1' }}
          >
            <Calculator size={16} />
            Edit Tariffs
          </button>
          <button
            type="button"
            onClick={onGoSimulation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 6,
              border: `1.5px solid ${T.border}`,
              background: 'transparent',
              color: T.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: T.fontFamily,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { (e.target as any).style.borderColor = T.accent; (e.target as any).style.color = T.accent }}
            onMouseLeave={(e) => { (e.target as any).style.borderColor = T.border; (e.target as any).style.color = T.textSecondary }}
          >
            <Terminal size={16} />
            Run Simulation
          </button>
        </div>
      </div>
    </div>
  )
}

const Activity = () => <AlertTriangle />

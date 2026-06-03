import { Calculator, CheckCircle, AlertTriangle, Terminal } from 'lucide-react'
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 2,
      }}
      >
        {[
          { label: 'Live vehicle tariffs', value: `${liveCount} / ${VEHICLE_TYPES.length}`, icon: CheckCircle, color: '#10b981' },
          { label: 'Platform commission', value: `${(settings.commission_rate * 100).toFixed(1)}%`, icon: Calculator, color: T.accent },
          { label: 'Avg. base fare', value: `₦${avgBase.toFixed(0)}`, icon: Calculator, color: T.purple },
          { label: 'Scheduled deploys', value: String(pendingCount), icon: pendingCount ? AlertTriangle : CheckCircle, color: pendingCount ? T.warn : '#10b981' },
        ].map((k) => (
          <div key={k.label} style={{ ...campusPanel.card, padding: '16px 20px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
              {k.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</span>
              <k.icon size={16} color={k.color} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...campusPanel.card, padding: '20px 24px' }}>
        <h3 style={{ ...campusPanel.cardTitle, marginBottom: 8 }}>Pricing engine status</h3>
        <p style={campusPanel.cardSub}>
          Live rides use the tariff marked active with <code style={{ color: T.accent }}>effective_from ≤ now</code>.
          Simulation always calls the same backend calculator as ride booking.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 16 }}>
          {VEHICLE_TYPES.map((vt) => {
            const live = liveConfigs[vt.id]
            const pending = scheduledConfigs[vt.id]
            return (
              <div
                key={vt.id}
                style={{
                  padding: '10px 12px',
                  border: `1px solid ${T.border}`,
                  background: T.bgInput,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary }}>{vt.label}</div>
                <div style={{ fontSize: 10, color: live ? '#10b981' : T.warn, marginTop: 4 }}>
                  {live ? `Live · ₦${Number(live.base_fare)} base` : 'Legacy defaults'}
                </div>
                {pending && (
                  <div style={{ fontSize: 9, color: T.warn, marginTop: 2 }}>Scheduled change pending</div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <button type="button" style={campusPanel.btnPrimary} onClick={onGoTariffs}>
            <Calculator size={14} />
            Edit tariffs
          </button>
          <button type="button" style={campusPanel.btnSecondary} onClick={onGoSimulation}>
            <Terminal size={14} />
            Open simulation
          </button>
        </div>
      </div>
    </div>
  )
}

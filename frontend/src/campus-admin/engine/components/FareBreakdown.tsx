import { T } from '../../theme'
import type { SimulationResult } from '../types'

export function FareHero({
  label,
  result,
  accent,
  sublabel,
}: {
  label: string
  result: SimulationResult | null
  accent: string
  sublabel?: string
}) {
  return (
    <div style={{
      flex: 1,
      minWidth: 140,
      padding: '14px 16px',
      background: T.bgInput,
      border: `1px solid ${T.border}`,
      borderTop: `2px solid ${accent}`,
    }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2 }}>{sublabel}</div>
      )}
      {result ? (
        <>
          <div style={{ fontSize: 26, fontWeight: 800, color: accent, fontFamily: 'monospace', marginTop: 8, lineHeight: 1 }}>
            ₦{result.total_fare.toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10, color: T.textMuted }}>
            <span>Platform ₦{result.platform_commission.toLocaleString()}</span>
            <span>Driver ₦{result.driver_earnings.toLocaleString()}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 12, fontStyle: 'italic' }}>—</div>
      )}
    </div>
  )
}

export function FareWaterfall({ result }: { result: SimulationResult }) {
  const parts = [
    { label: 'Base', value: result.base_fare, color: '#64748b' },
    { label: 'Distance', value: result.distance_charge, color: '#3b82f6' },
    { label: 'Booking', value: result.booking_fee, color: '#8b5cf6' },
    ...(result.surged_amount > 0 ? [{ label: 'Surge', value: result.surged_amount, color: '#ef4444' }] : []),
    ...((result.minimum_adjustment ?? 0) > 0
      ? [{ label: 'Min adj.', value: result.minimum_adjustment ?? 0, color: '#f59e0b' }]
      : []),
  ]
  const max = result.total_fare || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {parts.map((p) => (
        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: T.textMuted, width: 52, flexShrink: 0 }}>{p.label}</span>
          <div style={{ flex: 1, height: 8, background: T.border, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (p.value / max) * 100)}%`, height: '100%', background: p.color }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.textPrimary, width: 64, textAlign: 'right' }}>
            ₦{p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export function CompactTrace({ result }: { result: SimulationResult }) {
  const rows = [
    ['Distance', `${result.distance_km} km × ₦${result.per_km_rate}`],
    ['Subtotal', `₦${result.subtotal.toLocaleString()}`],
    ['Surge', result.surge_multiplier > 1 ? `×${result.surge_multiplier}` : '—'],
    ['Commission', `${(result.commission_rate * 100).toFixed(1)}%`],
  ]
  return (
    <div style={{
      fontSize: 10,
      fontFamily: 'monospace',
      color: T.textSecondary,
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '4px 12px',
    }}
    >
      {rows.map(([k, v]) => (
        <span key={k} style={{ display: 'contents' }}>
          <span style={{ color: T.textMuted }}>{k}</span>
          <span style={{ color: T.textPrimary, textAlign: 'right' }}>{v}</span>
        </span>
      ))}
    </div>
  )
}

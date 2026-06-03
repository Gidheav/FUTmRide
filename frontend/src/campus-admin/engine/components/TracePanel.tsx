import type { CSSProperties } from 'react'
import { T } from '../../theme'
import type { SimulationResult } from '../types'

const traceLine: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  color: T.textPrimary,
  padding: '3px 0',
  fontSize: 13,
  fontFamily: 'monospace',
}

export function TracePanel({ result, emptyLabel }: { result: SimulationResult | null; emptyLabel?: string }) {
  if (!result) {
    return (
      <div style={{
        background: T.bgInput,
        border: `1px solid ${T.border}`,
        padding: 16,
        fontFamily: 'monospace',
        fontSize: 12,
        color: T.textMuted,
        textAlign: 'center',
        fontStyle: 'italic',
      }}
      >
        {emptyLabel ?? 'Run a calculation to see the breakdown.'}
      </div>
    )
  }

  const surgeApplied = result.surge_multiplier > 1
  const minAdj = (result.minimum_adjustment ?? 0) > 0

  return (
    <div style={{
      background: T.bgInput,
      border: `1px solid ${T.border}`,
      padding: 16,
      fontFamily: 'monospace',
      fontSize: 13,
      display: 'flex',
      flexDirection: 'column',
    }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        color: T.textMuted,
        fontSize: 10,
        fontWeight: 700,
        borderBottom: `1px solid ${T.border}`,
        paddingBottom: 10,
        marginBottom: 10,
        textTransform: 'uppercase',
      }}
      >
        <span>Calculation trace</span>
        <span>{result.config_source.replace(/_/g, ' ').toUpperCase()}</span>
      </div>

      <div style={traceLine}><span>Base fare</span><span>₦ {result.base_fare.toLocaleString()}</span></div>
      <div style={traceLine}>
        <span>Distance ({result.distance_km} km @ ₦{result.per_km_rate}/km)</span>
        <span>₦ {result.distance_charge.toLocaleString()}</span>
      </div>
      {result.distance_clamped && (
        <div style={{ ...traceLine, color: T.warn, fontSize: 11 }}>
          <span>Input {result.input_distance_km ?? result.distance_km} km clamped to max</span>
          <span>—</span>
        </div>
      )}
      <div style={traceLine}><span>Booking fee</span><span>₦ {result.booking_fee.toLocaleString()}</span></div>
      <div style={{
        ...traceLine,
        color: T.purple,
        borderTop: `1px dashed ${T.border}`,
        marginTop: 8,
        paddingTop: 8,
      }}
      >
        <span>Subtotal</span><span>₦ {result.subtotal.toLocaleString()}</span>
      </div>
      {surgeApplied && (
        <div style={{ ...traceLine, color: T.error }}>
          <span>Surge (×{result.surge_multiplier})</span>
          <span>+ ₦ {result.surged_amount.toLocaleString()}</span>
        </div>
      )}
      {result.requested_surge_multiplier && result.requested_surge_multiplier > result.surge_multiplier && (
        <div style={{ ...traceLine, color: T.warn, fontSize: 11 }}>
          <span>Requested ×{result.requested_surge_multiplier} capped</span>
          <span>—</span>
        </div>
      )}
      {minAdj && (
        <div style={{ ...traceLine, color: T.warn }}>
          <span>Minimum fare adjustment</span>
          <span>+ ₦ {(result.minimum_adjustment ?? 0).toLocaleString()}</span>
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: `1px solid ${T.border}`,
        marginTop: 12,
        paddingTop: 12,
      }}
      >
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Total fare</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>₦ {result.total_fare.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: T.textMuted }}>
        <span>Platform: ₦ {result.platform_commission.toLocaleString()} ({(result.commission_rate * 100).toFixed(1)}%)</span>
        <span>Driver: ₦ {result.driver_earnings.toLocaleString()}</span>
      </div>
    </div>
  )
}

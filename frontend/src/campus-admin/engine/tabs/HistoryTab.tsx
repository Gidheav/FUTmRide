import { RefreshCw } from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { VEHICLE_TYPES } from '../constants'
import type { FareConfig } from '../types'

const vtLabel = Object.fromEntries(VEHICLE_TYPES.map((v) => [v.id, v.label]))

export function HistoryTab({
  configs,
  onRefresh,
}: {
  configs: FareConfig[]
  onRefresh: () => void
}) {
  return (
    <div style={campusPanel.card}>
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: T.bgCard,
      }}
      >
        <h2 style={{ ...campusPanel.cardTitle, margin: 0 }}>Configuration history</h2>
        <button type="button" style={campusPanel.btnSecondary} onClick={onRefresh}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.textMuted, textAlign: 'left' }}>
              <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Vehicle</th>
              <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Base / km / min</th>
              <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Effective from</th>
              <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: T.textMuted }}>No configurations yet</td>
              </tr>
            ) : configs.map((c, i) => (
              <tr
                key={c.id ?? i}
                style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 ? T.bgInput : 'transparent' }}
              >
                <td style={{ padding: '10px 16px', color: T.textPrimary, fontWeight: 600 }}>
                  {vtLabel[c.vehicle_type] ?? c.vehicle_type}
                </td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: T.textSecondary }}>
                  ₦{Number(c.base_fare)} / ₦{Number(c.per_km_rate)} / ₦{Number(c.minimum_fare)}
                </td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: T.textSecondary }}>
                  {new Date(c.effective_from).toLocaleString()}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: c.is_active ? '#10b981' : T.textMuted,
                  }}
                  >
                    {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

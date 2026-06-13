import React from 'react'
import { Car, ShieldAlert, CheckCircle2, AlertCircle, Settings2, History } from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'

interface FleetTabProps {
  search: string
}

export const FleetTab: React.FC<FleetTabProps> = ({ search }) => {
  const fleet = [
    { id: 'FLT-101', driver: 'John Doe', vehicle: 'Toyota Hiace (14 Pax)', plate: 'KJA-123XD', status: 'Active', route: 'Main Campus -> North Hall', nextMaintenance: '2026-07-01' },
    { id: 'FLT-102', driver: 'Alice Smith', vehicle: 'Coaster Bus (30 Pax)', plate: 'LND-456YZ', status: 'Maintenance', route: 'None', nextMaintenance: 'Overdue' },
    { id: 'FLT-103', driver: 'Michael Brown', vehicle: 'Toyota Sienna (7 Pax)', plate: 'EKY-789AB', status: 'Active', route: 'South Gate Loop', nextMaintenance: '2026-08-15' },
    { id: 'FLT-104', driver: 'Sarah Connor', vehicle: 'Toyota Hiace (14 Pax)', plate: 'KJA-999ZZ', status: 'Off-Duty', route: 'None', nextMaintenance: '2026-09-10' },
  ].filter(f => f.driver.toLowerCase().includes(search.toLowerCase()) || f.plate.toLowerCase().includes(search.toLowerCase()) || f.route.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: 0, marginTop: 4, flex: 1, overflowX: 'auto' }}>
      <div style={{ border: `1px solid ${T.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.bgInput, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>ID / Plate</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Driver & Vehicle</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Current Route</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Maintenance</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fleet.map((f) => (
              <tr key={f.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '16px', fontWeight: 600, color: T.textPrimary }}>
                  {f.id}
                  <div style={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace', marginTop: 4 }}>{f.plate}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ color: T.textPrimary, fontWeight: 500 }}>{f.driver}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{f.vehicle}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  {f.status === 'Active' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', background: '#16a34a15', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      <CheckCircle2 size={12} /> Active
                    </span>
                  ) : f.status === 'Maintenance' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ef4444', background: '#ef444415', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      <ShieldAlert size={12} /> Maintenance
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.textMuted, background: T.bgInput, padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      <Car size={12} /> Off-Duty
                    </span>
                  )}
                </td>
                <td style={{ padding: '16px', color: f.route === 'None' ? T.textMuted : T.textPrimary }}>
                  {f.route}
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ color: f.nextMaintenance === 'Overdue' ? '#ef4444' : T.textSecondary, fontWeight: f.nextMaintenance === 'Overdue' ? 600 : 400 }}>
                    {f.nextMaintenance}
                  </span>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button style={campusPanel.btnSecondary}>Reassign</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

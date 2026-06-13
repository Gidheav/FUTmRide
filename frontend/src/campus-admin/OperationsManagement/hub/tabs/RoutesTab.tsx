import React from 'react'
import { Plus, Edit2, Trash2, Map, MoreVertical, Route, Navigation, ShieldCheck } from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'

interface RoutesTabProps {
  search: string
}

export const RoutesTab: React.FC<RoutesTabProps> = ({ search }) => {
  // Mock data for massive routes management
  const routes = [
    { id: 'RT-1', name: 'Main Campus -> North Hall', type: 'Fixed', active: true, stops: 4, baseFare: 500, estTime: '15 mins', assignedFleet: 3 },
    { id: 'RT-2', name: 'South Gate Loop', type: 'Dynamic', active: true, stops: 8, baseFare: 300, estTime: '25 mins', assignedFleet: 5 },
    { id: 'RT-3', name: 'Faculty Quarters Direct', type: 'Fixed', active: false, stops: 2, baseFare: 1000, estTime: '10 mins', assignedFleet: 1 },
    { id: 'RT-4', name: 'Library -> Engineering', type: 'On-Demand', active: true, stops: 0, baseFare: 200, estTime: 'Varies', assignedFleet: 12 },
  ].filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: 0, marginTop: 4, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {routes.map(route => (
          <div key={route.id} style={{ ...campusPanel.card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...campusPanel.cardBody, paddingBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: `${T.accent}15`, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Map size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, margin: 0 }}>{route.name}</h3>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{route.id}</span>
                      <span>•</span>
                      <span style={{ color: route.active ? '#16a34a' : T.textMuted, fontWeight: 600 }}>{route.active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
                <button style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer' }}>
                  <MoreVertical size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Type</div>
                  <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, marginTop: 2 }}>{route.type}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Stops</div>
                  <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, marginTop: 2 }}>{route.stops}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Base Fare</div>
                  <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, marginTop: 2 }}>₦{route.baseFare}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Active Fleet</div>
                  <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, marginTop: 2 }}>{route.assignedFleet} vehicles</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 'auto', borderTop: `1px solid ${T.border}`, padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: T.bgInput }}>
              <button style={campusPanel.btnSecondary}><Navigation size={13} /> Test Route</button>
              <button style={campusPanel.btnSecondary}><Edit2 size={13} /> Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

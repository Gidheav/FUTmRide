import React, { useEffect, useState } from 'react'
import { Car, CheckCircle2, Clock3, Loader2, Route, WifiOff } from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'
import { apiService } from '../../../../services/api.service'
import { useOperationsStore } from '../../../operationsStore'

interface FleetTabProps {
  search: string
}

interface FleetRoute {
  id: string
  ride_id: string
  reference: string
  route: string
  status: string
  bus_label: string
  departure_date: string
  window_start: string
  window_end: string
}

interface FleetDriver {
  id: string
  user?: {
    id?: string
    full_name?: string
    first_name?: string
    last_name?: string
  }
  vehicle_type?: string | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  vehicle_seats?: number | null
  plate_number?: string | null
  is_online?: boolean
  fleet_state?: string
  pending_assignment?: FleetRoute | null
  last_route?: FleetRoute | null
  recommendation?: string | null
}

const vehicleTypeLabel: Record<string, string> = {
  motorbike: 'Motorbike',
  tricycle: 'Tricycle',
  sedan: 'Sedan',
  mpv: 'MPV',
  minibus: 'Minibus',
  coach: 'Coach',
}

const formatDriverName = (driver: FleetDriver) => {
  const fullName = driver.user?.full_name?.trim()
  if (fullName) return fullName
  return `${driver.user?.first_name || ''} ${driver.user?.last_name || ''}`.trim() || 'Unnamed driver'
}

const formatVehicle = (driver: FleetDriver) => {
  const makeModel = `${driver.vehicle_make || ''} ${driver.vehicle_model || ''}`.trim()
  const type = driver.vehicle_type ? vehicleTypeLabel[driver.vehicle_type] || driver.vehicle_type : 'Vehicle'
  const seats = driver.vehicle_seats ? `${driver.vehicle_seats} Pax` : 'Capacity N/A'
  return `${makeModel || type} (${seats})`
}

const formatRouteLine = (assignment?: FleetRoute | null) => {
  if (!assignment) return 'No route history'
  return `${assignment.reference} · ${assignment.route}`
}

export const FleetTab: React.FC<FleetTabProps> = ({ search }) => {
  const { fleetCache, setFleetCache, tabInitialized, setTabInitialized, refreshSeq } = useOperationsStore()
  const fleet = fleetCache as FleetDriver[]
  const [loading, setLoading] = useState(!tabInitialized.fleet)

  useEffect(() => {
    const fetchFleet = async () => {
      try {
        setLoading(true)
        const data = await apiService.getCampusFleet()
        setFleetCache(data)
        setTabInitialized('fleet', true)
      } catch (err) {
        console.error('Failed to fetch fleet data', err)
      } finally {
        setLoading(false)
      }
    }
    // Fetch once on first mount; skip if already cached
    if (!tabInitialized.fleet) fetchFleet()
  }, [])

  // Refresh when Refresh button is pressed
  useEffect(() => {
    if (refreshSeq === 0) return
    const fetchFleet = async () => {
      try {
        setLoading(true)
        const data = await apiService.getCampusFleet()
        setFleetCache(data)
      } catch (err) {
        console.error('Failed to refresh fleet', err)
      } finally {
        setLoading(false)
      }
    }
    fetchFleet()
  }, [refreshSeq])

  const filteredFleet = fleet.filter(f => {
    const driverName = formatDriverName(f).toLowerCase()
    const plate = (f.plate_number || '').toLowerCase()
    const vehicle = formatVehicle(f).toLowerCase()
    const routeText = `${f.pending_assignment?.route || ''} ${f.last_route?.route || ''}`.toLowerCase()
    const q = search.toLowerCase()
    return driverName.includes(q) || plate.includes(q) || vehicle.includes(q) || routeText.includes(q)
  })

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        <div style={{ marginTop: 12, fontSize: 13 }}>Loading fleet...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 0, marginTop: 4, flex: 1, overflowX: 'auto' }}>
      <div style={{ border: `1px solid ${T.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.bgInput, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>ID / Plate</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Driver & Vehicle</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Last Route</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Recommended</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFleet.map((f) => {
              const queued = f.pending_assignment
              return (
                <tr key={f.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: T.textPrimary }}>
                    {f.user?.id?.substring(0, 8) || f.id.substring(0, 8)}
                    <div style={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace', marginTop: 4 }}>
                      {f.plate_number || 'No plate'}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ color: T.textPrimary, fontWeight: 500 }}>{formatDriverName(f)}</div>
                    <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{formatVehicle(f)}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {f.is_online ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', background: '#16a34a15', padding: '4px 8px', borderRadius: 0, fontSize: 11, fontWeight: 600 }}>
                        <CheckCircle2 size={12} /> Online
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.textMuted, background: T.bgInput, padding: '4px 8px', borderRadius: 0, fontSize: 11, fontWeight: 600 }}>
                        <WifiOff size={12} /> Offline
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: queued ? '#f59e0b' : T.textMuted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {queued ? <Clock3 size={12} /> : <Car size={12} />}
                      {queued ? queued.status.replace('_', ' ') : 'Idle'}
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: T.textMuted, maxWidth: 320 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: queued ? T.textPrimary : T.textMuted }}>
                      <Route size={13} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatRouteLine(queued || f.last_route)}
                      </span>
                    </div>
                    {queued && (
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                        Scheduled {queued.departure_date} · {String(queued.window_start).slice(0, 5)}-{String(queued.window_end).slice(0, 5)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: T.textSecondary, fontSize: 12 }}>
                    {f.recommendation || 'No recommendation'}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button style={{ ...campusPanel.btnSecondary, opacity: 0.55, cursor: 'not-allowed' }} disabled>
                      {queued ? 'Queued' : 'Assign'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {filteredFleet.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: T.textMuted }}>
                  No available fleet matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

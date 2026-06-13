import React, { useEffect, useState } from 'react'
import { Navigation, Trash2, CheckCircle2, Clock, MapPin, Users, Calendar, AlertCircle } from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'
import { apiService } from '../../../../services/api.service'
import { formatDistanceToNow, isPast, parseISO } from 'date-fns'

interface DispatchedBus {
  id: string
  ride_reference: string
  origin_address: string
  destination_address: string
  scheduled_departure_date: string
  scheduled_window_start: string
  driver_name: string
  bus_label: string
  status: string
  departed_at: string | null
  arrived_at: string | null
  passenger_count: number
  seated_capacity: number
  standing_capacity: number
}

interface DeparturesTabProps {
  search: string
}

export const DeparturesTab: React.FC<DeparturesTabProps> = ({ search }) => {
  const [rides, setRides] = useState<DispatchedBus[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  // Force re-render every minute for live countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const fetchRides = async () => {
    try {
      setLoading(true)
      const data = await apiService.getDispatchedBuses()
      setRides(data)
    } catch (e) {
      console.error('Failed to fetch dispatched buses', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRides()
  }, [])

  const handleAction = async (id: string, action: 'cancel' | 'depart' | 'complete') => {
    if (!window.confirm(`Are you sure you want to mark this ride as ${action}?`)) return
    try {
      if (action === 'cancel') await apiService.cancelScheduledRide(id)
      if (action === 'depart') await apiService.departScheduledRide(id)
      if (action === 'complete') await apiService.completeScheduledRide(id)
      fetchRides()
    } catch (e: any) {
      alert(`Error: ${e.response?.data?.detail || e.message}`)
    }
  }

  const renderStatusBadge = (status: string) => {
    const map: Record<string, { bg: string, color: string }> = {
      departed: { bg: '#16a34a22', color: '#16a34a' },
      en_route: { bg: '#16a34a22', color: '#16a34a' },
      arrived: { bg: '#eab30822', color: '#eab308' },
      completed: { bg: `${T.textMuted}22`, color: T.textMuted },
      not_completed: { bg: '#f9731622', color: '#f97316' },
      cancelled: { bg: '#ef444422', color: '#ef4444' },
    }
    const s = map[status] || { bg: `${T.textMuted}22`, color: T.textMuted }
    const displayStatus = status.replace('_', ' ')
    return (
      <span style={{ background: s.bg, color: s.color, padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {displayStatus}
      </span>
    )
  }

  const getLiveStatusText = (ride: DispatchedBus) => {
    if (ride.status === 'completed') return <span style={{ color: T.textMuted }}>Arrived safely</span>
    if (ride.status === 'arrived') return <span style={{ color: '#eab308' }}>At destination</span>
    return <span style={{ color: '#16a34a', fontWeight: 600 }}>In Transit</span>
  }

  const filteredRides = rides.filter(r => 
    r.ride_reference.toLowerCase().includes(search.toLowerCase()) || 
    (r.driver_name || '').toLowerCase().includes(search.toLowerCase()) ||
    r.origin_address.toLowerCase().includes(search.toLowerCase()) ||
    r.destination_address.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Loading departures...</div>
  }

  return (
    <div style={{ padding: 0, marginTop: 4, flex: 1, overflowX: 'auto' }}>
      <div style={{ border: `1px solid ${T.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.bgInput, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Reference</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Driver</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Route</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Scheduled For</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Departed At</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Pax</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Live Status</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRides.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: T.textMuted }}>
                  <AlertCircle size={32} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <div>No scheduled rides found.</div>
                </td>
              </tr>
            ) : (
              filteredRides.map((ride) => (
                <tr key={ride.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: T.textPrimary, fontFamily: 'monospace' }}>
                    {ride.ride_reference}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ color: T.textPrimary, fontWeight: 500, marginBottom: 4 }}>
                      {ride.driver_name}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      {ride.bus_label}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textPrimary, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.textPrimary }} />
                      <span style={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ride.origin_address}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textSecondary }}>
                      <div style={{ width: 6, height: 6, background: T.accent }} />
                      <span style={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ride.destination_address}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: T.textSecondary }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: T.textPrimary, fontWeight: 500 }}>
                      <Clock size={14} /> {ride.scheduled_window_start?.substring(0, 5) || 'N/A'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <Calendar size={13} /> {ride.scheduled_departure_date}
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: T.textSecondary }}>
                    {ride.departed_at ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 600 }}>
                        <Clock size={14} /> {new Date(ride.departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ) : (
                      <span style={{ color: T.textMuted }}>Not departed</span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textPrimary }}>
                      <Users size={14} /> {ride.passenger_count}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                      CAPACITY: {ride.seated_capacity}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {renderStatusBadge(ride.status)}
                  </td>
                  <td style={{ padding: '16px', fontFamily: 'monospace' }}>
                    {getLiveStatusText(ride)}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {['departed', 'en_route'].includes(ride.status) && (
                        <>
                          <button type="button" style={{ ...campusPanel.btnPrimary, background: T.accent, padding: '4px 8px', opacity: 0.5, cursor: 'not-allowed' }} title="Complete" onClick={() => {}}>
                            <CheckCircle2 size={14} />
                          </button>
                          <button type="button" style={{ ...campusPanel.btnSecondary, background: '#ef444415', color: '#ef4444', borderColor: '#ef444433', padding: '4px 8px', opacity: 0.5, cursor: 'not-allowed' }} title="Cancel/Failed" onClick={() => {}}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

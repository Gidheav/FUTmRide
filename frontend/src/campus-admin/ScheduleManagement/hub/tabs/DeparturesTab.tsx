import React, { useEffect, useState } from 'react'
import { Navigation, Trash2, CheckCircle2, Clock, MapPin, Users, Calendar, AlertCircle } from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'
import { apiService } from '../../../../services/api.service'
import { formatDistanceToNow, isPast, parseISO } from 'date-fns'

interface ScheduledRide {
  id: string
  reference: string
  departure_date: string
  window_start: string
  window_end: string
  join_deadline: string
  origin_address: string
  destination_address: string
  vehicle_size: string
  status: string
  passenger_count: number
  is_joinable: boolean
  enabled_tiers: string[]
  stops_count: number
}

interface DeparturesTabProps {
  search: string
}

export const DeparturesTab: React.FC<DeparturesTabProps> = ({ search }) => {
  const [rides, setRides] = useState<ScheduledRide[]>([])
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
      const data = await apiService.getScheduledRides()
      setRides(data)
    } catch (e) {
      console.error('Failed to fetch scheduled rides', e)
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
      scheduled: { bg: `${T.accent}22`, color: T.accent },
      boarding: { bg: '#fef08a22', color: '#eab308' },
      departed: { bg: '#16a34a22', color: '#16a34a' },
      completed: { bg: `${T.textMuted}22`, color: T.textMuted },
      cancelled: { bg: '#ef444422', color: '#ef4444' },
    }
    const s = map[status] || map.scheduled
    return (
      <span style={{ background: s.bg, color: s.color, padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {status}
      </span>
    )
  }

  const getCountdownText = (ride: ScheduledRide) => {
    if (ride.status === 'departed' || ride.status === 'completed' || ride.status === 'cancelled') return '—'
    
    const deadline = parseISO(ride.join_deadline)
    const windowStart = parseISO(`${ride.departure_date}T${ride.window_start}`)
    
    if (isPast(deadline)) {
      if (isPast(windowStart)) return <span style={{ color: '#ef4444', fontWeight: 600 }}>Past Due</span>
      return <span style={{ color: '#eab308', fontWeight: 600 }}>Boarding Now</span>
    }
    
    return <span style={{ color: T.textSecondary }}>{formatDistanceToNow(deadline)} left</span>
  }

  const filteredRides = rides.filter(r => 
    r.reference.toLowerCase().includes(search.toLowerCase()) || 
    r.origin_address.toLowerCase().includes(search.toLowerCase()) ||
    r.destination_address.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Loading departures...</div>
  }

  return (
    <div style={{ padding: '16px 24px', flex: 1, overflowX: 'auto' }}>
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.bgInput, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Reference</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Route</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Time & Date</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Pax</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', color: T.textMuted, fontWeight: 600 }}>Countdown</th>
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
                    {ride.reference}
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
                      <Clock size={14} /> {ride.window_start.substring(0, 5)} - {ride.window_end.substring(0, 5)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <Calendar size={13} /> {ride.departure_date}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textPrimary }}>
                      <Users size={14} /> {ride.passenger_count}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                      {(ride.vehicle_size || '').toUpperCase() || 'N/A'}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {renderStatusBadge(ride.status)}
                  </td>
                  <td style={{ padding: '16px', fontFamily: 'monospace' }}>
                    {getCountdownText(ride)}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {(ride.status === 'scheduled' || ride.status === 'boarding') && (
                        <>
                          <button style={{ ...campusPanel.btnSecondary, background: '#16a34a15', color: '#16a34a', borderColor: '#16a34a33', padding: '4px 8px' }} title="Mark Departed" onClick={() => handleAction(ride.id, 'depart')}>
                            <Navigation size={14} />
                          </button>
                          <button style={{ ...campusPanel.btnSecondary, background: '#ef444415', color: '#ef4444', borderColor: '#ef444433', padding: '4px 8px' }} title="Cancel Ride" onClick={() => handleAction(ride.id, 'cancel')}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {ride.status === 'departed' && (
                        <button style={{ ...campusPanel.btnPrimary, background: T.accent, padding: '4px 8px' }} title="Complete" onClick={() => handleAction(ride.id, 'complete')}>
                          <CheckCircle2 size={14} />
                        </button>
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

import { useState, useEffect, CSSProperties } from 'react'
import { CalendarClock, MapPin, Users, Package, Settings2, Trash2, CheckCircle2, Navigation } from 'lucide-react'
import { T } from '../theme'
import { apiService } from '../../services/api.service'
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

export default function SchedulePage() {
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
      <span style={{ background: s.bg, color: s.color, padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
        {status}
      </span>
    )
  }

  const getCountdownText = (ride: ScheduledRide) => {
    if (ride.status === 'departed' || ride.status === 'completed' || ride.status === 'cancelled') return null
    
    const deadline = parseISO(ride.join_deadline)
    const windowStart = parseISO(`${ride.departure_date}T${ride.window_start}`)
    
    if (isPast(deadline)) {
      if (isPast(windowStart)) return <span style={{ color: '#ef4444' }}>Departure Past Due</span>
      return <span style={{ color: '#eab308' }}>Boarding Now</span>
    }
    
    return <span>Joins close in {formatDistanceToNow(deadline)}</span>
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Scheduled Rides</h1>
          <p style={s.subtitle}>Manage campus shuttle departures, routes, and boarding statuses.</p>
        </div>
        <button style={s.refreshBtn} onClick={fetchRides}>
          <Settings2 size={16} /> Refresh
        </button>
      </header>

      {loading ? (
        <div style={s.loading}>Loading scheduled rides...</div>
      ) : rides.length === 0 ? (
        <div style={s.empty}>
          <CalendarClock size={48} color={T.textMuted} style={{ marginBottom: 16 }} />
          <h2 style={{ color: T.textPrimary, marginBottom: 8 }}>No Scheduled Rides</h2>
          <p style={{ color: T.textSecondary, fontSize: 14 }}>Go to the Dashboard to create a new scheduled route.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {rides.map(ride => (
            <div key={ride.id} style={s.card}>
              <div style={s.cardHeader}>
                <span style={s.reference}>{ride.reference}</span>
                {renderStatusBadge(ride.status)}
              </div>
              
              <div style={s.route}>
                <div style={s.routePin}><div style={s.dotO} /></div>
                <div style={s.routeText}>{ride.origin_address}</div>
                <div style={s.routePin}><div style={s.dotD} /></div>
                <div style={s.routeText}>{ride.destination_address}</div>
                <div style={s.routeLine} />
              </div>

              <div style={s.metaGrid}>
                <div style={s.metaItem}>
                  <CalendarClock size={14} color={T.textMuted} />
                  <div>
                    <div style={s.metaVal}>{ride.departure_date}</div>
                    <div style={s.metaLbl}>{ride.window_start.substring(0,5)} - {ride.window_end.substring(0,5)}</div>
                  </div>
                </div>
                <div style={s.metaItem}>
                  <Users size={14} color={T.textMuted} />
                  <div>
                    <div style={s.metaVal}>{ride.passenger_count} Pax</div>
                    <div style={s.metaLbl}>Vehicle: {ride.vehicle_size.toUpperCase()}</div>
                  </div>
                </div>
                <div style={s.metaItem}>
                  <MapPin size={14} color={T.textMuted} />
                  <div>
                    <div style={s.metaVal}>{ride.stops_count} Stops</div>
                    <div style={s.metaLbl}>Along route</div>
                  </div>
                </div>
                <div style={s.metaItem}>
                  <Package size={14} color={T.textMuted} />
                  <div>
                    <div style={s.metaVal}>Tiers</div>
                    <div style={s.metaLbl}>{ride.enabled_tiers.join(', ')}</div>
                  </div>
                </div>
              </div>

              <div style={s.footer}>
                <div style={s.countdown}>
                  {getCountdownText(ride)}
                </div>
                <div style={s.actions}>
                  {(ride.status === 'scheduled' || ride.status === 'boarding') && (
                    <>
                      <button style={{ ...s.iconBtn, color: '#16a34a', background: '#16a34a11' }} title="Mark Departed" onClick={() => handleAction(ride.id, 'depart')}>
                        <Navigation size={15} />
                      </button>
                      <button style={{ ...s.iconBtn, color: '#ef4444', background: '#ef444411' }} title="Cancel Ride" onClick={() => handleAction(ride.id, 'cancel')}>
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                  {ride.status === 'departed' && (
                    <button style={{ ...s.actionBtn, background: T.accent }} onClick={() => handleAction(ride.id, 'complete')}>
                      <CheckCircle2 size={14} style={{ marginRight: 6 }} /> Complete Route
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  page: { padding: 32, maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 700, color: T.textPrimary, margin: '0 0 8px 0' },
  subtitle: { fontSize: 14, color: T.textSecondary, margin: 0 },
  refreshBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, color: T.textPrimary, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  loading: { textAlign: 'center', padding: 64, color: T.textMuted },
  empty: { height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${T.border}`, borderRadius: 16, background: T.bgPanel },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 },
  card: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', position: 'relative' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reference: { fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: T.textPrimary },
  
  route: { position: 'relative', paddingLeft: 20, marginBottom: 20 },
  routeLine: { position: 'absolute', left: 4, top: 8, bottom: 8, width: 2, background: T.border, zIndex: 0 },
  routePin: { position: 'absolute', left: 0, width: 10, height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bgCard, zIndex: 1 },
  dotO: { width: 8, height: 8, borderRadius: 4, background: T.textPrimary, border: `2px solid ${T.bgCard}` },
  dotD: { width: 8, height: 8, background: T.accent, border: `2px solid ${T.bgCard}` },
  routeText: { fontSize: 14, color: T.textPrimary, fontWeight: 500, padding: '4px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },

  metaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '16px 0', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, marginBottom: 16 },
  metaItem: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  metaVal: { fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 2 },
  metaLbl: { fontSize: 11, color: T.textMuted, textTransform: 'capitalize' },

  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  countdown: { fontSize: 12, fontWeight: 600, color: T.textSecondary },
  actions: { display: 'flex', gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  actionBtn: { display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}


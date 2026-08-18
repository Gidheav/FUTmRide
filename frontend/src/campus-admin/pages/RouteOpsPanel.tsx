import { useState, useEffect, useCallback, useRef, type CSSProperties, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bus, Users, CalendarClock, Clock, MapPin, Navigation, ChevronDown, ChevronUp,
  Plus, Play, Square, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw,
  UserCheck, UserX, ArrowRightLeft, Zap, X, Search, Filter, Eye, Truck,
  CircleDot, Timer, TrendingUp, BarChart3, Activity, Package
} from 'lucide-react'
import { T } from '../theme'
import { apiService } from '../../services/api.service'
import api from '../../core/api'
import { routeEndpointLabel } from '../shared/routeDisplay'

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

interface ScheduledRide {
  id: string; reference: string; departure_date: string
  window_start: string; window_end: string; join_deadline: string
  origin_address: string; destination_address: string
  origin_name?: string | null; destination_name?: string | null
  vehicle_size: string; status: string; passenger_count: number
  is_joinable: boolean; enabled_tiers: string[]; stops_count: number
  allowed_vehicle_types: string[]
  fare_summary?: {
    vehicle_type: string
    distance_km: number
    fare: number
    platform_commission?: number
    driver_earnings?: number
  } | null
}

interface BusAssignment {
  id: string; ride: string; driver: string | null; driver_name: string | null
  vehicle_type: string | null; plate_number: string | null
  bus_label: string; order: number; seated_capacity: number; standing_capacity: number
  status: string; departed_at: string | null; arrived_at: string | null
  admin_notes: string; seated_count: number; standing_count: number
  checked_in_count: number; total_assigned: number; seats_available: number
  standing_available: number; created_at: string; updated_at: string
}

interface Passenger {
  id: string; student: string; student_name: string; student_email: string
  pricing_tier: string; bus_assignment: string | null; bus_label: string | null
  seat_type: string; checked_in_at: string | null
  boarding_stop: string | null; boarding_stop_name: string | null
  alighting_stop: string | null; alighting_stop_name: string | null
  amount_paid: string; payment_reference: string
  status: string; joined_at: string
}

interface FleetDriver {
  id: string; user?: { id: string; full_name: string }
  plate_number?: string; vehicle_type?: string; vehicle_make?: string
  vehicle_model?: string; vehicle_color?: string; vehicle_seats?: number
  name?: string; phone?: string; is_online?: boolean
  created_at?: string; email?: string; interest_id?: string
}

interface ActivityLogEntry {
  id: string; time: Date; message: string; type: 'info' | 'success' | 'warning' | 'error'
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  scheduled: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  boarding: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  loading: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  departed: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  en_route: { bg: 'rgba(20,184,166,0.12)', color: '#14b8a6', border: 'rgba(20,184,166,0.3)' },
  arrived: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', border: 'rgba(99,102,241,0.3)' },
  completed: { bg: 'rgba(100,116,139,0.12)', color: '#64748b', border: 'rgba(100,116,139,0.3)' },
  cancelled: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  assigned: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
}

const BUS_STATUS_FLOW = ['assigned', 'boarding', 'loading', 'departed', 'en_route', 'arrived', 'completed']

const fmtTime = (t: string) => t?.substring(0, 5) || ''
const fmtCurrency = (v: string | number) => `₦${Number(v || 0).toLocaleString()}`

const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Motorbike',
  tricycle: 'Tricycle',
  sedan: 'Sedan',
  mpv: 'MPV',
  minibus: 'Minibus',
  coach: 'Coach',
}

const vehicleLabel = (vehicleType: string) => VEHICLE_LABELS[vehicleType] || vehicleType

const formatVehicleSummary = (vehicleTypes: string[]) => {
  if (!vehicleTypes?.length) return 'Vehicle'
  if (vehicleTypes.length <= 3) return vehicleTypes.map(vehicleLabel).join(' · ')
  return `${vehicleTypes.slice(0, 2).map(vehicleLabel).join(' · ')} +${vehicleTypes.length - 2}`
}

const getCountdownMs = (deadline: string) => {
  const d = new Date(deadline)
  return d.getTime() - Date.now()
}

const fmtCountdown = (ms: number) => {
  if (ms <= 0) return 'Closed'
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

const fmtRelativeTime = (dateString?: string) => {
  if (!dateString) return 'Recently'
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

let _logId = 0
const mkLog = (msg: string, type: ActivityLogEntry['type'] = 'info'): ActivityLogEntry => ({
  id: String(++_logId), time: new Date(), message: msg, type,
})

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export default function RouteOpsPanel() {
  // ── State ──
  const [rides, setRides] = useState<ScheduledRide[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedRideId, setSelectedRideId] = useState<string | null>(searchParams.get('ride'))
  const [buses, setBuses] = useState<BusAssignment[]>([])
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [interestedDrivers, setInterestedDrivers] = useState<FleetDriver[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [now, setNow] = useState(Date.now())
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOption, setSortOption] = useState('time_asc')
  const [paxFilter, setPaxFilter] = useState<'all' | 'unassigned' | 'checked_in' | 'no_show'>('all')
  const [paxSearch, setPaxSearch] = useState('')
  const [showAddBus, setShowAddBus] = useState(false)
  const [expandedBus, setExpandedBus] = useState<string | null>(null)
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set())
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const [visiblePax, setVisiblePax] = useState(50)

  useEffect(() => {
    setVisiblePax(50)
  }, [selectedRideId, paxFilter, paxSearch])

  const selectedRide = rides.find(r => r.id === selectedRideId)

  // ── Live clock ──
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(t)
  }, [])

  // ── Fetch rides ──
  const fetchRides = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true)
      const data = await apiService.getScheduledRides()
      setRides(data)
    } catch { /* silent */ } finally {
      if (!isBackground) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRides() }, [fetchRides])

  // ── Polling every 15s ──
  useEffect(() => {
    const t = setInterval(() => fetchRides(true), 15000)
    return () => clearInterval(t)
  }, [fetchRides])

  // ── Fetch buses + passengers + interested drivers when ride selected ──
  const fetchRideDetails = useCallback(async (rideId: string) => {
    try {
      const [b, p, d] = await Promise.all([
        apiService.getBusAssignments(rideId),
        apiService.getRidePassengers(rideId),
        apiService.getInterestedDrivers(rideId),
      ])
      setBuses(b)
      setPassengers(p)
      setInterestedDrivers(d)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (selectedRideId) fetchRideDetails(selectedRideId)
  }, [selectedRideId, fetchRideDetails])

  // ── Poll ride details every 8s ──
  useEffect(() => {
    if (!selectedRideId) return
    const t = setInterval(() => fetchRideDetails(selectedRideId), 8000)
    return () => clearInterval(t)
  }, [selectedRideId, fetchRideDetails])

  // ── Load persistent activity log from DB when ride selected ──
  useEffect(() => {
    if (!selectedRideId) {
      setActivityLog([])
      return
    }
    apiService.getScheduledRideLogs(selectedRideId).then(data => {
      const mapped: ActivityLogEntry[] = (Array.isArray(data) ? data : []).map((l: any) => ({
        id: l.id,
        time: new Date(l.created_at),
        message: l.message,
        type: l.log_type as ActivityLogEntry['type'],
      }))
      // Backend returns newest first, reverse for chronological order in log
      setActivityLog(mapped.reverse())
    }).catch(() => {})
  }, [selectedRideId])

  // ── Scroll log to bottom ──
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [activityLog])

  const addLog = (msg: string, type: ActivityLogEntry['type'] = 'info') => {
    const entry = mkLog(msg, type)
    setActivityLog(prev => [...prev.slice(-99), entry])
    // Persist to DB fire-and-forget (non-blocking)
    if (selectedRideId) {
      apiService.addScheduledRideLog(selectedRideId, msg, type).catch(() => {})
    }
  }

  // ── Actions ──
  const handleBulkAssign = async (driverIds: string[]) => {
    if (!selectedRideId || driverIds.length === 0) return
    setActionLoading('bulk_assign')
    
    try {
      // Get capacity defaults
      const seatedDefaults: Record<string, number> = {
        coach: 50, minibus: 18, mpv: 7, sedan: 4, tricycle: 3, motorbike: 1,
      }
      const standingDefaults: Record<string, number> = {
        coach: 20, minibus: 10, mpv: 0, sedan: 0, tricycle: 0, motorbike: 0,
      }

      let successCount = 0
      let failCount = 0

      for (const driverId of driverIds) {
        const driver = interestedDrivers.find(d => d.id === driverId)
        if (!driver) {
          failCount++
          continue
        }

        // Skip drivers without vehicle profiles
        if (!driver.vehicle_type || !driver.vehicle_seats) {
          addLog(`Skipped ${driver.name}: Missing vehicle profile`, 'warning')
          failCount++
          continue
        }

        const vt = driver.vehicle_type.toLowerCase()
        const seated = driver.vehicle_seats ?? seatedDefaults[vt] ?? 4
        const standing = standingDefaults[vt] ?? 0
        
        // Auto-generate bus label
        const driverName = driver.name || driver.user?.full_name || 'Driver'
        const busLabel = `${driverName.split(' ')[0]}'s ${vehicleLabel(driver.vehicle_type)}`

        try {
          await apiService.createBusAssignment(selectedRideId, {
            driver: driverId,
            bus_label: busLabel,
            seated_capacity: seated,
            standing_capacity: standing,
          })
          successCount++
          addLog(`Vehicle "${busLabel}" assigned to ${driverName}`, 'success')
        } catch (e: any) {
          failCount++
          addLog(`Failed to assign ${driverName}: ${e?.message || 'Error'}`, 'error')
        }
      }

      // Refresh data
      await fetchRideDetails(selectedRideId)
      apiService.getInterestedDrivers(selectedRideId).then(setInterestedDrivers).catch(() => {})
      
      // Close panel and clear selection
      setShowAddBus(false)
      setSelectedDriverIds(new Set())
      
      // Summary log
      if (successCount > 0) {
        addLog(`Bulk assignment complete: ${successCount} vehicle(s) added${failCount > 0 ? `, ${failCount} failed` : ''}`, successCount === driverIds.length ? 'success' : 'warning')
      }
    } catch (e: any) {
      addLog(`Bulk assignment failed: ${e?.message || 'Error'}`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleDriverSelection = (driverId: string) => {
    setSelectedDriverIds(prev => {
      const next = new Set(prev)
      if (next.has(driverId)) {
        next.delete(driverId)
      } else {
        next.add(driverId)
      }
      return next
    })
  }

  const handleAutoAllocate = async () => {
    if (!selectedRideId) return
    setActionLoading('auto')
    try {
      const res = await apiService.autoAllocatePassengers(selectedRideId)
      addLog(`Auto-allocated ${res.allocated} passengers (${res.unallocated} remaining)`, 'success')
      await fetchRideDetails(selectedRideId)
      fetchRides(true)
    } catch (e: any) {
      addLog(`Auto-allocate failed: ${e?.message || 'Error'}`, 'error')
    } finally { setActionLoading(null) }
  }

  const handleAutoCheckIn = async () => {
    if (!selectedRideId || !expandedBus) return
    setActionLoading('autoCheckIn')
    try {
      const res = await apiService.autoCheckInBus(selectedRideId, expandedBus)
      const busObj = buses.find(b => b.id === expandedBus)
      addLog(`Auto-checked in ${res.checked_in_count} pax to ${busObj?.bus_label || 'bus'}`, 'success')
      await fetchRideDetails(selectedRideId)
      fetchRides(true)
    } catch (e: any) {
      addLog(`Auto check-in failed: ${e?.message || 'Error'}`, 'error')
    } finally { setActionLoading(null) }
  }

  const handleBusAction = async (busId: string, action: 'depart' | 'arrive' | 'complete') => {
    if (!selectedRideId) return
    setActionLoading(busId + action)
    try {
      let res;
      if (action === 'depart') res = await apiService.departBus(selectedRideId, busId)
      else if (action === 'arrive') res = await apiService.arriveBus(selectedRideId, busId)
      else res = await apiService.completeBus(selectedRideId, busId)
      const bus = buses.find(b => b.id === busId)
      if (action === 'depart' && res.no_shows > 0) {
        addLog(`Bus ${bus?.bus_label} departed — ${res.no_shows} no-show(s), ${res.promoted} promoted`, 'warning')
      } else {
        addLog(`Bus ${bus?.bus_label} → ${action.toUpperCase()}`, 'success')
      }
      await fetchRideDetails(selectedRideId)
      fetchRides(true)
    } catch (e: any) {
      addLog(`Bus action "${action}" failed: ${e?.message || 'Error'}`, 'error')
    } finally { setActionLoading(null) }
  }

  const handleCheckIn = async (paxId: string) => {
    if (!selectedRideId) return
    setActionLoading(paxId)
    try {
      const res = await apiService.checkInPassenger(selectedRideId, paxId)
      addLog(`${res.student_name} checked in`, 'success')
      await fetchRideDetails(selectedRideId)
    } catch (e: any) {
      addLog(`Check-in failed: ${e?.message || 'Error'}`, 'error')
    } finally { setActionLoading(null) }
  }

  const handleNoShow = async (paxId: string) => {
    if (!selectedRideId) return
    setActionLoading(paxId + 'ns')
    try {
      const res = await apiService.markNoShow(selectedRideId, paxId)
      addLog(`${res.no_show.student_name} marked NO-SHOW${res.promoted ? ` → ${res.promoted.student_name} promoted` : ''}`, 'warning')
      await fetchRideDetails(selectedRideId)
      fetchRides(true)
    } catch (e: any) {
      addLog(`No-show failed: ${e?.message || 'Error'}`, 'error')
    } finally { setActionLoading(null) }
  }

  // ── Derived data ──
  const filteredRides = useMemo(() => {
    let filtered = statusFilter === 'all' ? rides : rides.filter(r => r.status === statusFilter)
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      // window_start is "HH:MM:SS" — compare as strings (lexicographic is correct for time)
      if (sortOption === 'time_asc') return (a.window_start || '').localeCompare(b.window_start || '')
      if (sortOption === 'time_desc') return (b.window_start || '').localeCompare(a.window_start || '')
      if (sortOption === 'alpha_asc') return a.reference.localeCompare(b.reference)
      if (sortOption === 'alpha_desc') return b.reference.localeCompare(a.reference)
      if (sortOption === 'pax_desc') return b.passenger_count - a.passenger_count
      return 0
    })

    return filtered
  }, [rides, statusFilter, sortOption])
  const totalPax = rides.reduce((a, r) => a + r.passenger_count, 0)
  const totalBuses = buses.length
  const busesEnRoute = buses.filter(b => ['departed', 'en_route'].includes(b.status)).length
  const busesCompleted = buses.filter(b => b.status === 'completed').length
  const unassignedPax = passengers.filter(p => !p.bus_assignment && !['cancelled', 'no_show'].includes(p.status)).length

  const filteredPassengers = passengers.filter(p => {
    if (paxFilter === 'unassigned') return !p.bus_assignment && !['cancelled', 'no_show'].includes(p.status)
    if (paxFilter === 'checked_in') return !!p.checked_in_at
    if (paxFilter === 'no_show') return p.status === 'no_show'
    return true
  }).filter(p => !paxSearch || p.student_name.toLowerCase().includes(paxSearch.toLowerCase()))

  const displayedPassengers = filteredPassengers.slice(0, visiblePax)

  const handleScrollTable = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      setVisiblePax(prev => Math.min(prev + 50, filteredPassengers.length))
    }
  }

  const nowDate = new Date(now)
  const timeStr = nowDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateStr = nowDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  // ── Revenue calc ──
  const totalRevenue = passengers.filter(p => !['cancelled', 'no_show'].includes(p.status)).reduce((s, p) => s + Number(p.amount_paid || 0), 0)
  const noShowCount = passengers.filter(p => p.status === 'no_show').length

  /* ══════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                */
  /* ══════════════════════════════════════════════════════════════════════ */

  return (
    <div style={s.root}>
      <style>{`\
        .hide-scrollbar {\
          -ms-overflow-style: none;\
          scrollbar-width: none;\
        }\
\
        .hide-scrollbar::-webkit-scrollbar {\
          display: none;\
        }\
      `}</style>
      {/* ── SECTION 1: Command Header ────────────────────────────────── */}
      <div style={s.cmdHeader}>
        <div style={s.cmdLeft}>
          <div style={s.cmdClock}>
            <Clock size={14} />
            <span style={s.cmdTime}>{timeStr}</span>
            <span style={s.cmdDate}>{dateStr}</span>
          </div>
        </div>
        <div style={s.cmdCenter}>
          <div style={s.cmdStat}><span style={s.cmdStatVal}>{rides.length}</span><span style={s.cmdStatLbl}>Routes</span></div>
          <div style={s.cmdStat}><span style={s.cmdStatVal}>{totalPax}</span><span style={s.cmdStatLbl}>Passengers</span></div>
          {selectedRideId && (
            <>
              <div style={s.cmdDivider} />
              <div style={s.cmdStat}><span style={{ ...s.cmdStatVal, color: '#a855f7' }}>{totalBuses}</span><span style={s.cmdStatLbl}>Vehicles</span></div>
              <div style={s.cmdStat}><span style={{ ...s.cmdStatVal, color: '#10b981' }}>{busesEnRoute}</span><span style={s.cmdStatLbl}>En Route</span></div>
              <div style={s.cmdStat}><span style={{ ...s.cmdStatVal, color: '#64748b' }}>{busesCompleted}</span><span style={s.cmdStatLbl}>Done</span></div>
              <div style={s.cmdStat}><span style={{ ...s.cmdStatVal, color: '#f59e0b' }}>{unassignedPax}</span><span style={s.cmdStatLbl}>Unassigned</span></div>
            </>
          )}
        </div>
        <div style={s.cmdRight}>
          <button style={s.cmdBtn} onClick={() => fetchRides()}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <div style={s.mainLayout}>
        {/* ── LEFT: Ride Feed + Convoy ────────────────────────────────── */}
        <div style={s.leftCol} className="hide-scrollbar">
          {/* ── SECTION 2: Active Rides Feed ──────────────────────────── */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <div style={s.sectionTitleRow}>
                <CalendarClock size={15} />
                <span style={s.sectionTitle}>Active Routes</span>
                <span style={s.badge}>{filteredRides.length}</span>
              </div>
              <div style={s.filterRow}>
                <div style={s.premiumSelectWrap}>
                  <Filter size={12} color={T.textMuted} style={s.premiumSelectIcon} />
                  <select 
                    style={s.premiumSelect} 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="boarding">Boarding</option>
                    <option value="departed">Departed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <ChevronDown size={12} color={T.textMuted} style={s.premiumSelectArrow} />
                </div>
                
                <div style={s.premiumSelectWrap}>
                  <ArrowRightLeft size={12} color={T.textMuted} style={{...s.premiumSelectIcon, transform: 'translateY(-50%) rotate(90deg)'}} />
                  <select 
                    style={s.premiumSelect} 
                    value={sortOption} 
                    onChange={e => setSortOption(e.target.value)}
                  >
                    <option value="time_asc">Time (Earliest)</option>
                    <option value="time_desc">Time (Latest)</option>
                    <option value="alpha_asc">Route (A-Z)</option>
                    <option value="alpha_desc">Route (Z-A)</option>
                    <option value="pax_desc">Passengers (High-Low)</option>
                  </select>
                  <ChevronDown size={12} color={T.textMuted} style={s.premiumSelectArrow} />
                </div>
              </div>
            </div>

            <div style={s.rideGrid}>
              {loading ? (
                <div style={s.emptyState}>Loading routes...</div>
              ) : filteredRides.length === 0 ? (
                <div style={s.emptyState}>
                  <CalendarClock size={32} style={{ opacity: 0.3 }} />
                  <span>No routes match current filter</span>
                </div>
              ) : filteredRides.map(ride => {
                const isSelected = ride.id === selectedRideId
                const sc = STATUS_COLORS[ride.status] || STATUS_COLORS.scheduled
                const cdMs = getCountdownMs(ride.join_deadline)
                return (
                  <div key={ride.id} style={{ ...s.rideCard, ...(isSelected ? s.rideCardSelected : {}), borderLeftColor: sc.color }}
                    onClick={() => {
                      const newId = isSelected ? null : ride.id
                      setSelectedRideId(newId)
                      setSearchParams(prev => {
                        if (newId) prev.set('ride', newId)
                        else prev.delete('ride')
                        return prev
                      })
                    }}>
                    <div style={s.rideCardTop}>
                      <span style={s.rideRef}>{ride.reference}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 10, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CalendarClock size={10} />
                          {ride.departure_date ? new Date(ride.departure_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Date N/A'}
                        </div>
                        {ride.status !== 'scheduled' && (
                          <span style={{ ...s.statusBadge, background: sc.bg, color: sc.color, borderColor: sc.border }}>
                            {ride.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={s.rideRoute}>
                      <div style={s.routeDot}><div style={{ ...s.dot, background: T.textPrimary }} /></div>
                      <span style={s.routeAddr}>{routeEndpointLabel(ride, 'origin')}</span>
                    </div>
                    <div style={s.rideRoute}>
                      <div style={s.routeDot}><div style={{ ...s.dot, background: '#a855f7' }} /></div>
                      <span style={s.routeAddr}>{routeEndpointLabel(ride, 'destination')}</span>
                    </div>
                    <div style={s.rideMeta}>
                      <span><Clock size={11} /> {fmtTime(ride.window_start)}-{fmtTime(ride.window_end)}</span>
                      <span><Users size={11} /> {ride.passenger_count} pax</span>
                      <span><MapPin size={11} /> {ride.stops_count} stops</span>
                      {ride.status === 'scheduled' && cdMs > 0 && (
                        <span style={{ color: cdMs < 600000 ? '#ef4444' : '#f59e0b' }}>
                          <Timer size={11} /> {fmtCountdown(cdMs)}
                        </span>
                      )}
                    </div>
                    <div style={s.rideTiers}>
                      {ride.enabled_tiers.map(t => (
                        <span key={t} style={s.tierChip}>{t}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── MIDDLE: Convoy Command Center ─────────────────────── */}
        <div style={s.midCol} className="hide-scrollbar">
          {selectedRide ? (
            <div style={{ ...s.section, flex: 1 }}>
              {/* 3A: Ride Overview Strip */}
              <div style={s.overviewStrip}>
                <div style={s.overviewRoute}>
                  <div style={s.overviewNode}><CircleDot size={14} color={T.textPrimary} /><span>{routeEndpointLabel(selectedRide, 'origin')}</span></div>
                  {selectedRide.stops_count > 0 && (
                    <>
                      <ArrowRight size={14} color={T.textMuted} />
                      <div style={s.overviewNode}><MapPin size={14} color={T.textMuted} /><span>{selectedRide.stops_count} stops</span></div>
                    </>
                  )}
                  <ArrowRight size={14} color={T.textMuted} />
                  <div style={s.overviewNode}><Navigation size={14} color='#a855f7' /><span>{routeEndpointLabel(selectedRide, 'destination')}</span></div>
                </div>
                <div style={s.overviewStats}>
                  <div style={s.overviewKpi}>
                    <span style={s.overviewKpiVal}>{passengers.length}</span>
                    <span style={s.overviewKpiLbl}>Total Pax</span>
                  </div>
                  <div style={s.overviewKpi}>
                    <span style={s.overviewKpiVal}>{buses.length}</span>
                    <span style={s.overviewKpiLbl}>Buses</span>
                  </div>
                  <div style={s.overviewKpi}>
                    <span style={{ ...s.overviewKpiVal, color: '#10b981' }}>{fmtCurrency(totalRevenue)}</span>
                    <span style={s.overviewKpiLbl}>Revenue</span>
                  </div>
                  <div style={s.overviewKpi}>
                    <span style={{ ...s.overviewKpiVal, color: '#ef4444' }}>{noShowCount}</span>
                    <span style={s.overviewKpiLbl}>No-Shows</span>
                  </div>
                </div>
              </div>

              {/* 3B: Vehicle Assignment Grid */}
              <div style={s.subsection}>
                <div style={s.subsectionHeader}>
                  <div style={s.sectionTitleRow}>
                    <Bus size={15} />
                    <span style={s.sectionTitle}>Vehicle Assignments</span>
                    <span style={s.badge}>{buses.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={s.actionBtn} onClick={handleAutoAllocate} disabled={actionLoading === 'auto'}>
                      <Zap size={13} /> {actionLoading === 'auto' ? 'Allocating...' : 'Auto-Allocate All'}
                    </button>
                    <button style={{ ...s.actionBtn, background: '#a855f7', color: '#fff' }} onClick={() => setShowAddBus(true)}>
                      <Plus size={13} /> Add Vehicle
                    </button>
                  </div>
                </div>

                {/* Add Vehicle Panel */}
                {showAddBus && (
                  <div style={s.addVehiclePanel}>
                    <div style={s.addVehicleHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: T.textWhite }}>Select Vehicle(s)</span>
                        <span style={s.vehicleCountBadge}>{interestedDrivers.length}</span>
                      </div>
                      <button style={s.closeBtn} onClick={() => { setShowAddBus(false); setSelectedDriverIds(new Set()) }}><X size={14} /></button>
                    </div>
                    
                    {interestedDrivers.length === 0 ? (
                      <div style={s.emptyDriverState}>
                        <Bus size={32} style={{ opacity: 0.3 }} />
                        <span>No drivers have expressed interest in this ride yet.</span>
                      </div>
                    ) : (
                      <>
                        <div style={s.driverCardGrid}>
                          {interestedDrivers.map(driver => {
                            const isSelected = selectedDriverIds.has(driver.id)
                            const hasVehicleProfile = driver.vehicle_type && driver.vehicle_seats
                            const canSelect = hasVehicleProfile
                            
                            return (
                              <div
                                key={driver.id}
                                style={{
                                  ...s.driverCard,
                                  ...(isSelected ? s.driverCardSelected : {}),
                                  ...(canSelect ? s.driverCardSelectable : s.driverCardDisabled),
                                  ...(canSelect && !isSelected && hoveredDriverId === driver.id ? { borderColor: 'rgba(168,85,247,0.5)', background: 'rgba(168,85,247,0.04)' } : {}),
                                  cursor: canSelect ? 'pointer' : 'not-allowed'
                                }}
                                onClick={() => canSelect && toggleDriverSelection(driver.id)}
                                onMouseEnter={() => canSelect && setHoveredDriverId(driver.id)}
                                onMouseLeave={() => setHoveredDriverId(null)}
                              >
                                <div style={s.driverCardHeader}>
                                  <div style={s.driverCardTitle}>
                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: canSelect ? '#10b981' : '#f59e0b', marginRight: 8 }} />
                                    <span style={{ fontWeight: 600, fontSize: 12, color: T.textPrimary }}>{driver.name || driver.user?.full_name || 'Unknown Driver'}</span>
                                  </div>
                                  {isSelected && (
                                    <div style={s.selectedBadge}>
                                      <CheckCircle2 size={12} color="#fff" />
                                    </div>
                                  )}
                                </div>
                                
                                <div style={s.driverCardVehicle}>
                                  <span style={{ fontSize: 11, color: T.textSecondary }}>
                                    {vehicleLabel(driver.vehicle_type || 'Unknown')} · {driver.vehicle_make || ''} {driver.vehicle_model || ''} · {driver.plate_number || 'No Plate'}
                                  </span>
                                </div>
                                
                                <div style={s.driverCardCapacity}>
                                  <span style={{ fontSize: 10, color: T.textMuted }}>Seats: {driver.vehicle_seats || 'N/A'}</span>
                                  {driver.vehicle_type === 'coach' && (
                                    <span style={{ fontSize: 10, color: T.textMuted }}> · Standing: {driver.vehicle_seats ? Math.round(driver.vehicle_seats * 0.4) : 'N/A'}</span>
                                  )}
                                </div>
                                
                                <div style={s.driverCardMeta}>
                                  <span style={{ fontSize: 10, color: T.textMuted }}>
                                    Interested: {fmtRelativeTime(driver.created_at)}
                                  </span>
                                </div>
                                
                                {!hasVehicleProfile && (
                                  <div style={s.warningBadge}>
                                    <AlertTriangle size={10} />
                                    <span>No vehicle profile</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        
                        <div style={s.addVehicleFooter}>
                          <span style={{ fontSize: 11, color: T.textMuted }}>
                            {selectedDriverIds.size} vehicle(s) selected
                          </span>
                          <button
                            style={{
                              ...s.actionBtn,
                              background: selectedDriverIds.size > 0 ? '#a855f7' : T.border,
                              color: selectedDriverIds.size > 0 ? '#fff' : T.textMuted,
                              cursor: selectedDriverIds.size > 0 ? 'pointer' : 'not-allowed'
                            }}
                            onClick={() => handleBulkAssign(Array.from(selectedDriverIds))}
                            disabled={selectedDriverIds.size === 0 || actionLoading === 'bulk_assign'}
                          >
                            {actionLoading === 'bulk_assign' ? 'Adding...' : 'Add Selected →'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Vehicle Cards */}
                <div style={s.busGrid}>
                  {buses.length === 0 ? (
                    <div style={{ ...s.emptyState, gridColumn: '1 / -1' }}>
                      <Bus size={28} style={{ opacity: 0.3 }} />
                      <span>No vehicles assigned yet. Click "Add Vehicle" to begin.</span>
                    </div>
                  ) : buses.map(bus => {
                    const sc = STATUS_COLORS[bus.status] || STATUS_COLORS.assigned
                    const isExpanded = expandedBus === bus.id
                    const busPax = passengers.filter(p => p.bus_assignment === bus.id)
                    const activeBusPax = busPax.filter(p => !['cancelled', 'no_show'].includes(p.status))
                    const isBoardingComplete = activeBusPax.length > 0 && bus.checked_in_count >= activeBusPax.length
                    const disableDispatch = !isBoardingComplete || !!actionLoading
                    const seatedPct = bus.seated_capacity > 0 ? Math.round((bus.seated_count / bus.seated_capacity) * 100) : 0
                    return (
                      <div key={bus.id} style={{ ...s.busCard, borderLeftColor: sc.color, cursor: 'pointer' }} onClick={() => setExpandedBus(isExpanded ? null : bus.id)}>
                        <div style={s.busCardTop}>
                          <div>
                            <div style={s.busLabel}>{bus.bus_label}</div>
                            <div style={s.busMeta}>
                              {bus.driver_name || 'No driver'} {bus.plate_number ? `• ${bus.plate_number}` : ''}
                            </div>
                          </div>
                          <span style={{ ...s.statusBadge, background: sc.bg, color: sc.color, borderColor: sc.border, fontSize: 9 }}>
                            {bus.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        {/* Capacity bars */}
                        <div style={s.capRow}>
                          <div style={s.capInfo}>
                            <span style={s.capLabel}>Seated</span>
                            <span style={s.capVal}>{bus.seated_count}/{bus.seated_capacity}</span>
                          </div>
                          <div style={s.capBarBg}>
                            <div style={{ ...s.capBarFill, width: `${seatedPct}%`, background: seatedPct >= 100 ? '#10b981' : '#a855f7' }} />
                          </div>
                        </div>
                        {bus.standing_capacity > 0 && (
                          <div style={s.capRow}>
                            <div style={s.capInfo}>
                              <span style={s.capLabel}>Standing</span>
                              <span style={s.capVal}>{bus.standing_count}/{bus.standing_capacity}</span>
                            </div>
                            <div style={s.capBarBg}>
                              <div style={{ ...s.capBarFill, width: `${bus.standing_capacity > 0 ? Math.round((bus.standing_count / bus.standing_capacity) * 100) : 0}%`, background: '#f59e0b' }} />
                            </div>
                          </div>
                        )}
                        <div style={s.busCheckIn}>
                          <UserCheck size={12} color='#10b981' />
                          <span>{bus.checked_in_count} checked in</span>
                        </div>

                        {/* Bus Actions */}
                        <div style={s.busActions} onClick={e => e.stopPropagation()}>
                          {bus.status === 'assigned' && (
                            <button style={{ ...s.busActionBtn, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', opacity: disableDispatch ? 0.5 : 1, cursor: disableDispatch ? 'not-allowed' : 'pointer' }}
                              onClick={() => handleBusAction(bus.id, 'depart')} disabled={disableDispatch}>
                              <Play size={12} /> Board / Depart
                            </button>
                          )}
                          {bus.status === 'boarding' && (
                            <button style={{ ...s.busActionBtn, color: '#10b981', background: 'rgba(16,185,129,0.1)', opacity: disableDispatch ? 0.5 : 1, cursor: disableDispatch ? 'not-allowed' : 'pointer' }}
                              onClick={() => handleBusAction(bus.id, 'depart')} disabled={disableDispatch}>
                              <Navigation size={12} /> Depart
                            </button>
                          )}
                          {(bus.status === 'departed' || bus.status === 'en_route') && (
                            <button style={{ ...s.busActionBtn, color: '#6366f1', background: 'rgba(99,102,241,0.1)' }}
                              onClick={() => handleBusAction(bus.id, 'arrive')} disabled={!!actionLoading}>
                              <MapPin size={12} /> Mark Arrived
                            </button>
                          )}
                          {bus.status === 'arrived' && (
                            <button style={{ ...s.busActionBtn, color: '#64748b', background: 'rgba(100,116,139,0.1)' }}
                              onClick={() => handleBusAction(bus.id, 'complete')} disabled={!!actionLoading}>
                              <CheckCircle2 size={12} /> Complete
                            </button>
                          )}
                          <span style={{ ...s.busActionBtn, color: T.textMuted, background: 'transparent', border: 'none', pointerEvents: 'none' }}>
                            <Users size={12} />
                            {busPax.length} pax
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 3E: Departure Timeline */}
              {buses.length > 0 && (
                <div style={s.subsection}>
                  <div style={s.sectionTitleRow}>
                    <Activity size={15} />
                    <span style={s.sectionTitle}>Departure Sequence</span>
                  </div>
                  <div style={s.timeline}>
                    {buses.sort((a, b) => a.order - b.order).map((bus, i) => {
                      const sc = STATUS_COLORS[bus.status] || STATUS_COLORS.assigned
                      const stepIdx = BUS_STATUS_FLOW.indexOf(bus.status)
                      return (
                        <div key={bus.id} style={s.timelineItem}>
                          <div style={{ ...s.timelineDot, background: sc.color, boxShadow: `0 0 8px ${sc.color}` }} />
                          {i < buses.length - 1 && <div style={s.timelineLine} />}
                          <div style={s.timelineContent}>
                            <div style={s.timelineLabel}>{bus.bus_label}</div>
                            <div style={{ ...s.timelineStatus, color: sc.color }}>{bus.status.replace('_', ' ').toUpperCase()}</div>
                            {bus.departed_at && <div style={s.timelineMeta}>Departed {new Date(bus.departed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>}
                            {bus.arrived_at && <div style={s.timelineMeta}>Arrived {new Date(bus.arrived_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>}
                            {/* Progress steps */}
                            <div style={s.timelineSteps}>
                              {BUS_STATUS_FLOW.map((step, si) => (
                                <div key={step} style={{ ...s.timelineStep, background: si <= stepIdx ? sc.color : T.border, opacity: si <= stepIdx ? 1 : 0.3 }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 3C: Passenger Manifest Table */}
              <div style={s.subsection}>
                <div style={s.subsectionHeader}>
                  <div style={s.sectionTitleRow}>
                    <Users size={15} />
                    <span style={s.sectionTitle}>Passenger Manifest</span>
                    <span style={s.badge}>{passengers.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button 
                      style={{ ...s.actionBtn, background: expandedBus ? '#10b981' : 'transparent', color: expandedBus ? '#fff' : T.textMuted, opacity: expandedBus ? 1 : 0.5 }}
                      onClick={handleAutoCheckIn}
                      disabled={!expandedBus || actionLoading === 'autoCheckIn'}
                      title={expandedBus ? 'Auto check-in passengers to the selected bus' : 'Select a bus in the Bus Assignments section first'}
                    >
                      <UserCheck size={13} /> {actionLoading === 'autoCheckIn' ? 'Checking In...' : 'Auto Check-In'}
                    </button>
                    <div style={s.searchWrap}>
                      <Search size={12} color={T.textMuted} style={{ position: 'absolute', left: 8, top: 8 }} />
                      <input style={s.searchInput} placeholder="Search student..." value={paxSearch}
                        onChange={e => setPaxSearch(e.target.value)} />
                    </div>
                    {(['all', 'unassigned', 'checked_in', 'no_show'] as const).map(f => (
                      <button key={f} style={{ ...s.filterChip, ...(paxFilter === f ? s.filterChipActive : {}), fontSize: 9, padding: '2px 8px' }}
                        onClick={() => setPaxFilter(f)}>
                        {f === 'all' ? 'All' : f === 'checked_in' ? 'Checked In' : f === 'no_show' ? 'No-Show' : 'Unassigned'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={s.tableWrap} onScroll={handleScrollTable}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Student</th>
                        <th style={s.th}>Tier</th>
                        <th style={s.th}>Bus</th>
                        <th style={s.th}>Seat</th>
                        <th style={s.th}>Status</th>
                        <th style={s.th}>Paid</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPassengers.length === 0 ? (
                        <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: T.textMuted, padding: 32 }}>No passengers match filter</td></tr>
                      ) : displayedPassengers.map(p => {
                        const rowBg = p.status === 'no_show' ? 'rgba(239,68,68,0.06)' :
                          p.status === 'cancelled' ? 'rgba(100,116,139,0.06)' :
                          p.checked_in_at ? 'rgba(16,185,129,0.06)' :
                          !p.bus_assignment ? 'rgba(245,158,11,0.04)' : 'transparent'
                        return (
                          <tr key={p.id} style={{ background: rowBg }}>
                            <td style={s.td}>
                              <div style={{ fontWeight: 600, fontSize: 12, color: T.textPrimary }}>{p.student_name}</div>
                              <div style={{ fontSize: 10, color: T.textMuted }}>{p.student_email}</div>
                            </td>
                            <td style={s.td}><span style={s.tierChip}>{p.pricing_tier}</span></td>
                            <td style={s.td}><span style={{ fontSize: 12, color: p.bus_label ? T.textPrimary : T.textMuted }}>{p.bus_label || '—'}</span></td>
                            <td style={s.td}><span style={{ fontSize: 11, color: T.textSecondary }}>{p.seat_type}</span></td>
                            <td style={s.td}>
                              {p.status === 'no_show' ? <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 10 }}>NO-SHOW</span> :
                               p.status === 'cancelled' ? <span style={{ color: '#64748b', fontWeight: 700, fontSize: 10 }}>CANCELLED</span> :
                               p.checked_in_at ? <span style={{ color: '#10b981', fontWeight: 600, fontSize: 10 }}>✓ CHECKED IN</span> :
                               <span style={{ color: '#f59e0b', fontSize: 10 }}>WAITING</span>}
                            </td>
                            <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtCurrency(p.amount_paid)}</span></td>
                            <td style={{ ...s.td, textAlign: 'right' }}>
                              {!p.checked_in_at && !['cancelled', 'no_show'].includes(p.status) && (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                  <button style={{ ...s.miniBtn, color: '#10b981' }} onClick={() => handleCheckIn(p.id)} disabled={!!actionLoading}><UserCheck size={13} /></button>
                                  <button style={{ ...s.miniBtn, color: '#ef4444' }} onClick={() => handleNoShow(p.id)} disabled={!!actionLoading}><UserX size={13} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...s.emptyState, flex: 1, background: T.bgPanel }}>
              <Navigation size={48} style={{ opacity: 0.1 }} />
              <span>Select an active route to view assignments and manifest</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: Analytics + Activity Log ─────────────────────────── */}
        <div style={s.rightCol}>
          {/* Section 4: Analytics */}
          <div style={{ ...s.rightSection, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={s.sectionTitleRow}>
              <TrendingUp size={14} />
              <span style={s.sectionTitle}>Route Analytics</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }} className="hide-scrollbar">
              {selectedRide ? (
                <div style={s.analyticsGrid}>
                <div style={s.analyticTile}>
                  <span style={s.analyticVal}>{passengers.filter(p => !['cancelled', 'no_show'].includes(p.status)).length}</span>
                  <span style={s.analyticLbl}>Active Pax</span>
                </div>
                <div style={s.analyticTile}>
                  <span style={s.analyticVal}>{busesCompleted}/{buses.length}</span>
                  <span style={s.analyticLbl}>Vehicles Done</span>
                </div>
                <div style={s.analyticTile}>
                  <span style={{ ...s.analyticVal, color: '#10b981' }}>{fmtCurrency(totalRevenue)}</span>
                  <span style={s.analyticLbl}>Revenue</span>
                </div>
                <div style={s.analyticTile}>
                  <span style={{ ...s.analyticVal, color: '#ef4444' }}>{noShowCount}</span>
                  <span style={s.analyticLbl}>No-Shows</span>
                </div>
                <div style={s.analyticTile}>
                  <span style={s.analyticVal}>
                    {passengers.length > 0 ? `${Math.round((passengers.filter(p => p.checked_in_at).length / passengers.length) * 100)}%` : '—'}
                  </span>
                  <span style={s.analyticLbl}>Check-in Rate</span>
                </div>
                <div style={s.analyticTile}>
                  <span style={s.analyticVal}>
                    {passengers.length > 0 ? `${Math.round((noShowCount / passengers.length) * 100)}%` : '0%'}
                  </span>
                  <span style={s.analyticLbl}>No-Show Rate</span>
                </div>
              </div>
            ) : (
              <div style={{ ...s.emptyState, padding: 20, fontSize: 11 }}>Select a route to view analytics</div>
            )}

            {/* Tier breakdown */}
            {selectedRide && passengers.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                  Tier Breakdown
                </div>
                {['standard', 'standing', 'premium', 'freight'].map(tier => {
                  const tierPax = passengers.filter(p => p.pricing_tier === tier && !['cancelled', 'no_show'].includes(p.status))
                  if (tierPax.length === 0) return null
                  const tierRev = tierPax.reduce((s, p) => s + Number(p.amount_paid || 0), 0)
                  return (
                    <div key={tier} style={s.tierRow}>
                      <span style={s.tierRowLabel}>{tier}</span>
                      <span style={s.tierRowVal}>{tierPax.length} pax</span>
                      <span style={{ ...s.tierRowVal, color: '#10b981' }}>{fmtCurrency(tierRev)}</span>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>

          {/* Section 5: Activity Log */}
          <div style={{ ...s.rightSection, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={s.sectionTitleRow}>
              <BarChart3 size={14} />
              <span style={s.sectionTitle}>Activity Log</span>
              <span style={s.badge}>{activityLog.length}</span>
            </div>
            <div style={s.logList}>
              {activityLog.length === 0 ? (
                <div style={{ ...s.emptyState, padding: 20, fontSize: 11 }}>Actions will appear here as you work</div>
              ) : activityLog.map(entry => (
                <div key={entry.id} style={s.logEntry}>
                  <div style={{ ...s.logDot, background: entry.type === 'success' ? '#10b981' : entry.type === 'warning' ? '#f59e0b' : entry.type === 'error' ? '#ef4444' : T.textMuted }} />
                  <div>
                    <div style={s.logMsg}>{entry.message}</div>
                    <div style={s.logTime}>{entry.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════════════════ */
/*  STYLES                                                                    */
/* ══════════════════════════════════════════════════════════════════════════ */

const s: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', overflow: 'hidden', fontFamily: T.fontFamily, background: T.bg, padding: 4, gap: 2, boxSizing: 'border-box' },

  // ── Command Header ──
  cmdHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0, flexShrink: 0 },
  cmdLeft: { flex: 1, display: 'flex', alignItems: 'center', gap: 12 },
  cmdCenter: { flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 },
  cmdRight: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  cmdClock: { display: 'flex', alignItems: 'center', gap: 6, color: T.textWhite },
  cmdTime: { fontSize: 14, fontWeight: 800, letterSpacing: -0.3 },
  cmdDate: { fontSize: 11, color: T.textMuted, marginLeft: 4 },
  cmdDivider: { width: 1, height: 20, background: T.border },
  cmdStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  cmdStatVal: { fontSize: 16, fontWeight: 800, color: T.textWhite, lineHeight: 1 },
  cmdStatLbl: { fontSize: 8, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  cmdBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 0, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.fontFamily },

  // ── Main Layout ──
  mainLayout: { display: 'flex', flex: 1, overflow: 'hidden', gap: 2 },
  leftCol: { width: 340, display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 2, flexShrink: 0 },
  midCol: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 2, minWidth: 0 },
  rightCol: { width: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 2, flexShrink: 0 },

  // ── Sections ──
  section: { background: T.bgPanel, border: `1px solid ${T.border}`, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 0 },
  subsection: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, margin: '0 16px 16px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  subsectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  sectionTitleRow: { display: 'flex', alignItems: 'center', gap: 8, color: T.textWhite, fontWeight: 700, fontSize: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 700 },
  badge: { fontSize: 10, fontWeight: 700, background: T.accentBg, color: '#a855f7', borderRadius: 0, padding: '2px 8px' },

  // ── Filters ──
  filterRow: { display: 'flex', gap: 6, width: '100%', alignItems: 'center', marginTop: 4 },
  filterChip: { padding: '4px 10px', borderRadius: 0, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: T.fontFamily, transition: 'all 0.15s' },
  filterChipActive: { background: T.accentBg, color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' },

  // ── Ride Cards ──
  rideGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 },
  rideCard: { background: T.bgCard, border: `1px solid ${T.border}`, borderLeft: '3px solid', borderRadius: 0, padding: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, transition: 'all 0.15s' },
  rideCardSelected: { borderColor: '#a855f7', background: 'rgba(168,85,247,0.06)' },
  rideCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  rideRef: { fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: T.textWhite },
  rideRoute: { display: 'flex', alignItems: 'center', gap: 8 },
  routeDot: { width: 8, height: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  routeAddr: { fontSize: 11, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rideMeta: { display: 'flex', gap: 12, fontSize: 10, color: T.textMuted, alignItems: 'center' },
  rideTiers: { display: 'flex', gap: 4 },
  tierChip: { padding: '2px 6px', borderRadius: 0, background: T.bgInput, border: `1px solid ${T.border}`, fontSize: 9, fontWeight: 600, color: T.textSecondary, textTransform: 'capitalize' },

  // ── Status Badge ──
  statusBadge: { padding: '3px 8px', borderRadius: 0, fontSize: 10, fontWeight: 700, border: '1px solid', textTransform: 'uppercase', letterSpacing: 0.4 },

  // ── Overview Strip ──
  overviewStrip: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 0, padding: '16px 20px', margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  overviewRoute: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  overviewNode: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textPrimary, fontWeight: 500 },
  overviewStats: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  overviewKpi: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: 80, flexShrink: 0 },
  overviewKpiVal: { fontSize: 18, fontWeight: 800, color: T.textWhite, lineHeight: 1, textAlign: 'center', width: '100%' },
  overviewKpiLbl: { fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', width: '100%' },

  // ── Bus Cards ──
  busGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 },
  busCard: { background: T.bgPanel, border: `1px solid ${T.border}`, borderLeft: '3px solid', borderRadius: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  busCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  busLabel: { fontSize: 14, fontWeight: 800, color: T.textWhite },
  busMeta: { fontSize: 10, color: T.textMuted, marginTop: 2 },
  capRow: { display: 'flex', flexDirection: 'column', gap: 3 },
  capInfo: { display: 'flex', justifyContent: 'space-between', fontSize: 10 },
  capLabel: { color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 },
  capVal: { color: T.textPrimary, fontWeight: 700, fontFamily: 'monospace' },
  capBarBg: { height: 4, borderRadius: 0, background: T.border, overflow: 'hidden' },
  capBarFill: { height: '100%', borderRadius: 0, transition: 'width 0.3s' },
  busCheckIn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#10b981', fontWeight: 600 },
  busActions: { display: 'flex', gap: 4, flexWrap: 'wrap', borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 4 },
  busActionBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 0, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: T.fontFamily, background: 'transparent' },

  // ── Expanded Bus Passenger List ──
  busPaxList: { borderTop: `1px solid ${T.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' },
  busPaxRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 0 },
  busPaxInfo: { display: 'flex', flexDirection: 'column' },
  busPaxName: { fontSize: 11, fontWeight: 600, color: T.textPrimary },
  busPaxMeta: { fontSize: 9, color: T.textMuted },
  busPaxActions: { display: 'flex', gap: 4, alignItems: 'center' },
  miniBtn: { width: 26, height: 26, borderRadius: 0, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', padding: 0, fontFamily: T.fontFamily },

  // ── Add Vehicle Panel ──
  addVehiclePanel: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 500 },
  addVehicleHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  vehicleCountBadge: { fontSize: 10, fontWeight: 700, background: 'rgba(168,85,247,0.15)', color: '#a855f7', borderRadius: 4, padding: '2px 8px' },
  emptyDriverState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, color: T.textMuted, fontSize: 12 },
  driverCardGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, overflowY: 'auto', maxHeight: 350, paddingRight: 4 },
  driverCard: { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, transition: 'all 0.15s', position: 'relative' },
  driverCardSelectable: { cursor: 'pointer' },
  driverCardDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  driverCardSelected: { borderColor: '#a855f7', background: 'rgba(168,85,247,0.08)', borderWidth: 2 },
  driverCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  driverCardTitle: { display: 'flex', alignItems: 'center' },
  selectedBadge: { width: 20, height: 20, borderRadius: 10, background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  driverCardVehicle: { fontSize: 11, color: T.textSecondary },
  driverCardCapacity: { display: 'flex', gap: 8, fontSize: 10, color: T.textMuted },
  driverCardMeta: { fontSize: 10, color: T.textMuted },
  warningBadge: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '4px 8px', borderRadius: 4, marginTop: 4 },
  addVehicleFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0', borderTop: `1px solid ${T.border}`, marginTop: 8 },
  closeBtn: { width: 24, height: 24, borderRadius: 0, border: 'none', background: 'transparent', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 0, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textSecondary, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.fontFamily },

  // ── Timeline ──
  timeline: { display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' },
  timelineItem: { display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', paddingBottom: 16, paddingLeft: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0, position: 'absolute', left: 0, top: 2, zIndex: 1 },
  timelineLine: { position: 'absolute', left: 4, top: 14, width: 2, height: 'calc(100% - 8px)', background: T.border },
  timelineContent: { display: 'flex', flexDirection: 'column', gap: 2 },
  timelineLabel: { fontSize: 12, fontWeight: 700, color: T.textWhite },
  timelineStatus: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 },
  timelineMeta: { fontSize: 10, color: T.textMuted },
  timelineSteps: { display: 'flex', gap: 2, marginTop: 4 },
  timelineStep: { width: 16, height: 3, borderRadius: 1.5 },

  // ── Passenger Table ──
  tableWrap: { maxHeight: 400, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 0 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '10px 12px', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${T.border}`, textAlign: 'left', background: T.bgCard, position: 'sticky', top: 0, zIndex: 1 },
  td: { padding: '10px 12px', borderBottom: `1px solid ${T.border}` },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 0, padding: '6px 8px 6px 28px', color: T.textPrimary, fontSize: 11, fontFamily: T.fontFamily, outline: 'none', width: 140 },

  // ── Right Column ──
  rightSection: { background: T.bgPanel, border: `1px solid ${T.border}`, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 0 },
  analyticsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
  analyticTile: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 0, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 },
  analyticVal: { fontSize: 16, fontWeight: 800, color: T.textWhite, lineHeight: 1 },
  analyticLbl: { fontSize: 8, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tierRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border}`, fontSize: 11 },
  tierRowLabel: { color: T.textSecondary, textTransform: 'capitalize', fontWeight: 500 },
  tierRowVal: { color: T.textPrimary, fontWeight: 600, fontFamily: 'monospace' },

  // ── Activity Log ──
  logList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 },
  logEntry: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' },
  logDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0, marginTop: 4 },
  logMsg: { fontSize: 11, color: T.textPrimary, lineHeight: 1.3 },
  logTime: { fontSize: 9, color: T.textMuted, marginTop: 1 },

  // ── Empty ──
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, color: T.textMuted, fontSize: 12 },
  
  // ── Premium Select ──
  premiumSelectWrap: { position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 },
  premiumSelectIcon: { position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 },
  premiumSelectArrow: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 },
  premiumSelect: { width: '100%', appearance: 'none', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 20px 5px 24px', color: T.textPrimary, fontSize: 11, fontWeight: 500, outline: 'none', cursor: 'pointer', fontFamily: T.fontFamily, boxShadow: '0 2px 6px rgba(0,0,0,0.05)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' },
}

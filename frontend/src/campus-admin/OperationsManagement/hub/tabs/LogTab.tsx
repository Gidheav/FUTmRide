import React, {
  useEffect, useState, useImperativeHandle, forwardRef,
  useRef, useCallback,
} from 'react'
import { createPortal } from 'react-dom'
import { apiService } from '../../../../services/api.service'
import { T } from '../../../theme'
import { useOperationsStore } from '../../../operationsStore'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { AlertCircle, Search, X, Clock, TrendingUp, Zap, Users, Star, CreditCard, Truck } from 'lucide-react'

interface LogEvent {
  id: string
  timestamp: string
  event: string
  event_label: string
  ride_type: string
  reference: string
  student_name: string
  driver_name: string
  route: string
  amount: string
  status: string
  ride_id: string
  meta?: string
}

interface LogTabProps {
  search: string
  rideType: string
  dateFrom: string
  dateTo: string
  isArchiveMode: boolean
}

export interface LogTabHandle {
  sync: () => void
}

// ─── Helper: derive enriched type-specific "hidden" fields ────────────────────
function getTypeIntelligence(ev: LogEvent, allEvents: LogEvent[]) {
  const related = allEvents.filter(e => e.ride_id === ev.ride_id && e.id !== ev.id)

  const base = {
    rideId: ev.ride_id,
    relatedCount: related.length,
    ageLabel: formatDistanceToNow(parseISO(ev.timestamp), { addSuffix: true }),
  }

  switch (ev.ride_type) {
    case 'scheduled': {
      const passengers = related.filter(e => e.ride_type === 'scheduled' && e.student_name !== '-')
      const uniqueStudents = new Set(passengers.map(e => e.student_name))
      const statuses = passengers.map(e => e.status)
      const boarded = statuses.filter(s => s === 'boarded' || s === 'confirmed' || s.includes('board')).length
      const noShows = statuses.filter(s => s === 'no_show').length
      const cancelled = statuses.filter(s => s.includes('cancel')).length
      const hasDriver = ev.driver_name && ev.driver_name !== '-' && ev.driver_name !== 'Unassigned'
      return {
        ...base,
        panel: 'scheduled',
        passengerCount: uniqueStudents.size,
        boarded,
        noShows,
        cancelled,
        driverAssigned: hasDriver,
        ridePhase: ev.status,
        scheduledNote: ev.meta || null,
      }
    }

    case 'on_demand': {
      const requests = related.filter(e => e.event?.includes('drr') || e.id?.startsWith('drr-'))
      const driverPings = requests.length
      const accepted = related.filter(e => e.status === 'accepted').length > 0
      const hasDispute = related.some(e => e.status?.includes('disput'))
      const completed = related.some(e => e.status === 'completed')
      return {
        ...base,
        panel: 'on_demand',
        driverPings,
        accepted,
        hasDispute,
        completed,
        ridePhase: ev.status,
      }
    }

    case 'garage': {
      const passengers = related.filter(e => e.ride_type === 'garage' && e.student_name !== '-')
      const uniquePassengers = new Set(passengers.map(e => e.student_name))
      return {
        ...base,
        panel: 'garage',
        passengersBoarded: uniquePassengers.size,
        ridePhase: ev.status,
        farePerSeat: ev.amount,
      }
    }

    case 'shared': {
      const riders = related.filter(e => e.ride_type === 'shared' && e.student_name !== '-')
      const uniqueRiders = new Set(riders.map(e => e.student_name))
      return {
        ...base,
        panel: 'shared',
        riderCount: uniqueRiders.size,
        ridePhase: ev.status,
      }
    }

    case 'payment': {
      return {
        ...base,
        panel: 'payment',
        txRef: ev.reference,
        walletDelta: ev.amount,
        paymentStatus: ev.status,
        rideRef: related[0]?.reference || null,
      }
    }

    case 'payout': {
      return {
        ...base,
        panel: 'payout',
        txRef: ev.reference,
        payoutAmount: ev.amount,
        payoutStatus: ev.status,
      }
    }

    case 'rating': {
      const stars = parseInt(ev.amount || '0', 10)
      return {
        ...base,
        panel: 'rating',
        stars,
        comment: ev.meta || null,
        ratedRideRef: related[0]?.reference || null,
      }
    }

    default:
      return { ...base, panel: 'generic' }
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatChip = ({ label, value, color = '#60a5fa' }: { label: string; value: string | number; color?: string }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px', gap: 2, flex: 1,
  }}>
    <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{label}</span>
  </div>
)

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, display: 'flex' }}>{icon}</span>
    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500, marginLeft: 'auto', textAlign: 'right', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
  </div>
)

const Stars = ({ n }: { n: number }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{ fontSize: 14, color: i <= n ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}>★</span>
    ))}
  </div>
)

// ─── Timeline item ─────────────────────────────────────────────────────────────
const TimelineItem = ({ ev, getStatusColor, getTypeColor }: {
  ev: LogEvent
  getStatusColor: (s: string) => string
  getTypeColor: (t: string) => { text: string; bg: string; label: string }
}) => {
  const tc = getTypeColor(ev.ride_type)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: getStatusColor(ev.status), marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.event_label}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', flexShrink: 0, fontFamily: 'monospace' }}>
            {format(parseISO(ev.timestamp), 'MMM d · h:mm a')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: 9, background: tc.bg, color: tc.text, padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 700 }}>{tc.label}</span>
          {ev.student_name && ev.student_name !== '-' && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.student_name}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export const LogTab = forwardRef<LogTabHandle, LogTabProps>((
  { search: globalSearch, rideType, dateFrom, dateTo, isArchiveMode },
  ref
) => {
  const { logHotCache: hotCache, setLogHotCache: setHotCache, setLogLastSyncTime, refreshSeq, tabInitialized, setTabInitialized } = useOperationsStore()

  const [displayedEvents, setDisplayedEvents] = useState<LogEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [archiveResults, setArchiveResults] = useState<LogEvent[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)

  // Hover / pin state
  const [hoveredEvent, setHoveredEvent] = useState<LogEvent | null>(null)
  const [pinnedEvent, setPinnedEvent] = useState<LogEvent | null>(null)
  const [pinnedPos, setPinnedPos] = useState({ x: 0, y: 0 })
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [showLookup, setShowLookup] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeEvents = isArchiveMode ? archiveResults : displayedEvents
  const isLoading = isArchiveMode ? archiveLoading : loading
  // All events combined for lookup scanning
  const allKnownEvents: LogEvent[] = [...hotCache, ...archiveResults]

  // Displayed card — pinned takes priority
  const displayCard = pinnedEvent ?? hoveredEvent

  // Escape key to unpin
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPinnedEvent(null); setShowLookup(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fetchHotCache = async () => {
    try {
      setLoading(true)
      const data = await apiService.getRideActivityLog({
        page_size: 1500,
        ride_type: rideType,
        date_from: dateFrom,
        date_to: dateTo,
        is_archive_search: false,
      })
      setHotCache(data.results)
      setLogLastSyncTime(new Date())
      setTabInitialized('log', true)
    } catch (e) {
      console.error('Failed to fetch hot cache', e)
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({ sync: fetchHotCache }))

  useEffect(() => {
    if (!tabInitialized.log && !isArchiveMode) fetchHotCache()
  }, [])

  // Trigger sync when filters change or Refresh button is pressed
  useEffect(() => {
    if (tabInitialized.log && !isArchiveMode) fetchHotCache()
  }, [rideType, dateFrom, dateTo, refreshSeq])

  useEffect(() => {
    if (isArchiveMode) return
    if (!globalSearch.trim()) { setDisplayedEvents(hotCache); return }
    const terms = globalSearch.trim().toLowerCase().split(/\s+/).filter(Boolean)
    setDisplayedEvents(hotCache.filter(ev => {
      const fields = [
        ev.student_name, ev.driver_name, ev.reference,
        ev.route, ev.event_label
      ].map(f => (f || '').toLowerCase())
      return terms.every(term =>
        fields.some(field =>
          field === term ||
          field.startsWith(term) ||
          field.includes(` ${term}`) ||
          field.includes(`-${term}`)
        )
      )
    }))
  }, [globalSearch, hotCache, isArchiveMode])

  useEffect(() => {
    if (!isArchiveMode) return
    const timer = setTimeout(() => { executeArchiveSearch() }, 600)
    return () => clearTimeout(timer)
  }, [globalSearch, isArchiveMode, rideType, dateFrom, dateTo])

  const executeArchiveSearch = async () => {
    try {
      setArchiveLoading(true)
      const data = await apiService.getRideActivityLog({
        page_size: 10000,
        ride_type: rideType,
        search: globalSearch,
        date_from: dateFrom,
        date_to: dateTo,
        is_archive_search: true,
      })
      setArchiveResults(data.results)
    } catch (e) {
      console.error('Archive search failed', e)
    } finally {
      setArchiveLoading(false)
    }
  }

  const getTypeColor = (type: string) => {
    if (type === 'on_demand') return { bg: '#1e3a5f22', text: '#60a5fa', label: 'On-Demand' }
    if (type === 'scheduled') return { bg: '#3b1a6022', text: '#c084fc', label: 'Scheduled' }
    if (type === 'garage')    return { bg: '#14532d22', text: '#4ade80', label: 'Garage' }
    if (type === 'shared')    return { bg: '#7c2d1222', text: '#fb923c', label: 'Shared' }
    if (type === 'payment')   return { bg: '#134e4a22', text: '#2dd4bf', label: 'Payment' }
    if (type === 'payout')    return { bg: '#78350f22', text: '#fbbf24', label: 'Payout' }
    if (type === 'rating')    return { bg: '#42200622', text: '#facc15', label: 'Rating' }
    return { bg: '#1e293b', text: '#94a3b8', label: type }
  }

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase()
    if (s.includes('complet') || s.includes('board') || s.includes('start') || s === 'accepted' || s.includes('join') || s.includes('confirm')) return '#10b981'
    if (s.includes('cancel') || s.includes('fail') || s.includes('disput') || s.includes('no_show') || s === 'declined' || s === 'timed_out' || s === 'expired' || s === 'reversed') return '#ef4444'
    if (s.includes('rout') || s.includes('arriv') || s.includes('depart') || s === 'matched' || s === 'ready') return '#f59e0b'
    if (s === 'pending' || s === 'gathering' || s === 'matching' || s === 'searching' || s === 'processing') return '#a78bfa'
    return '#3b82f6'
  }

  const thStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontWeight: 600,
    color: T.textMuted,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: T.bgInput,
    borderBottom: `1px solid ${T.border}`,
    whiteSpace: 'nowrap',
  }

  const handleRowMouseEnter = useCallback((ev: LogEvent) => {
    if (pinnedEvent) return // don't change hover display when pinned
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setHoveredEvent(ev)
    setShowLookup(false)
  }, [pinnedEvent])

  const handleRowMouseLeave = useCallback(() => {
    if (pinnedEvent) return
    hoverTimeout.current = setTimeout(() => setHoveredEvent(null), 150)
  }, [pinnedEvent])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleRowClick = useCallback((ev: LogEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    if (pinnedEvent?.id === ev.id) {
      // clicking same row again unpins
      setPinnedEvent(null)
      setShowLookup(false)
      return
    }
    setPinnedEvent(ev)
    setPinnedPos({ x: mousePos.x, y: mousePos.y })
    setShowLookup(false)
  }, [pinnedEvent, mousePos])

  // Click outside to unpin
  useEffect(() => {
    if (!pinnedEvent) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-modal-card]') && !target.closest('[data-log-row]')) {
        setPinnedEvent(null)
        setShowLookup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pinnedEvent])

  // ── Hover/pin card — FIXED height, no expanding content inside ───────────
  const renderCard = () => {
    if (!displayCard) return null

    const isPinned = !!pinnedEvent
    const CARD_W = 320
    const CARD_H = 230  // accurate estimate of actual rendered card height
    const GAP = 8       // tight, uniform gap in all 4 directions
    const vw = window.innerWidth
    const vh = window.innerHeight
    const mx = isPinned ? pinnedPos.x : mousePos.x
    const my = isPinned ? pinnedPos.y : mousePos.y

    const flipX = mx + GAP + CARD_W > vw
    const flipY = my + GAP + CARD_H > vh
    const left = flipX ? mx - CARD_W - GAP : mx + GAP
    const top  = flipY ? my - CARD_H - GAP : my + GAP

    const tc = getTypeColor(displayCard.ride_type)
    const intel = getTypeIntelligence(displayCard, allKnownEvents)

    // Related events for lookup
    const relatedEvents = allKnownEvents
      .filter(e => e.ride_id === displayCard.ride_id && e.id !== displayCard.id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    return createPortal(
      <div
        data-modal-card
        style={{
          position: 'fixed', left, top,
          zIndex: 99999,
          pointerEvents: isPinned ? 'auto' : 'none',
          width: CARD_W,
          transition: isPinned ? 'none' : 'left 0.05s, top 0.05s',
        }}
      >
        <div style={{
          background: 'linear-gradient(160deg, #0f172a 0%, #111827 100%)',
          border: isPinned
            ? '1px solid rgba(251,191,36,0.45)'
            : '1px solid rgba(255,255,255,0.09)',
          borderRadius: 12,
          boxShadow: isPinned
            ? '0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(251,191,36,0.15) inset'
            : '0 20px 50px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.05) inset',
          overflow: 'hidden',
          animation: 'fadeSlideIn 0.12s ease',
        }}>

          {/* Accent top bar */}
          <div style={{
            height: 3,
            background: isPinned
              ? 'linear-gradient(90deg, #fbbf24, transparent)'
              : `linear-gradient(90deg, ${tc.text}, transparent)`,
          }} />

          {/* Header row */}
          <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isPinned && (
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fbbf2422',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fbbf24' }} />
                </div>
              )}
              <span style={{ background: tc.bg, color: tc.text, padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {tc.label}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace' }}>
                <Clock size={9} style={{ display: 'inline', marginRight: 3 }} />
                {intel.ageLabel}
              </span>
            </div>
            {/* Action buttons — only when pinned */}
            {isPinned && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => { setShowLookup(p => !p) }}
                  title="Intelligence Lookup — find all related events"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: showLookup ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    borderRadius: 6, padding: '3px 7px', cursor: 'pointer',
                    color: '#818cf8', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                    transition: 'background 0.15s',
                  }}
                >
                  <Search size={10} />
                  INTEL
                </button>
                <button
                  onClick={() => { setPinnedEvent(null); setShowLookup(false) }}
                  title="Unpin (Escape)"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6, width: 22, height: 22, cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            )}
          </div>

          {/* ── Intel section: ride-type specific ─────────────────────────── */}
          <div style={{ padding: '0 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Ride ID chip */}
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginBottom: 8 }}>
              RIDE · {displayCard.ride_id.slice(0, 18)}...
            </div>

            {/* SCHEDULED */}
            {intel.panel === 'scheduled' && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <StatChip label="Joined" value={(intel as any).passengerCount} color="#c084fc" />
                  <StatChip label="Boarded" value={(intel as any).boarded} color="#10b981" />
                  <StatChip label="No-Show" value={(intel as any).noShows} color="#ef4444" />
                  <StatChip label="Cancelled" value={(intel as any).cancelled} color="#f59e0b" />
                </div>
                <InfoRow icon={<Users size={10} />} label="Driver Status"
                  value={(intel as any).driverAssigned ? '✓ Driver Assigned' : '⚠ No Driver Yet'} />
                <div style={{ marginTop: 6 }}>
                  <InfoRow icon={<TrendingUp size={10} />} label="Ride Phase"
                    value={(intel as any).ridePhase?.replace(/_/g, ' ').toUpperCase()} />
                </div>
                {(intel as any).scheduledNote && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8', fontStyle: 'italic', padding: '5px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                    "{(intel as any).scheduledNote}"
                  </div>
                )}
              </>
            )}

            {/* ON DEMAND */}
            {intel.panel === 'on_demand' && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <StatChip label="Driver Pings" value={(intel as any).driverPings} color="#60a5fa" />
                  <StatChip label="Accepted" value={(intel as any).accepted ? 'Yes' : 'No'} color={(intel as any).accepted ? '#10b981' : '#ef4444'} />
                  <StatChip label="Dispute" value={(intel as any).hasDispute ? 'Yes' : 'No'} color={(intel as any).hasDispute ? '#ef4444' : '#4ade80'} />
                </div>
                <InfoRow icon={<Zap size={10} />} label="Current Phase"
                  value={(intel as any).ridePhase?.replace(/_/g, ' ').toUpperCase()} />
                {(intel as any).completed && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#10b981', fontWeight: 600 }}>✓ Ride Completed</div>
                )}
              </>
            )}

            {/* GARAGE */}
            {intel.panel === 'garage' && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <StatChip label="Boarded" value={(intel as any).passengersBoarded} color="#4ade80" />
                  <StatChip label="Fare/Seat" value={`₦${parseFloat((intel as any).farePerSeat || '0').toLocaleString()}`} color="#fbbf24" />
                </div>
                <InfoRow icon={<Truck size={10} />} label="Ride Phase"
                  value={(intel as any).ridePhase?.replace(/_/g, ' ').toUpperCase()} />
              </>
            )}

            {/* SHARED */}
            {intel.panel === 'shared' && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <StatChip label="Co-Riders" value={(intel as any).riderCount} color="#fb923c" />
                  <StatChip label="Phase" value={(intel as any).ridePhase?.replace(/_/g,'').slice(0,8) ?? '-'} color="#fb923c" />
                </div>
              </>
            )}

            {/* PAYMENT */}
            {intel.panel === 'payment' && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <StatChip label="Amount" value={`₦${parseFloat((intel as any).walletDelta || '0').toLocaleString()}`} color="#2dd4bf" />
                  <StatChip label="Status" value={(intel as any).paymentStatus?.toUpperCase() ?? '-'} color="#2dd4bf" />
                </div>
                {(intel as any).rideRef && (
                  <InfoRow icon={<CreditCard size={10} />} label="Linked Ride" value={(intel as any).rideRef} />
                )}
              </>
            )}

            {/* PAYOUT */}
            {intel.panel === 'payout' && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <StatChip label="Payout" value={`₦${parseFloat((intel as any).payoutAmount || '0').toLocaleString()}`} color="#fbbf24" />
                  <StatChip label="Status" value={(intel as any).payoutStatus?.toUpperCase() ?? '-'} color="#fbbf24" />
                </div>
              </>
            )}

            {/* RATING */}
            {intel.panel === 'rating' && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Stars n={(intel as any).stars} />
                </div>
                {(intel as any).comment && (
                  <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', padding: '5px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 6 }}>
                    "{(intel as any).comment}"
                  </div>
                )}
                {(intel as any).ratedRideRef && (
                  <InfoRow icon={<Star size={10} />} label="For Ride" value={(intel as any).ratedRideRef} />
                )}
              </>
            )}
          </div>

          {/* Footer — related count + hint */}
          <div style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>
              {intel.relatedCount > 0
                ? `${intel.relatedCount} related event${intel.relatedCount > 1 ? 's' : ''} on this ride`
                : 'No other events on this ride in cache'}
            </span>
            {!isPinned && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>click row to pin</span>
            )}
          </div>

        </div>
      </div>,
      document.body
    )
  }

  // ── Intelligence Lookup — fully separate portal, right-side drawer ─────────
  const renderLookupPanel = () => {
    if (!showLookup || !pinnedEvent) return null

    const relatedEvents = allKnownEvents
      .filter(e => e.ride_id === pinnedEvent.ride_id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const tc = getTypeColor(pinnedEvent.ride_type)

    // Position: right side of screen, vertically centred
    const DRAWER_W = 360
    const DRAWER_H = Math.min(560, window.innerHeight - 80)
    const left = window.innerWidth - DRAWER_W - 20
    const top  = Math.max(20, (window.innerHeight - DRAWER_H) / 2)

    return createPortal(
      <>
        {/* Scrim — click to close lookup without unpinning */}
        <div
          data-modal-card
          onClick={() => setShowLookup(false)}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 99998,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(1px)',
            animation: 'fadeBg 0.15s ease',
          }}
        />

        {/* Drawer */}
        <div
          data-modal-card
          style={{
            position: 'fixed', left, top,
            width: DRAWER_W, height: DRAWER_H,
            zIndex: 99999,
            display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(180deg, #0c1222 0%, #0f172a 100%)',
            border: '1px solid rgba(99,102,241,0.35)',
            borderRadius: 14,
            boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(99,102,241,0.1) inset',
            overflow: 'hidden',
            animation: 'slideInRight 0.18s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Top accent bar */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, transparent)', flexShrink: 0 }} />

          {/* Header */}
          <div style={{
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: '1px solid rgba(99,102,241,0.15)',
            flexShrink: 0,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Search size={13} color="#818cf8" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.02em' }}>Intelligence Lookup</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ background: tc.bg, color: tc.text, padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginRight: 5 }}>{tc.label}</span>
                {pinnedEvent.reference}
              </div>
            </div>
            <button
              onClick={() => setShowLookup(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 7, width: 26, height: 26, cursor: 'pointer',
                color: 'rgba(255,255,255,0.45)', flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>

          {/* Stats row */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', gap: 8, flexShrink: 0,
          }}>
            <div style={{ flex: 1, background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>{relatedEvents.length}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>Total Events</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                {relatedEvents.filter(e => e.status?.includes('complet') || e.status === 'completed').length}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>Completed</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>
                {relatedEvents.filter(e => e.status?.includes('cancel') || e.status?.includes('fail') || e.status === 'no_show').length}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>Issues</div>
            </div>
          </div>

          {/* Timeline label */}
          <div style={{ padding: '8px 16px 4px', flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Full Ride Timeline</span>
          </div>

          {/* Scrollable timeline */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {relatedEvents.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>🔍</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>No other cached events for this ride</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Switch to Deep Search for full archive results</div>
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 16 }}>
                {/* Vertical timeline line */}
                <div style={{
                  position: 'absolute', left: 5, top: 8, bottom: 8,
                  width: 1, background: 'rgba(255,255,255,0.07)',
                }} />

                {relatedEvents.map((e, idx) => {
                  const isThisEvent = e.id === pinnedEvent.id
                  const stClr = getStatusColor(e.status)
                  const eTc = getTypeColor(e.ride_type)
                  return (
                    <div
                      key={e.id}
                      style={{
                        position: 'relative',
                        marginBottom: idx < relatedEvents.length - 1 ? 12 : 0,
                        padding: '8px 10px',
                        background: isThisEvent ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.02)',
                        border: isThisEvent ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.04)',
                        borderRadius: 8,
                        transition: 'background 0.1s',
                      }}
                    >
                      {/* Dot on timeline line */}
                      <div style={{
                        position: 'absolute', left: -19, top: 12,
                        width: 8, height: 8, borderRadius: '50%',
                        background: isThisEvent ? '#fbbf24' : stClr,
                        border: isThisEvent ? '2px solid rgba(251,191,36,0.4)' : '2px solid rgba(0,0,0,0.5)',
                        boxShadow: isThisEvent ? '0 0 8px rgba(251,191,36,0.5)' : undefined,
                      }} />

                      {/* Event row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{
                          background: eTc.bg, color: eTc.text,
                          fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                        }}>{eTc.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isThisEvent ? '#fbbf24' : '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isThisEvent ? '◀ ' : ''}{e.event_label}
                        </span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', flexShrink: 0, fontFamily: 'monospace' }}>
                          {format(parseISO(e.timestamp), 'h:mm a')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, color: stClr, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {e.status.replace(/_/g, ' ')}
                        </span>
                        {e.student_name && e.student_name !== '-' && (
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.student_name}</span>
                        )}
                        {e.driver_name && e.driver_name !== '-' && e.driver_name !== 'Unassigned' && (
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.driver_name}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </>,
      document.body
    )
  }

  return (
    <div style={{ padding: 0, marginTop: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Archive mode indicator strip */}
      {isArchiveMode && (
        <div style={{
          flexShrink: 0,
          padding: '8px 16px',
          background: T.bgPanel,
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '4px', background: T.accentBg, borderRadius: '4px', display: 'flex' }}>
              <AlertCircle size={12} color={T.accent} />
            </div>
            <span style={{ color: T.textPrimary, fontWeight: 500 }}>Deep Searching.....</span>
            <span style={{ color: T.textMuted }}>Hitting directly to database. Records not found does not exist</span>
          </div>
          {archiveLoading && (
            <span style={{ color: T.textMuted, fontStyle: 'italic' }}>Searching...</span>
          )}
        </div>
      )}

      {/* Scrollable Table Container */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: `1px solid ${T.border}`, background: T.bgPanel }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '12%' }}>Timestamp</th>
              <th style={{ ...thStyle, width: '16%' }}>Event</th>
              <th style={{ ...thStyle, width: '10%' }}>Type</th>
              <th style={{ ...thStyle, width: '12%' }}>Ref</th>
              <th style={{ ...thStyle, width: '16%' }}>Student</th>
              <th style={{ ...thStyle, width: '12%' }}>Driver</th>
              <th style={{ ...thStyle, width: '14%' }}>Route</th>
              <th style={{ ...thStyle, width: '8%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {activeEvents.map((ev, i) => {
              const typeCfg = getTypeColor(ev.ride_type)
              const isPinnedRow = pinnedEvent?.id === ev.id
              return (
                <tr
                  key={`${ev.id}-${i}`}
                  data-log-row
                  style={{
                    borderBottom: `1px solid ${T.border}`,
                    transition: 'background 0.1s',
                    cursor: 'pointer',
                    background: isPinnedRow ? 'rgba(251,191,36,0.06)' : undefined,
                    outline: isPinnedRow ? '1px solid rgba(251,191,36,0.2)' : undefined,
                  }}
                  onMouseEnter={() => handleRowMouseEnter(ev)}
                  onMouseLeave={handleRowMouseLeave}
                  onMouseMove={handleMouseMove}
                  onClick={(e) => handleRowClick(ev, e)}
                >
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div style={{ color: T.textPrimary, fontWeight: 500 }}>{format(parseISO(ev.timestamp), 'MMM d, yyyy')}</div>
                    <div style={{ color: T.textMuted, fontSize: 12 }}>{format(parseISO(ev.timestamp), 'h:mm a')}</div>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: getStatusColor(ev.status), fontWeight: 600, fontSize: 12 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.event_label}</span>
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ background: typeCfg.bg, color: typeCfg.text, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                      {typeCfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.reference}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.student_name}</td>
                  <td style={{ padding: '12px 16px', color: T.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.driver_name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.route}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.ride_type === 'rating' ? (
                      <span>{ev.amount} {ev.meta && <span style={{ opacity: 0.5 }}>💬</span>}</span>
                    ) : (
                      `₦${parseFloat(ev.amount || '0').toLocaleString()}`
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {isLoading && (
          <div style={{ padding: 24, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            {isArchiveMode ? 'Querying deep archive...' : 'Syncing...'}
          </div>
        )}

        {!isLoading && activeEvents.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: T.textPrimary }}>
              {isArchiveMode ? 'No records found in archive' : 'No activity found'}
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {isArchiveMode ? 'Try a different date range or search term' : 'Hit Refresh to sync latest logs'}
            </div>
          </div>
        )}

        {!isLoading && activeEvents.length > 0 && (
          <div style={{ padding: '12px 16px', textAlign: 'center', borderTop: `1px solid ${T.border}`, color: T.textMuted, fontSize: 12 }}>
            {isArchiveMode
              ? `Deep Search Active — Showing all matches`
              : `${activeEvents.length} Records — Hover for intel · Click to pin · INTEL button for full timeline`}
          </div>
        )}
      </div>

      {/* Floating / Pinned hover card */}
      {renderCard()}

      {/* Intelligence lookup — separate portal, does not affect card height */}
      {renderLookupPanel()}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes fadeBg {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
})

LogTab.displayName = 'LogTab'

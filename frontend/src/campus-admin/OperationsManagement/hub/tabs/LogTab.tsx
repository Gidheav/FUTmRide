import React, { useEffect, useState, useImperativeHandle, forwardRef, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { apiService } from '../../../../services/api.service'
import { T } from '../../../theme'
import { useOperationsStore } from '../../../operationsStore'
import { format, parseISO } from 'date-fns'
import { AlertCircle } from 'lucide-react'

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

export const LogTab = forwardRef<LogTabHandle, LogTabProps>((
  { search: globalSearch, rideType, dateFrom, dateTo, isArchiveMode },
  ref
) => {
  const { logHotCache: hotCache, setLogHotCache: setHotCache, setLogLastSyncTime, refreshSeq, tabInitialized, setTabInitialized } = useOperationsStore()

  const [displayedEvents, setDisplayedEvents] = useState<LogEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [archiveResults, setArchiveResults] = useState<LogEvent[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)

  // Hover card state — deep archive only
  const [hoveredEvent, setHoveredEvent] = useState<LogEvent | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Expose sync method to parent via ref
  useImperativeHandle(ref, () => ({ sync: fetchHotCache }))

  // Fetch once on first mount; skip if already cached
  useEffect(() => {
    if (!tabInitialized.log && !isArchiveMode) fetchHotCache()
  }, [])

  // Trigger sync when Refresh button is pressed (refreshSeq bumps)
  useEffect(() => {
    if (refreshSeq > 0 && !isArchiveMode) fetchHotCache()
  }, [refreshSeq])

  // Local instant filter — exact word-boundary matching (starts-with each word)
  useEffect(() => {
    if (isArchiveMode) return
    if (!globalSearch.trim()) { setDisplayedEvents(hotCache); return }
    const terms = globalSearch.trim().toLowerCase().split(/\s+/).filter(Boolean)
    setDisplayedEvents(hotCache.filter(ev => {
      const fields = [
        ev.student_name, ev.driver_name, ev.reference,
        ev.route, ev.event_label
      ].map(f => (f || '').toLowerCase())
      // Every typed term must appear at the START of at least one word in any field
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

  // Archive: auto-search with debounce when search text changes
  useEffect(() => {
    if (!isArchiveMode) return
    const timer = setTimeout(() => {
      executeArchiveSearch()
    }, 600)
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

  const activeEvents = isArchiveMode ? archiveResults : displayedEvents
  const isLoading = isArchiveMode ? archiveLoading : loading

  // Hover card helpers
  const getInitials = (name: string) => {
    if (!name || name === '-') return '?'
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  const getAvatarColor = (name: string) => {
    const colors = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981','#3b82f6','#ef4444']
    let h = 0
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
    return colors[Math.abs(h) % colors.length]
  }

  const handleRowMouseEnter = useCallback((ev: LogEvent) => {
    if (!isArchiveMode) return
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setHoveredEvent(ev)
  }, [isArchiveMode])

  const handleRowMouseLeave = useCallback(() => {
    if (!isArchiveMode) return
    hoverTimeout.current = setTimeout(() => setHoveredEvent(null), 150)
  }, [isArchiveMode])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isArchiveMode) return
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [isArchiveMode])

  return (
    <div style={{ padding: 0, marginTop: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Archive mode indicator strip — only visible when active */}
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
              return (
                <tr
                  key={`${ev.id}-${i}`}
                  style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.1s', cursor: isArchiveMode ? 'default' : undefined }}
                  onMouseEnter={() => handleRowMouseEnter(ev)}
                  onMouseLeave={handleRowMouseLeave}
                  onMouseMove={handleMouseMove}
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
                      <span>
                        {ev.amount} {ev.meta && <span style={{ opacity: 0.5 }}>💬</span>}
                      </span>
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
            {isArchiveMode ? `Deep Search Active — Showing all matches` : `${activeEvents.length} Records - Type to filter instantly or deep search for older records`}
          </div>
        )}
      </div>

      {/* Deep Search Hover Card — 4-wall aware, premium info card style */}
      {isArchiveMode && hoveredEvent && createPortal(
        (() => {
          const CARD_W = 300
          const CARD_H = 260
          const GAP = 16
          const vw = window.innerWidth
          const vh = window.innerHeight
          const mx = mousePos.x
          const my = mousePos.y

          // Flip left if near right wall, flip up if near bottom wall
          const left = mx + GAP + CARD_W > vw ? mx - CARD_W - GAP : mx + GAP
          const top  = my + GAP + CARD_H > vh ? my - CARD_H - GAP : my + GAP

          const tc = getTypeColor(hoveredEvent.ride_type)
          const statusClr = getStatusColor(hoveredEvent.status)

          const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          )

          const PersonChip = ({ name, role }: { name: string; role: string }) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: getAvatarColor(name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.02em'
              }}>
                {getInitials(name)}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{role}</div>
                <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, marginTop: 1 }}>{name}</div>
              </div>
            </div>
          )

          return (
            <div style={{ position: 'fixed', left, top, zIndex: 99999, pointerEvents: 'none', width: CARD_W }}>
              <div style={{
                background: 'linear-gradient(160deg, #0f172a 0%, #111827 100%)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 12,
                boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.05) inset',
                overflow: 'hidden',
                animation: 'fadeSlideIn 0.12s ease',
              }}>

                {/* ── Accent top bar */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${tc.text}, transparent)` }} />

                {/* ── Header */}
                <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: tc.bg, color: tc.text, padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {tc.label}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: statusClr, fontSize: 10, fontWeight: 600 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
                      {hoveredEvent.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace', flexShrink: 0 }}>
                    {format(parseISO(hoveredEvent.timestamp), 'MMM d · h:mm a')}
                  </span>
                </div>

                {/* ── Event + Ref */}
                <div style={{ padding: '0 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>{hoveredEvent.event_label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace', marginTop: 3 }}>{hoveredEvent.reference}</div>
                </div>

                {/* ── People */}
                {(hoveredEvent.student_name !== '-' || hoveredEvent.driver_name !== '-') && (
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {hoveredEvent.student_name && hoveredEvent.student_name !== '-' && (
                      <PersonChip name={hoveredEvent.student_name} role="Student" />
                    )}
                    {hoveredEvent.driver_name && hoveredEvent.driver_name !== '-' && (
                      <PersonChip name={hoveredEvent.driver_name} role="Driver" />
                    )}
                  </div>
                )}

                {/* ── Details */}
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {hoveredEvent.route && hoveredEvent.route !== '-' && (
                    <Row label="Route" value={hoveredEvent.route} />
                  )}
                  <Row
                    label="Amount"
                    value={
                      hoveredEvent.ride_type === 'rating'
                        ? `${hoveredEvent.amount} / 5`
                        : `₦${parseFloat(hoveredEvent.amount || '0').toLocaleString()}`
                    }
                  />
                  {hoveredEvent.meta && (
                    <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 7 }}>
                      "{hoveredEvent.meta}"
                    </div>
                  )}
                </div>

              </div>
            </div>
          )
        })(),
        document.body
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(3px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
})

LogTab.displayName = 'LogTab'

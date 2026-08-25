import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react'
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
        page_size: 1000,
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
    return { bg: '#1e293b', text: '#94a3b8', label: type }
  }

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase()
    if (s.includes('complet') || s.includes('board') || s.includes('start') || s === 'accepted' || s.includes('join') || s.includes('confirm')) return '#10b981'
    if (s.includes('cancel') || s.includes('fail') || s.includes('disput') || s.includes('no_show') || s === 'declined' || s === 'timed_out' || s === 'expired') return '#ef4444'
    if (s.includes('rout') || s.includes('arriv') || s.includes('depart') || s === 'matched' || s === 'ready') return '#f59e0b'
    if (s === 'pending' || s === 'gathering' || s === 'matching' || s === 'searching') return '#a78bfa'
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
                <tr key={`${ev.id}-${i}`} style={{ borderBottom: `1px solid ${T.border}` }}>
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
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.student_name}>{ev.student_name}</td>
                  <td style={{ padding: '12px 16px', color: T.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.driver_name || '-'}>{ev.driver_name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.route}>{ev.route}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>&#x20A6;{parseFloat(ev.amount).toLocaleString()}</td>
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
            {isArchiveMode ? `Found ${activeEvents.length} records in archive` : `${activeEvents.length} Records - Type to filter instantly`}
          </div>
        )}
      </div>
    </div>
  )
})

LogTab.displayName = 'LogTab'

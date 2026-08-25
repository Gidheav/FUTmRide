import React, { useEffect, useState, useRef, useCallback } from 'react'
import { apiService } from '../../../../services/api.service'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'
import { format, parseISO } from 'date-fns'
import { MapPin, Filter, Search, ChevronDown, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

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
}

export const LogTab: React.FC<LogTabProps> = ({ search: globalSearch }) => {
  const [events, setEvents] = useState<LogEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  
  // Filters
  const [studentSearch, setStudentSearch] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const [referenceSearch, setReferenceSearch] = useState('')
  const [rideType, setRideType] = useState('on_demand,scheduled,garage')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  const observer = useRef<IntersectionObserver | null>(null)
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return
    if (observer.current) observer.current.disconnect()
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchLogs(nextCursor)
      }
    })
    
    if (node) observer.current.observe(node)
  }, [loading, hasMore, nextCursor])

  const fetchLogs = async (cursor?: string, reset = false) => {
    try {
      setLoading(true)
      const data = await apiService.getRideActivityLog({
        cursor,
        page_size: 50,
        ride_type: rideType,
        student: studentSearch || globalSearch,
        driver: driverSearch,
        reference: referenceSearch,
        date_from: dateFrom,
        date_to: dateTo
      })
      
      setEvents(prev => reset ? data.results : [...prev, ...data.results])
      setHasMore(data.has_next)
      setNextCursor(data.next_cursor)
    } catch (e) {
      console.error('Failed to fetch activity log', e)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and on filter change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLogs(undefined, true)
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [studentSearch, driverSearch, referenceSearch, rideType, dateFrom, dateTo, globalSearch])

  const getTypeColor = (type: string) => {
    if (type === 'on_demand') return { bg: '#e0f2fe', text: '#0369a1', label: 'On-Demand' }
    if (type === 'scheduled') return { bg: '#f3e8ff', text: '#7e22ce', label: 'Scheduled' }
    if (type === 'garage') return { bg: '#dcfce7', text: '#15803d', label: 'Garage' }
    return { bg: '#f1f5f9', text: '#475569', label: type }
  }

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase()
    if (s.includes('complet') || s.includes('board') || s.includes('start')) return '#10b981' // Green
    if (s.includes('cancel') || s.includes('fail') || s.includes('dispute') || s.includes('no_show')) return '#ef4444' // Red
    if (s.includes('rout') || s.includes('arriv')) return '#f59e0b' // Amber
    return '#3b82f6' // Blue
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', boxSizing: 'border-box' }}>
      
      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: T.bgPanel, padding: 16, borderRadius: 8, border: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMuted, fontSize: 13, fontWeight: 500 }}>
          <Filter size={16} /> Filters
        </div>
        
        <input
          type="text"
          placeholder="Student Name"
          value={studentSearch}
          onChange={e => setStudentSearch(e.target.value)}
          style={{ ...campusPanel.input, width: 160 }}
        />
        
        <input
          type="text"
          placeholder="Driver Name"
          value={driverSearch}
          onChange={e => setDriverSearch(e.target.value)}
          style={{ ...campusPanel.input, width: 160 }}
        />
        
        <input
          type="text"
          placeholder="Ride Ref"
          value={referenceSearch}
          onChange={e => setReferenceSearch(e.target.value)}
          style={{ ...campusPanel.input, width: 130 }}
        />
        
        <select
          value={rideType}
          onChange={e => setRideType(e.target.value)}
          style={{ ...campusPanel.input, width: 150 }}
        >
          <option value="on_demand,scheduled,garage">All Types</option>
          <option value="on_demand">On-Demand</option>
          <option value="scheduled">Scheduled</option>
          <option value="garage">Garage</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: T.textMuted }}>From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={campusPanel.input}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: T.textMuted }}>To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={campusPanel.input}
          />
        </div>
        
        <button 
          onClick={() => {
            setStudentSearch('')
            setDriverSearch('')
            setReferenceSearch('')
            setRideType('on_demand,scheduled,garage')
            setDateFrom('')
            setDateTo('')
          }}
          style={{ ...campusPanel.btnSecondary, marginLeft: 'auto' }}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div style={{ ...campusPanel.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: '#f8fafc', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: T.textMuted }}>Timestamp</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: T.textMuted }}>Event</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: T.textMuted }}>Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: T.textMuted }}>Ref</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: T.textMuted }}>Student</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: T.textMuted }}>Driver</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: T.textMuted }}>Route</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: T.textMuted }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => {
              const typeCfg = getTypeColor(ev.ride_type)
              return (
                <tr key={`${ev.id}-${i}`} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.2s' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ color: T.textPrimary, fontWeight: 500 }}>
                      {format(parseISO(ev.timestamp), 'MMM d, yyyy')}
                    </div>
                    <div style={{ color: T.textMuted, fontSize: 12 }}>
                      {format(parseISO(ev.timestamp), 'h:mm a')}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 6,
                      color: getStatusColor(ev.status),
                      fontWeight: 600,
                      fontSize: 12
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                      {ev.event_label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: typeCfg.bg,
                      color: typeCfg.text,
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {typeCfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: T.textMuted }}>
                    {ev.reference}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: T.textPrimary }}>
                    {ev.student_name}
                  </td>
                  <td style={{ padding: '12px 16px', color: T.textSecondary }}>
                    {ev.driver_name || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: T.textMuted, maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.route}>
                    {ev.route}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: T.textPrimary }}>
                    ₦{parseFloat(ev.amount).toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            Loading activity log...
          </div>
        )}
        
        {!loading && events.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: T.textPrimary }}>No activity found</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your filters</div>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={lastElementRef} style={{ height: 20 }} />
      </div>
    </div>
  )
}

import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Edit2, Trash2, Map as MapIcon, MoreVertical, Route, Navigation, Bus, Users, Clock,
  Loader2, X, Crosshair, Calendar, Copy, ExternalLink, ArrowLeft,
  Save, Play, CheckCircle2, MapPin, ChevronRight
} from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'
import { apiService } from '../../../../services/api.service'
import { useDispatchStore } from '../../../dispatchStore'
import { routeEndpointLabel } from '../../../shared/routeDisplay'
import RideResolutionModal from '../../../components/RideResolutionModal'
import { useOperationsStore } from '../../../operationsStore'

/* ─────────────────────────── Types ─────────────────────────────── */

interface ScheduledRide {
  id: string
  reference: string
  origin_address: string
  origin_name?: string | null
  destination_address: string
  destination_name?: string | null
  stops_count: number
  passenger_count: number
  vehicle_size: string
  allowed_vehicle_types?: string[]
  status: string
  departure_date: string
  window_start: string
  window_end: string
  notes?: string
}

interface RoutesTabProps {
  search: string
}

/* ─────────────────────────── Helpers ───────────────────────────── */

const VEHICLE_OPTIONS = ['motorbike', 'tricycle', 'sedan', 'mpv', 'minibus', 'coach']
const VEHICLE_LABELS: Record<string, string> = {
  motorbike: 'Motorbike', tricycle: 'Tricycle', sedan: 'Sedan',
  mpv: 'MPV', minibus: 'Minibus', coach: 'Coach',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  boarding:  { label: 'Boarding',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  loading:   { label: 'Loading',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  departed:  { label: 'Departed',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  en_route:  { label: 'En Route',  color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
  arrived:   { label: 'Arrived',   color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  completed: { label: 'Completed', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const isActive = (status: string) => !['completed', 'cancelled'].includes(status)

const fmtDate = (d: string) => {
  if (!d) return 'Date N/A'
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const groupRouteKey = (r: ScheduledRide) => {
  const origin = routeEndpointLabel(r, 'origin', true)
  const dest   = routeEndpointLabel(r, 'destination', true)
  return `${origin} → ${dest}`
}

/* ─────────────────────────── Component ─────────────────────────── */

export const RoutesTab: React.FC<RoutesTabProps> = ({ search }) => {
  const navigate = useNavigate()
  const { setRideCreationDraft } = useDispatchStore()
  const { routesCache, setRoutesCache, tabInitialized, setTabInitialized, refreshSeq } = useOperationsStore()

  const [routes, setRoutes] = useState<ScheduledRide[]>(routesCache as ScheduledRide[])
  const [loading, setLoading] = useState(!tabInitialized.routes)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // ── View state: null = group list, string = inside a group ────────
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  // ── Which ride/sheet is active inside a group ─────────────────────
  const [activeRideId, setActiveRideId] = useState<string | null>(null)
  const [activeRideDetail, setActiveRideDetail] = useState<any>(null)
  const [resolvingRide, setResolvingRide] = useState<ScheduledRide | null>(null)

  useEffect(() => {
    if (activeRideId) {
      setActiveRideDetail(null)
      apiService.getScheduledRideDetail(activeRideId).then(setActiveRideDetail).catch(console.error)
    }
  }, [activeRideId])

  // reset edit mode when changing sheet
  useEffect(() => { setInlineEdit(false) }, [activeRideId])

  // ── Inline edit mode ────────────────────────────────────────────
  const [inlineEdit, setInlineEdit] = useState(false)
  const [inlineForm, setInlineForm] = useState({
    departure_date: '',
    window_start: '',
    window_end: '',
    allowed_vehicle_types: [] as string[],
    notes: '',
  })
  const [inlineSaving, setInlineSaving] = useState(false)

  const startInlineEdit = (ride: ScheduledRide) => {
    setInlineForm({
      departure_date: ride.departure_date?.slice(0, 10) || '',
      window_start: ride.window_start?.slice(0, 5) || '',
      window_end: ride.window_end?.slice(0, 5) || '',
      allowed_vehicle_types: [...(ride.allowed_vehicle_types || [])],
      notes: ride.notes || '',
    })
    setInlineEdit(true)
  }

  const cancelInlineEdit = () => setInlineEdit(false)

  const saveInlineEdit = async (ride: ScheduledRide) => {
    setInlineSaving(true)
    try {
      const payload: Record<string, any> = {
        allowed_vehicle_types: inlineForm.allowed_vehicle_types,
        notes: inlineForm.notes,
      }

      // Only send time fields if the ride is still in 'scheduled' status
      // (not yet boarding/departed/etc.) AND the admin actually changed them.
      const isPreActive = ride.status === 'scheduled'
      if (isPreActive) {
        if (inlineForm.window_start && inlineForm.window_start !== ride.window_start?.slice(0, 5)) {
          payload.window_start = inlineForm.window_start + ':00'
        }
        if (inlineForm.window_end && inlineForm.window_end !== ride.window_end?.slice(0, 5)) {
          payload.window_end = inlineForm.window_end + ':00'
        }
      }

      await apiService.updateScheduledRide(ride.id, payload)
      await fetchRoutes()
      setInlineEdit(false)
    } catch (e: any) {
      alert('Save failed: ' + JSON.stringify(e?.response?.data || e?.message))
    } finally {
      setInlineSaving(false)
    }
  }

  // Save as Template: leaves current sheet untouched, creates new sheet with the inline edits
  const saveInlineAsTemplate = async (ride: ScheduledRide) => {
    setInlineSaving(true)
    try {
      await apiService.duplicateScheduledRide(ride.id, {
        departure_date: inlineForm.departure_date || ride.departure_date?.slice(0, 10),
        window_start: inlineForm.window_start,
        window_end: inlineForm.window_end,
        allowed_vehicle_types: inlineForm.allowed_vehicle_types,
        notes: inlineForm.notes,
      })
      await fetchRoutes()
      setInlineEdit(false)
    } catch (e: any) {
      alert('Save as template failed: ' + JSON.stringify(e?.response?.data || e?.message))
    } finally {
      setInlineSaving(false)
    }
  }

  // Save & Create: duplicate it using the inline form fields (same as template)
  const saveInlineAndCreate = async (ride: ScheduledRide) => {
    await saveInlineAsTemplate(ride)
  }

  // ── Edit Here drawer (legacy, still used by old code path) ───────
  const [editDrawer, setEditDrawer] = useState<ScheduledRide | null>(null)
  const [drawerStops, setDrawerStops] = useState<any[]>([])
  const [drawerStopsLoading, setDrawerStopsLoading] = useState(false)
  const [editForm, setEditForm] = useState({
    departure_date: '',
    window_start: '',
    window_end: '',
    allowed_vehicle_types: [] as string[],
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // ── Stops manager ─────────────────────────────────────────────────
  const [manageStopsRide, setManageStopsRide] = useState<ScheduledRide | null>(null)
  const [stopsLoading, setStopsLoading] = useState(false)
  const [stops, setStops] = useState<any[]>([])
  const [resolvingStopIndex, setResolvingStopIndex] = useState<number | null>(null)

  /* ── Fetch ── */
  const fetchRoutes = async () => {
    try {
      setLoading(true)
      const data = await apiService.getScheduledRides()
      setRoutes(data)
      setRoutesCache(data)
      setTabInitialized('routes', true)
    } catch (error) {
      console.error('Failed to fetch routes', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch once on first mount; skip if already cached
  useEffect(() => { if (!tabInitialized.routes) fetchRoutes() }, [])

  // Refresh when Refresh button is pressed
  useEffect(() => { if (refreshSeq > 0) fetchRoutes() }, [refreshSeq])

  /* ── Filtered + Grouped ── */
  const filteredRoutes = useMemo(() =>
    routes.filter((r) =>
      r.reference.toLowerCase().includes(search.toLowerCase()) ||
      routeEndpointLabel(r, 'origin').toLowerCase().includes(search.toLowerCase()) ||
      routeEndpointLabel(r, 'destination').toLowerCase().includes(search.toLowerCase()) ||
      r.origin_address.toLowerCase().includes(search.toLowerCase()) ||
      r.destination_address.toLowerCase().includes(search.toLowerCase())
    ),
  [routes, search])

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduledRide[]>()
    filteredRoutes.forEach((r) => {
      const key = groupRouteKey(r)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    map.forEach((arr) => {
      arr.sort((a, b) => {
        const aA = isActive(a.status) ? 1 : 0
        const bA = isActive(b.status) ? 1 : 0
        if (bA !== aA) return bA - aA
        return new Date(b.departure_date).getTime() - new Date(a.departure_date).getTime()
      })
    })
    return map
  }, [filteredRoutes])

  /* When entering a group, auto-select first ride */
  const openGroup = (groupKey: string) => {
    setActiveGroup(groupKey)
    const rides = grouped.get(groupKey) || []
    setActiveRideId(rides[0]?.id || null)
    setOpenMenuId(null)
  }

  const closeGroup = () => {
    setActiveGroup(null)
    setActiveRideId(null)
  }

  /* The currently displayed ride inside a group */
  const groupRides = activeGroup ? grouped.get(activeGroup) || [] : []
  const activeRide = groupRides.find(r => r.id === activeRideId) || groupRides[0] || null

  /* ── Edit Here ── */
  const openEditDrawer = async (ride: ScheduledRide) => {
    setEditDrawer(ride)
    setEditForm({
      departure_date: ride.departure_date || '',
      window_start: ride.window_start?.substring(0, 5) || '',
      window_end: ride.window_end?.substring(0, 5) || '',
      allowed_vehicle_types: ride.allowed_vehicle_types || [],
      notes: ride.notes || '',
    })
    setDrawerStopsLoading(true)
    try {
      const detail = await apiService.getScheduledRideDetail(ride.id)
      setDrawerStops(detail.stops || [])
    } catch { setDrawerStops([]) }
    finally { setDrawerStopsLoading(false) }
  }

  const validateWindow = () => {
    if (editForm.window_start && editForm.window_end) {
      const [sh, sm] = editForm.window_start.split(':').map(Number)
      const [eh, em] = editForm.window_end.split(':').map(Number)
      const diff = (eh * 60 + em) - (sh * 60 + sm)
      if (diff < 30) { alert('Departure window must be at least 30 minutes.'); return false }
      if (diff > 12 * 60) { alert('Departure window cannot exceed 12 hours.'); return false }
    }
    return true
  }

  const handleSaveTemplate = async () => {
    if (!editDrawer || !validateWindow()) return
    setSaving(true)
    try {
      await apiService.updateScheduledRide(editDrawer.id, {
        departure_date: editForm.departure_date || undefined,
        window_start: editForm.window_start ? `${editForm.window_start}:00` : undefined,
        window_end: editForm.window_end ? `${editForm.window_end}:00` : undefined,
        allowed_vehicle_types: editForm.allowed_vehicle_types.length ? editForm.allowed_vehicle_types : undefined,
        notes: editForm.notes || undefined,
      })
      setEditDrawer(null)
      await fetchRoutes()
    } catch (e: any) {
      const msg = e?.response?.data?.non_field_errors?.[0] || e?.response?.data?.window_end?.[0] || 'Save failed.'
      alert(`Error: ${msg}`)
    } finally { setSaving(false) }
  }

  const handleSaveAndCreate = async () => {
    // legacy function used by old UI
  }

  const confirmCreate = async () => {
    // legacy
  }

  /* ── Edit in Admin ── */
  const handleEditInAdmin = async (ride: ScheduledRide) => {
    try {
      const detail = await apiService.getScheduledRideDetail(ride.id)
      setRideCreationDraft({
        origin_address: detail.origin_address,
        origin_name: detail.origin_name,
        origin_latitude: detail.origin_latitude,
        origin_longitude: detail.origin_longitude,
        destination_address: detail.destination_address,
        destination_name: detail.destination_name,
        destination_latitude: detail.destination_latitude,
        destination_longitude: detail.destination_longitude,
        departure_date: detail.departure_date,
        window_start: detail.window_start?.substring(0, 5) || '',
        window_end: detail.window_end?.substring(0, 5) || '',
        allowed_vehicle_types: detail.allowed_vehicle_types || [],
        vehicle_size: detail.vehicle_size,
        stops: (detail.stops || []).map((s: any, i: number) => ({
          name: s.name, address: s.address,
          latitude: s.latitude, longitude: s.longitude, order: i + 1,
        })),
        notes: detail.notes || '',
        sourceReference: ride.reference,
      })
      navigate('/')
    } catch {
      alert('Could not load route details for editing.')
    }
  }

  /* ── Manage Stops ── */
  const handleManageStopsClick = async (ride: ScheduledRide) => {
    setManageStopsRide(ride)
    setStopsLoading(true)
    try {
      const details = await apiService.getScheduledRideDetail(ride.id)
      setStops(details.stops || [])
    } catch (e) { console.error(e) }
    finally { setStopsLoading(false) }
  }

  const handleSaveStops = async () => {
    if (!manageStopsRide) return
    if (stops.some(s => s.latitude == null || s.longitude == null || Number(s.latitude) === 0 || Number(s.longitude) === 0)) {
      alert('Resolve a map point for every stop before saving.')
      return
    }
    setSaving(true)
    try {
      const updatedStops = stops.map((s, i) => ({ ...s, order: i + 1 }))
      await apiService.updateScheduledRideStops(manageStopsRide.id, updatedStops)
      setManageStopsRide(null)
      fetchRoutes()
    } catch (e: any) {
      alert('Failed to save stops: ' + (e?.response?.data?.non_field_errors?.[0] || 'Check required fields'))
    } finally { setSaving(false) }
  }

  const resolveStopPoint = async (idx: number) => {
    const stop = stops[idx]
    const query = `${stop.address || stop.name || ''}`.trim()
    if (!query) { alert('Enter the stop address before resolving its point.'); return }
    setResolvingStopIndex(idx)
    try {
      const applyPoint = (lat: number, lng: number, address?: string) => {
        const next = [...stops]
        next[idx] = { ...next[idx], address: address || next[idx].address, latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) }
        setStops(next)
      }
      if ((window as any).google?.maps?.Geocoder) {
        await new Promise<void>((resolve, reject) => {
          const geocoder = new (window as any).google.maps.Geocoder()
          geocoder.geocode({ address: query }, (results: any[], status: string) => {
            if (status === 'OK' && results?.[0]?.geometry?.location) {
              const loc = results[0].geometry.location
              applyPoint(loc.lat(), loc.lng(), results[0].formatted_address)
              resolve()
            } else reject(new Error(status || 'Geocode failed'))
          })
        })
        return
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!data?.[0]) throw new Error('No matching point found')
      applyPoint(Number(data[0].lat), Number(data[0].lon), data[0].display_name)
    } catch (error: any) {
      alert(`Could not resolve stop point: ${error?.message || 'Try a more specific address.'}`)
    } finally { setResolvingStopIndex(null) }
  }

  /* ── Render ── */
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, color: T.textMuted }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
        Loading route library...
      </div>
    )
  }

  /* ════════════════════════════════════════════════════════════════════
     VIEW A: Group workbook (Excel-style) — shown when activeGroup != null
     ══════════════════════════════════════════════════════════════════ */
  const sm = activeRide ? (STATUS_META[activeRide.status] || STATUS_META.scheduled) : STATUS_META.scheduled

  return (
    <>
      {activeGroup && activeRide ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg }}>

        {/* ── Workbook header bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, background: T.bgPanel, flexShrink: 0 }}>
          <button
            onClick={closeGroup}
            style={{ ...campusPanel.btnSecondary, padding: '5px 10px', gap: 6, fontSize: 11 }}
          >
            <ArrowLeft size={13} /> All Routes
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeGroup}
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              {groupRides.length} ride{groupRides.length !== 1 ? 's' : ''} · {groupRides.filter(r => isActive(r.status)).length} active
            </div>
          </div>
        </div>

        {/* ── Ride detail content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0, ...campusPanel.thinScroll }}>

          {/* ── Main Card ── */}
          <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, overflow: 'hidden' }}>

            {/* Card header: status + date + ref + actions */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg, borderRadius: 999, padding: '4px 12px', border: `1px solid ${sm.color}33`, flexShrink: 0 }}>
                {sm.label}
              </span>
              <span style={{ fontSize: 11, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <Calendar size={12} /> {fmtDate(activeRide.departure_date)}
              </span>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>
                {activeRide.reference}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                <button style={{ ...campusPanel.btnSecondary, fontSize: 11, padding: '5px 10px' }} onClick={() => handleManageStopsClick(activeRide)}>
                  <Navigation size={12} /> Route
                </button>
                <button
                  style={{
                    ...campusPanel.btnSecondary, fontSize: 11, padding: '5px 10px',
                    ...(inlineEdit ? { color: T.accent, borderColor: `${T.accent}55` } : {})
                  }}
                  onClick={() => inlineEdit ? cancelInlineEdit() : startInlineEdit(activeRide)}
                >
                  <Edit2 size={12} /> {inlineEdit ? 'Cancel' : 'Edit'}
                </button>
                <button style={{ ...campusPanel.btnSecondary, fontSize: 11, padding: '5px 10px', color: T.accent, borderColor: `${T.accent}55` }} onClick={() => handleEditInAdmin(activeRide)}>
                  <ExternalLink size={12} /> Admin
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    style={{ ...campusPanel.btnSecondary, padding: '5px 8px' }}
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === activeRide.id ? null : activeRide.id) }}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {openMenuId === activeRide.id && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 4, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      <button style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: T.textSecondary, fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                        onClick={() => { setOpenMenuId(null); handleEditInAdmin(activeRide) }}>
                        <Copy size={12} /> Duplicate in Admin
                      </button>
                      {activeRide.status === 'cancelled' ? (
                        <button style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                          onClick={() => {
                            setOpenMenuId(null)
                            if (window.confirm(`Permanently delete ${activeRide.reference}? This cannot be undone.`)) {
                              apiService.hardDeleteScheduledRide(activeRide.id)
                                .then(() => {
                                  fetchRoutes();
                                  setActiveRideId(null);
                                })
                                .catch(err => alert(err.response?.data?.detail || 'Cannot delete this ride.'))
                            }
                          }}>
                          <Trash2 size={12} /> Delete Permanently
                        </button>
                      ) : (
                        <button style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                          onClick={() => {
                            setOpenMenuId(null)
                            setResolvingRide(activeRide)
                          }}>
                          <Trash2 size={12} /> {activeRide.passenger_count > 0 ? 'Resolve Ride' : 'Cancel Ride'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats / editable fields row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${T.border}` }}>
              {/* Vehicle — read-only stat */}
              <div style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted, fontSize: 9, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.6, marginBottom: 7 }}>
                  <Bus size={14} /> Vehicle
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>{activeRide.vehicle_size || 'Mixed'}</div>
              </div>
              {/* Stops */}
              <div style={{ padding: '14px 18px', borderLeft: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted, fontSize: 9, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.6, marginBottom: 7 }}>
                  <MapPin size={14} /> Stops
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>{activeRide.stops_count} locations</div>
              </div>
              {/* Date — editable */}
              <div style={{ padding: '14px 18px', borderLeft: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted, fontSize: 9, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.6, marginBottom: 7 }}>
                  <Calendar size={14} /> Date
                </div>
                {inlineEdit ? (
                  <input
                    type="date"
                    value={inlineForm.departure_date}
                    onChange={e => setInlineForm(f => ({ ...f, departure_date: e.target.value }))}
                    style={{ background: T.bgInput, border: `1px solid ${T.accent}44`, color: T.textPrimary, fontSize: 12, padding: '3px 6px', fontFamily: T.fontFamily, width: '100%', outline: 'none' }}
                  />
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{fmtDate(activeRide.departure_date)}</div>
                )}
              </div>
              {/* Window — editable */}
              <div style={{ padding: '14px 18px', borderLeft: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted, fontSize: 9, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.6, marginBottom: 7 }}>
                  <Clock size={14} /> Window
                </div>
                {inlineEdit ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="time" value={inlineForm.window_start}
                      onChange={e => setInlineForm(f => ({ ...f, window_start: e.target.value }))}
                      style={{ background: T.bgInput, border: `1px solid ${T.accent}44`, color: T.textPrimary, fontSize: 11, padding: '3px 5px', fontFamily: T.fontFamily, flex: 1, outline: 'none' }}
                    />
                    <span style={{ color: T.textMuted, fontSize: 11 }}>–</span>
                    <input type="time" value={inlineForm.window_end}
                      onChange={e => setInlineForm(f => ({ ...f, window_end: e.target.value }))}
                      style={{ background: T.bgInput, border: `1px solid ${T.accent}44`, color: T.textPrimary, fontSize: 11, padding: '3px 5px', fontFamily: T.fontFamily, flex: 1, outline: 'none' }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>
                    {activeRide.window_start?.substring(0, 5) || 'N/A'} – {activeRide.window_end?.substring(0, 5) || 'N/A'}
                  </div>
                )}
              </div>
            </div>

            {/* Route — Hybrid chip layout (Origin > Stop > Stop > Dest) */}
            <div style={{ borderBottom: `1px solid ${T.border}`, padding: '14px 18px' }}>
              <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.6, marginBottom: 10 }}>Route</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {/* Origin chip */}
                <div style={{ display: 'flex', flexDirection: 'column', background: `${T.accent}10`, border: `1px solid ${T.accent}33`, padding: '6px 10px', maxWidth: 180 }}>
                  <span style={{ fontSize: 8, color: T.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Origin</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>{routeEndpointLabel(activeRide, 'origin', true)}</span>
                  <span style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{activeRide.origin_address}</span>
                </div>
                {/* Stop chips */}
                {activeRideDetail?.stops?.filter((stop: any) => {
                  const isOrigin = stop.address === activeRide.origin_address || stop.name === routeEndpointLabel(activeRide, 'origin', true)
                  const isDest = stop.address === activeRide.destination_address || stop.name === routeEndpointLabel(activeRide, 'destination', true)
                  return !isOrigin && !isDest
                }).map((stop: any, idx: number) => (
                  <>
                    <ChevronRight key={`arr-${idx}`} size={14} color={T.textMuted} style={{ flexShrink: 0 }} />
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', background: T.bgInput, border: `1px solid ${T.border}`, padding: '6px 10px', maxWidth: 160 }}>
                      <span style={{ fontSize: 8, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stop {idx + 1}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginTop: 2 }}>{stop.name || `Stop ${idx + 1}`}</span>
                      <span style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{stop.address}</span>
                    </div>
                  </>
                ))}
                {/* Arrow to dest */}
                <ChevronRight size={14} color={T.textMuted} style={{ flexShrink: 0 }} />
                {/* Destination chip */}
                <div style={{ display: 'flex', flexDirection: 'column', background: `${T.accent}10`, border: `1px solid ${T.accent}33`, padding: '6px 10px', maxWidth: 180 }}>
                  <span style={{ fontSize: 8, color: T.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destination</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>{routeEndpointLabel(activeRide, 'destination', true)}</span>
                  <span style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{activeRide.destination_address}</span>
                </div>
              </div>
            </div>

            {/* Allowed vehicles */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.6 }}>Allowed Vehicles</span>
                {inlineEdit && activeRide.status !== 'scheduled' && (
                  <span style={{ fontSize: 9, color: '#f59e0b', fontStyle: 'italic' }}>You can add types, but not remove from an active ride</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {VEHICLE_OPTIONS.map(v => {
                  const allowed = inlineEdit
                    ? inlineForm.allowed_vehicle_types.includes(v)
                    : activeRide.allowed_vehicle_types?.includes(v)
                  // For active (non-scheduled) rides: types already in the original list are locked — cannot be removed
                  const isOriginallyAllowed = activeRide.allowed_vehicle_types?.includes(v) ?? false
                  const isCancelled = activeRide.status === 'cancelled'
                  const isLockedFromRemoval = inlineEdit && (isCancelled || (activeRide.status !== 'scheduled' && isOriginallyAllowed && allowed))
                  const toggleVehicle = () => {
                    if (!inlineEdit) return
                    // Block removal of existing types on active rides, and block anything if cancelled
                    if (isLockedFromRemoval || isCancelled) return
                    setInlineForm(f => ({
                      ...f,
                      allowed_vehicle_types: allowed
                        ? f.allowed_vehicle_types.filter(x => x !== v)
                        : [...f.allowed_vehicle_types, v]
                    }))
                  }
                  return (
                    <span
                      key={v}
                      onClick={toggleVehicle}
                      title={isCancelled ? 'Cannot edit cancelled rides' : (isLockedFromRemoval ? 'Cannot remove vehicle type from an active ride' : undefined)}
                      style={{
                        fontSize: 11, padding: '3px 10px',
                        background: allowed ? `${T.accent}12` : 'transparent',
                        border: allowed ? `1px solid ${T.accent}44` : `1px solid ${T.border}`,
                        color: allowed ? T.accent : T.textMuted,
                        fontWeight: allowed ? 600 : 400,
                        opacity: allowed ? 1 : 0.6,
                        cursor: inlineEdit ? (isCancelled || isLockedFromRemoval ? 'not-allowed' : 'pointer') : 'default',
                        transition: 'all 0.15s',
                        userSelect: 'none',
                      }}
                    >
                      {inlineEdit && <span style={{ marginRight: 4 }}>{allowed ? (isLockedFromRemoval ? '🔒' : '✓') : '○'}</span>}
                      {VEHICLE_LABELS[v] || v}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.6, marginBottom: 6 }}>Notes</div>
              {inlineEdit ? (
                <textarea
                  value={inlineForm.notes}
                  onChange={e => setInlineForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Add notes..."
                  style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.accent}44`, color: T.textPrimary, fontSize: 12, padding: '8px 10px', fontFamily: T.fontFamily, resize: 'vertical', outline: 'none', lineHeight: 1.6 }}
                />
              ) : activeRide.notes ? (
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>{activeRide.notes}</div>
              ) : (
                <div style={{ fontSize: 11, color: T.textMuted, fontStyle: 'italic' }}>No notes</div>
              )}
            </div>
          </div>
        </div>


        {/* ── Inline edit Save/Cancel bar (above sheet tabs) ── */}
        {inlineEdit && (
          <div style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderTop: `1px solid ${T.accent}55`,
            background: `${T.accent}08`,
          }}>
            <span style={{ fontSize: 11, color: T.accent, fontWeight: 600, flex: 1 }}>Editing — unsaved changes</span>
            <button
              onClick={cancelInlineEdit}
              style={{ ...campusPanel.btnSecondary, fontSize: 11, padding: '5px 14px' }}
            >
              Discard
            </button>
            <button
              onClick={() => saveInlineAsTemplate(activeRide)}
              disabled={inlineSaving}
              style={{ ...campusPanel.btnSecondary, fontSize: 11, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 5, opacity: inlineSaving ? 0.6 : 1 }}
            >
              <Save size={12} /> Save Template
            </button>
            <button
              onClick={() => saveInlineEdit(activeRide)}
              disabled={inlineSaving}
              style={{ ...campusPanel.btnSecondary, fontSize: 11, padding: '5px 14px', opacity: inlineSaving ? 0.6 : 1 }}
            >
              {inlineSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => saveInlineAndCreate(activeRide)}
              disabled={inlineSaving}
              style={{ ...campusPanel.btnPrimary, fontSize: 11, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 5, opacity: inlineSaving ? 0.6 : 1 }}
            >
              <Play size={12} /> Save & Create
            </button>
          </div>
        )}

        {/* ── Sheet navigation bar ── */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          borderTop: `1px solid ${T.border}`,
          background: T.bgPanel,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4, flexShrink: 0 }}>Sheets</span>
          {groupRides.map((ride, idx) => {
            const rsm = STATUS_META[ride.status] || STATUS_META.scheduled
            const isSelectedSheet = activeRideId === ride.id
            return (
              <button
                key={ride.id}
                onClick={() => setActiveRideId(ride.id)}
                title={`${ride.reference} – ${fmtDate(ride.departure_date)}`}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  background: isSelectedSheet ? T.bg : 'transparent',
                  border: `1px solid ${isSelectedSheet ? T.border : 'transparent'}`,
                  color: isSelectedSheet ? T.textPrimary : T.textMuted,
                  fontWeight: isSelectedSheet ? 700 : 400,
                  fontSize: 11,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: T.fontFamily,
                  transition: 'all 0.15s',
                  borderRadius: 2,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: rsm.color, flexShrink: 0 }} />
                Sheet{idx + 1}
                <span style={{ fontSize: 9, color: isSelectedSheet ? T.textMuted : 'transparent', marginLeft: 1 }}>
                  {new Date(ride.departure_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      ) : null}

      {/* ════════════════════════════════════════════════════════════════════
         VIEW B: Group cards list (default)
         ══════════════════════════════════════════════════════════════════ */}
      {!activeGroup && (
        <div style={{ padding: 0, marginTop: 4, flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {[...grouped.entries()].map(([groupKey, groupRides]) => {
              const activeCount = groupRides.filter(r => isActive(r.status)).length
              const latestRide = groupRides[0]
              const sm = latestRide ? (STATUS_META[latestRide.status] || STATUS_META.scheduled) : STATUS_META.scheduled
    
              return (
                <div
                  key={groupKey}
                  style={{ ...campusPanel.card, display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onClick={() => openGroup(groupKey)}
                >
                  <div style={{ ...campusPanel.cardBody, paddingBottom: 16 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 42, height: 42, flexShrink: 0, background: `${T.accent}15`, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Route size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, margin: 0, lineHeight: 1.4 }}>
                          {groupKey}
                        </h3>
                        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ background: T.bgInput, border: `1px solid ${T.border}`, padding: '1px 8px', fontSize: 10 }}>
                            {groupRides.length} ride{groupRides.length !== 1 ? 's' : ''}
                          </span>
                          {activeCount > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '1px 8px', border: '1px solid rgba(22,163,74,0.3)' }}>
                              {activeCount} active
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} color={T.textMuted} style={{ marginTop: 2, flexShrink: 0 }} />
                    </div>
    
                    {/* Latest ride preview */}
                    {latestRide && (
                      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Latest Status</div>
                          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: sm.color }}>{sm.label}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Next Departure</div>
                          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={10} /> {fmtDate(latestRide.departure_date)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Vehicle</div>
                          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: T.textPrimary }}>{latestRide.vehicle_size || 'Mixed'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Stops</div>
                          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: T.textPrimary }}>{latestRide.stops_count}</div>
                        </div>
                      </div>
                    )}
                  </div>
    
                  {/* Footer bar */}
                  <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px 16px', background: T.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: T.textMuted }}>
                      {groupRides.length} sheet{groupRides.length !== 1 ? 's' : ''} inside
                    </span>
                    <span style={{ fontSize: 10, color: T.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      Open <ChevronRight size={11} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
    
          {filteredRoutes.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
              <Route size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div>No routes found</div>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Here Drawer ─────────────────────────────────────────── */}
      {editDrawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={() => setEditDrawer(null)}>
          <div style={{ flex: 1 }} />
          <div
            style={{ width: 380, background: T.bgPanel, borderLeft: `1px solid ${T.border}`, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite }}>Edit Route</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>{editDrawer.reference} · Quick edit (no map required)</div>
              </div>
              <button onClick={() => setEditDrawer(null)} style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Route</div>
                <div style={{ background: T.bgInput, border: `1px solid ${T.border}`, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, color: T.textWhite, fontWeight: 600 }}>
                    {routeEndpointLabel(editDrawer, 'origin', true)} → {routeEndpointLabel(editDrawer, 'destination', true)}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Origin/destination require Admin map editor to change</div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Departure Date</label>
                <input type="date" value={editForm.departure_date}
                  onChange={e => setEditForm(p => ({ ...p, departure_date: e.target.value }))}
                  style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.border}`, padding: '8px 12px', color: T.textPrimary, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Departure Window</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>Start</div>
                    <input type="time" value={editForm.window_start} onChange={e => setEditForm(p => ({ ...p, window_start: e.target.value }))}
                      style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.border}`, padding: '8px 12px', color: T.textPrimary, fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>End</div>
                    <input type="time" value={editForm.window_end} onChange={e => setEditForm(p => ({ ...p, window_end: e.target.value }))}
                      style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.border}`, padding: '8px 12px', color: T.textPrimary, fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Allowed Vehicle Types</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {VEHICLE_OPTIONS.map(v => {
                    const selected = editForm.allowed_vehicle_types.includes(v)
                    return (
                      <button key={v}
                        style={{ fontSize: 11, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${selected ? T.accent : T.border}`, background: selected ? `${T.accent}15` : 'transparent', color: selected ? T.accent : T.textSecondary, fontWeight: selected ? 700 : 400 }}
                        onClick={() => setEditForm(p => ({
                          ...p,
                          allowed_vehicle_types: selected ? p.allowed_vehicle_types.filter(x => x !== v) : [...p.allowed_vehicle_types, v]
                        }))}>
                        {VEHICLE_LABELS[v]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Stops</label>
                {drawerStopsLoading ? (
                  <div style={{ color: T.textMuted, fontSize: 12 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading stops...</div>
                ) : drawerStops.length === 0 ? (
                  <div style={{ fontSize: 11, color: T.textMuted, background: T.bgInput, border: `1px solid ${T.border}`, padding: '8px 12px' }}>No intermediate stops</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {drawerStops.map((stop, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgInput, border: `1px solid ${T.border}`, padding: '8px 10px' }}>
                        <MapPin size={11} color={T.textMuted} />
                        <div style={{ flex: 1, fontSize: 11, color: T.textPrimary, fontWeight: 600 }}>{stop.name || stop.address || `Stop ${idx + 1}`}</div>
                        <button onClick={() => setDrawerStops(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7, padding: 2 }}><X size={12} /></button>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Use "Route" → Manage Route to add stops (map required)</div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Internal notes about this route..." rows={3}
                  style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.border}`, padding: '8px 12px', color: T.textPrimary, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, flexShrink: 0, background: T.bgInput }}>
              <button onClick={() => setEditDrawer(null)} style={{ ...campusPanel.btnSecondary, flex: 1, justifyContent: 'center', background: 'transparent' }}>Cancel</button>
              <button onClick={handleSaveTemplate} disabled={saving} style={{ ...campusPanel.btnSecondary, flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                Save Template
              </button>
              <button onClick={() => saveInlineAsTemplate(editDrawer)} disabled={saving} style={{ ...campusPanel.btnPrimary, flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                <Play size={13} /> Save & Create
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ── Manage Stops Modal ── */}
      {manageStopsRide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, width: 500, maxWidth: '90vw', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: T.textPrimary }}>Manage Stops</h2>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{manageStopsRide.reference}</div>
              </div>
              <button onClick={() => setManageStopsRide(null)} style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
              {stopsLoading ? (
                <div style={{ color: T.textMuted, textAlign: 'center', padding: 20 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
              ) : (
                <>
                  {stops.map((stop, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center', background: T.bgInput, padding: 12, border: `1px solid ${T.border}` }}>
                      <div style={{ color: T.textMuted, fontWeight: 600, fontSize: 12 }}>{idx + 1}</div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input type="text" value={stop.name || ''} placeholder="Stop Name (e.g. Main Gate)"
                          onChange={e => { const s = [...stops]; s[idx].name = e.target.value; setStops(s) }}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: T.textPrimary, fontSize: 13, outline: 'none' }} />
                        <input type="text" value={stop.address || ''} placeholder="Full Address"
                          onChange={e => { const s = [...stops]; s[idx].address = e.target.value; setStops(s) }}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 11, padding: '4px 8px', outline: 'none' }} />
                        <div style={{ fontSize: 10, color: stop.latitude && stop.longitude ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>
                          {stop.latitude && stop.longitude ? 'Point resolved' : 'Point required'}
                        </div>
                      </div>
                      <button onClick={() => resolveStopPoint(idx)} disabled={resolvingStopIndex === idx}
                        style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.textMuted, cursor: 'pointer', opacity: resolvingStopIndex === idx ? 0.6 : 1, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {resolvingStopIndex === idx ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Crosshair size={14} />}
                      </button>
                      <button onClick={() => { const s = [...stops]; s.splice(idx, 1); setStops(s) }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => setStops([...stops, { order: stops.length + 1, name: '', address: '' }])} style={{ ...campusPanel.btnSecondary, marginTop: 8, alignSelf: 'flex-start' }}>
                    <Plus size={14} /> Add Stop
                  </button>
                </>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 12, background: T.bgInput }}>
              <button onClick={() => setManageStopsRide(null)} style={{ ...campusPanel.btnSecondary, background: 'transparent' }}>Cancel</button>
              <button onClick={handleSaveStops} disabled={saving || stopsLoading} style={{ ...campusPanel.btnPrimary, opacity: (saving || stopsLoading) ? 0.7 : 1 }}>
                {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : 'Save Stops'}
              </button>
            </div>
          </div>
        </div>
      )}

      {openMenuId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenMenuId(null)} />
      )}

      {resolvingRide && (
        <RideResolutionModal 
          ride={resolvingRide}
          onClose={() => setResolvingRide(null)}
          onResolved={() => {
            setResolvingRide(null)
            fetchRoutes()
            setActiveRideId(null)
          }}
        />
      )}
    </>
  )
}

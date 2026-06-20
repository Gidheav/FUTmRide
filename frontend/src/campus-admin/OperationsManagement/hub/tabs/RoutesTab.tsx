import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Map, MoreVertical, Route, Navigation, Bus, Users, Clock, Loader2, X, Crosshair } from 'lucide-react'
import { campusPanel } from '../../../shared/campusPanelStyles'
import { T } from '../../../theme'
import { apiService } from '../../../../services/api.service'
import { useDispatchStore } from '../../../dispatchStore'
import { routeEndpointLabel } from '../../../shared/routeDisplay'

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
  status: string
  departure_date: string
  window_start: string
  window_end: string
}

interface RoutesTabProps {
  search: string
}

export const RoutesTab: React.FC<RoutesTabProps> = ({ search }) => {
  const [routes, setRoutes] = useState<ScheduledRide[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { setActiveTab } = useDispatchStore()

  // Edit Modal State
  const [editRide, setEditRide] = useState<ScheduledRide | null>(null)
  const [editForm, setEditForm] = useState({ window_start: '', window_end: '' })
  const [saving, setSaving] = useState(false)

  // Stops Modal State
  const [manageStopsRide, setManageStopsRide] = useState<ScheduledRide | null>(null)
  const [stopsLoading, setStopsLoading] = useState(false)
  const [stops, setStops] = useState<any[]>([])
  const [resolvingStopIndex, setResolvingStopIndex] = useState<number | null>(null)

  const fetchRoutes = async () => {
    try {
      setLoading(true)
      const data = await apiService.getScheduledRides()
      setRoutes(data)
    } catch (error) {
      console.error('Failed to fetch routes', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoutes()
  }, [])

  const handleManageStopsClick = async (ride: ScheduledRide) => {
    setManageStopsRide(ride)
    setStopsLoading(true)
    try {
      const details = await apiService.getScheduledRideDetail(ride.id)
      setStops(details.stops || [])
    } catch (e) {
      console.error(e)
    } finally {
      setStopsLoading(false)
    }
  }

  const handleSaveStops = async () => {
    if (!manageStopsRide) return
    if (stops.some(stop => stop.latitude == null || stop.longitude == null || Number(stop.latitude) === 0 || Number(stop.longitude) === 0)) {
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
    } finally {
      setSaving(false)
    }
  }

  const resolveStopPoint = async (idx: number) => {
    const stop = stops[idx]
    const query = `${stop.address || stop.name || ''}`.trim()
    if (!query) {
      alert('Enter the stop address before resolving its point.')
      return
    }

    setResolvingStopIndex(idx)
    try {
      const applyPoint = (lat: number, lng: number, address?: string) => {
        const next = [...stops]
        next[idx] = {
          ...next[idx],
          address: address || next[idx].address,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
        }
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
            } else {
              reject(new Error(status || 'Geocode failed'))
            }
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
    } finally {
      setResolvingStopIndex(null)
    }
  }

  const handleEditClick = (ride: ScheduledRide) => {
    setEditRide(ride)
    setEditForm({
      window_start: ride.window_start?.substring(0, 5) || '',
      window_end: ride.window_end?.substring(0, 5) || ''
    })
  }

  const handleSaveEdit = async () => {
    if (!editRide) return

    if (editForm.window_start && editForm.window_end) {
      const [sh, sm] = editForm.window_start.split(':').map(Number)
      const [eh, em] = editForm.window_end.split(':').map(Number)
      const startMin = sh * 60 + sm
      const endMin = eh * 60 + em
      
      const diff = endMin - startMin
      if (diff < 30) {
        alert('Error: Departure window must be at least 30 minutes.')
        return
      }
      if (diff > 12 * 60) {
        alert('Error: Departure window cannot exceed 12 hours.')
        return
      }
    }

    setSaving(true)
    try {
      await apiService.updateScheduledRide(editRide.id, {
        window_start: editForm.window_start ? `${editForm.window_start}:00` : undefined,
        window_end: editForm.window_end ? `${editForm.window_end}:00` : undefined
      })
      setEditRide(null)
      await fetchRoutes()
    } catch (error: any) {
      console.error('Failed to update ride', error)
      const msg = error?.response?.data?.window_end?.[0] || error?.response?.data?.window_start?.[0] || 'Failed to update scheduled time.'
      alert(`Error: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const filteredRoutes = routes.filter((r: ScheduledRide) => 
    r.reference.toLowerCase().includes(search.toLowerCase()) || 
    routeEndpointLabel(r, 'origin').toLowerCase().includes(search.toLowerCase()) ||
    routeEndpointLabel(r, 'destination').toLowerCase().includes(search.toLowerCase()) ||
    r.origin_address.toLowerCase().includes(search.toLowerCase()) ||
    r.destination_address.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, color: T.textMuted }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
        Loading active routes...
      </div>
    )
  }

  return (
    <div style={{ padding: 0, marginTop: 4, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
        {filteredRoutes.map((route: ScheduledRide) => {
          const isActive = !['completed', 'cancelled'].includes(route.status)
          const mockFleet = Math.max(1, Math.floor(route.passenger_count / 50)) // Mock fleet count
          return (
            <div key={route.id} style={{ ...campusPanel.card, display: 'flex', flexDirection: 'column' }}>
              <div style={{ ...campusPanel.cardBody, paddingBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 8, background: `${T.accent}15`, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Map size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {routeEndpointLabel(route, 'origin', true)} → {routeEndpointLabel(route, 'destination', true)}
                      </h3>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{route.reference}</span>
                        <span>•</span>
                        <span style={{ color: isActive ? '#16a34a' : T.textMuted, fontWeight: 600 }}>{isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  </div>
                  <button style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', flexShrink: 0 }}>
                    <MoreVertical size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                      <Bus size={11} /> Active Fleet
                    </div>
                    <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, marginTop: 4 }}>{mockFleet} vehicles</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                      <Route size={11} /> Stops
                    </div>
                    <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, marginTop: 4 }}>{route.stops_count} locations</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                      <Users size={11} /> Passengers
                    </div>
                    <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, marginTop: 4 }}>{route.passenger_count} pax</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                      <Clock size={11} /> Scheduled
                    </div>
                    <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, marginTop: 4 }}>{route.window_start?.substring(0, 5) || 'N/A'}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 'auto', borderTop: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: T.bgInput }}>
                <button 
                  style={{ ...campusPanel.btnSecondary, fontSize: 11, padding: '6px 12px' }} 
                  onClick={() => handleManageStopsClick(route)}
                >
                  <Navigation size={12} /> Manage Route
                </button>
                <button style={{ ...campusPanel.btnSecondary, fontSize: 11, padding: '6px 12px' }} onClick={() => handleEditClick(route)}><Edit2 size={12} /> Edit</button>
              </div>
            </div>
          )
        })}
      </div>

      {editRide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 12, width: 400, maxWidth: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.textWhite, margin: 0 }}>Edit Route Details</h3>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{editRide.reference}</div>
              </div>
              <button onClick={() => setEditRide(null)} style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer' }}><X size={16} /></button>
            </div>
            
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Window Start</label>
                  <input 
                    type="time" 
                    value={editForm.window_start}
                    onChange={e => setEditForm((p: any) => ({ ...p, window_start: e.target.value }))}
                    style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 12px', color: T.textPrimary, fontSize: 13, fontFamily: 'monospace' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Window End</label>
                  <input 
                    type="time" 
                    value={editForm.window_end}
                    onChange={e => setEditForm((p: any) => ({ ...p, window_end: e.target.value }))}
                    style={{ width: '100%', background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 12px', color: T.textPrimary, fontSize: 13, fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>Stops (Read Only)</label>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 12px', color: T.textMuted, fontSize: 13 }}>
                  {editRide.stops_count} locations
                  <div style={{ fontSize: 10, marginTop: 4, color: T.textSecondary }}>Use "Manage Route" to add or remove physical stops.</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 12, background: T.bgInput }}>
              <button onClick={() => setEditRide(null)} style={{ ...campusPanel.btnSecondary, background: 'transparent' }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving} style={{ ...campusPanel.btnPrimary, opacity: saving ? 0.7 : 1 }}>
                {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Stops Modal */}
      {manageStopsRide && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: T.bg, borderRadius: 12, border: `1px solid ${T.border}`, width: 500, maxWidth: '90vw', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
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
                    <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center', background: T.bgInput, padding: 12, borderRadius: 6, border: `1px solid ${T.border}` }}>
                      <div style={{ color: T.textMuted, fontWeight: 600, fontSize: 12 }}>{idx + 1}</div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input
                          type="text"
                          value={stop.name || ''}
                          placeholder="Stop Name (e.g. Main Gate)"
                          onChange={e => { const s = [...stops]; s[idx].name = e.target.value; setStops(s) }}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: T.textPrimary, fontSize: 13, outline: 'none' }}
                        />
                        <input
                          type="text"
                          value={stop.address || ''}
                          placeholder="Full Address"
                          onChange={e => { const s = [...stops]; s[idx].address = e.target.value; setStops(s) }}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', color: T.textMuted, fontSize: 11, padding: '4px 8px', borderRadius: 4, outline: 'none' }}
                        />
                        <div style={{ fontSize: 10, color: stop.latitude && stop.longitude ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>
                          {stop.latitude && stop.longitude ? 'Point resolved' : 'Point required'}
                        </div>
                      </div>
                      <button
                        onClick={() => resolveStopPoint(idx)}
                        disabled={resolvingStopIndex === idx}
                        style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.textMuted, cursor: 'pointer', opacity: resolvingStopIndex === idx ? 0.6 : 1, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Resolve map point"
                      >
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
    </div>
  )
}

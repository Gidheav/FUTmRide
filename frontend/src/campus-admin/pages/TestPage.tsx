import { useEffect, useMemo, useState, useCallback, type CSSProperties, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCog,
  UserPlus,
  Users,
  Map as MapIcon,
  Globe,
} from 'lucide-react'
import { GoogleMap, useJsApiLoader, Marker, MapMouseEvent } from '@react-google-maps/api'
import apiService from '../../services/api.service'
import { T } from '../theme'
import { campusPanel } from '../shared/campusPanelStyles'

type TestRide = {
  id: string
  reference: string
  route: string
  departure_date?: string
  window?: string
  status: string
  vehicle_size?: string
  vehicle_type?: string
  passenger_count: number
  driver?: string | null
  student?: string
}

type TestSummary = {
  enabled: boolean
  campus?: string | null
  counts: {
    students: number
    drivers: number
    admins: number
    scheduled_rides: number
    ondemand_rides: number
  }
  rides: TestRide[]
  ondemand_rides: TestRide[]
}

type ResultState = {
  title: string
  payload: unknown
  isError?: boolean
}

const readError = (error: unknown) => {
  const err = error as any
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.detail ||
    err?.message ||
    'The request failed.'
  )
}

const clampCount = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return 1
  return Math.min(2000, Math.max(1, parsed))
}

const GMAP_LIBS: ('drawing' | 'geometry' | 'places')[] = ['drawing', 'geometry', 'places']

// Haversine distance in metres between two lat/lng points
const haversineM = (a: {lat:number,lng:number}, b: {lat:number,lng:number}) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const aVal = sinDLat * sinDLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinDLng * sinDLng
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
}

export default function TestPage() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: GMAP_LIBS,
  })
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const queryArea = searchParams.get('area')
  const area = queryArea === 'rides' ? 'rides' : queryArea === 'map' ? 'map' : 'account'
  const defaultSection = area === 'rides' ? 'create' : area === 'map' ? 'manage' : 'student'
  const section = searchParams.get('section') || defaultSection
  const [counts, setCounts] = useState({
    student: '10',
    driver: '10',
    admin: '2',
    rides: '25',
    deleteRides: '5',
    join: '20',
    ondemandRides: '10',
    deleteOnDemand: '5',
  })
  const [selectedRideId, setSelectedRideId] = useState('')
  const [result, setResult] = useState<ResultState | null>(null)
  const [jsonInput, setJsonInput] = useState('')
  const [mapEditorBanner, setMapEditorBanner] = useState(false)
  
  const [sidebarTab, setSidebarTab] = useState<'builder' | 'locations' | 'console'>('builder')
  const [editorLocations, setEditorLocations] = useState<any[]>([])
  const [draftLocation, setDraftLocation] = useState<{lat: number, lng: number, name: string, category: string, id: string} | null>(null)

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!e.latLng || sidebarTab !== 'builder') return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    const newPoint = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }
    
    // 5 m dedup: skip if any existing location is within 5 metres
    const tooClose = editorLocations.some(loc => haversineM(newPoint, { lat: loc.lat, lng: loc.lng }) <= 5)
    if (tooClose) return
    
    const idStr = `loc_${Math.random().toString(36).substring(2, 8)}`
    setEditorLocations(prev => [...prev, { ...newPoint, name: '', category: 'gate', id: idStr }])
    setDraftLocation({ ...newPoint, name: '', category: 'gate', id: idStr })
  }, [sidebarTab, editorLocations])
  const [labError, setLabError] = useState<string | null>(null)
  const [labSuccess, setLabSuccess] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false)

  // Auto-load from Map Editor via sessionStorage
  useEffect(() => {
    if (area === 'map') {
      const stored = sessionStorage.getItem('map_editor_locations')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setJsonInput(JSON.stringify(parsed, null, 2))
          setMapEditorBanner(true)
          sessionStorage.removeItem('map_editor_locations')
        } catch {
          // ignore malformed
        }
      }
    }
  }, [area])

  const summaryQuery = useQuery<TestSummary>({
    queryKey: ['test-tools-summary'],
    queryFn: () => apiService.getTestToolsSummary(),
    refetchOnWindowFocus: false,
  })

  const summary = summaryQuery.data
  const rides = summary?.rides || []
  const ondemandRides = summary?.ondemand_rides || []
  const selectedRide = useMemo(
    () => rides.find((ride) => ride.id === selectedRideId) || rides[0],
    [rides, selectedRideId],
  )

  const switchSection = (nextSection: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('area', area)
    params.set('section', nextSection)
    setSearchParams(params)
  }

  const setArea = (nextArea: 'account' | 'rides' | 'map') => {
    const params = new URLSearchParams()
    params.set('area', nextArea)
    params.set('section', nextArea === 'rides' ? 'create' : nextArea === 'map' ? 'manage' : 'student')
    setSearchParams(params)
  }

  const runAction = useMutation({
    mutationFn: async (action: string) => {
      const actionMap: Record<string, () => Promise<unknown>> = {
        createStudents: () => apiService.createTestStudents(clampCount(counts.student)),
        deleteStudents: () => apiService.deleteTestStudents(clampCount(counts.student)),
        createDrivers: () => apiService.createTestDrivers(clampCount(counts.driver)),
        deleteDrivers: () => apiService.deleteTestDrivers(clampCount(counts.driver)),
        createAdmins: () => apiService.createTestAdmins(clampCount(counts.admin)),
        deleteAdmins: () => apiService.deleteTestAdmins(clampCount(counts.admin)),
        createRides: () => apiService.createTestScheduledRides(clampCount(counts.rides)),
        deleteRides: () => apiService.deleteTestScheduledRides(clampCount(counts.deleteRides)),
        joinRide: () => apiService.joinTestScheduledRide(selectedRide?.id || '', clampCount(counts.join)),
        createOnDemand: () => apiService.createTestOnDemandRides(clampCount(counts.ondemandRides)),
        deleteOnDemand: () => apiService.deleteTestOnDemandRides(clampCount(counts.deleteOnDemand)),
        importLocations: () => {
          let data;
          try { data = JSON.parse(jsonInput) } catch (err) { throw new Error('Invalid JSON array') }
          return apiService.importLocations(data)
        },
        publishLocations: () => apiService.publishLocations(),
      }
      if (action === 'joinRide' && !selectedRide?.id) {
        throw new Error('Select or create a scheduled ride first.')
      }
      return actionMap[action]()
    },
    onSuccess: async (payload, action) => {
      setResult({ title: actionLabel(action), payload })
      await queryClient.invalidateQueries({ queryKey: ['test-tools-summary'] })
    },
    onError: (error, action) => {
      setResult({
        title: `${actionLabel(action)} failed`,
        payload: { message: readError(error), raw: (error as any)?.response?.data },
        isError: true,
      })
    },
  })

  const busy = runAction.isPending

  return (
    <div style={{ ...campusPanel.shell, position: 'relative', overflow: 'hidden', padding: 0 }}>
      <style>{'@keyframes test-spin { to { transform: rotate(360deg); } }'}</style>
      
      {isLoaded && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: 9.53, lng: 6.45 }}
            zoom={15}
            options={{ disableDefaultUI: true, mapId: '3fa6c5fb12b509bc' }}
            onClick={handleMapClick}
          >
            {editorLocations.map((loc, idx) => (
              <Marker
                key={loc.id || idx}
                position={{ lat: loc.lat, lng: loc.lng }}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE,
                  scale: 6,
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.9,
                  strokeWeight: 2,
                  strokeColor: '#fff',
                }}
              />
            ))}
            {draftLocation && (
              <Marker
                position={{ lat: draftLocation.lat, lng: draftLocation.lng }}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE,
                  scale: 8,
                  fillColor: '#eab308',
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: '#000',
                }}
                zIndex={100}
              />
            )}
          </GoogleMap>
        </div>
      )}

      <div style={{ ...campusPanel.scrollMain, ...campusPanel.thinScroll, padding: 16, position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
        <div style={{ ...s.contentGrid, pointerEvents: 'auto' }}>
          <div style={s.contentCol}>
            
            {area !== 'map' && (
              <div style={s.stats}>
                <Stat label="Campus" value={summary?.campus || 'Unavailable'} />
                <Stat label="Students" value={summary?.counts.students ?? 0} />
                <Stat label="Drivers" value={summary?.counts.drivers ?? 0} />
                <Stat label="Admins" value={summary?.counts.admins ?? 0} />
                <Stat label="Schedules" value={summary?.counts.scheduled_rides ?? 0} />
                <Stat label="On-Demand" value={summary?.counts.ondemand_rides ?? 0} />
              </div>
            )}

            <div style={campusPanel.card}>
              {area === 'map' ? (
                <>
              <div style={s.subTabs}>
                <button style={subTabStyle(sidebarTab === 'builder')} onClick={() => setSidebarTab('builder')}>Builder</button>
                <button style={subTabStyle(sidebarTab === 'locations')} onClick={() => setSidebarTab('locations')}>Locations</button>
                <button style={subTabStyle(sidebarTab === 'console')} onClick={() => setSidebarTab('console')}>Console</button>
              </div>

              {sidebarTab === 'builder' && (
                <div style={{ flex: 1, padding: 16 }}>
                  <PanelTitle icon={<MapPin size={16} />} title="Location Builder" />
                  <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12, marginTop: 0 }}>
                    Click the map to place pins. Pins within 5m of each other are deduplicated. When finished, you can copy the JSON to import.
                  </p>
                  
                  {draftLocation && (
                    <div style={{ background: T.bgInput, border: `1px solid ${T.accent}44`, borderRadius: 6, padding: 12, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: T.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={12} /> Editing last pin
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3 }}>NAME *</div>
                        <input
                          autoFocus
                          style={{ ...s.input, padding: '5px 8px' }}
                          value={draftLocation.name}
                          onChange={e => {
                            const updated = { ...draftLocation, name: e.target.value }
                            setDraftLocation(updated)
                            setEditorLocations(prev => prev.map(l => l.id === draftLocation.id ? { ...l, name: e.target.value } : l))
                          }}
                          placeholder="e.g. Main Gate"
                        />
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3 }}>ID</div>
                        <input
                          style={{ ...s.input, padding: '5px 8px' }}
                          value={draftLocation.id}
                          onChange={e => {
                            const updated = { ...draftLocation, id: e.target.value }
                            setDraftLocation(updated)
                            setEditorLocations(prev => prev.map(l => l.id === draftLocation.id ? { ...l, id: e.target.value } : l))
                          }}
                          placeholder="e.g. loc_main_gate"
                        />
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3 }}>CATEGORY</div>
                        <select
                          style={{ ...s.input, padding: '5px 8px' }}
                          value={draftLocation.category}
                          onChange={e => {
                            const updated = { ...draftLocation, category: e.target.value }
                            setDraftLocation(updated)
                            setEditorLocations(prev => prev.map(l => l.id === draftLocation.id ? { ...l, category: e.target.value } : l))
                          }}
                        >
                          <option value="lecture">Lecture Theatre</option>
                          <option value="hostel">Hostel</option>
                          <option value="gate">Gate</option>
                          <option value="library">Library</option>
                          <option value="blocks">Admin / General Block</option>
                          <option value="medical">Medical Centre</option>
                          <option value="sports">Sports Facility</option>
                          <option value="ict">ICT Centre</option>
                          <option value="canteen">Canteen / Cafeteria</option>
                          <option value="mosque">Mosque</option>
                          <option value="laboratory">Laboratory</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button
                          style={{ ...campusPanel.btnPrimary, flex: 1, padding: '6px 0', fontSize: 11 }}
                          onClick={() => setDraftLocation(null)}
                        >Done</button>
                        <button
                          style={s.dangerButton}
                          onClick={() => {
                            setEditorLocations(prev => prev.filter(l => l.id !== draftLocation.id))
                            setDraftLocation(null)
                          }}
                        ><Trash2 size={12} /></button>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: T.textPrimary, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pinned ({editorLocations.length})</span>
                  </div>
                  {editorLocations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 10px', color: T.textMuted, border: `2px dashed ${T.border}`, borderRadius: 6 }}>
                      <MapPin size={22} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                      No pins yet.<br/>Click the map to start building locations.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {editorLocations.slice().reverse().map((loc, idx) => (
                        <div key={loc.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgInput, padding: '6px 10px', borderRadius: 4, border: `1px solid ${T.border}` }}>
                          <MapPin size={14} color={T.accent} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name || 'Unnamed'}</div>
                            <div style={{ fontSize: 9, color: T.textMuted }}>{loc.category} &bull; {loc.lat}, {loc.lng}</div>
                          </div>
                          <button
                            style={{ background: 'transparent', border: 'none', color: T.error, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            onClick={() => {
                              setEditorLocations(prev => prev.filter(l => l.id !== loc.id))
                              if (draftLocation?.id === loc.id) setDraftLocation(null)
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {editorLocations.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <button 
                        style={{ ...campusPanel.btnSecondary, width: '100%' }}
                        onClick={() => {
                          setJsonInput(JSON.stringify(editorLocations, null, 2))
                          setSidebarTab('locations')
                        }}
                      >
                        Copy {editorLocations.length} pins to JSON Importer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === 'locations' && (
                <div style={campusPanel.cardBody}>
                  <PanelTitle icon={<Globe size={16} />} title="Publish Location Data" />
                  <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 16, marginTop: 0 }}>
                    Publish a new optimized snapshot of all currently imported campus locations. The mobile app detects and downloads this update automatically.
                  </p>
                  <div style={s.buttonRow}>
                    <button
                      style={campusPanel.btnPrimary}
                      onClick={() => runAction.mutate('publishLocations')}
                      disabled={busy}
                    >
                      {busy ? <Loader2 size={13} style={s.spin} /> : <UploadCloud size={13} />}
                      Publish New Snapshot
                    </button>
                  </div>

                  <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
                    <PanelTitle icon={<MapIcon size={16} />} title="Bulk Import Locations" />
                    <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12, marginTop: 0 }}>
                      Paste or review a JSON array of locations to seed/update the database, then publish when ready.
                    </p>

                    {/* Error / success inline banners */}
                    {labError && (
                      <div style={{ background: '#7f1d1d22', border: `1px solid #ef4444`, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#ef4444', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{labError}</div>
                        <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0, marginLeft: 8 }} onClick={() => setLabError(null)}>✕</button>
                      </div>
                    )}
                    {labSuccess && (
                      <div style={{ background: '#14532d22', border: `1px solid #22c55e`, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#22c55e', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{labSuccess}</span>
                        <button style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: 14, padding: 0 }} onClick={() => setLabSuccess(null)}>✕</button>
                      </div>
                    )}

                    <textarea
                      style={{ ...s.input, minHeight: 220, resize: 'vertical', fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: 11 }}
                      placeholder='[{"id": "loc_1", "name": "Main Gate", "latitude": 9.53, "longitude": 6.45, "category": "gate"}]'
                      value={jsonInput}
                      onChange={(e) => { setJsonInput(e.target.value); setLabError(null); setLabSuccess(null) }}
                    />

                    {/* Live parse indicator */}
                    {jsonInput.trim() && (() => {
                      try {
                        const arr = JSON.parse(jsonInput)
                        if (!Array.isArray(arr)) return <div style={{ fontSize: 11, color: '#f97316', marginTop: 6 }}>⚠ JSON must be an array (got {typeof arr})</div>
                        return <div style={{ fontSize: 11, color: '#22c55e', marginTop: 6 }}>✓ Valid JSON — {arr.length} location(s) ready to import</div>
                      } catch (e: any) {
                        return <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>✗ Parse error: {e.message}</div>
                      }
                    })()}

                    <div style={{ ...s.buttonRow, marginTop: 12, gap: 8 }}>
                      <button
                        style={{ ...campusPanel.btnSecondary, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        disabled={isImporting || isPublishing}
                        onClick={async () => {
                          if (!window.confirm("Are you sure you want to completely wipe the locations database? This will clear all existing locations so you can start fresh.")) return;
                          setLabError(null)
                          setLabSuccess(null)
                          setIsImporting(true)
                          try {
                            const res = await apiService.wipeLocations()
                            setHasUnpublishedChanges(false)
                            setLabSuccess(`✓ Wiped ${res?.count ?? '?'} location(s). Database is now empty.`)
                          } catch (e: any) {
                            setLabError(`Wipe failed: ${e.message}`)
                          } finally {
                            setIsImporting(false)
                          }
                        }}
                      >
                        <Trash2 size={13} /> Wipe DB
                      </button>

                      <button
                        style={campusPanel.btnSecondary}
                        disabled={isImporting || !jsonInput.trim()}
                        onClick={async () => {
                          setLabError(null)
                          setLabSuccess(null)
                          let data: unknown[]
                          try { data = JSON.parse(jsonInput) } catch (e: any) { setLabError(`JSON parse error: ${e.message}`); return }
                          if (!Array.isArray(data)) { setLabError('The JSON must be an array of location objects.'); return }
                          setIsImporting(true)
                          try {
                            const res = await apiService.importLocations(data)
                            setHasUnpublishedChanges(true)
                            
                            const inactiveCount = data.filter((d: any) => d.is_active === false).length
                            const msg = inactiveCount > 0 
                              ? `✓ Imported ${res?.created ?? '?'} new, ${res?.updated ?? '?'} updated. (Note: ${inactiveCount} are marked is_active:false and won't publish)`
                              : `✓ Imported ${res?.created ?? '?'} new, ${res?.updated ?? '?'} updated. You can now Publish.`
                              
                            setLabSuccess(msg)
                          } catch (e: any) {
                            const errData = e?.response?.data
                            let msg = errData?.detail || errData?.error || errData?.message
                            if (!msg && errData && typeof errData === 'object') {
                              msg = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
                            }
                            setLabError(`Import failed: ${msg || e.message || 'Unknown error'}`)
                          } finally {
                            setIsImporting(false)
                          }
                        }}
                      >
                        {isImporting ? <Loader2 size={13} style={s.spin} /> : <CheckCircle2 size={13} />}
                        {isImporting ? 'Importing…' : 'Import JSON'}
                      </button>

                      <button
                        style={hasUnpublishedChanges ? campusPanel.btnPrimary : { ...campusPanel.btnPrimary, opacity: 0.5 }}
                        disabled={isPublishing || !hasUnpublishedChanges}
                        onClick={async () => {
                          setLabError(null)
                          setLabSuccess(null)
                          setIsPublishing(true)
                          try {
                            const res = await apiService.publishLocations()
                            setHasUnpublishedChanges(false)
                            setLabSuccess(`✓ Published snapshot v${res?.version ?? '?'} — ${res?.count ?? '?'} active location(s) live for mobile clients.`)
                          } catch (e: any) {
                            const errData = e?.response?.data
                            let msg = errData?.detail || errData?.error || errData?.message
                            if (!msg && errData && typeof errData === 'object') {
                              msg = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
                            }
                            setLabError(`Publish failed: ${msg || e.message || 'Unknown error'}`)
                          } finally {
                            setIsPublishing(false)
                          }
                        }}
                      >
                        {isPublishing ? <Loader2 size={13} style={s.spin} /> : <UploadCloud size={13} />}
                        {isPublishing ? 'Publishing…' : 'Publish Snapshot'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {sidebarTab === 'console' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={s.consoleHeader}>
                    <span style={campusPanel.cardTitle}>{result?.title || 'Console Output'}</span>
                    {result?.isError && <AlertTriangle size={15} color={T.error} />}
                  </div>
                  <div style={{ padding: 12, background: T.bgInput, flex: 1 }}>
                    <pre style={s.pre}>{result ? JSON.stringify(result.payload, null, 2) : 'Run an action to see response details.'}</pre>
                  </div>
                </div>
              )}
                </>
              ) : area === 'account' ? (
                <>
                  <div style={s.subTabs}>
                    <button style={subTabStyle(section === 'student')} onClick={() => switchSection('student')}>Student</button>
                    <button style={subTabStyle(section === 'driver')} onClick={() => switchSection('driver')}>Driver</button>
                  </div>
                  {section === 'driver' ? (
                    <ActionPanel
                      icon={<ShieldCheck size={16} />}
                      title="Drivers"
                      count={counts.driver}
                      setCount={(value) => setCounts((prev) => ({ ...prev, driver: value }))}
                      primaryLabel="Create verified drivers"
                      dangerLabel="Delete random drivers"
                      onPrimary={() => runAction.mutate('createDrivers')}
                      onDanger={() => runAction.mutate('deleteDrivers')}
                      busy={busy}
                    />
                  ) : (
                    <ActionPanel
                      icon={<Users size={16} />}
                      title="Students"
                      count={counts.student}
                      setCount={(value) => setCounts((prev) => ({ ...prev, student: value }))}
                      primaryLabel="Create students"
                      dangerLabel="Delete random students"
                      onPrimary={() => runAction.mutate('createStudents')}
                      onDanger={() => runAction.mutate('deleteStudents')}
                      busy={busy}
                    />
                  )}
                </>
              ) : (
                <>
                  <div style={s.subTabs}>
                    <button style={subTabStyle(section === 'create')} onClick={() => switchSection('create')}>Scheduled</button>
                    <button style={subTabStyle(section === 'on-demand')} onClick={() => switchSection('on-demand')}>On-Demand</button>
                    <button style={subTabStyle(section === 'join')} onClick={() => switchSection('join')}>Join</button>
                    <button style={subTabStyle(section === 'verify')} onClick={() => switchSection('verify')}>Verify</button>
                  </div>
                  {section === 'on-demand' ? (
                    <div style={campusPanel.cardBody}>
                      <PanelTitle icon={<Bus size={16} />} title="On-Demand Requests" />
                      <div style={s.formGrid}>
                        <NumberField
                          label="Create"
                          value={counts.ondemandRides}
                          onChange={(value) => setCounts((prev) => ({ ...prev, ondemandRides: value }))}
                        />
                        <NumberField
                          label="Delete"
                          value={counts.deleteOnDemand}
                          onChange={(value) => setCounts((prev) => ({ ...prev, deleteOnDemand: value }))}
                        />
                      </div>
                      <div style={s.buttonRow}>
                        <button style={campusPanel.btnPrimary} onClick={() => runAction.mutate('createOnDemand')} disabled={busy}>
                          {busy ? <Loader2 size={13} style={s.spin} /> : <Bus size={13} />}
                          Create available requests
                        </button>
                        <button style={s.dangerButton} onClick={() => runAction.mutate('deleteOnDemand')} disabled={busy}>
                          <Trash2 size={13} />
                          Delete random requests
                        </button>
                      </div>
                    </div>
                  ) : section === 'join' ? (
                    <div style={campusPanel.cardBody}>
                      <PanelTitle icon={<UserPlus size={16} />} title="Join scheduled ride" />
                      <div style={s.formGrid}>
                        <label style={s.field}>
                          <span style={s.label}>Ride</span>
                          <select
                            style={s.input}
                            value={selectedRide?.id || ''}
                            onChange={(event) => setSelectedRideId(event.target.value)}
                          >
                            {rides.map((ride) => (
                              <option key={ride.id} value={ride.id}>
                                {ride.reference} - {ride.route}
                              </option>
                            ))}
                          </select>
                        </label>
                        <NumberField
                          label="Students"
                          value={counts.join}
                          onChange={(value) => setCounts((prev) => ({ ...prev, join: value }))}
                        />
                      </div>
                      <div style={s.buttonRow}>
                        <button style={campusPanel.btnPrimary} onClick={() => runAction.mutate('joinRide')} disabled={busy || !selectedRide}>
                          {busy ? <Loader2 size={13} style={s.spin} /> : <UserPlus size={13} />}
                          Join students
                        </button>
                      </div>
                    </div>
                  ) : section === 'verify' ? (
                    <div style={{ ...campusPanel.cardBody, padding: 0 }}>
                      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
                        <PanelTitle icon={<CheckCircle2 size={16} />} title="Generated ride records" />
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={s.table}>
                          <thead>
                            <tr>
                              <th style={s.th}>Ref</th>
                              <th style={s.th}>Route</th>
                              <th style={s.th}>Date</th>
                              <th style={s.th}>Vehicle</th>
                              <th style={s.th}>Passengers</th>
                              <th style={s.th}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rides.map((ride) => (
                              <tr key={ride.id}>
                                <td style={s.td}>{ride.reference}</td>
                                <td style={s.td}>{ride.route}</td>
                                <td style={s.td}>{ride.departure_date} {ride.window}</td>
                                <td style={s.td}>{ride.vehicle_size}</td>
                                <td style={s.td}>{ride.passenger_count}</td>
                                <td style={s.td}>{ride.status}</td>
                              </tr>
                            ))}
                            {!rides.length && (
                              <tr>
                                <td style={s.emptyCell} colSpan={6}>No generated scheduled rides yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, borderTop: `1px solid ${T.border}` }}>
                        <PanelTitle icon={<CheckCircle2 size={16} />} title="Generated on-demand records" />
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={s.table}>
                          <thead>
                            <tr>
                              <th style={s.th}>Ref</th>
                              <th style={s.th}>Route</th>
                              <th style={s.th}>Student</th>
                              <th style={s.th}>Vehicle</th>
                              <th style={s.th}>Passengers</th>
                              <th style={s.th}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ondemandRides.map((ride) => (
                              <tr key={ride.id}>
                                <td style={s.td}>{ride.reference}</td>
                                <td style={s.td}>{ride.route}</td>
                                <td style={s.td}>{ride.student}</td>
                                <td style={s.td}>{ride.vehicle_type}</td>
                                <td style={s.td}>{ride.passenger_count}</td>
                                <td style={s.td}>{ride.status}</td>
                              </tr>
                            ))}
                            {!ondemandRides.length && (
                              <tr>
                                <td style={s.emptyCell} colSpan={6}>No generated on-demand rides yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={campusPanel.cardBody}>
                      <PanelTitle icon={<Bus size={16} />} title="Scheduled rides" />
                      <div style={s.formGrid}>
                        <NumberField
                          label="Create"
                          value={counts.rides}
                          onChange={(value) => setCounts((prev) => ({ ...prev, rides: value }))}
                        />
                        <NumberField
                          label="Delete"
                          value={counts.deleteRides}
                          onChange={(value) => setCounts((prev) => ({ ...prev, deleteRides: value }))}
                        />
                      </div>
                      <div style={s.buttonRow}>
                        <button style={campusPanel.btnPrimary} onClick={() => runAction.mutate('createRides')} disabled={busy}>
                          {busy ? <Loader2 size={13} style={s.spin} /> : <Bus size={13} />}
                          Create ride schedules
                        </button>
                        <button style={s.dangerButton} onClick={() => runAction.mutate('deleteRides')} disabled={busy}>
                          <Trash2 size={13} />
                          Delete random schedules
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <aside style={s.sidebar}>
          </aside>
        </div>
      </div>
    </div>
  )
}

function actionLabel(action: string) {
  return ({
    createStudents: 'Create students',
    deleteStudents: 'Delete students',
    createDrivers: 'Create drivers',
    deleteDrivers: 'Delete drivers',
    createAdmins: 'Create admins',
    deleteAdmins: 'Delete admins',
    createRides: 'Create scheduled rides',
    deleteRides: 'Delete scheduled rides',
    joinRide: 'Join scheduled ride',
    createOnDemand: 'Create on-demand rides',
    deleteOnDemand: 'Delete on-demand rides',
    importLocations: 'Bulk import locations',
    publishLocations: 'Publish location snapshot',
  } as Record<string, string>)[action] || 'Test action'
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={s.stat}>
      <span style={s.statLabel}>{label}</span>
      <strong style={s.statValue}>{value}</strong>
    </div>
  )
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div style={s.panelTitle}>
      <span style={s.panelIcon}>{icon}</span>
      <h2 style={s.panelHeading}>{title}</h2>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={s.field}>
      <span style={s.label}>{label}</span>
      <input
        style={s.input}
        type="number"
        min={1}
        max={2000}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ActionPanel({
  icon,
  title,
  count,
  setCount,
  primaryLabel,
  dangerLabel,
  onPrimary,
  onDanger,
  busy,
}: {
  icon: ReactNode
  title: string
  count: string
  setCount: (value: string) => void
  primaryLabel: string
  dangerLabel: string
  onPrimary: () => void
  onDanger: () => void
  busy: boolean
}) {
  return (
    <div style={campusPanel.cardBody}>
      <PanelTitle icon={icon} title={title} />
      <div style={s.formGrid}>
        <NumberField label="Total" value={count} onChange={setCount} />
      </div>
      <div style={s.buttonRow}>
        <button style={campusPanel.btnPrimary} onClick={onPrimary} disabled={busy}>
          {busy ? <Loader2 size={13} style={s.spin} /> : <UserPlus size={13} />}
          {primaryLabel}
        </button>
        <button style={s.dangerButton} onClick={onDanger} disabled={busy}>
          <Trash2 size={13} />
          {dangerLabel}
        </button>
      </div>
    </div>
  )
}

const tabStyle = (active: boolean): CSSProperties => ({
  border: 'none',
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: T.fontFamily,
  cursor: 'pointer',
  color: active ? T.textPrimary : T.textSecondary,
  background: active ? T.bgCard : 'transparent',
  boxShadow: active ? `0 0 0 1px ${T.border}` : 'none',
  borderRadius: 0,
})

const subTabStyle = (active: boolean): CSSProperties => ({
  border: 'none',
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: T.fontFamily,
  cursor: 'pointer',
  color: active ? T.textPrimary : T.textMuted,
  background: 'transparent',
  borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
  marginBottom: -1,
})

const s: Record<string, CSSProperties> = {
  contentGrid: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 16, 
    width: '400px', 
    maxWidth: '40vw', 
    marginLeft: 'auto',
    marginRight: 16,
    alignItems: 'stretch'
  },
  contentCol: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 16 },
  
  areaTabs: { display: 'flex', gap: 4, background: T.bgInput, padding: 4 },
  
  subTabs: {
    display: 'flex',
    borderBottom: `1px solid ${T.border}`,
    background: T.bgPanel,
  },
  
  warning: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: T.warn,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    padding: '4px 8px',
    background: 'rgba(234, 179, 8, 0.1)',
    border: '1px solid rgba(234, 179, 8, 0.2)',
  },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 16 },
  stat: { border: `1px solid ${T.border}`, background: T.bgPanel, padding: '12px 16px', minWidth: 0 },
  statLabel: { display: 'block', color: T.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { display: 'block', color: T.textPrimary, fontSize: 16, fontWeight: 700, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  
  panelTitle: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  panelIcon: { color: T.textMuted, display: 'inline-flex' },
  panelHeading: { margin: 0, fontSize: 14, fontWeight: 700, color: T.textPrimary, letterSpacing: 0 },
  
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 16, maxWidth: 480 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: T.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    borderRadius: 0,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: T.fontFamily,
    boxSizing: 'border-box',
  },
  
  buttonRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, flexWrap: 'wrap' },
  dangerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid rgba(239, 68, 68, 0.3)`,
    background: 'rgba(239, 68, 68, 0.05)',
    color: T.error,
    cursor: 'pointer',
    padding: '6px 14px',
    borderRadius: 0,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: T.fontFamily,
  },
  
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 760 },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', borderBottom: `1px solid ${T.border}` },
  td: { padding: '12px 16px', fontSize: 12, color: T.textPrimary, borderBottom: `1px solid ${T.border}` },
  emptyCell: { padding: 32, textAlign: 'center', color: T.textMuted, fontSize: 13 },
  
  consoleHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}` },
  pre: {
    margin: 0,
    maxHeight: 'calc(100vh - 160px)',
    overflow: 'auto',
    color: T.textSecondary,
    fontSize: 11,
    lineHeight: 1.5,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  spin: { animation: 'test-spin 0.8s linear infinite' },
}

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
  MapPin,
  Settings,
  Database,
  Zap,
  Crown,
  GraduationCap,
  Car,
  Layers,
  Activity,
  TrendingUp,
  Clock,
  Calendar,
  Globe2,
  CreditCard,
  Shield,
  Users2,
  Wrench,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Plus,
  Play,
  Square,
  ArrowRight,
  Search,
  Filter,
  Eye,
  CircleDot,
  Timer,
  Package,
  UserMinus,
} from 'lucide-react'
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api'
import apiService from '../../services/api.service'
import api from '../../core/api'
import { T, useCampusThemeStore } from '../theme'
import { campusPanel } from '../shared/campusPanelStyles'
import { CalibrationTab } from '../engine/tabs/CalibrationTab'
import type { PlatformSettings } from '../engine/types'

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
  const area = queryArea === 'rides' ? 'rides' : queryArea === 'map' ? 'map' : queryArea === 'calibration' ? 'calibration' : 'account'
  const validAccountSections = ['student', 'driver', 'admin']
  const initialSection = searchParams.get('section')
  const defaultSection = area === 'rides' ? 'create' : (area === 'map' || (area as any) === 'calibration') ? 'manage' : (initialSection && validAccountSections.includes(initialSection) ? initialSection : 'student')
  const section = initialSection || defaultSection
  const { mode } = useCampusThemeStore()
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
  const [draftLocation, setDraftLocation] = useState<{lat: number, lng: number, name: string, category: string, id: string, overlapWarning?: boolean, allowOverlap?: boolean} | null>(null)

  // Settings — required by CalibrationTab
  const DEFAULT_SETTINGS: PlatformSettings = {
    commission_rate: 10,
    distance_provider: 'osrm',
    max_distance_km: 50,
    no_show_fee_enabled: false,
    no_show_fee_amount: 0,
    no_show_wait_minutes: 5,
  }
  const { data: settingsData } = useQuery<PlatformSettings>({
    queryKey: ['platform-settings-testpage'],
    queryFn: () => api.get('/pricing/config/active/').then(r => r.data?.settings ?? DEFAULT_SETTINGS),
    staleTime: 60_000,
  })
  const settings: PlatformSettings = settingsData ?? DEFAULT_SETTINGS


  const existingLocationsQuery = useQuery({
    queryKey: ['existing-locations-snapshot'],
    queryFn: () => apiService.getLocationsSnapshot(),
    refetchOnWindowFocus: false,
    enabled: area === 'map',
  })
  const existingLocations = Array.isArray(existingLocationsQuery.data) ? existingLocationsQuery.data : []

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng || sidebarTab !== 'builder') return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    const newPoint = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }
    
    // 5 m dedup: skip if any existing location is within 5 metres
    const tooCloseEditor = editorLocations.some(loc => haversineM(newPoint, { lat: loc.lat, lng: loc.lng }) <= 5)
    const tooCloseExisting = existingLocations.some((loc: any) => haversineM(newPoint, { lat: loc.latitude, lng: loc.longitude }) <= 5)
    if (tooCloseEditor || tooCloseExisting) return
    
    const overlapsEditor = editorLocations.some(loc => haversineM(newPoint, { lat: loc.lat, lng: loc.lng }) <= 100)
    const overlapsExisting = existingLocations.some((loc: any) => haversineM(newPoint, { lat: loc.latitude, lng: loc.longitude }) <= 100)
    const overlapWarning = overlapsEditor || overlapsExisting
    
    const idStr = `loc_${Math.random().toString(36).substring(2, 8)}`
    const newLoc = { ...newPoint, name: '', category: 'gate', id: idStr, overlapWarning }
    setEditorLocations(prev => [...prev, newLoc])
    setDraftLocation(newLoc)
  }, [sidebarTab, editorLocations, existingLocations])
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

  const setArea = (nextArea: 'account' | 'rides' | 'map' | 'calibration') => {
    const params = new URLSearchParams()
    params.set('area', nextArea)
    const currentSection = searchParams.get('section')
    const validAccountSections = ['student', 'driver', 'admin']
    params.set('section', nextArea === 'rides' ? 'create' : (nextArea === 'map' || nextArea === 'calibration') ? 'manage' : (currentSection && validAccountSections.includes(currentSection) ? currentSection : 'student'))
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
        flushRides: () => apiService.flushAllScheduledRides(),
        joinRide: () => apiService.joinTestScheduledRide(selectedRide?.id || '', clampCount(counts.join)),
        createOnDemand: () => apiService.createTestOnDemandRides(clampCount(counts.ondemandRides)),
        deleteOnDemand: () => apiService.deleteTestOnDemandRides(clampCount(counts.deleteOnDemand)),
        flushOnDemand: () => apiService.flushAllOnDemandRides(),
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

  const mapContainerStyle = useMemo(() => ({ width: '100%', height: '100%' }), [])
  const mapCenter = useMemo(() => ({ lat: 9.53, lng: 6.45 }), [])
  const mapOptions = useMemo(() => ({
    disableDefaultUI: true,
    backgroundColor: mode === 'dark' ? '#0f1117' : '#ffffff',
    styles: mode === 'dark' ? [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
      { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
    ] : [],
  }), [mode])

  return (
    <div style={{ ...campusPanel.shell, position: 'relative', overflow: 'hidden', padding: 0 }}>
      <style>{'@keyframes test-spin { to { transform: rotate(360deg); } }'}</style>
      
      {isLoaded && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={15}
            options={mapOptions}
            onClick={handleMapClick}
          >
            {existingLocations.map((loc: any) => (
              <Marker
                key={`ex_${loc.id}`}
                position={{ lat: loc.latitude, lng: loc.longitude }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: '#9ca3af',
                  fillOpacity: 1,
                  strokeColor: '#374151',
                  strokeWeight: 1,
                  scale: 6,
                }}
                title={loc.name}
              />
            ))}
            {existingLocations.map((loc: any) => (
              <Circle
                key={`ex_c_${loc.id}`}
                center={{ lat: loc.latitude, lng: loc.longitude }}
                radius={100}
                options={{
                  fillColor: '#ef4444',
                  fillOpacity: 0.05,
                  strokeColor: '#ef4444',
                  strokeOpacity: 0.2,
                  strokeWeight: 1,
                  clickable: false,
                }}
              />
            ))}
            {editorLocations.map((loc, idx) => (
              <Marker
                key={loc.id || idx}
                position={{ lat: loc.lat, lng: loc.lng }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: '#6366f1',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: 7,
                }}
                label={{ text: (idx + 1).toString(), color: '#ffffff', fontSize: '9px', fontWeight: 'bold' }}
                title={loc.name}
              />
            ))}
            {editorLocations.map((loc, idx) => (
              <Circle
                key={`ed_c_${loc.id || idx}`}
                center={{ lat: loc.lat, lng: loc.lng }}
                radius={100}
                options={{
                  fillColor: '#ef4444',
                  fillOpacity: 0.05,
                  strokeColor: '#ef4444',
                  strokeOpacity: 0.2,
                  strokeWeight: 1,
                  clickable: false,
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

      <div style={{ ...campusPanel.scrollMain, ...campusPanel.thinScroll, padding: 0, position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
        {/* ── Calibration Lab: full-bleed, bypasses stats/sidebar ── */}
        {(area as any) === 'calibration' ? (
          <div style={{ pointerEvents: 'auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CalibrationTab settings={settings} />
          </div>
        ) : (
        <div style={area === 'map' ? { ...s.contentGrid, pointerEvents: 'auto' } : { ...s.labPage, pointerEvents: 'auto' }}>
          <div style={s.contentCol}>
            
            {/* Main Area Navigation */}
            <div style={premiumStyles.mainNav}>
              <button 
                style={premiumStyles.mainNavTab(area === 'account')} 
                onClick={() => setArea('account')}
              >
                <Users size={16} />
                <span>Account</span>
              </button>
              <button 
                style={premiumStyles.mainNavTab(area === 'rides')} 
                onClick={() => setArea('rides')}
              >
                <Bus size={16} />
                <span>Rides</span>
              </button>
              <button 
                style={premiumStyles.mainNavTab(area === 'map')} 
                onClick={() => setArea('map')}
              >
                <MapPin size={16} />
                <span>Map</span>
              </button>
              <button 
                style={premiumStyles.mainNavTab((area as any) === 'calibration')} 
                onClick={() => setArea('calibration')}
              >
                <Settings size={16} />
                <span>Calibration</span>
              </button>
            </div>
            
            {area !== 'map' && area !== 'calibration' && (

              <div style={s.stats}>
                <Stat label="Campus" value={summary?.campus || 'Unavailable'} />
                <Stat label="Students" value={summary?.counts.students ?? 0} />
                <Stat label="Drivers" value={summary?.counts.drivers ?? 0} />
                <Stat label="Admins" value={summary?.counts.admins ?? 0} />
                <Stat label="Schedules" value={summary?.counts.scheduled_rides ?? 0} />
                <Stat label="On-Demand" value={summary?.counts.ondemand_rides ?? 0} />
              </div>
            )}

            <div style={{ ...campusPanel.card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {area === 'map' ? (
                <>
              <div style={s.subTabs}>
                <button style={subTabStyle(sidebarTab === 'builder')} onClick={() => setSidebarTab('builder')}>Builder</button>
                <button style={subTabStyle(sidebarTab === 'locations')} onClick={() => setSidebarTab('locations')}>Locations</button>
                <button style={subTabStyle(sidebarTab === 'console')} onClick={() => setSidebarTab('console')}>Console</button>
              </div>

              {sidebarTab === 'builder' && (
                <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
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

                      {draftLocation.overlapWarning && (
                        <div style={{ background: '#7f1d1d22', border: `1px solid #ef4444`, borderRadius: 4, padding: '8px', marginBottom: 8, marginTop: 8 }}>
                          <div style={{ fontSize: 10, color: '#ef4444', marginBottom: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>This pin is within 100m of an existing location. Adding overlapping locations may confuse users.</span>
                          </div>
                          <label style={{ fontSize: 11, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!draftLocation.allowOverlap}
                              onChange={e => {
                                const updated = { ...draftLocation, allowOverlap: e.target.checked }
                                setDraftLocation(updated)
                                setEditorLocations(prev => prev.map(l => l.id === draftLocation.id ? { ...l, allowOverlap: e.target.checked } : l))
                              }}
                            />
                            Exception: Allow 100m overlap
                          </label>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button
                          style={{ ...campusPanel.btnPrimary, flex: 1, padding: '6px 0', fontSize: 11, opacity: (draftLocation.overlapWarning && !draftLocation.allowOverlap) ? 0.5 : 1 }}
                          disabled={!!(draftLocation.overlapWarning && !draftLocation.allowOverlap)}
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
                          const exportData = editorLocations.map(l => ({
                            id: l.id,
                            name: l.name || 'Unnamed',
                            category: l.category,
                            latitude: l.lat,
                            longitude: l.lng,
                            allow_overlap: l.allowOverlap || false
                          }))
                          setJsonInput(JSON.stringify(exportData, null, 2))
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
                <div style={{ ...campusPanel.cardBody, flex: 1, overflowY: 'auto' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                  <div style={premiumStyles.accountTabs}>
                    <button 
                      style={premiumStyles.accountTab(section === 'student')} 
                      onClick={() => switchSection('student')}
                    >
                      <GraduationCap size={16} />
                      <span>Students</span>
                    </button>
                    <button 
                      style={premiumStyles.accountTab(section === 'driver')} 
                      onClick={() => switchSection('driver')}
                    >
                      <ShieldCheck size={16} />
                      <span>Drivers</span>
                    </button>
                    <button 
                      style={premiumStyles.accountTab(section === 'admin')} 
                      onClick={() => switchSection('admin')}
                    >
                      <UserCog size={16} />
                      <span>Admins</span>
                    </button>
                  </div>
                  
                  {section === 'driver' ? (
                    <PremiumAccountPanel
                      icon={<ShieldCheck size={24} />}
                      title="Driver Management"
                      description="Create and manage verified driver accounts for testing"
                      count={counts.driver}
                      setCount={(value) => setCounts((prev) => ({ ...prev, driver: value }))}
                      primaryLabel="Create Verified Drivers"
                      primaryIcon={<Car size={16} />}
                      dangerLabel="Delete Random Drivers"
                      dangerIcon={<Trash2 size={16} />}
                      onPrimary={() => runAction.mutate('createDrivers')}
                      onDanger={() => runAction.mutate('deleteDrivers')}
                      busy={busy}
                      stats={[
                        { label: 'Total Drivers', value: summary?.counts.drivers ?? 0, icon: <Users2 size={14} /> },
                        { label: 'Active Status', value: 'Verified', icon: <Shield size={14} /> },
                      ]}
                    />
                  ) : section === 'admin' ? (
                    <PremiumAccountPanel
                      icon={<UserCog size={24} />}
                      title="Admin Management"
                      description="Create and manage campus administrator accounts"
                      count={counts.admin}
                      setCount={(value) => setCounts((prev) => ({ ...prev, admin: value }))}
                      primaryLabel="Create Admins"
                      primaryIcon={<Crown size={16} />}
                      dangerLabel="Delete Random Admins"
                      dangerIcon={<Trash2 size={16} />}
                      onPrimary={() => runAction.mutate('createAdmins')}
                      onDanger={() => runAction.mutate('deleteAdmins')}
                      busy={busy}
                      stats={[
                        { label: 'Total Admins', value: summary?.counts.admins ?? 0, icon: <Crown size={14} /> },
                        { label: 'Campus Access', value: 'Full', icon: <Shield size={14} /> },
                      ]}
                    />
                  ) : (
                    <PremiumAccountPanel
                      icon={<GraduationCap size={24} />}
                      title="Student Management"
                      description="Create and manage student accounts for ride testing"
                      count={counts.student}
                      setCount={(value) => setCounts((prev) => ({ ...prev, student: value }))}
                      primaryLabel="Create Students"
                      primaryIcon={<UserPlus size={16} />}
                      dangerLabel="Delete Random Students"
                      dangerIcon={<Trash2 size={16} />}
                      onPrimary={() => runAction.mutate('createStudents')}
                      onDanger={() => runAction.mutate('deleteStudents')}
                      busy={busy}
                      stats={[
                        { label: 'Total Students', value: summary?.counts.students ?? 0, icon: <Users2 size={14} /> },
                        { label: 'Wallet Status', value: 'Active', icon: <CreditCard size={14} /> },
                      ]}
                    />
                  )}
                </>
              ) : (
                <>
                  <div style={premiumStyles.rideTabs}>
                    <button 
                      style={premiumStyles.rideTab(section === 'create')} 
                      onClick={() => switchSection('create')}
                    >
                      <Calendar size={16} />
                      <span>Scheduled</span>
                    </button>
                    <button 
                      style={premiumStyles.rideTab(section === 'on-demand')} 
                      onClick={() => switchSection('on-demand')}
                    >
                      <Zap size={16} />
                      <span>On-Demand</span>
                    </button>
                    <button 
                      style={premiumStyles.rideTab(section === 'join')} 
                      onClick={() => switchSection('join')}
                    >
                      <UserPlus size={16} />
                      <span>Join</span>
                    </button>
                    <button 
                      style={premiumStyles.rideTab(section === 'verify')} 
                      onClick={() => switchSection('verify')}
                    >
                      <CheckCircle2 size={16} />
                      <span>Verify</span>
                    </button>
                  </div>
                  
                  {section === 'on-demand' ? (
                    <PremiumRidePanel
                      icon={<Zap size={24} />}
                      title="On-Demand Ride Management"
                      description="Create and manage instant ride requests for testing"
                      primaryLabel="Create Available Requests"
                      primaryIcon={<Bus size={16} />}
                      dangerLabel="Delete Random Requests"
                      dangerIcon={<Trash2 size={16} />}
                      flushLabel="Clear All On-Demand"
                      flushIcon={<RefreshCcw size={16} />}
                      onCreate={() => runAction.mutate('createOnDemand')}
                      onDelete={() => runAction.mutate('deleteOnDemand')}
                      onFlush={() => runAction.mutate('flushOnDemand')}
                      busy={busy}
                      fields={[
                        { label: 'Create Count', value: counts.ondemandRides, onChange: (value) => setCounts((prev) => ({ ...prev, ondemandRides: value })) },
                        { label: 'Delete Count', value: counts.deleteOnDemand, onChange: (value) => setCounts((prev) => ({ ...prev, deleteOnDemand: value })) },
                      ]}
                      stats={[
                        { label: 'Total Requests', value: summary?.counts.ondemand_rides ?? 0, icon: <Activity size={14} /> },
                        { label: 'Status', value: 'Available', icon: <TrendingUp size={14} /> },
                      ]}
                    />
                  ) : section === 'join' ? (
                    <PremiumJoinPanel
                      icon={<UserPlus size={24} />}
                      title="Join Scheduled Ride"
                      description="Add students to existing scheduled rides for testing"
                      selectedRide={selectedRide}
                      rides={rides}
                      selectedRideId={selectedRideId}
                      setSelectedRideId={setSelectedRideId}
                      count={counts.join}
                      setCount={(value) => setCounts((prev) => ({ ...prev, join: value }))}
                      onJoin={() => runAction.mutate('joinRide')}
                      busy={busy}
                    />
                  ) : section === 'verify' ? (
                    <PremiumVerifyPanel
                      icon={<CheckCircle2 size={24} />}
                      title="Ride Verification"
                      description="View and verify generated ride records"
                      rides={rides}
                      ondemandRides={ondemandRides}
                    />
                  ) : (
                    <PremiumRidePanel
                      icon={<Calendar size={24} />}
                      title="Scheduled Ride Management"
                      description="Create and manage scheduled ride routes for testing"
                      primaryLabel="Create Ride Schedules"
                      primaryIcon={<Bus size={16} />}
                      dangerLabel="Delete Random Schedules"
                      dangerIcon={<Trash2 size={16} />}
                      flushLabel="Flush All Scheduled"
                      flushIcon={<AlertTriangle size={16} />}
                      onCreate={() => runAction.mutate('createRides')}
                      onDelete={() => runAction.mutate('deleteRides')}
                      onFlush={() => {
                        if (window.confirm("Are you sure you want to FLUSH ALL scheduled rides? This deletes everything!")) {
                          runAction.mutate('flushRides')
                        }
                      }}
                      busy={busy}
                      fields={[
                        { label: 'Create Count', value: counts.rides, onChange: (value) => setCounts((prev) => ({ ...prev, rides: value })) },
                        { label: 'Delete Count', value: counts.deleteRides, onChange: (value) => setCounts((prev) => ({ ...prev, deleteRides: value })) },
                      ]}
                      stats={[
                        { label: 'Total Rides', value: summary?.counts.scheduled_rides ?? 0, icon: <Calendar size={14} /> },
                        { label: 'Active Routes', value: rides.length, icon: <Layers size={14} /> },
                      ]}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {area === 'map' && <aside style={s.sidebar}></aside>}
        </div>
        )}
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
    flushOnDemand: 'Clear all on-demand rides',
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

// Premium Components
function PremiumAccountPanel({
  icon,
  title,
  description,
  count,
  setCount,
  primaryLabel,
  primaryIcon,
  dangerLabel,
  dangerIcon,
  onPrimary,
  onDanger,
  busy,
  stats,
}: {
  icon: ReactNode
  title: string
  description: string
  count: string
  setCount: (value: string) => void
  primaryLabel: string
  primaryIcon: ReactNode
  dangerLabel: string
  dangerIcon: ReactNode
  onPrimary: () => void
  onDanger: () => void
  busy: boolean
  stats: Array<{ label: string; value: string | number; icon: ReactNode }>
}) {
  return (
    <div style={premiumStyles.premiumPanel}>
      <div style={premiumStyles.panelHeader}>
        <div style={premiumStyles.panelIconWrapper}>{icon}</div>
        <div style={premiumStyles.panelHeaderContent}>
          <h2 style={premiumStyles.panelTitle}>{title}</h2>
          <p style={premiumStyles.panelDescription}>{description}</p>
        </div>
      </div>

      <div style={premiumStyles.statsGrid}>
        {stats.map((stat, idx) => (
          <div key={idx} style={premiumStyles.statCard}>
            <div style={premiumStyles.statIcon}>{stat.icon}</div>
            <div style={premiumStyles.statContent}>
              <div style={premiumStyles.statValue}>{stat.value}</div>
              <div style={premiumStyles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={premiumStyles.actionSection}>
        <div style={premiumStyles.inputGroup}>
          <label style={premiumStyles.inputLabel}>Account Count</label>
          <input
            style={premiumStyles.premiumInput}
            type="number"
            min={1}
            max={2000}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>

        <div style={premiumStyles.buttonGroup}>
          <button 
            style={premiumStyles.primaryButton} 
            onClick={onPrimary} 
            disabled={busy}
          >
            {busy ? <Loader2 size={16} style={premiumStyles.spin} /> : primaryIcon}
            <span>{primaryLabel}</span>
          </button>
          <button 
            style={premiumStyles.dangerButton} 
            onClick={onDanger} 
            disabled={busy}
          >
            {dangerIcon}
            <span>{dangerLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function PremiumRidePanel({
  icon,
  title,
  description,
  primaryLabel,
  primaryIcon,
  dangerLabel,
  dangerIcon,
  flushLabel,
  flushIcon,
  onCreate,
  onDelete,
  onFlush,
  busy,
  fields,
  stats,
}: {
  icon: ReactNode
  title: string
  description: string
  primaryLabel: string
  primaryIcon: ReactNode
  dangerLabel: string
  dangerIcon: ReactNode
  flushLabel: string
  flushIcon: ReactNode
  onCreate: () => void
  onDelete: () => void
  onFlush: () => void
  busy: boolean
  fields: Array<{ label: string; value: string; onChange: (value: string) => void }>
  stats: Array<{ label: string; value: string | number; icon: ReactNode }>
}) {
  return (
    <div style={premiumStyles.premiumPanel}>
      <div style={premiumStyles.panelHeader}>
        <div style={premiumStyles.panelIconWrapper}>{icon}</div>
        <div style={premiumStyles.panelHeaderContent}>
          <h2 style={premiumStyles.panelTitle}>{title}</h2>
          <p style={premiumStyles.panelDescription}>{description}</p>
        </div>
      </div>

      <div style={premiumStyles.statsGrid}>
        {stats.map((stat, idx) => (
          <div key={idx} style={premiumStyles.statCard}>
            <div style={premiumStyles.statIcon}>{stat.icon}</div>
            <div style={premiumStyles.statContent}>
              <div style={premiumStyles.statValue}>{stat.value}</div>
              <div style={premiumStyles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={premiumStyles.actionSection}>
        <div style={premiumStyles.fieldsGrid}>
          {fields.map((field, idx) => (
            <div key={idx} style={premiumStyles.inputGroup}>
              <label style={premiumStyles.inputLabel}>{field.label}</label>
              <input
                style={premiumStyles.premiumInput}
                type="number"
                min={1}
                max={2000}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            </div>
          ))}
        </div>

        <div style={premiumStyles.buttonGroup}>
          <button 
            style={premiumStyles.primaryButton} 
            onClick={onCreate} 
            disabled={busy}
          >
            {busy ? <Loader2 size={16} style={premiumStyles.spin} /> : primaryIcon}
            <span>{primaryLabel}</span>
          </button>
          <button 
            style={premiumStyles.dangerButton} 
            onClick={onDelete} 
            disabled={busy}
          >
            {dangerIcon}
            <span>{dangerLabel}</span>
          </button>
          <button 
            style={premiumStyles.flushButton} 
            onClick={onFlush} 
            disabled={busy}
          >
            {flushIcon}
            <span>{flushLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function PremiumJoinPanel({
  icon,
  title,
  description,
  selectedRide,
  rides,
  selectedRideId,
  setSelectedRideId,
  count,
  setCount,
  onJoin,
  busy,
}: {
  icon: ReactNode
  title: string
  description: string
  selectedRide: TestRide | undefined
  rides: TestRide[]
  selectedRideId: string
  setSelectedRideId: (id: string) => void
  count: string
  setCount: (value: string) => void
  onJoin: () => void
  busy: boolean
}) {
  return (
    <div style={premiumStyles.premiumPanel}>
      <div style={premiumStyles.panelHeader}>
        <div style={premiumStyles.panelIconWrapper}>{icon}</div>
        <div style={premiumStyles.panelHeaderContent}>
          <h2 style={premiumStyles.panelTitle}>{title}</h2>
          <p style={premiumStyles.panelDescription}>{description}</p>
        </div>
      </div>

      <div style={premiumStyles.actionSection}>
        <div style={premiumStyles.fieldsGrid}>
          <div style={premiumStyles.inputGroup}>
            <label style={premiumStyles.inputLabel}>Select Ride</label>
            <select
              style={premiumStyles.premiumSelect}
              value={selectedRide?.id || ''}
              onChange={(e) => setSelectedRideId(e.target.value)}
            >
              {rides.map((ride) => (
                <option key={ride.id} value={ride.id}>
                  {ride.reference} - {ride.route}
                </option>
              ))}
            </select>
          </div>
          <div style={premiumStyles.inputGroup}>
            <label style={premiumStyles.inputLabel}>Student Count</label>
            <input
              style={premiumStyles.premiumInput}
              type="number"
              min={1}
              max={2000}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
        </div>

        <div style={premiumStyles.buttonGroup}>
          <button 
            style={premiumStyles.primaryButton} 
            onClick={onJoin} 
            disabled={busy || !selectedRide}
          >
            {busy ? <Loader2 size={16} style={premiumStyles.spin} /> : <UserPlus size={16} />}
            <span>Join Students to Ride</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function PremiumVerifyPanel({
  icon,
  title,
  description,
  rides,
  ondemandRides,
}: {
  icon: ReactNode
  title: string
  description: string
  rides: TestRide[]
  ondemandRides: TestRide[]
}) {
  return (
    <div style={premiumStyles.premiumPanel}>
      <div style={premiumStyles.panelHeader}>
        <div style={premiumStyles.panelIconWrapper}>{icon}</div>
        <div style={premiumStyles.panelHeaderContent}>
          <h2 style={premiumStyles.panelTitle}>{title}</h2>
          <p style={premiumStyles.panelDescription}>{description}</p>
        </div>
      </div>

      <div style={premiumStyles.verifySection}>
        <div style={premiumStyles.verifyHeader}>
          <div style={premiumStyles.verifyTitle}>
            <Calendar size={16} />
            <span>Scheduled Rides</span>
          </div>
          <span style={premiumStyles.verifyCount}>{rides.length} records</span>
        </div>
        
        {rides.length === 0 ? (
          <div style={premiumStyles.emptyState}>
            <Calendar size={32} style={{ opacity: 0.3 }} />
            <span>No scheduled rides generated yet</span>
          </div>
        ) : (
          <div style={premiumStyles.tableContainer}>
            <table style={premiumStyles.premiumTable}>
              <thead>
                <tr>
                  <th style={premiumStyles.th}>Reference</th>
                  <th style={premiumStyles.th}>Route</th>
                  <th style={premiumStyles.th}>Date</th>
                  <th style={premiumStyles.th}>Vehicle</th>
                  <th style={premiumStyles.th}>Passengers</th>
                  <th style={premiumStyles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((ride) => (
                  <tr key={ride.id}>
                    <td style={premiumStyles.td}>{ride.reference}</td>
                    <td style={premiumStyles.td}>{ride.route}</td>
                    <td style={premiumStyles.td}>{ride.departure_date} {ride.window}</td>
                    <td style={premiumStyles.td}>{ride.vehicle_size}</td>
                    <td style={premiumStyles.td}>{ride.passenger_count}</td>
                    <td style={premiumStyles.td}>
                      <span style={{
                        ...premiumStyles.statusBadge,
                        background: ride.status === 'scheduled' ? 'rgba(168,85,247,0.1)' : 
                                   ride.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                        color: ride.status === 'scheduled' ? '#a855f7' : 
                               ride.status === 'completed' ? '#10b981' : '#f59e0b',
                        borderColor: ride.status === 'scheduled' ? 'rgba(168,85,247,0.3)' : 
                                    ride.status === 'completed' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
                      }}>
                        {ride.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={premiumStyles.verifyHeader}>
          <div style={premiumStyles.verifyTitle}>
            <Zap size={16} />
            <span>On-Demand Rides</span>
          </div>
          <span style={premiumStyles.verifyCount}>{ondemandRides.length} records</span>
        </div>
        
        {ondemandRides.length === 0 ? (
          <div style={premiumStyles.emptyState}>
            <Zap size={32} style={{ opacity: 0.3 }} />
            <span>No on-demand rides generated yet</span>
          </div>
        ) : (
          <div style={premiumStyles.tableContainer}>
            <table style={premiumStyles.premiumTable}>
              <thead>
                <tr>
                  <th style={premiumStyles.th}>Reference</th>
                  <th style={premiumStyles.th}>Route</th>
                  <th style={premiumStyles.th}>Student</th>
                  <th style={premiumStyles.th}>Vehicle</th>
                  <th style={premiumStyles.th}>Passengers</th>
                  <th style={premiumStyles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ondemandRides.map((ride) => (
                  <tr key={ride.id}>
                    <td style={premiumStyles.td}>{ride.reference}</td>
                    <td style={premiumStyles.td}>{ride.route}</td>
                    <td style={premiumStyles.td}>{ride.student}</td>
                    <td style={premiumStyles.td}>{ride.vehicle_type}</td>
                    <td style={premiumStyles.td}>{ride.passenger_count}</td>
                    <td style={premiumStyles.td}>
                      <span style={{
                        ...premiumStyles.statusBadge,
                        background: ride.status === 'available' ? 'rgba(16,185,129,0.1)' : 
                                   ride.status === 'completed' ? 'rgba(168,85,247,0.1)' : 'rgba(245,158,11,0.1)',
                        color: ride.status === 'available' ? '#10b981' : 
                               ride.status === 'completed' ? '#a855f7' : '#f59e0b',
                        borderColor: ride.status === 'available' ? 'rgba(16,185,129,0.3)' : 
                                    ride.status === 'completed' ? 'rgba(168,85,247,0.3)' : 'rgba(245,158,11,0.3)',
                      }}>
                        {ride.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

const s: Record<string, any> = {
  contentGrid: { 
    position: 'absolute',
    top: 5,
    bottom: 5,
    right: 5,
    width: '400px', 
    maxWidth: '40vw', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 16, 
    alignItems: 'stretch'
  },
  labPage: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignItems: 'stretch',
    minHeight: '100%',
    padding: '0 0 20px 0',
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

// Premium Styles
const premiumStyles: Record<string, any> = {
  // Main Navigation
  mainNav: {
    display: 'flex',
    gap: 2,
    background: T.bgInput,
    padding: 3,
    borderRadius: 10,
    marginBottom: 16,
  },
  mainNavTab: (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: T.fontFamily,
    cursor: 'pointer',
    color: active ? T.textPrimary : T.textMuted,
    background: active ? T.bgCard : 'transparent',
    border: 'none',
    borderRadius: 8,
    transition: 'all 0.2s ease',
    boxShadow: active ? `0 1px 4px rgba(0,0,0,0.08)` : 'none',
  }),

  // Account Tabs
  accountTabs: {
    display: 'flex',
    gap: 2,
    background: T.bgInput,
    padding: 3,
    borderRadius: 10,
    marginBottom: 16,
  },
  accountTab: (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: T.fontFamily,
    cursor: 'pointer',
    color: active ? T.textPrimary : T.textMuted,
    background: active ? T.bgCard : 'transparent',
    border: 'none',
    borderRadius: 8,
    transition: 'all 0.2s ease',
    boxShadow: active ? `0 1px 4px rgba(0,0,0,0.08)` : 'none',
  }),

  // Ride Tabs
  rideTabs: {
    display: 'flex',
    gap: 2,
    background: T.bgInput,
    padding: 3,
    borderRadius: 10,
    marginBottom: 16,
  },
  rideTab: (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: T.fontFamily,
    cursor: 'pointer',
    color: active ? T.textPrimary : T.textMuted,
    background: active ? T.bgCard : 'transparent',
    border: 'none',
    borderRadius: 8,
    transition: 'all 0.2s ease',
    boxShadow: active ? `0 1px 4px rgba(0,0,0,0.08)` : 'none',
  }),

  // Premium Panel
  premiumPanel: {
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },

  // Panel Header
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    paddingBottom: 16,
    borderBottom: `1px solid ${T.border}`,
  },
  panelIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 10,
    background: T.accentBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a855f7',
    flexShrink: 0,
  },
  panelHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  panelTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: T.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  panelDescription: {
    margin: 0,
    fontSize: 12,
    color: T.textMuted,
    lineHeight: 1.5,
  },

  // Stats Grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    transition: 'all 0.2s ease',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: T.accentBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a855f7',
    flexShrink: 0,
  },
  statContent: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 800,
    color: T.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Action Section
  actionSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumInput: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: T.fontFamily,
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },
  premiumSelect: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: T.fontFamily,
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  // Button Group
  buttonGroup: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, #a855f7, #9333ea)',
    color: '#ffffff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(168,85,247,0.3)',
  },
  dangerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: `1px solid rgba(239, 68, 68, 0.3)`,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
    transition: 'all 0.2s ease',
  },
  flushButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(234, 179, 8, 0.1)',
    color: '#eab308',
    border: `1px solid rgba(234, 179, 8, 0.3)`,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
    transition: 'all 0.2s ease',
  },

  // Verify Section
  verifySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  verifyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: T.bgPanel,
    borderRadius: 12,
    border: `1px solid ${T.border}`,
  },
  verifyTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: T.textPrimary,
  },
  verifyCount: {
    fontSize: 12,
    fontWeight: 600,
    color: '#a855f7',
    background: 'rgba(168,85,247,0.1)',
    padding: '4px 12px',
    borderRadius: 6,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
    color: T.textMuted,
    fontSize: 14,
    background: T.bgPanel,
    borderRadius: 12,
    border: `2px dashed ${T.border}`,
  },
  tableContainer: {
    background: T.bgPanel,
    borderRadius: 12,
    border: `1px solid ${T.border}`,
    overflow: 'hidden',
  },
  premiumTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '16px 20px',
    fontSize: 11,
    fontWeight: 700,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${T.border}`,
    background: T.bgInput,
  },
  td: {
    padding: '16px 20px',
    fontSize: 13,
    color: T.textPrimary,
    borderBottom: `1px solid ${T.border}`,
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    border: '1px solid',
  },
}

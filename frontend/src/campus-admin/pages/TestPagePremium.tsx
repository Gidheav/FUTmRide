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
  Zap,
  Crown,
  GraduationCap,
  Car,
  Layers,
  Activity,
  TrendingUp,
  Clock,
  Calendar,
  CreditCard,
  Shield,
  Users2,
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
  BarChart3,
  Database,
  Wrench,
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

export default function TestPagePremium() {
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
  const defaultSection = area === 'rides' ? 'create' : (area === 'map' || area === 'calibration') ? 'manage' : (initialSection && validAccountSections.includes(initialSection) ? initialSection : 'student')
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

  // Live clock
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(t)
  }, [])

  const nowDate = new Date(now)
  const timeStr = nowDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateStr = nowDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ ...campusPanel.shell, position: 'relative', overflow: 'hidden', padding: 0 }}>
      <style>{`@keyframes test-spin { to { transform: rotate(360deg); } }`}</style>
      
      {/* Map background only for Map and Calibration areas */}
      {(area === 'map' || area === 'calibration') && isLoaded && (
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
        {area === 'calibration' ? (
          <div style={{ pointerEvents: 'auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CalibrationTab settings={settings} />
          </div>
        ) : area === 'map' ? (
          <div style={{ pointerEvents: 'auto', width: '400px', maxWidth: '40vw', position: 'absolute', top: 5, bottom: 5, right: 5, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 4, background: T.bgInput, padding: 4, borderRadius: 8 }}>
              <button 
                style={{ 
                  flex: 1, 
                  padding: '8px 12px', 
                  fontSize: 12, 
                  fontWeight: 600, 
                  background: sidebarTab === 'builder' ? T.bgCard : 'transparent', 
                  color: sidebarTab === 'builder' ? T.textPrimary : T.textMuted, 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: 'pointer' 
                }} 
                onClick={() => setSidebarTab('builder')}
              >
                Builder
              </button>
              <button 
                style={{ 
                  flex: 1, 
                  padding: '8px 12px', 
                  fontSize: 12, 
                  fontWeight: 600, 
                  background: sidebarTab === 'locations' ? T.bgCard : 'transparent', 
                  color: sidebarTab === 'locations' ? T.textPrimary : T.textMuted, 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: 'pointer' 
                }} 
                onClick={() => setSidebarTab('locations')}
              >
                Locations
              </button>
              <button 
                style={{ 
                  flex: 1, 
                  padding: '8px 12px', 
                  fontSize: 12, 
                  fontWeight: 600, 
                  background: sidebarTab === 'console' ? T.bgCard : 'transparent', 
                  color: sidebarTab === 'console' ? T.textPrimary : T.textMuted, 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: 'pointer' 
                }} 
                onClick={() => setSidebarTab('console')}
              >
                Console
              </button>
            </div>

            {sidebarTab === 'builder' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={16} /> Location Builder
                </div>
                <p style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, marginTop: 0 }}>
                  Click the map to place pins. Pins within 5m of each other are deduplicated.
                </p>
                
                {draftLocation && (
                  <div style={{ background: T.bgInput, border: `1px solid ${T.accent}44`, borderRadius: 8, padding: 12, marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: T.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={12} /> Editing last pin
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3 }}>NAME *</div>
                      <input
                        autoFocus
                        style={{ background: T.bgInput, border: `1px solid ${T.border}`, color: T.textPrimary, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }}
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
                        style={{ background: T.bgInput, border: `1px solid ${T.border}`, color: T.textPrimary, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }}
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
                        style={{ background: T.bgInput, border: `1px solid ${T.border}`, color: T.textPrimary, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
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
                      <div style={{ background: '#7f1d1d22', border: `1px solid #ef4444`, borderRadius: 6, padding: '8px', marginBottom: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 10, color: '#ef4444', marginBottom: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>This pin is within 100m of an existing location.</span>
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
                          Allow 100m overlap
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
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: `1px solid rgba(239, 68, 68, 0.3)`, color: '#ef4444', cursor: 'pointer', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
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
                  <div style={{ textAlign: 'center', padding: '24px 10px', color: T.textMuted, border: `2px dashed ${T.border}`, borderRadius: 8 }}>
                    <MapPin size={22} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                    No pins yet.<br/>Click the map to start building locations.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {editorLocations.slice().reverse().map((loc, idx) => (
                      <div key={loc.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgInput, padding: '8px 12px', borderRadius: 6, border: `1px solid ${T.border}` }}>
                        <MapPin size={14} color={T.accent} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name || 'Unnamed'}</div>
                          <div style={{ fontSize: 9, color: T.textMuted }}>{loc.category} · {loc.lat}, {loc.lng}</div>
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
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe size={16} /> Publish Location Data
                </div>
                <p style={{ fontSize: 12, color: T.textSecondary, marginBottom: 16, marginTop: 0 }}>
                  Publish a new optimized snapshot of all currently imported campus locations.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={campusPanel.btnPrimary}
                    onClick={() => runAction.mutate('publishLocations')}
                    disabled={busy}
                  >
                    {busy ? <Loader2 size={13} style={{ animation: 'test-spin 0.8s linear infinite' }} /> : <UploadCloud size={13} />}
                    Publish New Snapshot
                  </button>
                </div>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapIcon size={16} /> Bulk Import Locations
                  </div>
                  <p style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, marginTop: 0 }}>
                    Paste or review a JSON array of locations to seed/update the database.
                  </p>

                  {labError && (
                    <div style={{ background: '#7f1d1d22', border: `1px solid #ef4444`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ef4444', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{labError}</div>
                      <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0, marginLeft: 8 }} onClick={() => setLabError(null)}>✕</button>
                    </div>
                  )}
                  {labSuccess && (
                    <div style={{ background: '#14532d22', border: `1px solid #22c55e`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#22c55e', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{labSuccess}</span>
                      <button style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: 14, padding: 0 }} onClick={() => setLabSuccess(null)}>✕</button>
                    </div>
                  )}

                  <textarea
                    style={{ background: T.bgInput, border: `1px solid ${T.border}`, color: T.textPrimary, borderRadius: 8, padding: '10px 12px', fontSize: 11, outline: 'none', width: '100%', minHeight: 200, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', boxSizing: 'border-box' }}
                    placeholder='[{"id": "loc_1", "name": "Main Gate", "latitude": 9.53, "longitude": 6.45, "category": "gate"}]'
                    value={jsonInput}
                    onChange={(e) => { setJsonInput(e.target.value); setLabError(null); setLabSuccess(null) }}
                  />

                  {jsonInput.trim() && (() => {
                    try {
                      const arr = JSON.parse(jsonInput)
                      if (!Array.isArray(arr)) return <div style={{ fontSize: 11, color: '#f97316', marginTop: 6 }}>⚠ JSON must be an array (got {typeof arr})</div>
                      return <div style={{ fontSize: 11, color: '#22c55e', marginTop: 6 }}>✓ Valid JSON — {arr.length} location(s) ready to import</div>
                    } catch (e: any) {
                      return <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>✗ Parse error: {e.message}</div>
                    }
                  })()}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button
                      style={{ ...campusPanel.btnSecondary, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      disabled={isImporting || isPublishing}
                      onClick={async () => {
                        if (!window.confirm("Are you sure you want to completely wipe the locations database?")) return;
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
                            ? `✓ Imported ${res?.created ?? '?'} new, ${res?.updated ?? '?'} updated. (${inactiveCount} marked inactive)`
                            : `✓ Imported ${res?.created ?? '?'} new, ${res?.updated ?? '?'} updated.`
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
                      {isImporting ? <Loader2 size={13} style={{ animation: 'test-spin 0.8s linear infinite' }} /> : <CheckCircle2 size={13} />}
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
                          setLabSuccess(`✓ Published snapshot v${res?.version ?? '?'} — ${res?.count ?? '?'} active location(s) live.`)
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
                      {isPublishing ? <Loader2 size={13} style={{ animation: 'test-spin 0.8s linear infinite' }} /> : <UploadCloud size={13} />}
                      {isPublishing ? 'Publishing…' : 'Publish Snapshot'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sidebarTab === 'console' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{result?.title || 'Console Output'}</span>
                  {result?.isError && <AlertTriangle size={15} color={T.error} />}
                </div>
                <div style={{ padding: 12, background: T.bgInput, flex: 1 }}>
                  <pre style={{ margin: 0, maxHeight: 'calc(100vh - 200px)', overflow: 'auto', color: T.textSecondary, fontSize: 11, lineHeight: 1.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{result ? JSON.stringify(result.payload, null, 2) : 'Run an action to see response details.'}</pre>
                </div>
              </div>
            )}
          </div>
          </div>
        ) : (
          // Full-screen Account and Rides sections (no map)
          <div style={{ pointerEvents: 'auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Command Header */}
            <div style={labStyles.cmdHeader}>
              <div style={labStyles.cmdLeft}>
                <div style={labStyles.cmdClock}>
                  <Clock size={14} />
                  <span style={labStyles.cmdTime}>{timeStr}</span>
                  <span style={labStyles.cmdDate}>{dateStr}</span>
                </div>
              </div>
              <div style={labStyles.cmdCenter}>
                <div style={labStyles.cmdStat}><span style={labStyles.cmdStatVal}>{summary?.campus || 'N/A'}</span><span style={labStyles.cmdStatLbl}>Campus</span></div>
                <div style={labStyles.cmdStat}><span style={labStyles.cmdStatVal}>{summary?.counts.students ?? 0}</span><span style={labStyles.cmdStatLbl}>Students</span></div>
                <div style={labStyles.cmdStat}><span style={labStyles.cmdStatVal}>{summary?.counts.drivers ?? 0}</span><span style={labStyles.cmdStatLbl}>Drivers</span></div>
                <div style={labStyles.cmdStat}><span style={labStyles.cmdStatVal}>{summary?.counts.admins ?? 0}</span><span style={labStyles.cmdStatLbl}>Admins</span></div>
                <div style={labStyles.cmdStat}><span style={{ ...labStyles.cmdStatVal, color: '#a855f7' }}>{summary?.counts.scheduled_rides ?? 0}</span><span style={labStyles.cmdStatLbl}>Schedules</span></div>
                <div style={labStyles.cmdStat}><span style={{ ...labStyles.cmdStatVal, color: '#10b981' }}>{summary?.counts.ondemand_rides ?? 0}</span><span style={labStyles.cmdStatLbl}>On-Demand</span></div>
              </div>
              <div style={labStyles.cmdRight}>
                <div style={labStyles.areaNav}>
                  <button 
                    style={labStyles.areaNavTab(area === 'account')} 
                    onClick={() => setArea('account')}
                  >
                    <Users size={14} />
                    <span>Account</span>
                  </button>
                  <button 
                    style={labStyles.areaNavTab(area === 'rides')} 
                    onClick={() => setArea('rides')}
                  >
                    <Bus size={14} />
                    <span>Rides</span>
                  </button>
                  <button 
                    style={labStyles.areaNavTab(area === ('map' as any))} 
                    onClick={() => setArea('map')}
                  >
                    <MapPin size={14} />
                    <span>Map</span>
                  </button>
                  <button 
                    style={labStyles.areaNavTab(area === ('calibration' as any))} 
                    onClick={() => setArea('calibration')}
                  >
                    <Settings size={14} />
                    <span>Calibration</span>
                  </button>
                </div>
                <button style={labStyles.cmdBtn} onClick={() => summaryQuery.refetch()}><RefreshCcw size={13} /> Refresh</button>
              </div>
            </div>

            <div style={labStyles.mainLayout}>
              {/* Left Column */}
              <div style={labStyles.leftCol} className="hide-scrollbar">
                <div style={labStyles.section}>
                  <div style={labStyles.sectionHeader}>
                    <div style={labStyles.sectionTitleRow}>
                      <Database size={15} />
                      <span style={labStyles.sectionTitle}>Test Tools</span>
                    </div>
                  </div>
                  <div style={labStyles.toolsGrid}>
                    {area === 'account' ? (
                      <>
                        <div 
                          style={{ ...labStyles.toolCard, ...(section === 'student' ? labStyles.toolCardActive : {}) }}
                          onClick={() => switchSection('student')}
                        >
                          <GraduationCap size={20} style={{ color: section === 'student' ? '#a855f7' : T.textMuted }} />
                          <div style={labStyles.toolCardContent}>
                            <div style={labStyles.toolCardTitle}>Students</div>
                            <div style={labStyles.toolCardCount}>{summary?.counts.students ?? 0}</div>
                          </div>
                        </div>
                        <div 
                          style={{ ...labStyles.toolCard, ...(section === 'driver' ? labStyles.toolCardActive : {}) }}
                          onClick={() => switchSection('driver')}
                        >
                          <ShieldCheck size={20} style={{ color: section === 'driver' ? '#a855f7' : T.textMuted }} />
                          <div style={labStyles.toolCardContent}>
                            <div style={labStyles.toolCardTitle}>Drivers</div>
                            <div style={labStyles.toolCardCount}>{summary?.counts.drivers ?? 0}</div>
                          </div>
                        </div>
                        <div 
                          style={{ ...labStyles.toolCard, ...(section === 'admin' ? labStyles.toolCardActive : {}) }}
                          onClick={() => switchSection('admin')}
                        >
                          <UserCog size={20} style={{ color: section === 'admin' ? '#a855f7' : T.textMuted }} />
                          <div style={labStyles.toolCardContent}>
                            <div style={labStyles.toolCardTitle}>Admins</div>
                            <div style={labStyles.toolCardCount}>{summary?.counts.admins ?? 0}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div 
                          style={{ ...labStyles.toolCard, ...(section === 'create' ? labStyles.toolCardActive : {}) }}
                          onClick={() => switchSection('create')}
                        >
                          <Calendar size={20} style={{ color: section === 'create' ? '#a855f7' : T.textMuted }} />
                          <div style={labStyles.toolCardContent}>
                            <div style={labStyles.toolCardTitle}>Scheduled</div>
                            <div style={labStyles.toolCardCount}>{summary?.counts.scheduled_rides ?? 0}</div>
                          </div>
                        </div>
                        <div 
                          style={{ ...labStyles.toolCard, ...(section === 'on-demand' ? labStyles.toolCardActive : {}) }}
                          onClick={() => switchSection('on-demand')}
                        >
                          <Zap size={20} style={{ color: section === 'on-demand' ? '#a855f7' : T.textMuted }} />
                          <div style={labStyles.toolCardContent}>
                            <div style={labStyles.toolCardTitle}>On-Demand</div>
                            <div style={labStyles.toolCardCount}>{summary?.counts.ondemand_rides ?? 0}</div>
                          </div>
                        </div>
                        <div 
                          style={{ ...labStyles.toolCard, ...(section === 'join' ? labStyles.toolCardActive : {}) }}
                          onClick={() => switchSection('join')}
                        >
                          <UserPlus size={20} style={{ color: section === 'join' ? '#a855f7' : T.textMuted }} />
                          <div style={labStyles.toolCardContent}>
                            <div style={labStyles.toolCardTitle}>Join</div>
                            <div style={labStyles.toolCardCount}>Ride</div>
                          </div>
                        </div>
                        <div 
                          style={{ ...labStyles.toolCard, ...(section === 'verify' ? labStyles.toolCardActive : {}) }}
                          onClick={() => switchSection('verify')}
                        >
                          <CheckCircle2 size={20} style={{ color: section === 'verify' ? '#a855f7' : T.textMuted }} />
                          <div style={labStyles.toolCardContent}>
                            <div style={labStyles.toolCardTitle}>Verify</div>
                            <div style={labStyles.toolCardCount}>Records</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle Column */}
              <div style={labStyles.midCol} className="hide-scrollbar">
                <div style={{ ...labStyles.section, flex: 1 }}>
                  {area === 'account' ? (
                    section === 'driver' ? (
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
                    )
                  ) : (
                    section === 'on-demand' ? (
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
                    )
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div style={labStyles.rightCol} className="hide-scrollbar">
                <div style={{ ...labStyles.rightSection, flex: 1 }}>
                  <div style={labStyles.sectionTitleRow}>
                    <BarChart3 size={14} />
                    <span style={labStyles.sectionTitle}>Activity Log</span>
                  </div>
                  <div style={labStyles.logList}>
                    {result ? (
                      <div style={labStyles.logEntry}>
                        <div style={{ ...labStyles.logDot, background: result.isError ? '#ef4444' : '#10b981' }} />
                        <div>
                          <div style={labStyles.logMsg}>{result.title}</div>
                          <div style={labStyles.logTime}>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                          <pre style={labStyles.logJson}>{JSON.stringify(result.payload, null, 2)}</pre>
                        </div>
                      </div>
                    ) : (
                      <div style={labStyles.emptyState}>
                        <Activity size={32} style={{ opacity: 0.3 }} />
                        <span>Actions will appear here as you work</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
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
    <div style={labStyles.premiumPanel}>
      <div style={labStyles.panelHeader}>
        <div style={labStyles.panelIconWrapper}>{icon}</div>
        <div style={labStyles.panelHeaderContent}>
          <h2 style={labStyles.panelTitle}>{title}</h2>
          <p style={labStyles.panelDescription}>{description}</p>
        </div>
      </div>

      <div style={labStyles.statsGrid}>
        {stats.map((stat, idx) => (
          <div key={idx} style={labStyles.statCard}>
            <div style={labStyles.statIcon}>{stat.icon}</div>
            <div style={labStyles.statContent}>
              <div style={labStyles.statValue}>{stat.value}</div>
              <div style={labStyles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={labStyles.actionSection}>
        <div style={labStyles.inputGroup}>
          <label style={labStyles.inputLabel}>Account Count</label>
          <input
            style={labStyles.premiumInput}
            type="number"
            min={1}
            max={2000}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>

        <div style={labStyles.buttonGroup}>
          <button 
            style={labStyles.primaryButton} 
            onClick={onPrimary} 
            disabled={busy}
          >
            {busy ? <Loader2 size={16} style={{ animation: 'test-spin 0.8s linear infinite' }} /> : primaryIcon}
            <span>{primaryLabel}</span>
          </button>
          <button 
            style={labStyles.dangerButton} 
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
    <div style={labStyles.premiumPanel}>
      <div style={labStyles.panelHeader}>
        <div style={labStyles.panelIconWrapper}>{icon}</div>
        <div style={labStyles.panelHeaderContent}>
          <h2 style={labStyles.panelTitle}>{title}</h2>
          <p style={labStyles.panelDescription}>{description}</p>
        </div>
      </div>

      <div style={labStyles.statsGrid}>
        {stats.map((stat, idx) => (
          <div key={idx} style={labStyles.statCard}>
            <div style={labStyles.statIcon}>{stat.icon}</div>
            <div style={labStyles.statContent}>
              <div style={labStyles.statValue}>{stat.value}</div>
              <div style={labStyles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={labStyles.actionSection}>
        <div style={labStyles.fieldsGrid}>
          {fields.map((field, idx) => (
            <div key={idx} style={labStyles.inputGroup}>
              <label style={labStyles.inputLabel}>{field.label}</label>
              <input
                style={labStyles.premiumInput}
                type="number"
                min={1}
                max={2000}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            </div>
          ))}
        </div>

        <div style={labStyles.buttonGroup}>
          <button 
            style={labStyles.primaryButton} 
            onClick={onCreate} 
            disabled={busy}
          >
            {busy ? <Loader2 size={16} style={{ animation: 'test-spin 0.8s linear infinite' }} /> : primaryIcon}
            <span>{primaryLabel}</span>
          </button>
          <button 
            style={labStyles.dangerButton} 
            onClick={onDelete} 
            disabled={busy}
          >
            {dangerIcon}
            <span>{dangerLabel}</span>
          </button>
          <button 
            style={labStyles.flushButton} 
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
    <div style={labStyles.premiumPanel}>
      <div style={labStyles.panelHeader}>
        <div style={labStyles.panelIconWrapper}>{icon}</div>
        <div style={labStyles.panelHeaderContent}>
          <h2 style={labStyles.panelTitle}>{title}</h2>
          <p style={labStyles.panelDescription}>{description}</p>
        </div>
      </div>

      <div style={labStyles.actionSection}>
        <div style={labStyles.fieldsGrid}>
          <div style={labStyles.inputGroup}>
            <label style={labStyles.inputLabel}>Select Ride</label>
            <select
              style={labStyles.premiumSelect}
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
          <div style={labStyles.inputGroup}>
            <label style={labStyles.inputLabel}>Student Count</label>
            <input
              style={labStyles.premiumInput}
              type="number"
              min={1}
              max={2000}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
        </div>

        <div style={labStyles.buttonGroup}>
          <button 
            style={labStyles.primaryButton} 
            onClick={onJoin} 
            disabled={busy || !selectedRide}
          >
            {busy ? <Loader2 size={16} style={{ animation: 'test-spin 0.8s linear infinite' }} /> : <UserPlus size={16} />}
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
    <div style={labStyles.premiumPanel}>
      <div style={labStyles.panelHeader}>
        <div style={labStyles.panelIconWrapper}>{icon}</div>
        <div style={labStyles.panelHeaderContent}>
          <h2 style={labStyles.panelTitle}>{title}</h2>
          <p style={labStyles.panelDescription}>{description}</p>
        </div>
      </div>

      <div style={labStyles.verifySection}>
        <div style={labStyles.verifyHeader}>
          <div style={labStyles.verifyTitle}>
            <Calendar size={16} />
            <span>Scheduled Rides</span>
          </div>
          <span style={labStyles.verifyCount}>{rides.length} records</span>
        </div>
        
        {rides.length === 0 ? (
          <div style={labStyles.emptyState}>
            <Calendar size={32} style={{ opacity: 0.3 }} />
            <span>No scheduled rides generated yet</span>
          </div>
        ) : (
          <div style={labStyles.tableContainer}>
            <table style={labStyles.premiumTable}>
              <thead>
                <tr>
                  <th style={labStyles.th}>Reference</th>
                  <th style={labStyles.th}>Route</th>
                  <th style={labStyles.th}>Date</th>
                  <th style={labStyles.th}>Vehicle</th>
                  <th style={labStyles.th}>Passengers</th>
                  <th style={labStyles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((ride) => (
                  <tr key={ride.id}>
                    <td style={labStyles.td}>{ride.reference}</td>
                    <td style={labStyles.td}>{ride.route}</td>
                    <td style={labStyles.td}>{ride.departure_date} {ride.window}</td>
                    <td style={labStyles.td}>{ride.vehicle_size}</td>
                    <td style={labStyles.td}>{ride.passenger_count}</td>
                    <td style={labStyles.td}>
                      <span style={{
                        ...labStyles.statusBadge,
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

        <div style={labStyles.verifyHeader}>
          <div style={labStyles.verifyTitle}>
            <Zap size={16} />
            <span>On-Demand Rides</span>
          </div>
          <span style={labStyles.verifyCount}>{ondemandRides.length} records</span>
        </div>
        
        {ondemandRides.length === 0 ? (
          <div style={labStyles.emptyState}>
            <Zap size={32} style={{ opacity: 0.3 }} />
            <span>No on-demand rides generated yet</span>
          </div>
        ) : (
          <div style={labStyles.tableContainer}>
            <table style={labStyles.premiumTable}>
              <thead>
                <tr>
                  <th style={labStyles.th}>Reference</th>
                  <th style={labStyles.th}>Route</th>
                  <th style={labStyles.th}>Student</th>
                  <th style={labStyles.th}>Vehicle</th>
                  <th style={labStyles.th}>Passengers</th>
                  <th style={labStyles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ondemandRides.map((ride) => (
                  <tr key={ride.id}>
                    <td style={labStyles.td}>{ride.reference}</td>
                    <td style={labStyles.td}>{ride.route}</td>
                    <td style={labStyles.td}>{ride.student}</td>
                    <td style={labStyles.td}>{ride.vehicle_type}</td>
                    <td style={labStyles.td}>{ride.passenger_count}</td>
                    <td style={labStyles.td}>
                      <span style={{
                        ...labStyles.statusBadge,
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

// Premium Lab Styles matching RouteOpsPanel design
const labStyles: Record<string, any> = {
  // Command Header (matching RouteOpsPanel)
  cmdHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: T.bgPanel, border: `1px solid ${T.border}`, flexShrink: 0 },
  cmdLeft: { flex: 1, display: 'flex', alignItems: 'center', gap: 12 },
  cmdCenter: { flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 },
  cmdRight: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  cmdClock: { display: 'flex', alignItems: 'center', gap: 6, color: T.textWhite },
  cmdTime: { fontSize: 13, fontWeight: 700, letterSpacing: -0.3 },
  cmdDate: { fontSize: 11, color: T.textMuted, marginLeft: 4 },
  cmdStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  cmdStatVal: { fontSize: 14, fontWeight: 700, color: T.textWhite, lineHeight: 1 },
  cmdStatLbl: { fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  cmdBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 0, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.fontFamily },
  
  // Area Navigation
  areaNav: { display: 'flex', gap: 2, background: T.bgInput, padding: 4, borderRadius: 0 },
  areaNavTab: (active: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, fontFamily: T.fontFamily, cursor: 'pointer', color: active ? T.textPrimary : T.textMuted, background: active ? T.bgCard : 'transparent', border: active ? `1px solid ${T.border}` : '1px solid transparent', borderRadius: 0, transition: 'all 0.1s',
  }),

  // Main Layout (matching RouteOpsPanel)
  mainLayout: { display: 'flex', flex: 1, overflow: 'hidden', gap: 2 },
  leftCol: { width: 260, display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 2, flexShrink: 0 },
  midCol: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 2, minWidth: 0 },
  rightCol: { width: 320, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 2, flexShrink: 0 },

  // Sections
  section: { background: T.bgPanel, border: `1px solid ${T.border}`, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 0, height: '100%', boxSizing: 'border-box' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  sectionTitleRow: { display: 'flex', alignItems: 'center', gap: 8, color: T.textPrimary, fontWeight: 700, fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: 700 },

  // Tools Grid
  toolsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 },
  toolCard: { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.1s', height: '100%', boxSizing: 'border-box' },
  toolCardActive: { borderColor: '#a855f7', background: 'rgba(168,85,247,0.08)', borderWidth: 1 },
  toolCardContent: { flex: 1, minWidth: 0 },
  toolCardTitle: { fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  toolCardCount: { fontSize: 24, fontWeight: 800, color: '#a855f7', fontFamily: 'monospace', lineHeight: 1 },

  // Premium Panel
  premiumPanel: { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, height: '100%', boxSizing: 'border-box' },

  // Panel Header
  panelHeader: { display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottom: `1px solid ${T.border}` },
  panelIconWrapper: { width: 40, height: 40, borderRadius: 0, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7', flexShrink: 0, border: `1px solid rgba(168,85,247,0.3)` },
  panelHeaderContent: { flex: 1, minWidth: 0 },
  panelTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.3, marginBottom: 2 },
  panelDescription: { margin: 0, fontSize: 11, color: T.textMuted, lineHeight: 1.4 },

  // Stats Grid
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 },
  statCard: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 0, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, height: '100%', boxSizing: 'border-box' },
  statIcon: { width: 32, height: 32, borderRadius: 0, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7', flexShrink: 0 },
  statContent: { flex: 1, minWidth: 0 },
  statValue: { fontSize: 18, fontWeight: 800, color: T.textPrimary, marginBottom: 2, fontFamily: 'monospace' },
  statLabel: { fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Action Section
  actionSection: { display: 'flex', flexDirection: 'column', gap: 12 },
  fieldsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  inputLabel: { fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  premiumInput: { background: T.bgInput, border: `1px solid ${T.border}`, color: T.textPrimary, borderRadius: 0, padding: '8px 12px', fontSize: 12, outline: 'none', width: '100%', fontFamily: T.fontFamily, boxSizing: 'border-box' },
  premiumSelect: { background: T.bgInput, border: `1px solid ${T.border}`, color: T.textPrimary, borderRadius: 0, padding: '8px 12px', fontSize: 12, outline: 'none', width: '100%', fontFamily: T.fontFamily, boxSizing: 'border-box', cursor: 'pointer' },

  // Button Group
  buttonGroup: { display: 'flex', gap: 2, flexWrap: 'wrap' },
  primaryButton: { display: 'flex', alignItems: 'center', gap: 6, background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}`, padding: '8px 16px', borderRadius: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', fontFamily: T.fontFamily, transition: 'all 0.1s' },
  dangerButton: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: `1px solid rgba(239, 68, 68, 0.4)`, padding: '8px 16px', borderRadius: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', fontFamily: T.fontFamily },
  flushButton: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: `1px solid rgba(234, 179, 8, 0.4)`, padding: '8px 16px', borderRadius: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', fontFamily: T.fontFamily },

  // Verify Section
  verifySection: { display: 'flex', flexDirection: 'column', gap: 2 },
  verifyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', background: T.bgCard, borderRadius: 0, border: `1px solid ${T.border}` },
  verifyTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  verifyCount: { fontSize: 11, fontWeight: 700, color: '#a855f7', background: 'rgba(168,85,247,0.12)', padding: '2px 8px', borderRadius: 0, border: `1px solid rgba(168,85,247,0.3)` },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, color: T.textMuted, fontSize: 11, background: T.bgInput, borderRadius: 0, border: `1px dashed ${T.border}` },
  tableContainer: { background: T.bgCard, borderRadius: 0, border: `1px solid ${T.border}`, overflow: 'hidden' },
  premiumTable: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${T.border}`, background: T.bgInput },
  td: { padding: '8px 12px', fontSize: 12, color: T.textPrimary, borderBottom: `1px solid ${T.border}` },
  statusBadge: { padding: '2px 8px', borderRadius: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, border: '1px solid' },

  // Right Section
  rightSection: { background: T.bgPanel, border: `1px solid ${T.border}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 0, height: '100%', boxSizing: 'border-box' },
  logList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 },
  logEntry: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${T.borderLight}` },
  logDot: { width: 6, height: 6, borderRadius: 0, flexShrink: 0, marginTop: 4 },
  logMsg: { fontSize: 11, color: T.textPrimary, lineHeight: 1.4, marginBottom: 2, fontFamily: 'monospace' },
  logTime: { fontSize: 9, color: T.textMuted, fontFamily: 'monospace' },
  logJson: { margin: 0, fontSize: 10, color: T.textSecondary, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: T.bgInput, padding: 8, border: `1px solid ${T.border}` },
}
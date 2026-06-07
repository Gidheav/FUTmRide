import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import {
  CalendarClock,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, X, Search,
  Layers, Pencil, MousePointer2, Ruler, Square, Circle,
  ZoomIn, ZoomOut, Crosshair, Maximize2, Undo2, Redo2, Trash2,
} from 'lucide-react'
import { GoogleMap, useJsApiLoader, DrawingManager, Polyline, Marker, InfoWindow } from '@react-google-maps/api'
import { useLocation, useNavigate } from 'react-router-dom'
import { T, useCampusThemeStore } from '../theme'
import { createAuthenticatedWebSocket } from '../../core/ws'
import { apiService } from '../../services/api.service'

const GMAP_LIBS: ('drawing' | 'geometry' | 'places')[] = ['drawing', 'geometry', 'places']

type MapTool = 'select' | 'draw' | 'rectangle' | 'circle' | 'measure' | 'search'

interface MeasuredRoadRoute {
  id: string
  path: google.maps.LatLngLiteral[]
  distanceText: string
  durationText: string
  distanceMeters: number
  durationSeconds: number
  summary: string
  roadSteps: { name: string; distanceText: string; durationText: string }[]
  color: string
}

const ROUTE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#06b6d4']

/* ──────────────────────────────────────────────────────────────────────────────
   Colour & Design Tokens
   ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
   Static mock request data (matching screenshot exactly)
   ────────────────────────────────────────────────────────────────────────────── */

export interface GarageRide {
  id: string
  reference: string
  qr_token: string
  driver: {
    id: string
    full_name: string
    average_rating: string | null
    vehicle_type: string | null
  }
  origin_address: string
  origin_latitude: number
  origin_longitude: number
  destination_address: string
  destination_latitude: number
  destination_longitude: number
  vehicle_type: string
  total_seats: number
  booked_seats: number
  available_seats: number
  fare_per_seat: string
  status: string
  driver_note: string
  created_at: string
}

// Distance helper since we compute distance/time locally for admin overlay
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371 // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in km
}

/* ──────────────────────────────────────────────────────────────────────────────
   Mock demand data lines (terminal-style feed)
   ────────────────────────────────────────────────────────────────────────────── */

const DEMAND_LINES = [
  'Standard: $85.00 | KhoorMin: 3176 ms Coordinates: 10 NumPoints: 20%  Time: 258 min',
  'Rotalnone: 2931H512, Match: $193 ms Insertdir: 2-ReqRadius: 4.9% Time: $43.00',
  'GeoChronos: 183.m3h | NountRin:31.ms | Geodenie:D+PqaMinart: 3.94% Times: 15.99',
  'TotalMacort: 87126kss, Rotch: 222.ms | AutoComps:B.Keitdant:331my Time: $459.80',
  'Passeneres: 233.0M52, Metch: $107 ms Luggatzyr Resistance: 1.5% Time: $98.00',
  'Coordinate: 257 min | NountRin: 4.Aws ImageDves-PeatDacord:28x30v Time: 25 min',
  'Passenades: 250i0i3x, Mitch: $309 ms Logdriver Restdace: 4.2% Time: $5.00',
  'Coordinates: 33.min | NountRin: 1.1ms, Contny-Sec Pressers: 90%kgv Time: 25.%',
]

/* ──────────────────────────────────────────────────────────────────────────────
   Heatmap dot positions (simulated map overlays)
   ────────────────────────────────────────────────────────────────────────────── */

const HEAT_DOTS = [
  { x: 18, y: 42, r: 60, o: 0.35 },
  { x: 28, y: 55, r: 45, o: 0.28 },
  { x: 42, y: 35, r: 70, o: 0.32 },
  { x: 55, y: 60, r: 50, o: 0.25 },
  { x: 65, y: 40, r: 55, o: 0.30 },
  { x: 72, y: 68, r: 40, o: 0.22 },
  { x: 35, y: 72, r: 48, o: 0.26 },
  { x: 80, y: 30, r: 35, o: 0.20 },
  { x: 48, y: 50, r: 65, o: 0.33 },
  { x: 22, y: 28, r: 38, o: 0.24 },
  { x: 60, y: 22, r: 42, o: 0.27 },
  { x: 15, y: 65, r: 52, o: 0.29 },
]

/* ──────────────────────────────────────────────────────────────────────────────
   Toggle component
   ────────────────────────────────────────────────────────────────────────────── */

function Toggle({ active, onToggle, color }: { active: boolean; onToggle: () => void; color?: string }) {
  const bg = active ? (color || T.accent) : '#334155'
  return (
    <button
      onClick={onToggle}
      style={{
        width: 34, height: 18, borderRadius: 9, background: bg,
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: active ? 18 : 2,
        width: 14, height: 14, borderRadius: 7,
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   Sidebar icons
   ────────────────────────────────────────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */

const MAP_CENTER = { lat: 9.5323, lng: 6.4526 } // FUT Minna Main Campus
const DEFAULT_ZOOM = 15

export default function DashboardPage() {
  const { mode } = useCampusThemeStore()
  const feedRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const isOpenRequestsPanelParam = searchParams.get('panel') === 'open'

  // Panel collapsed states (collapsed by default)
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)
  const [isDataFeedOpen, setIsDataFeedOpen] = useState(false)

  const setOpenRequestsPanel = (open: boolean) => {
    const params = new URLSearchParams(location.search)
    if (open) {
      params.set('panel', 'open')
    } else {
      params.delete('panel')
    }

    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true })
  }

  useEffect(() => {
    if (location.pathname !== '/') return
    setIsLeftPanelOpen(isOpenRequestsPanelParam)
  }, [location.pathname, location.search, isOpenRequestsPanelParam])

  // Toggles for traffic layers
  const [layers, setLayers] = useState({
    realMatch: true, congestionLine: false, congestion: false,
    congestion2: false, coordinate: false,
  })
  const [activeLayers, setActiveLayers] = useState({
    realMatch: true, demanCluster: false, congestion: false, coordinates: false,
  })
  const [trafficOpen, setTrafficOpen] = useState(false)
  const [activeLayersOpen, setActiveLayersOpen] = useState(false)
  const [dataControlsOpen, setDataControlsOpen] = useState(false)

  // ── Scheduled Route Creation State ──
  const getNextHour = () => {
    const d = new Date()
    d.setHours(d.getHours() + 1)
    d.setMinutes(0)
    return d.toTimeString().slice(0, 5)
  }
  const getNextHourPlus30 = () => {
    const d = new Date()
    d.setHours(d.getHours() + 1)
    d.setMinutes(30)
    return d.toTimeString().slice(0, 5)
  }

  const [departureDate, setDepartureDate] = useState(new Date().toISOString().split('T')[0])
  const [windowStart, setWindowStart] = useState(getNextHour())
  const [windowEnd, setWindowEnd] = useState(getNextHourPlus30())
  const [waypoints, setWaypoints] = useState([{ name: '', address: '' }, { name: '', address: '' }])
  const [vehicleSize, setVehicleSize] = useState('bus')
  const [cargoCapacity, setCargoCapacity] = useState('0')
  const [accessibility, setAccessibility] = useState<Record<string, boolean>>({
    wheelchair_ramp: false, liftgate: false, low_floor: false, air_conditioning: true,
  })
  
  const [pricingTiers, setPricingTiers] = useState<Record<string, boolean>>({
    standard: true, standing: false, premium: false, freight: false,
  })
  const [pricingValues, setPricingValues] = useState<Record<string, string>>({
    standard: '100', standing: '50', premium: '250', freight: '500',
  })
  const [isCreatingRide, setIsCreatingRide] = useState(false)

  const handleCreateScheduledRide = async () => {
    try {
      setIsCreatingRide(true)
      const payload = {
        departure_date: departureDate,
        window_start: windowStart,
        window_end: windowEnd,
        origin_address: waypoints[0]?.address || 'Campus Gate',
        origin_latitude: 9.5323,
        origin_longitude: 6.4526,
        destination_address: waypoints[waypoints.length - 1]?.address || 'Library',
        destination_latitude: 9.5350,
        destination_longitude: 6.4550,
        vehicle_size: vehicleSize,
        cargo_capacity_kg: parseInt(cargoCapacity, 10) || 0,
        accessibility_features: Object.entries(accessibility).filter(([_, v]) => v).map(([k]) => k),
        standard_enabled: pricingTiers.standard,
        standard_price: pricingValues.standard,
        standing_enabled: pricingTiers.standing,
        standing_price: pricingValues.standing,
        premium_enabled: pricingTiers.premium,
        premium_price: pricingValues.premium,
        freight_enabled: pricingTiers.freight,
        freight_price: pricingValues.freight,
        stops: waypoints.map((w, i) => {
          let addr = w.address
          if (!addr) {
            addr = i === 0 ? 'Campus Gate' : i === waypoints.length - 1 ? 'Library' : `Stop ${i + 1} Address`
          }
          return {
            order: i + 1,
            name: w.name || `Stop ${i + 1}`,
            address: addr,
            latitude: parseFloat((9.5323 + (i * 0.001)).toFixed(6)),
            longitude: parseFloat((6.4526 + (i * 0.001)).toFixed(6)),
            is_pickup: true,
            is_dropoff: true,
          }
        }),
      }
      
      await apiService.createScheduledRide(payload)
      alert('Scheduled Ride created successfully!')
      // Reset form or handle success UI
    } catch (error: any) {
      console.error('Failed to create scheduled ride', error)
      const errData = error.response?.data
      const errMsg = errData?.detail || (errData ? JSON.stringify(errData) : error.message)
      alert(`Error creating ride: ${errMsg || 'Validation failed'}`)
    } finally {
      setIsCreatingRide(false)
    }
  }

  // Map controls state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTool, setActiveTool] = useState<MapTool | null>(null) // null = pan/select
  const [searchQuery, setSearchQuery] = useState('')
  const [measurePoints, setMeasurePoints] = useState<google.maps.LatLngLiteral[]>([])
  const [measureDist, setMeasureDist] = useState<string | null>(null)
  const [measureRoutes, setMeasureRoutes] = useState<MeasuredRoadRoute[]>([])
  const [selectedMeasureRouteIndex, setSelectedMeasureRouteIndex] = useState(0)
  const [isMeasureLoading, setIsMeasureLoading] = useState(false)
  const [measureError, setMeasureError] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number, address: string, placeName?: string } | null>(null)

  // Real-time Garage Rides feed
  const [activeGarageRides, setActiveGarageRides] = useState<GarageRide[]>([])

  useEffect(() => {
    const ws = createAuthenticatedWebSocket('/ws/campus-admin/rides/')
    if (!ws) return

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'initial_rides') {
          setActiveGarageRides(data.rides)
        } else if (data.type === 'ride_created') {
          setActiveGarageRides(prev => [data.ride, ...prev])
        } else if (data.type === 'ride_updated') {
          setActiveGarageRides(prev => prev.map(r => r.id === data.ride.id ? data.ride : r))
        } else if (data.type === 'ride_departed' || data.type === 'ride_cancelled') {
          setActiveGarageRides(prev => prev.filter(r => r.id !== (data.ride?.id || data.ride_id)))
        }
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  // Tool visibility: each tool's work shown/hidden independently
  const [toolVisibility, setToolVisibility] = useState<Record<string, boolean>>({
    measure: true, draw: true, rectangle: true, circle: true,
  })

  // Undo / Redo stacks
  interface UndoAction {
    type: 'measure' | 'drawing' | 'clear-measure' | 'clear-drawings'
    measureSnapshot?: { points: google.maps.LatLngLiteral[]; routes: MeasuredRoadRoute[]; dist: string | null; selectedIdx: number }
    overlays?: google.maps.MVCObject[]
  }
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [redoStack, setRedoStack] = useState<UndoAction[]>([])

  const mapRef = useRef<google.maps.Map | null>(null)
  const drawnOverlays = useRef<google.maps.MVCObject[]>([])
  const measureListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const measureRequestIdRef = useRef(0)

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  const handleZoomIn = () => {
    if (mapRef.current) {
      const z = mapRef.current.getZoom() ?? DEFAULT_ZOOM
      mapRef.current.setZoom(Math.min(z + 1, 21))
    }
  }
  const handleZoomOut = () => {
    if (mapRef.current) {
      const z = mapRef.current.getZoom() ?? DEFAULT_ZOOM
      mapRef.current.setZoom(Math.max(z - 1, 1))
    }
  }
  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.panTo(MAP_CENTER)
      mapRef.current.setZoom(DEFAULT_ZOOM)
    }
  }
  const handleFullscreen = () => setIsFullscreen(f => !f)

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (activeTool !== 'select' || !e.latLng) return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()

    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        setSelectedLocation({
          lat, lng,
          address: results[0].formatted_address,
          placeName: 'Selected Location'
        })
      } else {
        setSelectedLocation({ lat, lng, address: `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}` })
      }
    })
  }, [activeTool])

  const formatRouteStatus = useCallback((route: MeasuredRoadRoute, routeIndex: number, routeCount: number) => {
    return `${route.distanceText} | ${route.durationText} (Route ${routeIndex + 1}/${routeCount})`
  }, [])

  /* ── OSRM-based routing (free, no API key needed) ─────────────────────── */

  const formatDistance = useCallback((meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`
    return `${(meters / 1000).toFixed(1)} km`
  }, [])

  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)} sec`
    const mins = Math.round(seconds / 60)
    if (mins < 60) return `${mins} min`
    const hrs = Math.floor(mins / 60)
    const rem = mins % 60
    return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`
  }, [])

  const fetchOSRMRoutes = useCallback(async (
    origin: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral,
    requestId: number
  ): Promise<MeasuredRoadRoute[] | null> => {
    try {
      // 1) Snap both points to nearest road for accuracy
      const snapPoint = async (pt: google.maps.LatLngLiteral) => {
        try {
          const r = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${pt.lng},${pt.lat}?number=1`)
          if (!r.ok) return pt
          const d = await r.json()
          if (d.code === 'Ok' && d.waypoints?.[0]?.location) {
            const [sLng, sLat] = d.waypoints[0].location
            return { lat: sLat, lng: sLng }
          }
        } catch { /* use original */ }
        return pt
      }

      const [snappedOrigin, snappedDest] = await Promise.all([
        snapPoint(origin), snapPoint(destination),
      ])

      if (requestId !== measureRequestIdRef.current) return null

      // 2) Route with full precision
      const url = `https://router.project-osrm.org/route/v1/driving/` +
        `${snappedOrigin.lng},${snappedOrigin.lat};${snappedDest.lng},${snappedDest.lat}` +
        `?overview=full&geometries=geojson&alternatives=true&steps=true&annotations=distance,duration`

      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`)
      const data = await resp.json()

      if (requestId !== measureRequestIdRef.current) return null
      if (data.code !== 'Ok' || !data.routes?.length) return null

      return data.routes.map((route: any, routeIndex: number) => {
        const path: google.maps.LatLngLiteral[] = route.geometry.coordinates.map(
          (coord: [number, number]) => ({ lat: coord[1], lng: coord[0] })
        )
        const distMeters: number = route.distance ?? 0
        const durSeconds: number = route.duration ?? 0

        // Extract step-by-step road details
        const roadSteps: { name: string; distanceText: string; durationText: string }[] = []
        const seenNames = new Set<string>()
        if (route.legs) {
          for (const leg of route.legs) {
            for (const step of (leg.steps || [])) {
              const name = step.name || step.ref || ''
              if (name && !seenNames.has(name)) {
                seenNames.add(name)
                roadSteps.push({
                  name,
                  distanceText: formatDistance(step.distance ?? 0),
                  durationText: formatDuration(step.duration ?? 0),
                })
              }
            }
          }
        }

        const summaryNames = roadSteps.slice(0, 3).map(s => s.name)

        return {
          id: `measure-route-${routeIndex}`,
          path,
          distanceText: formatDistance(distMeters),
          durationText: formatDuration(durSeconds),
          distanceMeters: distMeters,
          durationSeconds: durSeconds,
          summary: summaryNames.length > 0 ? `via ${summaryNames.join(', ')}` : `Route ${routeIndex + 1}`,
          roadSteps,
          color: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
        }
      })
    } catch (err) {
      console.warn('OSRM routing failed, will try Google Directions fallback', err)
      return null
    }
  }, [formatDistance, formatDuration])

  const fetchGoogleDirectionsFallback = useCallback((
    origin: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral,
    requestId: number
  ): Promise<MeasuredRoadRoute[] | null> => {
    return new Promise((resolve) => {
      try {
        const service = new google.maps.DirectionsService()
        service.route(
          {
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true,
            unitSystem: google.maps.UnitSystem.METRIC,
          },
          (result, status) => {
            if (requestId !== measureRequestIdRef.current) { resolve(null); return }
            if (status !== 'OK' || !result?.routes?.length) {
              console.warn('Google Directions fallback also failed', { status })
              resolve(null)
              return
            }
            const routes: MeasuredRoadRoute[] = result.routes.map((route, idx) => {
              const detailedPath = route.legs.flatMap((leg) =>
                leg.steps.flatMap((step) => step.path.map((p) => ({ lat: p.lat(), lng: p.lng() })))
              )
              const fallbackPath = route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() }))
              const firstLeg = route.legs[0]
              const distM = firstLeg?.distance?.value ?? 0
              const durS = firstLeg?.duration?.value ?? 0
              const steps = firstLeg?.steps?.map(st => ({
                name: st.instructions?.replace(/<[^>]*>/g, '') || 'Road',
                distanceText: st.distance?.text ?? '',
                durationText: st.duration?.text ?? '',
              })) ?? []
              return {
                id: `measure-route-${idx}`,
                path: detailedPath.length > 0 ? detailedPath : fallbackPath,
                distanceText: firstLeg?.distance?.text ?? 'N/A',
                durationText: firstLeg?.duration?.text ?? 'N/A',
                distanceMeters: distM,
                durationSeconds: durS,
                summary: route.summary || `Route ${idx + 1}`,
                roadSteps: steps,
                color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
              }
            })
            resolve(routes)
          }
        )
      } catch {
        resolve(null)
      }
    })
  }, [])

  const fetchMeasureRoutes = useCallback(async (origin: google.maps.LatLngLiteral, destination: google.maps.LatLngLiteral) => {
    const requestId = measureRequestIdRef.current + 1
    measureRequestIdRef.current = requestId

    setIsMeasureLoading(true)
    setMeasureError(null)
    setMeasureDist(null)
    setMeasureRoutes([])
    setSelectedMeasureRouteIndex(0)

    // 1) Try OSRM first (free, no API key)
    let routes = await fetchOSRMRoutes(origin, destination, requestId)

    // 2) If OSRM failed, try Google Directions as fallback
    if (!routes || routes.length === 0) {
      routes = await fetchGoogleDirectionsFallback(origin, destination, requestId)
    }

    if (requestId !== measureRequestIdRef.current) return
    setIsMeasureLoading(false)

    if (!routes || routes.length === 0) {
      setMeasureRoutes([])
      setMeasureDist(null)
      setMeasureError('No drivable road route found. Try clicking closer to visible roads.')
      return
    }

    setMeasureRoutes(routes)
    const primary = routes[0]
    setSelectedMeasureRouteIndex(0)
    setMeasureDist(formatRouteStatus(primary, 0, routes.length))

    const bounds = new google.maps.LatLngBounds()
    routes.forEach((route) => {
      route.path.forEach((point) => bounds.extend(point))
    })
    if (!bounds.isEmpty()) {
      mapRef.current?.fitBounds(bounds, 56)
    }
  }, [formatRouteStatus, fetchOSRMRoutes, fetchGoogleDirectionsFallback])

  /* ── Measure listener management ─────────────────────────────────────── */
  const removeMeasureListener = useCallback(() => {
    if (measureListenerRef.current) {
      google.maps.event.removeListener(measureListenerRef.current)
      measureListenerRef.current = null
    }
  }, [])

  const attachMeasureListener = useCallback(() => {
    removeMeasureListener()
    if (!mapRef.current) return

    const pts: google.maps.LatLngLiteral[] = []
    measureListenerRef.current = mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      const p = { lat: e.latLng.lat(), lng: e.latLng.lng() }

      if (pts.length === 0) {
        pts.push(p)
        setMeasurePoints([...pts])
        setMeasureDist('Start point set. Click destination point.')
        setMeasureRoutes([])
        setSelectedMeasureRouteIndex(0)
        setMeasureError(null)
        return
      }

      if (pts.length === 1) {
        pts.push(p)
        setMeasurePoints([...pts])
        // Push undo snapshot BEFORE fetching (captures previous state)
        setUndoStack(prev => [...prev, { type: 'measure', measureSnapshot: { points: [], routes: [], dist: null, selectedIdx: 0 } }])
        setRedoStack([])
        fetchMeasureRoutes(pts[0], pts[1])
        return
      }

      // 3rd+ click: save current work as undo, start new measurement
      setUndoStack(prev => [...prev, {
        type: 'measure',
        measureSnapshot: {
          points: [...pts.slice(0, 2)],
          routes: [], // routes are async, snapshot is best-effort
          dist: null,
          selectedIdx: 0,
        },
      }])
      setRedoStack([])
      measureRequestIdRef.current += 1

      // Destroy old polylines manually
      measurePolylinesRef.current.forEach(polyline => {
        try { polyline.setMap(null) } catch (e) { }
      })
      measurePolylinesRef.current = []

      pts.splice(0, pts.length, p)
      setMeasurePoints([...pts])
      setMeasureDist('Start point set. Click destination point.')
      setMeasureRoutes([])
      setSelectedMeasureRouteIndex(0)
      setMeasureError(null)
      setIsMeasureLoading(false)
    })
  }, [removeMeasureListener, fetchMeasureRoutes])

  /* ── Tool selection (toggle-based, work persists) ───────────────────── */
  const selectTool = useCallback((tool: MapTool) => {
    setActiveTool(prev => {
      const isSameTool = prev === tool

      // Toggle OFF: clicking same tool → deactivate, hide its work
      if (isSameTool) {
        if (tool === 'measure') {
          removeMeasureListener()
          setToolVisibility(v => ({ ...v, measure: false }))
        } else if (tool === 'draw' || tool === 'rectangle' || tool === 'circle') {
          setToolVisibility(v => ({ ...v, [tool]: false }))
        }
        return null // go to pan/select
      }

      // Switch to new tool: keep previous tool's work visible
      // Detach measure listener if leaving measure mode
      if (prev === 'measure') removeMeasureListener()

      // Ensure the new tool's visibility is ON
      if (tool === 'measure') {
        setToolVisibility(v => ({ ...v, measure: true }))
      } else if (tool === 'draw' || tool === 'rectangle' || tool === 'circle') {
        setToolVisibility(v => ({ ...v, [tool]: true }))
      }

      return tool
    })

    // Attach measure listener if activating measure
    // (uses setTimeout so setActiveTool completes first)
    if (tool !== activeTool) {
      if (tool === 'measure') setTimeout(() => attachMeasureListener(), 0)
      if (tool === 'search') setSearchQuery('')
    }
  }, [activeTool, removeMeasureListener, attachMeasureListener])

  // Handle overlay completion from DrawingManager
  const onOverlayComplete = useCallback((e: google.maps.drawing.OverlayCompleteEvent) => {
    const overlay = e.overlay!
    drawnOverlays.current.push(overlay)
    setUndoStack(prev => [...prev, { type: 'drawing', overlays: [overlay] }])
    setRedoStack([])
    // Stay in drawing mode (don't reset to select)
  }, [])

  // Search handler
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || !mapRef.current) return
    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location
        mapRef.current?.panTo(loc)
        mapRef.current?.setZoom(17)
        new google.maps.Marker({
          position: loc,
          map: mapRef.current!,
          title: results[0].formatted_address,
          animation: google.maps.Animation.DROP,
        })
      } else {
        alert('Location not found. Try a more specific query.')
      }
    })
  }, [searchQuery])

  const measurePolylinesRef = useRef<google.maps.Polyline[]>([])

  /* ── Clear: only active tool ────────────────────────────────────────── */
  const clearMeasureState = useCallback(() => {
    measureRequestIdRef.current += 1

    // Explicitly destroy Google Maps Polyline instances to avoid ghosting
    measurePolylinesRef.current.forEach(p => {
      try { p.setMap(null) } catch (e) { }
    })
    measurePolylinesRef.current = []

    setMeasurePoints([])
    setMeasureDist(null)
    setMeasureRoutes([])
    setSelectedMeasureRouteIndex(0)
    setIsMeasureLoading(false)
    setMeasureError(null)
  }, [])

  const handleClear = useCallback((specificTarget?: string | React.MouseEvent) => {
    // Determine what to clear based on argument (if it's a string) or the active tool
    const target = typeof specificTarget === 'string' ? specificTarget : activeTool

    if (target === 'measure') {
      // Save snapshot for undo
      setUndoStack(prev => [...prev, {
        type: 'clear-measure',
        measureSnapshot: { points: [...measurePoints], routes: [...measureRoutes], dist: measureDist, selectedIdx: selectedMeasureRouteIndex },
      }])
      setRedoStack([])
      clearMeasureState()
      // Re-attach listener if we are currently in measure mode
      if (activeTool === 'measure') {
        setTimeout(() => attachMeasureListener(), 0)
      }
    } else if (target === 'draw' || target === 'rectangle' || target === 'circle') {
      const removed = [...drawnOverlays.current]
      setUndoStack(prev => [...prev, { type: 'clear-drawings', overlays: removed }])
      setRedoStack([])
      drawnOverlays.current.forEach(o => (o as any).setMap?.(null))
      drawnOverlays.current = []
    } else {
      // Clear everything
      const removed = [...drawnOverlays.current]
      setUndoStack(prev => [...prev, { type: 'clear-drawings', overlays: removed }])
      setRedoStack([])
      drawnOverlays.current.forEach(o => (o as any).setMap?.(null))
      drawnOverlays.current = []
      clearMeasureState()
      if (activeTool === 'measure') {
        setTimeout(() => attachMeasureListener(), 0)
      } else {
        removeMeasureListener()
        setToolVisibility(v => ({ ...v, measure: true }))
      }
    }
  }, [activeTool, measurePoints, measureRoutes, measureDist, selectedMeasureRouteIndex, clearMeasureState, attachMeasureListener, removeMeasureListener])

  /* ── Undo / Redo ────────────────────────────────────────────────────── */
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const action = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))

    if (action.type === 'measure' && action.measureSnapshot) {
      // Save current state to redo
      setRedoStack(prev => [...prev, {
        type: 'measure',
        measureSnapshot: { points: [...measurePoints], routes: [...measureRoutes], dist: measureDist, selectedIdx: selectedMeasureRouteIndex },
      }])
      setMeasurePoints(action.measureSnapshot.points)
      setMeasureRoutes(action.measureSnapshot.routes)
      setMeasureDist(action.measureSnapshot.dist)
      setSelectedMeasureRouteIndex(action.measureSnapshot.selectedIdx)
    } else if (action.type === 'clear-measure' && action.measureSnapshot) {
      setRedoStack(prev => [...prev, {
        type: 'clear-measure',
        measureSnapshot: { points: [...measurePoints], routes: [...measureRoutes], dist: measureDist, selectedIdx: selectedMeasureRouteIndex },
      }])
      setMeasurePoints(action.measureSnapshot.points)
      setMeasureRoutes(action.measureSnapshot.routes)
      setMeasureDist(action.measureSnapshot.dist)
      setSelectedMeasureRouteIndex(action.measureSnapshot.selectedIdx)
      setToolVisibility(v => ({ ...v, measure: true }))
    } else if (action.type === 'drawing' && action.overlays) {
      setRedoStack(prev => [...prev, { type: 'drawing', overlays: action.overlays }])
      action.overlays.forEach(o => {
        (o as any).setMap?.(null)
        const idx = drawnOverlays.current.indexOf(o)
        if (idx >= 0) drawnOverlays.current.splice(idx, 1)
      })
    } else if (action.type === 'clear-drawings' && action.overlays) {
      setRedoStack(prev => [...prev, { type: 'clear-drawings', overlays: action.overlays }])
      action.overlays.forEach(o => (o as any).setMap?.(mapRef.current))
      drawnOverlays.current.push(...action.overlays)
    }
  }, [undoStack, measurePoints, measureRoutes, measureDist, selectedMeasureRouteIndex])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const action = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))

    if (action.type === 'measure' && action.measureSnapshot) {
      setUndoStack(prev => [...prev, {
        type: 'measure',
        measureSnapshot: { points: [...measurePoints], routes: [...measureRoutes], dist: measureDist, selectedIdx: selectedMeasureRouteIndex },
      }])
      setMeasurePoints(action.measureSnapshot.points)
      setMeasureRoutes(action.measureSnapshot.routes)
      setMeasureDist(action.measureSnapshot.dist)
      setSelectedMeasureRouteIndex(action.measureSnapshot.selectedIdx)
    } else if (action.type === 'clear-measure' && action.measureSnapshot) {
      setUndoStack(prev => [...prev, {
        type: 'clear-measure',
        measureSnapshot: { points: [...measurePoints], routes: [...measureRoutes], dist: measureDist, selectedIdx: selectedMeasureRouteIndex },
      }])
      setMeasurePoints(action.measureSnapshot.points)
      setMeasureRoutes(action.measureSnapshot.routes)
      setMeasureDist(action.measureSnapshot.dist)
      setSelectedMeasureRouteIndex(action.measureSnapshot.selectedIdx)
    } else if (action.type === 'drawing' && action.overlays) {
      setUndoStack(prev => [...prev, { type: 'drawing', overlays: action.overlays }])
      action.overlays.forEach(o => (o as any).setMap?.(mapRef.current))
      drawnOverlays.current.push(...action.overlays)
    } else if (action.type === 'clear-drawings' && action.overlays) {
      setUndoStack(prev => [...prev, { type: 'clear-drawings', overlays: action.overlays }])
      action.overlays.forEach(o => {
        (o as any).setMap?.(null)
        const idx = drawnOverlays.current.indexOf(o)
        if (idx >= 0) drawnOverlays.current.splice(idx, 1)
      })
    }
  }, [redoStack, measurePoints, measureRoutes, measureDist, selectedMeasureRouteIndex])

  // Determine DrawingManager mode
  const drawingMode = activeTool === 'draw' ? google.maps?.drawing?.OverlayType?.POLYLINE
    : activeTool === 'rectangle' ? google.maps?.drawing?.OverlayType?.RECTANGLE
      : activeTool === 'circle' ? google.maps?.drawing?.OverlayType?.CIRCLE
        : null

  // Animated terminal feed scroll
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [])

  // Initialize Google Maps
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: GMAP_LIBS,
  })

  /* ── Custom Polyline Manager for Measure Routes ─────────────────────── */
  useEffect(() => {
    if (!mapRef.current || !window.google) return

    // Create polyline instances for current routes
    const polylines: google.maps.Polyline[] = []

    if (toolVisibility.measure && measurePoints.length >= 2 && measureRoutes.length > 0) {
      measureRoutes.forEach((route, idx) => {
        const isSelected = idx === selectedMeasureRouteIndex
        const p = new google.maps.Polyline({
          path: route.path,
          strokeColor: route.color,
          strokeWeight: isSelected ? 6 : 3,
          strokeOpacity: isSelected ? 1 : 0.5,
          zIndex: isSelected ? 120 : 90 - idx,
          map: mapRef.current,
        })

        p.addListener('click', () => {
          setSelectedMeasureRouteIndex(idx)
          setMeasureDist(formatRouteStatus(route, idx, measureRoutes.length))
        })

        polylines.push(p)
      })
    }

    // Cleanup: remove all drawn measure polylines from the map on unmount or re-render
    return () => {
      polylines.forEach(p => {
        try { p.setMap(null) } catch (e) { }
      })
    }
  }, [measureRoutes, selectedMeasureRouteIndex, toolVisibility.measure, measurePoints.length, formatRouteStatus])

  /* ────────────────────────────────────────────────────────────────────────── */

  return (
    <>
      {/* ── Content area (three-column layout) ──────────────────────────── */}
      <div style={s.content}>

        {/* ────────────────── LEFT: Open Requests ─────────────────────── */}
        {!isFullscreen && (
          isLeftPanelOpen ? (
            <div style={s.leftPanel}>
              <div style={s.panelHeader}>
                <span style={s.panelTitle}>Open Requests</span>
                <button style={s.moreBtn} onClick={() => setOpenRequestsPanel(false)}>
                  <ChevronLeft size={16} />
                </button>
              </div>
              <div style={s.requestList}>
                {activeGarageRides.map((req) => {
                  const distanceKm = getHaversineDistance(
                    Number(req.origin_latitude), Number(req.origin_longitude),
                    Number(req.destination_latitude), Number(req.destination_longitude)
                  )
                  const estTimeMin = Math.max(1, Math.round((distanceKm / 40) * 60)) // Assuming 40km/h avg speed
                  const matchPct = Math.min(99, Math.max(75, 100 - Math.round(distanceKm))) // Visual mock for route match

                  return (
                    <div key={req.id} style={s.reqCard}>
                      <div style={s.reqRow}>
                        <span style={s.reqLabel}>Route:</span>
                        <span style={s.reqRoute}>{req.origin_address.split(',')[0]} to {req.destination_address.split(',')[0]}</span>
                      </div>
                      <div style={s.reqRow}>
                        <span style={s.reqLabel}>Est. Fare:</span>
                        <span style={{ ...s.reqValue, color: T.accent }}>₦{req.fare_per_seat}</span>
                      </div>
                      <div style={s.reqRow}>
                        <span style={s.reqLabel}>Passenger:</span>
                        <span style={s.reqValue}>
                          {req.booked_seats}/{req.total_seats} (Reputation: {req.driver.average_rating || 'New'}
                          <span style={{ color: T.warn }}>*</span>)
                        </span>
                      </div>
                      <div style={s.reqRow}>
                        <span style={s.reqLabel}>Vehicle:</span>
                        <span style={s.reqValue}>{req.vehicle_type}</span>
                      </div>
                      <div style={{ ...s.reqRow, paddingLeft: 52 }}>
                        <span style={{ ...s.reqValue, color: T.textMuted, fontSize: 10 }}>
                          {req.driver.full_name} • {req.driver_note || 'No notes'}
                        </span>
                      </div>
                      <div style={s.reqRow}>
                        <span style={s.reqLabel}>Time:</span>
                        <span style={s.reqValue}>{estTimeMin} min</span>
                      </div>
                      <div style={s.reqMatchRow}>
                        <span style={s.reqLabel}>Route Match:</span>
                        <span style={s.matchBadge}>{matchPct}%</span>
                        <span style={s.reqCoord}>{Number(req.origin_latitude).toFixed(4)}, {Number(req.origin_longitude).toFixed(4)}</span>
                      </div>
                    </div>
                  )
                })}
                {activeGarageRides.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>
                    No active requests. Waiting for drivers...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ ...s.leftPanel, width: 36, alignItems: 'center', cursor: 'pointer' }} onClick={() => setIsLeftPanelOpen(true)}>
              <div style={{ padding: '10px 0', borderBottom: `1px solid ${T.border}`, width: '100%', display: 'flex', justifyContent: 'center' }}>
                <ChevronRight size={16} color={T.textMuted} />
              </div>
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '16px 0', fontSize: 11, fontWeight: 600, color: T.textSecondary, letterSpacing: 1 }}>
                Open Requests
              </div>
            </div>
          )
        )}

        {/* ────────────────── CENTER: Map + Data Feed ─────────────────── */}
        <div style={s.centerPanel}>
          {/* Map toolbar */}
          <div style={s.mapToolbar}>
            <div style={s.toolbarLeft}>
              {measureDist && toolVisibility.measure && (
                <span style={{ ...s.searchPill, background: T.accent, color: '#fff', borderColor: T.accent }}>
                  📏 {measureDist}
                  <X size={11} style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => handleClear('measure')} />
                </span>
              )}
              {isMeasureLoading && (
                <span style={s.searchPill}>
                  Finding road routes...
                </span>
              )}
              {measureError && (
                <span style={{ ...s.searchPill, background: '#7f1d1d', color: '#fff', borderColor: '#ef4444' }}>
                  {measureError}
                  <X size={11} style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => handleClear('measure')} />
                </span>
              )}
              {activeTool === 'search' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    autoFocus
                    style={{ ...s.rpInput, width: 200, padding: '4px 8px', fontSize: 11, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 4, color: T.textWhite }}
                    placeholder="Search location..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                  <button style={{ ...s.toolBtn, width: 26, height: 24 }} onClick={handleSearch}>
                    <Search size={12} />
                  </button>
                </div>
              ) : (
                <span style={s.toolSep}>
                  {!activeTool ? 'Pan & Select' :
                    activeTool === 'draw' ? 'Draw Polyline (click to place points)' :
                      activeTool === 'rectangle' ? 'Draw Rectangle (click and drag)' :
                        activeTool === 'circle' ? 'Draw Circle (click center, drag radius)' :
                          activeTool === 'measure' ? 'Click start, then destination to map all road routes' : ''}
                </span>
              )}
            </div>
            <div style={s.toolbarRight}>
              {/* Undo / Redo */}
              <button
                style={{ ...s.toolBtn, opacity: undoStack.length === 0 ? 0.35 : 1 }}
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title={`Undo (${undoStack.length})`}
              >
                <Undo2 size={14} strokeWidth={1.6} />
              </button>
              <button
                style={{ ...s.toolBtn, opacity: redoStack.length === 0 ? 0.35 : 1 }}
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title={`Redo (${redoStack.length})`}
              >
                <Redo2 size={14} strokeWidth={1.6} />
              </button>
              <div style={s.toolDivider} />
              {/* Tool buttons (toggle on/off) */}
              {[
                { icon: Pencil, tool: 'draw' as MapTool, title: 'Draw Polyline' },
                { icon: Square, tool: 'rectangle' as MapTool, title: 'Draw Rectangle' },
                { icon: Circle, tool: 'circle' as MapTool, title: 'Draw Circle' },
                { icon: Ruler, tool: 'measure' as MapTool, title: 'Measure Distance' },
                { icon: Search, tool: 'search' as MapTool, title: 'Search Location' },
              ].map(({ icon: Icon, tool, title }) => (
                <button
                  key={tool}
                  style={{ ...s.toolBtn, ...(activeTool === tool ? { background: T.accent, color: '#fff', borderColor: T.accent, boxShadow: `0 0 6px ${T.accent}44` } : {}) }}
                  onClick={() => selectTool(tool)}
                  title={activeTool === tool ? `${title} (Active — click to deactivate)` : title}
                >
                  <Icon size={14} strokeWidth={1.6} />
                </button>
              ))}
              <div style={s.toolDivider} />
              <button style={s.filterBtn} onClick={handleClear} title={activeTool ? `Clear ${activeTool} work` : 'Clear all'}>
                <Trash2 size={13} /> Clear{activeTool ? ` ${activeTool}` : ''}
              </button>
            </div>
          </div>

          {/* Map area */}
          <div style={s.mapArea}>
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%', backgroundColor: mode === 'dark' ? '#0f1117' : '#f9fafb' }}
                  center={MAP_CENTER}
                  onLoad={onMapLoad}
                  zoom={DEFAULT_ZOOM}
                  onClick={handleMapClick}
                  options={{
                    disableDefaultUI: true,
                    draggable: !activeTool || activeTool === 'search' || activeTool === 'measure',
                    draggableCursor: activeTool === 'measure' ? 'crosshair' : undefined,
                    draggingCursor: activeTool === 'measure' ? 'crosshair' : undefined,
                    clickableIcons: false,
                    gestureHandling: 'greedy',
                    backgroundColor: mode === 'dark' ? '#0f1117' : '#ffffff',
                    minZoom: 14,
                    maxZoom: 18,
                    restriction: {
                      latLngBounds: {
                        north: 9.55,
                        south: 9.51,
                        east: 6.47,
                        west: 6.43,
                      },
                      strictBounds: true,
                    },
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
                  }}
                >
                  {/* Drawing Manager for draw/rectangle/circle tools */}
                  {(activeTool === 'draw' || activeTool === 'rectangle' || activeTool === 'circle') && drawingMode && (
                    <DrawingManager
                      drawingMode={drawingMode}
                      onOverlayComplete={onOverlayComplete}
                      options={{
                        drawingControl: false,
                        polylineOptions: { strokeColor: T.accent, strokeWeight: 3, strokeOpacity: 0.9 },
                        rectangleOptions: { fillColor: T.accent, fillOpacity: 0.15, strokeColor: T.accent, strokeWeight: 2 },
                        circleOptions: { fillColor: T.accent, fillOpacity: 0.15, strokeColor: T.accent, strokeWeight: 2 },
                      }}
                    />
                  )}
                  {/* Measure routes + endpoints (visible when toolVisibility.measure is on) */}
                  {toolVisibility.measure && measurePoints.length >= 2 && (
                    <>
                      {/* Polylines are now rendered via useEffect to bypass @react-google-maps/api unmount bugs */}
                    </>
                  )}
                  {toolVisibility.measure && measurePoints.length >= 1 && (
                    <Marker
                      position={measurePoints[0]}
                      label={{ text: 'A', color: '#ffffff', fontWeight: '700' }}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#16a34a',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                        scale: 9,
                      }}
                    />
                  )}
                  {toolVisibility.measure && measurePoints.length >= 2 && (
                    <Marker
                      position={measurePoints[1]}
                      label={{ text: 'B', color: '#ffffff', fontWeight: '700' }}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#ef4444',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                        scale: 9,
                      }}
                    />
                  )}

                  {/* Custom POI / Location InfoWindow */}
                  {selectedLocation && (
                    <Marker
                      position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                      onClick={() => { }}
                    >
                      <InfoWindow
                        position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                        onCloseClick={() => setSelectedLocation(null)}
                      >
                        <div style={{ padding: '2px 4px', maxWidth: 220, color: '#111827', fontFamily: 'system-ui, sans-serif' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#111827' }}>
                            {selectedLocation.placeName || 'Location Details'}
                          </div>
                          <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>
                            {selectedLocation.address}
                          </div>
                          <div style={{ fontSize: 10, marginTop: 6, color: '#6b7280' }}>
                            Coordinates: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                          </div>
                        </div>
                      </InfoWindow>
                    </Marker>
                  )}
                </GoogleMap>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted }}>
                  Initializing secure map connection...
                </div>
              )}
            </div>

            {toolVisibility.measure && measureRoutes.length > 0 && (
              <div style={s.measureRoutesPanel}>
                <div style={s.measureRoutesPanelTitle}>
                  📍 Route Analysis — {measureRoutes.length} route{measureRoutes.length > 1 ? 's' : ''} found
                </div>
                {/* Coordinates readout */}
                {measurePoints.length >= 2 && (
                  <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 8, padding: '4px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 4, lineHeight: 1.6 }}>
                    <div><strong style={{ color: '#16a34a' }}>A:</strong> {measurePoints[0].lat.toFixed(6)}, {measurePoints[0].lng.toFixed(6)}</div>
                    <div><strong style={{ color: '#ef4444' }}>B:</strong> {measurePoints[1].lat.toFixed(6)}, {measurePoints[1].lng.toFixed(6)}</div>
                  </div>
                )}
                {measureRoutes.map((route, routeIndex) => {
                  const selected = routeIndex === selectedMeasureRouteIndex
                  return (
                    <div key={route.id} style={{ marginBottom: 6 }}>
                      <button
                        style={{
                          ...s.measureRouteBtn,
                          ...(selected ? { borderColor: route.color, background: 'rgba(255,255,255,0.06)' } : {}),
                        }}
                        onClick={() => {
                          setSelectedMeasureRouteIndex(routeIndex)
                          setMeasureDist(formatRouteStatus(route, routeIndex, measureRoutes.length))
                        }}
                      >
                        <div style={s.measureRouteTopRow}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 5, background: route.color, flexShrink: 0, border: selected ? '2px solid #fff' : 'none' }} />
                            <span style={{ ...s.measureRouteName, color: selected ? route.color : T.textWhite }}>
                              Route {routeIndex + 1}
                            </span>
                            {routeIndex === 0 && <span style={{ fontSize: 8, background: '#16a34a', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>Shortest</span>}
                          </div>
                          <span style={{ ...s.measureRouteMeta, fontWeight: 700, color: selected ? '#fff' : T.textSecondary }}>
                            {route.distanceText}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                          <span style={s.measureRouteSummary}>{route.summary}</span>
                          <span style={{ fontSize: 9, color: T.textMuted }}>⏱ {route.durationText}</span>
                        </div>
                        <div style={{ fontSize: 8, color: T.textMuted, marginTop: 3, fontFamily: 'monospace' }}>
                          {route.distanceMeters.toFixed(0)} m exact
                        </div>
                      </button>
                      {/* Step-by-step breakdown for selected route */}
                      {selected && route.roadSteps.length > 0 && (
                        <div style={{ padding: '4px 8px 6px', background: 'rgba(0,0,0,0.15)', borderRadius: '0 0 6px 6px', marginTop: -4, borderLeft: `2px solid ${route.color}` }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: T.textSecondary, marginBottom: 4 }}>Road Segments:</div>
                          {route.roadSteps.map((step, si) => (
                            <div key={si} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.textMuted, padding: '2px 0', borderBottom: si < route.roadSteps.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.name}</span>
                              <span style={{ flexShrink: 0, marginLeft: 8, fontFamily: 'monospace', color: T.textSecondary }}>{step.distanceText}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Map overlay panel: Traffic Layers */}
            <div style={s.mapOverlayPanel}>
              <div style={s.overlaySection}>
                <button style={s.overlaySectionHeader} onClick={() => setTrafficOpen(!trafficOpen)}>
                  <span>Traffic Layers</span>
                  {trafficOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {trafficOpen && (
                  <div style={s.overlayItems}>
                    {[
                      { key: 'realMatch' as const, label: 'Real-Match', color: T.accent },
                      { key: 'congestionLine' as const, label: 'Congestion Line', color: undefined },
                      { key: 'congestion' as const, label: 'Congestion', color: undefined },
                      { key: 'congestion2' as const, label: 'Congestion', color: undefined },
                      { key: 'coordinate' as const, label: 'Coordinate', color: undefined },
                    ].map((item) => (
                      <div key={item.key} style={s.overlayRow}>
                        <div style={{
                          width: 8, height: 8, borderRadius: 4,
                          background: item.key === 'realMatch' ? T.accent : T.textMuted,
                          marginRight: 8,
                        }} />
                        <span style={s.overlayLabel}>{item.label}</span>
                        <Toggle
                          active={layers[item.key]}
                          onToggle={() => setLayers(p => ({ ...p, [item.key]: !p[item.key] }))}
                          color={item.color}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={s.overlaySection}>
                <button style={s.overlaySectionHeader} onClick={() => setActiveLayersOpen(!activeLayersOpen)}>
                  <span>Active Layers</span>
                  {activeLayersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {activeLayersOpen && (
                  <div style={s.overlayItems}>
                    {[
                      { key: 'realMatch' as const, label: 'Real-Match' },
                      { key: 'demanCluster' as const, label: 'Deman Cluster' },
                      { key: 'congestion' as const, label: 'Congestion' },
                      { key: 'coordinates' as const, label: 'Coordinates' },
                    ].map((item) => (
                      <div key={item.key} style={s.overlayRow}>
                        <div style={{
                          width: 8, height: 8, borderRadius: 4,
                          background: item.key === 'realMatch' ? T.accent : T.textMuted,
                          marginRight: 8,
                        }} />
                        <span style={s.overlayLabel}>{item.label}</span>
                        <Toggle
                          active={activeLayers[item.key]}
                          onToggle={() => setActiveLayers(p => ({ ...p, [item.key]: !p[item.key] }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={s.overlaySection}>
                <button style={s.overlaySectionHeader} onClick={() => setDataControlsOpen(!dataControlsOpen)}>
                  <span>Data Controls</span>
                  {dataControlsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {dataControlsOpen && (
                  <div style={s.overlayItems}>
                    <div style={s.overlayRow}>
                      <Layers size={13} style={{ marginRight: 6 }} />
                      <span style={s.overlayLabel}>Set Filters</span>
                    </div>
                    <div style={s.overlayRow}>
                      <Layers size={13} style={{ marginRight: 6 }} />
                      <span style={s.overlayLabel}>Set Filters</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Floating active request tooltips */}
            <div style={{ ...s.mapTooltip, top: '18%', right: '30%' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textWhite, marginBottom: 4 }}>
                Active Requests
              </div>
              <div style={s.ttRow}><span style={s.ttLabel}>Route Match</span><span style={s.ttVal}>92 %</span></div>
              <div style={s.ttRow}><span style={s.ttLabel}>Estimated Fare:</span><span style={s.ttVal}>$85.00</span></div>
              <div style={s.ttRow}><span style={s.ttLabel}>Coordinates:</span><span style={s.ttVal}>-235.35.97</span></div>
            </div>

            <div style={{ ...s.mapTooltip, bottom: '28%', right: '22%' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textWhite, marginBottom: 4 }}>
                Active Requests
              </div>
              <div style={s.ttRow}><span style={s.ttLabel}>Route Match</span><span style={s.ttVal}>92 %</span></div>
              <div style={s.ttRow}><span style={s.ttLabel}>Estimated Fare:</span><span style={s.ttVal}>$85.00</span></div>
              <div style={s.ttRow}><span style={s.ttLabel}>Coordinates:</span><span style={s.ttVal}>-233.89.28</span></div>
            </div>

            {/* Map zoom controls */}
            <div style={s.mapZoom}>
              <button style={s.zoomBtn} onClick={handleZoomIn} title="Zoom In"><ZoomIn size={14} /></button>
              <button style={s.zoomBtn} onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={14} /></button>
              <button style={s.zoomBtn} onClick={handleRecenter} title="Recenter"><Crosshair size={14} /></button>
              <button style={{ ...s.zoomBtn, ...(isFullscreen ? { background: T.accent, color: '#fff', borderColor: T.accent } : {}) }} onClick={handleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}><Maximize2 size={14} /></button>
            </div>

            {/* Bottom bar inside map */}
            <div style={s.mapBottomBar}>
              <button style={s.mapBottomBtn}>Measure</button>
              <button style={s.mapBottomBtn}>Measure</button>
              <button style={{ ...s.mapBottomBtn, background: 'transparent', border: `1px solid ${T.border}` }}>
                All Filters
              </button>
            </div>
          </div>

          {/* Data feed */}
          {!isFullscreen && (
            <div style={{ ...s.dataFeed, height: isDataFeedOpen ? 110 : 33 }}>
              <button
                style={{ ...s.dataFeedHeader, background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setIsDataFeedOpen(!isDataFeedOpen)}
              >
                <span>Live Demand Insights &amp; Logistics Data</span>
                {isDataFeedOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
              {isDataFeedOpen && (
                <div ref={feedRef} style={s.dataFeedBody}>
                  {DEMAND_LINES.map((line, i) => (
                    <div key={i} style={s.dataLine}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ────────────────── RIGHT: Quick Ride Creation ──────────────── */}
        {!isFullscreen && (
          isRightPanelOpen ? (
            <div style={s.rightPanel}>
              <div style={s.rpHeader}>
                <span style={s.panelTitle}>Quick Ride Creation</span>
                <button style={{ ...s.moreBtn, fontSize: 16 }} onClick={() => setIsRightPanelOpen(false)}><ChevronRight size={16} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Departure Window */}
                <div style={s.rpSection}>
                  <div style={s.rpLabel}>Departure Window</div>
                  <div style={s.rpInputRow}>
                    <div style={s.rpInputIcon}>
                      <CalendarClock size={13} />
                    </div>
                    <input 
                      type="date" 
                      style={s.rpInput} 
                      value={departureDate}
                      onChange={e => setDepartureDate(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <div style={{ ...s.rpInputRow, flex: 1 }}>
                      <input 
                        type="time" 
                        style={s.rpInput} 
                        value={windowStart}
                        onChange={e => setWindowStart(e.target.value)}
                      />
                    </div>
                    <span style={{ color: T.textMuted, alignSelf: 'center', fontSize: 12 }}>-</span>
                    <div style={{ ...s.rpInputRow, flex: 1 }}>
                      <input 
                        type="time" 
                        style={s.rpInput} 
                        value={windowEnd}
                        onChange={e => setWindowEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  {/* Join deadline logic indicator */}
                  <div style={{ fontSize: 9, color: T.textMuted, marginTop: 6, lineHeight: 1.3 }}>
                    Students can join up to 5 minutes before the window closes.
                  </div>
                </div>

                {/* Multi-Stop Route */}
                <div style={s.rpSection}>
                  <div style={s.rpLabel}>Route & Stops</div>
                  {waypoints.map((waypoint, i) => (
                    <div key={i} style={{ ...s.rpInputRow, marginBottom: 6 }}>
                      <div style={s.rpInputIcon}>
                        <span style={{ fontSize: 10, fontWeight: 700 }}>{i === 0 ? 'O' : i === waypoints.length - 1 ? 'D' : i}</span>
                      </div>
                      <input 
                        style={{ ...s.rpInput, flex: 1 }} 
                        placeholder={i === 0 ? "Origin Address" : i === waypoints.length - 1 ? "Destination Address" : "Stop Address"} 
                        value={waypoint.address}
                        onChange={(e) => {
                          const newWaypoints = [...waypoints]
                          newWaypoints[i].address = e.target.value
                          setWaypoints(newWaypoints)
                        }}
                      />
                      {waypoints.length > 2 && (
                        <button 
                          style={s.rpRemoveBtn}
                          onClick={() => setWaypoints(waypoints.filter((_, idx) => idx !== i))}
                        ><X size={12} /></button>
                      )}
                    </div>
                  ))}
                  <button
                    style={s.addWaypointBtn}
                    onClick={() => {
                      const newWaypoints = [...waypoints]
                      newWaypoints.splice(newWaypoints.length - 1, 0, { name: '', address: '' })
                      setWaypoints(newWaypoints)
                    }}
                  >
                    + Add Stop
                  </button>
                </div>

                {/* Vehicle Constraints */}
                <div style={s.rpSection}>
                  <div style={s.rpLabel}>Vehicle Constraints</div>
                  <div style={{ ...s.rpInputRow, marginBottom: 8 }}>
                    <select 
                      style={{ ...s.rpInput, paddingLeft: 8, width: '100%', appearance: 'none' }}
                      value={vehicleSize}
                      onChange={e => setVehicleSize(e.target.value)}
                    >
                      <option value="sedan">Sedan (4 seats)</option>
                      <option value="suv">SUV (6 seats)</option>
                      <option value="minivan">Minivan (7-8 seats)</option>
                      <option value="minibus">Minibus (14-18 seats)</option>
                      <option value="bus">Bus (30+ seats)</option>
                    </select>
                  </div>

                  {pricingTiers.freight && (
                    <div style={{ ...s.rpInputRow, marginBottom: 8 }}>
                      <input 
                        type="number" 
                        style={{ ...s.rpInput, paddingLeft: 8 }} 
                        placeholder="Cargo Capacity (kg)" 
                        value={cargoCapacity}
                        onChange={e => setCargoCapacity(e.target.value)}
                      />
                      <span style={{ fontSize: 10, color: T.textMuted, paddingRight: 8 }}>kg</span>
                    </div>
                  )}

                  {[
                    { key: 'wheelchair_ramp', label: 'Wheelchair Ramp' },
                    { key: 'liftgate', label: 'Liftgate' },
                    { key: 'low_floor', label: 'Low Floor' },
                    { key: 'air_conditioning', label: 'Air Conditioning' },
                  ].map((item) => (
                    <div key={item.key} style={s.rpCheckRow} onClick={() => setAccessibility(p => ({ ...p, [item.key]: !p[item.key] }))}>
                      <div style={{
                        ...s.rpCheckbox,
                        background: accessibility[item.key] ? T.accent : 'transparent',
                        borderColor: accessibility[item.key] ? T.accent : T.border,
                      }}>
                        {accessibility[item.key] && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span style={s.rpCheckLabel}>{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* Pricing Templates */}
                <div style={s.rpSection}>
                  <div style={s.rpLabel}>Pricing Tiers (Multi-select)</div>
                  {[
                    { key: 'standard', label: 'Standard (Seated)' },
                    { key: 'standing', label: 'Standing (Bus/Minibus)', disabled: !['bus', 'minibus'].includes(vehicleSize) },
                    { key: 'premium', label: 'Premium (Comfort)' },
                    { key: 'freight', label: 'Freight (Cargo)' },
                  ].map((tier) => (
                    <div key={tier.key} style={{ marginBottom: 6 }}>
                      <div 
                        style={{ ...s.rpCheckRow, opacity: tier.disabled ? 0.5 : 1, pointerEvents: tier.disabled ? 'none' : 'auto' }} 
                        onClick={() => {
                          if (tier.disabled) return
                          setPricingTiers(p => ({ ...p, [tier.key]: !p[tier.key] }))
                        }}
                      >
                        <div style={{
                          ...s.rpCheckbox,
                          background: pricingTiers[tier.key] && !tier.disabled ? T.accent : 'transparent',
                          borderColor: pricingTiers[tier.key] && !tier.disabled ? T.accent : T.border,
                        }}>
                          {pricingTiers[tier.key] && !tier.disabled && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span style={s.rpCheckLabel}>{tier.label}</span>
                      </div>
                      
                      {pricingTiers[tier.key] && !tier.disabled && (
                        <div style={{ ...s.rpInputRow, marginLeft: 24, marginBottom: 8, height: 26, width: 100 }}>
                          <span style={{ padding: '0 8px', color: T.textMuted, fontSize: 11 }}>₦</span>
                          <input 
                            type="number"
                            style={s.rpInput}
                            value={pricingValues[tier.key]}
                            onChange={e => setPricingValues(p => ({ ...p, [tier.key]: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule Route button */}
              <button 
                style={{ ...s.scheduleBtn, opacity: isCreatingRide ? 0.7 : 1 }} 
                onClick={handleCreateScheduledRide}
                disabled={isCreatingRide}
              >
                {isCreatingRide ? 'Creating...' : 'Create Scheduled Ride'}
              </button>
            </div>
          ) : (
            <div style={{ ...s.rightPanel, width: 36, alignItems: 'center', cursor: 'pointer' }} onClick={() => setIsRightPanelOpen(true)}>
              <div style={{ padding: '10px 0', borderBottom: `1px solid ${T.border}`, width: '100%', display: 'flex', justifyContent: 'center' }}>
                <ChevronLeft size={16} color={T.textMuted} />
              </div>
              <div style={{ writingMode: 'vertical-rl', padding: '16px 0', fontSize: 11, fontWeight: 600, color: T.textSecondary, letterSpacing: 1 }}>
                Quick Ride Creation
              </div>
            </div>
          )
        )}
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════════════════════════════════════ */

const s: Record<string, CSSProperties> = {
  /* Content */
  content: {
    flex: 1, display: 'flex', overflow: 'hidden',
  },

  /* Left panel */
  leftPanel: {
    width: 230, background: T.bgPanel, borderRight: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderBottom: `1px solid ${T.border}`,
  },
  panelTitle: { fontSize: 12, fontWeight: 700, color: T.textWhite, letterSpacing: 0.2 },
  moreBtn: {
    background: 'none', border: 'none', color: T.textMuted,
    cursor: 'pointer', fontSize: 14, letterSpacing: 2,
  },
  requestList: { flex: 1, overflowY: 'auto', padding: 0 },
  reqCard: {
    padding: '10px 12px', borderBottom: `1px solid ${T.border}`,
    cursor: 'pointer', transition: 'background 0.12s',
  },
  reqRow: {
    display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 1,
  },
  reqLabel: { fontSize: 10, color: T.textMuted, fontWeight: 600, minWidth: 52, flexShrink: 0 },
  reqRoute: { fontSize: 10, color: T.textWhite, fontWeight: 600 },
  reqValue: { fontSize: 10, color: T.textSecondary },
  reqMatchRow: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
    borderTop: `1px solid ${T.border}`, paddingTop: 4,
  },
  matchBadge: {
    fontSize: 9, fontWeight: 700, color: T.accent,
    background: T.accentBg, padding: '1px 6px', borderRadius: 3,
  },
  reqCoord: { fontSize: 9, color: T.textMuted, marginLeft: 'auto' },

  /* Center panel */
  centerPanel: {
    flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
  },
  mapToolbar: {
    height: 36, background: T.bgPanel, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 10px',
    borderBottom: `1px solid ${T.border}`, flexShrink: 0,
  },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: 6 },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 3 },
  searchPill: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: 4, padding: '2px 8px', fontSize: 10,
    color: T.textSecondary, cursor: 'default',
  },
  toolSep: { fontSize: 10, color: T.textMuted, margin: '0 4px' },
  toolBtn: {
    width: 28, height: 26, border: `1px solid ${T.border}`,
    background: T.bgCard, borderRadius: 4, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: T.textSecondary,
  },
  toolDivider: {
    width: 1, height: 18, background: T.border, margin: '0 4px',
  },
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: 4, padding: '3px 8px', fontSize: 10,
    color: T.textSecondary, cursor: 'pointer', fontFamily: T.fontFamily,
  },

  /* Map area */
  mapArea: {
    flex: 1, position: 'relative', background: T.mapBg,
    overflow: 'hidden', minHeight: 0,
  },
  mapGrid: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    pointerEvents: 'none',
  },

  /* Map overlay */
  mapOverlayPanel: {
    position: 'absolute', top: 10, left: 10, width: 180,
    background: T.mapOverlayBg, borderRadius: 8,
    border: `1px solid ${T.border}`, backdropFilter: 'blur(12px)',
    zIndex: 10, overflow: 'hidden',
  },
  overlaySection: { borderBottom: `1px solid ${T.border}` },
  overlaySectionHeader: {
    width: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '7px 10px',
    background: 'none', border: 'none', color: T.textWhite,
    fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: T.fontFamily,
  },
  overlayItems: { padding: '0 10px 6px' },
  overlayRow: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 0', fontSize: 10,
  },
  overlayLabel: { flex: 1, color: T.textSecondary, fontSize: 10 },

  /* Measure routes list */
  measureRoutesPanel: {
    position: 'absolute', top: 10, right: 10, width: 310, maxHeight: 420,
    background: T.mapOverlayBg, borderRadius: 8,
    border: `1px solid ${T.border}`, backdropFilter: 'blur(12px)',
    zIndex: 10, overflowY: 'auto', padding: 10,
  },
  measureRoutesPanelTitle: {
    fontSize: 10, fontWeight: 700, color: T.textWhite, marginBottom: 6,
  },
  measureRouteBtn: {
    width: '100%', borderRadius: 6, border: `1px solid ${T.border}`,
    background: T.bgCard, padding: '7px 8px', marginBottom: 6,
    cursor: 'pointer', textAlign: 'left', color: T.textSecondary, fontFamily: T.fontFamily,
  },
  measureRouteBtnActive: {
    borderColor: T.accent, background: T.accentBg,
  },
  measureRouteTopRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    marginBottom: 3,
  },
  measureRouteName: {
    fontSize: 10, fontWeight: 700, color: T.textWhite,
  },
  measureRouteMeta: {
    fontSize: 9, color: T.textSecondary,
  },
  measureRouteSummary: {
    fontSize: 9, color: T.textMuted,
    whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis',
  },

  /* Map tooltips */
  mapTooltip: {
    position: 'absolute', background: T.mapTooltipBg,
    border: `1px solid ${T.border}`, borderRadius: 6,
    padding: '8px 10px', backdropFilter: 'blur(8px)',
    minWidth: 150, zIndex: 8,
  },
  ttRow: { display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 1 },
  ttLabel: { fontSize: 9, color: T.textMuted },
  ttVal: { fontSize: 9, color: T.textWhite, fontWeight: 600 },

  /* Map zoom */
  mapZoom: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    display: 'flex', flexDirection: 'column', gap: 2, zIndex: 8,
  },
  zoomBtn: {
    width: 28, height: 28, borderRadius: 4,
    background: T.mapTooltipBg, border: `1px solid ${T.border}`,
    color: T.textSecondary, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  /* Map bottom bar */
  mapBottomBar: {
    position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
    display: 'flex', gap: 4, zIndex: 8,
  },
  mapBottomBtn: {
    padding: '4px 14px', borderRadius: 4, border: 'none',
    background: T.bgCard, color: T.textSecondary, fontSize: 10,
    fontWeight: 600, cursor: 'pointer', fontFamily: T.fontFamily,
  },

  /* Data feed */
  dataFeed: {
    background: T.bgPanel, borderTop: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', flexShrink: 0,
    transition: 'height 0.2s', overflow: 'hidden',
  },
  dataFeedHeader: {
    padding: '6px 12px', fontSize: 11, fontWeight: 700,
    color: T.textWhite, borderBottom: `1px solid ${T.border}`,
    fontFamily: T.fontFamily,
  },
  dataFeedBody: {
    flex: 1, overflowY: 'auto', padding: '4px 12px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },
  dataLine: {
    fontSize: 10, lineHeight: '16px', color: T.textMuted,
    whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis',
  },

  /* Right panel */
  rightPanel: {
    width: 230, background: T.bgPanel, borderLeft: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', flexShrink: 0,
    overflowY: 'auto',
  },
  rpHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderBottom: `1px solid ${T.border}`,
  },
  rpSection: { padding: '10px 12px', borderBottom: `1px solid ${T.border}` },
  rpLabel: {
    fontSize: 10, fontWeight: 700, color: T.textWhite,
    marginBottom: 8, letterSpacing: 0.2,
  },
  rpInputRow: {
    display: 'flex', alignItems: 'center',
    background: T.bgInput, border: `1px solid ${T.border}`,
    borderRadius: 4, overflow: 'hidden',
  },
  rpInputIcon: {
    width: 28, display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: T.textMuted, flexShrink: 0,
  },
  rpInput: {
    flex: 1, background: 'none', border: 'none', color: T.textSecondary,
    fontSize: 11, padding: '6px 8px 6px 0', outline: 'none', fontFamily: T.fontFamily,
  },
  rpRemoveBtn: {
    width: 24, height: 24, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'none', border: 'none',
    color: T.textMuted, cursor: 'pointer',
  },
  addWaypointBtn: {
    background: 'none', border: 'none', color: T.accent,
    fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
    fontFamily: T.fontFamily,
  },
  rpCheckRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer',
  },
  rpCheckbox: {
    width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
  },
  rpCheckLabel: { fontSize: 11, color: T.textSecondary },
  rpRadioRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer',
  },
  rpRadio: {
    width: 16, height: 16, borderRadius: 8, border: `1.5px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  rpRadioDot: {
    width: 8, height: 8, borderRadius: 4, background: T.accent,
  },
  scheduleBtn: {
    margin: '12px 12px 16px', padding: '10px 0', borderRadius: 6,
    border: 'none', background: T.accent, color: '#fff',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.fontFamily,
    transition: 'background 0.15s',
  },
}

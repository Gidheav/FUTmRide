import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  AlertTriangle, CheckCircle2, Copy, Download, GitBranch, MapPin, MousePointer2,
  Navigation, PenLine, Play, Plus, Route, Save, Scissors, Trash2, UploadCloud, Waypoints,
} from 'lucide-react'
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import api from '../../../core/api'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { VEHICLE_TYPES } from '../constants'
import type { PlatformSettings, SimulationResult } from '../types'

const GMAP_LIBS: ('drawing' | 'geometry' | 'places')[] = ['drawing', 'geometry', 'places']
const MAP_CENTER = { lat: 9.6139, lng: 6.5569 }
const STORAGE_KEY = 'lr-ride-route-calibration-draft-v1'

type LatLng = { lat: number; lng: number }
type LaneStatus = 'draft' | 'active' | 'blocked'
type Direction = 'two_way' | 'one_way'
type Tool = 'select' | 'pen' | 'curve' | 'trace' | 'simulate'

type Lane = {
  id: string
  name: string
  path: LatLng[]
  distanceKm: number
  direction: Direction
  status: LaneStatus
  priority: 'main' | 'service' | 'shortcut'
  allowedVehicles: string[]
  calibrationFactor: number
}

type DraftState = {
  versionName: string
  lanes: Lane[]
}

type GraphRoute = {
  path: LatLng[]
  distanceKm: number
  laneIds: string[]
  warnings: string[]
}

type EstimateRoute = {
  distance_km: number
  duration_minutes?: number | null
  geometry: Array<{ latitude: number; longitude: number }>
  provider: string
  confidence: string
}

type EstimateResult = SimulationResult & {
  route?: EstimateRoute
}

type TraceRoute = {
  id: string
  path: LatLng[]
  distanceKm: number
  durationMinutes: number | null
  summary: string
  provider: string
  travelMode?: string
}

const btn: CSSProperties = {
  ...campusPanel.btnSecondary,
  justifyContent: 'center',
}

const activeBtn: CSSProperties = {
  ...btn,
  borderColor: T.accent,
  color: T.textPrimary,
  background: T.accentBg,
}

const inputStyle: CSSProperties = {
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  color: T.textPrimary,
  padding: '8px 10px',
  fontSize: 12,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const roundCoord = (value: number) => Number(value.toFixed(6))

const normalizePoint = (point: LatLng): LatLng => ({
  lat: roundCoord(point.lat),
  lng: roundCoord(point.lng),
})

const distanceKm = (a: LatLng, b: LatLng) => {
  const radius = 6371
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return radius * (2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)))
}

const pathDistanceKm = (path: LatLng[]) =>
  path.slice(1).reduce((sum, point, idx) => sum + distanceKm(path[idx], point), 0)

const sampleQuadratic = (a: LatLng, c: LatLng, b: LatLng) => {
  const points: LatLng[] = []
  for (let step = 0; step <= 24; step += 1) {
    const t = step / 24
    const mt = 1 - t
    points.push(normalizePoint({
      lat: mt * mt * a.lat + 2 * mt * t * c.lat + t * t * b.lat,
      lng: mt * mt * a.lng + 2 * mt * t * c.lng + t * t * b.lng,
    }))
  }
  return points
}

const simplifyPath = (path: LatLng[], maxPoints = 160) => {
  if (path.length <= maxPoints) return path
  const stride = Math.ceil(path.length / maxPoints)
  const simplified = path.filter((_, idx) => idx % stride === 0)
  const last = path[path.length - 1]
  if (simplified[simplified.length - 1] !== last) simplified.push(last)
  return simplified
}

const curvePreviewPath = (points: LatLng[]) => (
  points.length === 3 ? sampleQuadratic(points[0], points[1], points[2]) : points
)

const curveControlPoint = (start: LatLng, end: LatLng): LatLng => {
  const mid = { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 }
  const dx = end.lng - start.lng
  const dy = end.lat - start.lat
  return normalizePoint({
    lat: mid.lat + dx * 0.22,
    lng: mid.lng - dy * 0.22,
  })
}

const defaultLane = (path: LatLng[], count: number): Lane => ({
  id: newId('lane'),
  name: `Lane ${count + 1}`,
  path,
  distanceKm: Number(pathDistanceKm(path).toFixed(3)),
  direction: 'two_way',
  status: 'active',
  priority: 'main',
  allowedVehicles: VEHICLE_TYPES.map((vehicle) => vehicle.id),
  calibrationFactor: 1,
})

const pointKey = (point: LatLng) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`

const nearestVertex = (lanes: Lane[], point: LatLng): { key: string; point: LatLng; distanceKm: number } | null => {
  let best: { key: string; point: LatLng; distanceKm: number } | null = null
  lanes.forEach((lane) => {
    if (lane.status === 'blocked') return
    lane.path.forEach((candidate) => {
      const d = distanceKm(point, candidate)
      if (!best || d < best.distanceKm) best = { key: pointKey(candidate), point: candidate, distanceKm: d }
    })
  })
  return best
}

const solveGraphRoute = (lanes: Lane[], start: LatLng | null, end: LatLng | null, vehicle: string): GraphRoute | null => {
  if (!start || !end) return null
  const allowedLanes = lanes.filter((lane) => lane.status !== 'blocked' && lane.allowedVehicles.includes(vehicle))
  if (!allowedLanes.length) return { path: [], distanceKm: 0, laneIds: [], warnings: ['No active lanes allow this vehicle.'] }

  const startSnap = nearestVertex(allowedLanes, start)
  const endSnap = nearestVertex(allowedLanes, end)
  if (!startSnap || !endSnap) return { path: [], distanceKm: 0, laneIds: [], warnings: ['Could not snap simulation pins to the lane graph.'] }

  const edges = new Map<string, Array<{ to: string; weight: number; laneId: string; point: LatLng }>>()
  const points = new Map<string, LatLng>()
  const addEdge = (from: LatLng, to: LatLng, lane: Lane) => {
    const fromKey = pointKey(from)
    const toKey = pointKey(to)
    points.set(fromKey, from)
    points.set(toKey, to)
    if (!edges.has(fromKey)) edges.set(fromKey, [])
    edges.get(fromKey)?.push({
      to: toKey,
      weight: distanceKm(from, to) * lane.calibrationFactor,
      laneId: lane.id,
      point: to,
    })
  }

  allowedLanes.forEach((lane) => {
    lane.path.slice(1).forEach((point, idx) => {
      const from = lane.path[idx]
      addEdge(from, point, lane)
      if (lane.direction === 'two_way') addEdge(point, from, lane)
    })
  })

  const source = startSnap.key
  const target = endSnap.key
  const distances = new Map<string, number>([[source, 0]])
  const previous = new Map<string, { from: string; laneId: string }>()
  const unvisited = new Set(points.keys())

  while (unvisited.size) {
    let current: string | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    unvisited.forEach((key) => {
      const value = distances.get(key) ?? Number.POSITIVE_INFINITY
      if (value < bestDistance) {
        current = key
        bestDistance = value
      }
    })
    if (!current || current === target || bestDistance === Number.POSITIVE_INFINITY) break
    unvisited.delete(current)
    ;(edges.get(current) || []).forEach((edge) => {
      const nextDistance = bestDistance + edge.weight
      if (nextDistance < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.to, nextDistance)
        previous.set(edge.to, { from: current as string, laneId: edge.laneId })
      }
    })
  }

  if (!distances.has(target)) {
    return { path: [], distanceKm: 0, laneIds: [], warnings: ['No connected path exists between the snapped pins.'] }
  }

  const routeKeys = [target]
  const laneIds: string[] = []
  while (routeKeys[0] !== source) {
    const prev = previous.get(routeKeys[0])
    if (!prev) break
    laneIds.unshift(prev.laneId)
    routeKeys.unshift(prev.from)
  }

  const warnings = []
  if (startSnap.distanceKm > 0.08) warnings.push(`Pickup snap is ${(startSnap.distanceKm * 1000).toFixed(0)}m from the nearest lane.`)
  if (endSnap.distanceKm > 0.08) warnings.push(`Dropoff snap is ${(endSnap.distanceKm * 1000).toFixed(0)}m from the nearest lane.`)

  return {
    path: routeKeys.map((key) => points.get(key)).filter((point): point is LatLng => Boolean(point)),
    distanceKm: Number((distances.get(target) ?? 0).toFixed(3)),
    laneIds: Array.from(new Set(laneIds)),
    warnings,
  }
}

const loadDraft = (): DraftState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { versionName: 'Campus draft', lanes: [] }
    const parsed = JSON.parse(raw) as DraftState
    return {
      versionName: parsed.versionName || 'Campus draft',
      lanes: Array.isArray(parsed.lanes) ? parsed.lanes : [],
    }
  } catch {
    return { versionName: 'Campus draft', lanes: [] }
  }
}

function StatusPill({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'good' | 'warn' }) {
  const color = tone === 'good' ? '#10b981' : tone === 'warn' ? T.warn : T.textSecondary
  return (
    <span style={{
      border: `1px solid ${color}`,
      color,
      padding: '2px 7px',
      fontSize: 9,
      fontWeight: 800,
      textTransform: 'uppercase',
    }}
    >
      {children}
    </span>
  )
}

export function CalibrationTab({ settings }: { settings: PlatformSettings }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: GMAP_LIBS,
  })

  const initialDraft = useMemo(loadDraft, [])
  const [versionName, setVersionName] = useState(initialDraft.versionName)
  const [lanes, setLanes] = useState<Lane[]>(initialDraft.lanes)
  const [tool, setTool] = useState<Tool>('select')
  const [draftPath, setDraftPath] = useState<LatLng[]>([])
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(initialDraft.lanes[0]?.id ?? null)
  const [vehicle, setVehicle] = useState('sedan')
  const [simStart, setSimStart] = useState<LatLng | null>(null)
  const [simEnd, setSimEnd] = useState<LatLng | null>(null)
  const [traceStart, setTraceStart] = useState<LatLng | null>(null)
  const [traceEnd, setTraceEnd] = useState<LatLng | null>(null)
  const [traceRoutes, setTraceRoutes] = useState<TraceRoute[]>([])
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [isTracingRoute, setIsTracingRoute] = useState(false)
  const [traceError, setTraceError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [importText, setImportText] = useState('')
  const [showConfiguredMap, setShowConfiguredMap] = useState(true)
  const mapRef = useRef<google.maps.Map | null>(null)
  const traceRequestIdRef = useRef(0)

  const selectedLane = lanes.find((lane) => lane.id === selectedLaneId) ?? null
  const selectedTrace = traceRoutes.find((route) => route.id === selectedTraceId) ?? traceRoutes[0] ?? null
  const graphRoute = useMemo(() => solveGraphRoute(lanes, simStart, simEnd, vehicle), [lanes, simStart, simEnd, vehicle])
  const totalKm = useMemo(() => lanes.reduce((sum, lane) => sum + lane.distanceKm, 0), [lanes])
  const blockedCount = lanes.filter((lane) => lane.status === 'blocked').length

  const updateLane = (id: string, patch: Partial<Lane>) => {
    setLanes((prev) => prev.map((lane) => {
      if (lane.id !== id) return lane
      const next = { ...lane, ...patch }
      return { ...next, distanceKm: Number((pathDistanceKm(next.path) * next.calibrationFactor).toFixed(3)) }
    }))
  }

  const addLane = (path: LatLng[]) => {
    if (path.length < 2) return
    const lane = defaultLane(path, lanes.length)
    setLanes((prev) => [...prev, lane])
    setSelectedLaneId(lane.id)
    setDraftPath([])
    setTool('select')
  }

  const fetchTraceRoutes = useCallback(async (start: LatLng, end: LatLng) => {
    const requestId = traceRequestIdRef.current + 1
    traceRequestIdRef.current = requestId
    setIsTracingRoute(true)
    setTraceError(null)
    setTraceRoutes([])
    setSelectedTraceId(null)

    try {
      const { data } = await api.post('/pricing/route-graph/trace/', {
        start_latitude: start.lat,
        start_longitude: start.lng,
        end_latitude: end.lat,
        end_longitude: end.lng,
      })
      if (requestId !== traceRequestIdRef.current) return

      const routes: TraceRoute[] = Array.isArray(data?.routes)
        ? data.routes.map((route: any, idx: number) => ({
          id: route.id || `route-${idx}`,
          path: simplifyPath((route.path || []).map((point: any) => normalizePoint({ lat: Number(point.lat), lng: Number(point.lng) }))),
          distanceKm: Number(route.distance_km || 0),
          durationMinutes: route.duration_minutes ?? null,
          summary: route.summary || `Route ${idx + 1}`,
          provider: String(route.provider || 'route'),
          travelMode: route.travel_mode,
        } satisfies TraceRoute))
        : []
      if (!routes?.length) {
        setTraceError('No road route found. Move the pins closer to visible roads and trace again.')
        return
      }

      setTraceRoutes(routes)
      setSelectedTraceId(routes[0].id)
      const bounds = new google.maps.LatLngBounds()
      routes[0].path.forEach((point) => bounds.extend(point))
      if (!bounds.isEmpty()) mapRef.current?.fitBounds(bounds, 72)
    } catch (err: any) {
      if (requestId === traceRequestIdRef.current) {
        setTraceError(err?.response?.data?.error || 'Could not trace a road route from the backend.')
      }
    } finally {
      if (requestId === traceRequestIdRef.current) setIsTracingRoute(false)
    }
  }, [])

  const createLaneFromTrace = () => {
    if (!selectedTrace || selectedTrace.path.length < 2) return
    const lane = defaultLane(selectedTrace.path, lanes.length)
    lane.name = `${selectedTrace.provider.toUpperCase()} ${lanes.length + 1}`
    lane.distanceKm = selectedTrace.distanceKm
    setLanes((prev) => [...prev, lane])
    setSelectedLaneId(lane.id)
    setTraceRoutes([])
    setSelectedTraceId(null)
    setTraceStart(null)
    setTraceEnd(null)
    setTool('select')
  }

  const updateLanePoint = (laneId: string, pointIndex: number, point: LatLng) => {
    setLanes((prev) => prev.map((lane) => {
      if (lane.id !== laneId) return lane
      const nextPath = lane.path.map((item, idx) => idx === pointIndex ? normalizePoint(point) : item)
      return {
        ...lane,
        path: nextPath,
        distanceKm: Number((pathDistanceKm(nextPath) * lane.calibrationFactor).toFixed(3)),
      }
    }))
  }

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    const latLng = event.latLng
    if (!latLng) return
    const point = normalizePoint({ lat: latLng.lat(), lng: latLng.lng() })
    if (tool === 'trace') {
      setTraceError(null)
      setTraceRoutes([])
      setSelectedTraceId(null)
      if (!traceStart || (traceStart && traceEnd)) {
        setTraceStart(point)
        setTraceEnd(null)
      } else {
        setTraceEnd(point)
        fetchTraceRoutes(traceStart, point)
      }
      return
    }
    if (tool === 'simulate') {
      if (!simStart || (simStart && simEnd)) {
        setSimStart(point)
        setSimEnd(null)
        setEstimate(null)
      } else {
        setSimEnd(point)
        setEstimate(null)
      }
      return
    }
    if (tool === 'pen') {
      setDraftPath((prev) => [...prev, point])
      return
    }
    if (tool === 'curve') {
      setDraftPath((prev) => {
        if (prev.length === 0) return [point]
        if (prev.length === 1) return [prev[0], curveControlPoint(prev[0], point), point]
        return [point]
      })
    }
  }, [tool, traceStart, traceEnd, simStart, simEnd, lanes.length, fetchTraceRoutes])

  const saveDraft = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ versionName, lanes }))
  }

  const exportDraft = () => {
    const payload = JSON.stringify({
      versionName,
      exportedAt: new Date().toISOString(),
      lanes,
      summary: {
        laneCount: lanes.length,
        totalKm: Number(totalKm.toFixed(3)),
      },
    }, null, 2)
    navigator.clipboard.writeText(payload).catch(() => {})
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${versionName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'route-calibration'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importDraft = () => {
    try {
      const parsed = JSON.parse(importText)
      const nextLanes = Array.isArray(parsed.lanes) ? parsed.lanes : []
      setVersionName(parsed.versionName || 'Imported draft')
      setLanes(nextLanes)
      setSelectedLaneId(nextLanes[0]?.id ?? null)
      setImportText('')
    } catch {
      alert('Import failed. Paste a valid calibration JSON export.')
    }
  }

  const [isPublishing, setIsPublishing] = useState(false)

  const publishToServer = async () => {
    if (lanes.length === 0) {
      alert('Cannot publish an empty graph. Draw some lanes first.')
      return
    }
    
    setIsPublishing(true)
    try {
      await api.post('/pricing/route-graph/publish/', {
        version_name: versionName,
        lanes,
      })
      alert('Successfully published graph to server! This is now the active routing graph for pricing.')
    } catch (err: any) {
      console.error(err)
      alert('Failed to publish graph: ' + (err.response?.data?.error || err.message))
    } finally {
      setIsPublishing(false)
    }
  }

  const loadFromServer = async () => {
    try {
      const { data } = await api.get('/pricing/route-graph/active/')
      if (!data || !data.lanes) {
        alert('No active routing graph found on the server.')
        return
      }
      
      const confirmLoad = window.confirm('This will overwrite your local draft with the live published version. Continue?')
      if (!confirmLoad) return
      
      const serverLanes = data.lanes.map((lane: any) => ({
        id: lane.id,
        name: lane.name,
        path: lane.geometry,
        distanceKm: lane.distance_km,
        direction: lane.direction,
        status: lane.status,
        priority: lane.priority,
        allowedVehicles: lane.allowed_vehicles,
        calibrationFactor: 1.0,
      }))
      
      setVersionName(data.version_name)
      setLanes(serverLanes)
      setSelectedLaneId(serverLanes[0]?.id ?? null)
    } catch (err: any) {
      alert('Failed to load active graph: ' + err.message)
    }
  }

  const runEstimate = async () => {
    if (!simStart || !simEnd) return
    setEstimating(true)
    try {
      const response = await api.post<EstimateResult>('/pricing/estimate/', {
        vehicle_type: vehicle,
        pickup_latitude: simStart.lat,
        pickup_longitude: simStart.lng,
        dropoff_latitude: simEnd.lat,
        dropoff_longitude: simEnd.lng,
        passenger_count: 1,
      })
      setEstimate(response.data)
    } catch {
      alert('Could not simulate fare from the online pricing engine.')
    } finally {
      setEstimating(false)
    }
  }

  const splitSelectedLane = () => {
    if (!selectedLane || selectedLane.path.length < 4) return
    const mid = Math.floor(selectedLane.path.length / 2)
    const first = defaultLane(selectedLane.path.slice(0, mid + 1), lanes.length)
    const second = defaultLane(selectedLane.path.slice(mid), lanes.length + 1)
    first.name = `${selectedLane.name} A`
    second.name = `${selectedLane.name} B`
    first.direction = selectedLane.direction
    second.direction = selectedLane.direction
    first.allowedVehicles = selectedLane.allowedVehicles
    second.allowedVehicles = selectedLane.allowedVehicles
    setLanes((prev) => [...prev.filter((lane) => lane.id !== selectedLane.id), first, second])
    setSelectedLaneId(first.id)
  }

  const addNodeToSelectedLane = () => {
    if (!selectedLane || selectedLane.path.length < 2) return
    let insertAfter = 0
    let longest = 0
    selectedLane.path.slice(1).forEach((point, idx) => {
      const segmentKm = distanceKm(selectedLane.path[idx], point)
      if (segmentKm > longest) {
        longest = segmentKm
        insertAfter = idx
      }
    })
    const a = selectedLane.path[insertAfter]
    const b = selectedLane.path[insertAfter + 1]
    const midpoint = normalizePoint({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 })
    const nextPath = [
      ...selectedLane.path.slice(0, insertAfter + 1),
      midpoint,
      ...selectedLane.path.slice(insertAfter + 1),
    ]
    updateLane(selectedLane.id, { path: nextPath })
  }

  const deleteSelectedLane = () => {
    if (!selectedLaneId) return
    setLanes((prev) => prev.filter((lane) => lane.id !== selectedLaneId))
    setSelectedLaneId(null)
  }

  return (
    <>
      <style>{`
        .calibration-shell {
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr) 320px;
          gap: 2px;
          min-height: calc(100vh - 88px);
        }
        .calibration-panel {
          background: ${T.bgPanel};
          border: 1px solid ${T.border};
          min-width: 0;
          overflow: hidden;
        }
        .calibration-panel-scroll {
          height: 100%;
          overflow: auto;
          scrollbar-width: thin;
          scrollbar-color: ${T.border} transparent;
        }
        .calibration-header {
          padding: 10px 12px;
          border-bottom: 1px solid ${T.border};
          background: ${T.bgCard};
        }
        .calibration-map-shell {
          min-height: 680px;
          position: relative;
          background: ${T.mapBg};
        }
        .calibration-kpis {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
        }
        .calibration-tool-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .calibration-lane-row {
          width: 100%;
          border: 1px solid ${T.border};
          background: ${T.bgInput};
          color: ${T.textSecondary};
          padding: 8px;
          cursor: pointer;
          text-align: left;
          font-family: ${T.fontFamily};
        }
        .calibration-lane-row.active {
          border-color: ${T.accent};
          background: ${T.accentBg};
          color: ${T.textPrimary};
        }
        .calibration-map-tools {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 5;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          max-width: calc(100% - 24px);
        }
        .calibration-floating {
          background: ${T.mapOverlayBg};
          border: 1px solid ${T.border};
          color: ${T.textPrimary};
          padding: 8px 10px;
          font-size: 11px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.22);
        }
        @media (max-width: 1200px) {
          .calibration-shell { grid-template-columns: 280px minmax(0, 1fr); }
          .calibration-results { grid-column: 1 / -1; }
        }
        @media (max-width: 860px) {
          .calibration-shell { grid-template-columns: 1fr; }
          .calibration-map-shell { min-height: 520px; }
        }
      `}</style>

      <div className="calibration-shell">
        <aside className="calibration-panel">
          <div className="calibration-panel-scroll">
            <div className="calibration-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={16} color={T.accent} />
                <h2 style={{ margin: 0, color: T.textPrimary, fontSize: 14 }}>Route Calibration</h2>
              </div>
              <p style={{ margin: '6px 0 0', color: T.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
                Build approved campus lanes, tune distance, then test the fare engine against route pins.
              </p>
            </div>

            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Draft version</label>
                <input style={{ ...inputStyle, marginTop: 5 }} value={versionName} onChange={(e) => setVersionName(e.target.value)} />
              </div>

              <div className="calibration-kpis">
                <div style={campusPanel.cardBody}>
                  <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800 }}>LANES</div>
                  <div style={{ color: T.textPrimary, fontSize: 22, fontWeight: 900 }}>{lanes.length}</div>
                </div>
                <div style={campusPanel.cardBody}>
                  <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800 }}>KM</div>
                  <div style={{ color: T.textPrimary, fontSize: 22, fontWeight: 900 }}>{totalKm.toFixed(1)}</div>
                </div>
                <div style={campusPanel.cardBody}>
                  <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800 }}>BLOCKED</div>
                  <div style={{ color: blockedCount ? T.warn : '#10b981', fontSize: 22, fontWeight: 900 }}>{blockedCount}</div>
                </div>
              </div>

              <div>
                <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Tools</div>
                <div className="calibration-tool-grid">
                  <button type="button" style={tool === 'select' ? activeBtn : btn} onClick={() => setTool('select')}><MousePointer2 size={14} /> Select</button>
                  <button type="button" style={tool === 'pen' ? activeBtn : btn} onClick={() => { setTool('pen'); setDraftPath([]) }}><PenLine size={14} /> Pen</button>
                  <button type="button" style={tool === 'curve' ? activeBtn : btn} onClick={() => { setTool('curve'); setDraftPath([]) }}><Waypoints size={14} /> Curve</button>
                  <button type="button" style={tool === 'trace' ? activeBtn : btn} onClick={() => { setTool('trace'); setTraceRoutes([]); setSelectedTraceId(null) }}><Navigation size={14} /> Trace</button>
                  <button type="button" style={tool === 'simulate' ? activeBtn : btn} onClick={() => setTool('simulate')}><Play size={14} /> Simulate</button>
                </div>
              </div>

              <div style={{ ...campusPanel.card, padding: 10 }}>
                <div style={{ color: T.textPrimary, fontSize: 12, fontWeight: 900 }}>A to B calibration flow</div>
                <div style={{ color: T.textSecondary, fontSize: 11, lineHeight: 1.55, marginTop: 6 }}>
                  Use Trace, click point A, click point B. The lab follows the road first. Save the best route as a lane, select it, then drag its nodes or tune the distance factor before publishing.
                </div>
              </div>

              {draftPath.length > 0 && (
                <div style={{ ...campusPanel.card, padding: 10 }}>
                  <div style={{ color: T.textPrimary, fontSize: 12, fontWeight: 800 }}>
                    {tool === 'curve' && draftPath.length === 3 ? 'Curve ready' : `${draftPath.length} points in draft`}
                  </div>
                  {tool === 'curve' && draftPath.length === 3 && (
                    <div style={{ color: T.textSecondary, fontSize: 11, lineHeight: 1.45, marginTop: 5 }}>
                      Drag handle C on the map to bend the lane, then create it.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      type="button"
                      style={campusPanel.btnPrimary}
                      disabled={tool === 'curve' ? draftPath.length !== 3 : draftPath.length < 2}
                      onClick={() => addLane(tool === 'curve' ? curvePreviewPath(draftPath) : draftPath)}
                    >
                      <Plus size={13} /> Create lane
                    </button>
                    <button type="button" style={campusPanel.btnSecondary} onClick={() => setDraftPath([])}>Clear</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button type="button" style={campusPanel.btnPrimary} onClick={saveDraft}><Save size={13} /> Save draft</button>
                <button type="button" style={campusPanel.btnSecondary} onClick={exportDraft}><Download size={13} /> Export</button>
              </div>

              <div>
                <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Lanes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lanes.length === 0 && (
                    <div style={{ color: T.textSecondary, fontSize: 12, lineHeight: 1.5, border: `1px dashed ${T.border}`, padding: 12 }}>
                      Use Trace for road-following lanes, Curve for editable curved lanes, or Pen for manual point-by-point lanes.
                    </div>
                  )}
                  {lanes.map((lane) => (
                    <button
                      key={lane.id}
                      type="button"
                      className={`calibration-lane-row ${lane.id === selectedLaneId ? 'active' : ''}`}
                      onClick={() => setSelectedLaneId(lane.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ fontSize: 12 }}>{lane.name}</strong>
                        <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{lane.distanceKm.toFixed(2)}km</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <StatusPill tone={lane.status === 'active' ? 'good' : lane.status === 'blocked' ? 'warn' : 'neutral'}>{lane.status}</StatusPill>
                        <StatusPill>{lane.direction.replace('_', ' ')}</StatusPill>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="calibration-panel calibration-map-shell">
          <div className="calibration-map-tools">
            <div className="calibration-floating">
              {tool === 'pen' ? 'Click map points, then create lane.' :
                tool === 'curve' ? 'Click start and end, then drag handle C to bend the curve.' :
                  tool === 'trace' ? 'Click A, then B. The lab traces a road route for calibration.' :
                  tool === 'simulate' ? 'Click pickup and dropoff pins.' :
                    'Select lanes to inspect and tune.'}
            </div>
            {settings.distance_provider !== 'osrm' && (
              <div className="calibration-floating" style={{ color: T.warn }}>
                Provider: {settings.distance_provider}
              </div>
            )}
            <button
              type="button"
              className="calibration-floating"
              style={{ cursor: 'pointer', color: showConfiguredMap ? T.accent : T.textSecondary }}
              onClick={() => setShowConfiguredMap((value) => !value)}
            >
              {showConfiguredMap ? 'Google + configured map' : 'Google only'}
            </button>
          </div>

          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={MAP_CENTER}
              zoom={14}
              onLoad={(map) => { mapRef.current = map }}
              onClick={handleMapClick}
              options={{
                streetViewControl: false,
                fullscreenControl: false,
                mapTypeControl: true,
                clickableIcons: false,
                gestureHandling: 'greedy',
                draggableCursor: tool === 'select' ? undefined : 'crosshair',
              }}
            >
              {showConfiguredMap && lanes.map((lane) => (
                <Polyline
                  key={lane.id}
                  path={lane.path}
                  onClick={() => setSelectedLaneId(lane.id)}
                  options={{
                    strokeColor: lane.status === 'blocked' ? T.error : lane.id === selectedLaneId ? T.accent : lane.priority === 'shortcut' ? '#10b981' : '#2563eb',
                    strokeOpacity: lane.status === 'blocked' ? 0.45 : 0.92,
                    strokeWeight: lane.id === selectedLaneId ? 6 : 4,
                    zIndex: lane.id === selectedLaneId ? 3 : 2,
                  }}
                />
              ))}
              {draftPath.length >= 2 && (
                <Polyline path={curvePreviewPath(draftPath)} options={{ strokeColor: T.warn, strokeOpacity: 0.9, strokeWeight: 3, clickable: false }} />
              )}
              {draftPath.map((point, idx) => (
                <Marker
                  key={`${pointKey(point)}-${idx}`}
                  position={point}
                  label={tool === 'curve' && draftPath.length === 3 ? (idx === 0 ? 'A' : idx === 1 ? 'C' : 'B') : `${idx + 1}`}
                  draggable={tool === 'curve'}
                  onDragEnd={(event) => {
                    if (!event.latLng) return
                    const nextPoint = normalizePoint({ lat: event.latLng.lat(), lng: event.latLng.lng() })
                    setDraftPath((prev) => prev.map((item, pointIndex) => pointIndex === idx ? nextPoint : item))
                  }}
                />
              ))}
              {traceStart && <Marker position={traceStart} label="A" />}
              {traceEnd && <Marker position={traceEnd} label="B" />}
              {traceRoutes.map((route) => (
                <Polyline
                  key={route.id}
                  path={route.path}
                  onClick={() => setSelectedTraceId(route.id)}
                  options={{
                    strokeColor: route.id === selectedTrace?.id ? T.warn : '#64748b',
                    strokeOpacity: route.id === selectedTrace?.id ? 0.95 : 0.45,
                    strokeWeight: route.id === selectedTrace?.id ? 6 : 4,
                    zIndex: route.id === selectedTrace?.id ? 7 : 4,
                  }}
                />
              ))}
              {showConfiguredMap && selectedLane && tool === 'select' && selectedLane.path.map((point, idx) => (
                <Marker
                  key={`${selectedLane.id}-node-${idx}`}
                  position={point}
                  label={`${idx + 1}`}
                  draggable
                  onDragEnd={(event) => {
                    if (!event.latLng) return
                    updateLanePoint(selectedLane.id, idx, { lat: event.latLng.lat(), lng: event.latLng.lng() })
                  }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: idx === 0 || idx === selectedLane.path.length - 1 ? 7 : 5,
                    fillColor: idx === 0 || idx === selectedLane.path.length - 1 ? T.accent : '#ffffff',
                    fillOpacity: 1,
                    strokeColor: T.accent,
                    strokeWeight: 2,
                  }}
                />
              ))}
              {simStart && <Marker position={simStart} label="P" />}
              {simEnd && <Marker position={simEnd} label="D" />}
              {graphRoute?.path && graphRoute.path.length >= 2 && (
                <Polyline path={graphRoute.path} options={{ strokeColor: '#10b981', strokeWeight: 7, strokeOpacity: 0.72, zIndex: 5 }} />
              )}
              {estimate?.route?.geometry && estimate.route.geometry.length >= 2 && (
                <Polyline
                  path={estimate.route.geometry.map((point) => ({ lat: point.latitude, lng: point.longitude }))}
                  options={{ strokeColor: T.warn, strokeWeight: 4, strokeOpacity: 0.9, zIndex: 6 }}
                />
              )}
            </GoogleMap>
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: T.textSecondary }}>
              Loading calibration map...
            </div>
          )}
        </main>

        <aside className="calibration-panel calibration-results">
          <div className="calibration-panel-scroll">
            <div className="calibration-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Route size={16} color={T.accent} />
                <h2 style={{ margin: 0, color: T.textPrimary, fontSize: 14 }}>Inspector</h2>
              </div>
            </div>

            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedLane ? (
                <div style={{ ...campusPanel.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input style={inputStyle} value={selectedLane.name} onChange={(e) => updateLane(selectedLane.id, { name: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label>
                      <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 800 }}>Status</span>
                      <select style={{ ...inputStyle, marginTop: 4 }} value={selectedLane.status} onChange={(e) => updateLane(selectedLane.id, { status: e.target.value as LaneStatus })}>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </label>
                    <label>
                      <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 800 }}>Direction</span>
                      <select style={{ ...inputStyle, marginTop: 4 }} value={selectedLane.direction} onChange={(e) => updateLane(selectedLane.id, { direction: e.target.value as Direction })}>
                        <option value="two_way">Two way</option>
                        <option value="one_way">One way</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 800 }}>Calibration factor</span>
                    <input
                      type="number"
                      min={0.5}
                      max={2}
                      step={0.01}
                      style={{ ...inputStyle, marginTop: 4 }}
                      value={selectedLane.calibrationFactor}
                      onChange={(e) => updateLane(selectedLane.id, { calibrationFactor: Number(e.target.value) || 1 })}
                    />
                  </label>
                  <div>
                    <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 800 }}>Allowed vehicles</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                      {VEHICLE_TYPES.map((item) => (
                        <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textSecondary, fontSize: 11 }}>
                          <input
                            type="checkbox"
                            checked={selectedLane.allowedVehicles.includes(item.id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selectedLane.allowedVehicles, item.id]
                                : selectedLane.allowedVehicles.filter((id) => id !== item.id)
                              updateLane(selectedLane.id, { allowedVehicles: next })
                            }}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ color: T.textSecondary, fontSize: 12 }}>
                    {selectedLane.path.length} points, {selectedLane.distanceKm.toFixed(3)} calibrated km
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button type="button" style={campusPanel.btnSecondary} onClick={addNodeToSelectedLane}><Plus size={13} /> Add node</button>
                    <button type="button" style={campusPanel.btnSecondary} onClick={splitSelectedLane}><Scissors size={13} /> Split</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                    <button type="button" style={{ ...campusPanel.btnSecondary, color: T.error }} onClick={deleteSelectedLane}><Trash2 size={13} /> Delete</button>
                  </div>
                </div>
              ) : (
                <div style={{ color: T.textSecondary, fontSize: 12, border: `1px dashed ${T.border}`, padding: 12 }}>Select a lane to edit rules and calibration.</div>
              )}

              <div style={{ ...campusPanel.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Navigation size={15} color={T.warn} />
                  <strong style={{ color: T.textPrimary, fontSize: 13 }}>Auto trace lane</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button type="button" style={tool === 'trace' ? activeBtn : btn} onClick={() => setTool('trace')}><MapPin size={13} /> Place A/B</button>
                  <button
                    type="button"
                    style={btn}
                    onClick={() => {
                      setTraceStart(null)
                      setTraceEnd(null)
                      setTraceRoutes([])
                      setSelectedTraceId(null)
                      setTraceError(null)
                    }}
                  >
                    Reset
                  </button>
                </div>
                <div style={{ color: T.textSecondary, fontSize: 12, lineHeight: 1.6 }}>
                  <div>A: {traceStart ? `${traceStart.lat}, ${traceStart.lng}` : 'not set'}</div>
                  <div>B: {traceEnd ? `${traceEnd.lat}, ${traceEnd.lng}` : 'not set'}</div>
                </div>
                {isTracingRoute && <div style={{ color: T.warn, fontSize: 12 }}>Tracing road route...</div>}
                {traceError && (
                  <div style={{ color: T.warn, fontSize: 11, display: 'flex', gap: 6 }}>
                    <AlertTriangle size={13} /> {traceError}
                  </div>
                )}
                {traceRoutes.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {traceRoutes.map((route, idx) => (
                      <button
                        key={route.id}
                        type="button"
                        className={`calibration-lane-row ${route.id === selectedTrace?.id ? 'active' : ''}`}
                        onClick={() => setSelectedTraceId(route.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <strong style={{ fontSize: 12 }}>Route {idx + 1}</strong>
                          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{route.distanceKm.toFixed(2)}km</span>
                        </div>
                        <div style={{ color: T.textSecondary, fontSize: 10, marginTop: 5 }}>
                          {route.provider.toUpperCase()} {route.durationMinutes ? `/${route.durationMinutes} min` : ''} - {route.summary}
                        </div>
                      </button>
                    ))}
                    <button type="button" style={campusPanel.btnPrimary} onClick={createLaneFromTrace}>
                      <Plus size={13} /> Create lane from selected route
                    </button>
                  </div>
                )}
              </div>

              <div style={{ ...campusPanel.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={15} color={T.accent} />
                  <strong style={{ color: T.textPrimary, fontSize: 13 }}>Route simulation</strong>
                </div>
                <select style={inputStyle} value={vehicle} onChange={(e) => { setVehicle(e.target.value); setEstimate(null) }}>
                  {VEHICLE_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button type="button" style={tool === 'simulate' ? activeBtn : btn} onClick={() => setTool('simulate')}><MapPin size={13} /> Place pins</button>
                  <button type="button" style={btn} onClick={() => { setSimStart(null); setSimEnd(null); setEstimate(null) }}>Reset</button>
                </div>
                <div style={{ color: T.textSecondary, fontSize: 12, lineHeight: 1.6 }}>
                  <div>Pickup: {simStart ? `${simStart.lat}, ${simStart.lng}` : 'not set'}</div>
                  <div>Dropoff: {simEnd ? `${simEnd.lat}, ${simEnd.lng}` : 'not set'}</div>
                </div>
                <button type="button" style={campusPanel.btnPrimary} disabled={!simStart || !simEnd || estimating} onClick={runEstimate}>
                  <Play size={13} /> {estimating ? 'Running...' : 'Run online fare'}
                </button>
              </div>

              <div style={{ ...campusPanel.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Waypoints size={15} color="#10b981" />
                  <strong style={{ color: T.textPrimary, fontSize: 13 }}>Calibrated graph result</strong>
                </div>
                {graphRoute && graphRoute.path.length >= 2 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800 }}>DISTANCE</div>
                        <div style={{ color: '#10b981', fontSize: 22, fontWeight: 900 }}>{graphRoute.distanceKm.toFixed(2)} km</div>
                      </div>
                      <div>
                        <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800 }}>LANES</div>
                        <div style={{ color: T.textPrimary, fontSize: 22, fontWeight: 900 }}>{graphRoute.laneIds.length}</div>
                      </div>
                    </div>
                    {graphRoute.warnings.map((warning) => (
                      <div key={warning} style={{ color: T.warn, fontSize: 11, display: 'flex', gap: 6 }}>
                        <AlertTriangle size={13} /> {warning}
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ color: T.textSecondary, fontSize: 12 }}>Place simulation pins and connect active lanes to calculate calibrated distance.</div>
                )}
              </div>

              <div style={{ ...campusPanel.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={15} color={T.warn} />
                  <strong style={{ color: T.textPrimary, fontSize: 13 }}>Online pricing result</strong>
                </div>
                {estimate ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800 }}>FARE</div>
                        <div style={{ color: T.warn, fontSize: 22, fontWeight: 900 }}>N{estimate.total_fare.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800 }}>ROUTE</div>
                        <div style={{ color: T.textPrimary, fontSize: 22, fontWeight: 900 }}>{(estimate.route?.distance_km ?? estimate.distance_km).toFixed(2)} km</div>
                      </div>
                    </div>
                    <div style={{ color: T.textSecondary, fontSize: 12, lineHeight: 1.6 }}>
                      Provider: {estimate.route?.provider || 'distance'} / {estimate.route?.confidence || 'n/a'}
                    </div>
                  </>
                ) : (
                  <div style={{ color: T.textSecondary, fontSize: 12 }}>Run online fare to compare backend OSRM/Google pricing with the calibrated graph.</div>
                )}
              </div>

              <div style={{ ...campusPanel.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UploadCloud size={15} color={T.accent} />
                    <strong style={{ color: T.textPrimary, fontSize: 13 }}>Server Sync</strong>
                  </div>
                </div>
                <div style={{ color: T.textSecondary, fontSize: 12 }}>
                  Push your drafts to the live routing backend, or load the active graph.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    style={{ ...campusPanel.btnSecondary, justifyContent: 'center' }}
                    onClick={loadFromServer}
                  >
                    Load Live
                  </button>
                  <button
                    type="button"
                    style={{ ...campusPanel.btnPrimary, justifyContent: 'center' }}
                    onClick={publishToServer}
                    disabled={isPublishing}
                  >
                    {isPublishing ? 'Publishing...' : 'Publish'}
                  </button>
                </div>
              </div>

              <div style={{ ...campusPanel.card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginTop: -4 }}>
                <div style={{ color: T.textSecondary, fontSize: 11, fontWeight: 700 }}>IMPORT / EXPORT</div>
                <textarea
                  style={{ ...inputStyle, minHeight: 40, resize: 'vertical', fontFamily: 'monospace' }}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste calibration JSON"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button type="button" style={campusPanel.btnSecondary} onClick={importDraft}><UploadCloud size={13} /> Import</button>
                  <button type="button" style={campusPanel.btnSecondary} onClick={() => navigator.clipboard.writeText(JSON.stringify({ versionName, lanes }, null, 2))}><Copy size={13} /> Copy JSON</button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

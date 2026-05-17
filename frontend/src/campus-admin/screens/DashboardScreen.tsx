import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import {
  CalendarClock,
  ChevronDown, ChevronUp, Plus, X, Search,
  Layers, Pencil, MousePointer2, Ruler, Square, Circle,
  ZoomIn, ZoomOut, Crosshair, Maximize2,
} from 'lucide-react'
import { GoogleMap, useJsApiLoader, DrawingManager, Polyline } from '@react-google-maps/api'
import { T } from '../theme'

const GMAP_LIBS: ('drawing' | 'geometry' | 'places')[] = ['drawing', 'geometry', 'places']

type MapTool = 'select' | 'draw' | 'rectangle' | 'circle' | 'measure' | 'search'

/* ──────────────────────────────────────────────────────────────────────────────
   Colour & Design Tokens
   ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
   Static mock request data (matching screenshot exactly)
   ────────────────────────────────────────────────────────────────────────────── */

interface RideRequest {
  id: string
  route: string
  fare: string
  passengerCount: number
  reputation: string
  cargo: string
  cargoDimensions: string
  time: string
  routeMatch: string
  coordinates: string
}

const MOCK_REQUESTS: RideRequest[] = Array.from({ length: 8 }, (_, i) => ({
  id: `REQ-${1000 + i}`,
  route: 'SFO Airport to Financial District',
  fare: '$85.00',
  passengerCount: 2,
  reputation: '4.9',
  cargo: '4 Luggages, 2 Boxes',
  cargoDimensions: '(Dimensions: 2x2x3ft, 150kg)',
  time: '25 min',
  routeMatch: '92%',
  coordinates: `+97.${377 + i * 40}, 25.${5865 + i * 23}`,
}))

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
  const feedRef = useRef<HTMLDivElement>(null)

  // Toggles for traffic layers
  const [layers, setLayers] = useState({
    realMatch: true, congestionLine: false, congestion: false,
    congestion2: false, coordinate: false,
  })
  const [activeLayers, setActiveLayers] = useState({
    realMatch: true, demanCluster: false, congestion: false, coordinates: false,
  })
  const [trafficOpen, setTrafficOpen] = useState(true)
  const [activeLayersOpen, setActiveLayersOpen] = useState(true)
  const [dataControlsOpen, setDataControlsOpen] = useState(true)

  // Route creation
  const [waypoints, setWaypoints] = useState(['', ''])
  const [vehicleConstraints, setVehicleConstraints] = useState({
    xlOnly: true, cargoSpace: false, liftgate: false,
  })
  const [pricingTemplate, setPricingTemplate] = useState('standard')

  // Map controls state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTool, setActiveTool] = useState<MapTool>('select')
  const [searchQuery, setSearchQuery] = useState('')
  const [measurePoints, setMeasurePoints] = useState<google.maps.LatLngLiteral[]>([])
  const [measureDist, setMeasureDist] = useState<string | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const drawnOverlays = useRef<google.maps.MVCObject[]>([])
  const measureListenerRef = useRef<google.maps.MapsEventListener | null>(null)

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

  // Clean up measure listener when switching tools
  const clearMeasure = useCallback(() => {
    if (measureListenerRef.current) {
      google.maps.event.removeListener(measureListenerRef.current)
      measureListenerRef.current = null
    }
    setMeasurePoints([])
    setMeasureDist(null)
  }, [])

  // Set active tool
  const selectTool = useCallback((tool: MapTool) => {
    clearMeasure()
    setActiveTool(tool)

    if (tool === 'measure' && mapRef.current) {
      const pts: google.maps.LatLngLiteral[] = []
      measureListenerRef.current = mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() }
        pts.push(p)
        setMeasurePoints([...pts])
        if (pts.length >= 2) {
          let total = 0
          for (let i = 1; i < pts.length; i++) {
            total += google.maps.geometry.spherical.computeDistanceBetween(
              new google.maps.LatLng(pts[i - 1]),
              new google.maps.LatLng(pts[i])
            )
          }
          setMeasureDist(total >= 1000 ? `${(total / 1000).toFixed(2)} km` : `${Math.round(total)} m`)
        }
      })
    }

    if (tool === 'search') {
      setSearchQuery('')
    }
  }, [clearMeasure])

  // Handle overlay completion from DrawingManager
  const onOverlayComplete = useCallback((e: google.maps.drawing.OverlayCompleteEvent) => {
    drawnOverlays.current.push(e.overlay!)
    // Reset drawing mode back to null after placing one shape
    setActiveTool('select')
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
    setActiveTool('select')
  }, [searchQuery])

  // Clear all drawings
  const clearDrawings = useCallback(() => {
    drawnOverlays.current.forEach(o => (o as any).setMap?.(null))
    drawnOverlays.current = []
    clearMeasure()
  }, [clearMeasure])

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

  /* ────────────────────────────────────────────────────────────────────────── */

  return (
    <>
        {/* ── Content area (three-column layout) ──────────────────────────── */}
        <div style={s.content}>

          {/* ────────────────── LEFT: Open Requests ─────────────────────── */}
          {!isFullscreen && (
          <div style={s.leftPanel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>Open Requests</span>
              <button style={s.moreBtn}>...</button>
            </div>
            <div style={s.requestList}>
              {MOCK_REQUESTS.map((req) => (
                <div key={req.id} style={s.reqCard}>
                  <div style={s.reqRow}>
                    <span style={s.reqLabel}>Route:</span>
                    <span style={s.reqRoute}>{req.route}</span>
                  </div>
                  <div style={s.reqRow}>
                    <span style={s.reqLabel}>Est. Fare:</span>
                    <span style={{ ...s.reqValue, color: T.accent }}>{req.fare}</span>
                  </div>
                  <div style={s.reqRow}>
                    <span style={s.reqLabel}>Passenger:</span>
                    <span style={s.reqValue}>
                      {req.passengerCount} (Reputation: {req.reputation}
                      <span style={{ color: T.warn }}>*</span>)
                    </span>
                  </div>
                  <div style={s.reqRow}>
                    <span style={s.reqLabel}>Cargo:</span>
                    <span style={s.reqValue}>{req.cargo}</span>
                  </div>
                  <div style={{ ...s.reqRow, paddingLeft: 52 }}>
                    <span style={{ ...s.reqValue, color: T.textMuted, fontSize: 10 }}>
                      {req.cargoDimensions}
                    </span>
                  </div>
                  <div style={s.reqRow}>
                    <span style={s.reqLabel}>Time:</span>
                    <span style={s.reqValue}>{req.time}</span>
                  </div>
                  <div style={s.reqMatchRow}>
                    <span style={s.reqLabel}>Route Match:</span>
                    <span style={s.matchBadge}>{req.routeMatch}</span>
                    <span style={s.reqCoord}>{req.coordinates}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ────────────────── CENTER: Map + Data Feed ─────────────────── */}
          <div style={s.centerPanel}>
            {/* Map toolbar */}
            <div style={s.mapToolbar}>
              <div style={s.toolbarLeft}>
                {measureDist && (
                  <span style={{ ...s.searchPill, background: T.accent, color: '#fff', borderColor: T.accent }}>
                    📏 {measureDist}
                    <X size={11} style={{ cursor: 'pointer', marginLeft: 4 }} onClick={clearMeasure} />
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
                    {activeTool === 'select' ? 'Pan & Select' :
                     activeTool === 'draw' ? 'Draw Polyline' :
                     activeTool === 'rectangle' ? 'Draw Rectangle' :
                     activeTool === 'circle' ? 'Draw Circle' :
                     activeTool === 'measure' ? 'Click map to measure' : ''}
                  </span>
                )}
              </div>
              <div style={s.toolbarRight}>
                {[
                  { icon: MousePointer2, tool: 'select' as MapTool, title: 'Select / Pan' },
                  { icon: Pencil, tool: 'draw' as MapTool, title: 'Draw Polyline' },
                  { icon: Square, tool: 'rectangle' as MapTool, title: 'Draw Rectangle' },
                  { icon: Circle, tool: 'circle' as MapTool, title: 'Draw Circle' },
                  { icon: Ruler, tool: 'measure' as MapTool, title: 'Measure Distance' },
                  { icon: Search, tool: 'search' as MapTool, title: 'Search Location' },
                ].map(({ icon: Icon, tool, title }) => (
                  <button
                    key={tool}
                    style={{ ...s.toolBtn, ...(activeTool === tool ? { background: T.accent, color: '#fff', borderColor: T.accent } : {}) }}
                    onClick={() => selectTool(tool)}
                    title={title}
                  >
                    <Icon size={14} strokeWidth={1.6} />
                  </button>
                ))}
                <div style={s.toolDivider} />
                <button style={s.filterBtn} onClick={clearDrawings} title="Clear all drawings">
                  <Layers size={13} /> Clear
                </button>
                <button style={s.filterBtn}>
                  Filter all <ChevronDown size={12} />
                </button>
              </div>
            </div>

            {/* Map area */}
            <div style={s.mapArea}>
              <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                {isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={MAP_CENTER}
                    onLoad={onMapLoad}
                    zoom={DEFAULT_ZOOM}
                    options={{
                      disableDefaultUI: true,
                      draggable: activeTool === 'select' || activeTool === 'search',
                      clickableIcons: activeTool === 'select',
                      gestureHandling: 'greedy',
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
                      styles: [
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
                      ],
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
                    {/* Measure polyline */}
                    {activeTool === 'measure' && measurePoints.length >= 2 && (
                      <Polyline
                        path={measurePoints}
                        options={{ strokeColor: '#f59e0b', strokeWeight: 3, strokeOpacity: 0.9, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '16px' }] }}
                      />
                    )}
                  </GoogleMap>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted }}>
                    Initializing secure map connection...
                  </div>
                )}
              </div>

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
            <div style={s.dataFeed}>
              <div style={s.dataFeedHeader}>
                Live Demand Insights &amp; Logistics Data
              </div>
              <div ref={feedRef} style={s.dataFeedBody}>
                {DEMAND_LINES.map((line, i) => (
                  <div key={i} style={s.dataLine}>{line}</div>
                ))}
              </div>
            </div>
            )}
          </div>

          {/* ────────────────── RIGHT: Quick Route Creation ──────────────── */}
          {!isFullscreen && (
          <div style={s.rightPanel}>
            <div style={s.rpHeader}>
              <span style={s.panelTitle}>Quick Route Creation</span>
              <button style={{ ...s.moreBtn, fontSize: 16 }}><X size={14} /></button>
            </div>

            {/* Departure Window */}
            <div style={s.rpSection}>
              <div style={s.rpLabel}>Departure Window</div>
              <div style={s.rpInputRow}>
                <div style={s.rpInputIcon}>
                  <CalendarClock size={13} />
                </div>
                <input style={s.rpInput} defaultValue="Date/2023" readOnly />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <div style={{ ...s.rpInputRow, flex: 1 }}>
                  <input style={s.rpInput} defaultValue="11:00 AM" readOnly />
                </div>
                <span style={{ color: T.textMuted, alignSelf: 'center', fontSize: 12 }}>-</span>
                <div style={{ ...s.rpInputRow, flex: 1 }}>
                  <input style={s.rpInput} defaultValue="11:00 PM" readOnly />
                </div>
              </div>
            </div>

            {/* Multi-Stop Route */}
            <div style={s.rpSection}>
              <div style={s.rpLabel}>Multi-Stop Route</div>
              {waypoints.map((_, i) => (
                <div key={i} style={{ ...s.rpInputRow, marginBottom: 6 }}>
                  <div style={s.rpInputIcon}><Plus size={12} /></div>
                  <input style={s.rpInput} placeholder="Add Waypoint" />
                  <button style={s.rpRemoveBtn}><X size={12} /></button>
                </div>
              ))}
              <button
                style={s.addWaypointBtn}
                onClick={() => setWaypoints(p => [...p, ''])}
              >
                Add waypoint
              </button>
            </div>

            {/* Vehicle Constraints */}
            <div style={s.rpSection}>
              <div style={s.rpLabel}>Vehicle Constraints</div>
              {[
                { key: 'xlOnly' as const, label: 'XL Only' },
                { key: 'cargoSpace' as const, label: 'Cargo Space > 500kg' },
                { key: 'liftgate' as const, label: 'Liftgate' },
              ].map((item) => (
                <div key={item.key} style={s.rpCheckRow}>
                  <div style={{
                    ...s.rpCheckbox,
                    background: vehicleConstraints[item.key] ? T.accent : 'transparent',
                    borderColor: vehicleConstraints[item.key] ? T.accent : T.border,
                  }}
                    onClick={() => setVehicleConstraints(p => ({ ...p, [item.key]: !p[item.key] }))}
                  >
                    {vehicleConstraints[item.key] && (
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
              <div style={s.rpLabel}>Pricing Templates</div>
              {['Standard', 'Premium', 'Freight'].map((tmpl) => (
                <div
                  key={tmpl}
                  style={s.rpRadioRow}
                  onClick={() => setPricingTemplate(tmpl.toLowerCase())}
                >
                  <div style={{
                    ...s.rpRadio,
                    borderColor: pricingTemplate === tmpl.toLowerCase() ? T.accent : T.border,
                  }}>
                    {pricingTemplate === tmpl.toLowerCase() && (
                      <div style={s.rpRadioDot} />
                    )}
                  </div>
                  <span style={s.rpCheckLabel}>{tmpl}</span>
                </div>
              ))}
            </div>

            {/* Schedule Route button */}
            <button style={s.scheduleBtn}>
              Schedule Route
            </button>
          </div>
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
    height: 110, background: T.bgPanel, borderTop: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  dataFeedHeader: {
    padding: '6px 12px', fontSize: 11, fontWeight: 700,
    color: T.textWhite, borderBottom: `1px solid ${T.border}`,
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

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  AlertTriangle, Filter, MapPin, Navigation, Users, ChevronRight, ChevronLeft, Radio
} from 'lucide-react'
import { Circle, GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { T, useCampusThemeStore } from '../theme'
import { useDispatchStore } from '../dispatchStore'
import api from '../../core/api'
import { createAuthenticatedWebSocket } from '../../core/ws'
import RouteOpsPanel from './RouteOpsPanel'

const MAP_CENTER = { lat: 9.5323, lng: 6.4526 }
const DEFAULT_ZOOM = 14

interface GarageRide {
  id: string
  reference: string
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

type DriverLocation = { lat: number; lng: number; heading?: number | null; speedKmh?: number | null }

type FleetDriver = {
  driver_id: string
  driver_name: string
  latitude: number
  longitude: number
  heading?: number | null
  speed_kmh?: number | null
  updated_at: string
  is_online: boolean
  is_on_trip: boolean
  vehicle_type?: string | null
  maintenance_status?: string | null
  verification_status?: string | null
  campus_id?: string | null
}

type DispatchIncident = {
  id: string
  type: string
  severity: string
  ride_id?: string | null
  driver_id?: string | null
  message: string
  created_at: string
  latitude?: number | null
  longitude?: number | null
  last_seen_at?: string
}

type DispatchKpi = {
  window_minutes: number
  sla_target_minutes: number
  total_requests: number
  total_assigned: number
  sla_breach_pct: number
  avg_dispatch_minutes: number | null
}

const statusOptions = ['all', 'open', 'full', 'departed', 'cancelled']

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function LiveFleetPanel() {
  const [activeGarageRides, setActiveGarageRides] = useState<GarageRide[]>([])
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null)
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [fleetDrivers, setFleetDrivers] = useState<Record<string, FleetDriver>>({})
  const [incidents, setIncidents] = useState<DispatchIncident[]>([])
  const [incidentHistory, setIncidentHistory] = useState<DispatchIncident[]>([])
  const [kpi, setKpi] = useState<DispatchKpi | null>(null)
  const [rideWsConnected, setRideWsConnected] = useState(false)
  const [fleetWsConnected, setFleetWsConnected] = useState(false)
  const [incidentWsConnected, setIncidentWsConnected] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true)
  const [fleetFilter, setFleetFilter] = useState<'all' | 'idle' | 'on_trip'>('all')

  const { mode } = useCampusThemeStore()
  const { showTraffic, showHeat, showRoutes, setWsConnected, recenterTrigger } = useDispatchStore()

  const mapRef = useRef<google.maps.Map | null>(null)
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null)
  const driverWsRef = useRef<WebSocket | null>(null)
  const fleetWsRef = useRef<WebSocket | null>(null)
  const incidentWsRef = useRef<WebSocket | null>(null)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: ['drawing', 'geometry', 'places'],
  })

  useEffect(() => {
    const ws = createAuthenticatedWebSocket('/ws/campus-admin/rides/')
    if (!ws) return

    ws.onopen = () => setRideWsConnected(true)
    ws.onclose = () => setRideWsConnected(false)
    ws.onerror = () => setRideWsConnected(false)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'initial_rides') {
          setActiveGarageRides(data.rides)
        } else if (data.type === 'ride_created') {
          setActiveGarageRides(prev => [data.ride, ...prev])
        } else if (data.type === 'ride_updated') {
          setActiveGarageRides(prev => prev.map(r => (r.id === data.ride.id ? data.ride : r)))
        } else if (data.type === 'ride_departed' || data.type === 'ride_cancelled') {
          setActiveGarageRides(prev => prev.filter(r => r.id !== (data.ride?.id || data.ride_id)))
        }
      } catch (e) {
        console.error('Dispatch WS parse error:', e)
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    const ws = createAuthenticatedWebSocket('/ws/campus-admin/incidents/')
    if (!ws) return
    incidentWsRef.current = ws

    ws.onopen = () => setIncidentWsConnected(true)
    ws.onclose = () => setIncidentWsConnected(false)
    ws.onerror = () => setIncidentWsConnected(false)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'initial_incidents') {
          setIncidents(data.incidents || [])
        } else if (data.type === 'incident_update') {
          setIncidents(data.incidents || [])
        }
      } catch (e) {
        console.error('Incident WS parse error:', e)
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    const ws = createAuthenticatedWebSocket('/ws/campus-admin/fleet/')
    if (!ws) return
    fleetWsRef.current = ws

    ws.onopen = () => setFleetWsConnected(true)
    ws.onclose = () => setFleetWsConnected(false)
    ws.onerror = () => setFleetWsConnected(false)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'initial_positions') {
          const next: Record<string, FleetDriver> = {}
          for (const driver of data.drivers || []) {
            if (driver?.driver_id) {
              next[driver.driver_id] = driver
            }
          }
          setFleetDrivers(next)
        } else if (data.type === 'driver_location' && data.driver?.driver_id) {
          const driverId = data.driver.driver_id
          setFleetDrivers((prev) => ({ ...prev, [driverId]: { ...prev[driverId], ...data.driver } }))
        }
      } catch (e) {
        console.error('Fleet WS parse error:', e)
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    setWsConnected(rideWsConnected || fleetWsConnected || incidentWsConnected)
  }, [rideWsConnected, fleetWsConnected, incidentWsConnected, setWsConnected])

  useEffect(() => {
    let isActive = true
    let timer: ReturnType<typeof setInterval> | null = null

    const loadTelemetry = async () => {
      try {
        const [kpiRes, historyRes] = await Promise.all([
          api.get('tracking/fleet/kpi/'),
          api.get('tracking/fleet/incidents/history/?limit=40'),
        ])
        if (!isActive) return
        setKpi(kpiRes.data)
        setIncidentHistory(historyRes.data?.incidents || [])
      } catch {
        if (!isActive) return
      }
    }

    void loadTelemetry()
    timer = setInterval(loadTelemetry, 60000)

    return () => {
      isActive = false
      if (timer) clearInterval(timer)
    }
  }, [])

  const selectedRide = useMemo(
    () => activeGarageRides.find((ride) => ride.id === selectedRideId) || null,
    [activeGarageRides, selectedRideId]
  )

  const selectedRideDriverId = selectedRide?.driver?.id || null

  useEffect(() => {
    if (!selectedRideId) {
      if (driverWsRef.current) driverWsRef.current.close()
      driverWsRef.current = null
      setDriverLocation(null)
      return
    }

    if (driverWsRef.current) {
      driverWsRef.current.close()
      driverWsRef.current = null
    }

    const socket = createAuthenticatedWebSocket(`/ws/ride/${selectedRideId}/track/`)
    if (!socket) {
      setDriverLocation(null)
      return
    }
    driverWsRef.current = socket
    setDriverLocation(null)

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type === 'driver_location') {
          const lat = toNumber(payload.latitude)
          const lng = toNumber(payload.longitude)
          if (lat !== null && lng !== null) {
            setDriverLocation({ lat, lng, heading: payload.heading ?? null, speedKmh: payload.speed_kmh ?? null })
          }
        }
      } catch {
        // ignore malformed payloads
      }
    }

    return () => {
      socket.close()
    }
  }, [selectedRideId])

  useEffect(() => {
    const maxAgeMs = 120000
    const timer = setInterval(() => {
      const now = Date.now()
      setFleetDrivers((prev) => {
        const next: Record<string, FleetDriver> = {}
        for (const [key, value] of Object.entries(prev)) {
          const updatedAt = Date.parse(value.updated_at)
          if (!Number.isNaN(updatedAt) && now - updatedAt <= maxAgeMs) {
            next[key] = value
          }
        }
        return next
      })
    }, 30000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return

    if (showTraffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer()
      }
      trafficLayerRef.current.setMap(mapRef.current)
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null)
    }
  }, [showTraffic, isLoaded])

  const filteredRides = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activeGarageRides.filter((ride) => {
      const statusMatch = statusFilter === 'all' || ride.status === statusFilter
      if (!statusMatch) return false
      if (!query) return true
      const fields = [
        ride.reference,
        ride.origin_address,
        ride.destination_address,
        ride.driver?.full_name,
        ride.vehicle_type,
      ].join(' ').toLowerCase()
      return fields.includes(query)
    })
  }, [activeGarageRides, search, statusFilter])

  const fleetList = useMemo(() => Object.values(fleetDrivers), [fleetDrivers])
  const onlineDrivers = useMemo(() => fleetList.filter((driver) => driver.is_online), [fleetList])
  const onTripDrivers = useMemo(() => onlineDrivers.filter((driver) => driver.is_on_trip), [onlineDrivers])
  const idleDrivers = useMemo(() => onlineDrivers.filter((driver) => !driver.is_on_trip), [onlineDrivers])
  const filteredFleet = useMemo(() => {
    if (fleetFilter === 'idle') return idleDrivers
    if (fleetFilter === 'on_trip') return onTripDrivers
    return onlineDrivers
  }, [fleetFilter, idleDrivers, onTripDrivers, onlineDrivers])

  const incidentRides = useMemo(() => {
    const now = Date.now()
    return filteredRides.filter((ride) => {
      const createdAt = new Date(ride.created_at).getTime()
      if (Number.isNaN(createdAt)) return false
      const ageMinutes = (now - createdAt) / 60000
      return ageMinutes >= 20 && ride.status !== 'cancelled'
    })
  }, [filteredRides])

  const mergedIncidents = useMemo(() => {
    if (incidents.length > 0) return incidents
    return incidentRides.map((ride) => ({
      id: `ride:${ride.id}`,
      type: 'garage_ride_age',
      severity: 'medium',
      ride_id: ride.id,
      driver_id: ride.driver?.id || null,
      message: `Garage ride ${ride.reference} delayed`,
      created_at: ride.created_at,
    }))
  }, [incidents, incidentRides])

  const heatIncidents = useMemo(() => {
    return mergedIncidents
      .filter((incident: any) => incident.latitude && incident.longitude)
      .filter((incident) => ['high_demand_shortage', 'no_driver_assigned'].includes(incident.type))
      .slice(0, 50)
  }, [mergedIncidents])

  const activeDriverId = selectedDriverId || selectedRideDriverId
  const activeDriver = activeDriverId ? fleetDrivers[activeDriverId] : null

  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return
    mapRef.current.panTo(MAP_CENTER)
    mapRef.current.setZoom(DEFAULT_ZOOM)
  }, [])

  useEffect(() => {
    if (recenterTrigger > 0) {
      handleRecenter()
    }
  }, [recenterTrigger, handleRecenter])

  const handleSelectRide = useCallback((rideId: string) => {
    setSelectedRideId(rideId)
    const ride = activeGarageRides.find((item) => item.id === rideId)
    if (!ride || !mapRef.current) return
    if (ride.driver?.id) {
      setSelectedDriverId(ride.driver.id)
    }
    const lat = toNumber(ride.origin_latitude)
    const lng = toNumber(ride.origin_longitude)
    if (lat !== null && lng !== null) {
      mapRef.current.panTo({ lat, lng })
      mapRef.current.setZoom(15)
    }
  }, [activeGarageRides])

  const selectedOrigin = useMemo(() => {
    if (!selectedRide) return null
    const lat = toNumber(selectedRide.origin_latitude)
    const lng = toNumber(selectedRide.origin_longitude)
    return lat !== null && lng !== null ? { lat, lng } : null
  }, [selectedRide])

  const selectedDestination = useMemo(() => {
    if (!selectedRide) return null
    const lat = toNumber(selectedRide.destination_latitude)
    const lng = toNumber(selectedRide.destination_longitude)
    return lat !== null && lng !== null ? { lat, lng } : null
  }, [selectedRide])

  return (
    <div style={s.content}>
      <div style={s.centerPanel}>
        <div style={s.mapToolbar}>
          <div style={s.filterGroup}>
            <Filter size={14} color={T.textSecondary} />
            {statusOptions.map((status) => (
              <button
                key={status}
                style={{
                  ...s.filterChip,
                  background: statusFilter === status ? T.accent : 'transparent',
                  color: statusFilter === status ? '#fff' : T.textSecondary,
                  borderColor: statusFilter === status ? T.accent : T.border,
                }}
                onClick={() => setStatusFilter(status)}
              >
                {status.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ride, driver, or location..."
            style={s.searchInput}
          />
        </div>

        <div style={s.fleetFilterBar}>
          <span style={s.fleetFilterLabel}>Fleet filter</span>
          {['all', 'idle', 'on_trip'].map((key) => (
            <button
              key={key}
              style={{
                ...s.fleetFilterChip,
                background: fleetFilter === key ? T.heatTeal : 'transparent',
                color: fleetFilter === key ? '#fff' : T.textSecondary,
                borderColor: fleetFilter === key ? T.heatTeal : T.border,
              }}
              onClick={() => setFleetFilter(key as 'all' | 'idle' | 'on_trip')}
            >
              {key.replaceAll('_', ' ')}
            </button>
          ))}
        </div>

        <div style={s.mapArea}>
          {!isLoaded ? (
            <div style={s.mapPlaceholder}>Initializing secure map connection...</div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%', backgroundColor: mode === 'dark' ? '#0f1117' : '#f9fafb' }}
              center={MAP_CENTER}
              zoom={DEFAULT_ZOOM}
              onLoad={(map) => { mapRef.current = map }}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                clickableIcons: false,
                gestureHandling: 'greedy',
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
              }}
            >
              {filteredFleet.slice(0, 500).map((driver) => {
                const isFocused = driver.driver_id === activeDriverId
                const color = driver.is_on_trip ? T.accent : T.heatTeal
                return (
                  <Marker
                    key={driver.driver_id}
                    position={{ lat: driver.latitude, lng: driver.longitude }}
                    onClick={() => setSelectedDriverId(driver.driver_id)}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: isFocused ? 8 : 6,
                      fillColor: color,
                      fillOpacity: 1,
                      strokeColor: '#0f172a',
                      strokeWeight: isFocused ? 3 : 2,
                    }}
                  />
                )
              })}

              {filteredRides.slice(0, 60).map((ride) => {
                const lat = toNumber(ride.origin_latitude)
                const lng = toNumber(ride.origin_longitude)
                if (lat === null || lng === null) return null
                return (
                  <Marker
                    key={ride.id}
                    position={{ lat, lng }}
                    onClick={() => handleSelectRide(ride.id)}
                    label={{ text: 'P', color: '#fff', fontSize: '10px', fontWeight: '700' }}
                  />
                )
              })}

              {selectedOrigin && (
                <Marker
                  position={selectedOrigin}
                  label={{ text: 'Pickup', color: '#fff', fontSize: '10px', fontWeight: '700' }}
                />
              )}

              {selectedDestination && (
                <Marker
                  position={selectedDestination}
                  label={{ text: 'Drop', color: '#fff', fontSize: '10px', fontWeight: '700' }}
                />
              )}

              {driverLocation && (
                <Marker
                  position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: T.accent,
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                  }}
                />
              )}

              {showRoutes && selectedOrigin && selectedDestination && (
                <Polyline
                  path={[selectedOrigin, selectedDestination]}
                  options={{ strokeColor: T.warn, strokeOpacity: 0.8, strokeWeight: 4 }}
                />
              )}

              {showHeat && heatIncidents.map((incident: any) => (
                <Circle
                  key={`heat-${incident.id}`}
                  center={{ lat: Number(incident.latitude), lng: Number(incident.longitude) }}
                  radius={incident.type === 'high_demand_shortage' ? 500 : 350}
                  options={{
                    fillColor: incident.type === 'high_demand_shortage' ? T.warn : T.accent,
                    fillOpacity: 0.2,
                    strokeColor: incident.type === 'high_demand_shortage' ? T.warn : T.accent,
                    strokeOpacity: 0.5,
                    strokeWeight: 1,
                  }}
                />
              ))}

              {selectedOrigin && selectedRide && (
                <InfoWindow
                  position={selectedOrigin}
                  onCloseClick={() => {
                    setSelectedRideId(null)
                    setSelectedDriverId(null)
                  }}
                >
                  <div style={s.infoWindow}>
                    <div style={s.infoTitle}>Ride {selectedRide.reference}</div>
                    <div style={s.infoText}>{selectedRide.origin_address}</div>
                    <div style={s.infoText}>{selectedRide.destination_address}</div>
                    <div style={s.infoMeta}>
                      Driver: {selectedRide.driver?.full_name || 'Unassigned'}
                    </div>
                  </div>
                </InfoWindow>
              )}

              {activeDriver && (
                <InfoWindow
                  position={{ lat: activeDriver.latitude, lng: activeDriver.longitude }}
                  onCloseClick={() => setSelectedDriverId(null)}
                >
                  <div style={s.infoWindow}>
                    <div style={s.infoTitle}>{activeDriver.driver_name}</div>
                    <div style={s.infoText}>Status: {activeDriver.is_on_trip ? 'On Trip' : 'Idle'}</div>
                    <div style={s.infoText}>Vehicle: {activeDriver.vehicle_type || 'N/A'}</div>
                    <div style={s.infoMeta}>Last update: {new Date(activeDriver.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}

          {showHeat && heatIncidents.length === 0 && <div style={s.heatOverlay} />}
        </div>
      </div>

      {isRightPanelOpen ? (
        <div style={s.rightPanel}>
          <div style={s.rpHeader}>
            <span style={s.panelTitle}>Operations</span>
            <span style={{ ...s.wsBadge, color: rideWsConnected || fleetWsConnected || incidentWsConnected ? T.heatTeal : T.warn }}>
              <Radio size={12} />
              {rideWsConnected || fleetWsConnected || incidentWsConnected ? 'Live' : 'Offline'}
            </span>
            <button style={s.moreBtn} onClick={() => setIsRightPanelOpen(false)}>
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={s.panelSection}>
              <div style={s.panelHeader}>
                <div style={s.panelTitleRow}>
                  <Users size={16} />
                  <span style={s.panelTitle}>Fleet Pulse</span>
                </div>
                <span style={s.panelMeta}>{onlineDrivers.length} online</span>
              </div>
              <div style={s.fleetGrid}>
                <div style={s.fleetTile}>
                  <span style={s.fleetLabel}>Total Tracked</span>
                  <span style={s.fleetValue}>{fleetList.length}</span>
                </div>
                <div style={s.fleetTile}>
                  <span style={s.fleetLabel}>Idle</span>
                  <span style={{ ...s.fleetValue, color: T.heatTeal }}>{idleDrivers.length}</span>
                </div>
                <div style={s.fleetTile}>
                  <span style={s.fleetLabel}>On Trip</span>
                  <span style={{ ...s.fleetValue, color: T.accent }}>{onTripDrivers.length}</span>
                </div>
              </div>
            </div>

            <div style={s.panelSection}>
              <div style={s.panelHeader}>
                <div style={s.panelTitleRow}>
                  <Users size={16} />
                  <span style={s.panelTitle}>Executive KPIs</span>
                </div>
                <span style={s.panelMeta}>{kpi ? `${kpi.window_minutes}m window` : 'Loading'}</span>
              </div>
              <div style={s.kpiGrid}>
                <div style={s.kpiTile}>
                  <span style={s.kpiLabel}>SLA Breach</span>
                  <span style={{ ...s.kpiValue, color: T.warn }}>{kpi ? `${kpi.sla_breach_pct}%` : '—'}</span>
                </div>
                <div style={s.kpiTile}>
                  <span style={s.kpiLabel}>Avg Dispatch</span>
                  <span style={s.kpiValue}>{kpi?.avg_dispatch_minutes != null ? `${kpi.avg_dispatch_minutes} min` : '—'}</span>
                </div>
                <div style={s.kpiTile}>
                  <span style={s.kpiLabel}>Assigned</span>
                  <span style={s.kpiValue}>{kpi ? kpi.total_assigned : '—'}</span>
                </div>
              </div>
            </div>

            <div style={s.panelSection}>
              <div style={s.panelHeader}>
                <div style={s.panelTitleRow}>
                  <Users size={16} />
                  <span style={s.panelTitle}>Driver Detail</span>
                </div>
                {activeDriver && (
                  <button style={s.linkBtn} onClick={() => setSelectedDriverId(null)}>
                    Clear
                  </button>
                )}
              </div>
              {!activeDriver ? (
                <div style={s.emptyCard}>Select a driver marker to view details.</div>
              ) : (
                <div style={s.driverCard}>
                  <div style={s.driverName}>{activeDriver.driver_name}</div>
                  <div style={s.driverMeta}>Status: {activeDriver.is_on_trip ? 'On Trip' : 'Idle'}</div>
                  <div style={s.driverMeta}>Vehicle: {activeDriver.vehicle_type || 'N/A'}</div>
                  <div style={s.driverMeta}>Maintenance: {activeDriver.maintenance_status || 'N/A'}</div>
                  <div style={s.driverMeta}>Verification: {activeDriver.verification_status || 'N/A'}</div>
                  <div style={s.driverMeta}>Last update: {new Date(activeDriver.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={s.driverActions}>
                    <button style={s.driverActionBtn}>Message</button>
                    <button style={s.driverActionBtn}>Call</button>
                    <button style={s.driverActionBtn}>Profile</button>
                  </div>
                </div>
              )}
            </div>

            <div style={s.panelSection}>
              <div style={s.panelHeader}>
                <div style={s.panelTitleRow}>
                  <Users size={16} />
                  <span style={s.panelTitle}>Ride Queue</span>
                </div>
                <span style={s.panelMeta}>{filteredRides.length} active</span>
              </div>
              <div style={s.queueList}>
                {filteredRides.length === 0 ? (
                  <div style={s.emptyCard}>No rides match the current filters.</div>
                ) : (
                  filteredRides.map((ride) => (
                    <button
                      key={ride.id}
                      style={{
                        ...s.queueCard,
                        borderColor: ride.id === selectedRideId ? T.accent : T.border,
                        background: ride.id === selectedRideId ? T.accentBg : T.bgCard,
                      }}
                      onClick={() => handleSelectRide(ride.id)}
                    >
                      <div style={s.queueTop}>
                        <span style={s.queueRef}>{ride.reference}</span>
                        <span style={s.queueStatus}>{ride.status.replaceAll('_', ' ')}</span>
                      </div>
                      <div style={s.queueRoute}>{ride.origin_address.split(',')[0]} → {ride.destination_address.split(',')[0]}</div>
                      <div style={s.queueMeta}>
                        Driver: {ride.driver?.full_name || 'Unassigned'} • Seats {ride.booked_seats}/{ride.total_seats}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div style={s.panelSection}>
              <div style={s.panelHeader}>
                <div style={s.panelTitleRow}>
                  <AlertTriangle size={16} />
                  <span style={s.panelTitle}>Incident Watch</span>
                </div>
                <span style={s.panelMeta}>{mergedIncidents.length} flagged</span>
              </div>
              <div style={s.queueList}>
                {mergedIncidents.length === 0 ? (
                  <div style={s.emptyCard}>No delayed rides detected.</div>
                ) : (
                  mergedIncidents.map((incident) => (
                    <div key={incident.id} style={s.incidentCard}>
                      <div style={s.incidentTitle}>{incident.message}</div>
                      <div style={s.incidentMeta}>Type: {incident.type.replaceAll('_', ' ')}</div>
                      <div style={s.incidentMeta}>Severity: {incident.severity}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={s.panelSection}>
              <div style={s.panelHeader}>
                <div style={s.panelTitleRow}>
                  <AlertTriangle size={16} />
                  <span style={s.panelTitle}>Incident History</span>
                </div>
                <span style={s.panelMeta}>{incidentHistory.length} entries</span>
              </div>
              <div style={s.queueList}>
                {incidentHistory.length === 0 ? (
                  <div style={s.emptyCard}>No incident history recorded yet.</div>
                ) : (
                  incidentHistory.map((incident) => (
                    <div key={`hist-${incident.id}`} style={s.incidentCard}>
                      <div style={s.incidentTitle}>{incident.message}</div>
                      <div style={s.incidentMeta}>Last seen: {incident.last_seen_at ? new Date(incident.last_seen_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                      <div style={s.incidentMeta}>Type: {incident.type.replaceAll('_', ' ')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={s.panelSection}>
              <div style={s.panelHeader}>
                <div style={s.panelTitleRow}>
                  <Navigation size={16} />
                  <span style={s.panelTitle}>Driver Signal</span>
                </div>
              </div>
              <div style={s.signalCard}>
                {selectedRideId ? (
                  <>
                    <div style={s.signalRow}>
                      <MapPin size={14} />
                      <span>{driverLocation ? 'Live location active' : 'Awaiting location event'}</span>
                    </div>
                    <div style={s.signalMeta}>Tracking ride {selectedRide?.reference || '...'}</div>
                  </>
                ) : (
                  <div style={s.emptyCard}>Select a ride to stream updates.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...s.rightPanel, width: 36, alignItems: 'center', cursor: 'pointer', boxShadow: 'none' }} onClick={() => setIsRightPanelOpen(true)}>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${T.border}`, width: '100%', display: 'flex', justifyContent: 'center' }}>
            <ChevronLeft size={16} color={T.textMuted} />
          </div>
          <div style={{ writingMode: 'vertical-rl', padding: '16px 0', fontSize: 11, fontWeight: 600, color: T.textSecondary, letterSpacing: 1 }}>
            Ride Queue & Alerts
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  content: { flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' },
  centerPanel: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: 36, boxSizing: 'border-box' },
  mapToolbar: { height: 44, background: T.bgPanel, display: 'flex', alignItems: 'center', position: 'relative', padding: '0 12px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 },
  fleetFilterBar: { height: 34, background: T.bgPanel, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 },
  fleetFilterLabel: { fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  fleetFilterChip: { borderRadius: 999, border: `1px solid ${T.border}`, padding: '3px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' },
  mapArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  
  rightPanel: {
    width: 310, background: T.bgPanel, borderLeft: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
    position: 'absolute', top: 0, bottom: 0, right: 0, zIndex: 40,
    boxShadow: '-2px 0 12px rgba(0,0,0,0.5)',
  },
  rpHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '10px 12px', borderBottom: `1px solid ${T.border}`,
  },
  wsBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    border: `1px solid ${T.border}`, borderRadius: 999, padding: '3px 8px',
    letterSpacing: 0.6,
  },
  panelTitle: { fontSize: 12, fontWeight: 700, color: T.textWhite, letterSpacing: 0.2 },
  moreBtn: {
    background: 'none', border: 'none', color: T.textMuted,
    cursor: 'pointer', fontSize: 14, letterSpacing: 2, display: 'flex', alignItems: 'center'
  },

  filterGroup: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  filterChip: { borderRadius: 4, border: `1px solid ${T.border}`, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.fontFamily },
  searchInput: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 300, background: T.bgCard, border: `1px solid ${T.border}`, color: T.textPrimary, borderRadius: 6, padding: '6px 12px', fontSize: 11, fontFamily: T.fontFamily, boxSizing: 'border-box' },
  
  mapPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted },
  heatOverlay: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 20%, rgba(168,85,247,0.25), transparent 45%), radial-gradient(circle at 70% 50%, rgba(245,158,11,0.22), transparent 50%), radial-gradient(circle at 50% 80%, rgba(20,184,166,0.25), transparent 55%)', pointerEvents: 'none' },
  
  panelSection: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  panelTitleRow: { display: 'flex', alignItems: 'center', gap: 8, color: T.textWhite, fontWeight: 700, fontSize: 11 },
  panelMeta: { fontSize: 10, color: T.textMuted },
  linkBtn: { background: 'none', border: 'none', color: T.heatTeal, fontSize: 10, cursor: 'pointer' },

  fleetGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  fleetTile: { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  fleetLabel: { fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  fleetValue: { fontSize: 14, fontWeight: 700, color: T.textWhite },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  kpiTile: { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  kpiLabel: { fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 14, fontWeight: 700, color: T.textWhite },

  driverCard: { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 },
  driverName: { fontSize: 12, fontWeight: 700, color: T.textWhite },
  driverMeta: { fontSize: 10, color: T.textSecondary },
  driverActions: { display: 'flex', gap: 8, marginTop: 6 },
  driverActionBtn: { flex: 1, borderRadius: 6, border: `1px solid ${T.border}`, background: T.bgCard, color: T.textWhite, fontSize: 10, padding: '6px 8px', cursor: 'pointer' },
  
  queueList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' },
  queueCard: { borderRadius: 6, border: `1px solid ${T.border}`, padding: 10, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, color: T.textWhite, fontFamily: T.fontFamily },
  queueTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 },
  queueRef: { color: T.textWhite },
  queueStatus: { fontSize: 9, textTransform: 'uppercase', color: T.textMuted, fontWeight: 700 },
  queueRoute: { fontSize: 10, color: T.textSecondary },
  queueMeta: { fontSize: 9, color: T.textMuted },
  
  emptyCard: { padding: 14, fontSize: 11, color: T.textMuted, border: `1px dashed ${T.border}`, borderRadius: 6, textAlign: 'center' },
  
  incidentCard: { borderRadius: 6, border: `1px solid rgba(245,158,11,0.35)`, padding: 10, background: 'rgba(245,158,11,0.08)' },
  incidentTitle: { fontSize: 11, fontWeight: 700, color: T.textWhite },
  incidentMeta: { fontSize: 10, color: T.textSecondary, marginTop: 2 },
  
  signalCard: { borderRadius: 6, border: `1px solid ${T.border}`, padding: 10, background: T.bgInput, display: 'flex', flexDirection: 'column', gap: 4, color: T.textSecondary },
  signalRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: T.textWhite },
  signalMeta: { fontSize: 10, color: T.textMuted, marginLeft: 20 },
  
  infoWindow: { minWidth: 160, fontFamily: 'inherit' },
  infoTitle: { fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#111827' },
  infoText: { fontSize: 10, color: '#4b5563' },
  infoMeta: { fontSize: 9, color: '#6b7280', marginTop: 4 },
}

export default function DispatchPage() {
  const { activeTab: dispatchTab } = useDispatchStore()
  
  if (dispatchTab === 'route_ops') {
    return <RouteOpsPanel />
  }
  
  return <LiveFleetPanel />
}

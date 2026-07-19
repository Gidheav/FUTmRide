import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../core/authStore'
import { useStudentProfileStore } from '../../core/studentProfileStore'
import { getCampusCenter } from '../../core/campus'
import api from '../../core/api'

const DEFAULT_REGION_BASE: Region = {
  latitude: 9.5261,
  longitude: 6.4514,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
}

const roundCoord = (value: number) => Number(value.toFixed(6))

type MapPickerPageProps = {
  onClose: () => void
  onConfirm: (selection: RouteSelection) => void
  initialCoords?: { latitude: number; longitude: number } | null
  pickupCoords?: { latitude: number; longitude: number } | null
  vehicleType?: string
}

export type RouteOption = {
  index: number
  distance_km: number
  duration_minutes: number | null
  geometry: Array<{ latitude: number; longitude: number }>
  provider: string
  confidence: string
  metadata?: Record<string, unknown> & { route_index?: number }
}

export type RouteSelection = {
  dropoff: { latitude: number; longitude: number }
  route: RouteOption
}

export default function MapPickerPage({ onClose, onConfirm, initialCoords, pickupCoords, vehicleType = 'sedan' }: MapPickerPageProps) {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView | null>(null)
  const requestIdRef = useRef(0)
  const userId = useAuthStore((state) => state.user?.id || null)
  const authCampus = useAuthStore((state) => state.user?.campus)
  const cachedProfileEntry = useStudentProfileStore((state) => userId ? state.profilesByUserId[userId] : null)
  const campusValue =
    cachedProfileEntry?.studentProfile?.campus?.name ??
    cachedProfileEntry?.studentProfile?.campus?.id ??
    authCampus?.name ??
    authCampus?.id
  const initialRegion = useMemo<Region>(() => {
    const center = initialCoords ?? getCampusCenter(campusValue)
    return {
      ...DEFAULT_REGION_BASE,
      latitude: center.latitude,
      longitude: center.longitude,
    }
  }, [campusValue, initialCoords])
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    initialCoords || null
  )
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')

  const selectedRoute = routes.find((route) => route.index === selectedRouteIndex) ?? routes[0] ?? null

  const fetchRoutes = useCallback(async (dropoff: { latitude: number; longitude: number }) => {
    if (!pickupCoords) {
      setRoutes([])
      setRouteError('Select pickup first.')
      return
    }
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setRouteLoading(true)
    setRouteError('')
    setRoutes([])
    try {
      const response = await api.post('rides/route-options/', {
        pickup_latitude: pickupCoords.latitude,
        pickup_longitude: pickupCoords.longitude,
        dropoff_latitude: dropoff.latitude,
        dropoff_longitude: dropoff.longitude,
        vehicle_type: vehicleType,
      })
      if (requestId !== requestIdRef.current) return
      const nextRoutes: RouteOption[] = Array.isArray(response?.data?.routes) ? response.data.routes : []
      if (!nextRoutes.length) {
        setRouteError('No valid route found for this location.')
        return
      }
      setRoutes(nextRoutes)
      setSelectedRouteIndex(nextRoutes[0].index)
      const coords = nextRoutes[0].geometry
      if (coords.length >= 2) {
        requestAnimationFrame(() => {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 90, right: 50, bottom: 220, left: 50 },
            animated: true,
          })
        })
      }
    } catch (error: any) {
      if (requestId === requestIdRef.current) {
        setRouteError(error?.response?.data?.error?.message || 'No valid route found for this location.')
      }
    } finally {
      if (requestId === requestIdRef.current) setRouteLoading(false)
    }
  }, [pickupCoords, vehicleType])

  const handleMapPress = useCallback((event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate
    const nextPin = {
      latitude: roundCoord(latitude),
      longitude: roundCoord(longitude),
    }
    setPin(nextPin)
    void fetchRoutes(nextPin)
  }, [fetchRoutes])

  useEffect(() => {
    if (pin && pickupCoords) void fetchRoutes(pin)
  }, [fetchRoutes, pickupCoords, pin])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pin Dropoff Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
        >
          {pickupCoords && <Marker coordinate={pickupCoords} title="Pickup" pinColor="#6A1B9A" />}
          {pin && (
            <Marker
              coordinate={pin}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate
                const nextPin = {
                  latitude: Number(latitude.toFixed(6)),
                  longitude: Number(longitude.toFixed(6)),
                }
                setPin(nextPin)
                void fetchRoutes(nextPin)
              }}
            />
          )}
          {selectedRoute && (
            <Polyline
              key={`${selectedRoute.provider}-${selectedRoute.index}`}
              coordinates={selectedRoute.geometry}
              strokeColor="#6A1B9A"
              strokeWidth={5}
            />
          )}
        </MapView>
      </View>

      <View style={styles.footer}>
        {routeLoading ? (
          <View style={styles.routeStatusRow}>
            <ActivityIndicator color="#6A1B9A" />
            <Text style={styles.hintText}>Finding valid routes...</Text>
          </View>
        ) : routeError ? (
          <Text style={styles.errorText}>{routeError}</Text>
        ) : selectedRoute ? (
          <View style={styles.routeOptions}>
            {routes.map((route, idx) => (
              <TouchableOpacity
                key={`${route.provider}-${route.index}`}
                style={[styles.routeOption, route.index === selectedRouteIndex && styles.routeOptionActive]}
                onPress={() => setSelectedRouteIndex(route.index)}
                activeOpacity={0.85}
              >
                <Text style={[styles.routeOptionTitle, route.index === selectedRouteIndex && styles.routeOptionTitleActive]}>
                  {idx === 0 ? 'Recommended' : `Route ${idx + 1}`}
                </Text>
                <Text style={styles.routeOptionMeta}>
                  {route.distance_km.toFixed(2)} km
                </Text>
                <Text style={styles.routeOptionProvider}>
                  {route.provider.replace('_', ' ')} / {route.confidence}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : pin ? (
          <Text style={styles.coordText}>
            {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
          </Text>
        ) : (
          <Text style={styles.hintText}>Tap on the map to place a pin</Text>
        )}
        <TouchableOpacity
          style={[styles.confirmButton, (!pin || !selectedRoute || routeLoading) && styles.confirmButtonDisabled]}
          onPress={() => pin && selectedRoute && onConfirm({ dropoff: pin, route: selectedRoute })}
          disabled={!pin || !selectedRoute || routeLoading}
          activeOpacity={0.8}
        >
          <MaterialIcons name="check" size={18} color="#ffffff" />
          <Text style={styles.confirmText}>Confirm Route</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  headerSpacer: {
    width: 36,
  },
  mapWrapper: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  routeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  routeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  routeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#ffffff',
  },
  routeOptionActive: {
    borderColor: '#6A1B9A',
    backgroundColor: '#f5effb',
  },
  routeOptionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  routeOptionTitleActive: {
    color: '#6A1B9A',
  },
  routeOptionMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  routeOptionProvider: {
    fontSize: 10,
    color: '#8b8b8b',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  coordText: {
    fontSize: 13,
    color: '#6A1B9A',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#ba1a1a',
    fontWeight: '600',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 13,
    color: '#8b8b8b',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#b79cd5',
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
})

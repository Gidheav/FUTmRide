import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
  ActivityIndicator,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as LocationService from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { getVerifiedLocation, LocationError, roundCoord } from '../../../core/locationService'
import api, { classifyApiError } from '../../../core/api'
import { useLocations } from '../../../../services/locationDataService'
import { useToastStore } from '../../../core/toastStore'
import ActiveRidePage from '../../pages/ActiveRidePage'
import RideMatchingPage from '../../pages/RideMatchingPage'
import BookRidePage from '../../pages/BookRidePage'

const DEFAULT_RADIUS_KM = 1
const SCAN_INTERVAL_MS = 5000
const SCAN_DURATION_MS = 5 * 60 * 1000
const FOREGROUND_LOCATION_TASK = 'FOREGROUND_LOCATION_TASK'

try {
  TaskManager.defineTask(FOREGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) return
    // This empty task keeps the foreground notification alive
  })
} catch (err) {
  // Task might already be defined during hot reload
}

const RADIUS_OPTIONS = [0.1, 0.5, 1, 2, 5]
// Used for distance formatting
type Location = {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
  category: string
}

type LocationOption = {
  id: string
  label: string
  description: string
  latitude: number
  longitude: number
}

type AvailableDriver = {
  id: string
  full_name: string
  profile_photo: string | null
  vehicle_type: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  plate_number: string | null
  average_rating: string | null
  distance_km: number
  location_updated_at: string
}

type ScanParams = {
  latitude: number
  longitude: number
  label: string
  radius_km: number
}

const formatRemaining = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function FindNearbyTab() {
  const [showActiveRide, setShowActiveRide] = useState(false)
  const [showMatching, setShowMatching] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [rideId, setRideId] = useState<string | null>(null)

  const showToast = useToastStore((s) => s.showToast)

  const [radiusKm, setRadiusKm] = useState(0.1) // Start at 100m
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanActive, setScanActive] = useState(false)
  const [scanExpired, setScanExpired] = useState(false)
  const [scanParams, setScanParams] = useState<ScanParams | null>(null)
  const [scanRemainingMs, setScanRemainingMs] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const [drivers, setDrivers] = useState<AvailableDriver[]>([])

  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopScan = useCallback(async () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    scanIntervalRef.current = null
    scanTimeoutRef.current = null
    countdownRef.current = null
    setScanActive(false)
    setScanRemainingMs(0)
    setScanExpired(true)
    
    try {
      const hasTask = await TaskManager.isTaskRegisteredAsync(FOREGROUND_LOCATION_TASK)
      if (hasTask) {
        await LocationService.stopLocationUpdatesAsync(FOREGROUND_LOCATION_TASK)
      }
    } catch (err) {}
  }, [])

  const fetchAvailable = useCallback(async (params: ScanParams) => {
    try {
      const response = await api.get('rides/available/', {
        params: {
          latitude: params.latitude,
          longitude: params.longitude,
          radius_km: params.radius_km,
          max_age_seconds: 300,
        },
      })
      const list = Array.isArray(response.data?.results) ? response.data.results : []
      setDrivers(list)
      setLastUpdatedAt(new Date())
      setScanError(null)
    } catch (err: any) {
      const kind = classifyApiError(err)
      if (kind === 'network') {
        setScanError('No internet connection. Please check your network.')
      } else if (kind === 'session_expired') {
        setScanError('Your session has expired. Please log in again.')
      } else {
        const message = err?.response?.data?.error?.message || 'Unable to fetch available rides.'
        setScanError(String(message))
      }
    }
  }, [])

  const resolveCurrentLocation = async () => {
    try {
      const coords = await getVerifiedLocation()
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        label: 'Current location',
      }
    } catch (err: any) {
      const msg = err instanceof LocationError ? err.message : 'Unable to fetch your location.'
      showToast(msg, 'error')
      throw new Error(msg)
    }
  }

  const startScan = useCallback(async () => {
    setScanLoading(true)
    setScanError(null)
    setScanExpired(false)

    try {
      const location = await resolveCurrentLocation()

      const params: ScanParams = {
        latitude: location.latitude,
        longitude: location.longitude,
        label: location.label,
        radius_km: radiusKm,
      }
      setScanParams(params)
      setScanActive(true)
      setScanRemainingMs(SCAN_DURATION_MS)

      await fetchAvailable(params)

      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = setInterval(() => {
        fetchAvailable(params)
      }, SCAN_INTERVAL_MS)

      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = setTimeout(() => {
        stopScan()
      }, SCAN_DURATION_MS)

      if (countdownRef.current) clearInterval(countdownRef.current)
      const startAt = Date.now()
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - startAt
        const remaining = SCAN_DURATION_MS - elapsed
        setScanRemainingMs(Math.max(0, remaining))
      }, 1000)

      try {
        await LocationService.startLocationUpdatesAsync(FOREGROUND_LOCATION_TASK, {
          accuracy: LocationService.Accuracy.Balanced,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Scanning for Rides',
            notificationBody: `Looking for available drivers within ${radiusKm}km...`,
            notificationColor: '#6A1B9A',
          },
        })
      } catch (e) {
        // Fallback gracefully if background location is blocked by system OS
      }
    } catch (err: any) {
      const msg = String(err?.message || 'Unable to start scan.')
      showToast(msg, 'error')
      setScanActive(false)
    } finally {
      setScanLoading(false)
    }
  }, [fetchAvailable, radiusKm, stopScan])

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const handleRescan = () => {
    if (scanActive) stopScan()
    void startScan()
  }



  const handleRadiusToggle = () => {
    const currentIndex = RADIUS_OPTIONS.indexOf(radiusKm)
    const nextIndex = (currentIndex + 1) % RADIUS_OPTIONS.length
    setRadiusKm(RADIUS_OPTIONS[nextIndex])
  }

  const timeLeftLabel = scanActive ? formatRemaining(scanRemainingMs) : null

  if (showBooking) {
    return (
      <BookRidePage
        onClose={() => setShowBooking(false)}
        onRideCreated={(id) => {
          setRideId(id)
          setShowBooking(false)
          setShowMatching(true)
        }}
      />
    )
  }

  if (showActiveRide) {
    return <ActiveRidePage onBack={() => setShowActiveRide(false)} rideId={rideId} />
  }

  if (showMatching) {
    return (
      <RideMatchingPage
        rideId={rideId}
        onBack={() => setShowMatching(false)}
        onMatched={() => {
          setShowMatching(false)
          setShowActiveRide(true)
        }}
        onCancelled={() => {
          setShowMatching(false)
          setRideId(null)
        }}
      />
    )
  }



  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.mainCard}>
        <View style={styles.filterTopRow}>
          <TouchableOpacity style={styles.filterLocationBtn} onPress={handleRadiusToggle} activeOpacity={0.7}>
            <MaterialIcons name="gps-fixed" size={18} color="#6A1B9A" />
            <Text style={styles.filterLocationText} numberOfLines={1}>
              Within {radiusKm < 1 ? `${radiusKm * 1000}m` : `${radiusKm}km`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterScanBtn, scanActive && { backgroundColor: '#b91c1c' }]} 
            onPress={scanActive ? stopScan : handleRescan} 
            disabled={scanLoading} 
            activeOpacity={0.85}
          >
            {scanLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : scanActive ? (
              <MaterialIcons name="stop" size={18} color="#ffffff" />
            ) : (
              <MaterialIcons name="radar" size={18} color="#ffffff" />
            )}
            <Text style={styles.filterScanBtnText}>{scanActive ? 'Stop' : 'Scan'}</Text>
          </TouchableOpacity>
        </View>

        {(scanActive || scanExpired || lastUpdatedAt || drivers.length > 0) && (
          <View style={styles.filterMetaRow}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {scanActive && timeLeftLabel ? (
                <Text style={styles.filterMetaText}>Active for {timeLeftLabel}</Text>
              ) : scanExpired ? (
                <Text style={styles.filterMetaText}>Scan expired</Text>
              ) : <Text style={styles.filterMetaText} />}
              
              {lastUpdatedAt && (
                <Text style={styles.filterMetaText}>Updated {lastUpdatedAt.toLocaleTimeString()}</Text>
              )}
            </View>
            <View style={styles.nearbyBadge}>
              <Text style={styles.nearbyBadgeText}>{drivers.length} Nearby</Text>
            </View>
          </View>
        )}
        {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}

        <View style={styles.sectionDivider} />

        <View style={styles.list}>
          {drivers.length === 0 ? (
            <View style={styles.emptyCard}>
              {scanLoading || scanActive ? (
                <>
                  <MaterialIcons name="radar" size={32} color="#6A1B9A" />
                  <Text style={styles.emptyTitle}>Scanning nearby area...</Text>
                  <Text style={styles.emptyText}>Looking for available rides within {radiusKm < 1 ? `${radiusKm * 1000}m` : `${radiusKm}km`}.</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="directions-car" size={28} color="#6A1B9A" />
                  <Text style={styles.emptyTitle}>No drivers found</Text>
                  <Text style={styles.emptyText}>Tap scan to find available rides near you.</Text>
                </>
              )}
            </View>
          ) : (
          drivers.map((driver) => {
            const carLabel = [driver.vehicle_color, driver.vehicle_make, driver.vehicle_model]
              .filter(Boolean)
              .join(' ')
            const distanceLabel = `${driver.distance_km.toFixed(1)} km away`
            return (
              <View key={driver.id} style={styles.rideCard}>
                <View style={styles.rideTop}>
                  <View style={styles.driverRow}>
                    <View style={styles.avatarWrap}>
                      <View style={styles.avatarFallback}>
                        <MaterialIcons name="person" size={22} color="#6A1B9A" />
                      </View>
                    </View>
                    <View>
                      <Text style={styles.driverName}>{driver.full_name}</Text>
                      <View style={styles.ratingRow}>
                        <MaterialIcons name="star" size={14} color="#6A1B9A" />
                        <Text style={styles.ratingText}>{driver.average_rating || 'New'}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.priceWrap}>
                    <View style={styles.etaBadge}>
                      <Text style={styles.etaText}>{distanceLabel}</Text>
                    </View>
                  </View>
                </View>

                  <View style={styles.dividerInner} />

                <View style={styles.rideBottom}>
                  <View>
                    <Text style={styles.carType}>{driver.vehicle_type || 'Vehicle'}</Text>
                    <View style={styles.carRow}>
                      <MaterialIcons name="directions-car" size={16} color="#5e5e5e" />
                      <Text style={styles.carText}>{carLabel || 'Vehicle details pending'}</Text>
                    </View>
                    <Text style={styles.plateText}>{driver.plate_number || 'Plate pending'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.requestButton}
                    activeOpacity={0.85}
                    onPress={() => setShowBooking(true)}
                  >
                    <Text style={styles.requestText}>Request</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}
      </View>
    </View>

    </ScrollView>

    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  pageContent: {
    padding: 2,
    paddingBottom: 24,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  mainCard: {
    backgroundColor: '#fffefeff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    marginBottom: 20,
  },
  filterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterLocationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterLocationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  filterScanBtn: {
    backgroundColor: '#6A1B9A',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterScanBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  filterBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  filterRadiusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterRadiusOptions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterRadiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  filterRadiusChipActive: {
    backgroundColor: 'rgba(106,27,154,0.08)',
  },
  filterRadiusChipText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  filterRadiusChipTextActive: {
    fontSize: 13,
    color: '#6A1B9A',
    fontWeight: '700',
  },
  filterMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  filterMetaText: {
    fontSize: 12,
    color: '#8b8b8b',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 12,
    color: '#b91c1c',
    fontWeight: '500',
    fontSize: 13,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
  },
  nearbyBadge: {
    backgroundColor: 'rgba(106,27,154,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(106,27,154,0.18)',
  },
  nearbyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  list: {
    gap: 16,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 8,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  rideCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  rideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#eeeeee',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#5e5e5e',
    fontWeight: '600',
  },
  priceWrap: {
    alignItems: 'flex-end',
    gap: 6,
  },
  etaBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(106,27,154,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  etaText: {
    fontSize: 12,
    color: '#6A1B9A',
    fontWeight: '600',
  },
  dividerInner: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  rideBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  carType: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  carRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carText: {
    fontSize: 13,
    color: '#1a1c1c',
  },
  plateText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  requestButton: {
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
  },
  requestText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
})

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
  Alert,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as LocationService from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { getVerifiedLocation, LocationError, roundCoord } from '../../../core/locationService'
import api, { classifyApiError } from '../../../core/api'
import { useLocations } from '../../../../services/locationDataService'
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

  const [locationSource, setLocationSource] = useState<'gps' | 'manual'>('gps')
  const [manualLocation, setManualLocation] = useState<LocationOption | null>(null)
  const [query, setQuery] = useState('')
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)

  // OTA location data — refreshes after silent background download
  const rawLocations = useLocations()
  const ALL_LOCATIONS = useMemo<LocationOption[]>(
    () => (rawLocations as Location[]).map((loc) => ({
      id: loc.id,
      label: loc.name,
      description: loc.description,
      latitude: roundCoord(loc.latitude),
      longitude: roundCoord(loc.longitude),
    })),
    [rawLocations],
  )

  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM)
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

  const filteredLocations = useMemo(() => {
    if (!locationPickerOpen) return [] // Prevent mapping items when closed
    const normalized = query.trim().toLowerCase()
    if (!normalized) return ALL_LOCATIONS
    return ALL_LOCATIONS.filter((item) => {
      const haystack = `${item.label} ${item.description}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [query, locationPickerOpen, ALL_LOCATIONS])

  useEffect(() => {
    const handleBack = () => {
      if (locationPickerOpen) {
        setLocationPickerOpen(false)
        return true
      }
      return false
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack)
    return () => sub.remove()
  }, [locationPickerOpen])

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
      if (err instanceof LocationError) {
        throw new Error(err.message)
      }
      throw new Error('Unable to fetch your location.')
    }
  }

  const startScan = useCallback(async () => {
    setScanLoading(true)
    setScanError(null)
    setScanExpired(false)

    try {
      let location: { latitude: number; longitude: number; label: string }
      if (locationSource === 'manual') {
        if (!manualLocation) {
          throw new Error('Select a location before scanning.')
        }
        location = {
          latitude: manualLocation.latitude,
          longitude: manualLocation.longitude,
          label: manualLocation.label,
        }
      } else {
        location = await resolveCurrentLocation()
      }

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
      setScanError(String(err?.message || 'Unable to start scan.'))
      setScanActive(false)
    } finally {
      setScanLoading(false)
    }
  }, [fetchAvailable, locationSource, manualLocation, radiusKm, stopScan])

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

  const handleSelectLocation = (item: LocationOption) => {
    setManualLocation(item)
    setQuery('')
    setLocationPickerOpen(false)
  }

  const handleLocationPress = () => {
    Alert.alert(
      'Location Source',
      'Where should we search for rides?',
      [
        { text: 'Current GPS Location', onPress: () => setLocationSource('gps') },
        { text: 'Search Manually', onPress: () => {
            setLocationSource('manual')
            setLocationPickerOpen(true)
        }},
        { text: 'Cancel', style: 'cancel' }
      ]
    )
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

  const renderLocationItem = useCallback(({ item }: { item: LocationOption }) => (
    <TouchableOpacity
      style={styles.modalItem}
      onPress={() => handleSelectLocation(item)}
    >
      <MaterialIcons name="place" size={18} color="#6A1B9A" />
      <View style={{ flex: 1 }}>
        <Text style={styles.modalItemTitle}>{item.label}</Text>
        <Text style={styles.modalItemSubtitle}>{item.description}</Text>
      </View>
    </TouchableOpacity>
  ), [])

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.mainCard}>
        <View style={styles.filterTopRow}>
          <TouchableOpacity style={styles.filterLocationBtn} onPress={handleLocationPress} activeOpacity={0.7}>
            <MaterialIcons name={locationSource === 'gps' ? 'my-location' : 'map'} size={18} color="#6A1B9A" />
            <Text style={styles.filterLocationText} numberOfLines={1}>
              {locationSource === 'gps' ? 'Current location' : (manualLocation?.label || 'Select location')}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={20} color="#8b8b8b" />
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

        <View style={styles.filterBottomRow}>
          <Text style={styles.filterRadiusLabel}>Within:</Text>
          <View style={styles.filterRadiusOptions}>
            {RADIUS_OPTIONS.map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.filterRadiusChip, radiusKm === value && styles.filterRadiusChipActive]}
                onPress={() => setRadiusKm(value)}
              >
                <Text style={radiusKm === value ? styles.filterRadiusChipTextActive : styles.filterRadiusChipText}>
                  {value < 1 ? `${value * 1000}m` : `${value}km`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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

      {locationPickerOpen && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff', zIndex: 999, elevation: 999 }]}>
          <View style={styles.modalPage}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setLocationPickerOpen(false)} style={styles.modalBack}>
                <MaterialIcons name="close" size={20} color="#1a1c1c" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select location</Text>
              <View style={styles.modalSpacer} />
            </View>

            <View style={styles.modalSearch}>
              <MaterialIcons name="search" size={18} color="#6b7280" />
              <TextInput
                style={styles.modalInput}
                placeholder="Search locations"
                value={query}
                onChangeText={setQuery}
              />
            </View>

            <FlatList
              data={filteredLocations}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={3}
              keyboardShouldPersistTaps="handled"
              renderItem={renderLocationItem}
              removeClippedSubviews={true}
              getItemLayout={(_, index) => ({
                length: 64,
                offset: 64 * index,
                index,
              })}
            />
          </View>
        </View>
      )}
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
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  modalPage: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalBack: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    color: '#1a1c1c',
  },
  modalSpacer: {
    width: 32,
  },
  modalSearch: {
    margin: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInput: {
    flex: 1,
    fontSize: 14,
  },
  modalList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalItemTitle: {
    fontWeight: '600',
    color: '#1a1c1c',
  },
  modalItemSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
})

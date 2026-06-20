import { useMemo, useState, useCallback, useEffect, memo } from 'react'
import {
  Alert,
  Platform,
  ScrollView,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as LocationService from 'expo-location'
import api from '../../core/api'
import useWalletStore from '../../core/walletStore'
import locationData from '../Gk-location cordinate.json'
import MapPickerPage from './MapPickerPage'

const VEHICLES = [
  { id: 'motorbike', label: 'Motorbike (Okada)' },
  { id: 'tricycle', label: 'Tricycle (Keke)' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'mpv', label: 'MPV' },
  { id: 'minibus', label: 'Minibus / Shuttle' },
  { id: 'coach', label: 'Coach' },
]

const SCHEDULE_OPTIONS = [0, 5, 10, 15, 20, 25, 30]

const roundCoord = (value: number) => Number(value.toFixed(6))

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

type BookRidePageProps = {
  onClose: () => void
  onRideCreated: (rideId: string) => void
}

const ALL_LOCATIONS: LocationOption[] = (locationData as Location[]).map((loc) => ({
  id: loc.id,
  label: loc.name,
  description: loc.description,
  latitude: roundCoord(loc.latitude),
  longitude: roundCoord(loc.longitude),
}))

const filterLocations = (query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return ALL_LOCATIONS
  return ALL_LOCATIONS.filter((item) => {
    const haystack = `${item.label} ${item.description}`.toLowerCase()
    return haystack.includes(normalized)
  })
}

const getSeatLimit = (vehicleId: string) => {
  if (vehicleId === 'motorbike') return 2
  if (vehicleId === 'tricycle') return 4
  if (vehicleId === 'mpv') return 7
  if (vehicleId === 'minibus') return 18
  if (vehicleId === 'coach') return 50
  return 6
}

// Memoized list item to prevent re-renders
const LocationItem = memo(({ item, onPress }: { item: LocationOption; onPress: () => void }) => (
  <TouchableOpacity style={styles.modalItem} onPress={onPress}>
    <View style={styles.modalItemIcon}>
      <MaterialIcons name="place" size={18} color="#6A1B9A" />
    </View>
    <View style={styles.modalItemContent}>
      <Text style={styles.modalItemTitle}>{item.label}</Text>
      <Text style={styles.modalItemSub}>{item.description}</Text>
    </View>
  </TouchableOpacity>
))

export default function BookRidePage({ onClose, onRideCreated }: BookRidePageProps) {
  const insets = useSafeAreaInsets()
  const [activePicker, setActivePicker] = useState<'pickup' | 'dropoff' | 'vehicle' | 'time' | 'seats' | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)

  const openPicker = useCallback((type: 'pickup' | 'dropoff' | 'vehicle' | 'time' | 'seats') => {
    setActivePicker(type)
  }, [])

  const closePicker = useCallback(() => {
    setActivePicker(null)
  }, [])

  useEffect(() => {
    const handleBack = () => {
      if (showMapPicker) {
        setShowMapPicker(false)
        return true
      }
      if (activePicker) {
        setActivePicker(null)
        return true
      }
      onClose()
      return true
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack)
    return () => subscription.remove()
  }, [showMapPicker, activePicker, onClose])

  const [query, setQuery] = useState('')
  const [pickup, setPickup] = useState<LocationOption | null>(null)
  const [dropoff, setDropoff] = useState<LocationOption | null>(null)
  const [vehicleType, setVehicleType] = useState('sedan')
  const [seatCount, setSeatCount] = useState(1)
  const [scheduledOffset, setScheduledOffset] = useState(0)
  const [mapDropoff, setMapDropoff] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const seatLimit = useMemo(() => getSeatLimit(vehicleType), [vehicleType])
  // Only compute filtered locations when a location picker is actually open
  const filteredLocations = useMemo(() => {
    if (activePicker !== 'pickup' && activePicker !== 'dropoff') return ALL_LOCATIONS
    return filterLocations(query)
  }, [query, activePicker])

  const handleUseCurrentLocation = async () => {
    const status = await LocationService.getForegroundPermissionsAsync()
    if (!status.granted) {
      const request = await LocationService.requestForegroundPermissionsAsync()
      if (!request.granted) {
        Alert.alert('Location denied', 'Enable location permission to use current location.')
        return
      }
    }
    const current = await LocationService.getCurrentPositionAsync({
      accuracy: LocationService.Accuracy.Highest,
    })
    setPickup({
      id: 'current-location',
      label: 'Current location',
      description: 'Using your current location',
      latitude: roundCoord(current.coords.latitude),
      longitude: roundCoord(current.coords.longitude),
    })
    closePicker()
  }

  const handleSelectLocation = useCallback((item: LocationOption) => {
    if (activePicker === 'pickup') {
      setPickup(item)
    }
    if (activePicker === 'dropoff') {
      setDropoff(item)
      setMapDropoff(null)
    }
    setActivePicker(null)
  }, [activePicker])

  const handleMapSelect = useCallback((coords: { latitude: number; longitude: number }) => {
    const rounded = {
      latitude: roundCoord(coords.latitude),
      longitude: roundCoord(coords.longitude),
    }
    setMapDropoff(rounded)
    setDropoff({
      id: 'map-pin',
      label: 'Pinned location',
      description: 'Selected from map',
      latitude: rounded.latitude,
      longitude: rounded.longitude,
    })
  }, [])

  const handleSubmit = async () => {
    if (!pickup) {
      Alert.alert('Missing pickup', 'Select a pickup location.')
      return
    }
    if (!dropoff) {
      Alert.alert('Missing dropoff', 'Select a dropoff location.')
      return
    }
    if (seatCount > seatLimit) {
      Alert.alert('Seat limit', `This vehicle allows up to ${seatLimit} seats.`)
      return
    }

    const scheduledTime = new Date(Date.now() + scheduledOffset * 60000).toISOString()

    const payload = {
      pickup_address: pickup.label,
      pickup_latitude: pickup.latitude,
      pickup_longitude: pickup.longitude,
      dropoff_address: dropoff.label,
      dropoff_latitude: dropoff.latitude,
      dropoff_longitude: dropoff.longitude,
      vehicle_type_requested: vehicleType,
      requested_seats: seatCount,
      scheduled_pickup_time: scheduledTime,
      payment_method: 'wallet',
    }

    setIsSubmitting(true)
    try {
      const response = await api.post('rides/request/', payload)
      const rideId = response?.data?.id
      if (!rideId) {
        Alert.alert('Booking failed', 'Ride was created without an id.')
        return
      }
      // Sync wallet balance to reflect the ride payment
      useWalletStore.getState().syncBalance()
      // Hand off to parent — no internal state machine needed
      onRideCreated(String(rideId))
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Unable to request a ride.'
      Alert.alert('Booking failed', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderLocationItem = useCallback(({ item }: { item: LocationOption }) => (
    <LocationItem item={item} onPress={() => handleSelectLocation(item)} />
  ), [handleSelectLocation])

  const keyExtractor = useCallback((item: LocationOption) => item.id, [])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book a Ride</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>

          <View style={styles.routeContainer}>
            <View style={styles.routeTimeline}>
              <View style={styles.timelineDotPickup} />
              <View style={styles.timelineLine} />
              <View style={styles.timelineDotDropoff} />
            </View>

            <View style={styles.routeInputs}>
              <View style={styles.routeInputGroup}>
                <Text style={styles.routeInputLabel}>Pickup Location</Text>
                <View style={styles.pickupInputRow}>
                  <TouchableOpacity style={[styles.inputButton, { flex: 1 }]} onPress={() => openPicker('pickup')}>
                    <Text style={pickup ? styles.inputValue : styles.inputPlaceholder} numberOfLines={1}>
                      {pickup ? pickup.label : 'Search campus location'}
                    </Text>
                    <MaterialIcons name="keyboard-arrow-down" size={18} color="#8b8b8b" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currentLocationBtn,
                      pickup?.id === 'current-location' && styles.currentLocationBtnActive
                    ]}
                    onPress={handleUseCurrentLocation}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name="my-location"
                      size={20}
                      color={pickup?.id === 'current-location' ? "#6A1B9A" : "#8b8b8b"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.routeInputGroup, { marginTop: 16 }]}>
                <Text style={styles.routeInputLabel}>Dropoff Location</Text>
                <TouchableOpacity style={styles.inputButton} onPress={() => openPicker('dropoff')}>
                  <Text style={dropoff ? styles.inputValue : styles.inputPlaceholder} numberOfLines={1}>
                    {dropoff ? dropoff.label : 'Search campus location'}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#8b8b8b" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.mapButtonContainer}>
            <TouchableOpacity 
              style={styles.mapButton} 
              activeOpacity={0.8}
              onPress={() => setShowMapPicker(true)}
            >
              <MaterialIcons name="map" size={18} color="#6A1B9A" />
              <Text style={styles.mapButtonText}>Choose Dropoff on Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle, Seats & Time</Text>
          <View style={styles.vehicleSeatContainer}>
            <View style={styles.configColVehicle}>
              <Text style={styles.dropdownLabel}>Vehicle</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => openPicker('vehicle')}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownButtonText} numberOfLines={1}>
                  {VEHICLES.find(v => v.id === vehicleType)?.label}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={16} color="#8b8b8b" />
              </TouchableOpacity>
            </View>

            <View style={styles.configColSeats}>
              <Text style={styles.dropdownLabel}>Seats</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                activeOpacity={0.8}
                onPress={() => openPicker('seats')}
              >
                <Text style={styles.dropdownButtonText} numberOfLines={1}>
                  {seatCount}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={16} color="#8b8b8b" />
              </TouchableOpacity>
            </View>

            <View style={styles.configColTime}>
              <Text style={styles.dropdownLabel}>Time</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => openPicker('time')}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownButtonText} numberOfLines={1}>
                  {scheduledOffset === 0 ? 'Now' : `+${scheduledOffset}m`}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={16} color="#8b8b8b" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>
          <View style={styles.paymentRow}>
            <MaterialIcons name="account-balance-wallet" size={20} color="#6A1B9A" />
            <Text style={styles.paymentText}>Wallet only for now</Text>
          </View>
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>{isSubmitting ? 'Booking...' : 'Request Ride'}</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {!!activePicker && (
        <View style={styles.absoluteModalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {activePicker === 'vehicle'
                ? 'Select Vehicle Type'
                : activePicker === 'time'
                  ? 'Select Pickup Time'
                  : activePicker === 'seats'
                    ? 'Select Seats'
                    : `Select ${activePicker === 'pickup' ? 'pickup' : 'dropoff'}`}
            </Text>
            {(activePicker === 'pickup' || activePicker === 'dropoff') && (
              <View style={styles.modalSearchRow}>
                <MaterialIcons name="search" size={18} color="#9c9c9c" />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search locations"
                  placeholderTextColor="#9c9c9c"
                  value={query}
                  onChangeText={setQuery}
                />
              </View>
            )}
            {activePicker === 'vehicle' ? (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {VEHICLES.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.modalItem} onPress={() => {
                    setVehicleType(item.id)
                    setSeatCount((prev) => Math.min(prev, getSeatLimit(item.id)))
                    closePicker()
                  }}>
                    <View style={styles.modalItemIcon}>
                      <MaterialIcons name={item.id === 'motorbike' ? 'two-wheeler' : item.id === 'tricycle' ? 'electric-rickshaw' : item.id === 'minibus' || item.id === 'coach' ? 'directions-bus' : 'directions-car'} size={18} color="#6A1B9A" />
                    </View>
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemTitle}>{item.label}</Text>
                      <Text style={styles.modalItemSub}>Max {getSeatLimit(item.id)} seats</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : activePicker === 'time' ? (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {SCHEDULE_OPTIONS.map((minutes) => (
                  <TouchableOpacity key={minutes} style={styles.modalItem} onPress={() => {
                    setScheduledOffset(minutes)
                    closePicker()
                  }}>
                    <View style={styles.modalItemIcon}>
                      <MaterialIcons name="schedule" size={18} color="#6A1B9A" />
                    </View>
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemTitle}>{minutes === 0 ? 'Now' : `+${minutes} mins`}</Text>
                      <Text style={styles.modalItemSub}>Pickup offset</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : activePicker === 'seats' ? (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {Array.from({ length: seatLimit }, (_, i) => i + 1).map((num) => (
                  <TouchableOpacity key={num} style={styles.modalItem} onPress={() => {
                    setSeatCount(num)
                    closePicker()
                  }}>
                    <View style={styles.modalItemIcon}>
                      <MaterialIcons name="person" size={18} color="#6A1B9A" />
                    </View>
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemTitle}>{num} {num === 1 ? 'Seat' : 'Seats'}</Text>
                      <Text style={styles.modalItemSub}>Number of passengers</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <FlatList
                style={styles.modalList}
                data={filteredLocations}
                keyExtractor={keyExtractor}
                showsVerticalScrollIndicator={false}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={3}
                keyboardShouldPersistTaps="handled"
                renderItem={renderLocationItem}
                removeClippedSubviews={true}
                getItemLayout={(_, index) => ({
                  length: 53,
                  offset: 53 * index,
                  index,
                })}
              />
            )}
            <TouchableOpacity style={styles.modalClose} onPress={closePicker}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showMapPicker && (
        <View style={StyleSheet.absoluteFill}>
          <MapPickerPage
            onClose={() => setShowMapPicker(false)}
            onConfirm={(coords) => {
              handleMapSelect(coords)
              setShowMapPicker(false)
            }}
            initialCoords={mapDropoff}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
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
  content: {
    padding: 5,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 12,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#8b8b8b',
    marginBottom: 10,
    letterSpacing: 0.6,
  },
  inputButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  pickupInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  currentLocationBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e2e2',
  },
  currentLocationBtnActive: {
    backgroundColor: '#f5effb',
    borderColor: '#e5d0f5',
  },
  inputPlaceholder: {
    color: '#9c9c9c',
  },
  inputValue: {
    color: '#1a1c1c',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#8b8b8b',
    marginTop: 10,
  },
  mapButtonContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f5effb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5d0f5',
  },
  mapButtonText: {
    color: '#6A1B9A',
    fontWeight: '600',
    fontSize: 14,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 4,
  },
  routeTimeline: {
    width: 24,
    alignItems: 'center',
    paddingTop: 41,
    paddingBottom: 19,
    marginRight: 8,
  },
  timelineDotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6A1B9A',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#e2e2e2',
    marginVertical: 4,
  },
  timelineDotDropoff: {
    width: 10,
    height: 10,
    backgroundColor: '#1a1c1c',
  },
  routeInputs: {
    flex: 1,
  },
  routeInputGroup: {
    flex: 1,
  },
  routeInputLabel: {
    fontSize: 12,
    color: '#8b8b8b',
    fontWeight: '600',
    marginBottom: 6,
  },
  vehicleSeatContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  configColVehicle: {
    flex: 2,
    gap: 6,
  },
  configColSeats: {
    flex: 1,
    gap: 6,
  },
  configColTime: {
    flex: 1.2,
    gap: 6,
  },
  dropdownLabel: {
    fontSize: 12,
    color: '#8b8b8b',
    fontWeight: '600',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  dropdownButtonText: {
    fontSize: 13,
    color: '#1a1c1c',
    fontWeight: '600',
    flex: 1,
    paddingRight: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  submitContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#6A1B9A',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#b79cd5',
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  absoluteModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    padding: 20,
    paddingHorizontal: 10,
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderColor: '#6b2e916a',
    borderWidth: 1,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 12,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1c1c',
  },
  modalList: {
    marginTop: 12,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  modalItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5effb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  modalItemSub: {
    fontSize: 12,
    color: '#8b8b8b',
  },
  modalClose: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  modalCloseText: {
    color: '#6A1B9A',
    fontWeight: '600',
  },
})

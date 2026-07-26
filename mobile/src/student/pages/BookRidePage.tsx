import { useMemo, useState, useCallback, useEffect, memo } from 'react'
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import api from '../../core/api'
import useWalletStore from '../../core/walletStore'
import { getVerifiedLocation, LocationError, roundCoord } from '../../core/locationService'
import { useLocations } from '../../../services/locationDataService'
import MapPickerPage, { RouteSelection } from './MapPickerPage'
import SharedRideLobbyPage from './SharedRideLobbyPage'

const VEHICLES = [
  { id: 'motorbike', label: 'Motorbike (Okada)' },
  { id: 'tricycle', label: 'Tricycle (Keke)' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'mpv', label: 'MPV' },
]

const SCHEDULE_OPTIONS = [0, 5, 10, 15, 20, 25, 30]

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

// Vehicle seat policy — min protects driver earnings, max is physical capacity
const VEHICLE_SEAT_POLICY: Record<string, { min: number; max: number }> = {
  motorbike: { min: 1, max: 2 },
  tricycle:  { min: 3, max: 4 },
  sedan:     { min: 3, max: 5 },
  mpv:       { min: 7, max: 9 },
}

const getSeatLimit = (vehicleId: string) =>
  VEHICLE_SEAT_POLICY[vehicleId]?.max ?? 4

const getMinSeats = (vehicleId: string) =>
  VEHICLE_SEAT_POLICY[vehicleId]?.min ?? 1

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
  const [seatCount, setSeatCount] = useState(getMinSeats('sedan'))
  const [scheduledOffset, setScheduledOffset] = useState(0)
  const [mapDropoff, setMapDropoff] = useState<{ latitude: number; longitude: number } | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<RouteSelection['route'] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pinModalVisible, setPinModalVisible] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  // Shared ride toggle
  const [isSharedRide, setIsSharedRide] = useState(false)
  const [maxRiders, setMaxRiders] = useState(4)
  // After shared ride created → show lobby
  const [sharedRideCode, setSharedRideCode] = useState<string | null>(null)
  const pinRows = useMemo(() => (['1','2','3','4','5','6','7','8','9','','0','back'].reduce<string[][]>((acc, item, i) => {
    if (i % 3 === 0) acc.push([])
    acc[acc.length - 1].push(item)
    return acc
  }, [])), [])

  const seatLimit = useMemo(() => getSeatLimit(vehicleType), [vehicleType])
  // Only compute filtered locations when a location picker is actually open
  const filteredLocations = useMemo(() => {
    if (activePicker !== 'pickup' && activePicker !== 'dropoff') return ALL_LOCATIONS
    const normalized = query.trim().toLowerCase()
    if (!normalized) return ALL_LOCATIONS
    return ALL_LOCATIONS.filter((item) => {
      const haystack = `${item.label} ${item.description}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [query, activePicker, ALL_LOCATIONS])

  const handleUseCurrentLocation = async () => {
    try {
      const coords = await getVerifiedLocation()
      setPickup({
        id: 'current-location',
        label: 'Current location',
        description: 'Using your current location',
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      closePicker()
    } catch (err: any) {
      if (err instanceof LocationError) {
        Alert.alert('Location Error', err.message)
      } else {
        Alert.alert('Location Error', 'An unexpected error occurred while fetching your location.')
      }
    }
  }

  const handleSelectLocation = useCallback((item: LocationOption) => {
    if (activePicker === 'pickup') {
      setPickup(item)
      setSelectedRoute(null)
    }
    if (activePicker === 'dropoff') {
      setDropoff(item)
      setMapDropoff(null)
      setSelectedRoute(null)
    }
    setActivePicker(null)
  }, [activePicker])

  const handleMapSelect = useCallback((selection: RouteSelection) => {
    const rounded = {
      latitude: roundCoord(selection.dropoff.latitude),
      longitude: roundCoord(selection.dropoff.longitude),
    }
    setMapDropoff(rounded)
    setSelectedRoute(selection.route)
    setDropoff({
      id: 'map-pin',
      label: 'Pinned location',
      description: `${selection.route.distance_km.toFixed(2)} km route selected`,
      latitude: rounded.latitude,
      longitude: rounded.longitude,
    })
  }, [])

  const formReady = Boolean(
    pickup &&
    dropoff &&
    selectedRoute &&
    seatCount >= getMinSeats(vehicleType) &&
    seatCount <= seatLimit &&
    !isSubmitting,
  )

  const submitRide = async () => {
    if (!pickup || !dropoff || !selectedRoute) return
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
      route_provider: selectedRoute.provider,
      route_index: selectedRoute.metadata?.route_index ?? selectedRoute.index,
    }
    setIsSubmitting(true)
    try {
      const response = await api.post('rides/request/', payload)
      const rideId = response?.data?.id
      if (!rideId) {
        Alert.alert('Booking failed', 'Ride was created without an id.')
        return
      }
      useWalletStore.getState().syncBalance()
      onRideCreated(String(rideId))
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Unable to request a ride.'
      Alert.alert('Booking failed', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitSharedRide = async () => {
    if (!pickup || !dropoff) return
    setIsSubmitting(true)
    try {
      const response = await api.post('rides/shared/create/', {
        vehicle_type: vehicleType,
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        pickup_address: pickup.label,
        dropoff_latitude: dropoff.latitude,
        dropoff_longitude: dropoff.longitude,
        dropoff_address: dropoff.label,
        max_riders: maxRiders,
      })
      const shareCode = response?.data?.share_code
      if (!shareCode) {
        Alert.alert('Error', 'Shared ride was created but share code is missing.')
        return
      }
      // Open the lobby full-screen
      setSharedRideCode(shareCode)
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || 'Failed to create shared ride.'
      Alert.alert('Error', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (!pickup) {
      Alert.alert('Missing pickup', 'Select a pickup location.')
      return
    }
    if (!dropoff) {
      Alert.alert('Missing dropoff', 'Select a dropoff location.')
      return
    }
    if (!isSharedRide && !selectedRoute) {
      Alert.alert('Route required', 'Open the map and select a valid route before requesting this ride.')
      return
    }
    // Open Transaction PIN modal
    setPinInput('')
    setPinError('')
    setPinModalVisible(true)
  }

  const handlePinDigit = async (digit: string) => {
    if (pinLoading) return
    if (!digit) return
    if (digit === 'back') {
      setPinInput((prev) => prev.slice(0, -1))
      return
    }
    
    if (pinInput.length >= 4) return
    const next = `${pinInput}${digit}`
    
    setPinError('')
    setPinInput(next)

    if (next.length === 4) {
      setPinLoading(true)
      try {
        await api.post('auth/settings/pin/verify/', { pin: next })
        setPinModalVisible(false)
        setPinInput('')
        if (isSharedRide) {
          await submitSharedRide()
        } else {
          await submitRide()
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.response?.data?.error?.message || 'Incorrect Transaction PIN.'
        setPinError(String(msg))
        setPinInput('')
      } finally {
        setPinLoading(false)
      }
    }
  }

  const renderLocationItem = useCallback(({ item }: { item: LocationOption }) => (
    <LocationItem item={item} onPress={() => handleSelectLocation(item)} />
  ), [handleSelectLocation])

  const keyExtractor = useCallback((item: LocationOption) => item.id, [])

  // If a shared ride was just created, show the lobby full-screen
  if (sharedRideCode) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <SharedRideLobbyPage
          shareCode={sharedRideCode}
          onClose={() => {
            setSharedRideCode(null)
            onClose()
          }}
        />
      </View>
    )
  }

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
                <View style={styles.pickupInputRow}>
                  <TouchableOpacity style={[styles.inputButton, { flex: 1 }]} onPress={() => openPicker('dropoff')}>
                    <Text style={dropoff ? styles.inputValue : styles.inputPlaceholder} numberOfLines={1}>
                      {dropoff ? dropoff.label : 'Search campus location'}
                    </Text>
                    <MaterialIcons name="keyboard-arrow-down" size={18} color="#8b8b8b" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.currentLocationBtn, selectedRoute && styles.currentLocationBtnActive]}
                    onPress={() => {
                      if (!pickup) {
                        Alert.alert('Pickup required', 'Select pickup before pinning dropoff.')
                        return
                      }
                      setShowMapPicker(true)
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="add-location-alt" size={20} color={selectedRoute ? '#6A1B9A' : '#8b8b8b'} />
                  </TouchableOpacity>
                </View>
                {selectedRoute && (
                  <Text style={styles.helperText}>
                    Route selected: {selectedRoute.distance_km.toFixed(2)} km{selectedRoute.duration_minutes ? ` · ${selectedRoute.duration_minutes} min` : ''}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.mapButtonContainer}>
            <TouchableOpacity
              style={[
                styles.mapButton,
                (!pickup || !dropoff) && styles.mapButtonDisabled,
              ]}
              activeOpacity={0.8}
              disabled={!pickup || !dropoff}
              onPress={() => {
                if (!pickup) {
                  Alert.alert('Pickup required', 'Select pickup before viewing the route.')
                  return
                }
                if (!dropoff) {
                  Alert.alert('Dropoff required', 'Select or pin a dropoff before viewing the route.')
                  return
                }
                setShowMapPicker(true)
              }}
            >
              <MaterialIcons name="map" size={18} color={pickup && dropoff ? '#6A1B9A' : '#9ca3af'} />
              <Text style={[styles.mapButtonText, (!pickup || !dropoff) && styles.mapButtonTextDisabled]}>
                View Route on Map
              </Text>
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



        {/* Share This Ride Toggle */}
        <View style={styles.card}>
          <View style={styles.shareToggleRow}>
            <View style={styles.shareToggleLeft}>
              <MaterialIcons name="group" size={22} color="#6A1B9A" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.shareToggleTitle}>Share this ride</Text>
                <Text style={styles.shareToggleSub}>
                  {isSharedRide ? 'Fare split with friends who join' : 'Solo ride — full fare applies'}
                </Text>
              </View>
            </View>
            <Switch
              value={isSharedRide}
              onValueChange={(v) => {
                setIsSharedRide(v)
                if (v) {
                  // Default max riders for vehicle
                  setMaxRiders(getSeatLimit(vehicleType))
                }
              }}
              trackColor={{ false: '#e0e0e0', true: '#d1b3e6' }}
              thumbColor={isSharedRide ? '#6A1B9A' : '#bdbdbd'}
            />
          </View>

          {isSharedRide && (
            <View style={styles.shareExpandedArea}>
              <View style={styles.shareDivider} />
              <Text style={styles.shareExpandedLabel}>Max friends in this ride</Text>
              <View style={styles.riderSelectorRow}>
                {[2, 3, 4, 5, 6].filter(n => n <= getSeatLimit(vehicleType)).map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.riderChip, maxRiders === n && styles.riderChipActive]}
                    onPress={() => setMaxRiders(n)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.riderChipText, maxRiders === n && styles.riderChipTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.shareInfoNote}>
                Fare will be shared proportionally, each person pays based on their pickup distance.
              </Text>
            </View>
          )}
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
            style={[
              styles.submitButton,
              isSharedRide && styles.submitButtonShared,
              !(isSharedRide ? (pickup && dropoff) : formReady) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={isSharedRide ? !(pickup && dropoff) : !formReady}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={isSharedRide ? 'group-add' : 'arrow-forward'}
              size={18}
              color="#ffffff"
            />
            <Text style={[styles.submitText, { marginLeft: 6 }]}>
              {isSubmitting
                ? (isSharedRide ? 'Creating...' : 'Booking...')
                : (isSharedRide ? 'Create Shared Ride' : 'Request Ride')}
            </Text>
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
                    setSelectedRoute(null)
                    // Auto-set seats to the minimum for the new vehicle type
                    const newMin = getMinSeats(item.id)
                    const newMax = getSeatLimit(item.id)
                    setSeatCount((prev) => Math.max(newMin, Math.min(prev, newMax)))
                    closePicker()
                  }}>
                    <View style={styles.modalItemIcon}>
                      <MaterialIcons name={item.id === 'motorbike' ? 'two-wheeler' : item.id === 'tricycle' ? 'electric-rickshaw' : item.id === 'mpv' ? 'airport-shuttle' : 'directions-car'} size={18} color="#6A1B9A" />
                    </View>
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemTitle}>{item.label}</Text>
                      <Text style={styles.modalItemSub}>{getMinSeats(item.id) === getSeatLimit(item.id) ? `${getSeatLimit(item.id)} seats` : `${getMinSeats(item.id)}–${getSeatLimit(item.id)} seats`}</Text>
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
                {Array.from({ length: seatLimit - getMinSeats(vehicleType) + 1 }, (_, i) => i + getMinSeats(vehicleType)).map((num) => (
                  <TouchableOpacity key={num} style={styles.modalItem} onPress={() => {
                    setSeatCount(num)
                    closePicker()
                  }}>
                    <View style={styles.modalItemIcon}>
                      <MaterialIcons name="person" size={18} color="#6A1B9A" />
                    </View>
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemTitle}>{num} {num === 1 ? 'Seat' : 'Seats'}</Text>
                      <Text style={styles.modalItemSub}>{num === getMinSeats(vehicleType) ? 'Minimum booking' : 'Number of passengers'}</Text>
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
            initialCoords={mapDropoff ?? (dropoff ? { latitude: dropoff.latitude, longitude: dropoff.longitude } : null)}
            pickupCoords={pickup ? { latitude: pickup.latitude, longitude: pickup.longitude } : null}
            vehicleType={vehicleType}
          />
        </View>
      )}

      <Modal visible={pinModalVisible} animationType="fade" transparent onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.pinModalBackdrop}>
          <View style={styles.pinModalCard}>
            <Text style={styles.pinModalTitle}>Confirm Booking</Text>
            <Text style={styles.pinModalSubtitle}>Enter your 4-digit Transaction PIN to book this ride.</Text>
            {pinError ? <Text style={styles.pinModalError}>{pinError}</Text> : null}
            <View style={styles.pinDotsRow}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.pinDot, pinInput.length > i && styles.pinDotFilled]} />
              ))}
            </View>
            <View style={styles.pinPad}>
              {pinRows.map((row, ri) => (
                <View key={ri} style={styles.pinRow}>
                  {row.map((digit, ci) => (
                    <Pressable
                      key={`${ri}-${ci}`}
                      style={({ pressed }) => [styles.pinKey, (!digit || pinLoading) && styles.pinKeyDisabled, pressed && styles.pinKeyPressed]}
                      onPress={() => handlePinDigit(digit)}
                      disabled={!digit || pinLoading}
                    >
                      {digit === 'back'
                        ? <Text style={styles.pinKeyText}>⌫</Text>
                        : <Text style={styles.pinKeyText}>{digit}</Text>}
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.pinCancelBtn}
              onPress={() => { setPinModalVisible(false); setPinInput(''); setPinError('') }}
              disabled={pinLoading}
            >
              <Text style={styles.pinCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  mapButtonDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  mapButtonText: {
    color: '#6A1B9A',
    fontWeight: '600',
    fontSize: 14,
  },
  mapButtonTextDisabled: {
    color: '#9ca3af',
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
  submitButtonShared: {
    backgroundColor: '#4a148c',
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
  pinModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pinModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  pinModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 6,
  },
  pinModalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  pinModalError: {
    color: '#ba1a1a',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginVertical: 16,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#6A1B9A',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#6A1B9A',
  },
  pinPad: {
    width: '100%',
    gap: 8,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  pinKey: {
    width: 72,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e2e2',
  },
  pinKeyDisabled: {
    opacity: 0,
  },
  pinKeyPressed: {
    backgroundColor: '#ede5f5',
  },
  pinKeyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  pinCancelBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  pinCancelText: {
    color: '#6A1B9A',
    fontWeight: '600',
    fontSize: 14,
  },
  // ── Shared ride toggle ──────────────────────────────────────────────────────
  shareToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  shareToggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  shareToggleSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  shareExpandedArea: {
    marginTop: 4,
  },
  shareDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  shareExpandedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b8b8b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  riderSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  riderChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  riderChipActive: {
    backgroundColor: '#f5effb',
    borderColor: '#6A1B9A',
  },
  riderChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  riderChipTextActive: {
    color: '#6A1B9A',
  },
  shareInfoNote: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
    backgroundColor: '#fafafa',
    padding: 10,
    borderRadius: 8,
  },

})


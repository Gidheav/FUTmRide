import { useMemo, useState } from 'react'
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as LocationService from 'expo-location'
import api from '../../core/api'
import useWalletStore from '../../core/walletStore'
import locationData from '../Gk-location cordinate.json'

const VEHICLES = [
  { id: 'motorcycle', label: 'Motorcycle (Okada)' },
  { id: 'tricycle', label: 'Tricycle (Keke)' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
  { id: 'minivan', label: 'Minivan / Shuttle' },
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

const DEFAULT_REGION: Region = {
  latitude: 9.5261,
  longitude: 6.4514,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
}

const filterLocations = (query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return ALL_LOCATIONS
  return ALL_LOCATIONS.filter((item) => {
    const haystack = `${item.label} ${item.description}`.toLowerCase()
    return haystack.includes(normalized)
  })
}

const getSeatLimit = (vehicleId: string) => {
  if (vehicleId === 'motorcycle') return 2
  if (vehicleId === 'tricycle') return 4
  return 6
}

export default function BookRidePage({ onClose, onRideCreated }: BookRidePageProps) {
  const insets = useSafeAreaInsets()
  const [activePicker, setActivePicker] = useState<'pickup' | 'dropoff' | null>(null)
  const [query, setQuery] = useState('')
  const [pickup, setPickup] = useState<LocationOption | null>(null)
  const [dropoff, setDropoff] = useState<LocationOption | null>(null)
  const [vehicleType, setVehicleType] = useState('sedan')
  const [seatCount, setSeatCount] = useState(1)
  const [scheduledOffset, setScheduledOffset] = useState(0)
  const [mapDropoff, setMapDropoff] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const seatLimit = useMemo(() => getSeatLimit(vehicleType), [vehicleType])
  const filteredLocations = useMemo(() => filterLocations(query), [query])

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
    setActivePicker(null)
  }

  const handleSelectLocation = (item: LocationOption) => {
    if (activePicker === 'pickup') {
      setPickup(item)
    }
    if (activePicker === 'dropoff') {
      setDropoff(item)
      setMapDropoff(null)
    }
    setActivePicker(null)
  }

  const handleMapSelect = (coords: { latitude: number; longitude: number }) => {
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
  }

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
          <Text style={styles.cardTitle}>Pickup</Text>
          <TouchableOpacity style={styles.inputButton} onPress={() => setActivePicker('pickup')}>
            <Text style={pickup ? styles.inputValue : styles.inputPlaceholder}>
              {pickup ? pickup.label : 'Select pickup location'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color="#8b8b8b" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={handleUseCurrentLocation}>
            <MaterialIcons name="my-location" size={18} color="#6A1B9A" />
            <Text style={styles.linkText}>Use my current location</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dropoff</Text>
          <TouchableOpacity style={styles.inputButton} onPress={() => setActivePicker('dropoff')}>
            <Text style={dropoff ? styles.inputValue : styles.inputPlaceholder}>
              {dropoff ? dropoff.label : 'Select dropoff location'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color="#8b8b8b" />
          </TouchableOpacity>

          <Text style={styles.helperText}>Or pin a dropoff on the map</Text>
          <View style={styles.mapCard}>
            <MapView
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={DEFAULT_REGION}
              onPress={(event) => handleMapSelect(event.nativeEvent.coordinate)}
            >
              {mapDropoff && (
                <Marker coordinate={mapDropoff} />
              )}
            </MapView>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle & Seats</Text>
          <View style={styles.vehicleRow}>
            {VEHICLES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.vehicleChip, vehicleType === item.id && styles.vehicleChipActive]}
                onPress={() => {
                  setVehicleType(item.id)
                  setSeatCount((prev) => Math.min(prev, getSeatLimit(item.id)))
                }}
              >
                <Text style={[styles.vehicleChipText, vehicleType === item.id && styles.vehicleChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.seatRow}>
            <Text style={styles.seatLabel}>Seats</Text>
            <View style={styles.seatControls}>
              <TouchableOpacity
                style={[styles.seatButton, seatCount <= 1 && styles.seatButtonDisabled]}
                onPress={() => setSeatCount((prev) => Math.max(1, prev - 1))}
                disabled={seatCount <= 1}
              >
                <MaterialIcons name="remove" size={18} color={seatCount <= 1 ? '#bdbdbd' : '#1a1c1c'} />
              </TouchableOpacity>
              <Text style={styles.seatValue}>{seatCount}</Text>
              <TouchableOpacity
                style={[styles.seatButton, seatCount >= seatLimit && styles.seatButtonDisabled]}
                onPress={() => setSeatCount((prev) => Math.min(seatLimit, prev + 1))}
                disabled={seatCount >= seatLimit}
              >
                <MaterialIcons name="add" size={18} color={seatCount >= seatLimit ? '#bdbdbd' : '#1a1c1c'} />
              </TouchableOpacity>
            </View>
            <Text style={styles.seatHint}>Max {seatLimit}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickup Time</Text>
          <View style={styles.scheduleRow}>
            {SCHEDULE_OPTIONS.map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={[styles.scheduleChip, scheduledOffset === minutes && styles.scheduleChipActive]}
                onPress={() => setScheduledOffset(minutes)}
              >
                <Text style={[styles.scheduleChipText, scheduledOffset === minutes && styles.scheduleChipTextActive]}>
                  {minutes === 0 ? 'Now' : `+${minutes}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>Pickups can be scheduled up to 30 minutes ahead.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>
          <View style={styles.paymentRow}>
            <MaterialIcons name="account-balance-wallet" size={20} color="#6A1B9A" />
            <Text style={styles.paymentText}>Wallet only for now</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitText}>{isSubmitting ? 'Booking...' : 'Request Ride'}</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!activePicker} transparent animationType="fade" onRequestClose={() => setActivePicker(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select {activePicker === 'pickup' ? 'pickup' : 'dropoff'}</Text>
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
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {filteredLocations.map((item) => (
                <TouchableOpacity key={item.id} style={styles.modalItem} onPress={() => handleSelectLocation(item)}>
                  <View style={styles.modalItemIcon}>
                    <MaterialIcons name="place" size={18} color="#6A1B9A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{item.label}</Text>
                    <Text style={styles.modalItemSub}>{item.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setActivePicker(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
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
    padding: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputPlaceholder: {
    color: '#9c9c9c',
  },
  inputValue: {
    color: '#1a1c1c',
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  linkText: {
    color: '#6A1B9A',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#8b8b8b',
    marginTop: 10,
  },
  mapCard: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
  },
  map: {
    flex: 1,
  },
  vehicleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    backgroundColor: '#fafafa',
  },
  vehicleChipActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  vehicleChipText: {
    fontSize: 12,
    color: '#5e5e5e',
    fontWeight: '600',
  },
  vehicleChipTextActive: {
    color: '#ffffff',
  },
  seatRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  seatControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  seatButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatButtonDisabled: {
    backgroundColor: '#efefef',
  },
  seatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
    minWidth: 20,
    textAlign: 'center',
  },
  seatHint: {
    fontSize: 12,
    color: '#8b8b8b',
  },
  scheduleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    backgroundColor: '#fafafa',
  },
  scheduleChipActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  scheduleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5e5e5e',
  },
  scheduleChipTextActive: {
    color: '#ffffff',
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
  submitButton: {
    marginTop: 8,
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
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

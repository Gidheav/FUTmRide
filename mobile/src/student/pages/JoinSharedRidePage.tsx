import { useMemo, useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../core/api'
import { getVerifiedLocation, LocationError } from '../../core/locationService'
import { useLocations } from '../../../services/locationDataService'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import SharedRideLobbyPage from './SharedRideLobbyPage'

function getDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function JoinSharedRidePage({ initialCode = '', onClose, hideTopInset }: { initialCode?: string, onClose: () => void, hideTopInset?: boolean }) {
  const [code, setCode] = useState(initialCode)
  const [step, setStep] = useState(1)
  const [ride, setRide] = useState<any>(null)
  const [pickup, setPickup] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [joinedCode, setJoinedCode] = useState<string | null>(null)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)

  const rawLocations = useLocations()
  const locations = useMemo(() => {
    return (rawLocations as any[]).map((loc) => ({
      id: loc.id,
      label: loc.name,
      description: loc.description,
      latitude: loc.latitude,
      longitude: loc.longitude,
    }))
  }, [rawLocations])

  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locations
    return locations.filter(l => 
      l.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [locations, searchQuery])

  const handleFetchRide = async (codeToFetch: string) => {
    if (!codeToFetch || codeToFetch.length < 4) return
    try {
      setLoading(true)
      const res = await api.get(`rides/shared/${codeToFetch.toUpperCase()}/`)
      setRide(res.data)
      setStep(2)
    } catch (err: any) {
      if (err.response?.data?.error?.message) {
        Alert.alert('Error', err.response.data.error.message)
      } else {
        Alert.alert('Error', 'Invalid or expired share code')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUseCurrentLocation = async () => {
    if (isFetchingLocation) return
    try {
      setIsFetchingLocation(true)
      const coords = await getVerifiedLocation()
      setPickup({
        id: 'current-location',
        label: 'Current location',
        description: 'Using your current location',
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      setShowLocationModal(false)
    } catch (err: any) {
      if (err instanceof LocationError) {
        Alert.alert('Location Error', err.message)
      } else {
        Alert.alert('Location Error', 'An unexpected error occurred while fetching your location.')
      }
    } finally {
      setIsFetchingLocation(false)
    }
  }

  useEffect(() => {
    if (initialCode) {
      handleFetchRide(initialCode)
    }
  }, [initialCode])


  const handleJoin = async () => {
    if (!pickup) {
      Alert.alert('Error', 'Please select your pickup location')
      return
    }

    if (ride?.dropoff_latitude && ride?.dropoff_longitude) {
      const dist = getDistanceKM(
        pickup.latitude, 
        pickup.longitude, 
        Number(ride.dropoff_latitude), 
        Number(ride.dropoff_longitude)
      );
      if (dist < 0.2) {
        Alert.alert(
          'Too Close to Destination',
          'Your selected pickup location is extremely close to the drop-off point. Please choose a valid starting point for this shared ride.'
        );
        return;
      }
    }

    try {
      setLoading(true)
      await api.post(`rides/shared/${ride.id}/join/`, {
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        pickup_address: pickup.label,
      })
      setJoinedCode(ride.share_code)
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to join ride')
    } finally {
      setLoading(false)
    }
  }

  if (joinedCode) {
    return <SharedRideLobbyPage shareCode={joinedCode} onClose={onClose} hideTopInset={hideTopInset} />
  }

  return (
    <SafeAreaView style={styles.container} edges={hideTopInset ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <MaterialIcons name="close" size={24} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Shared Ride</Text>
        {step === 2 ? (
          <TouchableOpacity onPress={() => setShowLocationModal(true)} style={{ padding: 8, marginRight: -8 }}>
            <MaterialIcons name="search" size={24} color="#1a1c1c" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={[styles.content, step === 2 && { padding: 0 }]}>
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Enter Share Code</Text>
            <Text style={styles.stepSub}>Ask your friend for the 8-character code.</Text>
            
            <TextInput
              style={styles.input}
              placeholder="e.g. ABCD1234"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              maxLength={12}
            />

            <TouchableOpacity 
              style={[styles.primaryButton, code.length < 4 && styles.disabledButton]} 
              disabled={code.length < 4 || loading}
              onPress={() => handleFetchRide(code)}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Find Ride</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 2 && ride && (
          <View style={{ flex: 1 }}>
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: Number(ride.dropoff_latitude) || 9.544,
                longitude: Number(ride.dropoff_longitude) || 6.541,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }}
              scrollEnabled={true}
              zoomEnabled={true}
              showsUserLocation={true}
              showsMyLocationButton={false}
              minZoomLevel={11}
            >
              <Marker
                coordinate={{
                  latitude: Number(ride.dropoff_latitude) || 9.544,
                  longitude: Number(ride.dropoff_longitude) || 6.541,
                }}
                pinColor="#6A1B9A"
              />
            </MapView>
            
            <TouchableOpacity 
              style={styles.floatingLocationBtn}
              onPress={handleUseCurrentLocation}
              disabled={isFetchingLocation}
              activeOpacity={0.8}
            >
              {isFetchingLocation ? (
                <ActivityIndicator size="small" color="#6A1B9A" />
              ) : (
                <MaterialIcons name="my-location" size={24} color="#6A1B9A" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.floatingArrowBtn, (!pickup || loading) && styles.disabledButton]}
              onPress={handleJoin}
              disabled={!pickup || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <MaterialIcons name="arrow-forward" size={28} color="#fff" />
              )}
            </TouchableOpacity>

            {pickup && (
              <View style={styles.floatingPickupBadge}>
                <MaterialIcons name="my-location" size={16} color="#1a1c1c" />
                <Text style={styles.floatingPickupText} numberOfLines={1}>
                  Pickup: {pickup.label}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <Modal visible={showLocationModal} animationType="slide" transparent={true} onRequestClose={() => setShowLocationModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowLocationModal(false)}>
          <View style={styles.bottomSheetOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.bottomSheetContent, { height: '85%' }]}>
                <View style={styles.bottomSheetDragHandle} />
                <Text style={styles.bottomSheetTitle}>Search Pickup</Text>

                <View style={styles.modalSearchContainer}>
                  <MaterialIcons name="search" size={20} color="#6b7280" />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Where are you starting?"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    placeholderTextColor="#9ca3af"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <MaterialIcons name="cancel" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </View>

                <FlatList
                  data={filteredLocations}
                  keyExtractor={item => item.id}
                  keyboardShouldPersistTaps="handled"
                  style={{ flex: 1 }}
                  ListHeaderComponent={
                    <TouchableOpacity
                      style={styles.locationItemModal}
                      onPress={handleUseCurrentLocation}
                      activeOpacity={0.7}
                      disabled={isFetchingLocation}
                    >
                      <View style={[styles.mapIconCircle, { backgroundColor: '#eef2ff' }]}>
                         <MaterialIcons name="gps-fixed" size={20} color="#4f46e5" />
                      </View>
                      <View style={styles.locationTextContainer}>
                        <Text style={[styles.locationLabel, { color: '#4f46e5' }]}>Use Current Location</Text>
                        <Text style={styles.locationSub}>{isFetchingLocation ? 'Fetching...' : 'Fetch from GPS'}</Text>
                      </View>
                      {isFetchingLocation && (
                        <ActivityIndicator size="small" color="#4f46e5" style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.locationItemModal}
                onPress={() => {
                  setPickup(item)
                  setShowLocationModal(false)
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.mapIconCircle, { backgroundColor: '#f3f4f6' }]}>
                   <MaterialIcons name="place" size={20} color="#6b7280" />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabel}>{item.label}</Text>
                  <Text style={styles.locationSub}>{item.description}</Text>
                </View>
                  </TouchableOpacity>
                )}
              />
            </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  content: { flex: 1, padding: 20 },
  stepTitle: { fontSize: 24, fontWeight: '700', color: '#1a1c1c', marginBottom: 8 },
  stepSub: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#6A1B9A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rideInfoCard: {
    backgroundColor: '#f3e5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#6A1B9A' },
  infoSub: { fontSize: 14, color: '#6A1B9A', marginTop: 4, opacity: 0.8 },
  label: { fontSize: 16, fontWeight: '600', color: '#1a1c1c' },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 12,
  },
  locationItemSelected: {
    borderColor: '#6A1B9A',
    backgroundColor: '#f3e5f5',
  },
  locationTextContainer: { marginLeft: 12, flex: 1 },
  locationLabel: { fontSize: 16, fontWeight: '600', color: '#1a1c1c' },
  locationSub: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  mapContainer: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6'
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOverlayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1c1c',
    flex: 1,
  },
  searchBarFake: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  searchBarFakeText: {
    fontSize: 16,
    color: '#9ca3af',
    flex: 1,
  },
  floatingLocationBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingArrowBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6A1B9A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  floatingPickupBadge: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 100, // Leave room for button
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingPickupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  bottomSheetDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 8,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 24,
    gap: 8,
  },
  modalSearchInput: { flex: 1, fontSize: 16, color: '#1a1c1c' },
  locationItemModal: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
})

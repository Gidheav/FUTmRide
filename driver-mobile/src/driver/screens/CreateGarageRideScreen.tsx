import React, { useMemo, useRef, useState, useEffect } from 'react'
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import LoadingOverlay from '../components/LoadingOverlay'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import MapView, { Marker } from 'react-native-maps'
import api, { driverApi } from '../../core/api'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'
import { useGarageRideStore } from '../../core/garageRideStore'
import { useDriverRidesStore } from '../../core/driverRidesStore'
import locationData from '../locations.json'

type CreateGarageRideScreenProps = {
  onBack: () => void
}

type LocationOption = {
  id: string
  label: string
  description: string
  latitude: number
  longitude: number
}

const ALL_LOCATIONS: LocationOption[] = (locationData as any[]).map((loc) => ({
  id: loc.id,
  label: loc.name,
  description: loc.description,
  latitude: Number(loc.latitude),
  longitude: Number(loc.longitude),
}))

const filterLocations = (query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return ALL_LOCATIONS
  return ALL_LOCATIONS.filter((item) => {
    const haystack = `${item.label} ${item.description}`.toLowerCase()
    return haystack.includes(normalized)
  })
}

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radius = 6371
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return radius * c
}

const formatCurrency = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '₦—'
  return `₦${value.toFixed(0)}`
}

const formatDistance = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '— km'
  return `${value.toFixed(2)} km`
}

const roundCoord = (value: number) => Number(value.toFixed(6))

export default function CreateGarageRideScreen({ onBack }: CreateGarageRideScreenProps) {
  const insets = useSafeAreaInsets()
  const {
    garageRide: cachedGarageRide,
    garagePassengers: cachedGaragePassengers,
    setGarageRide: setCachedGarageRide,
    setGaragePassengers: setCachedGaragePassengers,
    savedRoutes,
    setSavedRoutes,
    driverProfile,
    setDriverProfile,
  } = useDriverRidesStore()

  // Form state
  const [origin, setOrigin] = useState<LocationOption | null>(null)
  const [destination, setDestination] = useState<LocationOption | null>(null)
  const [seats, setSeats] = useState('4')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const [saveRoute, setSaveRoute] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(!cachedGarageRide)
  const [isUpdatingRide, setIsUpdatingRide] = useState(false)
  const [locationPickerOpen, setLocationPickerOpen] = useState<null | 'origin' | 'destination'>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [isMapPreviewOpen, setIsMapPreviewOpen] = useState(false)
  const [isSavedRoutesOpen, setIsSavedRoutesOpen] = useState(false)
  
  // Created ride state
  const [ride, setRide] = useState<any>(cachedGarageRide)
  const [passengers, setPassengers] = useState<any[]>(cachedGaragePassengers)
  const { setStatus } = useGarageRideStore()
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const estimateSeqRef = useRef(0)
  const syncInFlightRef = useRef(false)

  const ACTIVE_STATUSES = new Set(['open', 'full', 'departed'])

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadActiveRide = async () => {
      try {
        const res = await api.get('rides/garage/mine/')
        const list = Array.isArray(res.data) ? res.data : res.data?.results || []
        const active = list.find((item: any) => ACTIVE_STATUSES.has(item.status)) || null
        if (!isMounted) return
        if (active) {
          setRide(active)
          setCachedGarageRide(active)
          startPolling(active.id)
          setStatus('active')
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setHydrating(false)
      }
    }
    loadActiveRide()
    return () => {
      isMounted = false
    }
  }, [])

  const filteredLocations = useMemo(() => filterLocations(locationQuery), [locationQuery])

  useEffect(() => {
    let isMounted = true
    const loadDriverProfile = async () => {
      try {
        const res = await driverApi.getProfile()
        if (!isMounted) return
        setDriverProfile({ vehicle_type: res?.data?.vehicle_type || null })
      } catch {
        // Keep cached profile if available; fallback handled during fare estimate.
      }
    }
    if (!driverProfile) {
      void loadDriverProfile()
    }
    return () => {
      isMounted = false
    }
  }, [driverProfile, setDriverProfile])

  useEffect(() => {
    let isMounted = true
    const loadSavedRoutes = async () => {
      if (syncInFlightRef.current) return
      syncInFlightRef.current = true
      try {
        const res = await driverApi.getSavedRoutes()
        const list = Array.isArray(res?.data) ? res.data : res?.data?.results || []
        if (isMounted) setSavedRoutes(list)
      } catch {
        // Keep local cache if offline.
      } finally {
        syncInFlightRef.current = false
      }
    }
    if (savedRoutes.length === 0) {
      void loadSavedRoutes()
    }
    return () => {
      isMounted = false
    }
  }, [savedRoutes.length, setSavedRoutes])

  const getVehicleType = () => {
    const cachedType = driverProfile?.vehicle_type
    return cachedType ? String(cachedType).toLowerCase() : 'sedan'
  }

  const refreshEstimate = async (nextOrigin: LocationOption | null, nextDestination: LocationOption | null) => {
    if (!nextOrigin || !nextDestination) return
    const nextDistance = haversineKm(
      nextOrigin.latitude,
      nextOrigin.longitude,
      nextDestination.latitude,
      nextDestination.longitude
    )
    setDistanceKm(nextDistance)
    const currentSeq = ++estimateSeqRef.current
    setIsEstimating(true)
    try {
      const res = await driverApi.pricingEstimate({
        vehicle_type: getVehicleType(),
        distance_km: Number(nextDistance.toFixed(2)),
        surge_multiplier: 1.0,
      })
      if (estimateSeqRef.current === currentSeq) {
        setEstimatedFare(Number(res?.data?.total_fare || 0))
      }
    } catch {
      // Keep last known estimate; create will re-attempt.
    } finally {
      if (estimateSeqRef.current === currentSeq) setIsEstimating(false)
    }
  }

  const handleSelectLocation = (item: LocationOption) => {
    if (locationPickerOpen === 'origin') {
      const nextOrigin = item
      setOrigin(nextOrigin)
      void refreshEstimate(nextOrigin, destination)
    } else if (locationPickerOpen === 'destination') {
      const nextDestination = item
      setDestination(nextDestination)
      void refreshEstimate(origin, nextDestination)
    }
    setLocationQuery('')
    setLocationPickerOpen(null)
  }

  const handleSwapRoute = () => {
    if (!origin || !destination) return
    const nextOrigin = destination
    const nextDestination = origin
    setOrigin(nextOrigin)
    setDestination(nextDestination)
    void refreshEstimate(nextOrigin, nextDestination)
  }

  const handleUseSavedRoute = (route: any) => {
    const nextOrigin = {
      id: route.id || 'saved-origin',
      label: route.origin_address,
      description: 'Saved route origin',
      latitude: roundCoord(Number(route.origin_latitude)),
      longitude: roundCoord(Number(route.origin_longitude)),
    }
    const nextDestination = {
      id: route.id || 'saved-destination',
      label: route.destination_address,
      description: 'Saved route destination',
      latitude: roundCoord(Number(route.destination_latitude)),
      longitude: roundCoord(Number(route.destination_longitude)),
    }
    setOrigin(nextOrigin)
    setDestination(nextDestination)
    void refreshEstimate(nextOrigin, nextDestination)
    if (route?.id && !String(route.id).startsWith('local-')) {
      const nextUsedAt = new Date().toISOString()
      upsertSavedRoute({ ...route, last_used_at: nextUsedAt })
      driverApi.updateSavedRoute(route.id, { last_used_at: nextUsedAt }).catch(() => {})
    }
    setIsSavedRoutesOpen(false)
  }

  const upsertSavedRoute = (route: any) => {
    const next = [...savedRoutes]
    const index = next.findIndex((item) => item.id === route.id)
    if (index >= 0) {
      next[index] = route
    } else {
      next.unshift(route)
    }
    setSavedRoutes(next)
  }

  const getNextPinTarget = () => {
    if (!origin) return 'origin'
    if (!destination) return 'destination'
    return 'destination'
  }

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event?.nativeEvent?.coordinate || {}
    if (latitude === undefined || longitude === undefined) return
    const pin: LocationOption = {
      id: `pin-${Date.now()}`,
      label: 'Pinned location',
      description: `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`,
      latitude: roundCoord(latitude),
      longitude: roundCoord(longitude),
    }
    if (getNextPinTarget() === 'origin') {
      setOrigin(pin)
      void refreshEstimate(pin, destination)
    } else {
      setDestination(pin)
      void refreshEstimate(origin, pin)
    }
  }

  const handleCreate = async () => {
    if (!origin || !destination || !seats) {
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }

    setLoading(true)
    try {
      const rawDistance = distanceKm ?? haversineKm(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      )
      const distance = Number(rawDistance.toFixed(2))

      let fareValue = estimatedFare
      if (!fareValue) {
        const estimate = await driverApi.pricingEstimate({
          vehicle_type: getVehicleType(),
          distance_km: distance,
          surge_multiplier: 1.0,
        })
        fareValue = Number(estimate?.data?.total_fare || 0)
        setEstimatedFare(fareValue)
      }
      if (!fareValue || Number.isNaN(fareValue)) {
        Alert.alert('Pricing unavailable', 'Unable to calculate fare. Please try again.')
        return
      }

      const payload = {
        origin_address: origin.label,
        origin_latitude: roundCoord(origin.latitude),
        origin_longitude: roundCoord(origin.longitude),
        destination_address: destination.label,
        destination_latitude: roundCoord(destination.latitude),
        destination_longitude: roundCoord(destination.longitude),
        vehicle_type: getVehicleType(),
        total_seats: parseInt(seats, 10),
        fare_per_seat: Number(fareValue),
      }

      const res = await api.post('rides/garage/create/', payload)
      setRide(res.data)
      setCachedGarageRide(res.data)
      setCachedGaragePassengers([])
      startPolling(res.data.id)
      setStatus('active')

      if (saveRoute) {
        const isDuplicate = savedRoutes.some(item => 
          item.origin_address === origin.label && 
          item.destination_address === destination.label
        )
        if (!isDuplicate) {
          const tempRoute = {
            id: `local-${Date.now()}`,
            name: '',
            origin_address: origin.label,
            origin_latitude: roundCoord(origin.latitude),
            origin_longitude: roundCoord(origin.longitude),
            destination_address: destination.label,
            destination_latitude: roundCoord(destination.latitude),
            destination_longitude: roundCoord(destination.longitude),
            distance_km: distance,
            last_used_at: new Date().toISOString(),
          }
          upsertSavedRoute(tempRoute)
          driverApi
            .createSavedRoute({
              name: tempRoute.name,
              origin_address: tempRoute.origin_address,
              origin_latitude: tempRoute.origin_latitude,
              origin_longitude: tempRoute.origin_longitude,
              destination_address: tempRoute.destination_address,
              destination_latitude: tempRoute.destination_latitude,
              destination_longitude: tempRoute.destination_longitude,
              distance_km: tempRoute.distance_km,
              last_used_at: tempRoute.last_used_at,
            })
            .then((resp) => {
              if (resp?.data?.id) {
                const next = savedRoutes.filter((item) => {
                  if (!String(item.id).startsWith('local-')) return true
                  return !(
                    item.origin_address === tempRoute.origin_address &&
                    item.destination_address === tempRoute.destination_address &&
                    Number(item.distance_km) === Number(tempRoute.distance_km)
                  )
                })
                next.unshift(resp.data)
                setSavedRoutes(next)
              }
            })
            .catch(() => {
              // Keep local entry; sync can retry later.
            })
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Could not create garage ride.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  const startPolling = (rideId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    const fetchPassengers = async () => {
      try {
        const res = await api.get(`rides/garage/${rideId}/passengers/`)
        const list = res.data?.results || res.data || []
        setPassengers(list)
        setCachedGaragePassengers(list)
      } catch (err) {
        // ignore
      }
    }
    fetchPassengers()
    pollIntervalRef.current = setInterval(fetchPassengers, 5000)
  }

  if (hydrating && !ride) {
    return (
      <View style={[styles.page, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}> 
        <LoadingOverlay visible={true} inline size={60} />
        <Text style={styles.loadingText}>Loading garage ride...</Text>
      </View>
    )
  }

  const handleDepart = async () => {
    if (!ride) return
    if (ride.status === 'departed' || isUpdatingRide) return
    Alert.alert('Depart', 'Are you sure you want to depart and close boarding?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Depart',
        onPress: async () => {
          try {
            setIsUpdatingRide(true)
            const res = await api.post(`rides/garage/${ride.id}/depart/`)
            const nextRide = res?.data || ride
            setRide(nextRide)
            setCachedGarageRide(nextRide)
            Alert.alert('Departed', 'Have a safe trip!')
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error?.message || 'Failed to depart.')
          } finally {
            setIsUpdatingRide(false)
          }
        },
      },
    ])
  }

  const handleComplete = async () => {
    if (!ride || isUpdatingRide) return
    if (ride.status !== 'departed') return
    try {
      setIsUpdatingRide(true)
      await api.post(`rides/garage/${ride.id}/complete/`)
      Alert.alert('Completed', 'Ride completed successfully.')
      setRide(null)
      setPassengers([])
      setCachedGarageRide(null)
      setCachedGaragePassengers([])
      setStatus('inactive')
      onBack()
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message || 'Failed to complete ride.')
    } finally {
      setIsUpdatingRide(false)
    }
  }

  const handleCancel = async () => {
    if (!ride) return
    Alert.alert('Cancel Ride', 'Cancel this ride and refund all passengers?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`rides/garage/${ride.id}/cancel/`)
            Alert.alert('Cancelled', 'Ride cancelled and passengers refunded.')
            setRide(null)
            setPassengers([])
            setCachedGarageRide(null)
            setCachedGaragePassengers([])
            setStatus('inactive')
            onBack()
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error?.message || 'Failed to cancel.')
          }
        },
      },
    ])
  }

  if (ride) {
    // ── Show QR and passenger list ──
    const totalEarnings = passengers.reduce((sum, p) => sum + Number(p.amount_paid), 0)
    
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
            <MaterialIcons name="close" size={24} color={COLORS.error} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Boarding...</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.qrContainer}>
            <Text style={styles.qrInstruction}>Have students scan this code to pay & board.</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={ride.qr_token}
                size={300}
                color="#000"
                backgroundColor="#FFF"
              />
            </View>
            <Text style={styles.rideRef}>{ride.reference}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Seats Booked</Text>
              <Text style={styles.statValue}>{passengers.reduce((sum, p) => sum + p.seats_booked, 0)} / {ride.total_seats}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Earnings So Far</Text>
              <Text style={styles.statValue}>₦{totalEarnings.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.passengersSection}>
            <Text style={styles.passengersTitle}>Passengers ({passengers.length})</Text>
            {passengers.map((p) => (
              <View key={p.id} style={styles.passengerRow}>
                <View style={styles.passengerAvatar}>
                  <MaterialIcons name="person" size={20} color={COLORS.primaryContainer} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passengerName}>{p.student?.full_name || 'Student'}</Text>
                  <Text style={styles.passengerDetails}>{p.seats_booked} seat(s) • ₦{Number(p.amount_paid).toLocaleString()}</Text>
                </View>
              </View>
            ))}
            {passengers.length === 0 && (
              <Text style={styles.noPassengers}>Waiting for passengers...</Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {ride.status === 'departed' ? (
            <TouchableOpacity style={styles.completeBtn} onPress={handleComplete} disabled={isUpdatingRide}>
              <Text style={styles.departBtnText}>Complete Ride</Text>
              <MaterialIcons name="check-circle" size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.departBtn} onPress={handleDepart} disabled={isUpdatingRide}>
              <Text style={styles.departBtnText}>Depart Now</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
        <LoadingOverlay visible={isUpdatingRide} />
      </View>
    )
  }

  // ── Show Creation Form ──
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Garage Ride</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Set up a ride at the park. You'll get a QR code for students to scan and pay automatically.
        </Text>

        {savedRoutes.length > 0 && (
          <TouchableOpacity 
            style={[styles.input, { marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} 
            onPress={() => setIsSavedRoutesOpen(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="bookmark" size={20} color={COLORS.primary} />
              <Text style={styles.inputText}>Select from Saved Routes</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={COLORS.onSurfaceVariant} />
          </TouchableOpacity>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Origin (Where are you?)</Text>
          <TouchableOpacity style={styles.input} onPress={() => setLocationPickerOpen('origin')}>
            <Text style={styles.inputText}>{origin?.label || 'Select origin'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Destination</Text>
          <TouchableOpacity style={styles.input} onPress={() => setLocationPickerOpen('destination')}>
            <Text style={styles.inputText}>{destination?.label || 'Select destination'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <View>
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>{formatDistance(distanceKm)}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Fare per Seat</Text>
            <Text style={styles.infoValue}>{formatCurrency(estimatedFare)}</Text>
            {isEstimating ? <Text style={styles.infoHint}>Estimating…</Text> : null}
          </View>
        </View>

        {(origin || destination) && (
          <TouchableOpacity style={styles.mapPreviewBtn} onPress={() => setIsMapPreviewOpen(true)}>
            <MaterialIcons name="map" size={18} color={COLORS.primary} />
            <Text style={styles.mapPreviewText}>Preview Map</Text>
          </TouchableOpacity>
        )}

        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Total Seats</Text>
            <TextInput
              style={styles.input}
              placeholder="4"
              value={seats}
              onChangeText={setSeats}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.saveRouteRow}>
          <Text style={styles.saveRouteLabel}>Save this route for quick reuse</Text>
          <Switch value={saveRoute} onValueChange={setSaveRoute} />
        </View>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.submitBtnText}>Create Ride & Show QR</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={Boolean(locationPickerOpen)} animationType="slide" onRequestClose={() => setLocationPickerOpen(null)}>
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setLocationPickerOpen(null)} style={styles.modalBack}>
              <MaterialIcons name="close" size={20} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select location</Text>
            <View style={{ width: 20 }} />
          </View>
          <View style={styles.modalSearch}>
            <MaterialIcons name="search" size={18} color={COLORS.onSurfaceVariant} />
            <TextInput
              style={styles.modalInput}
              placeholder="Search locations"
              value={locationQuery}
              onChangeText={setLocationQuery}
            />
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            {filteredLocations.map((item) => (
              <TouchableOpacity key={item.id} style={styles.modalItem} onPress={() => handleSelectLocation(item)}>
                <MaterialIcons name="place" size={18} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemTitle}>{item.label}</Text>
                  <Text style={styles.modalItemSubtitle}>{item.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={isMapPreviewOpen} animationType="slide" onRequestClose={() => setIsMapPreviewOpen(false)}>
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsMapPreviewOpen(false)} style={styles.modalBack}>
              <MaterialIcons name="close" size={20} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Route Preview</Text>
            <View style={{ width: 20 }} />
          </View>
          <Text style={styles.mapHint}>Tap map to set {getNextPinTarget()} location.</Text>
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              onPress={handleMapPress}
              initialRegion={
                origin && destination
                  ? {
                      latitude: (origin.latitude + destination.latitude) / 2,
                      longitude: (origin.longitude + destination.longitude) / 2,
                      latitudeDelta: Math.abs(origin.latitude - destination.latitude) + 0.02,
                      longitudeDelta: Math.abs(origin.longitude - destination.longitude) + 0.02,
                    }
                  : {
                      latitude: 9.6171,
                      longitude: 6.5492,
                      latitudeDelta: 0.03,
                      longitudeDelta: 0.03,
                    }
              }
            >
              {origin ? (
                <Marker
                  coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
                  title={origin.label}
                />
              ) : null}
              {destination ? (
                <Marker
                  coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
                  title={destination.label}
                />
              ) : null}
            </MapView>
          </View>
        </View>
      </Modal>

      <Modal visible={isSavedRoutesOpen} animationType="slide" onRequestClose={() => setIsSavedRoutesOpen(false)}>
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsSavedRoutesOpen(false)} style={styles.modalBack}>
              <MaterialIcons name="arrow-back" size={20} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Saved Routes</Text>
            <View style={{ width: 20 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            <View style={{ height: 16 }} />
            {savedRoutes.length === 0 ? (
              <Text style={[styles.description, { textAlign: 'center', marginTop: 40 }]}>No saved routes found.</Text>
            ) : (
              savedRoutes.map((route) => (
                <TouchableOpacity
                  key={route.id}
                  style={styles.savedRouteCard}
                  onPress={() => handleUseSavedRoute(route)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <MaterialIcons name="route" size={24} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.savedRouteTitle}>{route.name || `${route.origin_address} → ${route.destination_address}`}</Text>
                      <Text style={styles.savedRouteMeta}>{formatDistance(Number(route.distance_km || 0))}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
      <LoadingOverlay visible={loading} />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainerLow,
  },
  headerBtn: { padding: 4 },
  headerTitle: { ...FONTS.headlineMd, color: COLORS.onSurface },
  content: { padding: 20 },
  description: { ...FONTS.bodyMd, color: COLORS.onSurfaceVariant, marginBottom: 24 },
  
  formGroup: { marginBottom: 20 },
  label: { ...FONTS.labelLg, color: COLORS.onSurface, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    ...FONTS.bodyLg,
  },
  inputText: {
    ...FONTS.bodyLg,
    color: COLORS.onSurface,
  },
  row: { flexDirection: 'row' },
  
  submitBtn: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnText: { ...FONTS.labelLg, color: COLORS.onPrimary },

  savedRoutesWrap: {
    marginBottom: 20,
    gap: 10,
  },
  savedRoutesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...FONTS.labelLg,
    color: COLORS.onSurface,
  },
  swapText: {
    ...FONTS.labelMd,
    color: COLORS.primary,
  },
  savedRouteCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  savedRouteTitle: {
    ...FONTS.bodyMd,
    color: COLORS.onSurface,
  },
  savedRouteMeta: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoLabel: {
    ...FONTS.labelMd,
    color: COLORS.onSurfaceVariant,
  },
  infoValue: {
    ...FONTS.headlineMd,
    color: COLORS.onSurface,
  },
  infoHint: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  mapPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  mapPreviewText: {
    ...FONTS.labelMd,
    color: COLORS.primary,
  },
  saveRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  saveRouteLabel: {
    ...FONTS.bodyMd,
    color: COLORS.onSurface,
  },

  // QR Screen
  qrContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 4,
    borderRadius: 12,
    ...AMBIENT_SHADOW,
    marginBottom: 24,
  },
  qrInstruction: {
    ...FONTS.bodyMd,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 8,
  },
  qrWrapper: {
    padding: 6,
    backgroundColor: '#FFF',
    borderRadius: 16,
    elevation: 0,
  },
  rideRef: {
    ...FONTS.labelLg,
    color: COLORS.primaryContainer,
    marginTop: 16,
    letterSpacing: 1,
  },
  
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  statLabel: { ...FONTS.labelMd, color: COLORS.onSurfaceVariant },
  statValue: { ...FONTS.headlineMd, color: COLORS.onSurface, marginTop: 4 },

  passengersSection: {
    marginBottom: 40,
  },
  passengersTitle: {
    ...FONTS.headlineMd,
    color: COLORS.onSurface,
    marginBottom: 16,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  passengerName: { ...FONTS.labelLg, color: COLORS.onSurface },
  passengerDetails: { ...FONTS.bodySm, color: COLORS.onSurfaceVariant, marginTop: 2 },
  noPassengers: {
    ...FONTS.bodyMd,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  loadingText: {
    ...FONTS.bodyMd,
    color: COLORS.onSurfaceVariant,
    marginTop: 12,
  },

  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainerLow,
  },
  departBtn: {
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  completeBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  departBtnText: { ...FONTS.headlineMd, color: COLORS.onPrimary },

  modalPage: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceContainerLow,
  },
  modalBack: {
    padding: 4,
  },
  modalTitle: {
    ...FONTS.labelLg,
    color: COLORS.onSurface,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
  },
  modalInput: {
    flex: 1,
    ...FONTS.bodyMd,
    color: COLORS.onSurface,
  },
  modalList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceContainerLow,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  modalItemTitle: {
    ...FONTS.bodyMd,
    color: COLORS.onSurface,
  },
  modalItemSubtitle: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  mapWrap: {
    flex: 1,
  },
  mapHint: {
    ...FONTS.bodySm,
    color: COLORS.onSurfaceVariant,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  map: {
    flex: 1,
  },
})

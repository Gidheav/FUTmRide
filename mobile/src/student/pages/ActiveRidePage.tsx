import { useEffect, useState, useRef } from 'react'
import {
  Alert,
  AppState,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps'
import api from '../../core/api'
import useWalletStore from '../../core/walletStore'
import { showRideStatusNotification } from '../../core/pushNotifications'
import { WS_BASE_URL } from '../../../config/apiConfig'
import { createAuthenticatedWebSocket } from '../../../utils/ws'
import LoadingOverlay from '../components/LoadingOverlay'

type ActiveRidePageProps = {
  rideId?: string | null
  onBack: () => void
  onRideEnded?: () => void
}

const CANCELLED_STATUSES = [
  'cancelled_no_driver',
  'cancelled_by_student',
  'cancelled_by_driver',
  'cancelled_no_show',
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  driver_assigned: { label: 'Driver Assigned', color: '#6A1B9A', icon: 'person' },
  driver_en_route: { label: 'Driver En Route', color: '#1565C0', icon: 'directions-car' },
  driver_arrived: { label: 'Driver Arrived', color: '#2e7d32', icon: 'place' },
  in_progress: { label: 'Trip In Progress', color: '#E65100', icon: 'navigation' },
  completed: { label: 'Trip Completed', color: '#2e7d32', icon: 'check-circle' },
  cancelled_by_student: { label: 'Cancelled', color: '#b91c1c', icon: 'cancel' },
  cancelled_by_driver: { label: 'Driver Cancelled', color: '#b91c1c', icon: 'cancel' },
  cancelled_no_driver: { label: 'No Driver Found', color: '#b91c1c', icon: 'error-outline' },
  cancelled_no_show: { label: 'No Show', color: '#b91c1c', icon: 'warning' },
}

export default function ActiveRidePage({ rideId, onBack, onRideEnded }: ActiveRidePageProps) {
  const insets = useSafeAreaInsets()
  const [ride, setRide] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const lastStatusRef = useRef<string | null>(null)
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let isMounted = true
    let intervalId: ReturnType<typeof setInterval> | null = null

    const loadRide = async () => {
      if (!rideId) {
        setError('Missing ride id.')
        setLoading(false)
        return
      }
      try {
        const response = await api.get(`rides/${rideId}/`)
        if (!isMounted) return
        setRide(response.data)
        setLoading(false)
        setError(null)

        const status = response.data?.status
        if (status) {
          const isInitial = lastStatusRef.current === null
          if (isInitial || lastStatusRef.current !== status) {
            lastStatusRef.current = status
            const label = STATUS_CONFIG[status]?.label || 'Ride status updated.'
            void showRideStatusNotification('Ride update', label, {
              ride_id: String(response.data?.id || ''),
              ride_status: status,
            }, 'ride-status-alert', { sticky: status !== 'completed' && !CANCELLED_STATUSES.includes(status), silent: false })
          }
        }
        // Stop polling on terminal states
        if (status === 'completed' || CANCELLED_STATUSES.includes(status)) {
          if (intervalId) clearInterval(intervalId)
          useWalletStore.getState().syncBalance()
        }
      } catch (err: any) {
        if (!isMounted) return
        const message = err?.response?.data?.error?.message || 'Unable to load ride.'
        setError(String(message))
        setLoading(false)
      }
    }

    void loadRide()
    intervalId = setInterval(loadRide, 3000)

    return () => {
      isMounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [rideId])

  useEffect(() => {
    let isActive = true

    const connectWs = async () => {
      if (!rideId) return
      const socket = await createAuthenticatedWebSocket(`/ws/ride/${rideId}/track/`)
      if (!socket) return
      wsRef.current = socket

      socket.onmessage = (event) => {
        if (!isActive) return
        try {
          const payload = JSON.parse(event.data)
          if (payload?.type === 'driver_location') {
            const lat = Number(payload.latitude)
            const lng = Number(payload.longitude)
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
              setDriverLocation({ latitude: lat, longitude: lng })
            }
          }
        } catch {
          // ignore malformed messages
        }
      }

      socket.onerror = () => {
        // keep silent, REST polling continues
      }

      socket.onclose = () => {
        if (!isActive) return
        wsRef.current = null
      }
    }

    void connectWs()

    return () => {
      isActive = false
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [rideId])

  const handleCancel = async () => {
    if (!rideId) return
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            try {
              await api.post(`rides/${rideId}/cancel/`, { reason: 'Student cancelled.' })
              // Sync wallet balance to reflect any potential refund
              useWalletStore.getState().syncBalance()
              // Ride actually cancelled — tell parent to clear ride state
              if (onRideEnded) onRideEnded()
              else onBack()
            } catch (err: any) {
              const message = err?.response?.data?.error?.message || 'Unable to cancel ride.'
              setError(String(message))
              setCancelling(false)
            }
          },
        },
      ]
    )
  }

  const handleCallDriver = () => {
    const phone = ride?.driver?.phone_number
    if (phone) {
      Linking.openURL(`tel:${phone}`)
    } else {
      Alert.alert('Unavailable', 'Driver phone number is not available.')
    }
  }

  const handleSOS = () => {
    Alert.alert(
      'Emergency SOS',
      'Are you sure you want to contact campus security?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Security',
          style: 'destructive',
          onPress: () => {
            // Placeholder campus security number
            Linking.openURL('tel:112') 
          }
        }
      ]
    )
  }

  // Derived data from API response
  const rideStatus = ride?.status || 'driver_assigned'
  const statusCfg = STATUS_CONFIG[rideStatus] || STATUS_CONFIG.driver_assigned
  const isCancelled = CANCELLED_STATUSES.includes(rideStatus)
  const isCompleted = rideStatus === 'completed'
  const isTerminal = isCancelled || isCompleted
  const canCancel = ride?.status && !isTerminal && rideStatus !== 'in_progress'

  const driver = ride?.driver
  const driverName = driver?.full_name || 'Awaiting driver…'
  const driverVehicle = [driver?.vehicle_color, driver?.vehicle_make, driver?.vehicle_model]
    .filter(Boolean)
    .join(' ') || 'Vehicle info pending'
  const driverPlate = driver?.plate_number || '—'
  const driverRating = driver?.average_rating ? Number(driver.average_rating).toFixed(1) : null
  const driverPhoto = driver?.profile_photo || null

  const pickupLabel = ride?.pickup_address || '—'
  const dropoffLabel = ride?.dropoff_address || '—'
  const fareLabel = ride?.total_fare ? `₦${Number(ride.total_fare).toLocaleString()}` : '—'
  const etaLabel = ride?.estimated_duration_minutes ? `${ride.estimated_duration_minutes} min` : null
  const refLabel = ride?.reference || ''

  const pickupCoords = ride?.pickup_latitude && ride?.pickup_longitude
    ? { latitude: Number(ride.pickup_latitude), longitude: Number(ride.pickup_longitude) }
    : null
  const dropoffCoords = ride?.dropoff_latitude && ride?.dropoff_longitude
    ? { latitude: Number(ride.dropoff_latitude), longitude: Number(ride.dropoff_longitude) }
    : null

  const mapRegion: Region | undefined = pickupCoords
    ? {
      latitude: pickupCoords.latitude,
      longitude: pickupCoords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }
    : undefined

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Ride</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {mapRegion ? (
          <View style={styles.mapCard}>
            <MapView
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={mapRegion}
            >
              {pickupCoords ? (
                <Marker coordinate={pickupCoords} title="Pickup" />
              ) : null}
              {dropoffCoords ? (
                <Marker coordinate={dropoffCoords} title="Dropoff" pinColor="#1D4ED8" />
              ) : null}
              {driverLocation ? (
                <Marker coordinate={driverLocation} title="Driver" pinColor="#6A1B9A" />
              ) : null}
            </MapView>
          </View>
        ) : null}
        {loading && (
          <View style={styles.loadingRow}>
            <LoadingOverlay visible={true} inline size={24} />
            <Text style={styles.loadingText}>Loading ride details…</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusCfg.color + '14' }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: statusCfg.color }]}>
            <MaterialIcons name={statusCfg.icon} size={20} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            {refLabel ? <Text style={styles.statusRef}>Ref: {refLabel}</Text> : null}
          </View>
          {etaLabel && !isTerminal && (
            <View style={styles.etaPill}>
              <Text style={styles.etaPillText}>{etaLabel}</Text>
            </View>
          )}
        </View>

        {/* Driver card */}
        {driver && (
          <View style={styles.driverCard}>
            <View style={styles.driverTop}>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatarWrap}>
                  {driverPhoto ? (
                    <Image source={{ uri: driverPhoto }} style={styles.driverAvatar} />
                  ) : (
                    <View style={[styles.driverAvatar, styles.driverAvatarPlaceholder]}>
                      <MaterialIcons name="person" size={28} color="#6A1B9A" />
                    </View>
                  )}
                  {driverRating && (
                    <View style={styles.driverRatingBadge}>
                      <MaterialIcons name="star" size={10} color="#F9A825" />
                      <Text style={styles.driverRatingText}>{driverRating}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{driverName}</Text>
                  <Text style={styles.driverVehicle}>{driverVehicle}</Text>
                </View>
              </View>
              <View style={styles.plateWrap}>
                <Text style={styles.plateText}>{driverPlate}</Text>
              </View>
            </View>

            <View style={styles.driverDivider} />

            <View style={styles.driverActions}>
              <TouchableOpacity style={styles.driverActionButton} onPress={handleCallDriver} activeOpacity={0.85}>
                <MaterialIcons name="call" size={18} color="#6A1B9A" />
                <Text style={styles.driverActionText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Route card */}
        <View style={styles.routeCard}>
          <View style={styles.routeRail}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <View style={styles.routeSquare} />
          </View>
          <View style={styles.routeTextWrap}>
            <View>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeValue}>{pickupLabel}</Text>
            </View>
            <View style={styles.routeSpacing}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeValue}>{dropoffLabel}</Text>
            </View>
          </View>
        </View>

        {/* Fare card */}
        <View style={styles.fareCard}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Fare</Text>
            <Text style={styles.fareValue}>{fareLabel}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Payment</Text>
            <View style={styles.paymentBadge}>
              <MaterialIcons name="account-balance-wallet" size={14} color="#6A1B9A" />
              <Text style={styles.paymentBadgeText}>
                {ride?.payment_method === 'wallet' ? 'Wallet' : ride?.payment_method || '—'}
              </Text>
            </View>
          </View>
          {ride?.is_paid && (
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Status</Text>
              <View style={[styles.paymentBadge, { backgroundColor: '#e8f5e9' }]}>
                <MaterialIcons name="check-circle" size={14} color="#2e7d32" />
                <Text style={[styles.paymentBadgeText, { color: '#2e7d32' }]}>Paid</Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        {isTerminal ? (
          <TouchableOpacity style={styles.primaryButton} onPress={onRideEnded || onBack} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionsRow}>
            {canCancel && (
              <TouchableOpacity
                style={[styles.cancelButton, cancelling && { opacity: 0.6 }]}
                onPress={handleCancel}
                activeOpacity={0.85}
                disabled={cancelling}
              >
                <Text style={styles.cancelText}>{cancelling ? 'Cancelling…' : 'Cancel Ride'}</Text>
              </TouchableOpacity>
            )}
            
            {!isTerminal && (
              <TouchableOpacity
                style={styles.sosButton}
                onPress={handleSOS}
                activeOpacity={0.85}
              >
                <MaterialIcons name="local-police" size={20} color="#ffffff" />
                <Text style={styles.sosText}>Emergency SOS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
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
    paddingBottom: 40,
  },
  mapCard: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f3f3f3',
    marginBottom: 16,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  errorText: {
    textAlign: 'center',
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusRef: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  etaPill: {
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  etaPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Driver card
  driverCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 16,
    gap: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  driverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  driverAvatarWrap: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e5e5e5',
  },
  driverAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3ecf8',
  },
  driverRatingBadge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  driverRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  driverVehicle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  plateWrap: {
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f3f3f3',
  },
  plateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1c1c',
    letterSpacing: 1,
  },
  driverDivider: {
    height: 1,
    backgroundColor: '#eeeeee',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 10,
  },
  driverActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5effb',
  },
  driverActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  // Route card
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  routeRail: {
    width: 22,
    alignItems: 'center',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6A1B9A',
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e2e2',
    marginVertical: 6,
  },
  routeSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#1a1c1c',
  },
  routeTextWrap: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  routeSpacing: {
    marginTop: 12,
  },
  // Fare card
  fareCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  fareValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5effb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  // Actions
  actionsRow: {
    gap: 10,
  },
  cancelButton: {
    backgroundColor: '#f3f3f3',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#b91c1c',
  },
  primaryButton: {
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  sosButton: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  sosText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
})

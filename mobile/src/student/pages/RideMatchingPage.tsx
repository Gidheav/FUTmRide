import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  Animated,
  Easing,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../core/api'
import useWalletStore from '../../core/walletStore'
import { showRideStatusNotification } from '../../core/pushNotifications'
import LoadingOverlay from '../components/LoadingOverlay'

type RideMatchingPageProps = {
  rideId?: string | null
  onBack: () => void
  onMatched: () => void
  onCancelled?: () => void
}

const CANCELLED_STATUSES = [
  'cancelled_by_student',
  'cancelled_by_driver',
  'cancelled_no_show',
]

const STATUS_LABELS: Record<string, string> = {
  requested: 'Submitting request…',
  searching: 'Searching for nearby drivers…',
  driver_assigned: 'Driver found!',
  driver_en_route: 'Driver is on the way!',
  cancelled_no_driver: 'Still searching for a driver…',
  cancelled_by_student: 'You cancelled this ride.',
  cancelled_by_driver: 'Driver cancelled the ride.',
  cancelled_no_show: 'Ride cancelled — no show.',
}

export default function RideMatchingPage({ rideId, onBack, onMatched, onCancelled }: RideMatchingPageProps) {
  const insets = useSafeAreaInsets()
  const [ride, setRide] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const lastStatusRef = useRef<string | null>(null)

  // Radar pulse animation
  const pulseAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [pulseAnim])

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] })
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 0.2, 0] })

  // Poll ride status
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
        const data = response.data
        setRide(data)
        setLoading(false)
        setError(null)

        const status = data?.status
        if (status) {
          const isInitial = lastStatusRef.current === null
          if (isInitial || lastStatusRef.current !== status) {
            lastStatusRef.current = status
            const message = STATUS_LABELS[status] || 'Ride status updated.'
            void showRideStatusNotification('Ride update', message, {
              ride_id: String(data?.id || ''),
              ride_status: status,
            }, 'ride-status-alert', { sticky: true, silent: false })
          }
        }
        if (CANCELLED_STATUSES.includes(status)) {
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
  }, [rideId]) // intentionally exclude onMatched to avoid re-registering


  const handleCancel = async () => {
    if (!rideId) {
      onBack()
      return
    }
    setCancelling(true)
    try {
      await api.post(`rides/${rideId}/cancel/`, { reason: 'Student cancelled while searching.' })
      // Sync wallet balance to reflect any potential refund
      useWalletStore.getState().syncBalance()
      // Ride actually cancelled — tell parent to clear ride state
      if (onCancelled) onCancelled()
      else onBack()
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Unable to cancel ride.'
      setError(String(message))
      setCancelling(false)
    }
  }

  const handleViewDriver = () => {
    if (!isFound) return
    onMatched()
  }

  const rideStatus = ride?.status || 'searching'
  const isCancelled = CANCELLED_STATUSES.includes(rideStatus)
  const isFound = rideStatus === 'driver_assigned' || rideStatus === 'driver_en_route'
  const pickupLabel = ride?.pickup_address || '—'
  const dropoffLabel = ride?.dropoff_address || '—'
  const fareLabel = ride?.total_fare ? `₦${Number(ride.total_fare).toLocaleString()}` : '—'
  const vehicleLabel = ride?.vehicle_type_requested
    ? String(ride.vehicle_type_requested).replace(/_/g, ' ')
    : '—'
  const seatsLabel = ride?.requested_seats ? `${ride.requested_seats} seat${ride.requested_seats > 1 ? 's' : ''}` : '—'
  const statusMessage = STATUS_LABELS[rideStatus] || 'Looking for a driver…'

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finding Your Ride</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Radar / status area */}
      <ImageBackground
        source={{
          uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAU4SAdl3a8Hfo8n5lP8rQ5YdOKd8674FWiyZDXWHvEGRmvU9HDn0fTcade8FdZ2Kt5x3jSNUDl3lyXF2w2geOmiAl0Aj0B_41G5F8uRvSuf06uqp_lZSnSPT9G5_uV1pqKQbYGZUkBeP9PxT96eZTYO67i8S4N85AnFm0mzuqQ6sUXbbK5jdVpiX_BNRU58HSskHCIPbPYVY_hbiULUflUrWm7v8zUVHiSXuiwmUkCHCRa_xdH_AP1DXoqiyOzd-ryyXUQygOz79o',
        }}
        style={styles.radarSection}
        resizeMode="cover"
      >
        {!isCancelled && !isFound && (
          <>
            <Animated.View
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
              ]}
            />
            <View style={styles.radarCenter}>
              <MaterialIcons name="search" size={32} color="#ffffff" />
            </View>
          </>
        )}

        {isFound && (
          <View style={[styles.radarCenter, { backgroundColor: '#2e7d32' }]}>
            <MaterialIcons name="check" size={32} color="#ffffff" />
          </View>
        )}

        {isCancelled && (
          <View style={[styles.radarCenter, { backgroundColor: '#b91c1c' }]}>
            <MaterialIcons name="close" size={32} color="#ffffff" />
          </View>
        )}

        <Text style={[styles.statusText, isFound && { color: '#2e7d32' }, isCancelled && { color: '#b91c1c' }]}>
          {statusMessage}
        </Text>

        {loading && (
          <View style={styles.loadingRow}>
            <LoadingOverlay visible={true} inline size={24} />
            <Text style={styles.loadingText}>Connecting…</Text>
          </View>
        )}
      </ImageBackground>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <View style={styles.handle}>
          <View style={styles.handleBar} />
        </View>

        <View style={styles.sheetBody}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Fare & vehicle info */}
          <View style={styles.grid}>
            <View style={styles.gridCard}>
              <MaterialIcons name="payments" size={24} color="#6A1B9A" />
              <Text style={styles.gridLabel}>EST. FARE</Text>
              <Text style={styles.gridValue}>{fareLabel}</Text>
            </View>
            <View style={styles.gridCard}>
              <MaterialIcons name="directions-car" size={24} color="#6A1B9A" />
              <Text style={styles.gridLabel}>VEHICLE</Text>
              <Text style={[styles.gridValue, { fontSize: 14, textTransform: 'capitalize' }]}>{vehicleLabel}</Text>
            </View>
            <View style={styles.gridCard}>
              <MaterialIcons name="event-seat" size={24} color="#6A1B9A" />
              <Text style={styles.gridLabel}>SEATS</Text>
              <Text style={styles.gridValue}>{seatsLabel}</Text>
            </View>
          </View>

          {/* Route card */}
          <View style={styles.routeCard}>
            <View style={styles.routeRail}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <View style={styles.routeSquare} />
            </View>
            <View style={styles.routeText}>
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

          {/* Actions */}
          {isCancelled ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                if (onCancelled) onCancelled()
                else onBack()
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
            </TouchableOpacity>
          ) : isFound ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleViewDriver} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>View Driver</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cancelButton, cancelling && { opacity: 0.6 }]}
              onPress={handleCancel}
              activeOpacity={0.85}
              disabled={cancelling}
            >
              <Text style={styles.cancelText}>{cancelling ? 'Cancelling…' : 'Cancel Request'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
  radarSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: '#6A1B9A',
  },
  radarCenter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1c1c',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  handle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handleBar: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e2e2e2',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  errorText: {
    textAlign: 'center',
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#faf7fd',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ede5f5',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  gridLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
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
  routeText: {
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
  cancelButton: {
    backgroundColor: '#f3f3f3',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
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
})

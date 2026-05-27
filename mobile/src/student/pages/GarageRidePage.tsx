import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
              const status = err?.response?.status
              const payload = err?.response?.data
              const apiMessage = payload?.error?.message || payload?.detail
              const apiCode = payload?.error?.code
              const msg = apiMessage || 'Unable to board this ride.'
              const details = apiCode ? `${msg}
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../core/api'
              Alert.alert('Boarding Failed', details)
              console.warn('garage_board_failed', { status, payload })
import useWalletStore from '../../core/walletStore'

type GarageRidePageProps = {
  qrToken: string
  onClose: () => void
  onBoarded?: () => void
}

type GarageRideData = {
  id: string
  reference: string
  qr_token: string
  driver: {
    id: string
    full_name: string
    profile_photo: string | null
    vehicle_type: string | null
    vehicle_make: string | null
    vehicle_model: string | null
    vehicle_color: string | null
    plate_number: string | null
    average_rating: string | null
  }
  origin_address: string
  destination_address: string
  vehicle_type: string
  total_seats: number
  booked_seats: number
  available_seats: number
  fare_per_seat: string
  status: string
  driver_note: string
  can_board: boolean
  is_expired: boolean
  already_boarded?: boolean
  created_at: string
}

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  open: { label: 'Accepting Passengers', color: '#2e7d32', icon: 'check-circle' },
  full: { label: 'Vehicle Full', color: '#E65100', icon: 'no-transfer' },
  departed: { label: 'Departed', color: '#6b7280', icon: 'directions-bus' },
  cancelled: { label: 'Cancelled', color: '#b91c1c', icon: 'cancel' },
}

export default function GarageRidePage({ qrToken, onClose, onBoarded }: GarageRidePageProps) {
  const insets = useSafeAreaInsets()
  const [ride, setRide] = useState<GarageRideData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [boarding, setBoarding] = useState(false)
  const [boardingSuccess, setBoardingSuccess] = useState(false)
  const [seats, setSeats] = useState(1)

  const walletBalance = useWalletStore((s) => s.walletBalance)

  const fetchRide = useCallback(async () => {
    try {
      const res = await api.get(`rides/garage/scan/${qrToken}/`)
      setRide(res.data)
      setError(null)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.detail || 'Invalid or expired QR code.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [qrToken])

  useEffect(() => {
    void fetchRide()
  }, [fetchRide])

  const handleBoard = async () => {
    if (!ride) return

    const totalCost = Number(ride.fare_per_seat) * seats
    if (walletBalance !== null && Number(walletBalance) < totalCost) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₦${totalCost.toLocaleString()} but your wallet has ₦${Number(walletBalance).toLocaleString()}.`,
      )
      return
    }

    Alert.alert(
      'Confirm Payment',
      `Pay ₦${totalCost.toLocaleString()} for ${seats} seat${seats > 1 ? 's' : ''}?\n\n${ride.origin_address} → ${ride.destination_address}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay & Board',
          onPress: async () => {
            setBoarding(true)
            try {
              await api.post(`rides/garage/scan/${qrToken}/board/`, { seats })
              useWalletStore.getState().syncBalance()
              setBoardingSuccess(true)
              // Refresh ride data to show updated seat count
              void fetchRide()
            } catch (err: any) {
              const msg =
                err?.response?.data?.error?.message || 'Unable to board this ride.'
              Alert.alert('Boarding Failed', msg)
            } finally {
              setBoarding(false)
            }
          },
        },
      ]
    )
  }

  const formatAmount = (v: string | number) =>
    `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`

  const statusCfg = STATUS_DISPLAY[ride?.status || ''] || STATUS_DISPLAY.open
  const totalCost = ride ? Number(ride.fare_per_seat) * seats : 0
  const maxSeats = ride ? Math.min(ride.available_seats, 6) : 1

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#6A1B9A" />
            <Text style={styles.loadingText}>Loading ride details…</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorWrap}>
            <View style={styles.errorIcon}>
              <MaterialIcons name="error-outline" size={48} color="#b91c1c" />
            </View>
            <Text style={styles.errorTitle}>Invalid QR Code</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onClose}>
              <Text style={styles.retryText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Success state ──────────────────────────────────────────── */}
        {boardingSuccess && ride && (
          <View style={styles.successWrap}>
            <View style={styles.successIconWrap}>
              <MaterialIcons name="check-circle" size={56} color="#2e7d32" />
            </View>
            <Text style={styles.successTitle}>You're Boarded!</Text>
            <Text style={styles.successBody}>
              {seats} seat{seats > 1 ? 's' : ''} reserved on{' '}
              {ride.origin_address} → {ride.destination_address}
            </Text>
            <Text style={styles.successRef}>Ref: {ride.reference}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={onBoarded || onClose}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Ride details ───────────────────────────────────────────── */}
        {ride && !boardingSuccess && !error && (
          <>
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusCfg.color + '14' }]}>
              <View style={[styles.statusIconWrap, { backgroundColor: statusCfg.color }]}>
                <MaterialIcons name={statusCfg.icon} size={20} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, { color: statusCfg.color }]}>
                  {statusCfg.label}
                </Text>
                <Text style={styles.statusRef}>Ref: {ride.reference}</Text>
              </View>
              <View style={styles.seatsBadge}>
                <Text style={styles.seatsBadgeText}>
                  {ride.available_seats}/{ride.total_seats}
                </Text>
                <Text style={styles.seatsBadgeLabel}>seats left</Text>
              </View>
            </View>

            {/* Already boarded notice */}
            {ride.already_boarded && (
              <View style={styles.alreadyBoardedBanner}>
                <MaterialIcons name="info" size={18} color="#1565C0" />
                <Text style={styles.alreadyBoardedText}>
                  You've already paid for this ride.
                </Text>
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
                  <Text style={styles.routeLabel}>From</Text>
                  <Text style={styles.routeValue}>{ride.origin_address}</Text>
                </View>
                <View style={styles.routeSpacing}>
                  <Text style={styles.routeLabel}>To</Text>
                  <Text style={styles.routeValue}>{ride.destination_address}</Text>
                </View>
              </View>
            </View>

            {/* Driver card */}
            <View style={styles.driverCard}>
              <View style={styles.driverRow}>
                <View style={styles.driverAvatarWrap}>
                  <MaterialIcons name="person" size={28} color="#6A1B9A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{ride.driver.full_name}</Text>
                  <Text style={styles.driverVehicle}>
                    {[ride.driver.vehicle_color, ride.driver.vehicle_make, ride.driver.vehicle_model]
                      .filter(Boolean)
                      .join(' ') || ride.vehicle_type}
                  </Text>
                </View>
                {ride.driver.plate_number && (
                  <View style={styles.plateWrap}>
                    <Text style={styles.plateText}>{ride.driver.plate_number}</Text>
                  </View>
                )}
              </View>
              {ride.driver.average_rating && (
                <View style={styles.ratingRow}>
                  <MaterialIcons name="star" size={14} color="#F9A825" />
                  <Text style={styles.ratingText}>{ride.driver.average_rating} rating</Text>
                </View>
              )}
            </View>

            {/* Fare card */}
            <View style={styles.fareCard}>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Fare per seat</Text>
                <Text style={styles.fareValue}>{formatAmount(ride.fare_per_seat)}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Vehicle</Text>
                <Text style={styles.fareHint}>{ride.vehicle_type.replace(/_/g, ' ')}</Text>
              </View>
            </View>

            {/* Driver note */}
            {ride.driver_note ? (
              <View style={styles.noteCard}>
                <MaterialIcons name="info-outline" size={16} color="#6A1B9A" />
                <Text style={styles.noteText}>{ride.driver_note}</Text>
              </View>
            ) : null}

            {/* Seat selector + Pay */}
            {ride.can_board && !ride.already_boarded && (
              <View style={styles.paySection}>
                <View style={styles.seatRow}>
                  <Text style={styles.seatLabel}>Seats</Text>
                  <View style={styles.seatControls}>
                    <TouchableOpacity
                      style={[styles.seatButton, seats <= 1 && styles.seatButtonDisabled]}
                      onPress={() => setSeats((p) => Math.max(1, p - 1))}
                      disabled={seats <= 1}
                    >
                      <MaterialIcons name="remove" size={18} color={seats <= 1 ? '#bdbdbd' : '#1a1c1c'} />
                    </TouchableOpacity>
                    <Text style={styles.seatValue}>{seats}</Text>
                    <TouchableOpacity
                      style={[styles.seatButton, seats >= maxSeats && styles.seatButtonDisabled]}
                      onPress={() => setSeats((p) => Math.min(maxSeats, p + 1))}
                      disabled={seats >= maxSeats}
                    >
                      <MaterialIcons name="add" size={18} color={seats >= maxSeats ? '#bdbdbd' : '#1a1c1c'} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.seatHint}>Max {maxSeats}</Text>
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{formatAmount(totalCost)}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.payButton, boarding && { opacity: 0.6 }]}
                  onPress={handleBoard}
                  disabled={boarding}
                  activeOpacity={0.85}
                >
                  {boarding ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <MaterialIcons name="account-balance-wallet" size={18} color="#ffffff" />
                      <Text style={styles.payButtonText}>Pay & Board</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Expired / closed state */}
            {(ride.is_expired || ride.status !== 'open') && !ride.already_boarded && (
              <View style={styles.closedBanner}>
                <MaterialIcons name="block" size={18} color="#b91c1c" />
                <Text style={styles.closedText}>
                  {ride.is_expired
                    ? 'This QR code has expired.'
                    : `This ride is ${ride.status}. No more boarding.`}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f9f9f9' },
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
  headerSpacer: { width: 36 },
  content: { padding: 20, paddingBottom: 40 },

  // Loading
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  loadingText: { fontSize: 14, color: '#6b7280' },

  // Error
  errorWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1c' },
  errorBody: { fontSize: 14, color: '#6b7280', textAlign: 'center', paddingHorizontal: 20 },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retryText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  // Success
  successWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  successIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#2e7d32' },
  successBody: { fontSize: 14, color: '#6b7280', textAlign: 'center', paddingHorizontal: 20 },
  successRef: { fontSize: 12, color: '#9ca3af' },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

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
  statusLabel: { fontSize: 15, fontWeight: '700' },
  statusRef: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  seatsBadge: { alignItems: 'center' },
  seatsBadgeText: { fontSize: 18, fontWeight: '700', color: '#1a1c1c' },
  seatsBadgeLabel: { fontSize: 10, color: '#6b7280' },

  // Already boarded
  alreadyBoardedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e3f2fd',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  alreadyBoardedText: { fontSize: 13, fontWeight: '600', color: '#1565C0', flex: 1 },

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
  routeRail: { width: 22, alignItems: 'center' },
  routeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6A1B9A' },
  routeLine: { width: 2, flex: 1, backgroundColor: '#e2e2e2', marginVertical: 6 },
  routeSquare: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#1a1c1c' },
  routeTextWrap: { flex: 1, justifyContent: 'space-between' },
  routeLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 2 },
  routeValue: { fontSize: 14, fontWeight: '600', color: '#1a1c1c' },
  routeSpacing: { marginTop: 12 },

  // Driver card
  driverCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 16,
    gap: 10,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3ecf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: { fontSize: 15, fontWeight: '700', color: '#1a1c1c' },
  driverVehicle: { fontSize: 12, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' },
  plateWrap: {
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f3f3f3',
  },
  plateText: { fontSize: 13, fontWeight: '700', color: '#1a1c1c', letterSpacing: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, color: '#6b7280' },

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
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  fareValue: { fontSize: 18, fontWeight: '700', color: '#1a1c1c' },
  fareHint: { fontSize: 14, fontWeight: '600', color: '#1a1c1c', textTransform: 'capitalize' },

  // Driver note
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#faf7fd',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ede5f5',
    marginBottom: 16,
  },
  noteText: { flex: 1, fontSize: 13, color: '#6b7280', lineHeight: 18 },

  // Pay section
  paySection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 16,
    gap: 16,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seatLabel: { fontSize: 14, fontWeight: '600', color: '#1a1c1c' },
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
  seatButtonDisabled: { backgroundColor: '#efefef' },
  seatValue: { fontSize: 16, fontWeight: '700', color: '#1a1c1c', minWidth: 20, textAlign: 'center' },
  seatHint: { fontSize: 12, color: '#8b8b8b' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1a1c1c' },
  totalValue: { fontSize: 22, fontWeight: '700', color: '#6A1B9A' },

  payButton: {
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  // Closed/expired
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  closedText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#b91c1c' },
})

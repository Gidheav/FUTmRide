import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native'
import { MaterialIcons, FontAwesome } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

type Rider = {
  id: string
  user: { id: string; first_name: string; last_name: string; profile_photo?: string | null }
  pickup_address: string
  distance_km: string | null
  fare_share: string | null
  status: 'invited' | 'joined' | 'confirmed' | 'cancelled'
}

type SharedRide = {
  id: string
  reference: string
  share_code: string
  creator: { id: string; first_name: string; last_name: string }
  vehicle_type: string
  vehicle_type_label: string
  dropoff_address: string
  max_riders: number
  status: string
  expires_at: string
  created_at: string
  riders: Rider[]
  anchor_fare: string | null
  anchor_distance_km: string | null
  total_collected: string | null
  driver_earnings: string | null
}

type Props = {
  shareCode: string
  initialRide?: SharedRide | null
  onClose: () => void
  onEditPickup?: () => void
  hideTopInset?: boolean
}

// Uses the Render backend domain which we already own.
// lrride-server.onrender.com/share/CODE is a real HTTPS link — WhatsApp renders it as
// a clickable link. Tapping it loads a redirect page on the backend that bounces
// the user into the app via the lrride:// custom URL scheme.
const SHARE_BASE_URL = 'https://lrride-server.onrender.com/share/'

const STATUS_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  invited: 'hourglass-empty',
  joined: 'person',
  confirmed: 'check-circle',
  cancelled: 'cancel',
}
const STATUS_COLOR: Record<string, string> = {
  invited: '#f59e0b',
  joined: '#3b82f6',
  confirmed: '#10b981',
  cancelled: '#9ca3af',
}

function formatRideStatus(status: string) {
  if (!status) return ''
  if (status === 'gathering') return 'Waiting'
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}


function getVehicleIcon(type: string): keyof typeof MaterialIcons.glyphMap {
  const t = (type || '').toLowerCase()
  if (t.includes('bike') || t.includes('motor')) return 'motorcycle'
  if (t.includes('bus') || t.includes('shuttle')) return 'directions-bus'
  if (t.includes('keke') || t.includes('tricycle')) return 'electric-rickshaw'
  return 'directions-car'
}

export default function SharedRideLobbyPage({ shareCode, initialRide, onClose, onEditPickup, hideTopInset = false }: Props) {
  const insets = useSafeAreaInsets()
  const [ride, setRide] = useState<SharedRide | null>(initialRide || null)
  const [loading, setLoading] = useState(!initialRide)
  const [dispatching, setDispatching] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRide = useCallback(async (silent = false) => {
    if (!silent && !ride) setLoading(true)
    try {
      const res = await api.get(`rides/shared/${shareCode}/`)
      setRide(res.data)
    } catch (e: any) {
      if (!ride) {
        Alert.alert('Error', 'Could not load shared ride.')
      }
    } finally {
      setLoading(false)
    }
  }, [shareCode, ride])

  useEffect(() => {
    fetchRide(true) // first fetch can be silent if we already have initialRide, otherwise it will set loading to true internally
    // Poll every 5s while gathering or matching
    pollRef.current = setInterval(() => fetchRide(true), 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchRide])



  // Stop polling if ride is no longer live
  useEffect(() => {
    if (ride && !['gathering', 'matching'].includes(ride.status)) {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [ride?.status])

  const shareLink = `${SHARE_BASE_URL}${shareCode}`

  const handleShare = async () => {
    try {
      await Share.share({
        message: [
          `🚗 Join my shared ride to ${ride?.dropoff_address || 'our destination'}!`,
          ``,
          `📌 Share Code: *${shareCode}*`,
          ``,
          `Open the FUTMRide app and enter this code in the "Shared" tab → "Have a share code?", or scan my code from your Dashboard.`,
        ].join('\n'),
        title: 'Join my shared ride on FUTMRide',
      })
    } catch (e) {
      console.warn('Share error', e)
    }
  }

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      [
        `🚗 Join my shared ride to *${ride?.dropoff_address || 'our destination'}*!`,
        ``,
        `📌 Share Code: *${shareCode}*`,
        ``,
        `Open the FUTMRide app and enter this code in the "Shared" tab → "Have a share code?", or scan my code from your Dashboard.`,
      ].join('\n')
    )
    Linking.openURL(`https://wa.me/?text=${msg}`)
  }

  const handleCopyCode = () => {
    Clipboard.setString(shareCode)
    Alert.alert('Copied!', `Share code ${shareCode} copied to clipboard.`)
  }

  const handleDispatch = async () => {
    Alert.alert(
      'Dispatch Ride',
      'This will lock the shared ride and send it to available drivers. Riders who have not confirmed will be excluded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dispatch',
          onPress: async () => {
            try {
              setDispatching(true)
              await api.post(`rides/shared/${ride?.id}/dispatch/`)
              await fetchRide()
              Alert.alert('Dispatched!', 'Your ride is now being matched with a driver.')
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error?.message || 'Could not dispatch ride.')
            } finally {
              setDispatching(false)
            }
          },
        },
      ]
    )
  }

  const { user } = useAuthStore()

  const handleCancelRide = async () => {
    Alert.alert(
      'Cancel Shared Ride',
      'Are you sure you want to cancel this shared ride? Any confirmed riders will be refunded.',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`rides/shared/${ride?.id}/cancel/`)
              Alert.alert('Cancelled', 'The shared ride has been cancelled.')
              onClose()
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error?.message || 'Could not cancel ride.')
            }
          },
        },
      ]
    )
  }

  const handleLeaveRide = async () => {
    Alert.alert(
      'Leave Ride',
      'Are you sure you want to leave this shared ride?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`rides/shared/${ride?.id}/cancel/`)
              onClose()
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error?.message || 'Could not leave ride.')
            }
          },
        },
      ]
    )
  }

  const handleConfirmAndPay = async () => {
    setConfirming(true)
    try {
      await api.post(`rides/shared/${ride?.id}/confirm/`)
      await fetchRide(true)
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to confirm. Check wallet balance.')
    } finally {
      setConfirming(false)
    }
  }

  const isCreator = ride?.creator.id === user?.id
  const myRider = ride?.riders.find(r => r.user.id === user?.id)
  const activeRiders = ride?.riders.filter(r => r.status !== 'cancelled') || []
  const confirmedCount = activeRiders.filter(r => r.status === 'confirmed').length
  const canDispatch = isCreator && ride?.status === 'gathering' && confirmedCount >= 1

  const isGathering = ride?.status === 'gathering'
  const isMatching = ride?.status === 'matching'
  const isMatched = ride?.status === 'matched'

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6A1B9A" />
        <Text style={styles.loadingText}>Loading lobby…</Text>
      </View>
    )
  }

  if (!ride) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialIcons name="error-outline" size={48} color="#e0e0e0" />
        <Text style={styles.errorText}>Could not load ride</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onClose}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: hideTopInset ? 0 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shared Ride</Text>
        <Text style={[
          styles.headerStatus,
          isGathering ? { color: '#f59e0b' } : isMatching ? { color: '#3b82f6' } : { color: '#10b981' }
        ]}>
          {formatRideStatus(ride.status)}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>

          <View style={styles.compactDestinationRow}>
            <MaterialIcons name="place" size={20} color="#6A1B9A" />
            <Text style={styles.destinationText}>{ride.dropoff_address}</Text>
          </View>
          <View style={styles.compactMetaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name={getVehicleIcon(ride.vehicle_type)} size={16} color="#6b7280" />
              <Text style={styles.compactMetaText}>{ride.vehicle_type_label}</Text>
            </View>
            <Text style={styles.compactMetaDot}>•</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="group" size={16} color="#6b7280" />
              <Text style={styles.compactMetaText}>{activeRiders.length}/{ride.max_riders}</Text>
            </View>
            <Text style={styles.compactMetaDot}>•</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="check-circle" size={16} color="#10b981" />
              <Text style={[styles.compactMetaText, { color: '#10b981' }]}>{confirmedCount}</Text>
            </View>
          </View>

          {isGathering && isCreator && (
            <>
              <View style={styles.divider} />

              <View style={styles.qrContainer}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareCode)}` }}
                  style={styles.qrImage}
                />
                <View style={styles.codeBadge}>
                  <Text style={styles.shareCodeText}>{shareCode}</Text>

                  <View style={styles.inlineActionDivider} />

                  <TouchableOpacity style={styles.iconBtn} onPress={handleCopyCode} activeOpacity={0.8}>
                    <MaterialIcons name="content-copy" size={20} color="#6A1B9A" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
                    <FontAwesome name="whatsapp" size={22} color="#25D366" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.8}>
                    <MaterialIcons name="share" size={22} color="#6A1B9A" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.qrHint}>Scan to join instantly</Text>
              </View>
            </>
          )}

          <View style={styles.divider} />

          <Text style={styles.cardLabel}>CO-RIDERS</Text>
          {activeRiders.map((rider, i) => (
            <View key={rider.id} style={[styles.riderRow, i < activeRiders.length - 1 && styles.riderRowBorder]}>
              <View style={[styles.riderAvatar, { backgroundColor: STATUS_COLOR[rider.status] + '22' }]}>
                {rider.user.profile_photo ? (
                  <Image source={{ uri: rider.user.profile_photo }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                  <Text style={[styles.riderAvatarText, { color: STATUS_COLOR[rider.status] }]}>
                    {rider.user.first_name[0]}{rider.user.last_name[0]}
                  </Text>
                )}
              </View>
              <View style={styles.riderInfo}>
                <Text style={styles.riderName}>
                  {rider.user.first_name} {rider.user.last_name}
                </Text>
                {rider.pickup_address ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MaterialIcons name="trip-origin" size={12} color="#8b5cf6" />
                    <Text style={[styles.riderPickup, { marginTop: 0, flex: 1 }]} numberOfLines={1}>{rider.pickup_address}</Text>
                  </View>
                ) : null}
                {rider.distance_km && (
                  <Text style={styles.riderDist}>{parseFloat(rider.distance_km).toFixed(1)} km away</Text>
                )}
              </View>
              <View style={styles.riderFareCol}>
                {rider.fare_share && (
                  <Text style={styles.riderFare}>₦{parseFloat(rider.fare_share).toLocaleString()}</Text>
                )}
                <MaterialIcons
                  name={STATUS_ICON[rider.status] || 'person'}
                  size={18}
                  color={STATUS_COLOR[rider.status]}
                />
              </View>
            </View>
          ))}

          {activeRiders.length === 0 && (
            <Text style={styles.noRidersText}>No riders yet. Share the code above.</Text>
          )}

          {ride.anchor_fare && (
            <>
              <View style={styles.divider} />
              <Text style={styles.cardLabel}>FARE BREAKDOWN</Text>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Anchor fare (longest leg)</Text>
                <Text style={styles.fareValue}>₦{parseFloat(ride.anchor_fare).toLocaleString()}</Text>
              </View>
              {ride.total_collected && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Total collected</Text>
                  <Text style={[styles.fareValue, { color: '#10b981', fontWeight: '700' }]}>
                    ₦{parseFloat(ride.total_collected).toLocaleString()}
                  </Text>
                </View>
              )}
              {ride.driver_earnings && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Driver earnings</Text>
                  <Text style={styles.fareValue}>₦{parseFloat(ride.driver_earnings).toLocaleString()}</Text>
                </View>
              )}
            </>
          )}

          {isGathering && (
            <>
              {canDispatch && (
                <>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={[styles.dispatchBtn, dispatching && styles.dispatchBtnDisabled]}
                    onPress={handleDispatch}
                    disabled={dispatching}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="send" size={18} color="#fff" />
                    <Text style={styles.dispatchBtnText}>
                      {dispatching ? 'Dispatching…' : 'Dispatch Ride Now'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.dispatchHint}>
                    {canDispatch
                      ? `${confirmedCount} rider(s) confirmed. You can dispatch now or wait for more.`
                      : 'Waiting for at least one other rider to confirm before dispatching.'}
                  </Text>
                </>
              )}

              {isCreator && (
                <>
                  {!canDispatch && <View style={styles.divider} />}
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRide}>
                    <Text style={styles.cancelBtnText}>Cancel Ride</Text>
                  </TouchableOpacity>
                </>
              )}

              {!isCreator && myRider && (
                <View style={styles.riderActionsContainer}>
                  {myRider.status === 'joined' && (
                    <TouchableOpacity
                      style={[styles.acceptBtn, confirming && styles.acceptBtnDisabled]}
                      onPress={handleConfirmAndPay}
                      disabled={confirming}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.acceptBtnText}>{confirming ? 'Processing…' : 'Confirm & Pay'}</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.riderSecondaryActions}>
                    {onEditPickup && myRider.status === 'joined' && (
                      <TouchableOpacity style={styles.editBtn} onPress={onEditPickup} activeOpacity={0.8}>
                        <Text style={styles.editBtnText}>Edit Pickup</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveRide} activeOpacity={0.8}>
                      <Text style={styles.leaveBtnText}>Leave Ride</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {isMatching && (
            <>
              <View style={styles.divider} />
              <View style={styles.matchingCard}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.matchingText}>Searching for an available driver…</Text>
              </View>
            </>
          )}

          {isMatched && (
            <>
              <View style={styles.divider} />
              <View style={[styles.matchingCard, { borderColor: '#10b981' }]}>
                <MaterialIcons name="check-circle" size={24} color="#10b981" />
                <Text style={[styles.matchingText, { color: '#10b981' }]}>Driver matched! Check your active ride.</Text>
              </View>
            </>
          )}

        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1a1c1c', marginLeft: 12 },
  headerStatus: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  loadingText: { marginTop: 12, color: '#8b8b8b', fontSize: 14 },
  errorText: { marginTop: 12, color: '#1a1c1c', fontSize: 16, fontWeight: '600' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#6A1B9A', borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  content: { paddingTop: 4, paddingHorizontal: 0 },

  // Cards & Layout
  card: {
    backgroundColor: '#ffffffff', padding: 16, marginBottom: 0,
    borderWidth: 1, borderColor: '#f0f0f0',
    marginHorizontal: 4, marginTop: 0,
  },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 16 },
  cardLabel: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10,
  },

  // Compact Destination
  compactDestinationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  destinationText: { fontSize: 16, fontWeight: '700', color: '#1a1c1c', flex: 1, lineHeight: 22 },
  compactMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginLeft: 0 },
  compactMetaText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  compactMetaDot: { fontSize: 13, color: '#d1d5db', marginHorizontal: 2 },

  // Share code
  qrContainer: { alignItems: 'center', marginBottom: 16 },
  qrImage: { width: 220, height: 220, marginBottom: 16 },
  codeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f5effb', paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24,
  },
  shareCodeText: { fontSize: 20, fontWeight: '900', letterSpacing: 4, color: '#6A1B9A', fontFamily: 'monospace' },
  inlineActionDivider: { width: 1, height: 22, backgroundColor: '#e5d5f5', marginHorizontal: 2 },
  iconBtn: { padding: 4 },
  qrHint: { fontSize: 13, color: '#9ca3af', marginTop: 14, textAlign: 'center' },

  // Riders
  riderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  riderRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  riderAvatar: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  riderAvatarText: { fontSize: 14, fontWeight: '700' },
  riderInfo: { flex: 1 },
  riderName: { fontSize: 14, fontWeight: '600', color: '#1a1c1c' },
  riderPickup: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  riderDist: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  riderFareCol: { alignItems: 'flex-end', gap: 4 },
  riderFare: { fontSize: 14, fontWeight: '700', color: '#1a1c1c' },
  noRidersText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 12 },

  // Fare breakdown
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  fareLabel: { fontSize: 13, color: '#6b7280' },
  fareValue: { fontSize: 13, fontWeight: '600', color: '#1a1c1c' },

  // Actions
  dispatchBtn: {
    backgroundColor: '#6A1B9A', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, borderRadius: 10, gap: 8,
  },
  dispatchBtnDisabled: { backgroundColor: '#c4b0d9' },
  dispatchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dispatchHint: { color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  cancelBtn: { marginTop: 16, alignItems: 'center' },
  cancelBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },

  riderActionsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  acceptBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtnDisabled: { opacity: 0.6 },
  acceptBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  riderSecondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  editBtnText: { color: '#4b5563', fontSize: 15, fontWeight: '600' },
  leaveBtn: {
    flex: 1,
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  leaveBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },

  // Matching
  matchingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#3b82f6',
  },
  matchingText: { fontSize: 14, fontWeight: '600', color: '#3b82f6', flex: 1 },
})

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
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

type Rider = {
  id: string
  user: { id: string; first_name: string; last_name: string }
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
  onClose: () => void
}

// Uses Android App Links so it is clickable in WhatsApp and opens the app directly
// Format: https://futmride.app/share/CODE
const SHARE_BASE_URL = 'https://futmride.app/share/'

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

function formatCountdown(expiresAt: string) {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now())
  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  return diff === 0 ? 'Expired' : `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function SharedRideLobbyPage({ shareCode, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const [ride, setRide] = useState<SharedRide | null>(null)
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [countdown, setCountdown] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRide = useCallback(async () => {
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
  }, [shareCode])

  useEffect(() => {
    fetchRide()
    // Poll every 5s while gathering or matching
    pollRef.current = setInterval(() => fetchRide(), 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchRide])

  // Countdown timer
  useEffect(() => {
    if (!ride?.expires_at) return
    setCountdown(formatCountdown(ride.expires_at))
    timerRef.current = setInterval(() => {
      setCountdown(formatCountdown(ride.expires_at))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [ride?.expires_at])

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
          `Open the FUTMRide app and enter this code in the "Shared" tab → "Have a share code?"`,
          ``,
          `Or tap this link (if app is installed): ${shareLink}`,
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
        `Share Code: *${shareCode}*`,
        ``,
        `Open the *FUTMRide* app → Rides → Shared tab → "Have a share code?" → enter the code above.`,
        ``,
        `_(Tap to open in app if installed: ${shareLink})_`,
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

  const handleConfirmMyShare = async () => {
    Alert.alert(
      'Confirm & Pay',
      `Your share: ₦${myRider ? parseFloat(myRider.fare_share || '0').toLocaleString() : '—'}. This will debit your wallet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setConfirming(true)
              await api.post(`rides/shared/${ride?.id}/confirm/`)
              await fetchRide()
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error?.message || 'Could not confirm payment.')
            } finally {
              setConfirming(false)
            }
          },
        },
      ]
    )
  }

  // Determine current user role — for now use creator comparison
  const myRider = ride?.riders[0] // We'll use first rider as placeholder
  const isCreator = true // The creator is always viewing their own lobby from BookRidePage
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shared Ride Lobby</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <View style={[styles.statusBanner, isGathering && styles.bannerGathering, isMatching && styles.bannerMatching, (isMatched || ride.status === 'in_progress') && styles.bannerMatched]}>
          <MaterialIcons
            name={isGathering ? 'hourglass-empty' : isMatching ? 'search' : 'check-circle'}
            size={20}
            color="#fff"
          />
          <Text style={styles.statusBannerText}>
            {isGathering
              ? `Waiting for friends · ${countdown}`
              : isMatching
              ? 'Finding a driver…'
              : ride.status === 'matched'
              ? 'Driver matched!'
              : ride.status.replace('_', ' ')}
          </Text>
        </View>

        {/* Destination card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>DROP-OFF</Text>
          <View style={styles.destinationRow}>
            <MaterialIcons name="place" size={22} color="#6A1B9A" />
            <Text style={styles.destinationText}>{ride.dropoff_address}</Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <MaterialIcons name="directions-car" size={13} color="#6b7280" />
              <Text style={styles.metaPillText}>{ride.vehicle_type_label}</Text>
            </View>
            <View style={styles.metaPill}>
              <MaterialIcons name="group" size={13} color="#6b7280" />
              <Text style={styles.metaPillText}>{activeRiders.length}/{ride.max_riders} joined</Text>
            </View>
            <View style={styles.metaPill}>
              <MaterialIcons name="check-circle" size={13} color="#10b981" />
              <Text style={[styles.metaPillText, { color: '#10b981' }]}>{confirmedCount} confirmed</Text>
            </View>
          </View>
        </View>

        {/* Share code card */}
        {isGathering && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SHARE CODE</Text>
            <View style={styles.codeRow}>
              <Text style={styles.shareCode}>{shareCode}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode} activeOpacity={0.8}>
                <MaterialIcons name="content-copy" size={18} color="#6A1B9A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.codeHint}>Friends can enter this code in the app's Shared tab to join.</Text>

            {/* Share actions */}
            <View style={styles.shareActionsRow}>
              <TouchableOpacity style={styles.shareActionBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
                <Text style={styles.shareActionIcon}>💬</Text>
                <Text style={styles.shareActionText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareActionBtn} onPress={handleShare} activeOpacity={0.8}>
                <MaterialIcons name="share" size={22} color="#6A1B9A" />
                <Text style={styles.shareActionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareActionBtn} onPress={handleCopyCode} activeOpacity={0.8}>
                <MaterialIcons name="link" size={22} color="#6A1B9A" />
                <Text style={styles.shareActionText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Riders list */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RIDERS</Text>
          {activeRiders.map((rider, i) => (
            <View key={rider.id} style={[styles.riderRow, i < activeRiders.length - 1 && styles.riderRowBorder]}>
              <View style={[styles.riderAvatar, { backgroundColor: STATUS_COLOR[rider.status] + '22' }]}>
                <Text style={[styles.riderAvatarText, { color: STATUS_COLOR[rider.status] }]}>
                  {rider.user.first_name[0]}{rider.user.last_name[0]}
                </Text>
              </View>
              <View style={styles.riderInfo}>
                <Text style={styles.riderName}>
                  {rider.user.first_name} {rider.user.last_name}
                </Text>
                {rider.pickup_address ? (
                  <Text style={styles.riderPickup} numberOfLines={1}>📍 {rider.pickup_address}</Text>
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
        </View>

        {/* Fare breakdown */}
        {ride.anchor_fare && (
          <View style={styles.card}>
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
          </View>
        )}

        {/* Actions */}
        {isGathering && (
          <View style={styles.actionsCard}>
            {canDispatch && (
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
            )}
            <Text style={styles.dispatchHint}>
              {canDispatch
                ? `${confirmedCount} rider(s) confirmed. You can dispatch now or wait for more.`
                : 'Waiting for at least one other rider to confirm before dispatching.'}
            </Text>
          </View>
        )}

        {isMatching && (
          <View style={styles.matchingCard}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.matchingText}>Searching for an available driver…</Text>
          </View>
        )}

        {isMatched && (
          <View style={[styles.matchingCard, { borderColor: '#10b981' }]}>
            <MaterialIcons name="check-circle" size={24} color="#10b981" />
            <Text style={[styles.matchingText, { color: '#10b981' }]}>Driver matched! Check your active ride.</Text>
          </View>
        )}
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#1a1c1c' },
  loadingText: { marginTop: 12, color: '#8b8b8b', fontSize: 14 },
  errorText: { marginTop: 12, color: '#1a1c1c', fontSize: 16, fontWeight: '600' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#6A1B9A', borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  content: { padding: 16 },

  // Status banner
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f59e0b', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14,
  },
  bannerGathering: { backgroundColor: '#f59e0b' },
  bannerMatching: { backgroundColor: '#3b82f6' },
  bannerMatched: { backgroundColor: '#10b981' },
  statusBannerText: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },

  // Cards
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  cardLabel: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10,
  },

  // Destination
  destinationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  destinationText: { fontSize: 16, fontWeight: '700', color: '#1a1c1c', flex: 1, lineHeight: 22 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  metaPillText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },

  // Share code
  codeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  shareCode: {
    fontSize: 28, fontWeight: '900', letterSpacing: 6, color: '#6A1B9A',
    fontFamily: 'monospace', flex: 1,
  },
  copyBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#f5effb', alignItems: 'center', justifyContent: 'center',
  },
  codeHint: { fontSize: 12, color: '#9ca3af', marginBottom: 14 },
  shareActionsRow: { flexDirection: 'row', gap: 8 },
  shareActionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: '#f9f9f9', borderRadius: 12, gap: 4,
    borderWidth: 1, borderColor: '#f0f0f0',
  },
  shareActionIcon: { fontSize: 22 },
  shareActionText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },

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
  actionsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  dispatchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4a148c', borderRadius: 12, paddingVertical: 14, marginBottom: 10,
  },
  dispatchBtnDisabled: { backgroundColor: '#c4b0d9' },
  dispatchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dispatchHint: { fontSize: 12, color: '#8b8b8b', textAlign: 'center', lineHeight: 18 },

  // Matching
  matchingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#3b82f6',
  },
  matchingText: { fontSize: 14, fontWeight: '600', color: '#3b82f6', flex: 1 },
})

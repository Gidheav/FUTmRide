import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../../core/api'
import SharedRideLobbyPage from '../../pages/SharedRideLobbyPage'
import JoinSharedRidePage from '../../pages/JoinSharedRidePage'

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

const STATUS_COLORS: Record<string, string> = {
  gathering: '#f59e0b',
  matching: '#3b82f6',
  matched: '#8b5cf6',
  in_progress: '#10b981',
  completed: '#6b7280',
  cancelled: '#ef4444',
  expired: '#9ca3af',
}

function getVehicleIcon(type: string): keyof typeof MaterialIcons.glyphMap {
  const t = (type || '').toLowerCase()
  if (t.includes('bike') || t.includes('motor')) return 'two-wheeler'
  if (t.includes('bus') || t.includes('shuttle')) return 'directions-bus'
  if (t.includes('keke') || t.includes('tricycle')) return 'electric-rickshaw'
  return 'directions-car'
}

function formatRideStatus(status: string) {
  if (!status) return ''
  if (status === 'gathering') return 'WAITING'
  return status.replace(/_/g, ' ').toUpperCase()
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#6b7280'
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.badgeText, { color }]}>{formatRideStatus(status)}</Text>
    </View>
  )
}

function RideCard({
  ride,
  onPress,
  onDelete,
}: {
  ride: SharedRide
  onPress: () => void
  onDelete?: () => void
}) {
  const joined = ride.riders.filter(r => r.status !== 'cancelled').length
  const confirmed = ride.riders.filter(r => r.status === 'confirmed').length

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardDestination} numberOfLines={1}>
            To: {ride.dropoff_address}
          </Text>
          <Text style={styles.cardCode}>Code: {ride.share_code}</Text>
        </View>
        <StatusBadge status={ride.status} />
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} activeOpacity={0.7}>
            <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <MaterialIcons name={getVehicleIcon(ride.vehicle_type)} size={14} color="#8b8b8b" />
          <Text style={styles.metaText}>{ride.vehicle_type_label}</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialIcons name="group" size={14} color="#8b8b8b" />
          <Text style={styles.metaText}>{joined}/{ride.max_riders} joined · {confirmed} confirmed</Text>
        </View>
        {ride.anchor_fare && (
          <View style={styles.metaItem}>
            <MaterialIcons name="account-balance-wallet" size={14} color="#6A1B9A" />
            <Text style={[styles.metaText, { color: '#6A1B9A', fontWeight: '600' }]}>
              Total: ₦{parseFloat(ride.total_collected || ride.anchor_fare).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

function InviteCard({
  ride,
  myRider,
  onPress,
}: {
  ride: SharedRide
  myRider: Rider
  onPress: () => void
}) {
  const joined = ride.riders.filter(r => r.status !== 'cancelled').length
  const myFare = myRider.fare_share ? `₦${parseFloat(myRider.fare_share).toLocaleString()}` : 'Calculating...'
  const isPending = myRider.status === 'joined'
  const isConfirmed = myRider.status === 'confirmed'

  return (
    <TouchableOpacity style={styles.inviteCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.inviteHeader}>
        <MaterialIcons name="mail-outline" size={20} color="#6A1B9A" />
        <Text style={styles.inviteFrom}>
          Invited by {ride.creator.first_name}
        </Text>
        {isConfirmed
          ? <View style={styles.confirmedBadge}><Text style={styles.confirmedBadgeText}>✓ Confirmed</Text></View>
          : <StatusBadge status={ride.status} />
        }
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 6 }}>
        <MaterialIcons name="place" size={16} color="#ef4444" style={{ marginTop: 2 }} />
        <Text style={[styles.inviteDestination, { marginBottom: 0, flex: 1 }]} numberOfLines={2}>
          {ride.dropoff_address}
        </Text>
      </View>
      <Text style={styles.inviteMeta}>
        {ride.vehicle_type_label} · {joined}/{ride.max_riders} riders
        {myRider.fare_share ? ` · Your share: ${myFare}` : ''}
      </Text>


    </TouchableOpacity>
  )
}

type SharedRideTabProps = {
  currentUserId?: string
  deepLinkShareCode?: string | null
  onDeepLinkConsumed?: () => void
}

export default function SharedRideTab({ currentUserId, deepLinkShareCode, onDeepLinkConsumed }: SharedRideTabProps) {
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [created, setCreated] = useState<SharedRide[]>([])
  const [invited, setInvited] = useState<SharedRide[]>([])
  const [openRide, setOpenRide] = useState<SharedRide | null>(null)
  const [openJoinCode, setOpenJoinCode] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  const fetchRides = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('rides/shared/my/')
      setCreated(res.data.created || [])
      setInvited(res.data.invited || [])
    } catch (e) {
      console.warn('SharedRideTab: fetch error', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchRides()
  }, [fetchRides])

  useEffect(() => {
    if (deepLinkShareCode) {
      setOpenJoinCode(deepLinkShareCode)
      if (onDeepLinkConsumed) onDeepLinkConsumed()
    }
  }, [deepLinkShareCode, onDeepLinkConsumed])

  const handleAccept = async (ride: SharedRide) => {
    setAcceptingId(ride.id)
    try {
      await api.post(`rides/shared/${ride.id}/confirm/`)
      await fetchRides(true)
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to confirm. Check your wallet balance.'
      Alert.alert('Error', msg)
    } finally {
      setAcceptingId(null)
    }
  }

  const handleDecline = async (ride: SharedRide) => {
    Alert.alert('Decline Invitation', 'Are you sure you want to leave this shared ride?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`rides/shared/${ride.id}/cancel/`)
            await fetchRides(true)
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to decline.')
          }
        },
      },
    ])
  }

  const handleDeleteRide = async (ride: SharedRide) => {
    Alert.alert('Delete Ride', 'Are you sure you want to delete this ride from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`rides/shared/${ride.id}/`)
            await fetchRides(true)
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to delete.')
          }
        },
      },
    ])
  }

  const handleJoinCode = () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) {
      Alert.alert('Invalid code', 'Enter a valid share code.')
      return
    }
    setOpenJoinCode(code)
  }

  // Full-screen lobby overlay
  if (openRide) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <SharedRideLobbyPage
          shareCode={openRide.share_code}
          initialRide={openRide}
          onClose={() => { setOpenRide(null); fetchRides(true) }}
          onEditPickup={() => { 
            const code = openRide.share_code; 
            setOpenRide(null); 
            setOpenJoinCode(code); 
          }}
          hideTopInset={true}
        />
      </View>
    )
  }

  // Join via code overlay
  if (openJoinCode) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <JoinSharedRidePage
          initialCode={openJoinCode}
          onClose={() => { setOpenJoinCode(null); fetchRides(true) }}
          hideTopInset={true}
        />
      </View>
    )
  }

  const isEmpty = created.length === 0 && invited.length === 0

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchRides(true) }}
          tintColor="#6A1B9A"
        />
      }
    >
      {/* Join by code */}
      <View style={styles.joinSection}>
        <Text style={styles.joinLabel}>Have a share code?</Text>
        <View style={styles.joinRow}>
          <TextInput
            style={styles.joinInput}
            placeholder="Enter code (e.g. AB3X7F2K)"
            placeholderTextColor="#9c9c9c"
            value={joinCode}
            onChangeText={t => setJoinCode(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={12}
          />
          <TouchableOpacity
            style={[styles.joinBtn, !joinCode.trim() && styles.joinBtnDisabled]}
            onPress={handleJoinCode}
            disabled={!joinCode.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6A1B9A" style={{ marginTop: 48 }} />
      ) : isEmpty ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="group-add" size={52} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No shared rides yet</Text>
          <Text style={styles.emptySub}>
            When you join or share a ride, it will appear here.
          </Text>
        </View>
      ) : (
        <>
          {/* Invitations section */}
          {invited.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="mail" size={15} color="#6A1B9A" /> Invitations ({invited.length})
              </Text>
              {invited.map(ride => {
                const myRider = ride.riders.find(r => r.user.id === currentUserId) || ride.riders[0]
                return (
                  <InviteCard
                    key={ride.id}
                    ride={ride}
                    myRider={myRider}
                    onPress={() => setOpenRide(ride)}
                  />
                )
              })}
            </View>
          )}

          {/* Created rides section */}
          {created.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <MaterialIcons name="directions-car" size={15} color="#6A1B9A" /> My Shared Rides ({created.length})
              </Text>
              {created.map(ride => {
                const canDelete = ['cancelled', 'expired', 'completed'].includes(ride.status)
                return (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    onPress={() => setOpenRide(ride)}
                    onDelete={canDelete ? () => handleDeleteRide(ride) : undefined}
                  />
                )
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  content: { padding:  2},

  // Join section
  joinSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  joinLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 10 },
  joinRow: { flexDirection: 'row', gap: 8 },
  joinInput: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
    letterSpacing: 1.5,
    backgroundColor: '#fafafa',
  },
  joinBtn: {
    backgroundColor: '#6A1B9A',
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnDisabled: { backgroundColor: '#c4b0d9' },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A1B9A',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft:8,
  },

  // Created ride card
  card: {
    backgroundColor: '#fff',
    borderRadius: 2,
    padding: 16,
    marginBottom: 10,
    marginLeft: 2,
    marginRight:2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardDestination: { fontSize: 15, fontWeight: '700', color: '#1a1c1c', flex: 1, marginRight: 8 },
  cardCode: { fontSize: 12, color: '#8b8b8b', marginTop: 2, fontFamily: 'monospace' },
  cardMeta: { gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: '#6b7280' },
  deleteBtn: { paddingLeft: 8, paddingBottom: 8 },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // Invite card
  inviteCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#e9d5f5',
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inviteFrom: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1c1c' },
  inviteDestination: { fontSize: 14, color: '#374151', marginBottom: 6, lineHeight: 20 },
  inviteMeta: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  inviteActions: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  acceptBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#6A1B9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnDisabled: { backgroundColor: '#c4b0d9' },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  confirmedBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confirmedBadgeText: { color: '#059669', fontSize: 11, fontWeight: '700' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1c1c', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
})

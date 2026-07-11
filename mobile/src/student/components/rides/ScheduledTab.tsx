import { useCallback, useEffect, useState, useRef } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import api, { classifyApiError } from '../../../core/api'
import JoinScheduledRideModal from './JoinScheduledRideModal'
import LoadingOverlay from '../LoadingOverlay'

export type MyTicket = {
  id: string
  ticket_ref: string
  status: string
  boarding_stop_name: string | null
  boarding_stop_address: string | null
  alighting_stop_name: string | null
  alighting_stop_address: string | null
  amount_paid: string
  joined_at: string | null
}

export type ScheduledRide = {
  id: string
  reference: string
  departure_date: string
  window_start: string
  window_end: string
  origin_name: string
  origin_address: string
  destination_name: string
  destination_address: string
  status: string
  standard_enabled: boolean
  standard_price: string
  standing_enabled: boolean
  standing_price: string
  passenger_count: number
  is_joinable: boolean
  stops_count: number
  assigned_driver_name: string | null
  is_joined_by_me: boolean
  my_ticket: MyTicket | null
}

const formatTime = (timeStr: string) => {
  // timeStr is like "14:30:00"
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const date = new Date()
  date.setHours(parseInt(h, 10))
  date.setMinutes(parseInt(m, 10))
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ScheduledTab({ isActive }: { isActive?: boolean }) {
  const [rides, setRides] = useState<ScheduledRide[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedRide, setSelectedRide] = useState<ScheduledRide | null>(null)

  const fetchRides = async (silent = false) => {
    try {
      if (!silent) setError(null)
      const res = await api.get('rides/scheduled/available/')
      const raw: ScheduledRide[] = Array.isArray(res.data?.results) ? res.data.results : (res.data || [])
      // Pin joined ride to the top
      const sorted = [...raw].sort((a, b) => {
        if (a.is_joined_by_me && !b.is_joined_by_me) return -1
        if (!a.is_joined_by_me && b.is_joined_by_me) return 1
        return 0
      })
      setRides(sorted)
    } catch (err: any) {
      if (silent) return
      const kind = classifyApiError(err)
      if (kind === 'network') {
        setError('No internet connection. Check your network and pull down to retry.')
      } else if (kind === 'session_expired') {
        setError('Your session has expired. Please log in again.')
      } else {
        setError(err?.response?.data?.detail || 'Failed to load scheduled rides.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const didMountRef = useRef(false)

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      fetchRides()
    } else if (isActive) {
      fetchRides(true) // silent refresh
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive])

  // Background polling to keep rides synchronized with the server automatically
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (isActive) {
      interval = setInterval(() => {
        fetchRides(true)
      }, 10000) // Poll every 10 seconds
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchRides()
  }, [])

  const renderItem = useCallback(({ item }: { item: ScheduledRide }) => {
    const timeRange = `${formatTime(item.window_start)} - ${formatTime(item.window_end)}`
    const isJoined = item.is_joined_by_me

    return (
      <TouchableOpacity 
        style={[styles.card, isJoined && styles.cardJoined]} 
        activeOpacity={0.85}
        onPress={() => setSelectedRide(item)}
      >
        {/* "Your Ride" badge at the top */}
        {isJoined && (
          <View style={styles.yourRideBanner}>
            <MaterialIcons name="check-circle" size={14} color="#ffffff" />
            <Text style={styles.yourRideText}>Your Ride</Text>
          </View>
        )}

        <View style={styles.cardTop}>
          <View style={[styles.timeWrap, isJoined && styles.timeWrapJoined]}>
            <MaterialIcons name="schedule" size={16} color={isJoined ? '#ffffff' : '#6A1B9A'} />
            <Text style={[styles.timeText, isJoined && styles.timeTextJoined]}>{timeRange}</Text>
          </View>
          <View style={[styles.priceWrap, isJoined && styles.priceWrapJoined]}>
            <Text style={[styles.priceText, isJoined && styles.priceTextJoined]}>₦{item.standard_price}</Text>
          </View>
        </View>

        <View style={styles.routeWrap}>
          <View style={[styles.routeLine, isJoined && styles.routeLineJoined]} />
          <View style={styles.routePoint}>
            <View style={[styles.dotOrigin, isJoined && styles.dotOriginJoined]} />
            <Text style={[styles.routeText, isJoined && styles.routeTextJoined]} numberOfLines={1}>{item.origin_name || item.origin_address}</Text>
          </View>
          <View style={[styles.routePoint, { marginTop: 12 }]}>
            <MaterialIcons name="location-pin" size={16} color={isJoined ? '#fbbf24' : '#b91c1c'} style={styles.pinDest} />
            <Text style={[styles.routeText, isJoined && styles.routeTextJoined]} numberOfLines={1}>{item.destination_name || item.destination_address}</Text>
          </View>
        </View>

        {/* Joined ride: show booked stop details */}
        {isJoined && item.my_ticket && (
          <View style={styles.ticketRow}>
            <View style={styles.ticketStop}>
              <MaterialIcons name="hail" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.ticketStopText} numberOfLines={1}>{item.my_ticket.boarding_stop_name || 'First stop'}</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={13} color="rgba(255,255,255,0.6)" />
            <View style={styles.ticketStop}>
              <MaterialIcons name="directions-walk" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.ticketStopText} numberOfLines={1}>{item.my_ticket.alighting_stop_name || 'Last stop'}</Text>
            </View>
          </View>
        )}

        <View style={[styles.divider, isJoined && styles.dividerJoined]} />

        <View style={styles.cardBottom}>
          <View style={styles.metaRow}>
            <MaterialIcons name="person" size={14} color={isJoined ? 'rgba(255,255,255,0.7)' : '#6b7280'} />
            <Text style={[styles.metaText, isJoined && styles.metaTextJoined]}>{item.assigned_driver_name || 'Driver pending'}</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="people" size={14} color={isJoined ? 'rgba(255,255,255,0.7)' : '#6b7280'} />
            <Text style={[styles.metaText, isJoined && styles.metaTextJoined]}>{item.passenger_count} joined</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="map" size={14} color={isJoined ? 'rgba(255,255,255,0.7)' : '#6b7280'} />
            <Text style={[styles.metaText, isJoined && styles.metaTextJoined]}>{item.stops_count} stops</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <LoadingOverlay visible={true} inline size={40} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={rides}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6A1B9A']} />}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <MaterialIcons name="event-busy" size={32} color="#6A1B9A" />
            <Text style={styles.emptyTitle}>No scheduled rides</Text>
            <Text style={styles.emptyText}>There are currently no upcoming scheduled rides available for your campus.</Text>
          </View>
        }
      />

      {selectedRide && (
        <JoinScheduledRideModal
          ride={selectedRide}
          onClose={() => setSelectedRide(null)}
          onJoined={() => {
            setSelectedRide(null)
            fetchRides()
          }}
          onLeft={() => {
            setSelectedRide(null)
            fetchRides()
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    padding: 2,
    paddingHorizontal: 6,
    paddingBottom: 40,
    gap: 2,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginTop: 20,
  },
  emptyTitle: {
    marginTop: 12,
    fontWeight: '700',
    fontSize: 16,
    color: '#1a1c1c',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  // ── Normal card ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  // ── Joined (pinned) card ─────────────────────────────────────────────────────
  cardJoined: {
    backgroundColor: '#6A1B9A',
    borderColor: '#5B1487',
    elevation: 6,
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  yourRideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  yourRideText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(106,27,154,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timeWrapJoined: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A1B9A',
  },
  timeTextJoined: {
    color: '#ffffff',
  },
  priceWrap: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceWrapJoined: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  priceTextJoined: {
    color: '#ffffff',
  },
  routeWrap: {
    paddingLeft: 4,
    position: 'relative',
  },
  routeLine: {
    position: 'absolute',
    left: 11,
    top: 14,
    bottom: 14,
    width: 2,
    backgroundColor: '#e5e7eb',
    zIndex: 0,
  },
  routeLineJoined: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  dotOrigin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6A1B9A',
    borderWidth: 2,
    borderColor: '#ffffff',
    marginLeft: 2,
  },
  dotOriginJoined: {
    backgroundColor: '#ffffff',
    borderColor: '#6A1B9A',
  },
  pinDest: {
    marginLeft: 0,
  },
  routeText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    fontWeight: '500',
  },
  routeTextJoined: {
    color: 'rgba(255,255,255,0.95)',
  },
  // Joined-only stop summary row
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  ticketStop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  ticketStopText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 14,
  },
  dividerJoined: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  metaTextJoined: {
    color: 'rgba(255,255,255,0.75)',
  },
})

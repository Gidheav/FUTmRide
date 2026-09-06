import { useCallback, useEffect, useState, useRef } from 'react'
import { Platform } from 'react-native'
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
  assigned_plate_number: string | null
  assigned_bus_label: string | null
  checked_in_at: string | null
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

const getTimeRemaining = (windowStart: string, windowEnd: string, departureDate: string) => {
  if (!windowStart || !departureDate) return null
  
  // Parse the departure date and window start time
  const [startH, startM] = windowStart.split(':')
  const [endH, endM] = windowEnd.split(':')
  
  const now = new Date()
  const departureDateObj = new Date(departureDate)
  
  // Create date objects for window start and end
  const windowStartObj = new Date(departureDateObj)
  windowStartObj.setHours(parseInt(startH, 10), parseInt(startM, 10), 0, 0)
  
  const windowEndObj = new Date(departureDateObj)
  windowEndObj.setHours(parseInt(endH, 10), parseInt(endM, 10), 0, 0)
  
  // Check if current time is past window end
  if (now > windowEndObj) {
    return { inProgress: false, expired: true, text: 'Started' }
  }
  
  // Check if current time is within window (ride in progress)
  if (now >= windowStartObj) {
    return { inProgress: true, expired: false, text: 'In Progress' }
  }
  
  // Calculate time remaining until window start
  const diffMs = windowStartObj.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const remainingMins = diffMins % 60
  
  if (diffHours > 0) {
    return { inProgress: false, expired: false, text: `${diffHours}h ${remainingMins}m` }
  } else if (diffMins > 0) {
    return { inProgress: false, expired: false, text: `${diffMins}m` }
  } else {
    return { inProgress: false, expired: false, text: '1m' }
  }
}

export default function ScheduledTab({ isActive }: { isActive?: boolean }) {
  const [rides, setRides] = useState<ScheduledRide[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  
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

  // Update current time every minute for countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchRides()
  }, [])

  const renderItem = useCallback(({ item }: { item: ScheduledRide }) => {
    const timeRange = `${formatTime(item.window_start)} - ${formatTime(item.window_end)}`
    const isJoined = item.is_joined_by_me
    const timeRemaining = getTimeRemaining(item.window_start, item.window_end, item.departure_date)

    return (
      <TouchableOpacity 
        style={[styles.card, isJoined && styles.cardJoined]} 
        activeOpacity={0.85}
        onPress={() => setSelectedRide(item)}
      >
        {/* "Your Ride" badge at the top */}
        {isJoined && (
          <View style={styles.yourRideBanner}>
            <View style={styles.yourRideLeft}>
              <MaterialIcons name="check-circle" size={14} color="#ffffff" />
              <Text style={styles.yourRideText}>Your Ride</Text>
            </View>
            {timeRemaining && (
              <View style={[styles.countdownBadge, timeRemaining.inProgress && styles.countdownBadgeRed]}>
                <MaterialIcons name="schedule" size={12} color={timeRemaining.inProgress ? '#ffffff' : 'rgba(255,255,255,0.8)'} />
                <Text style={[styles.countdownText, timeRemaining.inProgress && styles.countdownTextRed]}>
                  {timeRemaining.text}
                </Text>
              </View>
            )}
          </View>
        )}



        <View style={styles.cardTop}>
          <View style={[styles.timeWrap, isJoined && styles.timeWrapJoined]}>
            <MaterialIcons name="schedule" size={16} color={isJoined ? '#ffffff' : '#6A1B9A'} />
            <Text style={[styles.timeText, isJoined && styles.timeTextJoined]}>{timeRange}</Text>
          </View>
          <View style={[styles.priceWrap, isJoined && styles.priceWrapJoined]}>
            <Text style={[styles.priceText, isJoined && styles.priceTextJoined]}>₦{item.standard_price}</Text>
            {item.standing_enabled && (
              <View style={[styles.standingBadge, isJoined && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={[styles.standingBadgeText, isJoined && { color: '#ffffff' }]}>Standing avg.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.routeSection}>
          {/* Main route column */}
          <View style={styles.routeColumn}>
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

          {/* Student stops column - only when joined */}
          {isJoined && item.my_ticket && (
            <View style={styles.stopsColumn}>
              <View style={styles.stopRow}>
                <MaterialIcons name="hail" size={12} color={isJoined ? 'rgba(255,255,255,0.8)' : '#6A1B9A'} />
                <Text style={[styles.stopText, isJoined && styles.stopTextJoined]} numberOfLines={1}>{item.my_ticket.boarding_stop_name || 'First stop'}</Text>
              </View>
              <View style={[styles.stopRow, { marginTop: 8 }]}>
                <MaterialIcons name="directions-walk" size={12} color={isJoined ? 'rgba(255,255,255,0.8)' : '#6A1B9A'} />
                <Text style={[styles.stopText, isJoined && styles.stopTextJoined]} numberOfLines={1}>{item.my_ticket.alighting_stop_name || 'Last stop'}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.divider, isJoined && styles.dividerJoined]} />

        <View style={styles.cardBottom}>
          {/* Vehicle/Driver info - show vehicle when checked in, otherwise driver */}
          <View style={styles.metaRow}>
            <MaterialIcons name="directions-bus" size={14} color={isJoined ? 'rgba(255,255,255,0.7)' : '#6b7280'} />
            <Text style={[styles.metaText, isJoined && styles.metaTextJoined]}>
              {isJoined && item.checked_in_at
                ? (item.assigned_plate_number || item.assigned_bus_label || item.assigned_driver_name || 'Checked in')
                : (item.assigned_driver_name || 'Driver pending')}
            </Text>
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
    paddingHorizontal: 1,
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
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  yourRideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  yourRideText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countdownBadgeRed: {
    backgroundColor: '#dc2626',
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  countdownTextRed: {
    color: '#ffffff',
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
  standingBadge: {
    marginTop: 2,
    backgroundColor: '#E1BEE7',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  standingBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter-Medium',
    color: '#6A1B9A',
  },
  routeSection: {
    flexDirection: 'row',
    gap: 16,
    paddingLeft: 4,
  },
  routeColumn: {
    flex: 1,
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
  stopsColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopText: {
    fontSize: 12,
    color: '#6A1B9A',
    fontWeight: '600',
    flex: 1,
  },
  stopTextJoined: {
    color: 'rgba(255,255,255,0.9)',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 10,
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

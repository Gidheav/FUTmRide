import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../../core/api'
import { ScheduledRide } from './ScheduledTab'
import LoadingOverlay from '../LoadingOverlay'

type Stop = {
  id: string
  order: number
  name: string
  address: string
  estimated_arrival_offset_min: number
  is_pickup: boolean
  is_dropoff: boolean
}

type RideDetail = ScheduledRide & {
  stops: Stop[]
  passenger_count: number
}

type Props = {
  ride: ScheduledRide
  onClose: () => void
  onJoined: () => void
  onLeft: () => void
}

export default function JoinScheduledRideModal({ ride, onClose, onJoined, onLeft }: Props) {
  const [detail, setDetail] = useState<RideDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  
  const [boardingStopId, setBoardingStopId] = useState<string | null>(null)
  const [alightingStopId, setAlightingStopId] = useState<string | null>(null)

  const [pinModalVisible, setPinModalVisible] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<'join' | 'leave' | null>(null)
  const PIN_ROWS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','back']]

  const isLeaveMode = ride.is_joined_by_me

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get(`rides/scheduled/${ride.id}/detail/`)
        const data = res.data
        setDetail(data)
        
        if (!isLeaveMode && data.stops && data.stops.length >= 2) {
          // Intentionally do not auto-select so the user must pick a boarding stop first
        }
      } catch (err) {
        Alert.alert('Error', 'Unable to load ride details.')
        onClose()
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [ride.id, onClose, isLeaveMode])

  const handleJoin = () => {
    if (detail && !detail.is_joinable) {
      Alert.alert('Ride closed', 'This ride is no longer accepting passengers.')
      return
    }
    if (!boardingStopId || !alightingStopId) {
      Alert.alert('Select stops', 'Please select your boarding and alighting stops.')
      return
    }

    setPendingAction('join')
    setPinInput('')
    setPinError('')
    setPinModalVisible(true)
  }

  const doJoin = async () => {
    setWorking(true)
    try {
      await api.post(`rides/scheduled/${ride.id}/join/`, {
        boarding_stop_id: boardingStopId,
        alighting_stop_id: alightingStopId,
      })
      Alert.alert('Booked!', 'You have successfully joined the ride.')
      onJoined()
    } catch (err: any) {
      const respData = err.response?.data

      // Helper: extract a human-readable message from any backend error shape
      const extractMsg = (data: any): string | null => {
        if (!data) return null
        // Envelope: { error: { message, details: { non_field_errors, wallet, ... } } }
        if (data?.error) {
          const inner = data.error
          const details = inner?.details
          return (
            details?.non_field_errors?.[0] ||
            details?.wallet?.[0] ||
            details?.wallet ||
            details?.boarding_stop_id?.[0] ||
            details?.alighting_stop_id?.[0] ||
            inner?.message ||
            null
          )
        }
        // Flat DRF errors
        return (
          data?.non_field_errors?.[0] ||
          data?.wallet?.[0] ||
          data?.wallet ||
          data?.boarding_stop_id?.[0] ||
          data?.alighting_stop_id?.[0] ||
          data?.detail ||
          null
        )
      }

      const msg = extractMsg(respData) || 'Something went wrong. Please try again.'
      Alert.alert('Failed to join', String(msg))
    } finally {
      setWorking(false)
    }
  }

  const handleLeave = () => {
    setPendingAction('leave')
    setPinInput('')
    setPinError('')
    setPinModalVisible(true)
  }

  const doLeave = async () => {
    setWorking(true)
    try {
      await api.post(`rides/scheduled/${ride.id}/leave/`)
      Alert.alert('Left ride', 'You have left the ride. Any applicable refund will be processed.')
      onLeft()
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        'Unable to leave ride.'
      Alert.alert('Failed to leave', String(msg))
    } finally {
      setWorking(false)
    }
  }

  const handlePinDigit = async (digit: string) => {
    if (pinLoading) return
    if (!digit) return
    if (digit === 'back') { setPinInput((p) => p.slice(0, -1)); return }
    setPinError('')
    if (pinInput.length >= 4) return
    const next = `${pinInput}${digit}`
    setPinInput(next)
    if (next.length === 4) {
      setPinLoading(true)
      try {
        await api.post('auth/settings/pin/verify/', { pin: next })
        setPinModalVisible(false)
        setPinInput('')
        if (pendingAction === 'join') {
          void doJoin()
        } else if (pendingAction === 'leave') {
          void doLeave()
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.response?.data?.error?.message || 'Incorrect Transaction PIN.'
        setPinError(String(msg))
        setPinInput('')
      } finally {
        setPinLoading(false)
      }
    }
  }

  return (
    <Modal visible animationType="slide" transparent>
      {/* Full-screen loading overlay */}
      {working && (
        <View style={styles.workingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.workingText}>{isLeaveMode ? 'Leaving ride…' : 'Booking your seat…'}</Text>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={[styles.header, isLeaveMode && styles.headerLeave]}>
            <Text style={[styles.title, isLeaveMode && styles.titleLeave]}>
              {isLeaveMode ? 'Your Booking' : 'Join Ride'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color={isLeaveMode ? '#ffffff' : '#1a1c1c'} />
            </TouchableOpacity>
          </View>

          {loading || !detail ? (
            <View style={styles.loaderWrap}>
              <LoadingOverlay visible={true} inline size={40} />
            </View>
          ) : (
            <>
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                {/* Route summary card */}
                <View style={[styles.infoCard, isLeaveMode && styles.infoCardLeave]}>
                  <View style={styles.infoCardHeader}>
                    <View style={[styles.refBadge, isLeaveMode && styles.refBadgeLeave]}>
                      <Text style={styles.refText}>#{detail.reference}</Text>
                    </View>
                    <View style={styles.passengerBadge}>
                      <MaterialIcons name="people" size={14} color={isLeaveMode ? '#ffffff' : '#6A1B9A'} />
                      <Text style={[styles.passengerText, isLeaveMode && styles.passengerTextLeave]}>{detail.passenger_count} Joined</Text>
                    </View>
                  </View>

                  <View style={styles.routeWrap}>
                    <View style={[styles.routeLine, isLeaveMode && styles.routeLineLeave]} />
                    <View style={styles.routePoint}>
                      <View style={[styles.dotOrigin, isLeaveMode && styles.dotOriginLeave]} />
                      <Text style={[styles.routeAddressText, isLeaveMode && styles.routeAddressTextLeave]} numberOfLines={1}>{detail.origin_name || detail.origin_address}</Text>
                    </View>
                    <View style={[styles.routePoint, { marginTop: 12 }]}>
                      <MaterialIcons name="location-pin" size={16} color={isLeaveMode ? '#fbbf24' : '#b91c1c'} style={styles.pinDest} />
                      <Text style={[styles.routeAddressText, isLeaveMode && styles.routeAddressTextLeave]} numberOfLines={1}>{detail.destination_name || detail.destination_address}</Text>
                    </View>
                  </View>
                </View>

                {/* Leave mode: show my booked stops as read-only info */}
                {isLeaveMode && ride.my_ticket ? (
                  <View style={styles.myTicketCard}>
                    <View style={styles.myTicketRow}>
                      <View style={styles.myTicketStop}>
                        <MaterialIcons name="hail" size={16} color="#6A1B9A" />
                        <View>
                          <Text style={styles.myTicketLabel}>Boarding</Text>
                          <Text style={styles.myTicketValue}>{ride.my_ticket.boarding_stop_name || 'First stop'}</Text>
                        </View>
                      </View>
                      <MaterialIcons name="arrow-forward" size={18} color="#d1d5db" />
                      <View style={styles.myTicketStop}>
                        <MaterialIcons name="directions-walk" size={16} color="#6A1B9A" />
                        <View>
                          <Text style={styles.myTicketLabel}>Alighting</Text>
                          <Text style={styles.myTicketValue}>{ride.my_ticket.alighting_stop_name || 'Last stop'}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.ticketRefRow}>
                      <MaterialIcons name="confirmation-number" size={14} color="#6b7280" />
                      <Text style={styles.ticketRefText}>Ticket: {ride.my_ticket.ticket_ref}</Text>
                      <Text style={styles.ticketAmtText}>₦{ride.my_ticket.amount_paid}</Text>
                    </View>
                  </View>
                ) : !isLeaveMode ? (
                  <>
                    {/* Join mode: stop selectors */}
                    <View style={styles.sectionHeaderRow}>
                      <MaterialIcons name="my-location" size={18} color="#1a1c1c" />
                      <Text style={styles.sectionTitle}>Boarding Stop</Text>
                    </View>
                    
                    <View style={styles.optionsList}>
                      {detail.stops.filter((s) => {
                        if (!s.is_pickup) return false
                        const maxOrder = Math.max(...detail.stops.map(x => x.order))
                        return s.order < maxOrder
                      }).map((stop) => {
                        const isActive = boardingStopId === stop.id
                        return (
                          <TouchableOpacity
                            key={`board-${stop.id}`}
                            style={[styles.stopChip, isActive && styles.stopChipActive]}
                            onPress={() => {
                              if (isActive) {
                                // Deselect if tapped again
                                setBoardingStopId(null)
                                setAlightingStopId(null)
                              } else {
                                setBoardingStopId(stop.id)
                                // If current alighting stop is before or equal to this new boarding stop, reset it
                                const alightingStop = detail.stops.find(x => x.id === alightingStopId)
                                if (alightingStop && alightingStop.order <= stop.order) {
                                  setAlightingStopId(null)
                                }
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="hail" size={16} color={isActive ? '#6A1B9A' : '#6b7280'} />
                            <Text style={[styles.stopChipText, isActive && styles.stopChipTextActive]}>
                              {stop.name || stop.address}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>

                    <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
                      <MaterialIcons name="pin-drop" size={18} color="#1a1c1c" />
                      <Text style={styles.sectionTitle}>Alighting Stop</Text>
                    </View>

                    <View style={styles.optionsList}>
                      {detail.stops.filter((s) => {
                        if (!s.is_dropoff) return false
                        const minOrder = Math.min(...detail.stops.map(x => x.order))
                        return s.order > minOrder
                      }).map((stop) => {
                        const isActive = alightingStopId === stop.id
                        // Disable this alighting option if it comes before the selected boarding stop OR if no boarding stop is selected
                        const boardingStop = detail.stops.find(x => x.id === boardingStopId)
                        const isDisabled = !boardingStop || stop.order <= boardingStop.order

                        return (
                          <TouchableOpacity
                            key={`alight-${stop.id}`}
                            style={[styles.stopChip, isActive && styles.stopChipActive, isDisabled && styles.btnDisabled]}
                            onPress={() => !isDisabled && setAlightingStopId(stop.id)}
                            activeOpacity={0.7}
                            disabled={isDisabled}
                          >
                            <MaterialIcons name="directions-walk" size={16} color={isActive ? '#6A1B9A' : (isDisabled ? '#d1d5db' : '#6b7280')} />
                            <Text style={[styles.stopChipText, isActive && styles.stopChipTextActive, isDisabled && { color: '#d1d5db' }]}>
                              {stop.name || stop.address}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </>
                ) : null}

                <View style={{ height: 40 }} />
              </ScrollView>

              <View style={styles.footer}>
                {isLeaveMode ? (
                  <>
                    {!detail.is_joinable ? (
                      <Text style={styles.infoText}>The join window has passed. You can no longer leave this ride.</Text>
                    ) : (
                      <Text style={styles.leaveWarning}>
                        Leaving will cancel your ticket. Any refund depends on the cancellation policy.
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.leaveBtn, !detail.is_joinable && styles.btnDisabled]}
                      onPress={handleLeave}
                      disabled={working || !detail.is_joinable}
                    >
                      <MaterialIcons name="exit-to-app" size={20} color="#ffffff" />
                      <Text style={styles.leaveBtnText}>Leave Ride</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {!detail.is_joinable && (
                      <Text style={styles.closedText}>This ride is no longer accepting passengers.</Text>
                    )}
                    <TouchableOpacity 
                      style={[styles.joinBtn, (working || !detail.is_joinable) && styles.btnDisabled]}
                      onPress={handleJoin} 
                      disabled={working || !detail.is_joinable}
                    >
                      <MaterialIcons name="fingerprint" size={20} color="#ffffff" />
                      <Text style={styles.joinBtnText}>Confirm & Pay</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </View>

      <Modal visible={pinModalVisible} animationType="fade" transparent onRequestClose={() => setPinModalVisible(false)}>
        <View style={pinStyles.backdrop}>
          <View style={pinStyles.card}>
            <Text style={pinStyles.title}>Confirm Action</Text>
            <Text style={pinStyles.subtitle}>Enter your Transaction PIN to {pendingAction === 'join' ? 'join' : 'leave'} this ride.</Text>
            {pinError ? <Text style={pinStyles.error}>{pinError}</Text> : null}
            <View style={pinStyles.dotsRow}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[pinStyles.dot, pinInput.length > i && pinStyles.dotFilled]} />
              ))}
            </View>
            <View style={pinStyles.pad}>
              {PIN_ROWS.map((row, ri) => (
                <View key={ri} style={pinStyles.row}>
                  {row.map((digit, ci) => (
                    <Pressable
                      key={`${ri}-${ci}`}
                      style={({ pressed }) => [pinStyles.key, (!digit || pinLoading) && pinStyles.keyHidden, pressed && pinStyles.keyPressed]}
                      onPress={() => handlePinDigit(digit)}
                      disabled={!digit || pinLoading}
                    >
                      {digit === 'back'
                        ? <Text style={pinStyles.keyText}>⌫</Text>
                        : <Text style={pinStyles.keyText}>{digit}</Text>}
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
            <TouchableOpacity style={pinStyles.cancelBtn} onPress={() => { setPinModalVisible(false); setPinInput(''); setPinError('') }} disabled={pinLoading}>
              <Text style={pinStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // ── Full-screen working overlay ──────────────────────────────────────────────
  workingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  workingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // ── Modal shell ──────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeave: {
    backgroundColor: '#6A1B9A',
    borderBottomColor: '#5B1487',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  titleLeave: {
    color: '#ffffff',
  },
  closeBtn: {
    padding: 4,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  body: {
    padding: 16,
  },
  // ── Route info card ──────────────────────────────────────────────────────────
  infoCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  infoCardLeave: {
    backgroundColor: '#6A1B9A',
    borderColor: '#5B1487',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  refBadge: {
    backgroundColor: '#1a1c1c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  refBadgeLeave: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  refText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  passengerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106,27,154,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  passengerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6A1B9A',
  },
  passengerTextLeave: {
    color: '#ffffff',
  },
  routeWrap: {
    position: 'relative',
    paddingLeft: 8,
  },
  routeLine: {
    position: 'absolute',
    left: 12,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
  },
  routeLineLeave: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1a1c1c',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  dotOriginLeave: {
    backgroundColor: '#ffffff',
    borderColor: '#6A1B9A',
  },
  pinDest: {
    marginLeft: -3,
  },
  routeAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
    flex: 1,
  },
  routeAddressTextLeave: {
    color: 'rgba(255,255,255,0.95)',
  },
  // ── My ticket (leave mode) ───────────────────────────────────────────────────
  myTicketCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  myTicketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  myTicketStop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  myTicketLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  myTicketValue: {
    fontSize: 13,
    color: '#1a1c1c',
    fontWeight: '700',
    marginTop: 2,
  },
  ticketRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  ticketRefText: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  ticketAmtText: {
    fontSize: 13,
    color: '#6A1B9A',
    fontWeight: '700',
  },
  // ── Stop chip selectors (join mode) ─────────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  optionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    gap: 6,
  },
  stopChipActive: {
    borderColor: '#6A1B9A',
    backgroundColor: 'rgba(106,27,154,0.06)',
  },
  stopChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  stopChipTextActive: {
    color: '#6A1B9A',
  },
  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 10,
    alignItems: 'center',
  },
  // Join button
  joinBtn: {
    backgroundColor: '#6A1B9A',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
    justifyContent: 'center',
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Leave button
  leaveBtn: {
    backgroundColor: '#b91c1c',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
    justifyContent: 'center',
  },
  leaveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  closedText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  leaveWarning: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  infoText: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
  },
})

const pinStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1c1c', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 8, textAlign: 'center' },
  error: { color: '#ba1a1a', fontSize: 12, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 14, marginVertical: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#6A1B9A', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#6A1B9A' },
  pad: { width: '100%', gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  key: { width: 72, height: 52, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e2e2' },
  keyHidden: { opacity: 0 },
  keyPressed: { backgroundColor: '#ede5f5' },
  keyText: { fontSize: 20, fontWeight: '600', color: '#1a1c1c' },
  cancelBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24 },
  cancelText: { color: '#6A1B9A', fontWeight: '600', fontSize: 14 },
})

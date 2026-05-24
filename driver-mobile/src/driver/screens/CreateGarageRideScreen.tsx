import React, { useState, useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import api from '../../core/api'
import { COLORS, FONTS, AMBIENT_SHADOW } from '../../core/theme'
import { useGarageRideStore } from '../../core/garageRideStore'
import { useDriverRidesStore } from '../../core/driverRidesStore'

type CreateGarageRideScreenProps = {
  onBack: () => void
}

export default function CreateGarageRideScreen({ onBack }: CreateGarageRideScreenProps) {
  const insets = useSafeAreaInsets()
  const {
    garageRide: cachedGarageRide,
    garagePassengers: cachedGaragePassengers,
    setGarageRide: setCachedGarageRide,
    setGaragePassengers: setCachedGaragePassengers,
  } = useDriverRidesStore()

  // Form state
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [seats, setSeats] = useState('4')
  const [fare, setFare] = useState('500')
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(!cachedGarageRide)
  
  // Created ride state
  const [ride, setRide] = useState<any>(cachedGarageRide)
  const [passengers, setPassengers] = useState<any[]>(cachedGaragePassengers)
  const { setStatus } = useGarageRideStore()
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

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

  const handleCreate = async () => {
    if (!origin || !destination || !seats || !fare) {
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        origin_address: origin,
        origin_latitude: 9.6171, // Dummy coordinates for now
        origin_longitude: 6.5492,
        destination_address: destination,
        destination_latitude: 9.6200,
        destination_longitude: 6.5500,
        vehicle_type: 'sedan',
        total_seats: parseInt(seats, 10),
        fare_per_seat: parseFloat(fare),
      }
      
      const res = await api.post('rides/garage/create/', payload)
      setRide(res.data)
      setCachedGarageRide(res.data)
      setCachedGaragePassengers([])
      startPolling(res.data.id)
      setStatus('active')
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
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading garage ride...</Text>
      </View>
    )
  }

  const handleDepart = async () => {
    if (!ride) return
    Alert.alert('Depart', 'Are you sure you want to depart and close boarding?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Depart',
        onPress: async () => {
          try {
            const res = await api.post(`rides/garage/${ride.id}/depart/`)
            const nextRide = res?.data || ride
            setRide(nextRide)
            setCachedGarageRide(nextRide)
            Alert.alert('Departed', 'Have a safe trip!')
            onBack()
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error?.message || 'Failed to depart.')
          }
        },
      },
    ])
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
          <TouchableOpacity style={styles.departBtn} onPress={handleDepart}>
            <Text style={styles.departBtnText}>Depart Now</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
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

        <View style={styles.formGroup}>
          <Text style={styles.label}>Origin (Where are you?)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. South Gate Park"
            value={origin}
            onChangeText={setOrigin}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Destination</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Main Campus Library"
            value={destination}
            onChangeText={setDestination}
          />
        </View>

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
          <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Fare per Seat (₦)</Text>
            <TextInput
              style={styles.input}
              placeholder="500"
              value={fare}
              onChangeText={setFare}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Create Ride & Show QR</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  row: { flexDirection: 'row' },
  
  submitBtn: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnText: { ...FONTS.labelLg, color: COLORS.onPrimary },

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
  departBtnText: { ...FONTS.headlineMd, color: COLORS.onPrimary },
})

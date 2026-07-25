import { useMemo, useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../core/api'
import { useLocations } from '../../../services/locationDataService'
import SharedRideLobbyPage from './SharedRideLobbyPage'

export default function JoinSharedRidePage({ initialCode = '', onClose }: { initialCode?: string, onClose: () => void }) {
  const [code, setCode] = useState(initialCode)
  const [step, setStep] = useState(initialCode ? 2 : 1)
  const [ride, setRide] = useState<any>(null)
  const [pickup, setPickup] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [joinedCode, setJoinedCode] = useState<string | null>(null)

  const rawLocations = useLocations()
  const locations = useMemo(() => {
    return (rawLocations as any[]).map((loc) => ({
      id: loc.id,
      label: loc.name,
      description: loc.description,
      latitude: loc.latitude,
      longitude: loc.longitude,
    }))
  }, [rawLocations])

  const handleFetchRide = async (codeToFetch: string) => {
    if (!codeToFetch || codeToFetch.length < 4) return
    try {
      setLoading(true)
      const res = await api.get(`rides/shared/${codeToFetch.toUpperCase()}/`)
      setRide(res.data)
      setStep(2)
    } catch (e: any) {
      Alert.alert('Error', 'Shared ride not found or expired')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialCode) {
      handleFetchRide(initialCode)
    }
  }, [initialCode])


  const handleJoin = async () => {
    if (!pickup) {
      Alert.alert('Error', 'Please select your pickup location')
      return
    }
    try {
      setLoading(true)
      await api.post(`rides/shared/${ride.id}/join/`, {
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        pickup_address: pickup.label,
      })
      setJoinedCode(ride.share_code)
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to join ride')
    } finally {
      setLoading(false)
    }
  }

  if (joinedCode) {
    return <SharedRideLobbyPage shareCode={joinedCode} onClose={onClose} />
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <MaterialIcons name="close" size={24} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Shared Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Enter Share Code</Text>
            <Text style={styles.stepSub}>Ask your friend for the 8-character code.</Text>
            
            <TextInput
              style={styles.input}
              placeholder="e.g. ABCD1234"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              maxLength={12}
            />

            <TouchableOpacity 
              style={[styles.primaryButton, code.length < 4 && styles.disabledButton]} 
              disabled={code.length < 4 || loading}
              onPress={() => handleFetchRide(code)}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Find Ride</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 2 && ride && (
          <>
            <Text style={styles.stepTitle}>Where are you?</Text>
            
            <View style={styles.rideInfoCard}>
              <Text style={styles.infoTitle}>Going to: {ride.dropoff_address}</Text>
              <Text style={styles.infoSub}>Created by {ride.creator.first_name}</Text>
            </View>

            <Text style={styles.label}>Select Pickup Location</Text>
            <FlatList
              data={locations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.locationItem, pickup?.id === item.id && styles.locationItemSelected]}
                  onPress={() => setPickup(item)}
                >
                  <MaterialIcons name="my-location" size={24} color={pickup?.id === item.id ? '#6A1B9A' : '#6b7280'} />
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>{item.label}</Text>
                    <Text style={styles.locationSub}>{item.description}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity 
              style={[styles.primaryButton, !pickup && styles.disabledButton]} 
              onPress={handleJoin}
              disabled={!pickup || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Join & See Fare</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  content: { flex: 1, padding: 20 },
  stepTitle: { fontSize: 24, fontWeight: '700', color: '#1a1c1c', marginBottom: 8 },
  stepSub: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#6A1B9A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rideInfoCard: {
    backgroundColor: '#f3e5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#6A1B9A' },
  infoSub: { fontSize: 14, color: '#6A1B9A', marginTop: 4, opacity: 0.8 },
  label: { fontSize: 16, fontWeight: '600', color: '#1a1c1c' },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 12,
  },
  locationItemSelected: {
    borderColor: '#6A1B9A',
    backgroundColor: '#f3e5f5',
  },
  locationTextContainer: { marginLeft: 12, flex: 1 },
  locationLabel: { fontSize: 16, fontWeight: '600', color: '#1a1c1c' },
  locationSub: { fontSize: 14, color: '#6b7280', marginTop: 4 },
})

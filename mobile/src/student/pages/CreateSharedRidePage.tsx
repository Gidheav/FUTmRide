import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../core/api'
import { useLocations } from '../../../services/locationDataService'

const VEHICLES = [
  { id: 'motorbike', label: 'Motorbike (Okada)', max: 2 },
  { id: 'tricycle', label: 'Tricycle (Keke)', max: 4 },
  { id: 'sedan', label: 'Sedan', max: 4 },
  { id: 'mpv', label: 'MPV', max: 7 },
]

export default function CreateSharedRidePage({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [vehicle, setVehicle] = useState('sedan')
  const [maxRiders, setMaxRiders] = useState(4)
  const [pickup, setPickup] = useState<any>(null)
  const [dropoff, setDropoff] = useState<any>(null)
  const [loading, setLoading] = useState(false)

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

  const handleCreate = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('Error', 'Please select pickup and drop-off locations')
      return
    }
    try {
      setLoading(true)
      await api.post('rides/shared/create/', {
        vehicle_type: vehicle,
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        pickup_address: pickup.label,
        dropoff_latitude: dropoff.latitude,
        dropoff_longitude: dropoff.longitude,
        dropoff_address: dropoff.label,
        max_riders: maxRiders,
      })
      onClose() // Go back to tab which will fetch new rides
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to create shared ride')
    } finally {
      setLoading(false)
    }
  }

  const selectedVehicle = VEHICLES.find(v => v.id === vehicle)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <MaterialIcons name="close" size={24} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Shared Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Where are you starting?</Text>
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
              disabled={!pickup}
              onPress={() => setStep(2)}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Where are you all going?</Text>
            <FlatList
              data={locations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.locationItem, dropoff?.id === item.id && styles.locationItemSelected]}
                  onPress={() => setDropoff(item)}
                >
                  <MaterialIcons name="place" size={24} color={dropoff?.id === item.id ? '#6A1B9A' : '#6b7280'} />
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>{item.label}</Text>
                    <Text style={styles.locationSub}>{item.description}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={[styles.primaryButton, !dropoff && styles.disabledButton]} 
              disabled={!dropoff}
              onPress={() => setStep(3)}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>Vehicle & Capacity</Text>
            
            <Text style={styles.label}>Select Vehicle Type</Text>
            <View style={styles.vehicleGrid}>
              {VEHICLES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vehicleCard, vehicle === v.id && styles.vehicleCardSelected]}
                  onPress={() => {
                    setVehicle(v.id)
                    if (maxRiders > v.max) setMaxRiders(v.max)
                  }}
                >
                  <Text style={[styles.vehicleText, vehicle === v.id && styles.vehicleTextSelected]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 24 }]}>Maximum Riders (including you)</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity 
                style={styles.counterButton}
                onPress={() => setMaxRiders(Math.max(2, maxRiders - 1))}
              >
                <MaterialIcons name="remove" size={24} color="#6A1B9A" />
              </TouchableOpacity>
              <Text style={styles.counterText}>{maxRiders}</Text>
              <TouchableOpacity 
                style={styles.counterButton}
                onPress={() => setMaxRiders(Math.min(selectedVehicle?.max || 4, maxRiders + 1))}
              >
                <MaterialIcons name="add" size={24} color="#6A1B9A" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }} />
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Create & Get Link</Text>
              )}
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
  stepTitle: { fontSize: 24, fontWeight: '700', color: '#1a1c1c', marginBottom: 24 },
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
  primaryButton: {
    backgroundColor: '#6A1B9A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '600', color: '#1a1c1c', marginBottom: 12 },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vehicleCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  vehicleCardSelected: { borderColor: '#6A1B9A', backgroundColor: '#6A1B9A' },
  vehicleText: { fontSize: 14, color: '#1a1c1c', fontWeight: '500' },
  vehicleTextSelected: { color: '#fff' },
  counterRow: { flexDirection: 'row', alignItems: 'center' },
  counterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: { fontSize: 24, fontWeight: '600', marginHorizontal: 24 },
})

import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../../core/api'
import CreateSharedRidePage from '../../pages/CreateSharedRidePage'
import SharedRideLobbyPage from '../../pages/SharedRideLobbyPage'

export default function SharedRideTab() {
  const [loading, setLoading] = useState(true)
  const [rides, setRides] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRideCode, setSelectedRideCode] = useState<string | null>(null)

  const fetchRides = async () => {
    try {
      setLoading(true)
      const res = await api.get('rides/shared/my/')
      setRides(res.data)
    } catch (e) {
      console.warn('Failed to fetch shared rides', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRides()
  }, [])

  if (showCreate) {
    return <CreateSharedRidePage onClose={() => { setShowCreate(false); fetchRides() }} />
  }

  if (selectedRideCode) {
    return <SharedRideLobbyPage shareCode={selectedRideCode} onClose={() => { setSelectedRideCode(null); fetchRides() }} />
  }

  const renderItem = ({ item }: { item: any }) => {
    const isCreator = item.creator.id === 'FIXME_ME' // We'll fix this or just use the badge
    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => setSelectedRideCode(item.share_code)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>To {item.dropoff_address}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.cardSub}>Code: {item.share_code}</Text>
        <Text style={styles.cardSub}>{item.vehicle_type_label} • {item.riders.length}/{item.max_riders} joined</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>My Shared Rides</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)}>
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6A1B9A" style={{ marginTop: 40 }} />
      ) : rides.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="group-add" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No Shared Rides</Text>
          <Text style={styles.emptySub}>Create a shared ride and split the fare with friends.</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchRides}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1c1c',
    flex: 1,
  },
  badge: {
    backgroundColor: '#f3e5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 12,
  },
  badgeText: {
    color: '#6A1B9A',
    fontSize: 10,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1c1c',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
})

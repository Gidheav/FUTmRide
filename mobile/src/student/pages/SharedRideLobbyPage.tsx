import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

export default function SharedRideLobbyPage({ shareCode, onClose }: { shareCode: string, onClose: () => void }) {
  const user = useAuthStore((s: any) => s.user)
  const [loading, setLoading] = useState(true)
  const [ride, setRide] = useState<any>(null)
  const [dispatching, setDispatching] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const fetchRide = async () => {
    try {
      const res = await api.get(`/student/rides/shared/${shareCode}/`)
      setRide(res.data)
    } catch (e: any) {
      if (!ride) {
        Alert.alert('Error', 'Ride not found')
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRide()
    const interval = setInterval(fetchRide, 5000) // Poll every 5s for updates
    return () => clearInterval(interval)
  }, [shareCode])

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my shared ride on LR-Ride! Use code: ${shareCode}\n\nhttps://lrride.app/share/${shareCode}`,
      })
    } catch (error: any) {
      Alert.alert(error.message)
    }
  }

  const handleDispatch = async () => {
    try {
      setDispatching(true)
      await api.post(`/student/rides/shared/${ride.id}/dispatch/`)
      Alert.alert('Success', 'Ride dispatched to drivers!')
      fetchRide()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Failed to dispatch')
    } finally {
      setDispatching(false)
    }
  }

  const handleConfirm = async () => {
    try {
      setConfirming(true)
      await api.post(`/student/rides/shared/${ride.id}/confirm/`)
      fetchRide()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error?.message || 'Payment failed')
    } finally {
      setConfirming(false)
    }
  }

  if (loading && !ride) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6A1B9A" style={{ marginTop: 40 }} />
      </SafeAreaView>
    )
  }

  if (!ride) return null

  const isCreator = user?.id === ride.creator.id
  const myRiderProfile = ride.riders.find((r: any) => r.user.id === user?.id)
  const activeRiders = ride.riders.filter((r: any) => r.status !== 'cancelled')
  const allConfirmed = activeRiders.every((r: any) => r.status === 'confirmed')
  
  const canDispatch = isCreator && activeRiders.length > 1 && allConfirmed && ride.status === 'gathering'
  const isMatching = ride.status === 'matching'
  const isMatched = ride.status === 'matched'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={24} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Lobby</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleShare}>
          <MaterialIcons name="share" size={24} color="#6A1B9A" />
        </TouchableOpacity>
      </View>

      <View style={styles.codeContainer}>
        <Text style={styles.codeLabel}>SHARE CODE</Text>
        <Text style={styles.codeValue}>{shareCode}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Drop-off: {ride.dropoff_address}</Text>
          <Text style={styles.infoSub}>{ride.vehicle_type_label} • Max {ride.max_riders} people</Text>
          <Text style={styles.infoSub}>Status: {ride.status.toUpperCase()}</Text>
        </View>

        <Text style={styles.sectionTitle}>Riders ({activeRiders.length}/{ride.max_riders})</Text>
        
        <FlatList
          data={activeRiders}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View style={styles.riderItem}>
              <View style={styles.riderAvatar}>
                <Text style={styles.riderAvatarText}>{item.user.first_name[0]}</Text>
              </View>
              <View style={styles.riderInfo}>
                <Text style={styles.riderName}>{item.user.first_name} {item.user.last_name}</Text>
                <Text style={styles.riderSub}>
                  {item.pickup_address} • ₦{item.fare_share}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                {item.status === 'confirmed' ? (
                  <MaterialIcons name="check-circle" size={20} color="#10B981" />
                ) : (
                  <MaterialIcons name="pending" size={20} color="#F59E0B" />
                )}
              </View>
            </View>
          )}
        />
      </View>

      <View style={styles.footer}>
        {myRiderProfile?.status === 'joined' && (
          <View style={styles.payContainer}>
            <Text style={styles.payText}>Your Share: ₦{myRiderProfile.fare_share}</Text>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleConfirm}
              disabled={confirming}
            >
              {confirming ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Pay & Confirm</Text>}
            </TouchableOpacity>
          </View>
        )}

        {isCreator && ride.status === 'gathering' && (
          <TouchableOpacity 
            style={[styles.primaryButton, !canDispatch && styles.disabledButton]} 
            onPress={handleDispatch}
            disabled={!canDispatch || dispatching}
          >
            {dispatching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {canDispatch ? 'Dispatch to Drivers' : 'Waiting for everyone to confirm...'}
              </Text>
            )}
          </TouchableOpacity>
        )}
        
        {(isMatching || isMatched) && (
          <View style={styles.matchingContainer}>
            <ActivityIndicator color="#6A1B9A" />
            <Text style={styles.matchingText}>
              {isMatching ? 'Finding a driver...' : 'Driver found!'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  codeContainer: {
    backgroundColor: '#6A1B9A',
    padding: 24,
    alignItems: 'center',
  },
  codeLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  codeValue: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4, letterSpacing: 4 },
  content: { flex: 1, padding: 20 },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#1a1c1c' },
  infoSub: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1c1c', marginBottom: 12 },
  riderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  riderAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f3e5f5',
    alignItems: 'center', justifyContent: 'center',
  },
  riderAvatarText: { color: '#6A1B9A', fontWeight: '700', fontSize: 16 },
  riderInfo: { flex: 1, marginLeft: 12 },
  riderName: { fontSize: 16, fontWeight: '600', color: '#1a1c1c' },
  riderSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { padding: 4 },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  primaryButton: {
    backgroundColor: '#6A1B9A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  payContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payText: { fontSize: 18, fontWeight: '700', color: '#1a1c1c' },
  matchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  matchingText: { marginLeft: 8, fontSize: 16, fontWeight: '600', color: '#6A1B9A' },
})

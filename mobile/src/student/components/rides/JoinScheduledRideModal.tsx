import { useEffect, useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
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
}

export default function JoinScheduledRideModal({ ride, onClose, onJoined }: Props) {
  const [detail, setDetail] = useState<RideDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  
  const [boardingStopId, setBoardingStopId] = useState<string | null>(null)
  const [alightingStopId, setAlightingStopId] = useState<string | null>(null)

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get(`rides/scheduled/${ride.id}/detail/`)
        const data = res.data
        setDetail(data)
        
        // Default to first pickup and last dropoff
        if (data.stops && data.stops.length >= 2) {
          const pickups = data.stops.filter((s: Stop) => s.is_pickup)
          const dropoffs = data.stops.filter((s: Stop) => s.is_dropoff)
          if (pickups.length > 0) setBoardingStopId(pickups[0].id)
          if (dropoffs.length > 0) setAlightingStopId(dropoffs[dropoffs.length - 1].id)
        }
      } catch (err) {
        Alert.alert('Error', 'Unable to load ride details.')
        onClose()
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [ride.id, onClose])

  const handleJoin = async () => {
    if (!boardingStopId || !alightingStopId) {
      Alert.alert('Error', 'Please select boarding and alighting stops.')
      return
    }

    setJoining(true)
    try {
      await api.post(`rides/scheduled/${ride.id}/join/`, {
        boarding_stop_id: boardingStopId,
        alighting_stop_id: alightingStopId,
      })
      Alert.alert('Success', 'You have successfully joined the ride.')
      onJoined()
    } catch (err: any) {
      const msg = err.response?.data?.wallet || err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Unable to join ride. Please check your wallet balance.'
      Alert.alert('Failed to join', String(msg))
    } finally {
      setJoining(false)
    }
  }

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Join Ride</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#1a1c1c" />
            </TouchableOpacity>
          </View>

          {loading || !detail ? (
            <View style={styles.loaderWrap}>
              <LoadingOverlay visible={true} inline size={40} />
            </View>
          ) : (
            <>
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.infoCard}>
                  <Text style={styles.refText}>#{detail.reference}</Text>
                  <Text style={styles.routeText}>{detail.origin_address} → {detail.destination_address}</Text>
                  <Text style={styles.seatsText}>{detail.passenger_count} passengers joined</Text>
                </View>

                <Text style={styles.sectionTitle}>Boarding Stop</Text>
                {detail.stops.filter((s) => s.is_pickup).map((stop) => (
                  <TouchableOpacity
                    key={`board-${stop.id}`}
                    style={[styles.stopOption, boardingStopId === stop.id && styles.stopOptionActive]}
                    onPress={() => setBoardingStopId(stop.id)}
                  >
                    <View style={[styles.radio, boardingStopId === stop.id && styles.radioActive]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stopName}>{stop.name || stop.address}</Text>
                      {stop.name ? <Text style={styles.stopAddress}>{stop.address}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Alighting Stop</Text>
                {detail.stops.filter((s) => s.is_dropoff).map((stop) => (
                  <TouchableOpacity
                    key={`alight-${stop.id}`}
                    style={[styles.stopOption, alightingStopId === stop.id && styles.stopOptionActive]}
                    onPress={() => setAlightingStopId(stop.id)}
                  >
                    <View style={[styles.radio, alightingStopId === stop.id && styles.radioActive]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stopName}>{stop.name || stop.address}</Text>
                      {stop.name ? <Text style={styles.stopAddress}>{stop.address}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}

                <View style={{ height: 40 }} />
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity 
                  style={[styles.joinBtn, joining && styles.joinBtnDisabled]} 
                  onPress={handleJoin} 
                  disabled={joining}
                >
                  {joining ? (
                    < color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.joinBtnText}>Confirm & Pay</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  closeBtn: {
    padding: 4,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  refText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A1B9A',
    marginBottom: 4,
  },
  routeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
    marginBottom: 6,
  },
  seatsText: {
    fontSize: 13,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1c1c',
    marginBottom: 12,
  },
  stopOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    marginBottom: 8,
  },
  stopOptionActive: {
    borderColor: '#6A1B9A',
    backgroundColor: 'rgba(106,27,154,0.04)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
  },
  radioActive: {
    borderColor: '#6A1B9A',
    borderWidth: 6,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  stopAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  joinBtn: {
    backgroundColor: '#6A1B9A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnDisabled: {
    opacity: 0.7,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
})

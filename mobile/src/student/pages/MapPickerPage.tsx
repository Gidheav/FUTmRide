import { useState, useCallback } from 'react'
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const DEFAULT_REGION: Region = {
  latitude: 9.5261,
  longitude: 6.4514,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
}

const roundCoord = (value: number) => Number(value.toFixed(6))

type MapPickerPageProps = {
  onClose: () => void
  onConfirm: (coords: { latitude: number; longitude: number }) => void
  initialCoords?: { latitude: number; longitude: number } | null
}

export default function MapPickerPage({ onClose, onConfirm, initialCoords }: MapPickerPageProps) {
  const insets = useSafeAreaInsets()
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    initialCoords || null
  )

  const handleMapPress = useCallback((event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate
    setPin({
      latitude: roundCoord(latitude),
      longitude: roundCoord(longitude),
    })
  }, [])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={20} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pin Dropoff Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={DEFAULT_REGION}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
        >
          {pin && <Marker coordinate={pin} />}
        </MapView>
      </View>

      <View style={styles.footer}>
        {pin ? (
          <Text style={styles.coordText}>
            {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
          </Text>
        ) : (
          <Text style={styles.hintText}>Tap on the map to place a pin</Text>
        )}
        <TouchableOpacity
          style={[styles.confirmButton, !pin && styles.confirmButtonDisabled]}
          onPress={() => pin && onConfirm(pin)}
          disabled={!pin}
          activeOpacity={0.8}
        >
          <MaterialIcons name="check" size={18} color="#ffffff" />
          <Text style={styles.confirmText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  headerSpacer: {
    width: 36,
  },
  mapWrapper: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  coordText: {
    fontSize: 13,
    color: '#6A1B9A',
    fontWeight: '600',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 13,
    color: '#8b8b8b',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#b79cd5',
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
})

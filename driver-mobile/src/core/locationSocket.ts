import * as Location from 'expo-location'
import { WS_BASE_URL } from '../../config/apiConfig'
import { useAuthStore } from './authStore'

let socket: WebSocket | null = null
let subscription: Location.LocationSubscription | null = null
let isStarting = false

const sendLocation = (coords: Location.LocationObject['coords']) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify({
    type: 'location_update',
    latitude: coords.latitude,
    longitude: coords.longitude,
    heading: coords.heading,
    speed_kmh: coords.speed ? coords.speed * 3.6 : null,
    accuracy_meters: coords.accuracy,
  }))
}

export const startDriverLocationTracking = async () => {
  if (subscription || isStarting) return
  isStarting = true

  try {
    const accessToken = useAuthStore.getState().accessToken
    if (!accessToken) return

    const existing = await Location.getForegroundPermissionsAsync()
    if (!existing.granted) {
      const request = await Location.requestForegroundPermissionsAsync()
      if (!request.granted) {
        throw new Error('Location permission denied.')
      }
    }

    const wsUrl = `${WS_BASE_URL}/ws/driver/location/?token=${accessToken}`
    socket = new WebSocket(wsUrl)

    socket.onclose = () => {
      socket = null
    }

    const initial = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    })
    sendLocation(initial.coords)

    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (position) => {
        sendLocation(position.coords)
      }
    )
  } finally {
    isStarting = false
  }
}

export const stopDriverLocationTracking = async () => {
  if (subscription) {
    subscription.remove()
    subscription = null
  }
  if (socket) {
    socket.close()
    socket = null
  }
}

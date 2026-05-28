import { Platform } from 'react-native'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'

const RIDE_FOREGROUND_TASK = 'driver-ride-foreground'

let taskDefined = false

const ensureTaskDefined = () => {
  if (taskDefined) return
  TaskManager.defineTask(RIDE_FOREGROUND_TASK, ({ error }) => {
    if (error) {
      console.warn('[RideForeground] task error', error)
    }
  })
  taskDefined = true
}

export const startRideForegroundService = async (title: string, body: string) => {
  if (Platform.OS !== 'android') return
  ensureTaskDefined()

  const started = await Location.hasStartedLocationUpdatesAsync(RIDE_FOREGROUND_TASK)
  if (started) {
    await Location.stopLocationUpdatesAsync(RIDE_FOREGROUND_TASK)
  }

  const foreground = await Location.getForegroundPermissionsAsync()
  if (!foreground.granted) {
    const request = await Location.requestForegroundPermissionsAsync()
    if (!request.granted) {
      throw new Error('Location permission denied.')
    }
  }

  const background = await Location.getBackgroundPermissionsAsync()
  if (!background.granted) {
    await Location.requestBackgroundPermissionsAsync()
  }

  await Location.startLocationUpdatesAsync(RIDE_FOREGROUND_TASK, {
    accuracy: Location.Accuracy.Lowest,
    timeInterval: 60000,
    distanceInterval: 1000,
    pausesUpdatesAutomatically: true,
    foregroundService: {
      notificationTitle: title,
      notificationBody: body,
      notificationColor: '#5B2D8E',
    },
  })
}

export const stopRideForegroundService = async () => {
  if (Platform.OS !== 'android') return
  ensureTaskDefined()
  const started = await Location.hasStartedLocationUpdatesAsync(RIDE_FOREGROUND_TASK)
  if (!started) return
  await Location.stopLocationUpdatesAsync(RIDE_FOREGROUND_TASK)
}

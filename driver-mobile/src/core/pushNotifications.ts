import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import api from './api'

const RIDE_STATUS_CHANNEL_ID = 'ride-status-alerts'
const RIDE_STATUS_NOTIFICATION_ID = 'driver-ride-status'

let notificationHandlerReady = false
let pushConfigWarningShown = false
let rideChannelReady = false

const warnPushConfigOnce = (message: string) => {
  if (pushConfigWarningShown) return
  pushConfigWarningShown = true
  console.warn(message)
}

const ensureNotificationHandler = () => {
  if (notificationHandlerReady) return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldSetBadge: false,
      shouldPlaySound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  })
  notificationHandlerReady = true
}

const ensureRideChannel = async () => {
  if (rideChannelReady || Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(RIDE_STATUS_CHANNEL_ID, {
    name: 'Ride updates',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 120, 80, 120],
  })
  rideChannelReady = true
}

const getProjectId = () =>
  Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId

const hasAndroidFirebaseConfig = () =>
  Boolean((Constants?.expoConfig as any)?.android?.googleServicesFile)

const getExpoPushToken = async () => {
  const projectId = getProjectId()
  if (projectId) {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data
  }
  return (await Notifications.getExpoPushTokenAsync()).data
}

export const registerDriverPushToken = async (currentServerToken?: string | null) => {
  try {
    ensureNotificationHandler()

    if (!Device.isDevice) return null

    if (Platform.OS === 'android') {
      if (Constants.appOwnership === 'expo') {
        warnPushConfigOnce(
          'Android remote push is not available in Expo Go. Install a development build to test push notifications.',
        )
        return null
      }

      if (!hasAndroidFirebaseConfig()) {
        warnPushConfigOnce(
          'Push setup incomplete: Android Firebase config is missing. Add `google-services.json` or set `GOOGLE_SERVICES_JSON`, then rebuild Android app.',
        )
        return null
      }
      await ensureRideChannel()
    }

    const permissions = await Notifications.getPermissionsAsync()
    let permissionStatus = permissions.status
    if (permissionStatus !== 'granted') {
      permissionStatus = (await Notifications.requestPermissionsAsync()).status
    }
    if (permissionStatus !== 'granted') return null

    const pushToken = await getExpoPushToken()
    if (!pushToken) return null
    if (currentServerToken === pushToken) return pushToken

    await api.patch('users/me/', { fcm_token: pushToken })
    return pushToken
  } catch (error: any) {
    const message = String(error?.message || '')
    if (message.includes('Default FirebaseApp is not initialized')) {
      warnPushConfigOnce(
        'Push setup incomplete: add Firebase config (`google-services.json`) and rebuild Android app. Notifications while app is closed require this setup.',
      )
      return null
    }
    console.warn('push registration failed', error)
    return null
  }
}

export const showRideStatusNotification = async (
  title: string,
  body: string,
  data: Record<string, string> = {},
  identifier: string = RIDE_STATUS_NOTIFICATION_ID,
  options?: { sticky?: boolean; silent?: boolean }
) => {
  try {
    ensureNotificationHandler()
    await ensureRideChannel()
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        data,
        sound: options?.silent ? false : 'default',
        vibrate: options?.silent ? [] : undefined,
        priority: options?.silent
          ? Notifications.AndroidNotificationPriority.LOW
          : Notifications.AndroidNotificationPriority.HIGH,
        sticky: options?.sticky || false,
        autoDismiss: !(options?.sticky),
      },
      trigger: { channelId: RIDE_STATUS_CHANNEL_ID },
    })
  } catch (error) {
    console.warn('local notification failed', error)
  }
}

export const clearRideStatusNotification = async (
  identifier: string = RIDE_STATUS_NOTIFICATION_ID,
) => {
  try {
    await Notifications.dismissNotificationAsync(identifier)
  } catch (error) {
    console.warn('dismiss notification failed', error)
  }
}

export const addNotificationResponseListener = (
  callback: (data: Record<string, any>) => void,
) => {
  ensureNotificationHandler()
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = response.notification.request.content.data ?? {}
    callback(payload as Record<string, any>)
  })
  return () => sub.remove()
}

export const addNotificationReceivedListener = (
  callback: (data: Record<string, any>) => void,
) => {
  ensureNotificationHandler()
  const sub = Notifications.addNotificationReceivedListener((notification) => {
    const payload = notification.request.content.data ?? {}
    callback(payload as Record<string, any>)
  })
  return () => sub.remove()
}

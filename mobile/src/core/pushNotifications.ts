import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import api from './api'

const RIDE_STATUS_CHANNEL_ID = 'ride-status-alerts'
const COMPACT_PREVIEW_FLAG = '__compact_preview'
const NOTIFICATION_TITLE_PREVIEW_LENGTH = 48
const NOTIFICATION_BODY_PREVIEW_LENGTH = 96

let notificationHandlerReady = false
let pushConfigWarningShown = false
let rideChannelReady = false
let lastHandledNotificationResponseId: string | null = null

const truncatePreviewText = (value: unknown, maxLength: number) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

const needsCompactPreview = (title: unknown, body: unknown) => {
  const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim()
  const cleanBody = String(body || '').replace(/\s+/g, ' ').trim()
  return (
    cleanTitle.length > NOTIFICATION_TITLE_PREVIEW_LENGTH ||
    cleanBody.length > NOTIFICATION_BODY_PREVIEW_LENGTH
  )
}

const scheduleCompactForegroundPreview = async (notification: Notifications.Notification) => {
  const content = notification.request.content
  const data = (content.data ?? {}) as Record<string, any>
  if (data?.[COMPACT_PREVIEW_FLAG]) return

  await ensureRideChannel()
  await Notifications.scheduleNotificationAsync({
    identifier: `compact-${notification.request.identifier}`,
    content: {
      title: truncatePreviewText(content.title, NOTIFICATION_TITLE_PREVIEW_LENGTH),
      body: truncatePreviewText(content.body, NOTIFICATION_BODY_PREVIEW_LENGTH),
      data: { ...data, [COMPACT_PREVIEW_FLAG]: true },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: { channelId: RIDE_STATUS_CHANNEL_ID },
  })
}

const warnPushConfigOnce = (message: string) => {
  if (pushConfigWarningShown) return
  pushConfigWarningShown = true
  console.warn(message)
}

const ensureNotificationHandler = () => {
  if (notificationHandlerReady) return
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const content = notification.request.content
      const data = (content.data ?? {}) as Record<string, any>
      const compactOriginal = !data?.[COMPACT_PREVIEW_FLAG] && needsCompactPreview(content.title, content.body)

      if (compactOriginal) {
        void scheduleCompactForegroundPreview(notification).catch((error) => {
          console.warn('compact notification preview failed', error)
        })
      }

      return {
        shouldShowAlert: !compactOriginal,
        shouldShowBanner: !compactOriginal,
        shouldShowList: true,
        shouldSetBadge: false,
        shouldPlaySound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }
    },
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

export const registerStudentPushToken = async (currentServerToken?: string | null) => {
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
  identifier?: string,
  options?: { sticky?: boolean; silent?: boolean }
) => {
  try {
    ensureNotificationHandler()
    await ensureRideChannel()
    await Notifications.scheduleNotificationAsync({
      identifier, // When provided, this updates the existing notification instead of creating a new one
      content: {
        title: truncatePreviewText(title, NOTIFICATION_TITLE_PREVIEW_LENGTH),
        body: truncatePreviewText(body, NOTIFICATION_BODY_PREVIEW_LENGTH),
        data,
        sound: options?.silent ? false : 'default',
        vibrate: options?.silent ? [] : undefined,
        priority: options?.silent ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.HIGH,
        sticky: options?.sticky || false,
        autoDismiss: !(options?.sticky),
      },
      trigger: { channelId: RIDE_STATUS_CHANNEL_ID }, // Immediate trigger
    })
  } catch (error) {
    console.warn('local notification failed', error)
  }
}

/**
 * Listen for notification taps (foreground + background + cold start).
 * Returns a cleanup function to remove the listener.
 */
export const addNotificationResponseListener = (
  callback: (data: Record<string, any>) => void,
) => {
  ensureNotificationHandler()
  const handleResponse = (response: Notifications.NotificationResponse | null | undefined) => {
    if (!response) return
    const responseId = response.notification.request.identifier
    if (responseId && responseId === lastHandledNotificationResponseId) return
    lastHandledNotificationResponseId = responseId || null
    const payload = response.notification.request.content.data ?? {}
    callback(payload as Record<string, any>)
  }

  void Notifications.getLastNotificationResponseAsync()
    .then(handleResponse)
    .catch(() => undefined)

  const sub = Notifications.addNotificationResponseReceivedListener(handleResponse)
  return () => sub.remove()
}

/**
 * Read the notification response that launched/resumed the app, if one exists.
 */
export const getLastNotificationResponseData = async () => {
  ensureNotificationHandler()
  const response = await Notifications.getLastNotificationResponseAsync()
  return (response?.notification.request.content.data ?? null) as Record<string, any> | null
}

/**
 * Listen for notifications received while the app is in the foreground.
 */
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

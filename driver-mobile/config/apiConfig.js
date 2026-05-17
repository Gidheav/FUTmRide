import { Platform } from 'react-native'

const ENV_OVERRIDE =
  process.env.EXPO_PUBLIC_APP_ENV ||
  process.env.EXPO_PUBLIC_ENV ||
  process.env.EXPO_PUBLIC_API_ENV

export const APP_ENV = ENV_OVERRIDE || (__DEV__ ? 'development' : 'production')

const DEFAULT_DEV_HOST = Platform.OS === 'android'
  ? 'http://10.0.2.2:8000'
  : 'http://localhost:8000'

const DEV_HOST = process.env.EXPO_PUBLIC_DEV_SERVER_HOST || DEFAULT_DEV_HOST

export const DEV_API_URL =
  process.env.EXPO_PUBLIC_API_URL || `${DEV_HOST}/api/v1`

export const PROD_API_URL =
  process.env.EXPO_PUBLIC_PROD_API_URL || 'https://futmride.onrender.com/api/v1'

export const API_BASE_URL = APP_ENV === 'production' ? PROD_API_URL : DEV_API_URL

const resolveWsBase = () => {
  try {
    const base = new URL(API_BASE_URL)
    const scheme = base.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${scheme}//${base.host}`
  } catch {
    return 'ws://localhost:8000'
  }
}

export const WS_BASE_URL = resolveWsBase()

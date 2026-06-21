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

const normalizeApiBaseUrl = (rawUrl) => {
  if (!rawUrl) return rawUrl
  try {
    const url = new URL(rawUrl)
    const path = url.pathname.replace(/\/+$/, '')
    if (path.endsWith('/api/v1')) {
      url.pathname = `${path}/`
    } else if (path.endsWith('/v1')) {
      url.pathname = `${path.slice(0, -3)}/api/v1/`
    } else {
      url.pathname = `${path}/api/v1/`
    }
    return url.toString()
  } catch {
    return rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`
  }
}

export const DEV_API_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || `${DEV_HOST}/api/v1`
)

export const PROD_API_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_PROD_API_URL || 'https://lrride-server.onrender.com/api/v1'
)

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

const buildCallbackUrl = () => {
  try {
    const origin = new URL(API_BASE_URL).origin
    return `${origin}/student/wallet`
  } catch {
    return 'https://lrride-server.onrender.com/student/wallet'
  }
}

export const PAYMENT_CALLBACK_URL =
  process.env.EXPO_PUBLIC_PAYMENT_CALLBACK_URL || buildCallbackUrl()

export const getApiBaseUrl = () => API_BASE_URL

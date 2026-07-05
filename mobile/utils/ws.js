import { WS_BASE_URL } from '../config/apiConfig'
import { getAuthTokens } from './secureStorage'

export async function createAuthenticatedWebSocket(path) {
  if (!WS_BASE_URL) {
    if (__DEV__) {
      console.warn('[ws] WS_BASE_URL is not configured. Set EXPO_PUBLIC_WS_URL or EXPO_PUBLIC_API_URL in your environment.')
    } else {
      console.error('[ws] WS_BASE_URL is not configured. WebSocket connection aborted.')
    }
    return null
  }

  const { accessToken } = await getAuthTokens()
  if (!accessToken) return null

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new WebSocket(`${WS_BASE_URL}${normalizedPath}`, [`access_token.${accessToken}`])
}

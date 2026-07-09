import { WS_BASE_URL } from '../config/apiConfig'
import { getAuthTokens } from './secureStorage'

export async function createAuthenticatedWebSocket(path) {
  if (!WS_BASE_URL) {
    if (__DEV__) {
      console.warn('[ws] WebSocket connection is unavailable.')
    } else {
      console.error('[ws] WebSocket connection is unavailable.')
    }
    return null
  }

  const { accessToken } = await getAuthTokens()
  if (!accessToken) return null

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new WebSocket(`${WS_BASE_URL}${normalizedPath}`, [`access_token.${accessToken}`])
}

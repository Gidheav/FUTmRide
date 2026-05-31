import { getAuthTokens } from './secureStorage'

export async function createAuthenticatedWebSocket(path) {
  const { accessToken } = await getAuthTokens()
  if (!accessToken) return null

  const base = process.env.EXPO_PUBLIC_WS_URL || process.env.EXPO_PUBLIC_WS_BASE_URL || 'ws://127.0.0.1:8002'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new WebSocket(`${base}${normalizedPath}`, [`access_token.${accessToken}`])
}

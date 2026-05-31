import * as SecureStore from 'expo-secure-store'

const ACCESS_TOKEN_KEY = 'lr-ride:auth:access'
const REFRESH_TOKEN_KEY = 'lr-ride:auth:refresh'

let cachedTokens = null
let cacheReady = false

export const getAuthTokens = async () => {
  if (cacheReady) return cachedTokens
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ])
  cachedTokens = {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
  }
  cacheReady = true
  return cachedTokens
}

export const setAuthTokens = async ({ accessToken, refreshToken }) => {
  cachedTokens = {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
  }
  cacheReady = true

  if (accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, String(accessToken))
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
  }

  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, String(refreshToken))
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
  }
}

export const clearAuthTokens = async () => {
  cachedTokens = { accessToken: null, refreshToken: null }
  cacheReady = true
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ])
}

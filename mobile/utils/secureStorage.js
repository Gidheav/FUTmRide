import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const ACCESS_TOKEN_KEY = 'lr-ride:auth:access'
const REFRESH_TOKEN_KEY = 'lr-ride:auth:refresh'

let cachedTokens = null
let cacheReady = false
let secureStoreModule = undefined

/**
 * Returns true when we should use expo-secure-store:
 * - Not running inside Expo Go (storeClient) on a dev build
 * - Always true in production builds (__DEV__ is false)
 */
const useSecureStore = () => {
  if (!__DEV__) return true // always use SecureStore in production
  return Constants.executionEnvironment !== 'storeClient'
}

function getSecureStore() {
  if (!useSecureStore()) return null
  if (secureStoreModule !== undefined) return secureStoreModule
  try {
    secureStoreModule = require('expo-secure-store')
  } catch {
    secureStoreModule = null
  }
  return secureStoreModule
}

async function getItem(key) {
  const SecureStore = getSecureStore()
  if (SecureStore) {
    try {
      return await SecureStore.getItemAsync(key)
    } catch (e) {
      if (!__DEV__) {
        console.error('[secureStorage] SecureStore.getItemAsync failed in production. Token read aborted.', e)
        return null
      }
      // Dev-only graceful degradation
      return AsyncStorage.getItem(key)
    }
  }
  // Expo Go / storeClient fallback — dev only
  return AsyncStorage.getItem(key)
}

async function setItem(key, value) {
  const SecureStore = getSecureStore()
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value)
      await AsyncStorage.removeItem(key).catch(() => {})
      return
    } catch (e) {
      if (!__DEV__) {
        console.error('[secureStorage] SecureStore.setItemAsync failed in production. Token NOT stored.', e)
        return // do NOT fall back to plain AsyncStorage in production
      }
      // Dev-only graceful degradation
    }
  }
  await AsyncStorage.setItem(key, value)
}

async function removeItem(key) {
  const SecureStore = getSecureStore()
  if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch (e) {
      if (!__DEV__) {
        console.error('[secureStorage] SecureStore.deleteItemAsync failed in production.', e)
      }
    }
  }
  await AsyncStorage.removeItem(key)
}

export const getSecureItem = getItem
export const setSecureItem = setItem
export const removeSecureItem = removeItem

export const getAuthTokens = async () => {
  if (cacheReady) return cachedTokens
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
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
    await setItem(ACCESS_TOKEN_KEY, String(accessToken))
  } else {
    await removeItem(ACCESS_TOKEN_KEY)
  }

  if (refreshToken) {
    await setItem(REFRESH_TOKEN_KEY, String(refreshToken))
  } else {
    await removeItem(REFRESH_TOKEN_KEY)
  }
}

export const clearAuthTokens = async () => {
  cachedTokens = { accessToken: null, refreshToken: null }
  cacheReady = true
  await Promise.all([removeItem(ACCESS_TOKEN_KEY), removeItem(REFRESH_TOKEN_KEY)])
}

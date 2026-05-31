import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const ACCESS_TOKEN_KEY = 'lr-ride:driver:auth:access'
const REFRESH_TOKEN_KEY = 'lr-ride:driver:auth:refresh'

let cachedTokens = null
let cacheReady = false
let secureStoreModule = undefined

/** Expo Go does not ship a matching ExpoSecureStore native build — use AsyncStorage there. */
const useSecureStore = () => Constants.executionEnvironment !== 'storeClient'

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
    } catch {
      return AsyncStorage.getItem(key)
    }
  }
  return AsyncStorage.getItem(key)
}

async function setItem(key, value) {
  const SecureStore = getSecureStore()
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value)
      return
    } catch {
      /* fall through */
    }
  }
  await AsyncStorage.setItem(key, value)
}

async function removeItem(key) {
  const SecureStore = getSecureStore()
  if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(key)
      return
    } catch {
      /* fall through */
    }
  }
  await AsyncStorage.removeItem(key)
}

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

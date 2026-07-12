import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import Constants from 'expo-constants'

const PIN_HASH_KEY = 'app-lock-pin-hash'

let secureStoreModule: typeof import('expo-secure-store') | null | undefined

function getSecureStore() {
  if (Constants.executionEnvironment === 'storeClient') return null
  if (secureStoreModule !== undefined) return secureStoreModule
  try {
    secureStoreModule = require('expo-secure-store')
  } catch {
    secureStoreModule = null
  }
  return secureStoreModule
}

async function secureGet(key: string) {
  const SecureStore = getSecureStore()
  if (SecureStore) {
    try {
      return await SecureStore.getItemAsync(key)
    } catch (e) {
      if (!__DEV__) {
        // In production, never fall back to plain storage for security-sensitive data.
        // If SecureStore fails, the PIN is simply unavailable — user must re-set it.
        console.error('[security] SecureStore.getItemAsync failed in production. PIN read aborted.', e)
        return null
      }
      return AsyncStorage.getItem(key)
    }
  }
  // Expo Go / dev fallback only
  if (__DEV__) return AsyncStorage.getItem(key)
  return null
}

async function secureSet(key: string, value: string) {
  const SecureStore = getSecureStore()
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
      return
    } catch (e) {
      if (!__DEV__) {
        // In production, never fall back to plain storage for PIN hash.
        console.error('[security] SecureStore.setItemAsync failed in production. PIN NOT stored.', e)
        return
      }
    }
  }
  // Expo Go / dev fallback only
  if (__DEV__) await AsyncStorage.setItem(key, value)
}

async function secureDelete(key: string) {
  const SecureStore = getSecureStore()
  if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch (e) {
      if (!__DEV__) {
        console.error('[security] SecureStore.deleteItemAsync failed in production.', e)
      }
    }
  }
  // Also remove from AsyncStorage in case it was written there during dev
  try {
    await AsyncStorage.removeItem(key)
  } catch {
    // Best-effort
  }
}

export const hashPin = async (pin: string) => {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin)
}

export const getStoredPinHash = async () => {
  return secureGet(PIN_HASH_KEY)
}

export const setStoredPinHash = async (pin: string) => {
  const hashed = await hashPin(pin)
  await secureSet(PIN_HASH_KEY, hashed)
  return hashed
}

export const clearStoredPinHash = async () => {
  await secureDelete(PIN_HASH_KEY)
}

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
    } catch {
      return AsyncStorage.getItem(key)
    }
  }
  return AsyncStorage.getItem(key)
}

async function secureSet(key: string, value: string) {
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

async function secureDelete(key: string) {
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

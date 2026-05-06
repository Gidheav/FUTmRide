import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

const PIN_HASH_KEY = 'app-lock-pin-hash'

export const hashPin = async (pin: string) => {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin)
}

export const getStoredPinHash = async () => {
  return SecureStore.getItemAsync(PIN_HASH_KEY)
}

export const setStoredPinHash = async (pin: string) => {
  const hashed = await hashPin(pin)
  await SecureStore.setItemAsync(PIN_HASH_KEY, hashed)
  return hashed
}

export const clearStoredPinHash = async () => {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY)
}

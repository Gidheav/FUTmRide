import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import {
  clearAuthTokens,
  getSecureItem,
  removeSecureItem,
  setSecureItem,
} from '../../utils/secureStorage'
import { useAuthStore, type AuthUser } from './authStore'
import { useSettingsStore, type SettingsState } from './settingsStore'
import { useAppLockStore, type DriverLockTimeoutMinutes } from './appLockStore'
import {
  useDriverRidesStore,
  type DriverProfileCache,
  type GaragePassenger,
  type GarageRide,
  type RideListItem,
  type SavedGarageRoute,
} from './driverRidesStore'
import {
  useDriverWalletStore,
  type WalletSummary,
  type WalletTransaction,
  type PayoutMethod,
  type DriverDocument,
} from './driverWalletStore'
import { useDriverProfileStore } from './driverProfileStore'
import { useGarageRideStore } from './garageRideStore'

const SANDBOX_SESSION_KEY = 'lr-ride:driver:sandbox:session:v1'
const SANDBOX_PIN_VERIFIER_KEY = 'lr-ride:driver:sandbox:pin-verifier:v1'
const PENDING_LOGOUTS_KEY = 'lr-ride:driver:pending-logouts:v1'

const USER_SCOPED_ASYNC_KEYS = [
  'driver-auth-store',
  'driver-settings-store',
  'driver-app-lock',
  'driver-rides-store',
  'driver-wallet-store',
  'driver-profile-store',
  'driver-garage-ride-store',
]

export type OfflinePinVerifier = {
  algorithm: 'sha256-iterated-v1' | string
  salt: string
  hash: string
  iterations: number
  user_id?: string
  updated_at?: string | null
}

export type PendingLogoutToken = {
  accessToken: string | null
  refreshToken: string
  queuedAt: number
}

export type DriverLocalSessionSnapshot = {
  schemaVersion: 1
  userId: string
  cachedAt: number
  loginClockStartedAt: number
  user: AuthUser
  settings: SettingsState
  lockTimeoutMinutes: DriverLockTimeoutMinutes
  profile: any | null
  wallet: {
    summary: WalletSummary | null
    transactions: WalletTransaction[]
    payoutMethod: PayoutMethod | null
    documents: DriverDocument[]
  }
  rides: {
    isOnline: boolean | null
    marketplaceRequests: RideListItem[]
    driverHasActiveRide: boolean
    garageRide: GarageRide | null
    garagePassengers: GaragePassenger[]
    savedRoutes: SavedGarageRoute[]
    driverProfile: DriverProfileCache | null
    rideHistory: RideListItem[]
  }
}

type LocalPinResult = 'matched' | 'mismatch' | 'missing'

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const compactTransactions = (transactions: WalletTransaction[]) => {
  return Array.isArray(transactions) ? transactions.slice(0, 50) : []
}

const compactRideHistory = (rides: RideListItem[]) => {
  return Array.isArray(rides) ? rides.slice(0, 50) : []
}

const hashOfflinePin = async (pin: string, verifier: OfflinePinVerifier) => {
  const iterations = Math.max(1, Math.min(Number(verifier.iterations || 1), 10000))
  const userId = verifier.user_id || ''
  let digest = String(pin)

  for (let index = 0; index < iterations; index += 1) {
    digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${verifier.salt}:${userId}:${index}:${digest}`,
    )
  }

  return digest
}

export const saveOfflinePinVerifier = async (verifier?: OfflinePinVerifier | null) => {
  if (!verifier?.salt || !verifier?.hash) return
  await setSecureItem(SANDBOX_PIN_VERIFIER_KEY, JSON.stringify(verifier))
}

export const getOfflinePinVerifier = async () => {
  return safeJsonParse<OfflinePinVerifier>(await getSecureItem(SANDBOX_PIN_VERIFIER_KEY))
}

export const verifyOfflinePin = async (pin: string, userId?: string | null): Promise<LocalPinResult> => {
  const verifier = await getOfflinePinVerifier()
  if (!verifier?.salt || !verifier?.hash) return 'missing'
  if (verifier.user_id && userId && String(verifier.user_id) !== String(userId)) return 'missing'
  if (verifier.algorithm !== 'sha256-iterated-v1') return 'missing'

  const hash = await hashOfflinePin(pin, verifier)
  return hash === verifier.hash ? 'matched' : 'mismatch'
}

export const readDriverSessionSnapshot = async () => {
  const snapshot = safeJsonParse<DriverLocalSessionSnapshot>(await getSecureItem(SANDBOX_SESSION_KEY))
  if (!snapshot || snapshot.schemaVersion !== 1 || !snapshot.user?.id) {
    return null
  }
  return snapshot
}

export const saveDriverSessionSnapshotFromStores = async (options?: {
  loginClockStartedAt?: number
  user?: AuthUser
  settings?: SettingsState
}) => {
  const user = options?.user || useAuthStore.getState().user
  if (!user?.id) return null

  const settingsState = options?.settings || useSettingsStore.getState().settings
  const walletState = useDriverWalletStore.getState()
  const ridesState = useDriverRidesStore.getState()
  const appLockState = useAppLockStore.getState()
  const profileState = useDriverProfileStore.getState()
  const previous = await readDriverSessionSnapshot()

  const snapshot: DriverLocalSessionSnapshot = {
    schemaVersion: 1,
    userId: String(user.id),
    cachedAt: Date.now(),
    loginClockStartedAt:
      options?.loginClockStartedAt ||
      previous?.loginClockStartedAt ||
      Date.now(),
    user,
    settings: settingsState,
    lockTimeoutMinutes: appLockState.lockTimeoutMinutes,
    profile: profileState.profile,
    wallet: {
      summary: walletState.summary,
      transactions: compactTransactions(walletState.transactions),
      payoutMethod: walletState.payoutMethod,
      documents: walletState.documents,
    },
    rides: {
      isOnline: ridesState.isOnline,
      marketplaceRequests: Array.isArray(ridesState.marketplaceRequests)
        ? ridesState.marketplaceRequests
        : [],
      driverHasActiveRide: ridesState.driverHasActiveRide,
      garageRide: ridesState.garageRide,
      garagePassengers: Array.isArray(ridesState.garagePassengers)
        ? ridesState.garagePassengers
        : [],
      savedRoutes: Array.isArray(ridesState.savedRoutes) ? ridesState.savedRoutes : [],
      driverProfile: ridesState.driverProfile,
      rideHistory: compactRideHistory(ridesState.rideHistory),
    },
  }

  await setSecureItem(SANDBOX_SESSION_KEY, JSON.stringify(snapshot))
  return snapshot
}

export const applyDriverSessionSnapshot = (snapshot: DriverLocalSessionSnapshot | null) => {
  if (!snapshot?.user?.id) return false

  useAuthStore.getState().setUser(snapshot.user)
  useSettingsStore.getState().hydrateFromCache(snapshot.settings)
  useAppLockStore.getState().setLockTimeoutMinutes(snapshot.lockTimeoutMinutes)
  useDriverProfileStore.getState().setProfile(snapshot.profile ?? null)

  const walletStore = useDriverWalletStore.getState()
  walletStore.setSummary(snapshot.wallet?.summary ?? null)
  walletStore.setTransactions(snapshot.wallet?.transactions ?? [])
  walletStore.setPayoutMethod(snapshot.wallet?.payoutMethod ?? null)
  walletStore.setDocuments(snapshot.wallet?.documents ?? [])

  const ridesStore = useDriverRidesStore.getState()
  ridesStore.setIsOnline(snapshot.rides?.isOnline ?? null)
  ridesStore.setMarketplaceRequests(snapshot.rides?.marketplaceRequests ?? [])
  ridesStore.setDriverHasActiveRide(Boolean(snapshot.rides?.driverHasActiveRide))
  ridesStore.setGarageRide(snapshot.rides?.garageRide ?? null)
  ridesStore.setGaragePassengers(snapshot.rides?.garagePassengers ?? [])
  ridesStore.setSavedRoutes(snapshot.rides?.savedRoutes ?? [])
  ridesStore.setDriverProfile(snapshot.rides?.driverProfile ?? null)
  ridesStore.setRideHistory(snapshot.rides?.rideHistory ?? [])
  useGarageRideStore
    .getState()
    .setStatus(snapshot.rides?.garageRide ? 'active' : 'inactive')

  return true
}

export const clearDriverSandbox = async () => {
  await Promise.all([
    clearAuthTokens(),
    removeSecureItem(SANDBOX_SESSION_KEY),
    removeSecureItem(SANDBOX_PIN_VERIFIER_KEY),
    AsyncStorage.multiRemove(USER_SCOPED_ASYNC_KEYS),
  ])
}

export const resetDriverRuntimeStores = () => {
  useSettingsStore.getState().reset()
  useDriverWalletStore.getState().reset()
  useDriverRidesStore.getState().reset()
  useDriverProfileStore.getState().reset()
  useGarageRideStore.getState().reset()
  useAppLockStore.getState().reset()
}

const readPendingLogoutTokens = async () => {
  return safeJsonParse<PendingLogoutToken[]>(await getSecureItem(PENDING_LOGOUTS_KEY)) || []
}

const writePendingLogoutTokens = async (items: PendingLogoutToken[]) => {
  if (!items.length) {
    await removeSecureItem(PENDING_LOGOUTS_KEY)
    return
  }
  await setSecureItem(PENDING_LOGOUTS_KEY, JSON.stringify(items.slice(-5)))
}

export const queuePendingLogoutToken = async (item: PendingLogoutToken) => {
  if (!item.refreshToken) return
  const current = await readPendingLogoutTokens()
  const deduped = current.filter((queued) => queued.refreshToken !== item.refreshToken)
  deduped.push(item)
  await writePendingLogoutTokens(deduped)
}

export const getPendingLogoutTokens = readPendingLogoutTokens

export const removePendingLogoutToken = async (refreshToken: string) => {
  const current = await readPendingLogoutTokens()
  await writePendingLogoutTokens(current.filter((item) => item.refreshToken !== refreshToken))
}

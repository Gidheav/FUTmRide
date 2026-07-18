import axios from 'axios'
import api, {
  API_ROOT_URL,
  authApi,
  classifyApiError,
  driverApi,
  driverWalletApi,
  kickoffProactiveRefresh,
  settingsApi,
} from './api'
import { useAuthStore, type AuthUser } from './authStore'
import { useSettingsStore, type SettingsApiPayload } from './settingsStore'
import { useDriverWalletStore } from './driverWalletStore'
import { useDriverRidesStore } from './driverRidesStore'
import { useDriverProfileStore } from './driverProfileStore'
import { getAuthTokens, setAuthTokens } from '../../utils/secureStorage'
import { useAppLockStore } from './appLockStore'
import { useGarageRideStore } from './garageRideStore'
import {
  applyDriverSessionSnapshot,
  clearDriverSandbox,
  getPendingLogoutTokens,
  queuePendingLogoutToken,
  readDriverSessionSnapshot,
  removePendingLogoutToken,
  resetDriverRuntimeStores,
  saveDriverSessionSnapshotFromStores,
  saveOfflinePinVerifier,
} from './driverSandbox'

export { kickoffProactiveRefresh, classifyApiError }

export type DriverSessionSnapshot = {
  user: AuthUser
  settings: SettingsApiPayload
}

export const isLikelyNetworkError = (error: any) => {
  return classifyApiError(error) === 'network'
}

export const getSessionErrorMessage = (error: any, fallback = 'Unable to verify your session.') => {
  if (isLikelyNetworkError(error)) {
    return 'No internet connection, please try again..'
  }

  const message = error?.response?.data?.error?.message
  if (typeof message === 'string' && message.trim()) {
    return message
  }

  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  return fallback
}

export const refreshDriverSessionTokens = async () => {
  const stored = await getAuthTokens()
  const refreshToken = useAuthStore.getState().refreshToken || stored.refreshToken

  if (!refreshToken) {
    throw new Error('NO_REFRESH_TOKEN')
  }

  const response = await axios.post(
    `${API_ROOT_URL}auth/token/refresh/`,
    { refresh: refreshToken },
    { timeout: 25000 },
  )
  const accessToken = response.data?.access
  const nextRefreshToken = response.data?.refresh || refreshToken

  if (!accessToken) {
    throw new Error('NO_ACCESS_TOKEN')
  }

  await setAuthTokens({ accessToken, refreshToken: nextRefreshToken })
  useAuthStore.getState().setTokens(accessToken, nextRefreshToken)

  return { accessToken, refreshToken: nextRefreshToken }
}

export const fetchDriverSessionSnapshot = async (): Promise<DriverSessionSnapshot> => {
  const [userResponse, settingsResponse] = await Promise.all([
    authApi.getMe(),
    settingsApi.getPreferences(),
  ])

  const user = userResponse.data as AuthUser
  if (user.role !== 'driver') {
    throw new Error('NOT_DRIVER')
  }

  const settings = settingsResponse.data as SettingsApiPayload
  useAuthStore.getState().setUser(user)
  useSettingsStore.getState().hydrateFromApi(settings)
  await saveOfflinePinVerifier(settings.offline_pin_verifier)

  return { user, settings }
}

export const refreshAndFetchDriverSession = async () => {
  await refreshDriverSessionTokens()
  return fetchDriverSessionSnapshot()
}

export const prefetchDriverEssentials = async () => {
  const walletStore = useDriverWalletStore.getState()
  const ridesStore = useDriverRidesStore.getState()
  const profileStore = useDriverProfileStore.getState()

  const [profileResult, walletResult, transactionsResult, garageResult, rideHistoryResult] = await Promise.allSettled([
    driverApi.getProfile(),
    driverWalletApi.getSummary(),
    driverWalletApi.getTransactions(),
    driverApi.getGarageRides(),
    driverApi.getRideHistory(),
  ])

  if (profileResult.status === 'fulfilled') {
    const profile = profileResult.value.data
    profileStore.setProfile(profile)
    ridesStore.setDriverProfile({ vehicle_type: profile?.vehicle_type ?? null })
    if (typeof profile?.is_online === 'boolean') {
      ridesStore.setIsOnline(profile.is_online)
    }
    if (typeof profile?.is_on_trip === 'boolean') {
      ridesStore.setDriverHasActiveRide(profile.is_on_trip)
    }
  }

  if (walletResult.status === 'fulfilled') {
    walletStore.setSummary(walletResult.value.data)
  }

  if (transactionsResult.status === 'fulfilled') {
    const transactions = Array.isArray(transactionsResult.value.data)
      ? transactionsResult.value.data
      : transactionsResult.value.data?.results || []
    walletStore.setTransactions(transactions.slice(0, 50))
  }

  if (garageResult.status === 'fulfilled') {
    const rides = Array.isArray(garageResult.value.data) ? garageResult.value.data : []
    const activeRide = rides.find((ride: any) => ['open', 'full', 'departed'].includes(String(ride.status)))
    ridesStore.setGarageRide(activeRide || null)

    if (activeRide?.id) {
      try {
        const passengers = await driverApi.getGaragePassengers(activeRide.id)
        ridesStore.setGaragePassengers(Array.isArray(passengers.data) ? passengers.data : [])
      } catch {
        ridesStore.setGaragePassengers([])
      }
    } else {
      ridesStore.setGaragePassengers([])
    }
  }

  if (rideHistoryResult.status === 'fulfilled') {
    const rides = Array.isArray(rideHistoryResult.value.data)
      ? rideHistoryResult.value.data
      : rideHistoryResult.value.data?.results || []
    ridesStore.setRideHistory(rides.slice(0, 50))
  }
}

export const pingDriverSession = async () => {
  await api.get('users/me/')
}

export const hydrateDriverSessionFromSandbox = async (expectedUserId?: string | null) => {
  const snapshot = await readDriverSessionSnapshot()
  if (!snapshot) return null
  if (expectedUserId && String(snapshot.userId) !== String(expectedUserId)) return null
  applyDriverSessionSnapshot(snapshot)
  return snapshot
}

export const syncDriverSessionInBackground = async () => {
  try {
    await fetchDriverSessionSnapshot()
    await prefetchDriverEssentials()
    await saveDriverSessionSnapshotFromStores()
    return true
  } catch (error) {
    return false
  }
}

export const completeDriverLogin = async (loginData: any) => {
  const user = loginData?.user as AuthUser | undefined
  const accessToken = loginData?.access
  const refreshToken = loginData?.refresh

  if (!user || user.role !== 'driver') {
    throw new Error('NOT_DRIVER')
  }
  if (!accessToken || !refreshToken) {
    throw new Error('MISSING_AUTH_TOKENS')
  }

  const loginClockStartedAt = Date.now()
  await setAuthTokens({ accessToken, refreshToken })

  let settingsPayload = loginData?.settings as SettingsApiPayload | undefined
  if (!settingsPayload) {
    try {
      const settingsResponse = await settingsApi.getPreferences()
      settingsPayload = settingsResponse.data as SettingsApiPayload
    } catch {
      settingsPayload = undefined
    }
  }

  if (settingsPayload) {
    useSettingsStore.getState().hydrateFromApi(settingsPayload)
    await saveOfflinePinVerifier(settingsPayload.offline_pin_verifier)
  }

  useAppLockStore.getState().setUnlocked()
  await saveDriverSessionSnapshotFromStores({
    user,
    settings: useSettingsStore.getState().settings,
    loginClockStartedAt,
  })
  useAuthStore.getState().setAuth(user, accessToken, refreshToken)
  void flushPendingDriverLogouts()
  void syncDriverSessionInBackground()
}

export const flushPendingDriverLogouts = async () => {
  const pending = await getPendingLogoutTokens()
  await Promise.allSettled(
    pending.map(async (item) => {
      if (!item.refreshToken) return
      try {
        await axios.post(
          `${API_ROOT_URL}auth/logout/`,
          { refresh: item.refreshToken },
          {
            timeout: 15000,
            headers: item.accessToken
              ? { Authorization: `Bearer ${item.accessToken}` }
              : undefined,
          },
        )
        await removePendingLogoutToken(item.refreshToken)
      } catch (error: any) {
        if (error?.response?.status && error.response.status < 500) {
          await removePendingLogoutToken(item.refreshToken)
        }
      }
    }),
  )
}

export const logoutDriverSession = async () => {
  const tokens = await getAuthTokens()
  if (tokens.refreshToken) {
    await queuePendingLogoutToken({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      queuedAt: Date.now(),
    })
    void flushPendingDriverLogouts()
  }

  await clearDriverSandbox()
  useAuthStore.getState().logout()
  resetDriverRuntimeStores()
}

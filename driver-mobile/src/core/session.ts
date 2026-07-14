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

  const [profileResult, walletResult, garageResult] = await Promise.allSettled([
    driverApi.getProfile(),
    driverWalletApi.getSummary(),
    driverApi.getGarageRides(),
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
}

export const pingDriverSession = async () => {
  await api.get('users/me/')
}

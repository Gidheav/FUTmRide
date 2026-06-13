import axios from 'axios'
import { useAuthStore } from './authStore'
import { useAppLockStore } from './appLockStore'
import { API_BASE_URL } from '../../config/apiConfig'
import { getAuthTokens, setAuthTokens } from '../../utils/secureStorage'

const normalizeBaseUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl)
    let path = url.pathname.replace(/\/+$/, '')

    if (!path.endsWith('/api/v1')) {
      if (path.endsWith('/v1')) {
        path = `${path.slice(0, -3)}/api/v1`
      } else {
        path = `${path}/api/v1`
      }
    }

    url.pathname = `${path}/`
    return url.toString()
  } catch {
    return rawUrl
  }
}

export const API_ROOT_URL = normalizeBaseUrl(API_BASE_URL)

const api = axios.create({
  baseURL: API_ROOT_URL,
  timeout: 25000,
})

api.interceptors.request.use(async (config) => {
  let token = useAuthStore.getState().accessToken
  if (!token) {
    const tokens = await getAuthTokens()
    token = tokens.accessToken
  }
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config
    const status = error?.response?.status

    if (
      status !== 401 ||
      !originalRequest ||
      (originalRequest as any)._retry ||
      String(originalRequest.url || '').includes('auth/token/refresh/')
    ) {
      throw error
    }

    ;(originalRequest as any)._retry = true

    try {
      const stored = await getAuthTokens()
      const refreshToken = useAuthStore.getState().refreshToken || stored.refreshToken

      if (!refreshToken) {
        throw error
      }

      const response = await axios.post(
        `${API_ROOT_URL}auth/token/refresh/`,
        { refresh: refreshToken },
        { timeout: 25000 },
      )
      const accessToken = response.data?.access
      const nextRefreshToken = response.data?.refresh || refreshToken

      if (!accessToken) {
        throw error
      }

      await setAuthTokens({ accessToken, refreshToken: nextRefreshToken })
      useAuthStore.getState().setTokens(accessToken, nextRefreshToken)
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${accessToken}`

      return api(originalRequest)
    } catch (refreshError) {
      useAppLockStore.getState().setLocked(true)
      throw refreshError
    }
  },
)

export const authApi = {
  getMe: () => api.get('users/me/'),
  updateMe: (data: any) => api.patch('users/me/', data),
}

export const driverApi = {
  getProfile: () => api.get('users/me/driver-profile/'),
  createProfile: (data: any) => api.post('users/me/driver-profile/create/', data),
  updateProfile: (data: any) => api.patch('users/me/driver-profile/', data),
  getActiveRide: () => api.get('rides/driver/active/'),
  advanceRide: (rideId: string) => api.post(`rides/${rideId}/advance/`),
  getMarketplaceRequests: (url?: string) => api.get(url || 'rides/driver/requests/'),
  acceptRideRequest: (rideId: string) => api.post(`rides/driver/requests/${rideId}/accept/`),
  getGarageRides: () => api.get('rides/garage/mine/'),
  createGarageRide: (data: any) => api.post('rides/garage/create/', data),
  departGarageRide: (rideId: string) => api.post(`rides/garage/${rideId}/depart/`),
  completeGarageRide: (rideId: string) => api.post(`rides/garage/${rideId}/complete/`),
  cancelGarageRide: (rideId: string) => api.post(`rides/garage/${rideId}/cancel/`),
  getGaragePassengers: (rideId: string) => api.get(`rides/garage/${rideId}/passengers/`),
  getSavedRoutes: () => api.get('rides/garage/routes/'),
  createSavedRoute: (data: any) => api.post('rides/garage/routes/', data),
  updateSavedRoute: (routeId: string, data: any) => api.patch(`rides/garage/routes/${routeId}/`, data),
  deleteSavedRoute: (routeId: string) => api.delete(`rides/garage/routes/${routeId}/`),
  pricingEstimate: (data: any) => api.post('pricing/estimate/', data),
  
  // Scheduled Rides
  getAvailableScheduledRides: (url?: string) => api.get(url || 'rides/scheduled/driver/available/'),
  expressInterestScheduledRide: (rideId: string) => api.post(`rides/scheduled/${rideId}/interest/`),
  cancelInterestScheduledRide: (rideId: string) => api.delete(`rides/scheduled/${rideId}/interest/`),
}

export const verificationApi = {
  // Driver: Account Verification
  getAccountStatus: () => api.get('verification/account/'),
  submitAccount: (formData: FormData) =>
    api.post('verification/account/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  resubmitAccount: (formData: FormData) =>
    api.patch('verification/account/resubmit/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Driver: Verification Progress
  getProgress: () => api.get('verification/progress/'),

  // Driver: Vehicle Documents
  uploadDocument: (formData: FormData) =>
    api.post('verification/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMyDocuments: () => api.get('verification/documents/'),
}

export const settingsApi = {
  getPreferences: () => api.get('auth/settings/preferences/'),
  updatePreferences: (data: any) => api.patch('auth/settings/preferences/', data),
  setPin: (data: any) => api.post('auth/settings/pin/set/', data),
  verifyPin: (data: any) => api.post('auth/settings/pin/verify/', data),
  startTwoFactor: (data: any) => api.post('auth/settings/2fa/start/', data),
  confirmTwoFactor: (data: any) => api.post('auth/settings/2fa/confirm/', data),
  disableTwoFactor: (data: any) => api.post('auth/settings/2fa/disable/', data),
  requestTwoFactor: (data: any) => api.post('auth/2fa/request/', data),
  verifyTwoFactor: (data: any) => api.post('auth/2fa/verify/', data),
}

export const driverWalletApi = {
  getSummary: () => api.get('wallet/driver/summary/'),
  getTransactions: () => api.get('wallet/transactions/'),
  getPayoutMethod: () => api.get('wallet/driver/payout-method/'),
  updatePayoutMethod: (data: any) => api.put('wallet/driver/payout-method/', data),
  requestWithdrawal: (data: any) => api.post('wallet/driver/withdrawals/', data),
}

export default api

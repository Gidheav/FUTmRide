import axios from 'axios'
import { useAuthStore } from './authStore'
import { API_BASE_URL } from '../../config/apiConfig'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from '../../utils/secureStorage'
import { isTokenNearExpiry } from '../../utils/jwt'
import { clearDriverSandbox, resetDriverRuntimeStores } from './driverSandbox'

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

// ─── Refresh mutex ────────────────────────────────────────────────────────────
// Only ONE token refresh request is ever in-flight at a time.
// Any concurrent 401 responses queue on the same promise instead of spawning
// a new refresh call. The lock is released (set to null) when the refresh
// settles, whether it succeeded or failed.

/** @type {Promise<string> | null} */
let _refreshPromise: Promise<string> | null = null

/**
 * Execute a single token refresh and return the new access token.
 * Callers should use getOrStartRefresh() to avoid duplicate in-flight requests.
 */
async function doRefresh(refreshToken: string): Promise<string> {
  const response = await axios.post(
    `${API_ROOT_URL}auth/token/refresh/`,
    { refresh: refreshToken },
    { timeout: 25000 },
  )
  const accessToken = response.data?.access
  const nextRefreshToken = response.data?.refresh || refreshToken

  if (!accessToken) {
    throw new Error('NO_ACCESS_TOKEN_IN_REFRESH_RESPONSE')
  }

  await setAuthTokens({ accessToken, refreshToken: nextRefreshToken })
  useAuthStore.getState().setTokens(accessToken, nextRefreshToken)

  return accessToken
}

/**
 * Get the in-flight refresh promise if one exists, or start a new one.
 * This is the mutex entry point — guarantees only one refresh at a time.
 */
function getOrStartRefresh(refreshToken: string): Promise<string> {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = doRefresh(refreshToken).finally(() => {
    _refreshPromise = null
  })
  return _refreshPromise
}

// ─── Request interceptor ─────────────────────────────────────────────────────

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

// ─── Response interceptor ─────────────────────────────────────────────────────
// Handles 401 Unauthorized:
//   1. If a refresh is already in flight (mutex), queue on it — NO new refresh call
//   2. If not, start a new refresh (sets the mutex)
//   3. On success: update Authorization header and retry the original request
//   4. On failure: clear all stored tokens and redirect cleanly to login
//      (NEVER send the user back to the lock screen on refresh failure)
//
// Auth errors (401/403) are classified separately from network errors.

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config
    const status = error?.response?.status

    // Only intercept 401s that haven't been retried and aren't the refresh endpoint
    if (
      status !== 401 ||
      !originalRequest ||
      (originalRequest as any)._authRetry === true ||
      String(originalRequest.url || '').includes('auth/token/refresh/')
    ) {
      throw error
    }

    // Mark as retried to prevent loops
    ;(originalRequest as any)._authRetry = true

    try {
      const stored = await getAuthTokens()
      const refreshToken = useAuthStore.getState().refreshToken || stored.refreshToken

      if (!refreshToken) {
        // No refresh token — session is definitely expired
        await _handleSessionExpired()
        throw new SessionExpiredError('No refresh token available.')
      }

      // Queue on the mutex — only one refresh fires regardless of how many
      // screens triggered a 401 simultaneously
      const newAccessToken = await getOrStartRefresh(refreshToken)

      // Retry original request with the fresh token
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)
    } catch (refreshError: any) {
      if (refreshError instanceof SessionExpiredError) throw refreshError

      // Refresh call itself failed (refresh token expired or server rejected it)
      // → clear all auth state and redirect to login cleanly.
      // NEVER call setLocked(true) here — that sends the user back to the lock
      // screen where they are permanently stuck.
      await _handleSessionExpired()
      throw new SessionExpiredError('Token refresh failed — please log in again.')
    }
  },
)

// ─── Session expiry handler ────────────────────────────────────────────────────

export class SessionExpiredError extends Error {
  public isSessionExpired = true
  constructor(message: string) {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

/**
 * Clear all auth state and redirect cleanly to login.
 * Called when the refresh token is expired or rejected by the server.
 */
async function _handleSessionExpired() {
  try {
    await clearAuthTokens()
    await clearDriverSandbox()
    useAuthStore.getState().logout()
    // Do NOT call useAppLockStore.setLocked(true) — that leaves the user
    // trapped on the lock screen with no way to recover.
    resetDriverRuntimeStores()
  } catch {
    // Best-effort cleanup
  }
}

// ─── Proactive refresh ─────────────────────────────────────────────────────────

/**
 * Check if the stored access token is expired or near expiry (within 60s), and
 * if so kick off a token refresh in the background WITHOUT blocking the caller.
 *
 * Call this immediately after PIN/biometric unlock succeeds (before navigation).
 * The refresh promise is stored in _refreshPromise so all subsequent API calls
 * via the 401 interceptor automatically queue on it.
 *
 * Returns the in-flight promise or null (if no refresh is needed).
 */
export async function kickoffProactiveRefresh(): Promise<string | null> {
  const stored = await getAuthTokens()
  const { accessToken, refreshToken } = stored

  if (!refreshToken) return null

  // If a refresh is already in flight, reuse it
  if (_refreshPromise) return _refreshPromise

  // Only refresh if the token is expired or within 60s of expiring
  if (!isTokenNearExpiry(accessToken, 60)) return null

  // Start refresh non-blocking — the caller does NOT await this
  return getOrStartRefresh(refreshToken)
}

// ─── Error classification ──────────────────────────────────────────────────────

/**
 * Classify an API error so screens show the correct message/UI.
 *
 * @returns 'network' | 'auth' | 'session_expired' | 'server' | 'unknown'
 */
export function classifyApiError(error: any): 'network' | 'auth' | 'session_expired' | 'server' | 'unknown' {
  if (error instanceof SessionExpiredError || error?.isSessionExpired) return 'session_expired'
  if (!error?.response) return 'network'              // no response = offline / timeout / DNS
  const status = error.response.status
  if (status === 401 || status === 403) return 'auth'
  if (status >= 500) return 'server'
  return 'unknown'
}

// ─── API namespaces ──────────────────────────────────────────────────────────

export const authApi = {
  getMe: () => api.get('users/me/'),
  updateMe: (data: any) => api.patch('users/me/', data),
  updateProfilePhoto: (formData: FormData) =>
    api.patch('users/me/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

export const driverApi = {
  getProfile: () => api.get('users/me/driver-profile/'),
  createProfile: (data: any) => api.post('users/me/driver-profile/create/', data),
  updateProfile: (data: any) => api.patch('users/me/driver-profile/', data),
  updateAvailability: (data: any) => api.patch('users/me/driver-profile/availability/', data),
  getActiveRide: () => api.get('rides/driver/active/'),
  getRideHistory: () => api.get('rides/driver/history/'),
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

export const notificationsApi = {
  getNotifications: () => api.get('notifications/'),
  markAsRead: (id: string) => api.post(`notifications/${id}/read/`),
  markAllAsRead: () => api.post('notifications/mark-all-read/'),
  getUnreadCount: () => api.get('notifications/unread-count/'),
}

export default api

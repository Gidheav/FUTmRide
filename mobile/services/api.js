import axios from 'axios'
import { API_BASE_URL } from '../config/apiConfig'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from '../utils/secureStorage'
import { isTokenNearExpiry } from '../utils/jwt'

// ─── Axios instance ──────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
})

export async function blacklistRefreshToken(refreshToken, accessToken) {
  if (!refreshToken) return
  await axios.post(
    `${API_BASE_URL}auth/logout/`,
    { refresh: refreshToken },
    {
      timeout: 10000,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    },
  )
}

// ─── Refresh mutex ───────────────────────────────────────────────────────────
// Only ONE token refresh request is ever in-flight at a time.
// Any concurrent 401 responses queue on the same promise instead of spawning
// a new refresh call. The lock is released (set to null) when the refresh
// settles, whether it succeeded or failed.

/** @type {Promise<string> | null} */
let _refreshPromise = null

/**
 * Execute a single token refresh and return the new access token.
 * Callers should use getOrStartRefresh() to avoid duplicate in-flight requests.
 *
 * @param {string} refreshToken
 * @returns {Promise<string>} The new access token
 */
async function doRefresh(refreshToken) {
  const response = await axios.post(
    `${API_BASE_URL}auth/token/refresh/`,
    { refresh: refreshToken },
    { timeout: 20000 },
  )
  const accessToken = response.data?.access
  const nextRefreshToken = response.data?.refresh || refreshToken

  if (!accessToken) {
    throw new Error('NO_ACCESS_TOKEN_IN_REFRESH_RESPONSE')
  }

  // Persist to SecureStore and in-memory cache immediately
  await setAuthTokens({ accessToken, refreshToken: nextRefreshToken })

  // Also update Zustand if it has been imported (avoid circular deps by lazy import)
  try {
    const { useAuthStore } = require('../src/core/authStore')
    useAuthStore.getState().setTokens(accessToken, nextRefreshToken)
  } catch {
    // authStore not available (e.g. during cold start) — SecureStore is enough
  }

  return accessToken
}

/**
 * Get the in-flight refresh promise if one exists, or start a new one.
 * This is the mutex entry point — guarantees only one refresh at a time.
 *
 * @param {string} refreshToken
 * @returns {Promise<string>}
 */
function getOrStartRefresh(refreshToken) {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = doRefresh(refreshToken).finally(() => {
    _refreshPromise = null
  })
  return _refreshPromise
}

// ─── Request interceptor ─────────────────────────────────────────────────────
// Attach the latest access token to every outgoing request.
// Reads from SecureStore (which has an in-memory cache) so it works even
// before Zustand has been hydrated.

api.interceptors.request.use(async (config) => {
  const tokens = await getAuthTokens()
  const token = tokens?.accessToken
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response interceptor ────────────────────────────────────────────────────
// Handles 401 Unauthorized:
//   1. If a refresh is already in flight, queue on it (mutex)
//   2. If not, start a new refresh
//   3. On success: update Authorization header and retry the original request
//   4. On failure: clear all stored tokens and emit a SESSION_EXPIRED event
//      so the app can redirect to login without leaving the user stuck
//
// Auth errors (401/403) are NEVER reported as "network errors".

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config
    const status = error?.response?.status

    // Only intercept 401s that haven't been retried yet and aren't the refresh
    // endpoint itself (to avoid an infinite refresh loop)
    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._authRetry === true ||
      String(originalRequest.url || '').includes('auth/token/refresh/')
    ) {
      throw error
    }

    // Mark this request as having already attempted a retry
    originalRequest._authRetry = true

    try {
      const stored = await getAuthTokens()
      const refreshToken = stored?.refreshToken

      if (!refreshToken) {
        // No refresh token — session is definitely expired
        await _handleSessionExpired()
        throw new SessionExpiredError('No refresh token available.')
      }

      // Queue on the mutex — only one refresh fires regardless of how many
      // screens triggered a 401 simultaneously
      const newAccessToken = await getOrStartRefresh(refreshToken)

      // Retry the original request with the fresh token
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      if (refreshError instanceof SessionExpiredError) throw refreshError

      // Refresh call itself failed (e.g. refresh token expired or server rejected)
      await _handleSessionExpired()
      throw new SessionExpiredError('Token refresh failed.')
    }
  },
)

// ─── Session expiry handler ───────────────────────────────────────────────────

class SessionExpiredError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SessionExpiredError'
    this.isSessionExpired = true
  }
}

export { SessionExpiredError }

/**
 * Clear all auth state and notify the app that the session has expired.
 * Components listen for the SESSION_EXPIRED event via the emitter
 * (see useSessionExpiredListener in index.tsx).
 */
async function _handleSessionExpired() {
  try {
    await clearAuthTokens()
    try {
      const { clearStudentSandbox, resetStudentRuntimeStores } = require('../src/core/studentSandbox')
      await clearStudentSandbox()
      resetStudentRuntimeStores()
    } catch {
      // Student sandbox may not be loaded yet.
    }
    const { useAuthStore } = require('../src/core/authStore')
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      loginAt: null,
    })
  } catch {
    // Best-effort: even if the store isn't ready, the user will hit the
    // login screen on the next render cycle because isAuthenticated will be false.
  }
}

// ─── Proactive refresh ───────────────────────────────────────────────────────

/**
 * Check if the stored access token is expired or near expiry, and if so
 * kick off a token refresh in the background WITHOUT blocking the caller.
 *
 * Call this immediately after PIN/biometric unlock succeeds.
 * The refresh promise is stored in _refreshPromise so all subsequent API calls
 * via the 401 interceptor automatically queue on it if they get a 401.
 *
 * Returns the in-flight promise (or null if no refresh is needed) so callers
 * can optionally await it if they want to guarantee freshness.
 *
 * @returns {Promise<string> | null}
 */
export async function kickoffProactiveRefresh() {
  const stored = await getAuthTokens()
  const { accessToken, refreshToken } = stored ?? {}

  if (!refreshToken) return null

  // If a refresh is already in flight, reuse it
  if (_refreshPromise) return _refreshPromise

  // Only refresh if the token is expired or within 60s of expiring
  if (!isTokenNearExpiry(accessToken, 60)) return null

  // Start the refresh — non-blocking for the caller.
  // _refreshPromise is now set, so any concurrent 401 interceptors will queue
  // on this same promise rather than spawning duplicate refresh calls.
  return getOrStartRefresh(refreshToken)
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const setApiBaseUrl = (nextBaseUrl) => {
  api.defaults.baseURL = nextBaseUrl
}

/**
 * Classify an error correctly so screens show the right message.
 *
 * @param {any} error
 * @returns {'network' | 'auth' | 'session_expired' | 'server' | 'unknown'}
 */
export function classifyApiError(error) {
  if (error instanceof SessionExpiredError || error?.isSessionExpired) return 'session_expired'
  if (!error?.response) return 'network'                       // no response = no internet / timeout
  const status = error.response.status
  if (status === 401 || status === 403) return 'auth'
  if (status >= 500) return 'server'
  return 'unknown'
}

export default api

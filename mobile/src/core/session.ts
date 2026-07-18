import axios from 'axios'
import api, { kickoffProactiveRefresh as _kickoffFromApi, SessionExpiredError } from '../../services/api'
import { API_BASE_URL } from '../../config/apiConfig'
import { getAuthTokens, setAuthTokens } from '../../utils/secureStorage'
import { useAuthStore, type AuthUser } from './authStore'
import { useSecurityStore } from './securityStore'
import { useWalletStore } from './walletStore'
import {
  clearStudentSandbox,
  getPendingLogoutTokens,
  hydrateStudentSessionFromSandbox,
  queuePendingLogoutToken,
  removePendingLogoutToken,
  resetStudentRuntimeStores,
  saveStudentSessionSnapshotFromStores,
} from './studentSandbox'

export type { SessionExpiredError }
export { kickoffProactiveRefresh } from '../../services/api'
export { saveStudentSessionSnapshotFromStores } from './studentSandbox'

export type RefreshResponse = {
  access: string
  refresh?: string
}

/**
 * Refresh the student session tokens using the refresh token from SecureStore.
 *
 * Unlike the old `refreshSession()`, this reads the refresh token directly
 * from SecureStore (which has an in-memory cache) — it does NOT depend on
 * Zustand being hydrated yet. Safe to call immediately after cold start.
 *
 * @throws if the refresh token is missing or the server rejects it
 */
export const refreshStudentSessionTokens = async (): Promise<{
  accessToken: string
  refreshToken: string
}> => {
  const stored = await getAuthTokens()
  const refreshToken = stored?.refreshToken

  if (!refreshToken) {
    throw new Error('NO_REFRESH_TOKEN')
  }

  const response = await axios.post<RefreshResponse>(
    `${API_BASE_URL}auth/token/refresh/`,
    { refresh: refreshToken },
    { timeout: 20000 },
  )

  const accessToken = response.data?.access
  const nextRefreshToken = response.data?.refresh || refreshToken

  if (!accessToken) {
    throw new Error('NO_ACCESS_TOKEN_IN_REFRESH_RESPONSE')
  }

  await setAuthTokens({ accessToken, refreshToken: nextRefreshToken })

  return { accessToken, refreshToken: nextRefreshToken }
}

/**
 * @deprecated Use refreshStudentSessionTokens() directly.
 * Kept for backwards compatibility during migration.
 */
export const refreshSession = async (refreshToken: string): Promise<RefreshResponse> => {
  const stored = await getAuthTokens()
  const token = refreshToken || stored?.refreshToken
  if (!token) throw new Error('NO_REFRESH_TOKEN')
  const res = await api.post<RefreshResponse>('auth/token/refresh/', { refresh: token })
  return res.data
}

/**
 * Fetch the currently authenticated student's profile.
 */
export const fetchCurrentUser = async () => {
  const res = await api.get('users/me/')
  return res.data
}

export const syncStudentSessionInBackground = async () => {
  try {
    const profile = await fetchCurrentUser()
    if (profile?.role === 'student') {
      useAuthStore.getState().setUser(profile)
      if (profile.wallet_balance !== undefined) {
        useWalletStore.getState().setWalletBalance(profile.wallet_balance)
      }
      await saveStudentSessionSnapshotFromStores({ user: profile })
    }
    return true
  } catch {
    return false
  }
}

export const hydrateStudentSessionSnapshot = hydrateStudentSessionFromSandbox

export const completeStudentLogin = async (loginData: any) => {
  const user = loginData?.user as AuthUser | undefined
  const accessToken = loginData?.access
  const refreshToken = loginData?.refresh

  if (!user || user.role !== 'student') {
    throw new Error('NOT_STUDENT')
  }
  if (!accessToken || !refreshToken) {
    throw new Error('MISSING_AUTH_TOKENS')
  }

  const loginClockStartedAt = Date.now()
  await setAuthTokens({ accessToken, refreshToken })

  const security = useSecurityStore.getState()
  security.setLastUnlockAt(loginClockStartedAt)
  security.setLocked(false)

  if (user.wallet_balance !== undefined) {
    useWalletStore.getState().setWalletBalance(user.wallet_balance)
  }

  await saveStudentSessionSnapshotFromStores({ user, loginClockStartedAt })
  useAuthStore.getState().setAuth(user, accessToken, refreshToken)
  void flushPendingStudentLogouts()
  void syncStudentSessionInBackground()
}

export const flushPendingStudentLogouts = async () => {
  const pending = await getPendingLogoutTokens()
  await Promise.allSettled(
    pending.map(async (item) => {
      if (!item.refreshToken) return
      try {
        await axios.post(
          `${API_BASE_URL}auth/logout/`,
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

export const logoutStudentSession = async () => {
  const auth = useAuthStore.getState()
  const stored = await getAuthTokens()
  const refreshToken = auth.refreshToken || stored.refreshToken
  const accessToken = auth.accessToken || stored.accessToken

  if (refreshToken) {
    await queuePendingLogoutToken({
      accessToken,
      refreshToken,
      queuedAt: Date.now(),
    })
    void flushPendingStudentLogouts()
  }

  await clearStudentSandbox()
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    loginAt: null,
  })
  resetStudentRuntimeStores()
}

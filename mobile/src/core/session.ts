import axios from 'axios'
import api, { kickoffProactiveRefresh as _kickoffFromApi, SessionExpiredError } from '../../services/api'
import { API_BASE_URL } from '../../config/apiConfig'
import { getAuthTokens, setAuthTokens } from '../../utils/secureStorage'
import { isTokenNearExpiry } from '../../utils/jwt'

export type { SessionExpiredError }
export { kickoffProactiveRefresh } from '../../services/api'

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

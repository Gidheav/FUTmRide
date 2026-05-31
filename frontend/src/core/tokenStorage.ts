const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

/** Prefer sessionStorage so tokens are cleared when the browser tab closes. */
export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY) || localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.setItem(ACCESS_KEY, accessToken)
  sessionStorage.setItem(REFRESH_KEY, refreshToken)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

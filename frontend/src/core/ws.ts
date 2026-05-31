/** Open an authenticated WebSocket without putting the JWT in the URL query string. */
export function createAuthenticatedWebSocket(path: string): WebSocket | null {
  const token =
    sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
  if (!token) return null

  const base = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8002'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new WebSocket(`${base}${normalizedPath}`, [`access_token.${token}`])
}

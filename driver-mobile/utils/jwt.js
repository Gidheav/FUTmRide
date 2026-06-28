/**
 * Lightweight JWT payload decoder.
 * Only base64-decodes the middle segment — no signature verification.
 * Used to read the `exp` claim for proactive token refresh decisions.
 */

/**
 * Decode the payload of a JWT without verifying the signature.
 * Returns null if the token is missing, malformed, or un-parseable.
 *
 * @param {string | null | undefined} token
 * @returns {{ exp?: number, iat?: number, [key: string]: any } | null}
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    // Fix base64url padding
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64.length % 4
    if (pad === 2) base64 += '=='
    else if (pad === 3) base64 += '='
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Returns the number of seconds remaining until the token expires.
 * Returns 0 if the token is already expired or unreadable.
 *
 * @param {string | null | undefined} token
 * @returns {number}
 */
export function tokenSecondsRemaining(token) {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return 0
  const remaining = payload.exp - Math.floor(Date.now() / 1000)
  return Math.max(0, remaining)
}

/**
 * Returns true if the token is expired or within `thresholdSeconds` of expiring.
 *
 * @param {string | null | undefined} token
 * @param {number} [thresholdSeconds=60]
 * @returns {boolean}
 */
export function isTokenNearExpiry(token, thresholdSeconds = 60) {
  return tokenSecondsRemaining(token) <= thresholdSeconds
}

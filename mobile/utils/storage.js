/**
 * @deprecated
 * This module is deprecated and kept only for backward compatibility.
 * All token storage now goes through `utils/secureStorage.js` which uses
 * expo-secure-store on real devices (encrypts tokens at rest).
 *
 * DO NOT use this module for new code. Update any remaining imports to:
 *   import { getAuthTokens, setAuthTokens, clearAuthTokens } from './secureStorage'
 */

import {
  getAuthTokens as _getAuthTokens,
  setAuthTokens as _setAuthTokens,
  clearAuthTokens as _clearAuthTokens,
} from './secureStorage'

function _warnDeprecated(fnName) {
  if (__DEV__) {
    console.warn(
      `[storage.js] ${fnName}() called via deprecated utils/storage.js. ` +
      `Please update this import to utils/secureStorage.js.`
    )
  }
}

/** @deprecated Use getAuthTokens from utils/secureStorage.js */
export const getAuthTokens = async () => {
  _warnDeprecated('getAuthTokens')
  return _getAuthTokens()
}

/** @deprecated Use setAuthTokens from utils/secureStorage.js */
export const setAuthTokens = async (tokens) => {
  _warnDeprecated('setAuthTokens')
  return _setAuthTokens(tokens)
}

/** @deprecated Use clearAuthTokens from utils/secureStorage.js */
export const clearAuthTokens = async () => {
  _warnDeprecated('clearAuthTokens')
  return _clearAuthTokens()
}

import AsyncStorage from '@react-native-async-storage/async-storage'

const ACCESS_TOKEN_KEY = 'lr-ride:auth:access'
const REFRESH_TOKEN_KEY = 'lr-ride:auth:refresh'

let cachedTokens = null
let cacheReady = false

export const getAuthTokens = async () => {
  if (cacheReady) return cachedTokens
  const entries = await AsyncStorage.multiGet([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY])
  const accessEntry = entries.find(([key]) => key === ACCESS_TOKEN_KEY)
  const refreshEntry = entries.find(([key]) => key === REFRESH_TOKEN_KEY)
  cachedTokens = {
    accessToken: accessEntry?.[1] || null,
    refreshToken: refreshEntry?.[1] || null,
  }
  cacheReady = true
  return cachedTokens
}

export const setAuthTokens = async ({ accessToken, refreshToken }) => {
  cachedTokens = {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
  }
  cacheReady = true

  const toSet = []
  const toRemove = []

  if (accessToken) {
    toSet.push([ACCESS_TOKEN_KEY, String(accessToken)])
  } else {
    toRemove.push(ACCESS_TOKEN_KEY)
  }

  if (refreshToken) {
    toSet.push([REFRESH_TOKEN_KEY, String(refreshToken)])
  } else {
    toRemove.push(REFRESH_TOKEN_KEY)
  }

  if (toSet.length) {
    await AsyncStorage.multiSet(toSet)
  }
  if (toRemove.length) {
    await AsyncStorage.multiRemove(toRemove)
  }
}

export const clearAuthTokens = async () => {
  cachedTokens = { accessToken: null, refreshToken: null }
  cacheReady = true
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY])
}

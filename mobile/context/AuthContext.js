import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from '../utils/secureStorage'

const AuthContext = createContext({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  hydrate: async () => {},
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [refreshToken, setRefreshToken] = useState(null)
  const [loading, setLoading] = useState(true)

  const hydrate = useCallback(async () => {
    setLoading(true)
    try {
      const tokens = await getAuthTokens()
      setAccessToken(tokens?.accessToken || null)
      setRefreshToken(tokens?.refreshToken || null)
      if (tokens?.accessToken) {
        const profileRes = await api.get('users/me/', {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        })
        setUser(profileRes.data)
      } else {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const login = useCallback(async (email, password) => {
    const loginRes = await api.post('auth/login/', { email, password })
    const access = loginRes.data?.access
    const refresh = loginRes.data?.refresh
    await setAuthTokens({ accessToken: access, refreshToken: refresh })
    setAccessToken(access || null)
    setRefreshToken(refresh || null)
    const userRes = await api.get('users/me/', {
      headers: { Authorization: `Bearer ${access}` },
    })
    setUser(userRes.data)
    return userRes.data
  }, [])

  const register = useCallback(async (payload) => {
    await api.post('auth/register/', payload)
  }, [])

  const logout = useCallback(async () => {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    await clearAuthTokens()
  }, [])

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken),
      loading,
      login,
      register,
      logout,
      hydrate,
    }),
    [user, accessToken, refreshToken, loading, login, register, logout, hydrate]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export default AuthContext

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from '../../utils/secureStorage'
import { createJSONStorage, persist } from 'zustand/middleware'

export type UserRole = 'student' | 'driver'

export interface AuthUser {
  id: string
  phone_number: string
  full_name: string
  first_name?: string
  last_name?: string
  email: string
  role: UserRole
  profile_photo?: string | null
  wallet_balance?: string
  fcm_token?: string | null
  campus?: { id?: string | number | null; name?: string | null } | null
}

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  /** True once Zustand has rehydrated from AsyncStorage AND SecureStore tokens are loaded */
  hasHydrated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setUser: (user: AuthUser) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  /**
   * Load access/refresh tokens from SecureStore into the Zustand store.
   * Must be called once on app boot (before any authenticated API calls).
   * Safe to call multiple times — no-ops if tokens are already populated.
   */
  hydrateTokens: () => Promise<{ accessToken: string | null; refreshToken: string | null }>
  setHasHydrated: (value: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,

      setAuth: (user, accessToken, refreshToken) => {
        void setAuthTokens({ accessToken, refreshToken })
        return set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        })
      },

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => {
        void setAuthTokens({ accessToken, refreshToken })
        return set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        })
      },

      hydrateTokens: async () => {
        const tokens = await getAuthTokens()
        const currentUser = get().user
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          // Only mark authenticated if we have a user AND at least a refresh token
          isAuthenticated: Boolean(currentUser && tokens.refreshToken),
        })
        return tokens
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),

      logout: () => {
        void clearAuthTokens()
        return set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user identity to AsyncStorage — tokens live in SecureStore
      // and are loaded via hydrateTokens() on boot.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

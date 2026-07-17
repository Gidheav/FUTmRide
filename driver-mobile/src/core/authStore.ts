import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from '../../utils/secureStorage'

export type UserRole = 'driver' | 'student' | 'campus_admin' | 'admin'

export interface AuthUser {
  id: string
  phone_number: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  home_address?: string
  campus?: { id: string; name: string } | null
  role: UserRole
  is_verified?: boolean
  is_phone_verified?: boolean
  profile_photo?: string | null
  wallet_balance?: string
  fcm_token?: string | null
}

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  hasHydrated: boolean
  loginCompletedAt: number | null
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  /** Replace whole user object (from API response) */
  setUser: (user: AuthUser) => void
  /** Merge partial fields into existing user without overwriting others */
  patchUser: (patch: Partial<AuthUser>) => void
  setTokens: (accessToken: string, refreshToken: string) => void
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
      loginCompletedAt: null,

      setAuth: (user, accessToken, refreshToken) => {
        void setAuthTokens({ accessToken, refreshToken })
        return set({ user, accessToken, refreshToken, isAuthenticated: true, loginCompletedAt: Date.now() })
      },

      setUser: (user) => set({ user }),

      patchUser: (patch) => {
        const current = get().user
        if (current) set({ user: { ...current, ...patch } })
      },

      setTokens: (accessToken, refreshToken) => {
        void setAuthTokens({ accessToken, refreshToken })
        return set({ accessToken, refreshToken, isAuthenticated: true })
      },

      hydrateTokens: async () => {
        const tokens = await getAuthTokens()
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: Boolean(get().user && tokens.refreshToken),
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
          loginCompletedAt: null,
        })
      },
    }),
    {
      name: 'driver-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
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

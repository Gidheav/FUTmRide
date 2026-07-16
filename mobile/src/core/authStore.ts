import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { clearAuthTokens, getAuthTokens, setAuthTokens } from '../../utils/secureStorage'
import { blacklistRefreshToken } from '../../services/api'
import { createJSONStorage, persist } from 'zustand/middleware'
import { clearStoredPinHash } from './security'
import { useSecurityStore } from './securityStore'

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

/** Maximum number of days a session stays valid for PIN-only unlock. */
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  /** Timestamp (ms) of the last successful email+password login. Used for 14-day session window. */
  loginAt: number | null
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
  /** Check if the 14-day session window has expired. */
  isSessionExpired: () => boolean
  /**
   * Full logout — clears auth tokens, PIN hash, security state, and wallet state.
   * Safe to call from any context. Prevents cross-user contamination on shared devices.
   */
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      loginAt: null,
      hasHydrated: false,

      setAuth: (user, accessToken, refreshToken) => {
        void setAuthTokens({ accessToken, refreshToken })
        return set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          loginAt: Date.now(),
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

      isSessionExpired: () => {
        const { loginAt } = get()
        if (!loginAt) return true
        return (Date.now() - loginAt) > SESSION_MAX_AGE_MS
      },

      logout: () => {
        const currentAccessToken = get().accessToken
        const currentRefreshToken = get().refreshToken
        void getAuthTokens()
          .then((storedTokens) => blacklistRefreshToken(
            currentRefreshToken || storedTokens.refreshToken,
            currentAccessToken || storedTokens.accessToken,
          ))
          .catch(() => {
            // Local logout must still complete if the server is unreachable.
          })
        // Clear auth tokens from SecureStore
        void clearAuthTokens()
        // Clear PIN hash from SecureStore
        void clearStoredPinHash()
        // Reset security store (appLock, biometric, PIN flags, etc.)
        try {
          useSecurityStore.getState().resetForLogout()
        } catch {
          // Security store may not be available during early boot — best effort
        }
        // Reset wallet store (balance, activity key)
        try {
          const { useWalletStore } = require('./walletStore')
          ;(useWalletStore as any).getState().resetForLogout()
        } catch {
          // Wallet store may not be available — best effort
        }
        // Reset student profile cache
        try {
          const { useStudentProfileStore } = require('./studentProfileStore')
          ;(useStudentProfileStore as any).getState().clearAllProfiles?.()
        } catch {
          // Profile store may not be available — best effort
        }
        return set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          loginAt: null,
        })
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user identity + session metadata to AsyncStorage — tokens live in SecureStore
      // and are loaded via hydrateTokens() on boot.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        loginAt: state.loginAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

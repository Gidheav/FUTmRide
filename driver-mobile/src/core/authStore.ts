import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

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
}

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  /** Replace whole user object (from API response) */
  setUser: (user: AuthUser) => void
  /** Merge partial fields into existing user without overwriting others */
  patchUser: (patch: Partial<AuthUser>) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      patchUser: (patch) => {
        const current = get().user
        if (current) set({ user: { ...current, ...patch } })
      },

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'driver-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

export type UserRole = 'student' | 'driver'

export interface AuthUser {
  id: string
  phone_number: string
  full_name: string
  email: string
  role: UserRole
  profile_photo?: string | null
  fcm_token?: string | null
}

interface AuthStore {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setUser: (user: AuthUser) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),
      setUser: (user) =>
        set({
          user,
        }),
      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

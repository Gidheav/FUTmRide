import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearTokens, setTokens } from './tokenStorage'

export type UserRole = 'student' | 'driver' | 'admin' | 'campus_admin'

export interface AuthUser {
  id: string
  full_name: string
  first_name: string
  last_name: string
  phone_number: string
  email: string | null
  role: UserRole
  profile_photo: string | null
  is_verified: boolean
  is_phone_verified: boolean
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  updateUser: (updates: Partial<AuthUser>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        setTokens(accessToken, refreshToken)
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearAuth: () => {
        clearTokens()
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'futminna-ride-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
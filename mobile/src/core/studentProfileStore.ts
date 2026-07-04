import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AuthUser } from './authStore'

export type StudentProfile = {
  matric_number?: string | null
  department?: string | null
  level?: number | null
  campus?: { id?: string | number | null; name?: string | null } | null
}

type CachedStudentProfile = {
  studentProfile: StudentProfile | null
  userProfile: Partial<AuthUser> | null
  lastUpdatedAt: number
}

interface StudentProfileStore {
  profilesByUserId: Record<string, CachedStudentProfile>
  setStudentProfile: (userId: string, profile: StudentProfile | null) => void
  setUserProfile: (userId: string, profile: Partial<AuthUser> | null) => void
  clearUserProfile: (userId: string) => void
}

export const useStudentProfileStore = create<StudentProfileStore>()(
  persist(
    (set) => ({
      profilesByUserId: {},

      setStudentProfile: (userId, profile) =>
        set((state) => ({
          profilesByUserId: {
            ...state.profilesByUserId,
            [userId]: {
              studentProfile: profile,
              userProfile: state.profilesByUserId[userId]?.userProfile ?? null,
              lastUpdatedAt: Date.now(),
            },
          },
        })),

      setUserProfile: (userId, profile) =>
        set((state) => ({
          profilesByUserId: {
            ...state.profilesByUserId,
            [userId]: {
              studentProfile: state.profilesByUserId[userId]?.studentProfile ?? null,
              userProfile: profile,
              lastUpdatedAt: Date.now(),
            },
          },
        })),

      clearUserProfile: (userId) =>
        set((state) => {
          const next = { ...state.profilesByUserId }
          delete next[userId]
          return { profilesByUserId: next }
        }),
    }),
    {
      name: 'student-profile-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)

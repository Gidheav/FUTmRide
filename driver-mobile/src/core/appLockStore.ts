import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

export type DriverLockTimeoutMinutes = 0 | 0.25 | 0.5 | 1 | 5 | 15 | 30

export const MAX_DRIVER_UNLOCK_MINUTES = 30

interface AppLockState {
  isLocked: boolean
  lastUnlockedAt: number | null
  lockTimeoutMinutes: DriverLockTimeoutMinutes
  setLocked: (value: boolean) => void
  setUnlocked: () => void
  setLockTimeoutMinutes: (value: DriverLockTimeoutMinutes) => void
  reset: () => void
}

export const isDriverUnlockFresh = (
  lastUnlockedAt: number | null,
  timeoutMinutes: DriverLockTimeoutMinutes,
) => {
  if (!lastUnlockedAt) return false
  if (timeoutMinutes === 0) return true
  const cappedTimeout = Math.min(timeoutMinutes, MAX_DRIVER_UNLOCK_MINUTES)
  return Date.now() - lastUnlockedAt < cappedTimeout * 60 * 1000
}

export const useAppLockStore = create<AppLockState>()(
  persist(
    (set) => ({
      isLocked: true,
      lastUnlockedAt: null,
      lockTimeoutMinutes: 15,
      setLocked: (value) => set({ isLocked: value }),
      setUnlocked: () => set({ isLocked: false, lastUnlockedAt: Date.now() }),
      setLockTimeoutMinutes: (value) => set({ lockTimeoutMinutes: value }),
      reset: () => set({ isLocked: true, lastUnlockedAt: null }),
    }),
    {
      name: 'driver-app-lock',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted: any) => ({
        lockTimeoutMinutes: persisted?.lockTimeoutMinutes ?? 15,
        isLocked: true,
        lastUnlockedAt: null,
      }),
      partialize: (state) => ({
        lockTimeoutMinutes: state.lockTimeoutMinutes,
      }),
    }
  )
)

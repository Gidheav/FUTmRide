import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AppLockState {
  isLocked: boolean
  lastUnlockedAt: number | null
  setLocked: (value: boolean) => void
  setUnlocked: () => void
  reset: () => void
}

export const useAppLockStore = create<AppLockState>()(
  persist(
    (set) => ({
      isLocked: true,
      lastUnlockedAt: null,
      setLocked: (value) => set({ isLocked: value }),
      setUnlocked: () => set({ isLocked: false, lastUnlockedAt: Date.now() }),
      reset: () => set({ isLocked: true, lastUnlockedAt: null }),
    }),
    {
      name: 'driver-app-lock',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

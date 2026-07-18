import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * -1  = None (auto-lock disabled – default when no PIN is set)
 *  0  = Immediate (lock the moment the app backgrounds)
 *  N  = lock after N minutes in the background
 */
export type DriverLockTimeoutMinutes = -1 | 0 | 0.25 | 0.5 | 1 | 5 | 15 | 30

export const MAX_DRIVER_LOCK_MINUTES = 30

interface AppLockState {
  isLocked: boolean
  lastUnlockedAt: number | null
  lockTimeoutMinutes: DriverLockTimeoutMinutes
  setLocked: (value: boolean) => void
  setUnlocked: () => void
  setLockTimeoutMinutes: (value: DriverLockTimeoutMinutes) => void
  /** Called on fresh session start – keeps the user's persisted timeout but resets runtime state. */
  reset: () => void
}

export const useAppLockStore = create<AppLockState>()(
  persist(
    (set) => ({
      isLocked: true,
      lastUnlockedAt: null,
      // -1 = None, safe default (no PIN set yet → nothing to lock behind)
      lockTimeoutMinutes: -1,
      setLocked: (value) => set({ isLocked: value }),
      setUnlocked: () => set({ isLocked: false, lastUnlockedAt: Date.now() }),
      setLockTimeoutMinutes: (value) => set({ lockTimeoutMinutes: value }),
      // Only reset the runtime lock state, not the user-chosen timeout.
      reset: () => set({ isLocked: true, lastUnlockedAt: null }),
    }),
    {
      name: 'driver-app-lock',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persisted: any, version: number) => {
        // v2 used 0 for "immediate" as the default – upgrade to -1 (None) so
        // existing installs don't suddenly start locking on every background.
        const raw = persisted?.lockTimeoutMinutes
        let lockTimeoutMinutes: DriverLockTimeoutMinutes = -1
        if (typeof raw === 'number' && raw !== 0 && raw !== 15) {
          // The user had explicitly picked a non-default value – keep it.
          lockTimeoutMinutes = raw as DriverLockTimeoutMinutes
        }
        // v2 default was 15 minutes or 0 – both migrate to -1 (None) so the
        // driver sees the correct "no auto-lock" starting state.
        return {
          lockTimeoutMinutes,
          isLocked: true,
          lastUnlockedAt: null,
        }
      },
      partialize: (state) => ({
        lockTimeoutMinutes: state.lockTimeoutMinutes,
      }),
    }
  )
)

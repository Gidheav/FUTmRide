import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

type LockTimeout = 0 | 1 | 5 | 15

interface SecurityStore {
  appLockEnabled: boolean
  biometricEnabled: boolean
  lockTimeoutMinutes: LockTimeout
  lastUnlockAt: number | null
  locked: boolean
  hasPin: boolean
  pinRecoveryRequired: boolean
  setAppLockEnabled: (value: boolean) => void
  setBiometricEnabled: (value: boolean) => void
  setLockTimeoutMinutes: (value: LockTimeout) => void
  setLastUnlockAt: (value: number | null) => void
  setLocked: (value: boolean) => void
  setHasPin: (value: boolean) => void
  hasTransactionPin: boolean
  setHasTransactionPin: (value: boolean) => void
  setPinRecoveryRequired: (value: boolean) => void
  /** Reset all security state to defaults on logout. Prevents cross-user contamination. */
  resetForLogout: () => void
}

export const useSecurityStore = create<SecurityStore>()(
  persist(
    (set) => ({
      appLockEnabled: false,
      biometricEnabled: false,
      lockTimeoutMinutes: 1,
      lastUnlockAt: null,
      // 'locked' is intentionally NOT persisted (see partialize below).
      // It always starts as false in memory; the boot-time effect in
      // StudentAppInner reads appLockEnabled + lastUnlockAt and calls
      // setLocked(true) when the app should be locked on cold start.
      locked: false,
      hasPin: false,
      hasTransactionPin: false,
      pinRecoveryRequired: false,
      setAppLockEnabled: (value) => set({ appLockEnabled: value }),
      setBiometricEnabled: (value) => set({ biometricEnabled: value }),
      setLockTimeoutMinutes: (value) => set({ lockTimeoutMinutes: value }),
      setLastUnlockAt: (value) => set({ lastUnlockAt: value }),
      setLocked: (value) => set({ locked: value }),
      setHasPin: (value) => set({ hasPin: value }),
      setHasTransactionPin: (value) => set({ hasTransactionPin: value }),
      setPinRecoveryRequired: (value) => set({ pinRecoveryRequired: value }),
      resetForLogout: () => set({
        appLockEnabled: false,
        biometricEnabled: false,
        lockTimeoutMinutes: 1,
        lastUnlockAt: null,
        locked: false,
        hasPin: false,
        hasTransactionPin: false,
        pinRecoveryRequired: false,
      }),
    }),
    {
      name: 'security-store',
      storage: createJSONStorage(() => AsyncStorage),
      // CRITICAL: 'locked' must NEVER be persisted.
      // If it were saved as false, a cold-start would skip AppLock entirely.
      // 'lastUnlockAt' IS persisted so the timeout logic works correctly
      // (we can detect how long ago the user last unlocked the app).
      partialize: (state) => ({
        appLockEnabled: state.appLockEnabled,
        biometricEnabled: state.biometricEnabled,
        lockTimeoutMinutes: state.lockTimeoutMinutes,
        lastUnlockAt: state.lastUnlockAt,
        hasPin: state.hasPin,
        hasTransactionPin: state.hasTransactionPin,
        pinRecoveryRequired: state.pinRecoveryRequired,
      }),
    }
  )
)

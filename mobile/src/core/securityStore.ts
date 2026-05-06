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
  setPinRecoveryRequired: (value: boolean) => void
}

export const useSecurityStore = create<SecurityStore>()(
  persist(
    (set) => ({
      appLockEnabled: false,
      biometricEnabled: false,
      lockTimeoutMinutes: 1,
      lastUnlockAt: null,
      locked: false,
      hasPin: false,
      pinRecoveryRequired: false,
      setAppLockEnabled: (value) => set({ appLockEnabled: value }),
      setBiometricEnabled: (value) => set({ biometricEnabled: value }),
      setLockTimeoutMinutes: (value) => set({ lockTimeoutMinutes: value }),
      setLastUnlockAt: (value) => set({ lastUnlockAt: value }),
      setLocked: (value) => set({ locked: value }),
      setHasPin: (value) => set({ hasPin: value }),
      setPinRecoveryRequired: (value) => set({ pinRecoveryRequired: value }),
    }),
    {
      name: 'security-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

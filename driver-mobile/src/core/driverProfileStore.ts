import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

interface DriverProfileStore {
  profile: any | null
  lastUpdatedAt: number | null
  setProfile: (profile: any | null) => void
  reset: () => void
}

export const useDriverProfileStore = create<DriverProfileStore>()(
  persist(
    (set) => ({
      profile: null,
      lastUpdatedAt: null,
      setProfile: (profile) => set({ profile, lastUpdatedAt: Date.now() }),
      reset: () => set({ profile: null, lastUpdatedAt: null }),
    }),
    {
      name: 'driver-profile-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

export type GarageRideStatus = 'unknown' | 'active' | 'inactive'

interface GarageRideStore {
  status: GarageRideStatus
  lastCheckedAt: number | null
  setStatus: (status: GarageRideStatus) => void
  reset: () => void
}

export const useGarageRideStore = create<GarageRideStore>()(
  persist(
    (set) => ({
      status: 'unknown',
      lastCheckedAt: null,
      setStatus: (status) => set({ status, lastCheckedAt: Date.now() }),
      reset: () => set({ status: 'unknown', lastCheckedAt: null }),
    }),
    {
      name: 'driver-garage-ride-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

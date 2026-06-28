import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

interface SettingsStore {
  enabledCategories: string[]
  toggleCategory: (categoryId: string) => void
  setHasHydrated: (value: boolean) => void
  hasHydrated: boolean
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Default to only gate and blocks enabled
      enabledCategories: ['gate', 'blocks'],
      hasHydrated: false,

      toggleCategory: (categoryId) => {
        const current = get().enabledCategories
        if (current.includes(categoryId)) {
          set({ enabledCategories: current.filter((c) => c !== categoryId) })
        } else {
          set({ enabledCategories: [...current, categoryId] })
        }
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

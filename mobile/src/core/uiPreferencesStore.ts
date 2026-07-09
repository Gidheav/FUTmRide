import { create } from 'zustand'

export interface UIPreferencesStore {
  hideBalance: boolean
  setHideBalance: (value: boolean) => void
  toggleHideBalance: () => void
}

export const useUIPreferencesStore = create<UIPreferencesStore>((set) => ({
  hideBalance: true,
  setHideBalance: (value) => set({ hideBalance: value }),
  toggleHideBalance: () => set((state) => ({ hideBalance: !state.hideBalance })),
}))

export default useUIPreferencesStore

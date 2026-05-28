import { create } from 'zustand'

export type SettingsTab = 'account' | 'display' | 'notifications' | 'system'

interface SettingsState {
  activeTab: SettingsTab
  setActiveTab: (tab: SettingsTab) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeTab: 'account',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

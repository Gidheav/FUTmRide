import { create } from 'zustand'

export type AnalyticsTab = 'efficiency' | 'intelligence'

interface AnalyticsState {
  activeTab: AnalyticsTab
  setActiveTab: (tab: AnalyticsTab) => void
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  activeTab: 'efficiency',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

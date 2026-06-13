import { create } from 'zustand'

export type ScheduleTab = 'departures' | 'routes' | 'fleet' | 'passengers'

interface ScheduleState {
  activeTab: ScheduleTab
  setActiveTab: (tab: ScheduleTab) => void
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  activeTab: 'departures',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

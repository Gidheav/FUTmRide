import { create } from 'zustand'

export type OperationsTab = 'departures' | 'routes' | 'fleet' | 'passengers' | 'log'

interface OperationsState {
  activeTab: OperationsTab
  setActiveTab: (tab: OperationsTab) => void
}

export const useOperationsStore = create<OperationsState>((set) => ({
  activeTab: 'departures',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

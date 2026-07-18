import { create } from 'zustand'

export const ENGINE_TABS = ['overview', 'tariffs', 'simulation', 'calibration', 'global', 'history'] as const

export type EngineTab = (typeof ENGINE_TABS)[number]

interface EngineState {
  activeTab: EngineTab
  activeVehicle: string
  setActiveTab: (tab: EngineTab | string) => void
  setActiveVehicle: (vehicle: string) => void
}

export const useEngineStore = create<EngineState>((set) => ({
  activeTab: 'overview',
  activeVehicle: 'sedan',
  setActiveTab: (tab) => {
    const next = (ENGINE_TABS as readonly string[]).includes(tab) ? tab as EngineTab : 'overview'
    set({ activeTab: next })
  },
  setActiveVehicle: (vehicle) => set({ activeVehicle: vehicle }),
}))

export const ENGINE_NAV_ITEMS: Array<{ label: string; tab: EngineTab }> = [
  { label: 'OVERVIEW', tab: 'overview' },
  { label: 'TARIFFS', tab: 'tariffs' },
  { label: 'SIMULATION', tab: 'simulation' },
  { label: 'CALIBRATION', tab: 'calibration' },
  { label: 'GLOBAL', tab: 'global' },
  { label: 'HISTORY', tab: 'history' },
]

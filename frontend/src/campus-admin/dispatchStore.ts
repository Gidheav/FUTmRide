import { create } from 'zustand'

export type DispatchTab = 'route_ops' | 'live_fleet'

export const useDispatchStore = create<{
  activeTab: DispatchTab
  setActiveTab: (tab: DispatchTab) => void
  showTraffic: boolean
  setShowTraffic: (val: boolean | ((p: boolean) => boolean)) => void
  showHeat: boolean
  setShowHeat: (val: boolean | ((p: boolean) => boolean)) => void
  showRoutes: boolean
  setShowRoutes: (val: boolean | ((p: boolean) => boolean)) => void
  wsConnected: boolean
  setWsConnected: (val: boolean) => void
  recenterTrigger: number
  triggerRecenter: () => void
}>((set) => ({
  activeTab: 'route_ops',
  setActiveTab: (tab) => set({ activeTab: tab }),
  showTraffic: false,
  setShowTraffic: (val) => set((state) => ({ showTraffic: typeof val === 'function' ? val(state.showTraffic) : val })),
  showHeat: false,
  setShowHeat: (val) => set((state) => ({ showHeat: typeof val === 'function' ? val(state.showHeat) : val })),
  showRoutes: true,
  setShowRoutes: (val) => set((state) => ({ showRoutes: typeof val === 'function' ? val(state.showRoutes) : val })),
  wsConnected: false,
  setWsConnected: (val) => set({ wsConnected: val }),
  recenterTrigger: 0,
  triggerRecenter: () => set((state) => ({ recenterTrigger: state.recenterTrigger + 1 })),
}))

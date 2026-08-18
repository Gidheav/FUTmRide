import { create } from 'zustand'

export type DispatchTab = 'route_ops' | 'live_fleet'

export type MapLayerConfig = {
  default_map_type?: 'roadmap' | 'hybrid'
  live_traffic_enabled: boolean
  demand_heatmaps_enabled: boolean
  driver_clustering_enabled: boolean
  refresh_interval_seconds: number
  cluster_threshold_zoom: number
  config_version?: number
}

export type RideCreationDraft = {
  origin_address: string
  origin_name?: string | null
  origin_latitude?: number | null
  origin_longitude?: number | null
  destination_address: string
  destination_name?: string | null
  destination_latitude?: number | null
  destination_longitude?: number | null
  departure_date: string
  window_start: string
  window_end: string
  allowed_vehicle_types: string[]
  vehicle_size?: string
  stops: Array<{ name: string; address: string; latitude?: number; longitude?: number; order: number }>
  notes?: string
  sourceReference?: string  // original ride reference for traceability
}

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
  mapLayerConfig: MapLayerConfig
  applyMapLayerConfig: (config: Partial<MapLayerConfig>) => void
  recenterTrigger: number
  triggerRecenter: () => void
  rideCreationDraft: RideCreationDraft | null
  setRideCreationDraft: (draft: RideCreationDraft | null) => void
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
  mapLayerConfig: {
    default_map_type: (localStorage.getItem('lr_ride_default_map_type') as 'roadmap' | 'hybrid') || 'hybrid',
    live_traffic_enabled: false,
    demand_heatmaps_enabled: false,
    driver_clustering_enabled: false,
    refresh_interval_seconds: 15,
    cluster_threshold_zoom: 14,
  },
  applyMapLayerConfig: (config) => set((state) => {
    const next = { ...state.mapLayerConfig, ...config }
    return {
      mapLayerConfig: next,
      showTraffic: next.live_traffic_enabled,
      showHeat: next.demand_heatmaps_enabled,
    }
  }),
  recenterTrigger: 0,
  triggerRecenter: () => set((state) => ({ recenterTrigger: state.recenterTrigger + 1 })),
  rideCreationDraft: null,
  setRideCreationDraft: (draft) => set({ rideCreationDraft: draft }),
}))



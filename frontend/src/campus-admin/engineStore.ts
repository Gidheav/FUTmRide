import { create } from 'zustand'
import type { PlatformSettings, FareConfig } from './engine/types'
import api from '../core/api'

export const ENGINE_TABS = ['overview', 'tariffs', 'simulation', 'global', 'history'] as const

export type EngineTab = (typeof ENGINE_TABS)[number]

const DEFAULT_SETTINGS: PlatformSettings = {
  commission_rate: 0.15,
  distance_provider: 'osrm',
  max_distance_km: 150,
  no_show_fee_enabled: true,
  no_show_fee_amount: 200,
  no_show_wait_minutes: 5,
}

interface EngineState {
  activeTab: EngineTab
  activeVehicle: string
  setActiveTab: (tab: EngineTab | string) => void
  setActiveVehicle: (vehicle: string) => void

  settings: PlatformSettings
  liveConfigs: Record<string, FareConfig>
  scheduledConfigs: Record<string, FareConfig>
  historyList: FareConfig[]
  dataLoaded: boolean
  isFetching: boolean
  fetchError: string | null

  fetchData: (force?: boolean) => Promise<void>
  setSettings: (s: PlatformSettings) => void
}

export const useEngineStore = create<EngineState>((set, get) => ({
  activeTab: 'overview',
  activeVehicle: 'sedan',
  setActiveTab: (tab) => {
    const next = (ENGINE_TABS as readonly string[]).includes(tab) ? tab as EngineTab : 'overview'
    set({ activeTab: next })
  },
  setActiveVehicle: (vehicle) => set({ activeVehicle: vehicle }),

  settings: DEFAULT_SETTINGS,
  liveConfigs: {},
  scheduledConfigs: {},
  historyList: [],
  dataLoaded: false,
  isFetching: false,
  fetchError: null,

  fetchData: async (force = false) => {
    if (get().isFetching) return
    if (get().dataLoaded && !force) return
    set({ isFetching: true, fetchError: null })
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/pricing/config/active/'),
        api.get('/pricing/config/', { params: { active_only: 'false' } }),
      ])
      const data = activeRes.data
      const live: Record<string, FareConfig> = {}
      Object.entries(data.live || {}).forEach(([vt, cfg]) => {
        live[vt] = cfg as FareConfig
      })
      const sched: Record<string, FareConfig> = {}
      Object.entries(data.scheduled || {}).forEach(([vt, cfg]) => {
        sched[vt] = cfg as FareConfig
      })
      const list = Array.isArray(historyRes.data)
        ? historyRes.data
        : (historyRes.data.results || [])
      set({
        settings: data.settings ?? DEFAULT_SETTINGS,
        liveConfigs: live,
        scheduledConfigs: sched,
        historyList: list,
        dataLoaded: true,
        fetchError: null,
      })
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: unknown }; code?: string; message?: string }
      let msg = 'Failed to load pricing engine.'
      if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
        msg = 'Server timed out — it may be waking up. Click Retry.'
      } else if (!e.response) {
        msg = 'Cannot reach the server. Check your connection.'
      } else if (e.response.status === 401 || e.response.status === 403) {
        msg = 'Access denied. Please log in again.'
      } else if (e.response.status) {
        msg = `Server error ${e.response.status} loading engine data.`
      }
      console.error('Failed to load pricing engine', err)
      set({ fetchError: msg })
    } finally {
      set({ isFetching: false, dataLoaded: true })
    }
  },
  setSettings: (s) => set({ settings: s }),
}))

export const ENGINE_NAV_ITEMS: Array<{ label: string; tab: EngineTab }> = [
  { label: 'OVERVIEW', tab: 'overview' },
  { label: 'TARIFFS', tab: 'tariffs' },
  { label: 'SIMULATION', tab: 'simulation' },
  { label: 'GLOBAL', tab: 'global' },
  { label: 'HISTORY', tab: 'history' },
]

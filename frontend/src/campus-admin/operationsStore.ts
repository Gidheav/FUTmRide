import { create } from 'zustand'

export type OperationsTab = 'departures' | 'routes' | 'fleet' | 'passengers' | 'log'

export interface LogEvent {
  id: string
  timestamp: string
  event: string
  event_label: string
  ride_type: string
  reference: string
  student_name: string
  driver_name: string
  route: string
  amount: string
  status: string
  ride_id: string
}

interface OperationsState {
  activeTab: OperationsTab
  setActiveTab: (tab: OperationsTab) => void

  // ── Per-tab initialized flags ──────────────────────────────────────
  // When true, the tab already has data; skip auto-fetch on mount
  tabInitialized: Record<OperationsTab, boolean>
  setTabInitialized: (tab: OperationsTab, val: boolean) => void

  // ── Log Tab ────────────────────────────────────────────────────────
  logHotCache: LogEvent[]
  setLogHotCache: (cache: LogEvent[]) => void
  logLastSyncTime: Date | null
  setLogLastSyncTime: (time: Date | null) => void

  // ── Departures Tab ─────────────────────────────────────────────────
  departuresCache: any[]
  setDeparturesCache: (data: any[]) => void

  // ── Routes Tab ─────────────────────────────────────────────────────
  routesCache: any[]
  setRoutesCache: (data: any[]) => void

  // ── Fleet Tab ──────────────────────────────────────────────────────
  fleetCache: any[]
  setFleetCache: (data: any[]) => void

  // ── Passengers Tab ─────────────────────────────────────────────────
  passengersCache: any[]
  setPassengersCache: (data: any[]) => void

  // ── Global refresh counter (incremented when Refresh btn is clicked)
  refreshSeq: number
  bumpRefresh: () => void
}

export const useOperationsStore = create<OperationsState>((set) => ({
  activeTab: 'departures',
  setActiveTab: (tab) => set({ activeTab: tab }),

  tabInitialized: {
    departures: false,
    routes: false,
    fleet: false,
    passengers: false,
    log: false,
  },
  setTabInitialized: (tab, val) =>
    set((s) => ({ tabInitialized: { ...s.tabInitialized, [tab]: val } })),

  logHotCache: [],
  setLogHotCache: (cache) => set({ logHotCache: cache }),
  logLastSyncTime: null,
  setLogLastSyncTime: (time) => set({ logLastSyncTime: time }),

  departuresCache: [],
  setDeparturesCache: (data) => set({ departuresCache: data }),

  routesCache: [],
  setRoutesCache: (data) => set({ routesCache: data }),

  fleetCache: [],
  setFleetCache: (data) => set({ fleetCache: data }),

  passengersCache: [],
  setPassengersCache: (data) => set({ passengersCache: data }),

  refreshSeq: 0,
  bumpRefresh: () => set((s) => ({ refreshSeq: s.refreshSeq + 1 })),
}))

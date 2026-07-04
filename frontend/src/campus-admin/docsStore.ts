import { create } from 'zustand'

type DocsTab = 'admin' | 'student' | 'driver'

interface DocsState {
  activeTab: DocsTab
  setActiveTab: (tab: DocsTab) => void
}

export const useDocsStore = create<DocsState>((set) => ({
  activeTab: 'admin',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

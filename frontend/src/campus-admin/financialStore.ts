import { create } from 'zustand'

export const FINANCIAL_TABS = ['overview', 'transactions', 'members', 'reports', 'payouts'] as const

export type FinancialTab = (typeof FINANCIAL_TABS)[number]

interface FinancialState {
  activeTab: FinancialTab
  setActiveTab: (tab: FinancialTab) => void
}

export const useFinancialStore = create<FinancialState>((set) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

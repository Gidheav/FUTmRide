import { create } from 'zustand'

export const FINANCIAL_TABS = ['overview', 'transactions', 'reports', 'payouts'] as const

export type FinancialTab = (typeof FINANCIAL_TABS)[number]

interface FinancialState {
  activeTab: FinancialTab
  setActiveTab: (tab: FinancialTab | string) => void
}

export const useFinancialStore = create<FinancialState>((set) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => {
    const next = (FINANCIAL_TABS as readonly string[]).includes(tab) ? tab as FinancialTab : 'overview'
    set({ activeTab: next })
  },
}))

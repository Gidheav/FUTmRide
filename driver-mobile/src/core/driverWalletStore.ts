import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

export type WalletSummary = {
  wallet_balance: string
  total_earnings: string
  daily_goal: {
    target: string
    earned: string
    progress_percent: number
    remaining: string
  }
  weekly_analytics: {
    total_earned: string
    change_percent: number
    series: Array<{ date: string; day_label: string; amount: string }>
  }
  rewards: {
    tier: string
    points: number
    next_tier: string
    next_tier_points: number
    points_to_next: number
  }
  payout_method?: any | null
}

export type WalletTransaction = {
  id: string
  reference: string
  transaction_type: 'credit' | 'debit'
  source: string
  amount: string
  balance_before: string
  balance_after: string
  narration: string
  created_at: string
  status: string
  metadata?: Record<string, any>
  ride_reference?: string | null
  ride_distance_km?: string | null
  ride_duration_minutes?: number | null
  ride_pickup_address?: string | null
  ride_dropoff_address?: string | null
}

export type PayoutMethod = {
  bank_name: string
  bank_code?: string
  account_name: string
  account_last4?: string
  account_number_masked?: string
  is_verified?: boolean
}

export type DriverDocument = {
  id: string
  document_type: string
  status: string
  uploaded_at: string
}

interface DriverWalletStore {
  summary: WalletSummary | null
  transactions: WalletTransaction[]
  payoutMethod: PayoutMethod | null
  documents: DriverDocument[]
  lastUpdatedAt: number | null
  setSummary: (summary: WalletSummary | null) => void
  setTransactions: (transactions: WalletTransaction[]) => void
  setPayoutMethod: (method: PayoutMethod | null) => void
  setDocuments: (docs: DriverDocument[]) => void
  touchUpdatedAt: () => void
}

export const useDriverWalletStore = create<DriverWalletStore>()(
  persist(
    (set) => ({
      summary: null,
      transactions: [],
      payoutMethod: null,
      documents: [],
      lastUpdatedAt: null,
      setSummary: (summary) => set({ summary, lastUpdatedAt: Date.now() }),
      setTransactions: (transactions) => set({ transactions, lastUpdatedAt: Date.now() }),
      setPayoutMethod: (method) => set({ payoutMethod: method, lastUpdatedAt: Date.now() }),
      setDocuments: (docs) => set({ documents: docs, lastUpdatedAt: Date.now() }),
      touchUpdatedAt: () => set({ lastUpdatedAt: Date.now() }),
    }),
    {
      name: 'driver-wallet-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        summary: state.summary,
        payoutMethod: state.payoutMethod,
        documents: state.documents,
      }),
    }
  )
)

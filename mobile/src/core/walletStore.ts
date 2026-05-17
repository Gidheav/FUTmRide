import { create } from 'zustand'
import api from './api'

export interface WalletStore {
  walletBalance: number | string | null
  setWalletBalance: (balance: number | string | null) => void
  clearWalletBalance: () => void
  syncBalance: () => Promise<void>
}

const useWalletStore = create<WalletStore>((set) => ({
  walletBalance: null,
  setWalletBalance: (balance) => set({ walletBalance: balance }),
  clearWalletBalance: () => set({ walletBalance: null }),
  syncBalance: async () => {
    try {
      const res = await api.get('users/me/')
      const balance = res.data?.wallet_balance
      if (balance !== undefined) {
        set({ walletBalance: balance })
      }
    } catch {
      // silent
    }
  },
}))

export { useWalletStore }
export default useWalletStore

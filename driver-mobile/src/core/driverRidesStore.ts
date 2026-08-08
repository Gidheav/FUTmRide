import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage, persist } from 'zustand/middleware'

export type GarageRideStatus = 'open' | 'full' | 'departed' | 'completed' | 'cancelled'

export type GarageRide = {
  id: string
  reference: string
  qr_token: string
  origin_address: string
  origin_latitude: number
  origin_longitude: number
  destination_address: string
  destination_latitude: number
  destination_longitude: number
  vehicle_type: string
  total_seats: number
  booked_seats: number
  available_seats: number
  fare_per_seat: string | number
  status: GarageRideStatus | string
  driver_note?: string | null
  is_expired: boolean
  created_at: string
  departed_at?: string | null
}

export type GaragePassenger = {
  id: string
  seats_booked: number
  amount_paid: string | number
  student?: {
    id: string
    full_name?: string | null
    first_name?: string | null
    last_name?: string | null
  } | null
}

export type RideListItem = {
  id: string
  status: string
  vehicle_type_requested?: string | null
  requested_seats: number | null
  pickup_address: string | null
  pickup_latitude?: string | number | null
  pickup_longitude?: string | number | null
  dropoff_address: string | null
  dropoff_latitude?: string | number | null
  dropoff_longitude?: string | number | null
  estimated_distance_km: string | number | null
  estimated_duration_minutes?: number | null
  estimated_route_geometry?: Array<{ latitude: number | string; longitude: number | string }> | null
  route_distance_provider?: string | null
  route_confidence?: string | null
  route_metadata?: Record<string, unknown> | null
  total_fare: string | number | null
  student?: {
    id: string
    full_name?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    role?: string | null
    profile_photo?: string | null
  } | null
}

export type SavedGarageRoute = {
  id: string
  name?: string | null
  origin_address: string
  origin_latitude: number
  origin_longitude: number
  destination_address: string
  destination_latitude: number
  destination_longitude: number
  distance_km: number
  last_used_at?: string | null
  created_at?: string | null
}

export type DriverProfileCache = {
  vehicle_type?: string | null
}

export type OfflineMode = 'garage' | 'scheduled'

interface DriverRidesStore {
  isOnline: boolean | null
  marketplaceRequests: RideListItem[]
  driverHasActiveRide: boolean
  garageRide: GarageRide | null
  garagePassengers: GaragePassenger[]
  savedRoutes: SavedGarageRoute[]
  driverProfile: DriverProfileCache | null
  rideHistory: RideListItem[]
  lastUpdatedAt: number | null
  /** The mode the driver wants to operate in when OFFLINE. Never touches on-demand. */
  offlineMode: OfflineMode
  setIsOnline: (value: boolean | null) => void
  setMarketplaceRequests: (value: RideListItem[]) => void
  setDriverHasActiveRide: (value: boolean) => void
  setGarageRide: (value: GarageRide | null) => void
  setGaragePassengers: (value: GaragePassenger[]) => void
  setSavedRoutes: (value: SavedGarageRoute[]) => void
  setDriverProfile: (value: DriverProfileCache | null) => void
  setRideHistory: (value: RideListItem[]) => void
  setOfflineMode: (value: OfflineMode) => void
  touchUpdatedAt: () => void
  reset: () => void
}

export const useDriverRidesStore = create<DriverRidesStore>()(
  persist(
    (set) => ({
      isOnline: null,
      marketplaceRequests: [],
      driverHasActiveRide: false,
      garageRide: null,
      garagePassengers: [],
      savedRoutes: [],
      driverProfile: null,
      rideHistory: [],
      lastUpdatedAt: null,
      offlineMode: 'garage',
      setIsOnline: (value) => set({ isOnline: value, lastUpdatedAt: Date.now() }),
      setMarketplaceRequests: (value) => set((state) => {
        const profileType = state.driverProfile?.vehicle_type || 'sedan'
        const filtered = value.filter(ride => {
          if (!ride.vehicle_type_requested) return true // Legacy rides without type
          return ride.vehicle_type_requested === profileType
        })
        return { marketplaceRequests: filtered, lastUpdatedAt: Date.now() }
      }),
      setDriverHasActiveRide: (value) => set({ driverHasActiveRide: value, lastUpdatedAt: Date.now() }),
      setGarageRide: (value) => set({ garageRide: value, lastUpdatedAt: Date.now() }),
      setGaragePassengers: (value) => set({ garagePassengers: value, lastUpdatedAt: Date.now() }),
      setSavedRoutes: (value) => set({ savedRoutes: value, lastUpdatedAt: Date.now() }),
      setDriverProfile: (value) => set({ driverProfile: value, lastUpdatedAt: Date.now() }),
      setRideHistory: (value) => set({ rideHistory: value.slice(0, 50), lastUpdatedAt: Date.now() }),
      setOfflineMode: (value) => set({ offlineMode: value }),
      touchUpdatedAt: () => set({ lastUpdatedAt: Date.now() }),
      reset: () => set({
        isOnline: null,
        marketplaceRequests: [],
        driverHasActiveRide: false,
        garageRide: null,
        garagePassengers: [],
        savedRoutes: [],
        driverProfile: null,
        rideHistory: [],
        lastUpdatedAt: null,
        offlineMode: 'garage',
      }),
    }),
    {
      name: 'driver-rides-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedRoutes: state.savedRoutes,
        driverProfile: state.driverProfile,
        rideHistory: state.rideHistory,
        offlineMode: state.offlineMode,
      }),
    }
  )
)


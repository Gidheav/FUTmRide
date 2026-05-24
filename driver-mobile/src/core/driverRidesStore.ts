import { create } from 'zustand'

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
  requested_seats: number | null
  pickup_address: string | null
  dropoff_address: string | null
  estimated_distance_km: string | number | null
  total_fare: string | number | null
  student?: {
    id: string
    full_name?: string | null
    first_name?: string | null
    last_name?: string | null
    phone_number?: string | null
    role?: string | null
  } | null
}

interface DriverRidesStore {
  isOnline: boolean | null
  marketplaceRequests: RideListItem[]
  driverHasActiveRide: boolean
  garageRide: GarageRide | null
  garagePassengers: GaragePassenger[]
  lastUpdatedAt: number | null
  setIsOnline: (value: boolean | null) => void
  setMarketplaceRequests: (value: RideListItem[]) => void
  setDriverHasActiveRide: (value: boolean) => void
  setGarageRide: (value: GarageRide | null) => void
  setGaragePassengers: (value: GaragePassenger[]) => void
  touchUpdatedAt: () => void
}

export const useDriverRidesStore = create<DriverRidesStore>((set) => ({
  isOnline: null,
  marketplaceRequests: [],
  driverHasActiveRide: false,
  garageRide: null,
  garagePassengers: [],
  lastUpdatedAt: null,
  setIsOnline: (value) => set({ isOnline: value, lastUpdatedAt: Date.now() }),
  setMarketplaceRequests: (value) => set({ marketplaceRequests: value, lastUpdatedAt: Date.now() }),
  setDriverHasActiveRide: (value) => set({ driverHasActiveRide: value, lastUpdatedAt: Date.now() }),
  setGarageRide: (value) => set({ garageRide: value, lastUpdatedAt: Date.now() }),
  setGaragePassengers: (value) => set({ garagePassengers: value, lastUpdatedAt: Date.now() }),
  touchUpdatedAt: () => set({ lastUpdatedAt: Date.now() }),
}))

export interface PlatformSettings {
  commission_rate: number
  distance_provider: string
  max_distance_km: number
  no_show_fee_enabled: boolean
  no_show_fee_amount: number
  no_show_wait_minutes: number
}

export interface FareConfig {
  id?: string
  vehicle_type: string
  is_active: boolean
  base_fare: number
  per_km_rate: number
  minimum_fare: number
  booking_fee: number
  surge_enabled: boolean
  max_surge_multiplier: number
  effective_from: string
  effective_to?: string | null
  created_at?: string
  created_by_name?: string
  notes?: string
}

export interface SimulationResult {
  base_fare: number
  per_km_rate: number
  booking_fee: number
  distance_km: number
  input_distance_km?: number
  distance_charge: number
  subtotal: number
  surge_multiplier: number
  requested_surge_multiplier?: number
  surged_amount: number
  minimum_fare: number
  minimum_adjustment?: number
  total_fare: number
  commission_rate: number
  platform_commission: number
  driver_earnings: number
  distance_clamped: boolean
  max_distance_km: number
  config_source: string
}

export interface FareDraft {
  base_fare: number
  per_km_rate: number
  minimum_fare: number
  booking_fee: number
  surge_enabled: boolean
  max_surge_multiplier: number
}

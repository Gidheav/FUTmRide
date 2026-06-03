export const VEHICLE_TYPES = [
  { id: 'motorcycle', label: 'Motorcycle' },
  { id: 'tricycle', label: 'Tricycle' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
  { id: 'minivan', label: 'Minivan' },
] as const

export const EFFECTIVE_DELAY_OPTIONS = [
  { value: 'existing', label: 'Keep current active date' },
  { value: 'now', label: 'Immediately (now)' },
  { value: '5m', label: 'In 5 minutes' },
  { value: '15m', label: 'In 15 minutes' },
  { value: '30m', label: 'In 30 minutes' },
  { value: '1h', label: 'In 1 hour' },
  { value: '3h', label: 'In 3 hours' },
  { value: '6h', label: 'In 6 hours' },
  { value: '12h', label: 'In 12 hours' },
  { value: '24h', label: 'In 24 hours' },
  { value: 'custom', label: 'Custom date…' },
] as const

export const DELAY_MS: Record<string, number> = {
  now: 0,
  '5m': 5 * 60000,
  '15m': 15 * 60000,
  '30m': 30 * 60000,
  '1h': 3600000,
  '3h': 3 * 3600000,
  '6h': 6 * 3600000,
  '12h': 12 * 3600000,
  '24h': 24 * 3600000,
}

/** Quick trip presets for simulation */
export const TRIP_PRESETS = [
  { id: 'campus', label: 'Campus hop', distance: 3, surge: 1 },
  { id: 'standard', label: 'Standard', distance: 12.5, surge: 1 },
  { id: 'rain', label: 'Rainy peak', distance: 12.5, surge: 1.5 },
  { id: 'long', label: 'Long haul', distance: 28, surge: 1 },
  { id: 'extreme', label: 'Surge test', distance: 8, surge: 2.5 },
] as const

export const SENSITIVITY_DISTANCES = [3, 5, 10, 15, 20, 25, 35] as const

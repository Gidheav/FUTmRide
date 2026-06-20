import { DELAY_MS } from './constants'
import type { FareConfig, FareDraft, PlatformSettings, SimulationResult } from './types'

const LEGACY_BASE: Record<string, number> = {
  motorbike: 200, tricycle: 300, sedan: 500, mpv: 700, minibus: 600, coach: 800,
}
const LEGACY_PER_KM: Record<string, number> = {
  motorbike: 80, tricycle: 100, sedan: 150, mpv: 200, minibus: 170, coach: 220,
}
const LEGACY_MIN: Record<string, number> = {
  motorbike: 250, tricycle: 350, sedan: 600, mpv: 800, minibus: 700, coach: 900,
}

/** Mirrors backend FareCalculator.calculate for draft preview parity */
export function calculateFare(
  vehicleType: string,
  distanceKm: number,
  surgeMultiplier: number,
  settings: PlatformSettings,
  draft?: FareDraft | null,
  source: SimulationResult['config_source'] = 'draft_preview',
): SimulationResult {
  const vt = vehicleType.toLowerCase()
  let base: number
  let perKm: number
  let minimum: number
  let bookingFee: number
  let surgeEnabled: boolean
  let maxSurge: number
  let configSource = source

  if (draft) {
    base = Number(draft.base_fare)
    perKm = Number(draft.per_km_rate)
    minimum = Number(draft.minimum_fare)
    bookingFee = Number(draft.booking_fee)
    surgeEnabled = draft.surge_enabled
    maxSurge = Number(draft.max_surge_multiplier)
  } else {
    base = LEGACY_BASE[vt] ?? 500
    perKm = LEGACY_PER_KM[vt] ?? 150
    minimum = LEGACY_MIN[vt] ?? 600
    bookingFee = 0
    surgeEnabled = true
    maxSurge = 2.5
    configSource = 'legacy_fallback'
  }

  const commissionRate = Number(settings.commission_rate)
  const maxDistance = Number(settings.max_distance_km)
  const clamped = maxDistance > 0 ? Math.min(distanceKm, maxDistance) : distanceKm
  const distanceClamped = maxDistance > 0 && distanceKm > maxDistance

  let effectiveSurge = surgeMultiplier
  if (surgeEnabled) {
    effectiveSurge = Math.min(surgeMultiplier, maxSurge)
  } else {
    effectiveSurge = 1
  }

  const distanceCharge = perKm * clamped
  const subtotal = base + distanceCharge + bookingFee
  const surgedFare = subtotal * effectiveSurge
  const finalFare = Math.max(surgedFare, minimum)
  const minimumAdjustment = Math.max(0, minimum - surgedFare)

  const commission = finalFare * commissionRate
  const driverEarnings = finalFare - commission
  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    base_fare: round2(base),
    per_km_rate: round2(perKm),
    booking_fee: round2(bookingFee),
    distance_km: round2(clamped),
    input_distance_km: round2(distanceKm),
    distance_charge: round2(distanceCharge),
    subtotal: round2(subtotal),
    surge_multiplier: round2(effectiveSurge),
    requested_surge_multiplier: round2(surgeMultiplier),
    surged_amount: effectiveSurge > 1 ? round2(surgedFare - subtotal) : 0,
    minimum_fare: round2(minimum),
    minimum_adjustment: round2(minimumAdjustment),
    total_fare: round2(finalFare),
    commission_rate: round2(commissionRate * 10000) / 10000,
    platform_commission: round2(commission),
    driver_earnings: round2(driverEarnings),
    distance_clamped: distanceClamped,
    max_distance_km: round2(maxDistance),
    config_source: configSource,
  }
}

export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function resolveEffectiveFrom(
  delay: string,
  customLocal: string,
  existingIso?: string,
): string {
  if (delay === 'existing' && existingIso) {
    return new Date(existingIso).toISOString()
  }
  if (delay === 'custom' && customLocal) {
    return new Date(customLocal).toISOString()
  }
  const addMs = delay === 'now' ? 0 : (DELAY_MS[delay] ?? 0)
  return new Date(Date.now() + addMs).toISOString()
}

export function configToDraft(c: FareConfig): FareDraft {
  return {
    base_fare: Number(c.base_fare),
    per_km_rate: Number(c.per_km_rate),
    minimum_fare: Number(c.minimum_fare),
    booking_fee: Number(c.booking_fee),
    surge_enabled: c.surge_enabled,
    max_surge_multiplier: Number(c.max_surge_multiplier),
  }
}

/** Default / legacy tariff inputs for a vehicle (not persisted). */
export function defaultFareDraft(vehicle: string): FareDraft {
  const vt = vehicle.toLowerCase()
  return {
    base_fare: LEGACY_BASE[vt] ?? 500,
    per_km_rate: LEGACY_PER_KM[vt] ?? 150,
    minimum_fare: LEGACY_MIN[vt] ?? 600,
    booking_fee: 50,
    surge_enabled: true,
    max_surge_multiplier: 2.5,
  }
}

export function draftsEqual(a: FareDraft, b: FareDraft): boolean {
  return (
    a.base_fare === b.base_fare
    && a.per_km_rate === b.per_km_rate
    && a.minimum_fare === b.minimum_fare
    && a.booking_fee === b.booking_fee
    && a.surge_enabled === b.surge_enabled
    && a.max_surge_multiplier === b.max_surge_multiplier
  )
}

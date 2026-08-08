import { useDriverRidesStore } from './driverRidesStore'

/** Minutes before departure that a scheduled ride is considered "upcoming" (Phase-2 lock window). */
export const SCHEDULED_RIDE_LOCK_MINUTES = 15
export const SCHEDULED_RIDE_AUTO_OFFLINE_MINUTES = 15
/** Minutes before departure to show a non-blocking awareness banner. */
export const SCHEDULED_RIDE_BANNER_MINUTES = 120



/**
 * Driver Activity State Machine
 *
 * A driver can only be in ONE active state at a time.
 * This module derives the current state from existing stores
 * and provides guard functions for mode switching.
 *
 * States:
 *   IDLE              – Not doing anything. Free to choose any mode.
 *   ON_DEMAND_ONLINE  – Online, waiting for ride requests from students.
 *   ON_DEMAND_ACTIVE  – Currently driving a student (accepted an on-demand ride).
 *   GARAGE_SESSION    – Sitting at a pickup point, collecting passengers (open/full).
 *   GARAGE_DEPARTED   – En route with garage passengers.
 */

export type DriverActivityState =
  | 'IDLE'
  | 'ON_DEMAND_ONLINE'
  | 'ON_DEMAND_ACTIVE'
  | 'GARAGE_SESSION'
  | 'GARAGE_DEPARTED'

export type ModeGuardResult = {
  allowed: boolean
  reason: string | null
  /** Suggested action the driver can take to resolve the conflict */
  suggestion: string | null
}

const ACTIVE_GARAGE_STATUSES = new Set(['open', 'full'])
const DEPARTED_GARAGE_STATUSES = new Set(['departed'])

/**
 * Derive the current driver activity state from existing store data.
 */
export function getDriverActivityState(
  isOnline: boolean | null,
  garageRide: { status: string } | null,
  driverHasActiveRide: boolean,
): DriverActivityState {
  // Active on-demand ride takes highest priority
  if (driverHasActiveRide) {
    return 'ON_DEMAND_ACTIVE'
  }

  // Active garage ride
  if (garageRide) {
    const status = String(garageRide.status || '').toLowerCase()
    if (DEPARTED_GARAGE_STATUSES.has(status)) {
      return 'GARAGE_DEPARTED'
    }
    if (ACTIVE_GARAGE_STATUSES.has(status)) {
      return 'GARAGE_SESSION'
    }
  }

  // Online for on-demand
  if (isOnline) {
    return 'ON_DEMAND_ONLINE'
  }

  return 'IDLE'
}

/**
 * Check if the driver is allowed to go online for on-demand rides.
 * 
 * @param state Current driver state
 * @param hasImminentScheduledRide Whether a scheduled ride is departing within the 15-min lock window
 */
export function canGoOnline(state: DriverActivityState, hasImminentScheduledRide: boolean = false): ModeGuardResult {
  if (hasImminentScheduledRide) {
    return {
      allowed: false,
      reason: 'You have a scheduled ride departing very soon.',
      suggestion: 'Please stay offline and head to the scheduled pickup location.',
    }
  }

  switch (state) {
    case 'IDLE':
    case 'ON_DEMAND_ONLINE':
      return { allowed: true, reason: null, suggestion: null }
    case 'GARAGE_SESSION':
      return {
        allowed: false,
        reason: 'You have an active garage session collecting passengers.',
        suggestion: 'Complete or cancel your garage session to go online for on-demand rides.',
      }
    case 'GARAGE_DEPARTED':
      return {
        allowed: false,
        reason: 'You are currently en route with garage passengers.',
        suggestion: 'Complete your garage trip first.',
      }
    case 'ON_DEMAND_ACTIVE':
      return {
        allowed: false,
        reason: 'You are already on an active on-demand ride.',
        suggestion: 'Complete your current ride first.',
      }
    default:
      return { allowed: true, reason: null, suggestion: null }
  }
}

/**
 * Check if the driver is allowed to create a garage ride session.
 * 
 * @param state Current driver state
 * @param hasImminentScheduledRide Whether a scheduled ride is departing within the 15-min lock window
 */
export function canCreateGarageRide(state: DriverActivityState, hasImminentScheduledRide: boolean = false): ModeGuardResult {
  if (hasImminentScheduledRide) {
    return {
      allowed: false,
      reason: 'You have a scheduled ride departing very soon.',
      suggestion: 'Please wait until your scheduled ride is complete before opening a garage session.',
    }
  }

  switch (state) {
    case 'IDLE':
      return { allowed: true, reason: null, suggestion: null }
    case 'ON_DEMAND_ONLINE':
      return {
        allowed: false,
        reason: 'You are currently online for on-demand rides.',
        suggestion: 'Go offline from on-demand to start a garage session.',
      }
    case 'ON_DEMAND_ACTIVE':
      return {
        allowed: false,
        reason: 'You are on an active on-demand ride.',
        suggestion: 'Complete your current ride before creating a garage session.',
      }
    case 'GARAGE_SESSION':
      return {
        allowed: false,
        reason: 'You already have an active garage session.',
        suggestion: 'Complete or cancel your current session first.',
      }
    case 'GARAGE_DEPARTED':
      return {
        allowed: false,
        reason: 'You are en route with garage passengers.',
        suggestion: 'Complete your current trip first.',
      }
    default:
      return { allowed: true, reason: null, suggestion: null }
  }
}

/**
 * Get a human-readable label and color for the current activity state.
 * Used by the dashboard mode indicator.
 */
export function getActivityDisplay(state: DriverActivityState): {
  label: string
  color: string
  bgColor: string
  icon: string
} {
  switch (state) {
    case 'ON_DEMAND_ONLINE':
      return {
        label: 'Online — On-Demand',
        color: '#2E7D32',
        bgColor: '#E8F5E9',
        icon: 'bolt',
      }
    case 'ON_DEMAND_ACTIVE':
      return {
        label: 'Active Ride',
        color: '#1565C0',
        bgColor: '#E3F2FD',
        icon: 'navigation',
      }
    case 'GARAGE_SESSION':
      return {
        label: 'Garage — Collecting',
        color: '#E65100',
        bgColor: '#FFF3E0',
        icon: 'event-seat',
      }
    case 'GARAGE_DEPARTED':
      return {
        label: 'Garage — En Route',
        color: '#6A1B9A',
        bgColor: '#F3E5F5',
        icon: 'directions-car',
      }
    case 'IDLE':
    default:
      return {
        label: 'Offline',
        color: '#616161',
        bgColor: '#F5F5F5',
        icon: 'power-settings-new',
      }
  }
}

/**
 * Check if the driver is allowed to express interest in a scheduled ride.
 * Per the product design, expressing interest is ALWAYS allowed regardless of current mode.
 * It is a future commitment — not an active one.
 */
export function canExpressInterest(): ModeGuardResult {
  return { allowed: true, reason: null, suggestion: null }
}

/**
 * Find the nearest upcoming scheduled ride that the driver expressed interest in,
 * starting within `withinMinutes` from now.
 *
 * @param scheduledRides - Array of scheduled ride objects with `driver_interest_status`,
 *   `departure_date` (YYYY-MM-DD) and `window_start` (HH:mm:ss) fields.
 * @param withinMinutes - How many minutes ahead to look (default: SCHEDULED_RIDE_BANNER_MINUTES).
 */
export function getUpcomingScheduledRide(
  scheduledRides: any[],
  withinMinutes: number = SCHEDULED_RIDE_BANNER_MINUTES,
): any | null {
  if (!Array.isArray(scheduledRides) || scheduledRides.length === 0) return null

  const now = Date.now()
  const windowMs = withinMinutes * 60 * 1000

  let nearest: any | null = null
  let nearestMs = Infinity

  for (const ride of scheduledRides) {
    if (ride.driver_interest_status !== 'interested') continue
    const departureDateStr = ride.departure_date
    const windowStart = ride.window_start
    if (!departureDateStr || !windowStart) continue

    const departureMs = new Date(`${departureDateStr}T${windowStart}`).getTime()
    if (Number.isNaN(departureMs)) continue

    const diffMs = departureMs - now
    if (diffMs > 0 && diffMs <= windowMs && diffMs < nearestMs) {
      nearest = ride
      nearestMs = diffMs
    }
  }

  return nearest
}

/**
 * Format the time remaining until a departure as a human-readable string.
 * e.g. "in 45 min", "in 1 h 10 min"
 */
export function formatTimeUntil(departureDateStr: string, windowStart: string): string {
  const departureMs = new Date(`${departureDateStr}T${windowStart}`).getTime()
  const diffMs = departureMs - Date.now()
  if (diffMs <= 0) return 'now'
  const totalMin = Math.ceil(diffMs / 60000)
  if (totalMin < 60) return `in ${totalMin} min`
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  return mins > 0 ? `in ${hours} h ${mins} min` : `in ${hours} h`
}

/**
 * Check if a given scheduled ride is within the lock window (e.g., departing in <= 15 minutes).
 */
export function isScheduledRideLocked(ride: any): boolean {
  if (!ride || !ride.departure_date || !ride.window_start) return false
  const departureMs = new Date(`${ride.departure_date}T${ride.window_start}`).getTime()
  const diffMs = departureMs - Date.now()
  return diffMs > 0 && diffMs <= SCHEDULED_RIDE_LOCK_MINUTES * 60 * 1000
}

/**
 * Check if an on-demand ride can be safely accepted without stranding the driver too far
 * from an upcoming scheduled ride.
 */
export function canAcceptOnDemandNearScheduled(
  onDemandDistanceKm: number | string | null | undefined,
  distanceToScheduledOriginKm: number | null
): ModeGuardResult {
  if (distanceToScheduledOriginKm === null) return { allowed: true, reason: null, suggestion: null }
  
  const distance = Number(onDemandDistanceKm)
  if (Number.isNaN(distance) || distance <= 0) return { allowed: true, reason: null, suggestion: null }
  
  // If the on-demand ride takes the driver more than 1.5x the distance away from the scheduled origin,
  // it might be too far to return in time. This is a heuristic.
  if (distance > distanceToScheduledOriginKm * 1.5 && distance > 5) { // At least 5km to trigger warning
    return {
      allowed: false,
      reason: 'This ride may take you too far away to return to your scheduled pickup in time.',
      suggestion: 'Are you sure you want to accept?'
    }
  }

  return { allowed: true, reason: null, suggestion: null }
}

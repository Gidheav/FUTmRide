/**
 * Centralized Location Service for the Student Mobile App.
 *
 * Provides a single source of truth for:
 *  - GPS permission management
 *  - High-accuracy coordinate fetching
 *  - Minna service-area geofencing
 *
 * Every screen that needs GPS coordinates should import from here
 * instead of calling expo-location directly.
 */
import * as Location from 'expo-location'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Round a coordinate to 6 decimal places (~0.11 m precision). */
export const roundCoord = (value: number) => Number(value.toFixed(6))

/**
 * Minna service-area bounding box.
 * Covers both FUTMINNA campuses (Gidan Kwano & Bosso) + surrounding town.
 * Generous enough for intra-city rides, tight enough to reject Abuja/Lagos.
 */
export const MINNA_SERVICE_AREA = {
  north: 9.72,   // above Bosso
  south: 9.45,   // below Gidan Kwano
  east: 6.62,    // east of town
  west: 6.37,    // west of town
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Coords = { latitude: number; longitude: number }

export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'OUTSIDE_SERVICE_AREA'

export class LocationError extends Error {
  code: LocationErrorCode

  constructor(code: LocationErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'LocationError'
  }
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/** Request foreground location permission. Returns `true` if granted. */
export async function requestLocationPermission(): Promise<boolean> {
  const existing = await Location.getForegroundPermissionsAsync()
  if (existing.granted) return true

  const result = await Location.requestForegroundPermissionsAsync()
  return result.granted
}

// ---------------------------------------------------------------------------
// Geofence check
// ---------------------------------------------------------------------------

/** Returns `true` if the given coords fall within the Minna service area. */
export function isWithinServiceArea(coords: Coords): boolean {
  return (
    coords.latitude >= MINNA_SERVICE_AREA.south &&
    coords.latitude <= MINNA_SERVICE_AREA.north &&
    coords.longitude >= MINNA_SERVICE_AREA.west &&
    coords.longitude <= MINNA_SERVICE_AREA.east
  )
}

// ---------------------------------------------------------------------------
// Core GPS fetch
// ---------------------------------------------------------------------------

export async function getCurrentLocation(): Promise<Coords> {
  try {
    // 1. Try to get a recent cached location first (super fast)
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 300_000,        // 5 minutes
      requiredAccuracy: 200,  // 200 metres
    })
    
    if (lastKnown) {
      return {
        latitude: roundCoord(lastKnown.coords.latitude),
        longitude: roundCoord(lastKnown.coords.longitude),
      }
    }

    // 2. If no recent location, fetch fresh.
    // Use Balanced accuracy (WiFi/Cell + GPS) which is extremely fast and perfectly sufficient for a city-level geofence check.
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    
    return {
      latitude: roundCoord(current.coords.latitude),
      longitude: roundCoord(current.coords.longitude),
    }
  } catch {
    throw new LocationError(
      'LOCATION_UNAVAILABLE',
      'Unable to determine your location. Please ensure GPS is enabled and try again.',
    )
  }
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

/**
 * The all-in-one function every screen should call.
 *
 * 1. Checks / requests foreground location permission.
 * 2. Fetches high-accuracy GPS coordinates.
 * 3. Validates that the user is within the Minna service area.
 *
 * @returns Verified `{ latitude, longitude }` within Minna.
 * @throws {LocationError} with one of:
 *   - `PERMISSION_DENIED`
 *   - `LOCATION_UNAVAILABLE`
 *   - `OUTSIDE_SERVICE_AREA`
 */
export async function getVerifiedLocation(): Promise<Coords> {
  const granted = await requestLocationPermission()
  if (!granted) {
    throw new LocationError(
      'PERMISSION_DENIED',
      'Location permission is required to use this feature. Please enable it in your device settings.',
    )
  }

  const coords = await getCurrentLocation()

  if (!isWithinServiceArea(coords)) {
    throw new LocationError(
      'OUTSIDE_SERVICE_AREA',
      'You appear to be outside the service area.',
    )
  }

  return coords
}

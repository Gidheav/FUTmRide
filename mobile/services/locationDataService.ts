/**
 * LocationDataService
 *
 * Single source of truth for campus location data in the student app.
 * Manages downloading, caching, versioning of the OTA location snapshot.
 *
 * Storage architecture:
 *   - AsyncStorage('@lr_locations_data')    ← persisted JSON string (survives restarts)
 *   - AsyncStorage('@lr_locations_version') ← current version number
 *   - _cache (module-level RAM)             ← fast sync reads, reset on hot reload
 *
 * WHY AsyncStorage instead of expo-file-system:
 *   In Expo Go, FileSystem.documentDirectory can be null at module-load time,
 *   silently producing broken file paths. AsyncStorage is always reliable in
 *   the Expo Go environment and requires zero file system permissions.
 *
 * Usage:
 *   import LocationDataService, { useLocations } from './locationDataService'
 *
 *   // On app startup (after auth, non-blocking):
 *   void LocationDataService.initialize()
 *
 *   // In components — sync, zero I/O after first load:
 *   const locations = useLocations()
 *
 *   // On "Update Map Data" button tap:
 *   const result = await LocationDataService.downloadUpdate()
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import { useEffect, useState } from 'react'

import api from './api'

// ── Storage keys ───────────────────────────────────────────────────────────────

const STORAGE_KEY_DATA     = '@lr_locations_data'     // JSON string of location array
const STORAGE_KEY_VERSION  = '@lr_locations_version'  // numeric version string
const STORAGE_KEY_CHECKSUM = '@lr_locations_checksum' // SHA-256 of stored JSON

// ── API endpoints (relative — api instance has the base URL) ──────────────────

const META_ENDPOINT     = 'locations/meta/'
const DOWNLOAD_ENDPOINT = 'locations/download/'

// ── Bundled fallback ───────────────────────────────────────────────────────────
// Shown only when no OTA download has ever succeeded.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FALLBACK_LOCATIONS = require('../src/student/locationsFallback.json')

// ── Types ─────────────────────────────────────────────────────────────────────

export type CampusLocation = {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
  category: string
}

type MetaResponse = {
  version: number
  checksum: string
  size_bytes: number
  location_count: number
  published_at: string | null
}

export type UpdateCheckResult = {
  updateAvailable: boolean
  serverVersion: number
  localVersion: number
  checksum: string
  locationCount: number
  publishedAt: string | null
}

export type DownloadResult = {
  success: boolean
  version?: number
  locationCount?: number
  error?: string
}

// ── In-memory cache ───────────────────────────────────────────────────────────
// Null = not yet loaded. Reset on every JS hot reload (Expo Go dev behaviour).
// Populated by: initialize() → _loadFromStorage() → downloadUpdate() → apply step.

let _cache: CampusLocation[] | null = null
let _listeners: Array<() => void> = []

function notifyListeners() {
  _listeners.forEach((fn) => fn())
}

// ── Core service ──────────────────────────────────────────────────────────────

const LocationDataService = {

  /**
   * getLocations() — synchronous read from RAM cache.
   * Returns fallback bundled data if cache hasn't been populated yet.
   */
  getLocations(): CampusLocation[] {
    return _cache ?? [] // (FALLBACK_LOCATIONS as CampusLocation[])
  },

  /**
   * getCurrentVersion() — locally persisted version number (0 = never downloaded).
   */
  async getCurrentVersion(): Promise<number> {
    try {
      const v = await AsyncStorage.getItem(STORAGE_KEY_VERSION)
      return v ? parseInt(v, 10) : 0
    } catch {
      return 0
    }
  },

  /**
   * initialize() — call once after auth.
   * 1. Loads persisted data from AsyncStorage into RAM
   * 2. Fires a silent background version check + update if needed
   * Safe to call multiple times (idempotent within a session).
   */
  async initialize(): Promise<void> {
    await _loadFromStorage()
    // _silentBackgroundUpdate() // temporarily disabled per user request
  },

  /**
   * checkForUpdate() — contacts /locations/meta/ and compares server version
   * against what's stored in AsyncStorage.
   */
  async checkForUpdate(): Promise<UpdateCheckResult> {
    const localVersion = await LocationDataService.getCurrentVersion()

    const response = await api.get<MetaResponse>(META_ENDPOINT, {
      timeout: 8000,
      params: { ts: Date.now() }, // bypass HTTP caches
    })
    const { version: serverVersion, checksum, location_count, published_at } = response.data

    return {
      updateAvailable: serverVersion > localVersion,
      serverVersion,
      localVersion,
      checksum,
      locationCount: location_count ?? 0,
      publishedAt: published_at ?? null,
    }
  },

  /**
   * downloadUpdate() — full download pipeline with per-stage callbacks.
   *
   * Stages emitted via onStage(key, status, detail?):
   *   'fetch'    — HTTP GET of location JSON array from server
   *   'validate' — ensure response is a non-empty array
   *   'save'     — persist JSON string to AsyncStorage
   *   'apply'    — set RAM cache + notify all useLocations() subscribers
   *
   * Safe to call at any time. Never leaves the app in a broken state —
   * if any stage fails, the existing persisted data is untouched.
   */
  async downloadUpdate(
    onProgress?: (progress: number) => void,
    onStage?: (stage: string, status: 'running' | 'ok' | 'error', detail?: string) => void,
  ): Promise<DownloadResult> {
    try {
      // ── Pre-flight: confirm server has data ───────────────────────────
      const metaRes = await api.get<MetaResponse>(META_ENDPOINT, {
        timeout: 8000,
        params: { ts: Date.now() },
      })
      const { version } = metaRes.data

      if (version === 0) {
        return { success: false, error: 'Map updates are not available yet.' }
      }
      onProgress?.(0.1)

      // ── Stage 1: FETCH ────────────────────────────────────────────────
      onStage?.('fetch', 'running')
      let downloadRes: any
      try {
        downloadRes = await api.get<CampusLocation[]>(DOWNLOAD_ENDPOINT, {
          timeout: 30000,
          responseType: 'json',
          params: { ts: Date.now() },
        })
        onProgress?.(0.45)
        onStage?.(
          'fetch', 'ok',
          `${Array.isArray(downloadRes.data) ? downloadRes.data.length : '?'} records received`,
        )
      } catch (fetchErr: any) {
        const msg = fetchErr?.response?.data?.detail || fetchErr?.message || 'Network error'
        onStage?.('fetch', 'error', msg)
        return { success: false, error: `Fetch failed: ${msg}` }
      }

      // ── Stage 2: VALIDATE ─────────────────────────────────────────────
      onStage?.('validate', 'running')
      if (!Array.isArray(downloadRes.data) || downloadRes.data.length === 0) {
        const detail = !Array.isArray(downloadRes.data)
          ? `Expected JSON array, got ${typeof downloadRes.data}`
          : 'Server returned 0 locations'
        onStage?.('validate', 'error', detail)
        return { success: false, error: `Validation failed: ${detail}` }
      }
      const jsonString = JSON.stringify(downloadRes.data)
      const locationArray = downloadRes.data as CampusLocation[]
      onProgress?.(0.6)
      onStage?.('validate', 'ok', `${locationArray.length} locations passed validation`)

      // ── Stage 3: SAVE ─────────────────────────────────────────────────
      onStage?.('save', 'running')
      try {
        // Compute and store checksum for future integrity checks
        const jsonChecksum = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          jsonString,
        )
        await AsyncStorage.multiSet([
          [STORAGE_KEY_DATA, jsonString],
          [STORAGE_KEY_VERSION, String(version)],
          [STORAGE_KEY_CHECKSUM, jsonChecksum],
        ])
        onProgress?.(0.82)
        onStage?.('save', 'ok', `Saved ${jsonString.length} bytes to device (v${version})`)
      } catch (saveErr: any) {
        const msg = saveErr?.message || 'AsyncStorage write failed'
        onStage?.('save', 'error', msg)
        return { success: false, error: `Save failed: ${msg}` }
      }

      // ── Stage 4: APPLY ────────────────────────────────────────────────
      onStage?.('apply', 'running')
      try {
        _cache = locationArray
        notifyListeners() // → triggers setLocations() in ALL mounted useLocations() hooks
        onProgress?.(1.0)
        onStage?.(
          'apply', 'ok',
          `${locationArray.length} locations now active — map & modals updated`,
        )
      } catch (applyErr: any) {
        // Non-fatal: data is on disk, next mount will load it from AsyncStorage
        onStage?.('apply', 'error', applyErr?.message || 'RAM cache update failed (non-fatal)')
      }

      return { success: true, version, locationCount: locationArray.length }

    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        'Download failed. Check your connection.'
      return { success: false, error: String(message) }
    }
  },
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * _loadFromStorage() — reads JSON from AsyncStorage into _cache.
 * Called on initialize() and on every useLocations() mount (handles hot reload).
 */
async function _loadFromStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DATA)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        _cache = parsed as CampusLocation[]
        notifyListeners()
        return
      }
    }
    // No saved data yet — use bundled fallback (first-install state)
    // PER USER REQUEST: start with empty locations instead of bundled fallback
    _cache = [] // FALLBACK_LOCATIONS as CampusLocation[]
    notifyListeners()
  } catch {
    // Parse error or storage unavailable — never crash
    _cache = [] // FALLBACK_LOCATIONS as CampusLocation[]
    notifyListeners()
  }
}

/** Silent background auto-update on app start — never surfaces errors to UI. */
async function _silentBackgroundUpdate(): Promise<void> {
  try {
    const check = await LocationDataService.checkForUpdate()
    if (check.updateAvailable) {
      await LocationDataService.downloadUpdate()
    }
  } catch {
    // Swallow silently — network may be unavailable
  }
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * useLocations() — reactive hook returning the current location array.
 *
 * Behaviour:
 *   1. On mount: immediately returns _cache (fast, sync). If cache is null
 *      (e.g. after Expo Go hot reload), returns bundled fallback instantly.
 *   2. Calls _loadFromStorage() asynchronously on mount — this populates
 *      _cache from AsyncStorage and fires notifyListeners(), triggering a
 *      re-render with the correct data within milliseconds.
 *   3. Subscribes to all future updates (downloads, background syncs).
 *
 * No restart or rebuild required after a successful downloadUpdate().
 */
export function useLocations(): CampusLocation[] {
  const [locations, setLocations] = useState<CampusLocation[]>(
    LocationDataService.getLocations, // lazy initializer — reads _cache or fallback
  )

  useEffect(() => {
    // 1. Register listener for live updates
    const onUpdate = () => setLocations([...LocationDataService.getLocations()])
    _listeners.push(onUpdate)

    // 2. Always re-read from AsyncStorage on mount.
    //    Handles Expo Go hot reload (resets _cache to null) without requiring
    //    the user to close and reopen the app.
    _loadFromStorage()

    return () => {
      _listeners = _listeners.filter((fn) => fn !== onUpdate)
    }
  }, [])

  return locations
}

export default LocationDataService

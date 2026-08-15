export const NIGER_STATE_BOUNDS = {
  north: 11.6,
  south: 7.9,
  east: 7.77,
  west: 3.4,
} as const

export const NIGER_STATE_CENTER = {
  lat: 9.75,
  lng: 5.585,
}

export const NIGER_STATE_MAP_RESTRICTION = {
  latLngBounds: NIGER_STATE_BOUNDS,
  strictBounds: false,
}

export const DEFAULT_ADMIN_MAP_TYPE = 'hybrid' as const
export const ADMIN_MAP_MIN_ZOOM = 7
export const ADMIN_MAP_MAX_ZOOM = 21

export type AdminMapType = 'roadmap' | 'hybrid'

export const normalizeAdminMapType = (value?: string | null): AdminMapType => (
  value === 'roadmap' || value === 'hybrid' ? value : DEFAULT_ADMIN_MAP_TYPE
)

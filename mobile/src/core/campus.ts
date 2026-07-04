export type CampusKey = 'gidan-kwano' | 'bosso'

export type CampusOption = {
  id: string
  name: string
  code?: string
  key: CampusKey
}

export type CampusApiItem = {
  id: string | number
  name: string
  code?: string | null
}

export const CAMPUS_CENTERS: Record<CampusKey, { latitude: number; longitude: number }> = {
  'gidan-kwano': { latitude: 9.5261, longitude: 6.4514 },
  bosso: { latitude: 9.6506, longitude: 6.5276 },
}

export const STATIC_CAMPUSES: CampusOption[] = [
  { id: 'gidan-kwano', name: 'Gidan Kwano (FUTMINNA)', key: 'gidan-kwano' },
  { id: 'bosso', name: 'Bosso (FUTMINNA)', key: 'bosso' },
]

const normalize = (value?: string | number | null) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const getCampusKey = (value?: string | number | null): CampusKey | null => {
  const normalized = normalize(value)
  if (!normalized) return null
  if (normalized.includes('bosso')) return 'bosso'
  if (
    normalized.includes('gidan kwano') ||
    normalized.includes('gk') ||
    normalized.includes('main')
  ) {
    return 'gidan-kwano'
  }
  return null
}

export const getCampusLabel = (key: CampusKey) =>
  key === 'bosso' ? 'Bosso (FUTMINNA)' : 'Gidan Kwano (FUTMINNA)'

export const getCampusCenter = (value?: string | number | null) => {
  const key = getCampusKey(value) ?? 'gidan-kwano'
  return CAMPUS_CENTERS[key]
}

export const normalizeCampusOptions = (items: CampusApiItem[]): CampusOption[] => {
  const byKey = new Map<CampusKey, CampusOption>()

  items.forEach((item) => {
    const key = getCampusKey(item.code) ?? getCampusKey(item.name) ?? getCampusKey(item.id)
    if (!key) return

    const option: CampusOption = {
      id: String(item.id),
      name: getCampusLabel(key),
      code: item.code ? String(item.code) : undefined,
      key,
    }

    const existing = byKey.get(key)
    if (!existing || (!existing.code && option.code)) {
      byKey.set(key, option)
    }
  })

  return STATIC_CAMPUSES
    .map((fallback) => byKey.get(fallback.key) ?? fallback)
}

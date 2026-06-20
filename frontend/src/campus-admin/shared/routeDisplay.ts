type RouteLike = {
  origin_name?: unknown
  origin_label?: unknown
  origin_address?: unknown
  destination_name?: unknown
  destination_label?: unknown
  destination_address?: unknown
  pickup_name?: unknown
  pickup_label?: unknown
  pickup_address?: unknown
  dropoff_name?: unknown
  dropoff_label?: unknown
  dropoff_address?: unknown
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const firstPart = (value: string) => value.split(',')[0]?.trim() || value

export const routeEndpointLabel = (
  item: RouteLike,
  side: 'origin' | 'destination' | 'pickup' | 'dropoff',
  short = false,
) => {
  const candidates =
    side === 'origin'
      ? [item.origin_name, item.origin_label, item.origin_address]
      : side === 'destination'
        ? [item.destination_name, item.destination_label, item.destination_address]
        : side === 'pickup'
          ? [item.pickup_name, item.pickup_label, item.pickup_address]
          : [item.dropoff_name, item.dropoff_label, item.dropoff_address]

  const label = candidates.map(text).find(Boolean) || '-'
  const hasExplicitName = candidates.slice(0, 2).map(text).some(Boolean)
  return short && !hasExplicitName ? firstPart(label) : label
}

export const routeLineLabel = (
  item: RouteLike,
  fromSide: 'origin' | 'pickup' = 'origin',
  short = false,
) => {
  const toSide = fromSide === 'origin' ? 'destination' : 'dropoff'
  return `${routeEndpointLabel(item, fromSide, short)} -> ${routeEndpointLabel(item, toSide, short)}`
}

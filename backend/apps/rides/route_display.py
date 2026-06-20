def scheduled_endpoint_names(ride):
    stops = sorted(list(ride.stops.all()), key=lambda stop: stop.order)
    origin = stops[0] if stops else None
    destination = stops[-1] if stops else None
    origin_name = (getattr(origin, 'name', '') or '').strip() if origin else ''
    destination_name = (getattr(destination, 'name', '') or '').strip() if destination else ''
    return {
        'origin_name': origin_name or None,
        'destination_name': destination_name or None,
    }


def scheduled_route_label(ride):
    names = scheduled_endpoint_names(ride)
    origin = names['origin_name'] or getattr(ride, 'origin_address', '')
    destination = names['destination_name'] or getattr(ride, 'destination_address', '')
    return f"{origin} -> {destination}"

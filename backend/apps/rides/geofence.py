"""
Geofence utilities for ride coordinate validation.

All ride-related views that accept lat/lng should call
``validate_coordinates_in_service_area`` to reject requests
whose coordinates fall outside the Minna service area.
"""
from decimal import Decimal

# Minna service area bounding box — matches mobile constants exactly.
MINNA_BOUNDS = {
    'north': Decimal('9.72'),
    'south': Decimal('9.45'),
    'east': Decimal('6.62'),
    'west': Decimal('6.37'),
}

METERS_PER_DEGREE_LAT = Decimal('111320')


def _configured_buffer_degrees() -> Decimal:
    try:
        from apps.accounts.models import MapSettings
        buffer_meters = Decimal(str(MapSettings.load().geofence_buffer_meters or 0))
    except Exception:
        buffer_meters = Decimal('0')
    return max(Decimal('0'), buffer_meters) / METERS_PER_DEGREE_LAT


def is_in_service_area(lat, lng) -> bool:
    """Return True if (lat, lng) are within the Minna bounding box."""
    lat = Decimal(str(lat))
    lng = Decimal(str(lng))
    buffer_degrees = _configured_buffer_degrees()
    return (
        MINNA_BOUNDS['south'] - buffer_degrees <= lat <= MINNA_BOUNDS['north'] + buffer_degrees
        and MINNA_BOUNDS['west'] - buffer_degrees <= lng <= MINNA_BOUNDS['east'] + buffer_degrees
    )


def validate_coordinates_in_service_area(lat, lng, label='Location'):
    """
    Raise ``ValueError`` if the given coordinates are outside the
    Minna service area.

    Parameters
    ----------
    lat, lng : float | Decimal | str
        Latitude and longitude to validate.
    label : str
        Human-readable label for error messages (e.g. "Pickup", "Dropoff").
    """
    if not is_in_service_area(lat, lng):
        raise ValueError(
            f'{label} coordinates are outside the Minna service area. '
            'FUTMRide currently operates only within Minna, Niger State.'
        )

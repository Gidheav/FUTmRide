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


def is_in_service_area(lat, lng) -> bool:
    """Return True if (lat, lng) are within the Minna bounding box."""
    lat = Decimal(str(lat))
    lng = Decimal(str(lng))
    return (
        MINNA_BOUNDS['south'] <= lat <= MINNA_BOUNDS['north']
        and MINNA_BOUNDS['west'] <= lng <= MINNA_BOUNDS['east']
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

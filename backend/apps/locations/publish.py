"""
Publish utilities — generate a gzipped JSON snapshot of all active locations,
compute its SHA-256 checksum, and save it as the current LocationSnapshot.
Kept separate so it can be called from admin actions, management commands, or tests.
"""
import gzip
import hashlib
import json
from decimal import Decimal


def _decimal_default(obj):
    """JSON serializer for Decimal values (latitude/longitude)."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f'Object of type {type(obj)} is not JSON serializable')


def publish_locations(published_by=None, allow_empty=False):
    """
    Build and save a new LocationSnapshot from all active Location records.

    Returns a dict:
        {
            'version': int,
            'count': int,
            'size_bytes': int,
            'checksum': str,      # full SHA-256 hex
            'success': bool,
            'error': str | None,
        }
    """
    # Import here to avoid circular imports at module load
    from .models import Location, LocationSnapshot

    active_locations = list(
        Location.objects.filter(is_active=True)
        .values('id', 'name', 'description', 'latitude', 'longitude', 'category')
        .order_by('category', 'name')
    )

    # Only block empty publishes from the normal publish action.
    # When called from wipe (allow_empty=True), we MUST publish the empty
    # snapshot so mobile clients see a version bump and pull empty data.
    if not active_locations and not allow_empty:
        return {
            'success': False,
            'error': 'No active locations found. Add locations before publishing.',
            'version': 0,
            'count': 0,
            'size_bytes': 0,
            'checksum': '',
        }

    # Serialize to JSON — floats for lat/lng (Decimal not JSON-serializable)
    json_bytes = json.dumps(active_locations, default=_decimal_default, ensure_ascii=False).encode('utf-8')

    # Gzip compress
    gz_bytes = gzip.compress(json_bytes, compresslevel=9)

    # SHA-256 checksum of the compressed bytes
    checksum = hashlib.sha256(gz_bytes).hexdigest()

    # Determine next version number
    last = LocationSnapshot.objects.order_by('-version').first()
    next_version = (last.version + 1) if last else 1

    # Save new snapshot — mark as current, unmark all others
    snapshot = LocationSnapshot.objects.create(
        version=next_version,
        checksum=checksum,
        size_bytes=len(gz_bytes),
        location_count=len(active_locations),
        data=gz_bytes,
        is_current=True,
        published_by=published_by,
    )

    # Unmark all other snapshots
    LocationSnapshot.objects.exclude(pk=snapshot.pk).update(is_current=False)

    # Prune — keep only the last 3 snapshots
    all_ids = list(
        LocationSnapshot.objects.order_by('-version').values_list('pk', flat=True)
    )
    if len(all_ids) > 3:
        to_delete = all_ids[3:]
        LocationSnapshot.objects.filter(pk__in=to_delete).delete()

    return {
        'success': True,
        'error': None,
        'version': next_version,
        'count': len(active_locations),
        'size_bytes': len(gz_bytes),
        'checksum': checksum,
    }

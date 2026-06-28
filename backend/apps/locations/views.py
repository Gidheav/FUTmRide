from django.http import HttpResponse, JsonResponse
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView

from .models import Location, LocationSnapshot
from .publish import publish_locations


class LocationMetaView(APIView):
    """
    GET /api/v1/locations/meta/

    Public endpoint — no authentication required.
    Returns the current snapshot version, checksum, and size.
    The app polls this on startup to decide whether a download is needed.

    Cache-Control: max-age=300 (5 minutes) — safe to cache at CDN/proxy level.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        snapshot = LocationSnapshot.get_current()

        if snapshot is None:
            data = {
                'version': 0,
                'checksum': '',
                'size_bytes': 0,
                'location_count': 0,
                'published_at': None,
            }
        else:
            data = {
                'version': snapshot.version,
                'checksum': snapshot.checksum,
                'size_bytes': snapshot.size_bytes,
                'location_count': snapshot.location_count,
                'published_at': snapshot.published_at.isoformat() if snapshot.published_at else None,
            }

        response = JsonResponse(data)
        response['Cache-Control'] = 'public, max-age=300'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class LocationDownloadView(APIView):
    """
    GET /api/v1/locations/download/

    Requires valid JWT (student or any authenticated role).
    Serves the current snapshot's location data.

    - If the client sends Accept-Encoding: gzip  → serves raw gzip bytes
      (browser / curl / CDN edge — fast bandwidth-efficient path)
    - Otherwise → decompresses on the server and serves plain JSON
      (React Native / mobile axios — cannot auto-decompress gzip)

    Supports ETag / If-None-Match for efficient caching.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import gzip as _gzip

        snapshot = LocationSnapshot.get_current()

        if snapshot is None:
            return JsonResponse(
                {'detail': 'No location data has been published yet. Contact your campus admin.'},
                status=404,
            )

        etag = f'"{snapshot.checksum}"'

        # ETag / conditional GET — return 304 if client already has this version
        if_none_match = request.META.get('HTTP_IF_NONE_MATCH', '')
        if if_none_match and if_none_match == etag:
            response = HttpResponse(status=304)
            response['ETag'] = etag
            response['X-Location-Version'] = str(snapshot.version)
            return response

        gz_bytes = bytes(snapshot.data)
        accept_encoding = request.META.get('HTTP_ACCEPT_ENCODING', '')
        client_accepts_gzip = 'gzip' in accept_encoding

        if client_accepts_gzip:
            # Fast path: serve raw gzip bytes (browsers, CDN, curl)
            response = HttpResponse(gz_bytes, content_type='application/json')
            response['Content-Encoding'] = 'gzip'
            response['Content-Length'] = str(len(gz_bytes))
        else:
            # Mobile path: decompress on server, serve plain JSON
            # React Native axios does not auto-decompress gzip responses
            json_bytes = _gzip.decompress(gz_bytes)
            response = HttpResponse(json_bytes, content_type='application/json; charset=utf-8')
            response['Content-Length'] = str(len(json_bytes))

        response['ETag'] = etag
        response['X-Location-Version'] = str(snapshot.version)
        response['X-Location-Checksum'] = snapshot.checksum
        response['Cache-Control'] = 'public, max-age=3600'
        response['Vary'] = 'Accept-Encoding, Authorization'
        return response


class LocationAdminBulkImportView(APIView):
    """
    POST /api/v1/locations/admin/bulk-import/
    Requires Admin privileges.
    Expects a JSON array of location objects.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        records = request.data
        if not isinstance(records, list):
            return JsonResponse({'error': 'Root element must be a JSON array.'}, status=400)

        created = 0
        updated = 0
        errors = []

        for i, rec in enumerate(records):
            try:
                # Basic validation
                for key in ['id', 'name', 'latitude', 'longitude', 'category']:
                    if key not in rec:
                        raise ValueError(f"Missing required key: {key}")

                loc, was_created = Location.objects.update_or_create(
                    id=rec['id'],
                    defaults={
                        'name': rec['name'],
                        'description': rec.get('description', ''),
                        'latitude': rec['latitude'],
                        'longitude': rec['longitude'],
                        'category': rec['category'],
                        'is_active': rec.get('is_active', True),
                    },
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
            except Exception as exc:
                errors.append(f'Row {i} ({rec.get("id", "unknown")}): {exc}')

        if errors and created == 0 and updated == 0:
            return JsonResponse({'error': 'Import failed.', 'details': errors}, status=400)

        return JsonResponse({
            'message': f'Import complete. {created} created, {updated} updated.',
            'created': created,
            'updated': updated,
            'errors': errors[:10] if errors else None,
        })


class LocationAdminPublishView(APIView):
    """
    POST /api/v1/locations/admin/publish/
    Requires Admin privileges.
    Generates a new snapshot.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        result = publish_locations(published_by=request.user)

        if not result['success']:
            return JsonResponse({'error': result['error']}, status=400)

        return JsonResponse({
            'message': f'Published v{result["version"]}',
            'version': result['version'],
            'count': result['count'],
            'size_bytes': result['size_bytes'],
            'checksum': result['checksum'],
        })


class LocationAdminWipeView(APIView):
    """
    POST /api/v1/locations/admin/wipe/
    Requires Admin privileges.
    Deletes ALL locations in the database.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        count, _ = Location.objects.all().delete()
        return JsonResponse({
            'message': f'Successfully wiped {count} location(s). Database is now empty.',
            'count': count,
        })


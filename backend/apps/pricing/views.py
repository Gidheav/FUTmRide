from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.rides.services import FareCalculator, RouteDistanceResolver
from .models import FareConfiguration, PlatformSettings
from .serializers import FareConfigSerializer, FareEstimateSerializer, PlatformSettingsSerializer
import os
import requests


class FareConfigListView(generics.ListCreateAPIView):
    serializer_class = FareConfigSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get_queryset(self):
        qs = FareConfiguration.objects.all().order_by('-effective_from', '-created_at')
        vehicle_type = self.request.query_params.get('vehicle_type')
        active_only = self.request.query_params.get('active_only', 'true').lower()
        if vehicle_type:
            qs = qs.filter(vehicle_type=vehicle_type)
        if active_only == 'true':
            qs = qs.filter(is_active=True)
        return qs


class FareConfigDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = FareConfigSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    queryset = FareConfiguration.objects.all()


class FareEstimateView(APIView):
    """Calculate a fare estimate. Available to any authenticated user."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FareEstimateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        route = None
        distance_km = data.get('distance_km')
        if distance_km is None:
            route = RouteDistanceResolver.resolve(
                pickup_latitude=data['pickup_latitude'],
                pickup_longitude=data['pickup_longitude'],
                dropoff_latitude=data['dropoff_latitude'],
                dropoff_longitude=data['dropoff_longitude'],
                vehicle_type=data['vehicle_type'],
            )
            distance_km = route.distance_km
        result = FareCalculator.calculate(
            vehicle_type=data['vehicle_type'],
            distance_km=distance_km,
            surge_multiplier=data.get('surge_multiplier', 1.0),
            passenger_count=data.get('passenger_count', 1),
            config_override=data.get('config_override'),
            settings_override=data.get('settings_override'),
        )
        if route:
            result['route'] = {
                'distance_km': route.distance_km,
                'duration_minutes': route.duration_minutes,
                'geometry': route.geometry,
                'provider': route.provider,
                'confidence': route.confidence,
                'metadata': route.metadata,
            }
        return Response(result)


class ActiveFareConfigsView(APIView):
    """Live + scheduled fare configs per vehicle (matches FareCalculator.get_active)."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        from django.utils import timezone

        now = timezone.now()
        live = {}
        scheduled = {}
        for vt, _ in FareConfiguration.VehicleType.choices:
            active = FareConfiguration.get_active(vt)
            if active:
                live[vt] = FareConfigSerializer(active).data
            pending = (
                FareConfiguration.objects.filter(
                    vehicle_type=vt,
                    is_active=True,
                    effective_from__gt=now,
                )
                .order_by('effective_from')
                .first()
            )
            if pending:
                scheduled[vt] = FareConfigSerializer(pending).data

        platform = PlatformSettings.load()
        return Response({
            'live': live,
            'scheduled': scheduled,
            'settings': PlatformSettingsSerializer(platform).data,
        })


class PlatformSettingsView(APIView):
    """
    GET  — retrieve the singleton platform settings.
    PATCH — update platform settings fields.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        settings = PlatformSettings.load()
        serializer = PlatformSettingsSerializer(settings)
        return Response(serializer.data)

    def patch(self, request):
        settings = PlatformSettings.load()
        serializer = PlatformSettingsSerializer(settings, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class FareConfigDeactivateView(APIView):
    """Deactivate (soft-delete) a fare configuration."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, pk):
        try:
            config = FareConfiguration.objects.get(pk=pk)
        except FareConfiguration.DoesNotExist:
            return Response({'error': 'Configuration not found.'}, status=status.HTTP_404_NOT_FOUND)
        config.is_active = False
        config.save(update_fields=['is_active'])
        return Response(FareConfigSerializer(config).data)


class RouteGraphActiveView(APIView):
    """Get the currently active published route graph."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import RouteGraphVersion
        from .serializers import RouteGraphVersionSerializer
        
        active_version = RouteGraphVersion.get_active()
        if not active_version:
            return Response(None)
            
        serializer = RouteGraphVersionSerializer(active_version)
        return Response(serializer.data)


class RouteGraphPublishView(APIView):
    """Publish a new route graph version."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request):
        from .models import RouteGraphVersion, RouteLane
        from django.db import transaction
        
        data = request.data
        version_name = data.get('version_name', 'Draft')
        lanes_data = data.get('lanes', [])
        
        if not lanes_data:
            return Response({'error': 'Cannot publish an empty graph.'}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            # Unpublish older versions
            RouteGraphVersion.objects.filter(is_published=True).update(is_published=False)
            
            # Create new version
            new_version = RouteGraphVersion.objects.create(
                version_name=version_name,
                is_published=True,
                author=request.user
            )
            
            # Create lanes
            lanes_to_create = []
            for lane_data in lanes_data:
                lanes_to_create.append(RouteLane(
                    graph_version=new_version,
                    name=lane_data.get('name', ''),
                    geometry=lane_data.get('path', []),
                    distance_km=lane_data.get('distanceKm', 0),
                    direction=lane_data.get('direction', 'two_way'),
                    status=lane_data.get('status', 'active'),
                    priority=lane_data.get('priority', 'main'),
                    allowed_vehicles=lane_data.get('allowedVehicles', [])
                ))
            
            RouteLane.objects.bulk_create(lanes_to_create)
            
        from .serializers import RouteGraphVersionSerializer
        return Response(RouteGraphVersionSerializer(new_version).data)


class RouteGraphTraceView(APIView):
    """Trace road-shaped route suggestions between two points for calibration."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    REQUEST_TIMEOUT_SECONDS = 8

    def post(self, request):
        try:
            start_lat = float(request.data.get('start_latitude'))
            start_lng = float(request.data.get('start_longitude'))
            end_lat = float(request.data.get('end_latitude'))
            end_lng = float(request.data.get('end_longitude'))
        except (TypeError, ValueError):
            return Response({'error': 'Valid start and end coordinates are required.'}, status=status.HTTP_400_BAD_REQUEST)

        requested_mode = (request.data.get('travel_mode') or 'walking').lower()
        modes = [requested_mode]
        for mode in ['walking', 'driving']:
            if mode not in modes:
                modes.append(mode)

        routes = []
        for mode in modes:
            routes.extend(self._trace_google(start_lat, start_lng, end_lat, end_lng, travel_mode=mode))
        if not routes:
            routes = self._trace_osrm(start_lat, start_lng, end_lat, end_lng)

        if not routes:
            return Response({'error': 'No road route found. Move the pins closer to visible roads.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'routes': routes})

    def _trace_osrm(self, start_lat, start_lng, end_lat, end_lng):
        url = f'https://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}'
        params = {
            'overview': 'full',
            'geometries': 'geojson',
            'alternatives': 'true',
            'steps': 'true',
        }
        try:
            response = requests.get(url, params=params, timeout=self.REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            data = response.json()
        except Exception:
            return []

        if data.get('code') != 'Ok' or not data.get('routes'):
            return []

        traced = []
        for idx, route in enumerate(data.get('routes', [])):
            coords = ((route.get('geometry') or {}).get('coordinates') or [])
            path = [{'lat': round(float(lat), 6), 'lng': round(float(lng), 6)} for lng, lat in coords]
            if len(path) < 2:
                continue

            road_names = []
            seen = set()
            for leg in route.get('legs') or []:
                for step in leg.get('steps') or []:
                    name = step.get('name')
                    if name and name not in seen:
                        seen.add(name)
                        road_names.append(name)

            traced.append({
                'id': f'osrm-{idx}',
                'path': path,
                'distance_km': round(float(route.get('distance') or 0) / 1000, 3),
                'duration_minutes': round(float(route.get('duration') or 0) / 60) if route.get('duration') else None,
                'summary': f"via {', '.join(road_names[:3])}" if road_names else f'OSRM route {idx + 1}',
                'provider': 'osrm',
            })
        return traced

    def _trace_google(self, start_lat, start_lng, end_lat, end_lng, travel_mode='driving'):
        api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', None) or os.getenv('GOOGLE_MAPS_API_KEY')
        if not api_key:
            return []

        params = {
            'origin': f'{start_lat},{start_lng}',
            'destination': f'{end_lat},{end_lng}',
            'mode': travel_mode,
            'alternatives': 'true',
            'key': api_key,
        }
        try:
            response = requests.get('https://maps.googleapis.com/maps/api/directions/json', params=params, timeout=self.REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            data = response.json()
        except Exception:
            return []

        if data.get('status') != 'OK' or not data.get('routes'):
            return []

        traced = []
        for idx, route in enumerate(data.get('routes', [])):
            encoded = ((route.get('overview_polyline') or {}).get('points') or '')
            try:
                geometry = RouteDistanceResolver._decode_google_polyline(encoded) if encoded else []
            except Exception:
                geometry = []
            path = [{'lat': point['latitude'], 'lng': point['longitude']} for point in geometry]
            legs = route.get('legs') or []
            distance_m = sum(float((leg.get('distance') or {}).get('value') or 0) for leg in legs)
            duration_s = sum(float((leg.get('duration') or {}).get('value') or 0) for leg in legs)
            if len(path) < 2 or distance_m <= 0:
                continue
            traced.append({
                'id': f'google-{idx}',
                'path': path,
                'distance_km': round(distance_m / 1000, 3),
                'duration_minutes': round(duration_s / 60) if duration_s else None,
                'summary': route.get('summary') or f'Google route {idx + 1}',
                'provider': 'google' if travel_mode == 'driving' else f'google_{travel_mode}',
                'travel_mode': travel_mode,
            })
        return traced

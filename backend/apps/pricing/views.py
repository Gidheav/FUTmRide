from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.rides.services import FareCalculator, RouteDistanceResolver
from .models import FareConfiguration, PlatformSettings
from .serializers import FareConfigSerializer, FareEstimateSerializer, PlatformSettingsSerializer


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

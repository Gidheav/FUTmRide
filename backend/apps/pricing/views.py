from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.rides.services import FareCalculator
from .models import FareConfiguration, PlatformSettings
from .serializers import FareConfigSerializer, FareEstimateSerializer, PlatformSettingsSerializer


class FareConfigListView(generics.ListCreateAPIView):
    serializer_class = FareConfigSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get_queryset(self):
        qs = FareConfiguration.objects.all().order_by('-effective_from')
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
        result = FareCalculator.calculate(
            vehicle_type=serializer.validated_data['vehicle_type'],
            distance_km=serializer.validated_data['distance_km'],
            surge_multiplier=serializer.validated_data.get('surge_multiplier', 1.0),
        )
        return Response(result)


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
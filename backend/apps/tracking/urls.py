from django.urls import path
from rest_framework import generics, permissions
from .models import DriverLocation, TripLocationSnapshot
from .views import FleetPositionsView, FleetIncidentsView


class DriverLocationView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, driver_id):
        from rest_framework.response import Response
        from rest_framework.exceptions import NotFound
        try:
            loc = DriverLocation.objects.get(driver_id=driver_id)
            return Response({
                'driver_id': str(driver_id),
                'latitude': str(loc.latitude),
                'longitude': str(loc.longitude),
                'heading': loc.heading,
                'speed_kmh': loc.speed_kmh,
                'updated_at': loc.updated_at.isoformat(),
            })
        except DriverLocation.DoesNotExist:
            raise NotFound('Driver location not available.')


class TripSnapshotsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from apps.rides.models import Ride
        ride_id = self.kwargs['ride_id']
        try:
            ride = Ride.objects.get(id=ride_id)
        except Ride.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Ride not found.')
        if ride.student != self.request.user and ride.driver != self.request.user:
            if self.request.user.role != 'admin':
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Access denied.')
        return TripLocationSnapshot.objects.filter(ride_id=ride_id).order_by('timestamp')

    def list(self, request, *args, **kwargs):
        from rest_framework.response import Response
        qs = self.get_queryset()
        data = [
            {
                'latitude': str(s.latitude),
                'longitude': str(s.longitude),
                'heading': s.heading,
                'speed_kmh': s.speed_kmh,
                'timestamp': s.timestamp.isoformat(),
            }
            for s in qs
        ]
        return Response({'ride_id': str(self.kwargs['ride_id']), 'snapshots': data})


urlpatterns = [
    path('driver/<uuid:driver_id>/location/', DriverLocationView.as_view(), name='driver-location'),
    path('ride/<uuid:ride_id>/snapshots/', TripSnapshotsView.as_view(), name='trip-snapshots'),
    path('fleet/positions/', FleetPositionsView.as_view(), name='fleet-positions'),
    path('fleet/incidents/', FleetIncidentsView.as_view(), name='fleet-incidents'),
]
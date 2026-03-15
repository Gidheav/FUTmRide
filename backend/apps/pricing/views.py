from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.permissions import IsAdminUser
from apps.rides.services import FareCalculator
from .models import FareConfiguration
from .serializers import FareConfigSerializer, FareEstimateSerializer


class FareConfigListView(generics.ListCreateAPIView):
    serializer_class = FareConfigSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = FareConfiguration.objects.filter(is_active=True)


class FareConfigDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = FareConfigSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = FareConfiguration.objects.all()


class FareEstimateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FareEstimateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = FareCalculator.calculate(
            vehicle_type=serializer.validated_data['vehicle_type'],
            distance_km=serializer.validated_data['distance_km'],
        )
        return Response(result)
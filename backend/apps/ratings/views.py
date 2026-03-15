from rest_framework import generics, permissions
from .models import Rating
from .serializers import RatingCreateSerializer, RatingSerializer


class RatingCreateView(generics.CreateAPIView):
    serializer_class = RatingCreateSerializer
    permission_classes = [permissions.IsAuthenticated]


class MyRatingsReceivedView(generics.ListAPIView):
    serializer_class = RatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Rating.objects.filter(ratee=self.request.user).order_by('-created_at')
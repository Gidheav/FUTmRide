import random
import string
import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from apps.accounts.models import UserRole
from .shared_models import SharedRide, SharedRideRider
from .shared_serializers import (
    SharedRideCreateSerializer, SharedRideDetailSerializer, SharedRideJoinSerializer
)
from .shared_services import SharedRideService


def generate_share_code(length=8):
    """Generate a random alphanumeric share code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


class SharedRideCreateView(generics.CreateAPIView):
    serializer_class = SharedRideCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can create shared rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            # Generate unique code
            code = generate_share_code()
            while SharedRide.objects.filter(share_code=code).exists():
                code = generate_share_code()

            shared_ride = serializer.save(
                creator=request.user,
                reference='SH' + uuid.uuid4().hex[:8].upper(),
                share_code=code,
                expires_at=timezone.now() + timedelta(minutes=15)
            )

            # Auto-join the creator to their own ride
            SharedRideRider.objects.create(
                shared_ride=shared_ride,
                user=request.user,
                status=SharedRideRider.Status.JOINED,
                joined_at=timezone.now(),
            )

        return Response(
            SharedRideDetailSerializer(shared_ride).data, 
            status=status.HTTP_201_CREATED
        )


class SharedRideDetailView(generics.RetrieveAPIView):
    """Fetch by share code (used by friends) or ID."""
    serializer_class = SharedRideDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        lookup = self.kwargs.get('pk')
        if len(lookup) <= 12:
            return get_object_or_404(SharedRide, share_code=lookup.upper())
        return get_object_or_404(SharedRide, id=lookup)


class SharedRideJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can join rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )

        shared_ride = get_object_or_404(SharedRide, id=pk)

        if shared_ride.status != SharedRide.Status.GATHERING:
            return Response(
                {'error': {'code': 'LOCKED', 'message': 'This shared ride is no longer accepting new riders.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_count = shared_ride.riders.exclude(status=SharedRideRider.Status.CANCELLED).count()
        if active_count >= shared_ride.max_riders:
            return Response(
                {'error': {'code': 'FULL', 'message': 'This shared ride is full.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SharedRideJoinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            rider, created = SharedRideRider.objects.get_or_create(
                shared_ride=shared_ride,
                user=request.user,
                defaults={
                    'status': SharedRideRider.Status.JOINED,
                    'joined_at': timezone.now(),
                    **serializer.validated_data
                }
            )
            
            if not created:
                if rider.status == SharedRideRider.Status.CANCELLED:
                    rider.status = SharedRideRider.Status.JOINED
                    for key, value in serializer.validated_data.items():
                        setattr(rider, key, value)
                    rider.save()
                else:
                    return Response(
                        {'error': {'code': 'ALREADY_JOINED', 'message': 'You have already joined this ride.'}},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            
            # Recompute fares since a new rider joined
            SharedRideService.compute_fares(shared_ride)
            
        shared_ride.refresh_from_db()
        return Response(SharedRideDetailSerializer(shared_ride).data)


class SharedRideConfirmView(APIView):
    """Rider confirms and pays their share."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        shared_ride = get_object_or_404(SharedRide, id=pk)
        rider = get_object_or_404(SharedRideRider, shared_ride=shared_ride, user=request.user)

        try:
            SharedRideService.confirm_rider(rider)
        except ValueError as e:
            return Response(
                {'error': {'code': 'CONFIRM_ERROR', 'message': str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        shared_ride.refresh_from_db()
        return Response(SharedRideDetailSerializer(shared_ride).data)


class SharedRideDispatchView(APIView):
    """Creator dispatches the ride to the driver pool."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        shared_ride = get_object_or_404(SharedRide, id=pk, creator=request.user)
        
        try:
            SharedRideService.dispatch_ride(shared_ride)
        except ValueError as e:
            return Response(
                {'error': {'code': 'DISPATCH_ERROR', 'message': str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shared_ride.refresh_from_db()
        return Response(SharedRideDetailSerializer(shared_ride).data)


class MySharedRidesView(generics.ListAPIView):
    serializer_class = SharedRideDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return all shared rides this user is part of
        return SharedRide.objects.filter(
            riders__user=self.request.user
        ).distinct()

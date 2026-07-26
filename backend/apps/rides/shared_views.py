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
from .models import Ride, RideStatus
from .shared_models import SharedRide, SharedRideRider
from .shared_serializers import (
    SharedRideCreateSerializer, SharedRideDetailSerializer, SharedRideJoinSerializer
)
from .shared_services import SharedRideService
from .geofence import validate_coordinates_in_service_area
from .utils import has_blocking_active_ride


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

        if has_blocking_active_ride(request.user):
            return Response(
                {'error': {'code': 'ACTIVE_RIDE_EXISTS', 'message': 'You already have an active ride. Please complete or cancel it first.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            # Generate unique code
            code = generate_share_code()
            while SharedRide.objects.filter(share_code=code).exists():
                code = generate_share_code()

            pickup_latitude = serializer.validated_data.pop('pickup_latitude', None)
            pickup_longitude = serializer.validated_data.pop('pickup_longitude', None)
            pickup_address = serializer.validated_data.pop('pickup_address', '')
            dropoff_latitude = serializer.validated_data.get('dropoff_latitude')
            dropoff_longitude = serializer.validated_data.get('dropoff_longitude')

            # Geofence validation
            try:
                validate_coordinates_in_service_area(pickup_latitude, pickup_longitude, label='Pickup')
                validate_coordinates_in_service_area(dropoff_latitude, dropoff_longitude, label='Dropoff')
            except ValueError as e:
                return Response(
                    {'error': {'code': 'OUTSIDE_SERVICE_AREA', 'message': str(e)}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

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
                pickup_latitude=pickup_latitude,
                pickup_longitude=pickup_longitude,
                pickup_address=pickup_address
            )

            # Compute the initial fare for the creator
            SharedRideService.compute_fares(shared_ride)

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

    def delete(self, request, *args, **kwargs):
        """Allow creator to delete cancelled, expired or completed shared rides from their history."""
        shared_ride = self.get_object()
        
        if shared_ride.creator != request.user:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only the creator can delete this ride.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
            
        allowed_statuses = [SharedRide.Status.CANCELLED, SharedRide.Status.EXPIRED, SharedRide.Status.COMPLETED]
        if shared_ride.status not in allowed_statuses:
            return Response(
                {'error': {'code': 'CANNOT_DELETE', 'message': f'Cannot delete a ride in {shared_ride.status} state.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        shared_ride.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        
        pickup_latitude = serializer.validated_data.get('pickup_latitude')
        pickup_longitude = serializer.validated_data.get('pickup_longitude')
        
        try:
            validate_coordinates_in_service_area(pickup_latitude, pickup_longitude, label='Pickup')
        except ValueError as e:
            return Response(
                {'error': {'code': 'OUTSIDE_SERVICE_AREA', 'message': str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if has_blocking_active_ride(request.user):
            return Response(
                {'error': {'code': 'ACTIVE_RIDE_EXISTS', 'message': 'You already have an active ride.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
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



class MySharedRidesView(APIView):
    """
    Returns two lists:
    - created: shared rides where this user is the creator
    - invited: shared rides where this user is a rider (NOT creator)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        created = SharedRide.objects.filter(creator=user).order_by('-created_at')
        invited = SharedRide.objects.filter(
            riders__user=user
        ).exclude(creator=user).distinct().order_by('-created_at')

        return Response({
            'created': SharedRideDetailSerializer(created, many=True).data,
            'invited': SharedRideDetailSerializer(invited, many=True).data,
        })


class SharedRideCancelView(APIView):
    """Cancel your participation or (if creator) the entire ride."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        shared_ride = get_object_or_404(SharedRide, id=pk)

        if shared_ride.creator == request.user:
            # Creator cancels the whole ride
            if shared_ride.status not in (SharedRide.Status.GATHERING, SharedRide.Status.MATCHING):
                return Response(
                    {'error': {'code': 'CANNOT_CANCEL', 'message': 'This ride cannot be cancelled at this stage.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # Refund all confirmed riders
            with transaction.atomic():
                for rider in shared_ride.riders.filter(status=SharedRideRider.Status.CONFIRMED):
                    SharedRideService.refund_rider(rider)
                
                shared_ride.status = SharedRide.Status.CANCELLED
                shared_ride.save()
        else:
            # Rider cancels their own seat
            rider = get_object_or_404(SharedRideRider, shared_ride=shared_ride, user=request.user)
            
            with transaction.atomic():
                if rider.status == SharedRideRider.Status.CONFIRMED:
                    SharedRideService.refund_rider(rider)
                else:
                    rider.status = SharedRideRider.Status.CANCELLED
                    rider.save()
                    
                # Recompute fares for remaining riders if it's still gathering
                if shared_ride.status == SharedRide.Status.GATHERING:
                    SharedRideService.compute_fares(shared_ride)

        shared_ride.refresh_from_db()
        return Response(SharedRideDetailSerializer(shared_ride).data)


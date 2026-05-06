import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from rest_framework import generics, permissions, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound, PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.models import UserRole, DriverProfile
from apps.accounts.permissions import IsAdminUser, IsPhoneVerified
from apps.payments.models import WalletTransaction
from apps.payments.services import WalletService
from .models import Ride, RideStatus, DriverRideRequest
from .serializers import (
    RideRequestSerializer,
    RideDetailSerializer,
    RideListSerializer,
    RideCancelSerializer,
)
from .services import FareCalculator, RideMatchingService

logger = logging.getLogger('apps.rides')


class RideRequestView(generics.CreateAPIView):
    serializer_class = RideRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsPhoneVerified]

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can request rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        active_ride = Ride.objects.filter(
            student=request.user,
            status__in=[
                RideStatus.REQUESTED, RideStatus.SEARCHING,
                RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_EN_ROUTE,
                RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS,
            ]
        ).first()
        if active_ride:
            return Response(
                {'error': {'code': 'ACTIVE_RIDE_EXISTS', 'message': 'You already have an active ride.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ride = serializer.save()
        ride.transition_to(RideStatus.SEARCHING)
        fare_data = FareCalculator.calculate(
            vehicle_type=ride.vehicle_type_requested,
            distance_km=float(ride.estimated_distance_km or 2.0),
        )
        ride.base_fare = fare_data['base_fare']
        ride.total_fare = fare_data['total_fare']
        ride.platform_commission = fare_data['platform_commission']
        ride.driver_earnings = fare_data['driver_earnings']
        ride.surge_multiplier = fare_data['surge_multiplier']
        ride.save()
        assigned = RideMatchingService.assign_driver(ride)
        ride.refresh_from_db()
        logger.info('ride_requested ref=%s student=%s assigned=%s', ride.reference, str(request.user.id), assigned)
        return Response(RideDetailSerializer(ride, context={'request': request}).data, status=status.HTTP_201_CREATED)


class StudentRideListView(generics.ListAPIView):
    serializer_class = RideListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Ride.objects.filter(student=self.request.user).select_related('student', 'driver').order_by('-requested_at')


class RideDetailView(generics.RetrieveAPIView):
    serializer_class = RideDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            ride = Ride.objects.select_related('student', 'driver').get(id=self.kwargs['ride_id'])
        except Ride.DoesNotExist:
            raise NotFound('Ride not found.')
        if ride.student != self.request.user and ride.driver != self.request.user:
            if not self.request.user.is_staff and self.request.user.role != UserRole.ADMIN:
                raise PermissionDenied('You do not have access to this ride.')
        return ride


class CancelRideView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ride_id):
        try:
            ride = Ride.objects.get(id=ride_id)
        except Ride.DoesNotExist:
            raise NotFound('Ride not found.')
        serializer = RideCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get('reason', '')
        if ride.student == request.user:
            if not ride.is_active:
                return Response(
                    {'error': {'code': 'INVALID_STATUS', 'message': 'This ride cannot be cancelled.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ride.transition_to(RideStatus.CANCELLED_BY_STUDENT)
            ride.cancellation_reason = reason
            ride.save()
        elif ride.driver == request.user:
            if ride.status not in [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_EN_ROUTE, RideStatus.DRIVER_ARRIVED]:
                return Response(
                    {'error': {'code': 'INVALID_STATUS', 'message': 'You cannot cancel at this stage.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ride.transition_to(RideStatus.CANCELLED_BY_DRIVER)
            ride.cancellation_reason = reason
            ride.save()
            try:
                profile = request.user.driver_profile
                profile.is_on_trip = False
                profile.save(update_fields=['is_on_trip'])
            except DriverProfile.DoesNotExist:
                pass
        else:
            raise PermissionDenied('You cannot cancel this ride.')
        logger.info('ride_cancelled ref=%s by=%s', ride.reference, str(request.user.id))
        return Response(RideDetailSerializer(ride, context={'request': request}).data)


class DriverRideStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    STATUS_FLOW = {
        RideStatus.DRIVER_ASSIGNED: RideStatus.DRIVER_EN_ROUTE,
        RideStatus.DRIVER_EN_ROUTE: RideStatus.DRIVER_ARRIVED,
        RideStatus.DRIVER_ARRIVED: RideStatus.IN_PROGRESS,
        RideStatus.IN_PROGRESS: RideStatus.COMPLETED,
    }

    def post(self, request, ride_id):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can update ride status.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            ride = Ride.objects.get(id=ride_id, driver=request.user)
        except Ride.DoesNotExist:
            raise NotFound('Ride not found.')
        next_status = self.STATUS_FLOW.get(ride.status)
        if not next_status:
            return Response(
                {'error': {'code': 'INVALID_STATUS', 'message': f'No next step from: {ride.status}'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            ride.transition_to(next_status)
            ride.save()
        except ValueError as e:
            return Response({'error': {'code': 'INVALID_TRANSITION', 'message': str(e)}}, status=status.HTTP_400_BAD_REQUEST)
        if next_status == RideStatus.COMPLETED:
            try:
                profile = request.user.driver_profile
                profile.is_on_trip = False
                profile.total_trips += 1
                profile.total_earnings += ride.driver_earnings or 0
                profile.save(update_fields=['is_on_trip', 'total_trips', 'total_earnings'])
            except DriverProfile.DoesNotExist:
                pass
            try:
                sp = ride.student.student_profile
                sp.total_trips += 1
                sp.save(update_fields=['total_trips'])
            except Exception:
                pass
            if ride.payment_method == 'wallet' and not ride.is_paid:
                try:
                    with transaction.atomic():
                        ride_locked = Ride.objects.select_for_update().get(id=ride.id)
                        if ride_locked.is_paid:
                            logger.info('ride_wallet_already_paid ref=%s', ride.reference)
                        else:
                            existing = WalletTransaction.objects.filter(
                                ride=ride_locked,
                                source=WalletTransaction.Source.RIDE_PAYMENT,
                                transaction_type=WalletTransaction.TransactionType.DEBIT,
                            ).first()
                            if existing:
                                ride_locked.is_paid = True
                                ride_locked.save(update_fields=['is_paid'])
                                logger.info('ride_wallet_existing_tx ref=%s tx=%s', ride.reference, existing.reference)
                            else:
                                fare = ride_locked.total_fare or Decimal('0.00')
                                WalletService.debit(
                                    user=ride_locked.student,
                                    amount=fare,
                                    source=WalletTransaction.Source.RIDE_PAYMENT,
                                    narration=f'Ride payment — {ride_locked.reference}',
                                    ride=ride_locked,
                                    metadata={
                                        'driver_id': str(ride_locked.driver_id or ''),
                                        'platform_commission': str(ride_locked.platform_commission or 0),
                                    },
                                )
                                ride_locked.is_paid = True
                                ride_locked.save(update_fields=['is_paid'])
                                logger.info('ride_wallet_debited ref=%s amount=%s', ride.reference, fare)
                except ValueError:
                    logger.warning('ride_wallet_insufficient ref=%s', ride.reference)
                except Exception as e:
                    logger.error('ride_wallet_debit_error ref=%s error=%s', ride.reference, str(e))
        logger.info('ride_advanced ref=%s to=%s driver=%s', ride.reference, next_status, str(request.user.id))
        return Response(RideDetailSerializer(ride, context={'request': request}).data)


class DriverActiveRideView(generics.RetrieveAPIView):
    serializer_class = RideDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        if self.request.user.role != UserRole.DRIVER:
            raise PermissionDenied('Only drivers can access this endpoint.')
        ride = Ride.objects.filter(
            driver=self.request.user,
            status__in=[RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_EN_ROUTE, RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS],
        ).select_related('student', 'driver').first()
        if not ride:
            raise NotFound('No active ride found.')
        return ride


class DriverRideHistoryView(generics.ListAPIView):
    serializer_class = RideListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role != UserRole.DRIVER:
            raise PermissionDenied('Only drivers can access this endpoint.')
        return Ride.objects.filter(
            driver=self.request.user,
            status=RideStatus.COMPLETED,
        ).select_related('student', 'driver').order_by('-trip_completed_at')


class AdminRideListView(generics.ListAPIView):
    serializer_class = RideListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vehicle_type_requested', 'payment_method', 'is_paid']
    search_fields = ['reference', 'student__first_name', 'student__phone_number', 'pickup_address', 'dropoff_address']
    ordering_fields = ['requested_at', 'total_fare']
    ordering = ['-requested_at']

    def get_queryset(self):
        return Ride.objects.all().select_related('student', 'driver')
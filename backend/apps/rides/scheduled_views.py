from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CampusAdminProfile, UserRole
from apps.accounts.permissions import IsAdminOrCampusAdmin, IsStudentUser
from apps.payments.models import WalletTransaction
from apps.payments.services import WalletService
from .scheduled_models import (
    PassengerStatus,
    ScheduledRide,
    ScheduledRidePassenger,
    ScheduledRideStatus,
)
from .scheduled_serializers import (
    ScheduledRideCreateSerializer,
    ScheduledRideDetailSerializer,
    ScheduledRideJoinSerializer,
    ScheduledRideListSerializer,
    ScheduledRidePassengerReadSerializer,
    StudentScheduledRideDetailSerializer,
)


def admin_campus(user):
    try:
        return user.campus_admin_profile.campus
    except CampusAdminProfile.DoesNotExist:
        return None


def scope_admin_queryset(user, queryset):
    if user.role == UserRole.ADMIN:
        return queryset
    campus = admin_campus(user)
    if not campus:
        return queryset.none()
    return queryset.filter(campus=campus)


def refund_passenger(passenger, reason):
    amount = Decimal(str(passenger.amount_paid or 0))
    if amount <= 0:
        return None

    existing = WalletTransaction.objects.filter(
        user=passenger.student,
        source=WalletTransaction.Source.RIDE_REFUND,
        metadata__scheduled_passenger_id=str(passenger.id),
    ).first()
    if existing:
        return existing

    return WalletService.credit(
        user=passenger.student,
        amount=amount,
        source=WalletTransaction.Source.RIDE_REFUND,
        narration=f'{reason} - {passenger.ride.reference}',
        metadata={
            'scheduled_ride_id': str(passenger.ride_id),
            'scheduled_passenger_id': str(passenger.id),
            'scheduled_ride_reference': passenger.ride.reference,
            'original_payment_reference': passenger.payment_reference,
            'reason': reason,
        },
    )


class ScheduledRideCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    serializer_class = ScheduledRideCreateSerializer

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.CAMPUS_ADMIN:
            return Response(
                {'detail': 'Only campus admins can create scheduled rides.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ride = serializer.save()
        return Response(
            ScheduledRideDetailSerializer(ride, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ScheduledRideListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    serializer_class = ScheduledRideListSerializer

    def get_queryset(self):
        qs = ScheduledRide.objects.select_related('created_by', 'assigned_driver', 'campus').prefetch_related('stops')
        qs = scope_admin_queryset(self.request.user, qs)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        date_filter = self.request.query_params.get('date')
        if date_filter:
            qs = qs.filter(departure_date=date_filter)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(departure_date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(departure_date__lte=date_to)

        return qs.order_by('departure_date', 'window_start')


class ScheduledRideDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    serializer_class = ScheduledRideDetailSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'ride_id'

    def get_queryset(self):
        qs = ScheduledRide.objects.select_related(
            'created_by', 'assigned_driver', 'campus',
        ).prefetch_related(
            'stops',
            'passengers',
            'passengers__student',
            'passengers__boarding_stop',
            'passengers__alighting_stop',
        )
        return scope_admin_queryset(self.request.user, qs)


class ScheduledRideCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id):
        ride = self._get_scoped_ride(request.user, ride_id, for_update=True)
        try:
            ride.transition_to(ScheduledRideStatus.CANCELLED)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        ride.save(update_fields=['status', 'updated_at'])
        passengers = list(ride.passengers.select_related('student').exclude(status=PassengerStatus.CANCELLED))
        for passenger in passengers:
            refund_passenger(passenger, 'Scheduled ride cancelled')
            passenger.status = PassengerStatus.CANCELLED
            passenger.save(update_fields=['status'])

        return Response(ScheduledRideDetailSerializer(ride, context={'request': request}).data)

    def _get_scoped_ride(self, user, ride_id, for_update=False):
        qs = ScheduledRide.objects.all()
        if for_update:
            qs = qs.select_for_update()
        qs = scope_admin_queryset(user, qs)
        try:
            return qs.get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            raise NotFound('Ride not found.')


class ScheduledRideDepartView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id):
        ride = self._get_scoped_ride(request.user, ride_id)
        if ride.status == ScheduledRideStatus.SCHEDULED:
            ride.transition_to(ScheduledRideStatus.BOARDING)
        try:
            ride.transition_to(ScheduledRideStatus.DEPARTED)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        ride.save(update_fields=['status', 'updated_at'])
        return Response(ScheduledRideDetailSerializer(ride, context={'request': request}).data)

    def _get_scoped_ride(self, user, ride_id):
        qs = scope_admin_queryset(user, ScheduledRide.objects.select_for_update())
        try:
            return qs.get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            raise NotFound('Ride not found.')


class ScheduledRideCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id):
        ride = self._get_scoped_ride(request.user, ride_id)
        try:
            ride.transition_to(ScheduledRideStatus.COMPLETED)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        ride.save(update_fields=['status', 'updated_at'])
        return Response(ScheduledRideDetailSerializer(ride, context={'request': request}).data)

    def _get_scoped_ride(self, user, ride_id):
        qs = scope_admin_queryset(user, ScheduledRide.objects.select_for_update())
        try:
            return qs.get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            raise NotFound('Ride not found.')


class StudentAvailableScheduledRidesView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsStudentUser]
    serializer_class = ScheduledRideListSerializer

    def get_queryset(self):
        qs = ScheduledRide.objects.select_related('assigned_driver', 'created_by').filter(
            status=ScheduledRideStatus.SCHEDULED,
            join_deadline__gt=timezone.now(),
        )
        try:
            campus = self.request.user.student_profile.campus
        except Exception:
            campus = None
        if campus:
            qs = qs.filter(campus=campus)
        return qs.order_by('departure_date', 'window_start')


class StudentScheduledRideDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated, IsStudentUser]
    serializer_class = StudentScheduledRideDetailSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'ride_id'

    def get_queryset(self):
        return StudentAvailableScheduledRidesView().get_queryset()

    def get_object(self):
        qs = ScheduledRide.objects.prefetch_related('stops').filter(id=self.kwargs['ride_id'])
        try:
            campus = self.request.user.student_profile.campus
        except Exception:
            campus = None
        if campus:
            qs = qs.filter(campus=campus)
        obj = qs.first()
        if not obj:
            raise NotFound('Ride not found.')
        if obj.status != ScheduledRideStatus.SCHEDULED and not ScheduledRidePassenger.objects.filter(
            ride=obj, student=self.request.user,
        ).exists():
            raise PermissionDenied('You do not have access to this ride.')
        return obj


class StudentJoinScheduledRideView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudentUser]

    @transaction.atomic
    def post(self, request, ride_id):
        try:
            ride = ScheduledRide.objects.select_for_update().get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            return Response({'detail': 'Ride not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ScheduledRideJoinSerializer(
            data=request.data,
            context={'request': request, 'ride': ride},
        )
        serializer.is_valid(raise_exception=True)
        passenger = serializer.save()
        return Response(
            ScheduledRidePassengerReadSerializer(passenger, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class StudentLeaveScheduledRideView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStudentUser]

    @transaction.atomic
    def post(self, request, ride_id):
        try:
            passenger = ScheduledRidePassenger.objects.select_for_update().select_related(
                'ride', 'student',
            ).get(ride_id=ride_id, student=request.user)
        except ScheduledRidePassenger.DoesNotExist:
            return Response({'detail': 'You do not have a ticket for this ride.'}, status=status.HTTP_404_NOT_FOUND)

        if passenger.status == PassengerStatus.CANCELLED:
            return Response({'detail': 'Ticket is already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)
        if passenger.status in [PassengerStatus.BOARDED, PassengerStatus.ALIGHTED]:
            return Response({'detail': 'Cannot cancel after boarding.'}, status=status.HTTP_400_BAD_REQUEST)
        if passenger.ride.status != ScheduledRideStatus.SCHEDULED or timezone.now() >= passenger.ride.join_deadline:
            return Response({'detail': 'Cannot cancel after the join deadline has passed.'}, status=status.HTTP_400_BAD_REQUEST)

        refund_passenger(passenger, 'Scheduled ride ticket cancelled')
        passenger.status = PassengerStatus.CANCELLED
        passenger.save(update_fields=['status'])
        return Response(ScheduledRidePassengerReadSerializer(passenger, context={'request': request}).data)

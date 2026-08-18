from decimal import Decimal

from django.db.models import Q
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
    ScheduledRideBusAssignment,
    ScheduledRidePassenger,
    ScheduledRideStatus,
    BusAssignmentStatus,
)
from .scheduled_serializers import (
    ScheduledRideCreateSerializer,
    ScheduledRideDetailSerializer,
    ScheduledRideJoinSerializer,
    ScheduledRideListSerializer,
    ScheduledRidePassengerReadSerializer,
    StudentScheduledRideDetailSerializer,
    DispatchedBusListSerializer,
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


def student_campus_scope(campus):
    if not campus:
        return Q()

    scope = Q(campus=campus)
    marker = f'({campus.code})'
    if marker in campus.name:
        scope |= Q(campus__code=campus.name.split(marker, 1)[0].strip())

    parent_codes = []
    if '(' in campus.name and ')' in campus.name:
        parent_codes.append(campus.name.rsplit('(', 1)[-1].split(')', 1)[0].strip())
    if ' - ' in campus.name:
        parent_codes.append(campus.name.rsplit(' - ', 1)[0].strip())

    parent_codes = [code for code in parent_codes if code and code != campus.code]
    if parent_codes:
        scope |= Q(campus__code__in=parent_codes)
    return scope


def student_visible_scheduled_ride_scope():
    now = timezone.localtime()
    return Q(
        status__in=[ScheduledRideStatus.SCHEDULED, ScheduledRideStatus.BOARDING],
    ) & (
        Q(departure_date__gt=now.date())
        | Q(departure_date=now.date(), window_end__gte=now.time())
    )


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
        date_filter = self.request.query_params.get('date')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if not any([status_filter, date_filter, date_from, date_to]):
            import datetime
            from django.utils import timezone
            cutoff_date = timezone.now().date() - datetime.timedelta(days=1)
            qs = qs.filter(departure_date__gte=cutoff_date).exclude(
                status__in=[ScheduledRideStatus.COMPLETED, ScheduledRideStatus.CANCELLED]
            )
        else:
            if status_filter:
                qs = qs.filter(status=status_filter)
            if date_filter:
                qs = qs.filter(departure_date=date_filter)
            if date_from:
                qs = qs.filter(departure_date__gte=date_from)
            if date_to:
                qs = qs.filter(departure_date__lte=date_to)

        return qs.order_by('departure_date', 'window_start')


class DispatchedBusListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    serializer_class = DispatchedBusListSerializer

    def get_queryset(self):
        qs = ScheduledRideBusAssignment.objects.select_related(
            'ride', 'driver', 'ride__campus'
        ).prefetch_related('ride__stops')
        
        # Scope by campus admin
        if self.request.user.role != UserRole.ADMIN:
            campus = admin_campus(self.request.user)
            if not campus:
                return qs.none()
            qs = qs.filter(ride__campus=campus)

        # Only return buses that have been dispatched
        active_statuses = [
            BusAssignmentStatus.DEPARTED,
            BusAssignmentStatus.EN_ROUTE,
            BusAssignmentStatus.ARRIVED,
            BusAssignmentStatus.COMPLETED
        ]
        
        qs = qs.filter(status__in=active_statuses)
        
        # Smart default: exclude old completed buses (older than 48 hours)
        import datetime
        from django.utils import timezone
        from django.db.models import Q
        cutoff_time = timezone.now() - datetime.timedelta(hours=48)
        qs = qs.filter(
            Q(departed_at__gte=cutoff_time) | 
            Q(status__in=[BusAssignmentStatus.DEPARTED, BusAssignmentStatus.EN_ROUTE, BusAssignmentStatus.ARRIVED])
        )

        return qs.order_by('-departed_at', 'ride__departure_date')


class ScheduledRideDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
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

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            from .scheduled_serializers import ScheduledRideUpdateSerializer
            return ScheduledRideUpdateSerializer
        from .scheduled_serializers import ScheduledRideDetailSerializer
        return ScheduledRideDetailSerializer

class ScheduledRideStopsUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def patch(self, request, ride_id):
        ride = self._get_scoped_ride(request.user, ride_id, for_update=True)
        if not ride:
            return Response(status=status.HTTP_404_NOT_FOUND)

        from .scheduled_serializers import ScheduledRideStopsUpdateSerializer
        serializer = ScheduledRideStopsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        stops_data = serializer.validated_data['stops']
        existing_stops = {stop.id: stop for stop in ride.stops.all()}
        
        updated_stop_ids = []
        for stop_data in stops_data:
            stop_id = stop_data.get('id')
            if stop_id and stop_id in existing_stops:
                stop = existing_stops[stop_id]
                for k, v in stop_data.items():
                    if k != 'id':
                        setattr(stop, k, v)
                stop.save()
                updated_stop_ids.append(stop_id)
            else:
                stop_data.pop('id', None)
                from .scheduled_models import ScheduledRideStop
                new_stop = ScheduledRideStop.objects.create(ride=ride, **stop_data)
                updated_stop_ids.append(new_stop.id)
                
        # delete removed stops
        for stop_id, stop in existing_stops.items():
            if stop_id not in updated_stop_ids:
                stop.delete()

        ordered_stops = sorted(ride.stops.all(), key=lambda s: s.order)
        if ordered_stops:
            from .scheduled_serializers import get_full_route_fare_summary

            full_route = get_full_route_fare_summary(ride)
            ride.origin_address = ordered_stops[0].address
            ride.origin_latitude = ordered_stops[0].latitude
            ride.origin_longitude = ordered_stops[0].longitude
            ride.destination_address = ordered_stops[-1].address
            ride.destination_latitude = ordered_stops[-1].latitude
            ride.destination_longitude = ordered_stops[-1].longitude
            if full_route:
                ride.standard_price = Decimal(str(full_route['fare']))
            ride.save(update_fields=[
                'origin_address', 'origin_latitude', 'origin_longitude',
                'destination_address', 'destination_latitude', 'destination_longitude',
                'standard_price', 'updated_at',
            ])

        from .scheduled_serializers import ScheduledRideDetailSerializer
        return Response(ScheduledRideDetailSerializer(ride, context={'request': request}).data)

    def _get_scoped_ride(self, user, ride_id, for_update=False):
        qs = ScheduledRide.objects.all()
        if for_update:
            qs = qs.select_for_update()
        return scope_admin_queryset(user, qs).filter(id=ride_id).first()


class CancellationImpactView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request, ride_id):
        ride = self._get_scoped_ride(request.user, ride_id)
        return Response(ride.cancellation_impact)

    def _get_scoped_ride(self, user, ride_id):
        qs = scope_admin_queryset(user, ScheduledRide.objects.all())
        try:
            return qs.get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            raise NotFound('Ride not found.')

class ScheduledRideCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id):
        ride = self._get_scoped_ride(request.user, ride_id, for_update=True)
        
        if not ride.can_cancel:
            return Response({'detail': 'Cannot cancel this ride. Vehicles have already departed.'}, status=status.HTTP_400_BAD_REQUEST)
            
        boarded = ride.passengers.filter(status=PassengerStatus.BOARDED).count()
        if boarded > 0:
            return Response({'detail': f'{boarded} passengers have already boarded. Unboard them first or complete the ride.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Process confirmed passengers
        passengers = list(ride.passengers.select_related('student').exclude(status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW]))
        for passenger in passengers:
            refund_passenger(passenger, 'Scheduled ride cancelled')
            passenger.status = PassengerStatus.CANCELLED
            passenger.save(update_fields=['status'])

        # Process bus assignments
        buses = ride.bus_assignments.filter(status__in=[BusAssignmentStatus.ASSIGNED, BusAssignmentStatus.BOARDING, BusAssignmentStatus.LOADING])
        for bus in buses:
            if bus.driver:
                from .scheduled_models import ScheduledRideDriverInterest
                ScheduledRideDriverInterest.objects.filter(
                    ride=ride,
                    driver=bus.driver,
                    status='assigned'
                ).update(status='interested')
            bus.delete()

        try:
            ride.transition_to(ScheduledRideStatus.CANCELLED)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        ride.save(update_fields=['status', 'updated_at'])

        # Log Activity
        from .scheduled_models import ScheduledRideActivityLog
        ScheduledRideActivityLog.objects.create(
            ride=ride,
            message=f"Ride cancelled by admin. {len(passengers)} passengers refunded. {len(buses)} bus assignments removed.",
            log_type='warning'
        )

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

class ScheduledRideHardDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def delete(self, request, ride_id):
        qs = scope_admin_queryset(request.user, ScheduledRide.objects.all())
        try:
            ride = qs.get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            raise NotFound('Ride not found.')
            
        if not ride.can_hard_delete:
            return Response({'detail': 'This ride cannot be permanently deleted. Financial records or active assignments exist.'}, status=status.HTTP_400_BAD_REQUEST)
            
        ride.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
            student_visible_scheduled_ride_scope()
        )
        try:
            campus = self.request.user.student_profile.campus
        except Exception:
            campus = None
        if campus:
            qs = qs.filter(student_campus_scope(campus))
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
            qs = qs.filter(student_campus_scope(campus))
        obj = qs.first()
        if not obj:
            raise NotFound('Ride not found.')
        if not ScheduledRide.objects.filter(id=obj.id).filter(
            student_visible_scheduled_ride_scope()
        ).exists() and not ScheduledRidePassenger.objects.filter(
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


class ScheduledRideActivityLogView(APIView):
    """GET/POST activity logs for a scheduled ride."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get_ride(self, ride_id, user):
        try:
            qs = ScheduledRide.objects.all()
            qs = scope_admin_queryset(user, qs)
            return qs.get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            raise NotFound('Ride not found.')

    def get(self, request, ride_id):
        from .scheduled_models import ScheduledRideActivityLog
        from .scheduled_serializers import ScheduledRideActivityLogSerializer
        self.get_ride(ride_id, request.user)
        logs = ScheduledRideActivityLog.objects.filter(ride_id=ride_id).order_by('-created_at')[:200]
        serializer = ScheduledRideActivityLogSerializer(logs, many=True)
        return Response(serializer.data)

    def post(self, request, ride_id):
        from .scheduled_models import ScheduledRideActivityLog
        from .scheduled_serializers import ScheduledRideActivityLogSerializer
        self.get_ride(ride_id, request.user)
        data = {
            'ride': str(ride_id),
            'message': request.data.get('message', ''),
            'log_type': request.data.get('log_type', 'info'),
        }
        serializer = ScheduledRideActivityLogSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

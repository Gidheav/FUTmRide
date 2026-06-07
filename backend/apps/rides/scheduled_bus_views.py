from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserRole
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.payments.models import WalletTransaction
from apps.payments.services import WalletService
from .scheduled_models import (
    BusAssignmentStatus,
    PassengerStatus,
    ScheduledRide,
    ScheduledRideBusAssignment,
    ScheduledRidePassenger,
    ScheduledRideStatus,
    SeatType,
)
from .scheduled_bus_serializers import (
    AllocationResultSerializer,
    BusAssignmentCreateSerializer,
    BusAssignmentReadSerializer,
    BusAssignmentUpdateSerializer,
    PassengerManifestSerializer,
    ReassignPassengerSerializer,
)
from .scheduled_views import admin_campus, scope_admin_queryset


def _get_scoped_ride(user, ride_id):
    qs = scope_admin_queryset(user, ScheduledRide.objects.all())
    try:
        return qs.get(id=ride_id)
    except ScheduledRide.DoesNotExist:
        raise NotFound('Ride not found.')


def _get_bus(ride, bus_id, for_update=False):
    qs = ScheduledRideBusAssignment.objects.filter(ride=ride)
    if for_update:
        qs = qs.select_for_update()
    try:
        return qs.get(id=bus_id)
    except ScheduledRideBusAssignment.DoesNotExist:
        raise NotFound('Bus assignment not found.')


def _refund_passenger(passenger, reason):
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


# ── Bus Assignment CRUD ───────────────────────────────────────────────────────


class BusAssignmentListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    serializer_class = BusAssignmentReadSerializer

    def get_queryset(self):
        ride = _get_scoped_ride(self.request.user, self.kwargs['ride_id'])
        return ScheduledRideBusAssignment.objects.filter(ride=ride).order_by('order')


class BusAssignmentCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, ride_id):
        ride = _get_scoped_ride(request.user, ride_id)
        serializer = BusAssignmentCreateSerializer(data=request.data, context={'ride': ride})
        serializer.is_valid(raise_exception=True)
        bus = ScheduledRideBusAssignment.objects.create(ride=ride, **serializer.validated_data)
        return Response(
            BusAssignmentReadSerializer(bus).data,
            status=status.HTTP_201_CREATED,
        )


class BusAssignmentUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def patch(self, request, ride_id, bus_id):
        ride = _get_scoped_ride(request.user, ride_id)
        bus = _get_bus(ride, bus_id)
        serializer = BusAssignmentUpdateSerializer(bus, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(BusAssignmentReadSerializer(bus).data)


# ── Bus Lifecycle Transitions ─────────────────────────────────────────────────


class BusAllocateView(APIView):
    """Auto-allocate unassigned passengers to a specific bus (FIFO by joined_at)."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id, bus_id):
        ride = _get_scoped_ride(request.user, ride_id)
        bus = _get_bus(ride, bus_id, for_update=True)

        unassigned = ScheduledRidePassenger.objects.filter(
            ride=ride, bus_assignment__isnull=True,
        ).exclude(
            status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW],
        ).order_by('joined_at')

        allocated = 0
        for pax in unassigned:
            if bus.seats_available > 0 and pax.pricing_tier != 'standing':
                pax.bus_assignment = bus
                pax.seat_type = SeatType.SEATED
                pax.save(update_fields=['bus_assignment', 'seat_type'])
                allocated += 1
            elif bus.standing_available > 0 and pax.pricing_tier == 'standing':
                pax.bus_assignment = bus
                pax.seat_type = SeatType.STANDING
                pax.save(update_fields=['bus_assignment', 'seat_type'])
                allocated += 1

        remaining = ScheduledRidePassenger.objects.filter(
            ride=ride, bus_assignment__isnull=True,
        ).exclude(status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW]).count()

        return Response({
            'allocated': allocated,
            'unallocated': remaining,
            'buses': [{'id': str(bus.id), 'label': bus.bus_label, 'allocated': allocated}],
        })


class BusAutoCheckInView(APIView):
    """Auto check-in passengers to a specific bus (FIFO by joined_at), allocating if necessary."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id, bus_id):
        ride = _get_scoped_ride(request.user, ride_id)
        bus = _get_bus(ride, bus_id, for_update=True)

        # 1. Check in already assigned but unchecked passengers
        assigned_unchecked = ScheduledRidePassenger.objects.filter(
            ride=ride, bus_assignment=bus, checked_in_at__isnull=True,
        ).exclude(
            status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW]
        )
        
        checked_in_count = 0
        now = timezone.now()
        for pax in assigned_unchecked:
            pax.checked_in_at = now
            pax.status = PassengerStatus.BOARDED
            pax.save(update_fields=['checked_in_at', 'status'])
            checked_in_count += 1

        # 2. Fill remaining capacity from unassigned passengers
        unassigned = ScheduledRidePassenger.objects.filter(
            ride=ride, bus_assignment__isnull=True,
        ).exclude(
            status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW],
        ).order_by('joined_at')

        allocated_and_checked_in = 0
        for pax in unassigned:
            if pax.pricing_tier != 'standing' and bus.seats_available > 0:
                pax.bus_assignment = bus
                pax.seat_type = SeatType.SEATED
                pax.checked_in_at = now
                pax.status = PassengerStatus.BOARDED
                pax.save(update_fields=['bus_assignment', 'seat_type', 'checked_in_at', 'status'])
                allocated_and_checked_in += 1
            elif pax.pricing_tier == 'standing' and bus.standing_available > 0:
                pax.bus_assignment = bus
                pax.seat_type = SeatType.STANDING
                pax.checked_in_at = now
                pax.status = PassengerStatus.BOARDED
                pax.save(update_fields=['bus_assignment', 'seat_type', 'checked_in_at', 'status'])
                allocated_and_checked_in += 1

        return Response({
            'bus': BusAssignmentReadSerializer(bus).data,
            'checked_in_count': checked_in_count + allocated_and_checked_in,
        })


class BusDepartView(APIView):
    """Mark bus as departed; no-show unchecked passengers, refund & auto-promote standby."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id, bus_id):
        ride = _get_scoped_ride(request.user, ride_id)
        bus = _get_bus(ride, bus_id, for_update=True)

        try:
            bus.transition_to(BusAssignmentStatus.DEPARTED)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        bus.departed_at = timezone.now()
        bus.save(update_fields=['status', 'departed_at', 'updated_at'])

        # Mark unchecked-in passengers as no-show and refund
        no_shows = list(
            ScheduledRidePassenger.objects.filter(
                bus_assignment=bus, checked_in_at__isnull=True,
            ).exclude(
                status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW,
                            PassengerStatus.BOARDED, PassengerStatus.ALIGHTED],
            ).select_related('student', 'ride')
        )

        freed_seats = 0
        freed_standing = 0
        for pax in no_shows:
            _refund_passenger(pax, 'No-show on scheduled ride departure')
            pax.status = PassengerStatus.NO_SHOW
            if pax.seat_type == SeatType.STANDING:
                freed_standing += 1
            else:
                freed_seats += 1
            pax.bus_assignment = None
            pax.save(update_fields=['status', 'bus_assignment'])

        # Auto-promote standby passengers into freed seats
        promoted = 0
        if freed_seats > 0 or freed_standing > 0:
            standby = ScheduledRidePassenger.objects.filter(
                ride=ride, bus_assignment__isnull=True,
            ).exclude(
                status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW],
            ).order_by('joined_at')

            # Find next non-departed bus to promote into
            next_buses = ScheduledRideBusAssignment.objects.filter(
                ride=ride,
            ).exclude(
                status__in=[BusAssignmentStatus.DEPARTED, BusAssignmentStatus.EN_ROUTE,
                            BusAssignmentStatus.ARRIVED, BusAssignmentStatus.COMPLETED],
            ).order_by('order')

            for pax in standby:
                for next_bus in next_buses:
                    if pax.pricing_tier != 'standing' and next_bus.seats_available > 0:
                        pax.bus_assignment = next_bus
                        pax.seat_type = SeatType.SEATED
                        pax.save(update_fields=['bus_assignment', 'seat_type'])
                        promoted += 1
                        break
                    elif pax.pricing_tier == 'standing' and next_bus.standing_available > 0:
                        pax.bus_assignment = next_bus
                        pax.seat_type = SeatType.STANDING
                        pax.save(update_fields=['bus_assignment', 'seat_type'])
                        promoted += 1
                        break

        return Response({
            'bus': BusAssignmentReadSerializer(bus).data,
            'no_shows': len(no_shows),
            'promoted': promoted,
        })


class BusArriveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id, bus_id):
        ride = _get_scoped_ride(request.user, ride_id)
        bus = _get_bus(ride, bus_id, for_update=True)
        try:
            bus.transition_to(BusAssignmentStatus.ARRIVED)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        bus.arrived_at = timezone.now()
        bus.save(update_fields=['status', 'arrived_at', 'updated_at'])
        return Response(BusAssignmentReadSerializer(bus).data)


class BusCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id, bus_id):
        ride = _get_scoped_ride(request.user, ride_id)
        bus = _get_bus(ride, bus_id, for_update=True)
        try:
            bus.transition_to(BusAssignmentStatus.COMPLETED)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        bus.save(update_fields=['status', 'updated_at'])

        # Auto-complete the ride if all buses are completed
        all_buses = ScheduledRideBusAssignment.objects.filter(ride=ride)
        if all_buses.exists() and not all_buses.exclude(status=BusAssignmentStatus.COMPLETED).exists():
            try:
                ride.transition_to(ScheduledRideStatus.COMPLETED)
                ride.save(update_fields=['status', 'updated_at'])
            except ValueError:
                pass

        return Response(BusAssignmentReadSerializer(bus).data)


# ── Passenger Management ──────────────────────────────────────────────────────


class RidePassengerListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    serializer_class = PassengerManifestSerializer

    def get_queryset(self):
        ride = _get_scoped_ride(self.request.user, self.kwargs['ride_id'])
        return ScheduledRidePassenger.objects.filter(ride=ride).select_related(
            'student', 'bus_assignment', 'boarding_stop', 'alighting_stop',
        ).order_by('joined_at')


class PassengerCheckInView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def post(self, request, ride_id, pax_id):
        ride = _get_scoped_ride(request.user, ride_id)
        try:
            pax = ScheduledRidePassenger.objects.get(id=pax_id, ride=ride)
        except ScheduledRidePassenger.DoesNotExist:
            raise NotFound('Passenger not found.')

        if pax.status in [PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW]:
            return Response({'detail': 'Cannot check in a cancelled/no-show passenger.'}, status=status.HTTP_400_BAD_REQUEST)

        pax.checked_in_at = timezone.now()
        pax.status = PassengerStatus.BOARDED
        pax.save(update_fields=['checked_in_at', 'status'])
        return Response(PassengerManifestSerializer(pax).data)


class PassengerNoShowView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id, pax_id):
        ride = _get_scoped_ride(request.user, ride_id)
        try:
            pax = ScheduledRidePassenger.objects.select_for_update().select_related(
                'student', 'ride',
            ).get(id=pax_id, ride=ride)
        except ScheduledRidePassenger.DoesNotExist:
            raise NotFound('Passenger not found.')

        if pax.status in [PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW]:
            return Response({'detail': 'Passenger is already cancelled/no-show.'}, status=status.HTTP_400_BAD_REQUEST)

        _refund_passenger(pax, 'Marked no-show by admin')
        freed_bus = pax.bus_assignment
        freed_seat_type = pax.seat_type
        pax.status = PassengerStatus.NO_SHOW
        pax.bus_assignment = None
        pax.save(update_fields=['status', 'bus_assignment'])

        # Auto-promote next standby passenger
        promoted_pax = None
        if freed_bus and freed_bus.status in [BusAssignmentStatus.ASSIGNED, BusAssignmentStatus.BOARDING, BusAssignmentStatus.LOADING]:
            standby = ScheduledRidePassenger.objects.filter(
                ride=ride, bus_assignment__isnull=True,
            ).exclude(
                status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW],
            ).order_by('joined_at').first()

            if standby:
                standby.bus_assignment = freed_bus
                standby.seat_type = freed_seat_type
                standby.save(update_fields=['bus_assignment', 'seat_type'])
                promoted_pax = standby

        return Response({
            'no_show': PassengerManifestSerializer(pax).data,
            'promoted': PassengerManifestSerializer(promoted_pax).data if promoted_pax else None,
        })


class PassengerReassignView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id, pax_id):
        ride = _get_scoped_ride(request.user, ride_id)
        try:
            pax = ScheduledRidePassenger.objects.select_for_update().get(id=pax_id, ride=ride)
        except ScheduledRidePassenger.DoesNotExist:
            raise NotFound('Passenger not found.')

        serializer = ReassignPassengerSerializer(data=request.data, context={'ride': ride})
        serializer.is_valid(raise_exception=True)
        new_bus = ScheduledRideBusAssignment.objects.get(
            id=serializer.validated_data['bus_assignment_id'], ride=ride,
        )

        if pax.pricing_tier == 'standing':
            if new_bus.standing_available <= 0:
                return Response({'detail': 'No standing room on target bus.'}, status=status.HTTP_400_BAD_REQUEST)
            pax.seat_type = SeatType.STANDING
        else:
            if new_bus.seats_available <= 0:
                return Response({'detail': 'No seats available on target bus.'}, status=status.HTTP_400_BAD_REQUEST)
            pax.seat_type = SeatType.SEATED

        pax.bus_assignment = new_bus
        pax.save(update_fields=['bus_assignment', 'seat_type'])
        return Response(PassengerManifestSerializer(pax).data)


# ── Bulk Auto-Allocate ────────────────────────────────────────────────────────


class RideAutoAllocateView(APIView):
    """Auto-allocate ALL unassigned passengers across all buses (FIFO)."""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    @transaction.atomic
    def post(self, request, ride_id):
        ride = _get_scoped_ride(request.user, ride_id)
        buses = list(
            ScheduledRideBusAssignment.objects.filter(ride=ride).exclude(
                status__in=[BusAssignmentStatus.DEPARTED, BusAssignmentStatus.EN_ROUTE,
                            BusAssignmentStatus.ARRIVED, BusAssignmentStatus.COMPLETED],
            ).order_by('order')
        )

        if not buses:
            return Response({'detail': 'No available buses to allocate to.'}, status=status.HTTP_400_BAD_REQUEST)

        unassigned = list(
            ScheduledRidePassenger.objects.filter(
                ride=ride, bus_assignment__isnull=True,
            ).exclude(
                status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW],
            ).order_by('joined_at')
        )

        bus_results = {str(bus.id): {'id': str(bus.id), 'label': bus.bus_label, 'allocated': 0} for bus in buses}
        total_allocated = 0

        for pax in unassigned:
            placed = False
            for bus in buses:
                if pax.pricing_tier == 'standing':
                    if bus.standing_available > 0:
                        pax.bus_assignment = bus
                        pax.seat_type = SeatType.STANDING
                        pax.save(update_fields=['bus_assignment', 'seat_type'])
                        bus_results[str(bus.id)]['allocated'] += 1
                        total_allocated += 1
                        placed = True
                        break
                else:
                    if bus.seats_available > 0:
                        pax.bus_assignment = bus
                        pax.seat_type = SeatType.SEATED
                        pax.save(update_fields=['bus_assignment', 'seat_type'])
                        bus_results[str(bus.id)]['allocated'] += 1
                        total_allocated += 1
                        placed = True
                        break
            if not placed:
                continue

        remaining = ScheduledRidePassenger.objects.filter(
            ride=ride, bus_assignment__isnull=True,
        ).exclude(status__in=[PassengerStatus.CANCELLED, PassengerStatus.NO_SHOW]).count()

        return Response({
            'allocated': total_allocated,
            'unallocated': remaining,
            'buses': list(bus_results.values()),
        })

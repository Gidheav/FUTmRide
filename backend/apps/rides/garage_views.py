import logging
from decimal import Decimal

from django.db import transaction, IntegrityError
from django.db.models import Sum
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models import UserRole, DriverProfile
from apps.payments.models import WalletTransaction
from apps.payments.services import WalletService

from .garage_models import GarageRide, GarageRidePassenger, GarageRideStatus, DriverSavedRoute
from .garage_serializers import (
    GarageRideCreateSerializer,
    GarageRideDetailSerializer,
    GarageRideBoardSerializer,
    GarageRidePassengerSerializer,
    DriverSavedRouteSerializer,
)
from .consumers import CAMPUS_ADMIN_GROUP

logger = logging.getLogger('apps.rides')


def broadcast_ride_event(event_type: str, ride=None, ride_id=None):
    """
    Push a real-time event to all connected campus admin dashboards.
    Runs in a fire-and-forget daemon thread so it NEVER blocks the
    Daphne worker — even if Redis is sleeping or unreachable.
    """
    import threading

    # Serialize ride data NOW while DB context is still available.
    message = {'type': event_type}
    try:
        if ride is not None:
            message['ride'] = GarageRideDetailSerializer(ride).data
        if ride_id is not None:
            message['ride_id'] = str(ride_id)
    except Exception as e:
        logger.warning('broadcast_ride_event serialization failed: %s', str(e))
        return

    def _do_broadcast():
        try:
            import asyncio
            from channels.layers import get_channel_layer

            channel_layer = get_channel_layer()
            if channel_layer is None:
                return

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    asyncio.wait_for(
                        channel_layer.group_send(CAMPUS_ADMIN_GROUP, message),
                        timeout=5.0,
                    )
                )
            finally:
                loop.close()
        except Exception as e:
            logger.warning('broadcast_ride_event failed: %s', str(e))

    t = threading.Thread(target=_do_broadcast, daemon=True)
    t.start()


# ─── Driver endpoints ────────────────────────────────────────────────────────

class GarageRideCreateView(generics.CreateAPIView):
    """
    POST /rides/garage/create/
    Driver creates a new garage ride. Returns the full ride detail
    including the qr_token (which the driver app encodes into a QR).
    """
    serializer_class = GarageRideCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can create garage rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'NO_PROFILE', 'message': 'Driver profile not found.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if profile.verification_status != DriverProfile.VerificationStatus.APPROVED:
            return Response(
                {'error': {'code': 'NOT_APPROVED', 'message': 'Your driver account is not yet approved.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_exists = GarageRide.objects.filter(
            driver=request.user,
            status__in=[
                GarageRideStatus.OPEN,
                GarageRideStatus.FULL,
                GarageRideStatus.DEPARTED,
            ],
        ).exists()
        if active_exists:
            return Response(
                {
                    'error': {
                        'code': 'ACTIVE_GARAGE_RIDE_EXISTS',
                        'message': 'You already have an active garage ride. Complete it before creating another.',
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        if profile.is_online:
            return Response(
                {'error': {'code': 'ON_DEMAND_ONLINE', 'message': 'Go offline from on-demand first.'}},
                status=status.HTTP_409_CONFLICT,
            )
            
        if getattr(profile, 'is_on_trip', False):
            has_active_on_demand = Ride.objects.filter(
                driver=request.user,
                status__in=[
                    RideStatus.DRIVER_ASSIGNED,
                    RideStatus.DRIVER_EN_ROUTE,
                    RideStatus.DRIVER_ARRIVED,
                    RideStatus.IN_PROGRESS,
                ],
            ).exists()
            if has_active_on_demand:
                return Response(
                    {'error': {'code': 'ON_DEMAND_ACTIVE', 'message': 'Complete your current ride first.'}},
                    status=status.HTTP_409_CONFLICT,
                )
            else:
                profile.is_on_trip = False
                profile.save(update_fields=['is_on_trip'])

        from django.utils import timezone
        import datetime
        from apps.rides.scheduled_models import ScheduledRideDriverInterest
        now = timezone.now()
        
        interests = ScheduledRideDriverInterest.objects.filter(
            driver=request.user,
            status='interested'
        ).select_related('ride')

        has_imminent_ride = False
        for interest in interests:
            ride = interest.ride
            if ride.departure_date and ride.window_start:
                try:
                    dt_unaware = datetime.datetime.combine(ride.departure_date, ride.window_start)
                    departure_dt = timezone.make_aware(dt_unaware)
                    diff = departure_dt - now
                    if datetime.timedelta(0) < diff <= datetime.timedelta(minutes=15):
                        has_imminent_ride = True
                        break
                except Exception:
                    pass

        if has_imminent_ride:
            return Response(
                {'error': {'code': 'UPCOMING_SCHEDULED_RIDE', 'message': 'Your scheduled ride starts soon.'}},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        garage_ride = serializer.save()

        logger.info(
            'garage_ride_created ref=%s driver=%s qr=%s',
            garage_ride.reference,
            str(request.user.id),
            str(garage_ride.qr_token),
        )
        response_data = GarageRideDetailSerializer(garage_ride, context={'request': request}).data

        # Broadcast to campus admin dashboards
        broadcast_ride_event('ride_created', ride=garage_ride)

        return Response(response_data, status=status.HTTP_201_CREATED)


class DriverGarageRideListView(generics.ListAPIView):
    """
    GET /rides/garage/mine/
    Driver lists their own garage rides (active ones first).
    """
    serializer_class = GarageRideDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role != UserRole.DRIVER:
            raise PermissionDenied('Only drivers can access this endpoint.')
        return GarageRide.objects.filter(
            driver=self.request.user
        ).prefetch_related('passengers').select_related('driver', 'driver__driver_profile')


class DriverSavedRouteListCreateView(APIView):
    """
    GET /rides/garage/routes/
    POST /rides/garage/routes/
    Driver manages saved routes for fast garage ride creation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can access saved routes.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        routes = DriverSavedRoute.objects.filter(driver=request.user)
        serializer = DriverSavedRouteSerializer(routes, many=True)
        return Response(serializer.data)

    def post(self, request):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can create saved routes.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = DriverSavedRouteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        route = serializer.save(driver=request.user)
        return Response(DriverSavedRouteSerializer(route).data, status=status.HTTP_201_CREATED)


class DriverSavedRouteDetailView(APIView):
    """
    GET/PATCH/DELETE /rides/garage/routes/<id>/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request, route_id):
        try:
            return DriverSavedRoute.objects.get(id=route_id, driver=request.user)
        except DriverSavedRoute.DoesNotExist:
            raise NotFound('Saved route not found.')

    def get(self, request, route_id):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can access saved routes.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        route = self.get_object(request, route_id)
        return Response(DriverSavedRouteSerializer(route).data)

    def patch(self, request, route_id):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can update saved routes.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        route = self.get_object(request, route_id)
        serializer = DriverSavedRouteSerializer(route, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, route_id):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can delete saved routes.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        route = self.get_object(request, route_id)
        route.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GarageRideDepartView(APIView):
    """
    POST /rides/garage/<id>/depart/
    Driver marks the ride as departed (closes boarding).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ride_id):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can update garage rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            ride = GarageRide.objects.get(id=ride_id, driver=request.user)
        except GarageRide.DoesNotExist:
            raise NotFound('Garage ride not found.')

        if ride.status not in [GarageRideStatus.OPEN, GarageRideStatus.FULL]:
            return Response(
                {'error': {'code': 'INVALID_STATUS', 'message': f'Cannot depart a ride with status: {ride.status}'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.utils import timezone
        ride.status = GarageRideStatus.DEPARTED
        ride.departed_at = timezone.now()
        ride.save(update_fields=['status', 'departed_at'])
        logger.info('garage_ride_departed ref=%s driver=%s', ride.reference, str(request.user.id))

        # Broadcast to campus admin dashboards
        broadcast_ride_event('ride_departed', ride=ride)

        return Response(GarageRideDetailSerializer(ride, context={'request': request}).data)


class GarageRideCancelView(APIView):
    """
    POST /rides/garage/<id>/cancel/
    Driver cancels/deletes an open garage ride. Refunds any passengers.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ride_id):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can cancel garage rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            ride = GarageRide.objects.get(id=ride_id, driver=request.user)
        except GarageRide.DoesNotExist:
            raise NotFound('Garage ride not found.')

        if ride.status == GarageRideStatus.DEPARTED:
            return Response(
                {'error': {'code': 'ALREADY_DEPARTED', 'message': 'Ride has already departed.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Refund all passengers
            for passenger in ride.passengers.select_related('student'):
                try:
                    WalletService.credit(
                        user=passenger.student,
                        amount=passenger.amount_paid,
                        source=WalletTransaction.Source.RIDE_REFUND,
                        narration=f'Refund — garage ride {ride.reference} cancelled',
                        metadata={'garage_ride_id': str(ride.id), 'garage_reference': ride.reference},
                    )
                    logger.info(
                        'garage_ride_passenger_refunded ride=%s student=%s amount=%s',
                        ride.reference,
                        str(passenger.student_id),
                        str(passenger.amount_paid),
                    )
                except Exception as e:
                    logger.error(
                        'garage_ride_refund_error ride=%s student=%s error=%s',
                        ride.reference,
                        str(passenger.student_id),
                        str(e),
                    )

            ride.status = GarageRideStatus.CANCELLED
            ride.save(update_fields=['status'])

        logger.info('garage_ride_cancelled ref=%s driver=%s', ride.reference, str(request.user.id))

        # Broadcast to campus admin dashboards
        broadcast_ride_event('ride_cancelled', ride_id=ride.id)

        return Response(GarageRideDetailSerializer(ride, context={'request': request}).data)


class GarageRideCompleteView(APIView):
    """
    POST /rides/garage/<id>/complete/
    Driver marks the ride as completed after departure.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ride_id):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can update garage rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            ride = GarageRide.objects.get(id=ride_id, driver=request.user)
        except GarageRide.DoesNotExist:
            raise NotFound('Garage ride not found.')

        if ride.status != GarageRideStatus.DEPARTED:
            return Response(
                {'error': {'code': 'INVALID_STATUS', 'message': f'Cannot complete a ride with status: {ride.status}'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone
        ride.status = GarageRideStatus.COMPLETED
        ride.completed_at = timezone.now()
        ride.save(update_fields=['status', 'completed_at'])
        logger.info('garage_ride_completed ref=%s driver=%s', ride.reference, str(request.user.id))

        try:
            total_paid = (
                ride.passengers.aggregate(total=Sum('amount_paid')).get('total')
                or Decimal('0')
            )
            if total_paid > 0:
                existing = WalletTransaction.objects.filter(
                    user=request.user,
                    source=WalletTransaction.Source.DRIVER_EARNING,
                    transaction_type=WalletTransaction.TransactionType.CREDIT,
                    metadata__garage_ride_id=str(ride.id),
                ).first()
                if existing:
                    logger.info(
                        'garage_driver_already_paid ref=%s tx=%s',
                        ride.reference,
                        existing.reference,
                    )
                else:
                    WalletService.credit(
                        user=request.user,
                        amount=total_paid,
                        source=WalletTransaction.Source.DRIVER_EARNING,
                        narration=f'Garage ride earnings — {ride.reference}',
                        metadata={
                            'garage_ride_id': str(ride.id),
                            'garage_reference': ride.reference,
                            'passenger_count': ride.passengers.count(),
                        },
                    )
                    try:
                        from apps.notifications.services import NotificationService
                        NotificationService.notify(
                            user=request.user,
                            notification_type='payment_received',
                            title='Earnings credited',
                            body=f'NGN {total_paid} credited for garage ride {ride.reference}.',
                            data={
                                'garage_ride_id': str(ride.id),
                                'garage_reference': ride.reference,
                                'amount': str(total_paid),
                                'wallet_balance': str(request.user.driver_profile.wallet_balance),
                            },
                        )
                    except Exception as notify_error:
                        logger.warning('garage_driver_credit_notify_failed ref=%s error=%s', ride.reference, str(notify_error))
                    try:
                        profile = request.user.driver_profile
                        profile.total_trips += 1
                        profile.total_earnings += total_paid
                        profile.save(update_fields=['total_trips', 'total_earnings'])
                    except DriverProfile.DoesNotExist:
                        pass
                    logger.info(
                        'garage_driver_credited ref=%s amount=%s',
                        ride.reference,
                        str(total_paid),
                    )
        except Exception as exc:
            logger.error('garage_driver_credit_error ref=%s error=%s', ride.reference, str(exc))

        broadcast_ride_event('ride_completed', ride=ride)

        return Response(GarageRideDetailSerializer(ride, context={'request': request}).data)


# ─── Public scan endpoint (requires auth so we know who is scanning) ─────────

class GarageRideScanView(APIView):
    """
    GET /rides/garage/scan/<qr_token>/
    Student scans the QR code. Returns ride details so the student
    can review before paying. This is READ-ONLY — no payment yet.
    Any authenticated user can call this (student or driver previewing).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, qr_token):
        try:
            ride = GarageRide.objects.select_related(
                'driver', 'driver__driver_profile'
            ).get(qr_token=qr_token)
        except GarageRide.DoesNotExist:
            raise NotFound('Ride not found. This QR code may be invalid or expired.')

        # Check if the student has already boarded
        already_boarded = False
        if request.user.role == UserRole.STUDENT:
            already_boarded = GarageRidePassenger.objects.filter(
                garage_ride=ride,
                student=request.user,
            ).exists()

        data = GarageRideDetailSerializer(ride, context={'request': request}).data
        data['already_boarded'] = already_boarded
        return Response(data)


# ─── Student board (pay) endpoint ────────────────────────────────────────────

class GarageRideBoardView(APIView):
    """
    POST /rides/garage/scan/<qr_token>/board/
    Student confirms payment and boards the garage ride.
    Atomically debits wallet and reserves seats.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, qr_token):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can board garage rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GarageRideBoardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        seats_requested = serializer.validated_data['seats']

        logger.info(
            'garage_ride_board_attempt student=%s qr=%s seats=%s',
            str(request.user.id),
            str(qr_token),
            seats_requested,
        )

        with transaction.atomic():
            # Lock the ride row
            try:
                ride = GarageRide.objects.select_for_update(of=('self',)).select_related(
                    'driver'
                ).get(qr_token=qr_token)
            except GarageRide.DoesNotExist:
                raise NotFound('Ride not found. Invalid QR code.')

            # Validate ride state
            if ride.status != GarageRideStatus.OPEN:
                return Response(
                    {
                        'error': {
                            'code': 'RIDE_NOT_OPEN',
                            'message': f'This ride is no longer accepting passengers (status: {ride.status}).',
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if ride.is_expired:
                return Response(
                    {'error': {'code': 'QR_EXPIRED', 'message': 'This QR code has expired.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevent driver boarding their own ride
            if ride.driver == request.user:
                return Response(
                    {'error': {'code': 'OWN_RIDE', 'message': 'You cannot board your own garage ride.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevent duplicate boarding
            if GarageRidePassenger.objects.filter(garage_ride=ride, student=request.user).exists():
                return Response(
                    {'error': {'code': 'ALREADY_BOARDED', 'message': 'You have already paid for this ride.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check seat availability
            if seats_requested > ride.available_seats:
                return Response(
                    {
                        'error': {
                            'code': 'INSUFFICIENT_SEATS',
                            'message': f'Only {ride.available_seats} seat(s) available.',
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            total_amount = Decimal(str(ride.fare_per_seat)) * seats_requested

            # Debit student wallet atomically
            try:
                tx = WalletService.debit(
                    user=request.user,
                    amount=total_amount,
                    source=WalletTransaction.Source.RIDE_PAYMENT,
                    narration=f'Garage ride — {ride.reference} ({seats_requested} seat{"s" if seats_requested > 1 else ""})',
                    metadata={
                        'garage_ride_id': str(ride.id),
                        'garage_reference': ride.reference,
                        'seats': seats_requested,
                    },
                )
            except ValueError as exc:
                message = str(exc)
                if 'wallet profile' in message.lower():
                    return Response(
                        {'error': {'code': 'NO_PROFILE', 'message': 'Wallet profile not found.'}},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                return Response(
                    {'error': {'code': 'INSUFFICIENT_WALLET', 'message': 'Insufficient wallet balance.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Reserve seats
            try:
                ride.booked_seats += seats_requested
                if ride.booked_seats >= ride.total_seats:
                    ride.status = GarageRideStatus.FULL
                ride.save(update_fields=['booked_seats', 'status'])
            except Exception as exc:
                logger.error(
                    'garage_ride_seat_update_failed ride=%s student=%s error=%s',
                    str(ride.id),
                    str(request.user.id),
                    str(exc),
                    exc_info=True,
                )
                raise

            # Create passenger record
            try:
                passenger = GarageRidePassenger.objects.create(
                    garage_ride=ride,
                    student=request.user,
                    seats_booked=seats_requested,
                    amount_paid=total_amount,
                    wallet_transaction_reference=tx.reference,
                )
            except IntegrityError:
                transaction.set_rollback(True)
                return Response(
                    {'error': {'code': 'ALREADY_BOARDED', 'message': 'You have already paid for this ride.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        logger.info(
            'garage_ride_boarded ref=%s student=%s seats=%s amount=%s',
            ride.reference,
            str(request.user.id),
            seats_requested,
            str(total_amount),
        )

        # Broadcast updated ride to campus admin dashboards (seat count changed)
        broadcast_ride_event('ride_updated', ride=ride)

        try:
            response_payload = {
                'message': f'Successfully boarded! {seats_requested} seat(s) reserved.',
                'passenger': GarageRidePassengerSerializer(passenger).data,
                'ride': GarageRideDetailSerializer(ride, context={'request': request}).data,
                'amount_paid': str(total_amount),
            }
        except Exception as exc:
            logger.error(
                'garage_ride_serialize_failed ride=%s student=%s error=%s',
                str(ride.id),
                str(request.user.id),
                str(exc),
                exc_info=True,
            )
            raise

        return Response(response_payload, status=status.HTTP_201_CREATED)


# ─── Passenger list (driver sees who has boarded) ─────────────────────────

class GarageRidePassengersView(generics.ListAPIView):
    """
    GET /rides/garage/<id>/passengers/
    Driver sees who has boarded their garage ride.
    """
    serializer_class = GarageRidePassengerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        ride_id = self.kwargs['ride_id']
        try:
            ride = GarageRide.objects.get(id=ride_id, driver=self.request.user)
        except GarageRide.DoesNotExist:
            raise NotFound('Garage ride not found.')
        return ride.passengers.select_related('student')


# ─── Campus Admin: active garage rides (REST fallback / initial load) ────────

class CampusAdminActiveGarageRidesView(generics.ListAPIView):
    """
    GET /rides/garage/active/
    Campus admin fetches all active (open/full) garage rides.
    Used for initial dashboard load before WebSocket takes over.
    """
    serializer_class = GarageRideDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        role = getattr(self.request.user, 'role', None)
        if role not in ('admin', 'campus_admin'):
            raise PermissionDenied('Only campus admins can access this endpoint.')
        return GarageRide.objects.filter(
            status__in=[GarageRideStatus.OPEN, GarageRideStatus.FULL]
        ).select_related(
            'driver', 'driver__driver_profile'
        ).prefetch_related('passengers').order_by('-created_at')


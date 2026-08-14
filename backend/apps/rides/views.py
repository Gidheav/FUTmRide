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
from apps.rides.garage_models import GarageRide, GarageRideStatus
from apps.accounts.permissions import IsAdminUser
from apps.payments.models import WalletTransaction
from apps.payments.services import WalletService
from .models import Ride, RideStatus, DriverRideRequest
from .serializers import (
    RideRequestSerializer,
    RideDetailSerializer,
    RideListSerializer,
    RideCancelSerializer,
    AvailableRidesQuerySerializer,
    AvailableDriverSerializer,
)
from .services import FareCalculator, RouteDistanceResolver, get_available_drivers_nearby
from .notifications import notify_student_ride_status
from .geofence import validate_coordinates_in_service_area
from .utils import has_blocking_active_ride

logger = logging.getLogger('apps.rides')

ACTIVE_DRIVER_STATUSES = [
    RideStatus.DRIVER_ASSIGNED,
    RideStatus.DRIVER_EN_ROUTE,
    RideStatus.DRIVER_ARRIVED,
    RideStatus.IN_PROGRESS,
    RideStatus.PENDING_COMPLETION,
]


class RideRequestView(generics.CreateAPIView):
    serializer_class = RideRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can request rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if has_blocking_active_ride(request.user):
            return Response(
                {'error': {'code': 'ACTIVE_RIDE_EXISTS', 'message': 'You already have an active ride. Please complete or cancel it first.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        pickup_lat = serializer.validated_data.get('pickup_latitude')
        pickup_lng = serializer.validated_data.get('pickup_longitude')
        dropoff_lat = serializer.validated_data.get('dropoff_latitude')
        dropoff_lng = serializer.validated_data.get('dropoff_longitude')

        try:
            validate_coordinates_in_service_area(pickup_lat, pickup_lng, label='Pickup')
            validate_coordinates_in_service_area(dropoff_lat, dropoff_lng, label='Dropoff')
        except ValueError as e:
            return Response(
                {'error': {'code': 'OUTSIDE_SERVICE_AREA', 'message': str(e)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        requested_route_index = int(serializer.validated_data.get('route_index') or 0)
        requested_route_provider = (serializer.validated_data.get('route_provider') or '').strip() or None

        with transaction.atomic():
            ride = serializer.save()
            ride.transition_to(RideStatus.SEARCHING)
            try:
                route = RouteDistanceResolver.resolve(
                    pickup_latitude=float(ride.pickup_latitude),
                    pickup_longitude=float(ride.pickup_longitude),
                    dropoff_latitude=float(ride.dropoff_latitude),
                    dropoff_longitude=float(ride.dropoff_longitude),
                    vehicle_type=ride.vehicle_type_requested,
                    allow_haversine_fallback=False,
                    preferred_route_index=requested_route_index,
                    provider_override=requested_route_provider,
                )
            except ValueError:
                transaction.set_rollback(True)
                return Response(
                    {'error': {'code': 'ROUTE_NOT_FOUND', 'message': 'No valid route found for this trip.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ride.estimated_distance_km = Decimal(str(route.distance_km))
            ride.estimated_duration_minutes = route.duration_minutes
            ride.estimated_route_geometry = route.geometry
            ride.route_distance_provider = route.provider
            ride.route_confidence = route.confidence
            ride.route_metadata = route.metadata
            fare_data = FareCalculator.calculate(
                vehicle_type=ride.vehicle_type_requested,
                distance_km=route.distance_km,
                passenger_count=ride.requested_seats,
            )
            ride.base_fare = fare_data['base_fare']
            ride.total_fare = fare_data['total_fare']
            ride.platform_commission = fare_data['platform_commission']
            ride.driver_earnings = fare_data['driver_earnings']
            ride.surge_multiplier = fare_data['surge_multiplier']
            ride.save()

            if ride.payment_method == 'wallet':
                try:
                    WalletService.debit(
                        user=ride.student,
                        amount=Decimal(str(ride.total_fare or 0)),
                        source=WalletTransaction.Source.RIDE_PAYMENT,
                        narration=f'Ride escrow — {ride.reference}',
                        ride=ride,
                    )
                    ride.is_paid = True
                    ride.save(update_fields=['is_paid'])
                except ValueError as exc:
                    if 'wallet profile' in str(exc).lower():
                        ride.transition_to(RideStatus.CANCELLED_BY_STUDENT)
                        ride.cancellation_reason = 'Wallet profile not found.'
                        ride.save(update_fields=['status', 'cancellation_reason', 'cancelled_at'])
                        return Response(
                            {'error': {'code': 'NO_PROFILE', 'message': 'Wallet profile not found.'}},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    ride.transition_to(RideStatus.CANCELLED_BY_STUDENT)
                    ride.cancellation_reason = 'Insufficient wallet balance.'
                    ride.save(update_fields=['status', 'cancellation_reason', 'cancelled_at'])
                    return Response(
                        {'error': {'code': 'INSUFFICIENT_WALLET', 'message': 'Insufficient wallet balance.'}},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        logger.info('ride_requested ref=%s student=%s assigned=%s', ride.reference, str(request.user.id), False)
        notify_student_ride_status(ride)
        return Response(RideDetailSerializer(ride, context={'request': request}).data, status=status.HTTP_201_CREATED)


class RideRouteOptionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role not in [UserRole.STUDENT, UserRole.DRIVER]:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students and drivers can estimate ride routes.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            pickup_latitude = float(request.data.get('pickup_latitude'))
            pickup_longitude = float(request.data.get('pickup_longitude'))
            dropoff_latitude = float(request.data.get('dropoff_latitude'))
            dropoff_longitude = float(request.data.get('dropoff_longitude'))
        except (TypeError, ValueError):
            return Response(
                {'error': {'code': 'INVALID_COORDINATES', 'message': 'Pickup and dropoff coordinates are required.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        vehicle_type = request.data.get('vehicle_type') or 'sedan'
        routes = RouteDistanceResolver.resolve_options(
            pickup_latitude=pickup_latitude,
            pickup_longitude=pickup_longitude,
            dropoff_latitude=dropoff_latitude,
            dropoff_longitude=dropoff_longitude,
            vehicle_type=vehicle_type,
        )
        if not routes:
            return Response(
                {'error': {'code': 'ROUTE_NOT_FOUND', 'message': 'No valid route found for this trip.'}},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            'routes': [
                {
                    'index': idx,
                    'distance_km': route.distance_km,
                    'duration_minutes': route.duration_minutes,
                    'geometry': route.geometry,
                    'provider': route.provider,
                    'confidence': route.confidence,
                    'metadata': route.metadata,
                }
                for idx, route in enumerate(routes)
            ]
        })


class StudentRideListView(generics.ListAPIView):
    serializer_class = RideListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Ride.objects.filter(student=self.request.user).select_related('student', 'driver', 'driver__driver_profile').order_by('-requested_at')


class StudentActiveRideView(generics.RetrieveAPIView):
    serializer_class = RideDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        ride = Ride.objects.filter(
            student=self.request.user,
            status__in=[
                RideStatus.REQUESTED, RideStatus.SEARCHING,
                RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_EN_ROUTE,
                RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS,
                RideStatus.PENDING_COMPLETION,
            ],
        ).select_related('student', 'driver', 'driver__driver_profile').first()
        if not ride:
            raise NotFound('No active ride found.')
        return ride

class RideDetailView(generics.RetrieveAPIView):
    serializer_class = RideDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            ride = Ride.objects.select_related('student', 'driver', 'driver__driver_profile').get(id=self.kwargs['ride_id'])
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
        def refund_student(refund_amount: Decimal, narration: str, metadata: dict | None = None):
            existing = WalletTransaction.objects.filter(
                ride=ride,
                source=WalletTransaction.Source.RIDE_REFUND,
                transaction_type=WalletTransaction.TransactionType.CREDIT,
            ).first()
            if existing:
                return
            WalletService.credit(
                user=ride.student,
                amount=refund_amount,
                source=WalletTransaction.Source.RIDE_REFUND,
                narration=narration,
                ride=ride,
                metadata=metadata or {},
            )

        if ride.student == request.user:
            if not ride.is_active:
                return Response(
                    {'error': {'code': 'INVALID_STATUS', 'message': 'This ride cannot be cancelled.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ride.transition_to(RideStatus.CANCELLED_BY_STUDENT)
            ride.cancellation_reason = reason
            ride.save()
            if ride.driver_id:
                try:
                    profile = ride.driver.driver_profile
                    profile.is_on_trip = False
                    profile.save(update_fields=['is_on_trip'])
                except DriverProfile.DoesNotExist:
                    pass
            if ride.payment_method == 'wallet' and ride.is_paid:
                if not ride.driver_arrived_at:
                    refund_student(
                        Decimal(str(ride.total_fare or 0)),
                        f'Ride refund — {ride.reference}',
                    )
                    ride.is_paid = False
                    ride.save(update_fields=['is_paid'])
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
            if ride.payment_method == 'wallet' and ride.is_paid:
                refund_student(
                    Decimal(str(ride.total_fare or 0)),
                    f'Ride refund — {ride.reference}',
                    metadata={'cancelled_by': 'driver'},
                )
                ride.is_paid = False
                ride.save(update_fields=['is_paid'])
        else:
            raise PermissionDenied('You cannot cancel this ride.')
        logger.info('ride_cancelled ref=%s by=%s', ride.reference, str(request.user.id))
        notify_student_ride_status(ride)
        return Response(RideDetailSerializer(ride, context={'request': request}).data)


class DriverRideStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    DROPOFF_VERIFICATION_RADIUS_KM = Decimal('0.5')

    STATUS_FLOW = {
        RideStatus.DRIVER_ASSIGNED: RideStatus.DRIVER_EN_ROUTE,
        RideStatus.DRIVER_EN_ROUTE: RideStatus.DRIVER_ARRIVED,
        RideStatus.DRIVER_ARRIVED: RideStatus.IN_PROGRESS,
        RideStatus.IN_PROGRESS: RideStatus.PENDING_COMPLETION,
        RideStatus.PENDING_COMPLETION: RideStatus.COMPLETED,
    }

    def _driver_is_inside_dropoff_axis(self, ride, request):
        lat = request.data.get('latitude')
        lng = request.data.get('longitude', request.data.get('lng'))
        if not lat or not lng or not ride.dropoff_latitude or not ride.dropoff_longitude:
            return False, None

        try:
            from apps.rides.engine import _haversine_distance
            dist_km = _haversine_distance(
                float(lat),
                float(lng),
                float(ride.dropoff_latitude),
                float(ride.dropoff_longitude),
            )
        except (ValueError, TypeError):
            return False, None

        return dist_km <= float(self.DROPOFF_VERIFICATION_RADIUS_KM), dist_km

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
        
        gps_verified = False
        gps_distance_km = None
        # Completion needs live GPS inside the wider dropoff axis, otherwise it waits for student confirmation.
        if ride.status in [RideStatus.IN_PROGRESS, RideStatus.PENDING_COMPLETION]:
            gps_verified, gps_distance_km = self._driver_is_inside_dropoff_axis(ride, request)
            if gps_verified:
                next_status = RideStatus.COMPLETED
            elif ride.status == RideStatus.PENDING_COMPLETION:
                response_data = RideDetailSerializer(ride, context={'request': request}).data
                response_data['completion_verification'] = {
                    'verified': False,
                    'distance_km': gps_distance_km,
                    'radius_km': float(self.DROPOFF_VERIFICATION_RADIUS_KM),
                    'message': 'Waiting for student confirmation.',
                }
                return Response(response_data)
        
        try:
            ride.transition_to(next_status)
            ride.save()
        except ValueError as e:
            return Response({'error': {'code': 'INVALID_TRANSITION', 'message': str(e)}}, status=status.HTTP_400_BAD_REQUEST)
        
        if next_status == RideStatus.COMPLETED:
            from apps.rides.services import finalize_ride_completion
            finalize_ride_completion(ride)
        elif next_status == RideStatus.PENDING_COMPLETION:
            from apps.rides.tasks import auto_confirm_pending_ride
            # Schedule task to auto complete ride in 5 minutes
            auto_confirm_pending_ride.apply_async(args=[str(ride.id)], countdown=300)
            
        notify_student_ride_status(ride)
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
            status__in=ACTIVE_DRIVER_STATUSES,
        ).select_related('student', 'driver', 'driver__driver_profile').first()
        if not ride:
            # Self-heal stale profile.is_on_trip flag if set
            try:
                profile = getattr(self.request.user, 'driver_profile', None)
                if profile and profile.is_on_trip:
                    has_garage = GarageRide.objects.filter(
                        driver=self.request.user,
                        status__in=[
                            GarageRideStatus.OPEN,
                            GarageRideStatus.FULL,
                            GarageRideStatus.DEPARTED,
                        ],
                    ).exists()
                    if not has_garage:
                        profile.is_on_trip = False
                        profile.save(update_fields=['is_on_trip'])
            except Exception:
                pass
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
        ).select_related('student', 'driver', 'driver__driver_profile').order_by('-trip_completed_at')


class DriverMarketplaceListView(generics.ListAPIView):
    serializer_class = RideListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role != UserRole.DRIVER:
            raise PermissionDenied('Only drivers can access this endpoint.')
        profile = getattr(self.request.user, 'driver_profile', None)
        if not profile:
            raise PermissionDenied('Driver profile not found.')
        return (
            Ride.objects.filter(
                status=RideStatus.SEARCHING,
                vehicle_type_requested=profile.vehicle_type
            )
            .select_related('student', 'driver', 'driver__driver_profile')
            .order_by('-requested_at')
        )

    def list(self, request, *args, **kwargs):
        try:
            request.user.driver_profile
        except DriverProfile.DoesNotExist:
            raise PermissionDenied('Driver profile not found.')

        has_active = Ride.objects.filter(
            driver=request.user,
            status__in=ACTIVE_DRIVER_STATUSES,
        ).exists()
        has_active_garage = GarageRide.objects.filter(
            driver=request.user,
            status__in=[
                GarageRideStatus.OPEN,
                GarageRideStatus.FULL,
                GarageRideStatus.DEPARTED,
            ],
        ).exists()
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['driver_has_active_ride'] = bool(has_active or has_active_garage)
            return response
            
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'results': serializer.data, 
            'driver_has_active_ride': bool(has_active or has_active_garage)
        })


class DriverAcceptRideView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ride_id):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can accept rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not request.user.is_active:
            return Response(
                {
                    'error': {
                        'code': 'ACCOUNT_INACTIVE',
                        'message': 'Your account is inactive.',
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            try:
                profile = DriverProfile.objects.select_for_update().get(user=request.user)
            except DriverProfile.DoesNotExist:
                return Response(
                    {'error': {'code': 'NO_PROFILE', 'message': 'Driver profile not found.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if profile.verification_status != DriverProfile.VerificationStatus.APPROVED:
                return Response(
                    {
                        'error': {
                            'code': 'NOT_APPROVED',
                            'message': 'Driver account is not approved yet.',
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not profile.is_online:
                return Response(
                    {
                        'error': {
                            'code': 'DRIVER_OFFLINE',
                            'message': 'You are offline. Go online to accept rides.',
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if Ride.objects.filter(
                driver=request.user,
                status__in=ACTIVE_DRIVER_STATUSES,
            ).exists():
                return Response(
                    {
                        'error': {
                            'code': 'ACTIVE_RIDE_EXISTS',
                            'message': 'Finish your active ride before accepting another.',
                        }
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            if GarageRide.objects.filter(
                driver=request.user,
                status__in=[
                    GarageRideStatus.OPEN,
                    GarageRideStatus.FULL,
                    GarageRideStatus.DEPARTED,
                ],
            ).exists():
                return Response(
                    {
                        'error': {
                            'code': 'ACTIVE_GARAGE_RIDE_EXISTS',
                            'message': 'Finish your garage ride before accepting on-demand requests.',
                        }
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            if profile.is_on_trip:
                # Self-heal check: Verify if the driver actually has an active ride or active garage ride in DB
                has_active = Ride.objects.filter(
                    driver=request.user,
                    status__in=[
                        RideStatus.DRIVER_ASSIGNED,
                        RideStatus.DRIVER_EN_ROUTE,
                        RideStatus.DRIVER_ARRIVED,
                        RideStatus.IN_PROGRESS,
                    ],
                ).exists()
                has_garage = GarageRide.objects.filter(
                    driver=request.user,
                    status__in=[
                        GarageRideStatus.OPEN,
                        GarageRideStatus.FULL,
                        GarageRideStatus.DEPARTED,
                    ],
                ).exists()
                if has_active or has_garage:
                    return Response(
                        {
                            'error': {
                                'code': 'ON_TRIP',
                                'message': 'You are already on an active trip.',
                            }
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                else:
                    # Stale flag detected — auto-heal to False
                    profile.is_on_trip = False
                    profile.save(update_fields=['is_on_trip'])
            try:
                ride = Ride.objects.select_for_update().get(id=ride_id)
            except Ride.DoesNotExist:
                raise NotFound('Ride not found.')
            if ride.status != RideStatus.SEARCHING:
                return Response(
                    {'error': {'code': 'INVALID_STATUS', 'message': 'Ride is not available.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if ride.vehicle_type_requested != profile.vehicle_type:
                return Response(
                    {'error': {'code': 'VEHICLE_MISMATCH', 'message': 'Ride does not match your vehicle type.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            expected_seats = DriverProfile.get_vehicle_seat_capacity(profile.vehicle_type) or profile.vehicle_seats
            if profile.vehicle_seats != expected_seats:
                profile.vehicle_seats = expected_seats
                profile.save(update_fields=['vehicle_seats'])
            if ride.requested_seats and ride.requested_seats > expected_seats:
                return Response(
                    {'error': {'code': 'SEATS_EXCEEDED', 'message': 'Not enough available seats.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ride.driver = request.user
            ride.transition_to(RideStatus.DRIVER_ASSIGNED)
            ride.save()
            DriverRideRequest.objects.update_or_create(
                ride=ride,
                driver=request.user,
                defaults={
                    'response': DriverRideRequest.Response.ACCEPTED,
                    'responded_at': timezone.now(),
                },
            )
            profile.is_on_trip = True
            profile.save(update_fields=['is_on_trip'])
        notify_student_ride_status(ride)
        return Response(RideDetailSerializer(ride, context={'request': request}).data)


class AvailableRidesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can view available rides.'}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AvailableRidesQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        lat = float(data['latitude'])
        lng = float(data['longitude'])
        radius_km = float(data['radius_km'])
        vehicle_type = data.get('vehicle_type')
        max_age_seconds = int(data.get('max_age_seconds') or 300)

        candidates = get_available_drivers_nearby(
            latitude=lat,
            longitude=lng,
            radius_km=radius_km,
            vehicle_type=vehicle_type,
            max_age_seconds=max_age_seconds,
        )

        results = []
        for distance_km, loc in candidates:
            user = loc.driver
            profile = getattr(user, 'driver_profile', None)
            photo_url = None
            if user.profile_photo:
                photo_url = request.build_absolute_uri(user.profile_photo.url)
            results.append({
                'id': user.id,
                'full_name': user.full_name,
                'profile_photo': photo_url,
                'vehicle_type': getattr(profile, 'vehicle_type', None),
                'vehicle_make': getattr(profile, 'vehicle_make', None),
                'vehicle_model': getattr(profile, 'vehicle_model', None),
                'vehicle_color': getattr(profile, 'vehicle_color', None),
                'plate_number': getattr(profile, 'plate_number', None),
                'average_rating': str(profile.average_rating) if profile and profile.average_rating is not None else None,
                'distance_km': round(distance_km, 2),
                'location_updated_at': loc.updated_at,
            })

        return Response({
            'center': {'latitude': lat, 'longitude': lng},
            'radius_km': radius_km,
            'max_age_seconds': max_age_seconds,
            'vehicle_type': vehicle_type,
            'count': len(results),
            'results': AvailableDriverSerializer(results, many=True).data,
        })


class AdminRideListView(generics.ListAPIView):
    serializer_class = RideListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vehicle_type_requested', 'payment_method', 'is_paid']
    search_fields = ['reference', 'student__first_name', 'student__phone_number', 'pickup_address', 'dropoff_address']
    ordering_fields = ['requested_at', 'total_fare']
    ordering = ['-requested_at']

    def get_queryset(self):
        return Ride.objects.all().select_related('student', 'driver', 'driver__driver_profile')


class StudentConfirmRideCompletionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ride_id):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can confirm completion.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            ride = Ride.objects.get(id=ride_id, student=request.user, status=RideStatus.PENDING_COMPLETION)
        except Ride.DoesNotExist:
            raise NotFound('Pending ride not found.')

        try:
            ride.transition_to(RideStatus.COMPLETED)
            ride.save()
            from apps.rides.services import finalize_ride_completion
            finalize_ride_completion(ride)
            from apps.rides.notifications import notify_student_ride_status
            notify_student_ride_status(ride)
            return Response(RideDetailSerializer(ride, context={'request': request}).data)
        except Exception as e:
            logger.error('confirm_completion_error ride=%s err=%s', ride.id, str(e))
            return Response({'error': {'code': 'SYSTEM_ERROR', 'message': 'Could not confirm ride.'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudentDisputeRideCompletionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ride_id):
        if request.user.role != UserRole.STUDENT:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only students can dispute completion.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            ride = Ride.objects.get(id=ride_id, student=request.user, status=RideStatus.PENDING_COMPLETION)
        except Ride.DoesNotExist:
            raise NotFound('Pending ride not found.')

        reason = request.data.get('reason', 'Student disputed completion.')
        try:
            ride.transition_to(RideStatus.DISPUTED)
            ride.save()
            
            # Create a support ticket for admin review
            from apps.support.models import Ticket
            Ticket.objects.create(
                creator=request.user,
                category='ride_dispute',
                priority='urgent',
                subject=f'Disputed Completion: Ride {ride.reference}',
                description=f'Student disputed ride completion. Reason: {reason}',
                status='open'
            )
            
            from apps.rides.notifications import notify_student_ride_status
            notify_student_ride_status(ride)
            
            # Optionally notify driver
            from apps.notifications.services import NotificationService
            from apps.notifications.models import Notification
            if ride.driver:
                NotificationService.notify(
                    user=ride.driver,
                    notification_type=Notification.NotificationType.SYSTEM_ALERT,
                    title='Ride Disputed',
                    body=f'Student disputed the completion of ride {ride.reference}. Admin will review.',
                    data={'ride_id': str(ride.id)},
                )
                
            return Response(RideDetailSerializer(ride, context={'request': request}).data)
        except Exception as e:
            logger.error('dispute_completion_error ride=%s err=%s', ride.id, str(e))
            return Response({'error': {'code': 'SYSTEM_ERROR', 'message': 'Could not dispute ride.'}}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

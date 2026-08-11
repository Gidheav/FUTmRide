import logging
import secrets
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core import signing
from django.contrib.auth.hashers import check_password, make_password
from rest_framework import generics, permissions, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from apps.notifications.services import NotificationService

from .models import Campus, CampusAdminProfile, DriverProfile, IntegrationSettings, OTPVerification, StudentProfile, User, UserRole, UserSettings, MapSettings
from .permissions import IsAdminUser, IsAdminOrCampusAdmin
from .audit import log_audit
from core.throttles import AuthAnonRateThrottle

AUTH_THROTTLE_CLASSES = [AuthAnonRateThrottle]
from .serializers import (
    ChangePasswordSerializer,
    ChangeEmailSerializer,
    RequestPasswordChangeOTPSerializer,
    ConfirmPasswordChangeSerializer,
    UserSettingsSerializer,
    IntegrationSettingsSerializer,
    PinSetSerializer,
    PinVerifySerializer,
    PinResetConfirmSerializer,
    TwoFactorStartSerializer,
    TwoFactorConfirmSerializer,
    TwoFactorDisableSerializer,
    TwoFactorChallengeRequestSerializer,
    TwoFactorChallengeVerifySerializer,
    DriverAvailabilitySerializer,
    DriverProfileCreateSerializer,
    DriverProfileSerializer,
    FutminnaTokenObtainPairSerializer,
    OTPRequestSerializer,
    StudentSignupOTPRequestSerializer,
    StudentSignupOTPVerifySerializer,
    OTPVerifySerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    StudentProfileSerializer,
    SessionTokenRefreshSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
    CampusSerializer,
    MapSettingsSerializer,
)
from .services import OTPService, EmailOTPService, StudentSignupVerificationService
from .system_health import get_system_health_report
from apps.pricing.models import PlatformSettings

logger = logging.getLogger('apps.accounts')


def _get_user_settings(user: User) -> UserSettings:
    settings_obj, _created = UserSettings.objects.get_or_create(user=user)
    return settings_obj


def _build_user_payload(user: User) -> dict:
    campus_info = None
    try:
        if user.role == UserRole.STUDENT and user.student_profile.campus:
            campus_info = {"id": str(user.student_profile.campus.id), "name": user.student_profile.campus.name}
        elif user.role == UserRole.DRIVER and hasattr(user, 'driver_profile') and user.driver_profile.campus:
            campus_info = {"id": str(user.driver_profile.campus.id), "name": user.driver_profile.campus.name}
        elif user.role == UserRole.CAMPUS_ADMIN and hasattr(user, 'campus_admin_profile'):
            campus_info = {"id": str(user.campus_admin_profile.campus.id), "name": user.campus_admin_profile.campus.name}
    except Exception:
        pass

    return {
        "id": str(user.id),
        "phone_number": str(user.phone_number) if user.phone_number else None,
        "email": user.email,
        "full_name": user.full_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_verified": user.is_verified,
        "campus": campus_info,
    }


def _mask_secret(value: str, show_last: int = 4) -> str:
    if not value:
        return ''
    trimmed = value.strip()
    if len(trimmed) <= show_last:
        return '*' * len(trimmed)
    return f"{'*' * (len(trimmed) - show_last)}{trimmed[-show_last:]}"


def _unsign_login_challenge(token: str) -> User | None:
    signer = signing.TimestampSigner()
    max_age = getattr(settings, 'TWO_FACTOR_CHALLENGE_TTL', 300)
    try:
        raw = signer.unsign(token, max_age=max_age)
    except signing.BadSignature:
        return None
    try:
        return User.objects.get(id=raw)
    except User.DoesNotExist:
        return None


class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = AUTH_THROTTLE_CLASSES

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = serializer.validated_data.get('role') or UserRole.STUDENT
        verified_session = None
        if role == UserRole.STUDENT:
            email = serializer.validated_data.get('email')
            verification_token = (serializer.validated_data.get('verification_token') or '').strip()
            if not verification_token:
                return Response(
                    {
                        'error': {
                            'code': 'VERIFICATION_REQUIRED',
                            'message': 'Please verify your email code before creating a student account.',
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            verified_session = StudentSignupVerificationService.get_verified_session(email, verification_token)
            if not verified_session:
                return Response(
                    {
                        'error': {
                            'code': 'VERIFICATION_INVALID',
                            'message': 'Verification session is invalid or expired. Please request a new code.',
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        user = serializer.save()
        if user.role == UserRole.STUDENT:
            user.is_email_verified = True
            user.save(update_fields=['is_email_verified'])
            if verified_session:
                StudentSignupVerificationService.mark_consumed(verified_session)
        if user.phone_number:
            OTPService.create_and_send(user, OTPVerification.Purpose.PHONE_VERIFICATION)
        return Response(
            {
                'message': (
                    'Registration successful. Your email has been verified.'
                    if user.role == UserRole.STUDENT
                    else (
                        'Registration successful.'
                        if not user.phone_number
                        else 'Registration successful. A verification code has been sent to your phone.'
                    )
                ),
                'user_id': str(user.id),
                'role': user.role,
            },
            status=status.HTTP_201_CREATED,
        )


class StudentSignupRequestEmailOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = StudentSignupOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        try:
            StudentSignupVerificationService.request_code(email)
        except RuntimeError as exc:
            return Response(
                {'error': {'code': 'EMAIL_DELIVERY_FAILED', 'message': str(exc)}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({'message': f'Verification code sent to {email}.'}, status=status.HTTP_200_OK)


class StudentSignupVerifyEmailOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = StudentSignupOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        code = serializer.validated_data['code']
        success, message, session = StudentSignupVerificationService.verify_code(email, code)
        if not success or not session:
            return Response(
                {'error': {'code': 'OTP_INVALID', 'message': message}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'message': message,
                'verified': True,
                'verification_token': session.verification_token,
            },
            status=status.HTTP_200_OK,
        )


class LoginView(TokenObtainPairView):
    serializer_class = FutminnaTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = AUTH_THROTTLE_CLASSES

    # last_login_ip is now saved by the serializer via request context.
    # No need to re-query the user here.


class SessionTokenRefreshView(TokenRefreshView):
    serializer_class = SessionTokenRefreshSerializer


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            # Clear push token so this user stops receiving notifications
            # on the device they are logging out from.
            if request.user.fcm_token:
                request.user.fcm_token = None
                request.user.save(update_fields=['fcm_token'])

            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return Response(
                    {'error': {'code': 'MISSING_TOKEN', 'message': 'Refresh token is required.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response(
                {'error': {'code': 'INVALID_TOKEN', 'message': 'Invalid or expired token.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )


class OTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = AUTH_THROTTLE_CLASSES

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data['phone_number']
        purpose = serializer.validated_data['purpose']
        try:
            user = User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            return Response(
                {'message': 'If an account exists for this phone number, a verification code has been sent.'},
            )
        OTPService.create_and_send(user, purpose)
        return Response(
            {'message': 'If an account exists for this phone number, a verification code has been sent.'},
        )


class OTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = AUTH_THROTTLE_CLASSES

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data['phone_number']
        code = serializer.validated_data['code']
        purpose = serializer.validated_data['purpose']
        
        allow_dev_bypass = (
            settings.DEBUG
            and getattr(settings, 'ALLOW_DEV_OTP_BYPASS', False)
            and code == '123456'
        )
        if allow_dev_bypass:
            success, message = True, 'Verification successful (dev bypass).'
        else:
            success, message = OTPService.verify(phone_number, code, purpose)
            
        if not success:
            return Response(
                {'error': {'code': 'OTP_INVALID', 'message': message}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if purpose == OTPVerification.Purpose.PHONE_VERIFICATION:
            try:
                user = User.objects.get(phone_number=phone_number)
                user.is_phone_verified = True
                user.is_verified = True
                user.save(update_fields=['is_phone_verified', 'is_verified'])
            except User.DoesNotExist:
                pass
        return Response({'message': message, 'verified': True})


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        log_audit(request, 'password_change', target_type='user', target_id=str(request.user.id))
        # Invalidate all existing refresh tokens for this user
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            tokens = OutstandingToken.objects.filter(user=request.user)
            for token in tokens:
                try:
                    from rest_framework_simplejwt.tokens import RefreshToken
                    RefreshToken(token.token).blacklist()
                except Exception:
                    pass
        except Exception:
            pass
        return Response({'message': 'Password changed successfully. Please log in again.'})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data.get('email')
        phone_number = serializer.validated_data.get('phone_number')

        if email:
            user = User.objects.filter(email__iexact=email).first()
        else:
            user = User.objects.filter(phone_number=phone_number).first()

        if not user:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Account not found. Please contact admin for account recovery.'}},
                status=status.HTTP_404_NOT_FOUND
            )

        if not user.email:
            return Response(
                {'error': {'code': 'NO_EMAIL', 'message': 'Account does not have an email attached. Please contact admin for account recovery.'}},
                status=status.HTTP_400_BAD_REQUEST
            )

        EmailOTPService.create_and_send(
            user,
            OTPVerification.Purpose.PASSWORD_RESET,
            email=user.email,
        )
        return Response({'message': 'A reset code has been sent to your email.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data.get('email')
        phone_number = serializer.validated_data.get('phone_number')
        code = serializer.validated_data['code']
        new_password = serializer.validated_data['new_password']

        if email:
            success, message = EmailOTPService.verify(email, code, OTPVerification.Purpose.PASSWORD_RESET)
        else:
            success, message = OTPService.verify(phone_number, code, OTPVerification.Purpose.PASSWORD_RESET)

        if not success:
            return Response(
                {'error': {'code': 'OTP_INVALID', 'message': message}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            if email:
                user = User.objects.get(email__iexact=email)
            else:
                user = User.objects.get(phone_number=phone_number)
            user.set_password(new_password)
            user.save(update_fields=['password'])
            # Invalidate all existing refresh tokens
            try:
                from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
                tokens = OutstandingToken.objects.filter(user=user)
                for token in tokens:
                    try:
                        from rest_framework_simplejwt.tokens import RefreshToken
                        RefreshToken(token.token).blacklist()
                    except Exception:
                        pass
            except Exception:
                pass
        except User.DoesNotExist:
            return Response(
                {'error': {'code': 'USER_NOT_FOUND', 'message': 'Account not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({'message': 'Password has been reset successfully. You can now log in.'})


class StudentProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = StudentProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            return self.request.user.student_profile
        except StudentProfile.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Student profile not found.')


class CampusListView(generics.ListAPIView):
    serializer_class = CampusSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        Campus.objects.get_or_create(
            code='GK',
            defaults={'name': 'Gidan Kwano (FUTMINNA)', 'is_active': True},
        )
        Campus.objects.get_or_create(
            code='BOS',
            defaults={'name': 'Bosso (FUTMINNA)', 'is_active': True},
        )
        return Campus.objects.filter(is_active=True).order_by('name')


class DriverProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            return self.request.user.driver_profile
        except DriverProfile.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Driver profile not found.')


class DriverProfileCreateView(generics.CreateAPIView):
    serializer_class = DriverProfileCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only driver accounts can create a driver profile.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(
            DriverProfileSerializer(profile, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class DriverAvailabilityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        if request.user.role != UserRole.DRIVER:
            return Response(
                {'error': {'code': 'FORBIDDEN', 'message': 'Only drivers can change availability.'}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = DriverAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            profile = request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'PROFILE_NOT_FOUND', 'message': 'Driver profile not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if profile.verification_status != DriverProfile.VerificationStatus.APPROVED:
            return Response(
                {'error': {'code': 'NOT_APPROVED', 'message': 'Your account must be approved before going online.'}},
                status=status.HTTP_403_FORBIDDEN,
            )

        is_online_requested = serializer.validated_data['is_online']

        if is_online_requested:
            # Phase 3: Enforce mutual exclusivity
            from apps.rides.garage_models import GarageRide, GarageRideStatus
            active_garage = GarageRide.objects.filter(
                driver=request.user,
                status__in=[GarageRideStatus.OPEN, GarageRideStatus.FULL, GarageRideStatus.DEPARTED]
            ).exists()
            if active_garage:
                return Response(
                    {'error': {'code': 'ACTIVE_GARAGE_SESSION', 'message': 'Complete or cancel your garage session first.'}},
                    status=status.HTTP_409_CONFLICT,
                )

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
                        # Combine date and time
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

        profile.is_online = is_online_requested
        profile.save(update_fields=['is_online'])
        return Response({'is_online': profile.is_online, 'message': 'Availability updated.'})


# ── Admin Views ────────────────────────────────────────────────────────────────

class AdminUserListView(generics.ListAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'is_verified', 'is_active']
    search_fields = ['first_name', 'last_name', 'phone_number', 'email']
    ordering_fields = ['created_at', 'first_name']
    ordering = ['-created_at']

    def get_queryset(self):
        return User.objects.exclude(
            role__in=[UserRole.ADMIN, UserRole.CAMPUS_ADMIN]
        ).select_related('student_profile', 'driver_profile')


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    lookup_field = 'id'

    def get_queryset(self):
        qs = User.objects.exclude(
            role__in=[UserRole.ADMIN, UserRole.CAMPUS_ADMIN]
        ).select_related('student_profile', 'driver_profile')
        if self.request.user.role == UserRole.CAMPUS_ADMIN:
            try:
                campus = self.request.user.campus_admin_profile.campus
            except CampusAdminProfile.DoesNotExist:
                return User.objects.none()
            qs = qs.filter(
                models.Q(student_profile__campus=campus)
                | models.Q(driver_profile__campus=campus)
            )
        return qs


class AdminDriverListView(generics.ListAPIView):
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['verification_status', 'is_online', 'vehicle_type']
    search_fields = ['user__first_name', 'user__last_name', 'user__phone_number', 'plate_number']

    def get_queryset(self):
        return DriverProfile.objects.all().select_related('user')


class CampusAdminFleetListView(generics.ListAPIView):
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['maintenance_status', 'verification_status', 'vehicle_type']
    search_fields = ['user__first_name', 'user__last_name', 'plate_number', 'vehicle_make', 'vehicle_model']
    ordering_fields = ['last_service_date', 'odometer_km', 'vehicle_year', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = DriverProfile.objects.select_related('user', 'campus')
        from apps.rides.scheduled_models import BusAssignmentStatus, ScheduledRideBusAssignment

        departed_driver_ids = ScheduledRideBusAssignment.objects.filter(
            driver__isnull=False,
            status__in=[
                BusAssignmentStatus.DEPARTED,
                BusAssignmentStatus.EN_ROUTE,
                BusAssignmentStatus.ARRIVED,
            ],
        ).values_list('driver_id', flat=True)
        queryset = queryset.exclude(user_id__in=departed_driver_ids)

        if self.request.user.role == UserRole.CAMPUS_ADMIN:
            try:
                campus = self.request.user.campus_admin_profile.campus
            except CampusAdminProfile.DoesNotExist:
                return DriverProfile.objects.none()
            # Include drivers assigned to this campus + unassigned drivers (campus=None)
            return queryset.filter(
                models.Q(campus=campus) | models.Q(campus__isnull=True)
            )
        return queryset


class AdminDriverVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        try:
            profile = DriverProfile.objects.get(pk=pk)
        except DriverProfile.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'Driver profile not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )
        new_status = request.data.get('verification_status')
        allowed = [s[0] for s in DriverProfile.VerificationStatus.choices]
        if new_status not in allowed:
            return Response(
                {'error': {'code': 'INVALID_STATUS', 'message': f'Valid statuses: {allowed}'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.verification_status = new_status
        if new_status == DriverProfile.VerificationStatus.APPROVED:
            profile.verified_at = timezone.now()
            profile.verified_by = request.user
        notes = request.data.get('notes', '')
        if notes:
            profile.verification_notes = notes
        profile.save()
        logger.info(
            'driver_verified driver_id=%s new_status=%s admin_id=%s',
            str(profile.user.id), new_status, str(request.user.id)
        )
        return Response(DriverProfileSerializer(profile, context={'request': request}).data)


class AdminToggleUserActiveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {'error': {'code': 'NOT_FOUND', 'message': 'User not found.'}},
                status=status.HTTP_404_NOT_FOUND,
            )
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        action = 'activated' if user.is_active else 'deactivated'
        logger.info('user_%s user_id=%s admin_id=%s', action, str(user.id), str(request.user.id))
        return Response({'is_active': user.is_active, 'message': f'User {action}.'})


class AdminSummaryStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        from apps.verification.models import AccountVerification
        total_users = User.objects.exclude(role__in=[UserRole.ADMIN, UserRole.CAMPUS_ADMIN]).count()
        students = User.objects.filter(role=UserRole.STUDENT).count()
        drivers = User.objects.filter(role=UserRole.DRIVER).count()
        # Verified drivers (using account verification status approved)
        verified_drivers = AccountVerification.objects.filter(status=AccountVerification.Status.APPROVED).count()
        
        return Response({
            'total_users': total_users,
            'students': students,
            'drivers': drivers,
            'verified_drivers': verified_drivers,
        })


# ── Account Settings Views ─────────────────────────────────────────────────────

class ChangeEmailView(APIView):
    """Change email address. Requires current password for verification."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangeEmailSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        new_email = serializer.validated_data['new_email']

        # Check if email is already taken by another user
        if User.objects.filter(email__iexact=new_email).exclude(id=request.user.id).exists():
            return Response(
                {'error': {'code': 'EMAIL_TAKEN', 'message': 'This email is already in use.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.email = new_email
        request.user.is_email_verified = True  # Verified by password
        request.user.save(update_fields=['email', 'is_email_verified'])
        logger.info('email_changed user_id=%s new_email=%s', str(request.user.id), new_email)
        return Response({
            'message': 'Email updated successfully.',
            'email': new_email,
        })


class UserSettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        settings, _created = UserSettings.objects.get_or_create(user=self.request.user)
        return settings


class IntegrationStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        platform_settings = PlatformSettings.load()
        paystack_secret = getattr(settings, 'PAYSTACK_SECRET_KEY', '')
        paystack_public = getattr(settings, 'PAYSTACK_PUBLIC_KEY', '')
        flutter_secret = getattr(settings, 'FLUTTERWAVE_SECRET_KEY', '')
        flutter_public = getattr(settings, 'FLUTTERWAVE_PUBLIC_KEY', '')
        flutter_webhook = getattr(settings, 'FLUTTERWAVE_WEBHOOK_SECRET', '')
        termii_key = getattr(settings, 'TERMII_API_KEY', '')
        fcm_key = getattr(settings, 'FCM_SERVER_KEY', '')
        brevo_key = getattr(settings, 'BREVO_API_KEY', '')
        email_password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
        google_maps_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        osrm_base_url = getattr(settings, 'OSRM_BASE_URL', '')
        google_oauth_client = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '')
        google_oauth_secret = getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', '')

        data = {
            'generated_at': timezone.now(),
            'payments': {
                'paystack': {
                    'configured': bool(paystack_secret and paystack_public),
                    'secret_key': _mask_secret(paystack_secret),
                    'public_key': _mask_secret(paystack_public),
                    'webhook_allowlist_count': len(getattr(settings, 'PAYSTACK_WEBHOOK_IP_ALLOWLIST', [])),
                },
                'flutterwave': {
                    'configured': bool(flutter_secret and flutter_public),
                    'secret_key': _mask_secret(flutter_secret),
                    'public_key': _mask_secret(flutter_public),
                    'webhook_secret': _mask_secret(flutter_webhook),
                    'webhook_allowlist_count': len(getattr(settings, 'FLUTTERWAVE_WEBHOOK_IP_ALLOWLIST', [])),
                },
            },
            'notifications': {
                'email': {
                    'configured': bool(brevo_key or email_password),
                    'provider': 'brevo' if brevo_key else ('smtp' if email_password else 'console'),
                },
                'sms': {
                    'configured': bool(termii_key),
                    'provider': 'termii',
                },
                'fcm': {
                    'configured': bool(fcm_key),
                },
                'expo': {
                    'configured': True,
                },
            },
            'routing': {
                'provider': platform_settings.distance_provider,
                'providers': {
                    'haversine': {'available': True},
                    'osrm': {
                        'available': bool(osrm_base_url),
                        'base_url': osrm_base_url,
                    },
                    'google': {
                        'available': bool(google_maps_key),
                        'api_key': _mask_secret(google_maps_key),
                    },
                },
            },
            'auth': {
                'google_oauth': {
                    'configured': bool(google_oauth_client and google_oauth_secret),
                    'client_id': _mask_secret(google_oauth_client),
                },
            },
        }
        return Response(data)


class SystemHealthStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        refresh = str(request.query_params.get('refresh', '')).lower() in {'1', 'true', 'yes'}
        return Response(get_system_health_report(force_refresh=refresh))


class IntegrationConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        integration = IntegrationSettings.load()
        platform_settings = PlatformSettings.load()
        payload = IntegrationSettingsSerializer(integration).data
        payload['routing_provider'] = platform_settings.distance_provider
        return Response(payload)

    def patch(self, request):
        integration = IntegrationSettings.load()
        platform_settings = PlatformSettings.load()
        data = request.data.copy()
        provider = data.pop('routing_provider', None)
        if isinstance(provider, list):
            provider = provider[0] if provider else None
        serializer = IntegrationSettingsSerializer(
            integration, data=data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)

        if provider:
            valid_providers = {choice[0] for choice in PlatformSettings.DistanceProvider.choices}
            if provider not in valid_providers:
                return Response(
                    {'error': {'code': 'INVALID_PROVIDER', 'message': 'Invalid routing provider.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            platform_settings.distance_provider = provider
            platform_settings.updated_by = request.user
            platform_settings.save(update_fields=['distance_provider', 'updated_by', 'updated_at'])

        payload = IntegrationSettingsSerializer(integration).data
        payload['routing_provider'] = platform_settings.distance_provider
        return Response(payload)


class PinSetView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PinSetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        settings_obj = _get_user_settings(request.user)
        current_pin = (serializer.validated_data.get('current_pin') or '').strip()
        new_pin = serializer.validated_data['new_pin']

        if settings_obj.pin_hash:
            if not current_pin or not check_password(current_pin, settings_obj.pin_hash):
                return Response(
                    {'error': {'code': 'PIN_INVALID', 'message': 'Current PIN is incorrect.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        settings_obj.pin_hash = make_password(new_pin)
        settings_obj.pin_updated_at = timezone.now()
        settings_obj.set_offline_pin_verifier(new_pin)
        settings_obj.save(update_fields=[
            'pin_hash',
            'pin_updated_at',
            'offline_pin_salt',
            'offline_pin_hash',
            'offline_pin_iterations',
        ])
        return Response({
            'message': 'PIN updated successfully.',
            'offline_pin_verifier': settings_obj.get_offline_pin_verifier(),
        })


class PinVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = []  # uses custom cache lockout below

    def post(self, request):
        from django.core.cache import cache

        lock_key = f'pin_lock:{request.user.id}'
        locked_until = cache.get(lock_key)
        if locked_until:
            return Response(
                {'error': {'code': 'PIN_LOCKED', 'message': 'Too many failed PIN attempts. Try again later.'}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = PinVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        settings_obj = _get_user_settings(request.user)
        pin = serializer.validated_data['pin']
        if not settings_obj.pin_hash or not check_password(pin, settings_obj.pin_hash):
            fail_key = f'pin_fail:{request.user.id}'
            attempts = cache.get(fail_key, 0) + 1
            cache.set(fail_key, attempts, timeout=settings.PIN_LOCKOUT_MINUTES * 60)
            if attempts >= settings.PIN_ATTEMPT_LIMIT:
                cache.set(lock_key, True, timeout=settings.PIN_LOCKOUT_MINUTES * 60)
                cache.delete(fail_key)
            return Response(
                {'error': {'code': 'PIN_INVALID', 'message': 'PIN is incorrect.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cache.delete(f'pin_fail:{request.user.id}')
        cache.delete(lock_key)
        if not settings_obj.get_offline_pin_verifier():
            settings_obj.set_offline_pin_verifier(pin)
            settings_obj.save(update_fields=[
                'offline_pin_salt',
                'offline_pin_hash',
                'offline_pin_iterations',
            ])
        return Response({
            'verified': True,
            'offline_pin_verifier': settings_obj.get_offline_pin_verifier(),
        })


class PinResetRequestOTPView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.email:
            return Response(
                {'error': {'code': 'EMAIL_REQUIRED', 'message': 'You must have an email address to reset your PIN.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        EmailOTPService.create_and_send(request.user, OTPVerification.Purpose.TRANSACTION_PIN)
        return Response({'message': 'OTP sent to your registered email address.'})


class PinResetConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PinResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        otp_code = serializer.validated_data['otp_code']
        new_pin = serializer.validated_data['new_pin']

        success, message = EmailOTPService.verify(request.user.email, otp_code, OTPVerification.Purpose.TRANSACTION_PIN)
        if not success:
            return Response(
                {'error': {'code': 'OTP_INVALID', 'message': message}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        settings_obj = _get_user_settings(request.user)
        settings_obj.pin_hash = make_password(new_pin)
        settings_obj.pin_updated_at = timezone.now()
        settings_obj.set_offline_pin_verifier(new_pin)
        settings_obj.save(update_fields=[
            'pin_hash',
            'pin_updated_at',
            'offline_pin_salt',
            'offline_pin_hash',
            'offline_pin_iterations',
        ])
        
        NotificationService.notify(
            user=request.user,
            notification_type='system_alert',
            title='Transaction PIN Reset',
            body='Your transaction PIN has been successfully reset. If you did not initiate this change, please contact support immediately.',
        )

        # Also send email alert
        try:
            from django.core.mail import EmailMultiAlternatives
            from django.template.loader import render_to_string
            from django.conf import settings as django_settings
            context = {
                'app_name': 'LR-Ride',
                'headline': 'Transaction PIN Reset Successful',
                'code': '••••',  # not showing actual PIN
                'expiry_minutes': 0,
                'support_message': 'If you did not perform this action, please contact support immediately.',
            }
            html_body = render_to_string('emails/otp_email.html', context)
            text_body = f'Your LR-Ride transaction PIN has been successfully reset. If this was not you, contact support immediately.'
            msg = EmailMultiAlternatives(
                subject='LR-Ride: Transaction PIN Reset',
                body=text_body,
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                to=[request.user.email],
            )
            msg.attach_alternative(html_body, 'text/html')
            msg.send(fail_silently=True)
        except Exception:
            pass

        return Response({
            'message': 'PIN reset successfully.',
            'offline_pin_verifier': settings_obj.get_offline_pin_verifier(),
        })


class TwoFactorStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TwoFactorStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        method = serializer.validated_data['method']
        settings_obj = _get_user_settings(request.user)

        if method == 'totp':
            try:
                import pyotp
            except Exception:
                return Response(
                    {'error': {'code': 'TOTP_UNAVAILABLE', 'message': 'TOTP is not available.'}},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            secret = pyotp.random_base32()
            settings_obj.totp_secret = secret
            settings_obj.totp_confirmed_at = None
            settings_obj.backup_codes = [secrets.token_hex(4) for _ in range(8)]
            settings_obj.save(update_fields=['totp_secret', 'totp_confirmed_at', 'backup_codes'])
            issuer = 'LR Ride'
            label = request.user.email or str(request.user.phone_number)
            otpauth_url = pyotp.totp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)
            return Response({
                'method': 'totp',
                'secret': secret,
                'otpauth_url': otpauth_url,
                'backup_codes': settings_obj.backup_codes,
            })

        if method == 'sms':
            if not request.user.phone_number:
                return Response(
                    {'error': {'code': 'NO_PHONE', 'message': 'Phone number is required for SMS 2FA.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            OTPService.create_and_send(request.user, OTPVerification.Purpose.TWO_FACTOR)
            return Response({'method': 'sms', 'message': 'Verification code sent via SMS.'})

        if not request.user.email:
            return Response(
                {'error': {'code': 'NO_EMAIL', 'message': 'Email is required for email 2FA.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        EmailOTPService.create_and_send(request.user, OTPVerification.Purpose.TWO_FACTOR)
        return Response({'method': 'email', 'message': 'Verification code sent via email.'})


class TwoFactorConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TwoFactorConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        method = serializer.validated_data['method']
        code = serializer.validated_data['code']
        settings_obj = _get_user_settings(request.user)

        if method == 'totp':
            try:
                import pyotp
            except Exception:
                return Response(
                    {'error': {'code': 'TOTP_UNAVAILABLE', 'message': 'TOTP is not available.'}},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if not settings_obj.totp_secret:
                return Response(
                    {'error': {'code': 'TOTP_MISSING', 'message': 'TOTP setup has not been started.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            totp = pyotp.TOTP(settings_obj.totp_secret)
            if not totp.verify(code, valid_window=1):
                return Response(
                    {'error': {'code': 'OTP_INVALID', 'message': 'Invalid TOTP code.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            settings_obj.totp_confirmed_at = timezone.now()

        elif method == 'sms':
            if not request.user.phone_number:
                return Response(
                    {'error': {'code': 'NO_PHONE', 'message': 'Phone number is required for SMS 2FA.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            success, message = OTPService.verify(str(request.user.phone_number), code, OTPVerification.Purpose.TWO_FACTOR)
            if not success:
                return Response({'error': {'code': 'OTP_INVALID', 'message': message}}, status=status.HTTP_400_BAD_REQUEST)

        else:
            if not request.user.email:
                return Response(
                    {'error': {'code': 'NO_EMAIL', 'message': 'Email is required for email 2FA.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            success, message = EmailOTPService.verify(request.user.email, code, OTPVerification.Purpose.TWO_FACTOR)
            if not success:
                return Response({'error': {'code': 'OTP_INVALID', 'message': message}}, status=status.HTTP_400_BAD_REQUEST)

        methods = settings_obj.two_factor_methods or []
        if method not in methods:
            methods.append(method)
        settings_obj.two_factor_enabled = True
        settings_obj.two_factor_methods = methods
        settings_obj.save(update_fields=['two_factor_enabled', 'two_factor_methods', 'totp_confirmed_at'])
        return Response(UserSettingsSerializer(settings_obj).data)


class TwoFactorDisableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TwoFactorDisableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        settings_obj = _get_user_settings(request.user)
        pin = serializer.validated_data['pin']
        if not settings_obj.pin_hash or not check_password(pin, settings_obj.pin_hash):
            return Response(
                {'error': {'code': 'PIN_INVALID', 'message': 'PIN is incorrect.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        settings_obj.two_factor_enabled = False
        settings_obj.two_factor_methods = []
        settings_obj.totp_secret = ''
        settings_obj.totp_confirmed_at = None
        settings_obj.backup_codes = []
        settings_obj.save(
            update_fields=[
                'two_factor_enabled',
                'two_factor_methods',
                'totp_secret',
                'totp_confirmed_at',
                'backup_codes',
            ]
        )
        return Response({'message': 'Two-factor authentication disabled.'})


class TwoFactorChallengeRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TwoFactorChallengeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        method = serializer.validated_data['method']
        user = _unsign_login_challenge(serializer.validated_data['login_challenge'])
        if not user:
            return Response(
                {'error': {'code': 'CHALLENGE_INVALID', 'message': 'Login challenge expired.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if method == 'sms':
            if not user.phone_number:
                return Response(
                    {'error': {'code': 'NO_PHONE', 'message': 'Phone number is required for SMS 2FA.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            OTPService.create_and_send(user, OTPVerification.Purpose.TWO_FACTOR)
            return Response({'message': 'Verification code sent via SMS.'})

        if method == 'email':
            if not user.email:
                return Response(
                    {'error': {'code': 'NO_EMAIL', 'message': 'Email is required for email 2FA.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            EmailOTPService.create_and_send(user, OTPVerification.Purpose.TWO_FACTOR)
            return Response({'message': 'Verification code sent via email.'})

        return Response({'message': 'TOTP does not require a delivery step.'})


class TwoFactorChallengeVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TwoFactorChallengeVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        method = serializer.validated_data['method']
        code = serializer.validated_data['code']
        user = _unsign_login_challenge(serializer.validated_data['login_challenge'])
        if not user:
            return Response(
                {'error': {'code': 'CHALLENGE_INVALID', 'message': 'Login challenge expired.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        settings_obj = _get_user_settings(user)
        if method == 'totp':
            try:
                import pyotp
            except Exception:
                return Response(
                    {'error': {'code': 'TOTP_UNAVAILABLE', 'message': 'TOTP is not available.'}},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if not settings_obj.totp_secret:
                return Response(
                    {'error': {'code': 'TOTP_MISSING', 'message': 'TOTP is not configured.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            totp = pyotp.TOTP(settings_obj.totp_secret)
            if not totp.verify(code, valid_window=1):
                return Response(
                    {'error': {'code': 'OTP_INVALID', 'message': 'Invalid TOTP code.'}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif method == 'sms':
            success, message = OTPService.verify(str(user.phone_number), code, OTPVerification.Purpose.TWO_FACTOR)
            if not success:
                return Response({'error': {'code': 'OTP_INVALID', 'message': message}}, status=status.HTTP_400_BAD_REQUEST)
        else:
            success, message = EmailOTPService.verify(user.email, code, OTPVerification.Purpose.TWO_FACTOR)
            if not success:
                return Response({'error': {'code': 'OTP_INVALID', 'message': message}}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        user.last_login = now
        user.session_started_at = now
        user.last_refresh_at = now
        user.save(update_fields=["last_login", "session_started_at", "last_refresh_at"])

        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': _build_user_payload(user),
            'settings': UserSettingsSerializer(settings_obj).data,
        })


class RequestPasswordChangeOTPView(APIView):
    """Send an OTP to the user's email to authorize a password change."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RequestPasswordChangeOTPSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.email:
            return Response(
                {'error': {'code': 'NO_EMAIL', 'message': 'You must set an email address before changing your password.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        EmailOTPService.create_and_send(user, OTPVerification.Purpose.PASSWORD_CHANGE)
        masked = user.email[:3] + '***' + user.email[user.email.index('@'):]
        return Response({
            'message': f'Verification code sent to {masked}.',
            'email_hint': masked,
        })


class ConfirmPasswordChangeView(APIView):
    """Confirm password change with email OTP + new password."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ConfirmPasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        user = request.user
        if not user.email:
            return Response(
                {'error': {'code': 'NO_EMAIL', 'message': 'No email on file for OTP verification.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        success, message = EmailOTPService.verify(user.email, otp_code, OTPVerification.Purpose.PASSWORD_CHANGE)
        if not success:
            return Response(
                {'error': {'code': 'OTP_INVALID', 'message': message}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])

        # Blacklist all existing tokens to force re-login
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            for token in OutstandingToken.objects.filter(user=user):
                try:
                    RefreshToken(token.token).blacklist()
                except Exception:
                    pass
        except Exception:
            pass

        logger.info('password_changed_via_otp user_id=%s', str(user.id))
        return Response({'message': 'Password changed successfully. Please log in again.'})


class MapSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        settings_obj = MapSettings.load()
        serializer = MapSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def patch(self, request):
        settings_obj = MapSettings.load()
        serializer = MapSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

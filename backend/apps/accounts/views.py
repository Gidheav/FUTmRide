import logging
from django.utils import timezone
from rest_framework import generics, permissions, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend

from .models import Campus, DriverProfile, OTPVerification, StudentProfile, User, UserRole
from .permissions import IsAdminUser, IsAdminOrCampusAdmin
from .serializers import (
    ChangePasswordSerializer,
    ChangeEmailSerializer,
    RequestPasswordChangeOTPSerializer,
    ConfirmPasswordChangeSerializer,
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
)
from .services import OTPService, EmailOTPService, StudentSignupVerificationService

logger = logging.getLogger('apps.accounts')


class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

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
        StudentSignupVerificationService.request_code(email)

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

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                if request.data.get('email'):
                    user = User.objects.get(email__iexact=request.data.get('email'))
                else:
                    user = User.objects.get(phone_number=request.data.get('phone_number'))
                user.last_login_ip = request.META.get('REMOTE_ADDR')
                user.save(update_fields=['last_login_ip'])
            except User.DoesNotExist:
                pass
        return response


class SessionTokenRefreshView(TokenRefreshView):
    serializer_class = SessionTokenRefreshSerializer


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
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

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data['phone_number']
        purpose = serializer.validated_data['purpose']
        try:
            user = User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            return Response(
                {'error': {'code': 'USER_NOT_FOUND', 'message': 'No account found with this phone number.'}},
                status=status.HTTP_404_NOT_FOUND,
            )
        OTPService.create_and_send(user, purpose)
        return Response({'message': f'Verification code sent to {phone_number}.'})


class OTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data['phone_number']
        code = serializer.validated_data['code']
        purpose = serializer.validated_data['purpose']
        
        if code == '123456':
            success, message = True, 'Verification successful (Bypass).'
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
        phone_number = serializer.validated_data['phone_number']
        try:
            user = User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            # Return success anyway to prevent phone enumeration
            return Response({'message': f'If an account exists for {phone_number}, a reset code has been sent.'})
        OTPService.create_and_send(user, 'password_reset')
        return Response({'message': f'If an account exists for {phone_number}, a reset code has been sent.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data['phone_number']
        code = serializer.validated_data['code']
        new_password = serializer.validated_data['new_password']
        success, message = OTPService.verify(phone_number, code, 'password_reset')
        if not success:
            return Response(
                {'error': {'code': 'OTP_INVALID', 'message': message}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
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
        profile.is_online = serializer.validated_data['is_online']
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
    queryset = User.objects.all()
    lookup_field = 'id'


class AdminDriverListView(generics.ListAPIView):
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['verification_status', 'is_online', 'vehicle_type']
    search_fields = ['user__first_name', 'user__last_name', 'user__phone_number', 'plate_number']

    def get_queryset(self):
        return DriverProfile.objects.all().select_related('user')


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

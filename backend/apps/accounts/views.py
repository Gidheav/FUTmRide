import logging
from django.utils import timezone
from rest_framework import generics, permissions, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend

from .models import DriverProfile, OTPVerification, StudentProfile, User, UserRole
from .permissions import IsAdminUser
from .serializers import (
    ChangePasswordSerializer,
    DriverAvailabilitySerializer,
    DriverProfileCreateSerializer,
    DriverProfileSerializer,
    FutminnaTokenObtainPairSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    StudentProfileSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)
from .services import OTPService

logger = logging.getLogger('apps.accounts')


class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        OTPService.create_and_send(user, OTPVerification.Purpose.PHONE_VERIFICATION)
        return Response(
            {
                'message': 'Registration successful. A verification code has been sent to your phone.',
                'user_id': str(user.id),
                'role': user.role,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = FutminnaTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                user = User.objects.get(phone_number=request.data.get('phone_number'))
                user.last_login_ip = request.META.get('REMOTE_ADDR')
                user.save(update_fields=['last_login_ip'])
            except User.DoesNotExist:
                pass
        return response


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
        return Response({'message': 'Password changed successfully.'})


class StudentProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = StudentProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            return self.request.user.student_profile
        except StudentProfile.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Student profile not found.')


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
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'is_verified', 'is_active']
    search_fields = ['first_name', 'last_name', 'phone_number', 'email']
    ordering_fields = ['created_at', 'first_name']
    ordering = ['-created_at']

    def get_queryset(self):
        return User.objects.all().select_related('student_profile', 'driver_profile')


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
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
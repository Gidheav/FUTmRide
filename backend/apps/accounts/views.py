import logging
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import DriverProfile, OTPVerification, StudentProfile, User, UserRole
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
            logger.info('user_logout user_id=%s', str(request.user.id))
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
        return Response(
            {'message': f'Verification code sent to {phone_number}.'},
            status=status.HTTP_200_OK,
        )


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
        return Response({'message': message, 'verified': True}, status=status.HTTP_200_OK)


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
        logger.info('password_changed user_id=%s', str(request.user.id))
        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


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
        return Response(
            {'is_online': profile.is_online, 'message': 'Availability updated.'},
            status=status.HTTP_200_OK,
        )
import uuid
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import DriverProfile, OTPVerification, StudentProfile, User, UserRole


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=[UserRole.STUDENT, UserRole.DRIVER])
    data_consent_given = serializers.BooleanField(required=True)

    class Meta:
        model = User
        fields = [
            'phone_number',
            'email',
            'first_name',
            'last_name',
            'role',
            'password',
            'confirm_password',
            'data_consent_given',
        ]

    def validate_phone_number(self, value):
        if User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError('A user with this phone number already exists.')
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        if not attrs.get('data_consent_given'):
            raise serializers.ValidationError(
                {'data_consent_given': 'Consent to data processing is required under NDPR.'}
            )
        return attrs

    def create(self, validated_data):
        validated_data['data_consent_timestamp'] = timezone.now()
        user = User.objects.create_user(
            phone_number=validated_data['phone_number'],
            password=validated_data['password'],
            email=validated_data.get('email'),
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            role=validated_data['role'],
            data_consent_given=validated_data['data_consent_given'],
            data_consent_timestamp=validated_data['data_consent_timestamp'],
        )
        if user.role == UserRole.STUDENT:
            StudentProfile.objects.create(user=user)
        elif user.role == UserRole.DRIVER:
            pass
        return user


class FutminnaTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'phone_number'

    def validate(self, attrs):
        try:
            user = User.objects.get(phone_number=attrs.get('phone_number'))
        except User.DoesNotExist:
            raise serializers.ValidationError({'detail': 'Invalid credentials.'})

        if not user.is_active:
            raise serializers.ValidationError({'detail': 'This account has been deactivated.'})

        if user.is_locked:
            raise serializers.ValidationError(
                {'detail': 'Account temporarily locked due to repeated failed attempts. Try again later.'}
            )

        try:
            data = super().validate(attrs)
        except Exception:
            user.increment_failed_login()
            raise serializers.ValidationError({'detail': 'Invalid credentials.'})

        user.reset_failed_login()

        data['user'] = {
            'id': str(self.user.id),
            'full_name': self.user.full_name,
            'role': self.user.role,
            'is_verified': self.user.is_verified,
            'is_phone_verified': self.user.is_phone_verified,
        }
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['full_name'] = user.full_name
        return token


class UserPublicSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'profile_photo', 'role']
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'phone_number',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'profile_photo',
            'is_verified',
            'is_phone_verified',
            'is_email_verified',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'phone_number',
            'role',
            'is_verified',
            'is_phone_verified',
            'is_email_verified',
            'created_at',
        ]


class StudentProfileSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            'id',
            'user',
            'matric_number',
            'department',
            'level',
            'campus',
            'wallet_balance',
            'total_trips',
            'average_rating_given',
        ]
        read_only_fields = ['wallet_balance', 'total_trips', 'average_rating_given']


class DriverProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverProfile
        fields = [
            'vehicle_type',
            'vehicle_make',
            'vehicle_model',
            'vehicle_year',
            'vehicle_color',
            'plate_number',
            'vehicle_seats',
        ]

    def validate_plate_number(self, value):
        if DriverProfile.objects.filter(plate_number=value).exists():
            raise serializers.ValidationError('This plate number is already registered.')
        return value.upper()

    def create(self, validated_data):
        user = self.context['request'].user
        if hasattr(user, 'driver_profile'):
            raise serializers.ValidationError('Driver profile already exists.')
        return DriverProfile.objects.create(user=user, **validated_data)


class DriverProfileSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)

    class Meta:
        model = DriverProfile
        fields = [
            'id',
            'user',
            'vehicle_type',
            'vehicle_make',
            'vehicle_model',
            'vehicle_year',
            'vehicle_color',
            'plate_number',
            'vehicle_seats',
            'verification_status',
            'is_online',
            'average_rating',
            'total_trips',
            'acceptance_rate',
            'wallet_balance',
            'total_earnings',
        ]
        read_only_fields = [
            'verification_status',
            'average_rating',
            'total_trips',
            'acceptance_rate',
            'wallet_balance',
            'total_earnings',
        ]


class DriverAvailabilitySerializer(serializers.Serializer):
    is_online = serializers.BooleanField()


class OTPRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    purpose = serializers.ChoiceField(choices=OTPVerification.Purpose.choices)


class OTPVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6)
    purpose = serializers.ChoiceField(choices=OTPVerification.Purpose.choices)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError({'confirm_new_password': 'Passwords do not match.'})
        return attrs

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value
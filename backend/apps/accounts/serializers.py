import re
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import DriverProfile, StudentProfile, User, UserRole, Campus, CampusAdminProfile, UserSettings


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)
    verification_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    data_consent_given = serializers.BooleanField(required=False)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=UserRole.choices, required=False, default=UserRole.STUDENT)
    phone_number = serializers.CharField(required=False, allow_blank=True)

    student_email_regex = re.compile(r"^[A-Za-z]+\.[mM]\d+@st\.futminna\.edu\.ng$")

    class Meta:
        model = User
        fields = [
            "phone_number",
            "email",
            "first_name",
            "last_name",
            "role",
            "password",
            "confirm_password",
            "verification_token",
            "data_consent_given",
        ]

    def validate_role(self, value):
        if value == UserRole.ADMIN:
            raise serializers.ValidationError("Admin accounts cannot be created via registration.")
        return value

    def validate_phone_number(self, value):
        if not value:
            return value
        cleaned = re.sub(r"[\s\-\(\)]", "", value)
        if not re.match(r"^\+?[0-9]{7,15}$", cleaned):
            raise serializers.ValidationError("Enter a valid phone number.")
        if User.objects.filter(phone_number=cleaned).exists():
            raise serializers.ValidationError("A user with this phone number already exists.")
        return cleaned

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        role = attrs.get("role") or UserRole.STUDENT
        if role == UserRole.STUDENT:
            email = (attrs.get("email") or "").strip().lower()
            if not email:
                raise serializers.ValidationError({"email": "Student email is required."})
            if not self.student_email_regex.match(email):
                raise serializers.ValidationError({
                    "email": "Use format name.m1234567@st.futminna.edu.ng for student accounts.",
                })
            attrs["email"] = email
            attrs["phone_number"] = (attrs.get("phone_number") or "").strip() or None
            if not attrs.get("first_name"):
                attrs["first_name"] = email.split("@", 1)[0].split(".")[0].capitalize()
            if not attrs.get("last_name"):
                attrs["last_name"] = "Student"
            if attrs.get("data_consent_given") is None:
                attrs["data_consent_given"] = True
        else:
            if not (attrs.get("phone_number") or "").strip():
                raise serializers.ValidationError({"phone_number": "Phone number is required."})
            if not attrs.get("first_name"):
                raise serializers.ValidationError({"first_name": "First name is required."})
            if not attrs.get("last_name"):
                raise serializers.ValidationError({"last_name": "Last name is required."})
            if not attrs.get("data_consent_given"):
                raise serializers.ValidationError({"data_consent_given": "You must accept the data consent policy."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            phone_number=validated_data.get("phone_number"),
            email=validated_data.get("email"),
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            role=validated_data["role"],
            password=validated_data["password"],
            data_consent_given=validated_data["data_consent_given"],
        )
        if user.role == UserRole.STUDENT:
            matric = None
            if user.email:
                local_part = user.email.split("@", 1)[0]
                if "." in local_part:
                    matric = local_part.split(".")[-1].lower()
            StudentProfile.objects.create(user=user, matric_number=matric)
        return user


class FutminnaTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "phone_number"
    phone_number = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    student_email_regex = re.compile(r"^[A-Za-z]+\.[mM]\d+@st\.futminna\.edu\.ng$")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.username_field in self.fields:
            self.fields[self.username_field].required = False
            self.fields[self.username_field].allow_blank = True

    def _build_user_payload(self, user):
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

    def _create_login_challenge(self, user):
        signer = signing.TimestampSigner()
        return signer.sign(str(user.id))

    def validate(self, attrs):
        email = (attrs.get("email") or "").strip().lower()
        phone_number = (attrs.get("phone_number") or "").strip()

        if email:
            if not self.student_email_regex.match(email):
                raise serializers.ValidationError({
                    "error": "Student email must match name.m1234567@st.futminna.edu.ng.",
                })
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                raise serializers.ValidationError({"error": "No account found with this email."})
            if user.role != UserRole.STUDENT:
                raise serializers.ValidationError({"error": "Only student accounts can sign in with email."})
        else:
            if not phone_number:
                raise serializers.ValidationError({"error": "Phone number or email is required."})
            try:
                user = User.objects.get(phone_number=phone_number)
            except User.DoesNotExist:
                raise serializers.ValidationError({"error": "No account found with this phone number."})
            if user.role == UserRole.STUDENT:
                raise serializers.ValidationError({"error": "Students must sign in with their university email."})
        if user.is_locked:
            raise serializers.ValidationError({"error": "Account locked. Too many failed attempts."})
        if not user.check_password(attrs.get("password")):
            user.increment_failed_login()
            raise serializers.ValidationError({"error": "Invalid credentials."})
        if not user.is_active:
            raise serializers.ValidationError({"error": "This account has been deactivated."})
        user.reset_failed_login()
        settings_obj, _created = UserSettings.objects.get_or_create(user=user)
        if settings_obj.two_factor_enabled and settings_obj.two_factor_methods:
            return {
                "two_factor_required": True,
                "methods": settings_obj.two_factor_methods,
                "login_challenge": self._create_login_challenge(user),
                "user": self._build_user_payload(user),
            }

        now = timezone.now()
        user.last_login = now
        user.session_started_at = now
        user.last_refresh_at = now
        user.save(update_fields=["last_login", "session_started_at", "last_refresh_at"])

        refresh = self.get_token(user)
        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": self._build_user_payload(user),
        }
        return data


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user_id = refresh.get("user_id")
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": "Account not found. Please log in again.",
                }
            })

        now = timezone.now()
        session_started_at = user.session_started_at or user.last_login or user.created_at
        max_age = timedelta(days=getattr(settings, "SESSION_MAX_AGE_DAYS", 14))
        if session_started_at and now - session_started_at > max_age:
            raise serializers.ValidationError({
                "error": {
                    "code": "SESSION_EXPIRED",
                    "message": "Session expired. Please log in again.",
                }
            })

        data = super().validate(attrs)
        user.last_refresh_at = now
        if not user.session_started_at:
            user.session_started_at = now
        user.save(update_fields=["last_refresh_at", "session_started_at"])
        return data


class UserPublicSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "first_name", "last_name", "phone_number", "role"]
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    full_name = serializers.CharField(read_only=True)
    wallet_balance = serializers.SerializerMethodField()
    campus = serializers.SerializerMethodField()
    profile_photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id", "phone_number", "first_name", "last_name", "full_name",
            "email", "role", "is_verified", "is_phone_verified", "is_active", "profile_photo",
            "fcm_token", "wallet_balance", "campus", "created_at", "home_address"
        ]
        read_only_fields = ["id", "role", "is_verified", "is_phone_verified", "is_active", "created_at", "full_name", "campus"]

    def get_wallet_balance(self, obj):
        try:
            if obj.role == UserRole.STUDENT:
                return str(obj.student_profile.wallet_balance)
            elif obj.role == UserRole.DRIVER:
                return str(obj.driver_profile.wallet_balance)
        except Exception:
            pass
        return "0.00"

    def get_campus(self, obj):
        try:
            if obj.role == UserRole.STUDENT and obj.student_profile.campus:
                return {"id": str(obj.student_profile.campus.id), "name": obj.student_profile.campus.name}
            elif obj.role == UserRole.DRIVER and hasattr(obj, 'driver_profile') and obj.driver_profile.campus:
                return {"id": str(obj.driver_profile.campus.id), "name": obj.driver_profile.campus.name}
            elif obj.role == UserRole.CAMPUS_ADMIN and hasattr(obj, 'campus_admin_profile'):
                return {"id": str(obj.campus_admin_profile.campus.id), "name": obj.campus_admin_profile.campus.name}
        except Exception:
            pass
        return None

    def validate_phone_number(self, value):
        if value is None:
            return None
        raw = str(value).strip().replace(' ', '')
        if raw == '':
            return None

        if raw.startswith('0') and raw.isdigit() and len(raw) == 11:
            raw = f'+234{raw[1:]}'
        elif raw.isdigit() and len(raw) == 11:
            raw = f'+234{raw[-10:]}'

        if not raw.startswith('+'):
            raise serializers.ValidationError('Enter a valid Nigerian phone number (11 digits).')

        exists = User.objects.filter(phone_number=raw)
        if self.instance:
            exists = exists.exclude(id=self.instance.id)
        if exists.exists():
            raise serializers.ValidationError('A user with this phone number already exists.')

        return raw


class UserSettingsSerializer(serializers.ModelSerializer):
    has_pin = serializers.SerializerMethodField()

    class Meta:
        model = UserSettings
        fields = [
            'has_pin',
            'language',
            'theme_mode',
            'push_enabled',
            'navigation_app',
            'biometric_enabled',
            'two_factor_enabled',
            'two_factor_methods',
        ]
        read_only_fields = ['has_pin']

    def get_has_pin(self, obj):
        return bool(obj.pin_hash)


class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = ["id", "name", "code"]


class StudentProfileSerializer(serializers.ModelSerializer):
    campus = CampusSerializer(read_only=True)
    campus_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = StudentProfile
        fields = [
            "id",
            "matric_number",
            "department",
            "level",
            "campus",
            "campus_id",
            "wallet_balance",
            "total_trips",
            "average_rating_given",
            "created_at",
        ]
        read_only_fields = ["id", "wallet_balance", "total_trips", "created_at", "campus"]

    def validate_matric_number(self, value):
        if not value:
            return value
        pattern = r"^\d{4}/\d/\d{5}[A-Za-z]{0,3}$"
        if not re.match(pattern, value):
            raise serializers.ValidationError(
                "Matric number must match YYYY/D/#####AAA (e.g. 1983/11/00000ABC)."
            )
        return value

    def update(self, instance, validated_data):
        campus_id = validated_data.pop("campus_id", None)
        if campus_id is not None:
            if campus_id:
                try:
                    instance.campus = Campus.objects.get(id=campus_id, is_active=True)
                except Campus.DoesNotExist:
                    raise serializers.ValidationError({"campus_id": "Selected campus is invalid."})
            else:
                instance.campus = None
        return super().update(instance, validated_data)


class DriverProfileSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)

    class Meta:
        model = DriverProfile
        fields = [
            "id", "user", "vehicle_type", "vehicle_make", "vehicle_model",
            "vehicle_year", "vehicle_color", "plate_number", "verification_status",
            "maintenance_status", "last_service_date", "service_due_date", "odometer_km",
            "is_online", "is_on_trip", "wallet_balance", "daily_goal_target", "total_trips",
            "total_earnings", "average_rating", "acceptance_rate",
            "cancellation_rate", "verified_at", "created_at",
        ]
        read_only_fields = [
            "id", "verification_status", "maintenance_status", "last_service_date",
            "service_due_date", "odometer_km", "is_on_trip", "wallet_balance",
            "total_trips", "total_earnings", "average_rating",
            "acceptance_rate", "cancellation_rate", "verified_at", "created_at",
        ]


class DriverProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverProfile
        fields = ["vehicle_type", "vehicle_make", "vehicle_model", "vehicle_year", "vehicle_color", "plate_number"]

    def create(self, validated_data):
        return DriverProfile.objects.create(
            user=self.context["request"].user, 
            verification_status='approved',
            **validated_data
        )


class DriverAvailabilitySerializer(serializers.Serializer):
    is_online = serializers.BooleanField()


class OTPRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    purpose = serializers.CharField(default="phone_verification")


class OTPVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    code = serializers.CharField(max_length=6)
    purpose = serializers.CharField(default="phone_verification")


class StudentSignupOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(validators=[validate_password])
    confirm_password = serializers.CharField()
    role = serializers.ChoiceField(choices=UserRole.choices, required=False, default=UserRole.STUDENT)
    data_consent_given = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        email = (attrs.get('email') or '').strip().lower()
        if not email:
            raise serializers.ValidationError({'email': 'University email is required.'})

        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        if attrs.get('role') != UserRole.STUDENT:
            raise serializers.ValidationError({'role': 'Only student role is supported for email signup verification.'})

        if not UserRegistrationSerializer.student_email_regex.match(email):
            raise serializers.ValidationError({
                'email': 'Use format name.m1234567@st.futminna.edu.ng for student accounts.',
            })

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({'email': 'A user with this email already exists.'})

        attrs['email'] = email
        attrs['data_consent_given'] = True
        return attrs


class StudentSignupOTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)

    def validate(self, attrs):
        attrs['email'] = (attrs.get('email') or '').strip().lower()
        code = (attrs.get('code') or '').strip()
        if not code.isdigit():
            raise serializers.ValidationError({'code': 'Code must be a 6-digit number.'})
        attrs['code'] = code
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        phone_number = (attrs.get('phone_number') or '').strip()
        email = (attrs.get('email') or '').strip().lower()

        if not phone_number and not email:
            raise serializers.ValidationError({'non_field_errors': 'Provide phone number or email.'})

        attrs['phone_number'] = phone_number or None
        attrs['email'] = email or None
        return attrs


class PasswordResetConfirmSerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    code = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(validators=[validate_password])
    confirm_password = serializers.CharField()

    def validate(self, attrs):
        if attrs['new_password'] != attrs.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        phone_number = (attrs.get('phone_number') or '').strip()
        email = (attrs.get('email') or '').strip().lower()
        if not phone_number and not email:
            raise serializers.ValidationError({'non_field_errors': 'Provide phone number or email.'})

        code = (attrs.get('code') or '').strip()
        if not code.isdigit():
            raise serializers.ValidationError({'code': 'Code must be a 6-digit number.'})

        attrs['phone_number'] = phone_number or None
        attrs['email'] = email or None
        attrs['code'] = code
        return attrs


class ChangeEmailSerializer(serializers.Serializer):
    """Requires current password to authorize email change."""
    current_password = serializers.CharField()
    new_email = serializers.EmailField()

    def validate_current_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_email(self, value):
        value = value.strip().lower()
        if not value:
            raise serializers.ValidationError('Email is required.')
        return value


class RequestPasswordChangeOTPSerializer(serializers.Serializer):
    """Requires current password to trigger OTP email for password change."""
    current_password = serializers.CharField()

    def validate_current_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value


class PinSetSerializer(serializers.Serializer):
    current_pin = serializers.CharField(required=False, allow_blank=True)
    new_pin = serializers.CharField(min_length=4, max_length=6)

    def validate_new_pin(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('PIN must be numeric.')
        return value


class PinVerifySerializer(serializers.Serializer):
    pin = serializers.CharField(min_length=4, max_length=6)

    def validate_pin(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('PIN must be numeric.')
        return value


class TwoFactorStartSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=['totp', 'sms', 'email'])


class TwoFactorConfirmSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=['totp', 'sms', 'email'])
    code = serializers.CharField(max_length=6, min_length=6)

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('Code must be numeric.')
        return value


class TwoFactorDisableSerializer(serializers.Serializer):
    pin = serializers.CharField(min_length=4, max_length=6)


class TwoFactorChallengeRequestSerializer(serializers.Serializer):
    login_challenge = serializers.CharField()
    method = serializers.ChoiceField(choices=['totp', 'sms', 'email'])


class TwoFactorChallengeVerifySerializer(serializers.Serializer):
    login_challenge = serializers.CharField()
    method = serializers.ChoiceField(choices=['totp', 'sms', 'email'])
    code = serializers.CharField(max_length=6, min_length=6)

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('Code must be numeric.')
        return value


class ConfirmPasswordChangeSerializer(serializers.Serializer):
    """Verifies OTP + sets new password."""
    otp_code = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(validators=[validate_password])
    confirm_password = serializers.CharField()

    def validate(self, attrs):
        if attrs['new_password'] != attrs.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

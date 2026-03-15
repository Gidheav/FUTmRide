import re
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import DriverProfile, StudentProfile, User, UserRole


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)
    data_consent_given = serializers.BooleanField()

    class Meta:
        model = User
        fields = ["phone_number", "first_name", "last_name", "role", "password", "confirm_password", "data_consent_given"]

    def validate_role(self, value):
        if value == UserRole.ADMIN:
            raise serializers.ValidationError("Admin accounts cannot be created via registration.")
        return value

    def validate_phone_number(self, value):
        cleaned = re.sub(r"[\s\-\(\)]", "", value)
        if not re.match(r"^\+?[0-9]{7,15}$", cleaned):
            raise serializers.ValidationError("Enter a valid phone number.")
        return cleaned

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        if not attrs.get("data_consent_given"):
            raise serializers.ValidationError({"data_consent_given": "You must accept the data consent policy."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            phone_number=validated_data["phone_number"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            role=validated_data["role"],
            password=validated_data["password"],
            data_consent_given=validated_data["data_consent_given"],
        )
        if user.role == UserRole.STUDENT:
            StudentProfile.objects.create(user=user)
        return user


class FutminnaTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "phone_number"

    def validate(self, attrs):
        from django.utils import timezone
        from django.conf import settings as django_settings
        try:
            user = User.objects.get(phone_number=attrs.get("phone_number"))
        except User.DoesNotExist:
            raise serializers.ValidationError({"error": "No account found with this phone number."})
        if user.is_locked:
            raise serializers.ValidationError({"error": "Account locked. Too many failed attempts."})
        if not user.check_password(attrs.get("password")):
            user.increment_failed_login()
            raise serializers.ValidationError({"error": "Invalid credentials."})
        if not user.is_active:
            raise serializers.ValidationError({"error": "This account has been deactivated."})
        user.reset_failed_login()
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        data = super().validate(attrs)
        data["user"] = {
            "id": str(user.id),
            "phone_number": str(user.phone_number),
            "full_name": user.full_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "is_verified": user.is_verified,
        }
        return data


class UserPublicSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "first_name", "last_name", "phone_number", "role"]
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    wallet_balance = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "phone_number", "first_name", "last_name", "full_name",
            "email", "role", "is_verified", "is_phone_verified", "is_active",
            "fcm_token", "wallet_balance", "created_at",
        ]
        read_only_fields = ["id", "phone_number", "role", "is_verified", "is_phone_verified", "is_active", "created_at", "full_name"]

    def get_wallet_balance(self, obj):
        try:
            if obj.role == UserRole.STUDENT:
                return str(obj.student_profile.wallet_balance)
            elif obj.role == UserRole.DRIVER:
                return str(obj.driver_profile.wallet_balance)
        except Exception:
            pass
        return "0.00"


class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = ["id", "matric_number", "department", "wallet_balance", "total_trips", "average_rating_given", "created_at"]
        read_only_fields = ["id", "wallet_balance", "total_trips", "created_at"]


class DriverProfileSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)

    class Meta:
        model = DriverProfile
        fields = [
            "id", "user", "vehicle_type", "vehicle_make", "vehicle_model",
            "vehicle_year", "vehicle_color", "plate_number", "verification_status",
            "is_online", "is_on_trip", "wallet_balance", "total_trips",
            "total_earnings", "average_rating", "acceptance_rate",
            "cancellation_rate", "verified_at", "created_at",
        ]
        read_only_fields = [
            "id", "verification_status", "is_on_trip", "wallet_balance",
            "total_trips", "total_earnings", "average_rating",
            "acceptance_rate", "cancellation_rate", "verified_at", "created_at",
        ]


class DriverProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverProfile
        fields = ["vehicle_type", "vehicle_make", "vehicle_model", "vehicle_year", "vehicle_color", "plate_number"]

    def create(self, validated_data):
        return DriverProfile.objects.create(user=self.context["request"].user, **validated_data)


class DriverAvailabilitySerializer(serializers.Serializer):
    is_online = serializers.BooleanField()


class OTPRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    purpose = serializers.CharField(default="phone_verification")


class OTPVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    code = serializers.CharField(max_length=6)
    purpose = serializers.CharField(default="phone_verification")


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
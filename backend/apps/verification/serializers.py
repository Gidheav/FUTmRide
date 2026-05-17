from rest_framework import serializers
from apps.accounts.models import User
from .models import AccountVerification, DriverDocument


# ──────────────────────────────────────────────────────────────────────────────
#  DRIVER-FACING: Account Verification
# ──────────────────────────────────────────────────────────────────────────────

class AccountVerificationSubmitSerializer(serializers.ModelSerializer):
    """Driver submits their account verification."""

    class Meta:
        model = AccountVerification
        fields = [
            'id', 'full_name', 'age', 'state_of_origin',
            'address', 'nin_number', 'nin_scan',
            'status', 'rejection_reason', 'submitted_at',
        ]
        read_only_fields = ['id', 'status', 'rejection_reason', 'submitted_at']

    def validate_nin_number(self, value):
        if not value.isdigit() or len(value) != 11:
            raise serializers.ValidationError('NIN must be exactly 11 digits.')
        return value

    def validate(self, attrs):
        request = self.context['request']
        # Prevent duplicate submission
        if AccountVerification.objects.filter(
            driver=request.user,
            status__in=[AccountVerification.Status.PENDING, AccountVerification.Status.UNDER_REVIEW, AccountVerification.Status.APPROVED]
        ).exists():
            raise serializers.ValidationError(
                'You already have an active or approved account verification.'
            )
        return attrs

    def create(self, validated_data):
        driver = self.context['request'].user
        nin_scan = validated_data.pop('nin_scan', None)
        validated_data['status'] = AccountVerification.Status.PENDING
        
        av, created = AccountVerification.objects.update_or_create(
            driver=driver,
            defaults=validated_data
        )
        if nin_scan:
            av.nin_scan = nin_scan
            av.save(update_fields=['nin_scan'])
        return av


class AccountVerificationStatusSerializer(serializers.ModelSerializer):
    """Driver reads their own verification status."""

    class Meta:
        model = AccountVerification
        fields = [
            'id', 'status', 'rejection_reason',
            'submitted_at', 'reviewed_at',
        ]
        read_only_fields = fields


# ──────────────────────────────────────────────────────────────────────────────
#  DRIVER-FACING: Vehicle Documents
# ──────────────────────────────────────────────────────────────────────────────

class DriverDocumentSerializer(serializers.ModelSerializer):
    """Driver uploads a vehicle document."""

    class Meta:
        model = DriverDocument
        fields = ['id', 'document_type', 'file', 'status', 'rejection_reason', 'uploaded_at']
        read_only_fields = ['id', 'status', 'rejection_reason', 'uploaded_at']

    def create(self, validated_data):
        validated_data['driver'] = self.context['request'].user
        return super().create(validated_data)


class DriverDocumentStatusSerializer(serializers.ModelSerializer):
    """Driver reads status of their uploaded documents."""

    class Meta:
        model = DriverDocument
        fields = ['id', 'document_type', 'status', 'rejection_reason', 'uploaded_at']
        read_only_fields = fields


# ──────────────────────────────────────────────────────────────────────────────
#  ADMIN-FACING: Account Verification Review
# ──────────────────────────────────────────────────────────────────────────────

class AdminDriverSummarySerializer(serializers.ModelSerializer):
    """Compact driver info embedded in admin views."""
    full_name = serializers.CharField(read_only=True)
    profile_photo = serializers.ImageField(read_only=True)

    verification_status = serializers.CharField(source='driver_profile.verification_status', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone_number', 'profile_photo', 'verification_status']


class AdminAccountVerificationListSerializer(serializers.ModelSerializer):
    """Compact list item for the pending verifications sidebar."""
    driver_name = serializers.SerializerMethodField()
    driver_phone = serializers.SerializerMethodField()
    driver_id = serializers.UUIDField(source='driver.id', read_only=True)
    profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = AccountVerification
        fields = [
            'id', 'driver_id', 'driver_name', 'driver_phone',
            'profile_photo', 'status', 'submitted_at',
        ]

    def get_driver_name(self, obj):
        return obj.driver.full_name

    def get_driver_phone(self, obj):
        return str(obj.driver.phone_number) if obj.driver.phone_number else ''

    def get_profile_photo(self, obj):
        request = self.context.get('request')
        if obj.driver.profile_photo and request:
            return request.build_absolute_uri(obj.driver.profile_photo.url)
        return None


class AdminAccountVerificationDetailSerializer(serializers.ModelSerializer):
    """Full detail for admin review of one account verification."""
    driver = AdminDriverSummarySerializer(read_only=True)
    nin_scan_url = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AccountVerification
        fields = [
            'id', 'driver', 'full_name', 'age', 'state_of_origin', 'address',
            'nin_number', 'nin_scan', 'nin_scan_url',
            'status', 'rejection_reason', 'admin_notes',
            'reviewed_by_name', 'reviewed_at', 'submitted_at',
        ]

    def get_nin_scan_url(self, obj):
        request = self.context.get('request')
        if obj.nin_scan and request:
            return request.build_absolute_uri(obj.nin_scan.url)
        return None

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.full_name if obj.reviewed_by else None


class AdminAccountVerificationReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['approved', 'rejected'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    admin_notes = serializers.CharField(required=False, allow_blank=True)


# ──────────────────────────────────────────────────────────────────────────────
#  ADMIN-FACING: Vehicle Document Review
# ──────────────────────────────────────────────────────────────────────────────

class AdminDriverDocumentSerializer(serializers.ModelSerializer):
    """Full document info for admin."""
    file_url = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()

    class Meta:
        model = DriverDocument
        fields = [
            'id', 'driver_name', 'document_type', 'file', 'file_url',
            'status', 'rejection_reason', 'admin_notes', 'reviewed_at', 'uploaded_at',
        ]

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def get_driver_name(self, obj):
        return obj.driver.full_name


class DocumentReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['approved', 'rejected'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    admin_notes = serializers.CharField(required=False, allow_blank=True)


# ──────────────────────────────────────────────────────────────────────────────
#  ADMIN-FACING: Unified Pending Submissions List (Right Sidebar)
# ──────────────────────────────────────────────────────────────────────────────

class PendingSubmissionSerializer(serializers.Serializer):
    """Unified format for right sidebar — covers both account + vehicle pending items."""
    id = serializers.UUIDField()
    type = serializers.CharField()          # 'account' | 'vehicle'
    driver_id = serializers.UUIDField()
    driver_name = serializers.CharField()
    driver_phone = serializers.CharField()
    profile_photo = serializers.CharField(allow_null=True)
    document_type = serializers.CharField(allow_null=True)  # null for account, doc type for vehicle
    status = serializers.CharField()
    submitted_at = serializers.DateTimeField()


# ──────────────────────────────────────────────────────────────────────────────
#  ADMIN-FACING: Vehicle Verification (per-driver, left sidebar detail)
# ──────────────────────────────────────────────────────────────────────────────

class AdminVehicleVerificationDetailSerializer(serializers.Serializer):
    """
    Full vehicle verification state for one driver:
    account verification summary + list of required documents with status.
    """
    driver = AdminDriverSummarySerializer()
    account_verification_status = serializers.CharField()
    documents = AdminDriverDocumentSerializer(many=True)
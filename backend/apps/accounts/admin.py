from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import DriverProfile, OTPVerification, StudentProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['phone_number', 'full_name', 'role', 'is_verified', 'is_active', 'created_at']
    list_filter = ['role', 'is_verified', 'is_active', 'is_phone_verified']
    search_fields = ['phone_number', 'first_name', 'last_name', 'email']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_login_ip', 'data_consent_timestamp']

    fieldsets = (
        ('Identity', {'fields': ('id', 'phone_number', 'email', 'first_name', 'last_name', 'profile_photo')}),
        ('Role & Status', {'fields': ('role', 'is_active', 'is_verified', 'is_phone_verified', 'is_email_verified')}),
        ('Security', {'fields': ('password', 'failed_login_attempts', 'locked_until', 'last_login_ip')}),
        ('NDPR Consent', {'fields': ('data_consent_given', 'data_consent_timestamp')}),
        ('Permissions', {'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'first_name', 'last_name', 'role', 'password1', 'password2'),
        }),
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'matric_number', 'department', 'level', 'campus', 'wallet_balance', 'total_trips']
    search_fields = ['user__first_name', 'user__last_name', 'user__phone_number', 'matric_number']
    readonly_fields = ['wallet_balance', 'total_trips', 'total_distance_km', 'average_rating_given']


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'plate_number', 'vehicle_type', 'verification_status', 'is_online', 'total_trips']
    list_filter = ['verification_status', 'vehicle_type', 'is_online']
    search_fields = ['user__first_name', 'user__last_name', 'user__phone_number', 'plate_number']
    readonly_fields = ['total_trips', 'total_earnings', 'average_rating', 'acceptance_rate', 'cancellation_rate']
    actions = ['approve_drivers', 'suspend_drivers']

    def approve_drivers(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(
            verification_status=DriverProfile.VerificationStatus.UNDER_REVIEW
        ).update(
            verification_status=DriverProfile.VerificationStatus.APPROVED,
            verified_at=timezone.now(),
            verified_by=request.user,
        )
        self.message_user(request, f'{updated} driver(s) approved.')
    approve_drivers.short_description = 'Approve selected drivers'

    def suspend_drivers(self, request, queryset):
        updated = queryset.update(
            verification_status=DriverProfile.VerificationStatus.SUSPENDED,
            is_online=False,
        )
        self.message_user(request, f'{updated} driver(s) suspended.')
    suspend_drivers.short_description = 'Suspend selected drivers'


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ['phone_number', 'purpose', 'is_used', 'attempts', 'expires_at', 'created_at']
    list_filter = ['purpose', 'is_used']
    search_fields = ['phone_number']
    readonly_fields = ['id', 'created_at']
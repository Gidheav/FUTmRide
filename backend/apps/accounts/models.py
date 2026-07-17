import hashlib
import secrets
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from phonenumber_field.modelfields import PhoneNumberField

def user_profile_photo_path(instance, filename):
    role = instance.role.lower() if instance.role else 'user'
    now = timezone.now()
    return f"profiles/{role}/{now.year}/{now.month:02d}/{filename}"


class UserRole(models.TextChoices):
    STUDENT = 'student', 'Student'
    DRIVER = 'driver', 'Driver'
    ADMIN = 'admin', 'Super Admin'
    CAMPUS_ADMIN = 'campus_admin', 'Campus Admin'


class Campus(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campuses'
        verbose_name_plural = 'Campuses'

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, phone_number=None, password=None, **extra_fields):
        role = extra_fields.get('role', UserRole.STUDENT)
        if not phone_number:
            if role != UserRole.STUDENT or not extra_fields.get('email'):
                raise ValueError('Phone number is required.')
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMIN)
        extra_fields.setdefault('is_verified', True)
        return self.create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = PhoneNumberField(unique=True, db_index=True, null=True, blank=True)
    email = models.EmailField(unique=True, db_index=True, null=True, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.STUDENT)
    profile_photo = models.ImageField(upload_to=user_profile_photo_path, null=True, blank=True)
    home_address = models.CharField(max_length=255, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    is_phone_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    session_started_at = models.DateTimeField(null=True, blank=True)
    last_refresh_at = models.DateTimeField(null=True, blank=True)

    data_consent_given = models.BooleanField(default=False)
    data_consent_timestamp = models.DateTimeField(null=True, blank=True)

    fcm_token = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['is_active', 'is_verified']),
        ]

    def __str__(self):
        return f'{self.full_name} ({self.phone_number or "no-phone"})'

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    @property
    def is_locked(self):
        if self.locked_until and self.locked_until > timezone.now():
            return True
        return False

    def increment_failed_login(self):
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.locked_until = timezone.now() + timezone.timedelta(minutes=15)
        self.save(update_fields=['failed_login_attempts', 'locked_until'])

    def reset_failed_login(self):
        self.failed_login_attempts = 0
        self.locked_until = None
        self.save(update_fields=['failed_login_attempts', 'locked_until'])


class UserSettings(models.Model):
    OFFLINE_PIN_HASH_ALGORITHM = 'sha256-iterated-v1'
    OFFLINE_PIN_HASH_ITERATIONS = 2500

    class ThemeMode(models.TextChoices):
        SYSTEM = 'system', 'System'
        LIGHT = 'light', 'Light'
        DARK = 'dark', 'Dark'

    class NavigationApp(models.TextChoices):
        GOOGLE_MAPS = 'google_maps', 'Google Maps'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    language = models.CharField(max_length=10, default='en')
    theme_mode = models.CharField(max_length=10, choices=ThemeMode.choices, default=ThemeMode.SYSTEM)
    push_enabled = models.BooleanField(default=False)
    
    # Email notification toggles
    email_announcements = models.BooleanField(
        default=False,
        help_text='Send email when an in-app announcement is broadcast.',
    )
    email_transactions = models.BooleanField(
        default=False,
        help_text='Send email for wallet top-ups, payments, and deductions.',
    )
    email_rides = models.BooleanField(
        default=False,
        help_text='Send email for ride status updates (assigned, started, completed).',
    )
    
    # Detailed push notification toggles
    notif_sound_enabled = models.BooleanField(default=False)
    notif_ride_requested = models.BooleanField(default=False)
    notif_driver_assigned = models.BooleanField(default=False)
    notif_driver_en_route = models.BooleanField(default=False)
    notif_driver_arrived = models.BooleanField(default=False)
    notif_trip_started = models.BooleanField(default=False)
    notif_trip_completed = models.BooleanField(default=False)
    notif_ride_cancelled = models.BooleanField(default=False)
    notif_wallet_credit = models.BooleanField(default=False)
    notif_wallet_debit = models.BooleanField(default=False)
    notif_promotions = models.BooleanField(default=False)

    navigation_app = models.CharField(
        max_length=30,
        choices=NavigationApp.choices,
        default=NavigationApp.GOOGLE_MAPS,
    )
    biometric_enabled = models.BooleanField(default=False)

    two_factor_enabled = models.BooleanField(default=False)
    two_factor_methods = models.JSONField(default=list, blank=True)
    totp_secret = models.CharField(max_length=64, blank=True)
    totp_confirmed_at = models.DateTimeField(null=True, blank=True)
    backup_codes = models.JSONField(default=list, blank=True)

    pin_hash = models.CharField(max_length=128, blank=True)
    pin_updated_at = models.DateTimeField(null=True, blank=True)
    offline_pin_salt = models.CharField(max_length=64, blank=True)
    offline_pin_hash = models.CharField(max_length=64, blank=True)
    offline_pin_iterations = models.PositiveIntegerField(default=OFFLINE_PIN_HASH_ITERATIONS)

    active_device_id = models.CharField(max_length=128, blank=True)
    active_device_platform = models.CharField(max_length=40, blank=True)
    active_device_name = models.CharField(max_length=120, blank=True)
    active_device_last_seen = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_settings'

    def __str__(self):
        return f'UserSettings({self.user_id})'

    @classmethod
    def build_offline_pin_hash(cls, pin: str, salt: str, user_id: str, iterations=None) -> str:
        rounds = int(iterations or cls.OFFLINE_PIN_HASH_ITERATIONS)
        digest = str(pin)
        for index in range(rounds):
            raw = f'{salt}:{user_id}:{index}:{digest}'.encode('utf-8')
            digest = hashlib.sha256(raw).hexdigest()
        return digest

    def set_offline_pin_verifier(self, pin: str) -> None:
        self.offline_pin_salt = secrets.token_hex(16)
        self.offline_pin_iterations = self.OFFLINE_PIN_HASH_ITERATIONS
        self.offline_pin_hash = self.build_offline_pin_hash(
            pin,
            self.offline_pin_salt,
            str(self.user_id),
            self.offline_pin_iterations,
        )

    def get_offline_pin_verifier(self):
        if not (self.pin_hash and self.offline_pin_salt and self.offline_pin_hash):
            return None
        return {
            'algorithm': self.OFFLINE_PIN_HASH_ALGORITHM,
            'salt': self.offline_pin_salt,
            'hash': self.offline_pin_hash,
            'iterations': self.offline_pin_iterations,
            'user_id': str(self.user_id),
            'updated_at': self.pin_updated_at.isoformat() if self.pin_updated_at else None,
        }


class IntegrationSettings(models.Model):
    """
    Singleton model for platform integrations configuration (non-secret toggles).
    Secrets remain in environment variables and are not stored here.
    """

    class PaymentGateway(models.TextChoices):
        PAYSTACK = 'paystack', 'Paystack'
        FLUTTERWAVE = 'flutterwave', 'Flutterwave'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payments_enabled = models.BooleanField(default=True)
    payments_primary_gateway = models.CharField(
        max_length=20,
        choices=PaymentGateway.choices,
        default=PaymentGateway.PAYSTACK,
    )
    paystack_enabled = models.BooleanField(default=True)
    flutterwave_enabled = models.BooleanField(default=True)
    notifications_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)
    fcm_enabled = models.BooleanField(default=True)
    expo_enabled = models.BooleanField(default=True)
    routing_enabled = models.BooleanField(default=True)
    auth_google_enabled = models.BooleanField(default=False)
    auth_apple_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='integration_settings_updates',
    )

    class Meta:
        db_table = 'integration_settings'
        verbose_name = 'Integration Settings'
        verbose_name_plural = 'Integration Settings'

    def __str__(self):
        return 'IntegrationSettings'

    @classmethod
    def load(cls):
        obj, _created = cls.objects.get_or_create(defaults={})
        return obj


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    matric_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    department = models.CharField(max_length=150, blank=True)
    level = models.PositiveSmallIntegerField(null=True, blank=True)
    campus = models.ForeignKey(Campus, on_delete=models.SET_NULL, null=True, related_name='students')
    wallet_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_trips = models.PositiveIntegerField(default=0)
    total_distance_km = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    average_rating_given = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_profiles'

    def __str__(self):
        return f'StudentProfile({self.user.full_name})'


class CampusAdminProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='campus_admin_profile')
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name='campus_admins')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'campus_admin_profiles'

    def __str__(self):
        return f'{self.user.full_name} ({self.campus.name})'


class DriverProfile(models.Model):
    class VehicleType(models.TextChoices):
        MOTORBIKE = 'motorbike', 'Motorbike'
        TRICYCLE = 'tricycle', 'Tricycle'
        SEDAN = 'sedan', 'Sedan'
        MPV = 'mpv', 'MPV'
        MINIBUS = 'minibus', 'Minibus'
        COACH = 'coach', 'Coach'

    class MaintenanceStatus(models.TextChoices):
        ACTIVE = 'active', 'Active'
        IN_SERVICE = 'in_service', 'In-Service'
        GROUNDED = 'grounded', 'Grounded'
        IN_SHOP = 'in_shop', 'In Shop'

    class VerificationStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        UNDER_REVIEW = 'under_review', 'Under Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        SUSPENDED = 'suspended', 'Suspended'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    vehicle_type = models.CharField(max_length=20, choices=VehicleType.choices)
    vehicle_make = models.CharField(max_length=80)
    vehicle_model = models.CharField(max_length=80)
    vehicle_year = models.PositiveSmallIntegerField()
    vehicle_color = models.CharField(max_length=40)
    plate_number = models.CharField(max_length=20, unique=True)
    vehicle_seats = models.PositiveSmallIntegerField(default=4)
    campus = models.ForeignKey(Campus, on_delete=models.SET_NULL, null=True, related_name='drivers')

    maintenance_status = models.CharField(
        max_length=20,
        choices=MaintenanceStatus.choices,
        default=MaintenanceStatus.ACTIVE,
        db_index=True,
    )
    last_service_date = models.DateField(null=True, blank=True)
    service_due_date = models.DateField(null=True, blank=True)
    odometer_km = models.PositiveIntegerField(default=0)

    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )
    verification_notes = models.TextField(blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_drivers',
    )

    is_online = models.BooleanField(default=False, db_index=True)
    is_on_trip = models.BooleanField(default=False)

    wallet_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    daily_goal_target = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_earnings = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)

    total_trips = models.PositiveIntegerField(default=0)
    total_distance_km = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    acceptance_rate = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)
    cancellation_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'driver_profiles'
        indexes = [
            models.Index(fields=['is_online', 'verification_status']),
            models.Index(fields=['vehicle_type']),
        ]

    def __str__(self):
        return f'DriverProfile({self.user.full_name} - {self.plate_number})'

    @property
    def is_eligible_to_accept_rides(self):
        return (
            self.verification_status == self.VerificationStatus.APPROVED
            and self.is_online
            and not self.is_on_trip
            and self.user.is_active
        )


class OTPVerification(models.Model):
    class Purpose(models.TextChoices):
        PHONE_VERIFICATION = 'phone_verification', 'Phone Verification'
        LOGIN = 'login', 'Login'
        PASSWORD_RESET = 'password_reset', 'Password Reset'
        TRANSACTION_PIN = 'transaction_pin', 'Transaction PIN'
        TWO_FACTOR = 'two_factor', 'Two-Factor Auth'
        EMAIL_CHANGE = 'email_change', 'Email Change'
        PASSWORD_CHANGE = 'password_change', 'Password Change'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otp_verifications')
    phone_number = PhoneNumberField(null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=30, choices=Purpose.choices)
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'otp_verifications'
        indexes = [
            models.Index(fields=['phone_number', 'purpose', 'is_used']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f'OTP({self.phone_number} - {self.purpose})'

    @property
    def is_valid(self):
        return not self.is_used and self.expires_at > timezone.now() and self.attempts < 3


class StudentSignupVerificationSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=6)
    code_expires_at = models.DateTimeField(db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    is_verified = models.BooleanField(default=False, db_index=True)
    verification_token = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    verification_token_expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_signup_verification_sessions'
        indexes = [
            models.Index(fields=['email', 'is_verified', 'consumed_at'], name='student_sig_email_05fc90_idx'),
            models.Index(fields=['created_at'], name='student_sig_created_ca0d82_idx'),
        ]

    def __str__(self):
        return f'StudentSignupSession({self.email}, verified={self.is_verified})'

    @property
    def is_code_valid(self):
        return self.code_expires_at > timezone.now() and self.attempts < 3


class MapSettings(models.Model):
    """
    Singleton model for Map and GIS configurations.
    """
    class MapProvider(models.TextChoices):
        GOOGLE = 'google', 'Google Maps'
        MAPBOX = 'mapbox', 'Mapbox GL'
        OSRM = 'osrm', 'OSRM Self-Hosted'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Map Provider
    active_provider = models.CharField(max_length=20, choices=MapProvider.choices, default=MapProvider.GOOGLE)
    custom_style_json = models.TextField(
        default='[\n  {\n    "featureType": "landscape.man_made",\n    "elementType": "geometry.fill",\n    "stylers": [{"color": "#f9f9f9"}]\n  },\n  {\n    "featureType": "poi.business",\n    "stylers": [{"visibility": "off"}]\n  }\n]', 
        blank=True
    )
    
    # Real-time Layers
    live_traffic_enabled = models.BooleanField(default=True)
    demand_heatmaps_enabled = models.BooleanField(default=True)
    driver_clustering_enabled = models.BooleanField(default=False)
    
    # Refresh Interval
    refresh_interval_seconds = models.IntegerField(default=15)
    
    # Routing Engine Weights
    prefer_main_roads_weight = models.IntegerField(default=85)
    avoid_pedestrian_weight = models.IntegerField(default=95)
    speed_limit_enforcement_weight = models.IntegerField(default=50)
    
    # Buffer Zones
    geofence_buffer_meters = models.IntegerField(default=50)
    
    # POI
    pois = models.JSONField(default=list, blank=True)
    
    # Visual Marker Customization
    idle_driver_icon = models.CharField(max_length=50, default='Standard Car (Green)')
    cluster_threshold_zoom = models.IntegerField(default=14)
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'map_settings'
        verbose_name = 'Map Settings'
        verbose_name_plural = 'Map Settings'

    def __str__(self):
        return 'MapSettings'

    @classmethod
    def load(cls):
        obj, _created = cls.objects.get_or_create(defaults={})
        return obj


class AuditLog(models.Model):
    """Immutable record of sensitive admin and payment actions."""

    class Action(models.TextChoices):
        LOGIN = 'login', 'Login'
        LOGOUT = 'logout', 'Logout'
        PASSWORD_CHANGE = 'password_change', 'Password Change'
        ROLE_CHANGE = 'role_change', 'Role Change'
        WALLET_CREDIT = 'wallet_credit', 'Wallet Credit'
        WALLET_DEBIT = 'wallet_debit', 'Wallet Debit'
        PAYMENT_WEBHOOK = 'payment_webhook', 'Payment Webhook'
        INTEGRATION_UPDATE = 'integration_update', 'Integration Update'
        USER_UPDATE = 'user_update', 'User Update'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs',
    )
    action = models.CharField(max_length=40, choices=Action.choices, db_index=True)
    target_type = models.CharField(max_length=80, blank=True)
    target_id = models.CharField(max_length=64, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', 'created_at'], name='audit_logs_action_created_idx'),
        ]

    def __str__(self):
        return f'AuditLog({self.action} {self.created_at})'

import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from phonenumber_field.modelfields import PhoneNumberField


class UserRole(models.TextChoices):
    STUDENT = 'student', 'Student'
    DRIVER = 'driver', 'Driver'
    ADMIN = 'admin', 'Admin'


class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
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
    phone_number = PhoneNumberField(unique=True, db_index=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.STUDENT)
    profile_photo = models.ImageField(upload_to='profiles/%Y/%m/', null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    is_phone_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

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
        return f'{self.full_name} ({self.phone_number})'

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


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    matric_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    department = models.CharField(max_length=150, blank=True)
    level = models.PositiveSmallIntegerField(null=True, blank=True)
    campus = models.CharField(max_length=100, default='Gidan Kwano')
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


class DriverProfile(models.Model):
    class VehicleType(models.TextChoices):
        MOTORCYCLE = 'motorcycle', 'Motorcycle'
        TRICYCLE = 'tricycle', 'Tricycle (Keke)'
        SEDAN = 'sedan', 'Sedan'
        SUV = 'suv', 'SUV'
        MINIVAN = 'minivan', 'Minivan / Shuttle'

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

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otp_verifications')
    phone_number = PhoneNumberField()
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
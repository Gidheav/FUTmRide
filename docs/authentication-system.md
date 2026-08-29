# Authentication & Authorization System Documentation

## Overview

The LR Ride platform implements a comprehensive JWT-based authentication and authorization system that secures all admin panel endpoints and maintains role-based access control (RBAC). The system is designed with enterprise-grade security measures, session management, and multi-factor authentication capabilities.

## Architecture

### Core Components

- **Backend**: Django REST Framework with JWT authentication via `rest_framework_simplejwt`
- **Frontend**: React with Zustand state management and Axios interceptors
- **Token Storage**: SessionStorage for primary tokens with localStorage migration support
- **WebSocket Authentication**: Custom middleware supporting both header and query-based token transmission
- **Security Layers**: Rate limiting, throttling, CSP headers, and IP-based restrictions

## File Locations

### Backend Authentication Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Authentication Views | `backend/apps/accounts/views.py` | Login, logout, token refresh, OTP handling |
| Authentication Serializers | `backend/apps/accounts/serializers.py` | Token validation, user payload construction |
| User Models | `backend/apps/accounts/models.py` | User, UserSettings, AuditLog models |
| Permissions | `backend/apps/accounts/permissions.py` | Role-based access control classes |
| Authentication URLs | `backend/apps/accounts/urls_auth.py` | Authentication endpoint routing |
| JWT Configuration | `backend/core/settings/base.py` | Token lifetimes, algorithms, signing keys |
| WebSocket Auth | `backend/core/ws_auth.py` | WebSocket authentication middleware |
| Security Middleware | `backend/core/middleware.py` | Rate limiting, CSP, desktop-only enforcement |
| Rate Throttling | `backend/core/throttles.py` | Authentication-specific rate limiting |
| Audit Logging | `backend/apps/accounts/audit.py` | Security event audit trail |
| OTP Services | `backend/apps/accounts/services.py` | SMS OTP generation and verification |

### Frontend Authentication Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Auth Store | `frontend/src/core/authStore.ts` | Zustand authentication state management |
| Token Storage | `frontend/src/core/tokenStorage.ts` | Token persistence and migration logic |
| API Client | `frontend/src/core/api.ts` | Axios instance with interceptors |
| Services | `frontend/src/services/api.service.ts` | API service layer |

## JWT Token Flow

### Token Lifecycle

```
┌─────────────────┐
│   User Login    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  POST /auth/login/          │
│  - Email/Phone + Password   │
│  - 2FA challenge if enabled │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Token Response             │
│  - access_token (60 min)     │
│  - refresh_token (14 days)  │
│  - user payload             │
│  - user settings            │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Frontend Storage           │
│  - sessionStorage (primary) │
│  - localStorage (legacy)    │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  API Requests               │
│  - Bearer token in header   │
│  - Auto-refresh on 401      │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Token Refresh              │
│  POST /auth/token/refresh/  │
│  - New access token         │
│  - Session validation       │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Logout                     │
│  - Blacklist refresh token  │
│  - Clear FCM token          │
│  - Clear frontend storage   │
└─────────────────────────────┘
```

### Token Configuration

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env("JWT_SECRET_KEY", default=env("SECRET_KEY")),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}
```

### Session Management

- **Maximum Session Age**: 14 days (configurable via `SESSION_MAX_AGE_DAYS`)
- **Session Tracking**: `session_started_at`, `last_refresh_at` fields on User model
- **Session Validation**: Checked during token refresh to enforce maximum session duration
- **Forced Logout**: Triggers when refresh token expires, is revoked, or session exceeds max age

## User Roles & Permissions

### Role Hierarchy

```python
class UserRole(models.TextChoices):
    STUDENT = 'student', 'Student'
    DRIVER = 'driver', 'Driver'
    ADMIN = 'admin', 'Super Admin'
    CAMPUS_ADMIN = 'campus_admin', 'Campus Admin'
```

### Permission Classes

| Permission Class | Description | Allowed Roles |
|------------------|-------------|---------------|
| `IsAdminUser` | Super admin access | `admin` |
| `IsCampusAdminUser` | Campus-specific admin access | `campus_admin` |
| `IsAdminOrCampusAdmin` | Combined admin access | `admin`, `campus_admin` |
| `IsDriverUser` | Driver-specific access | `driver` |
| `IsStudentUser` | Student-specific access | `student` |
| `IsOwnerOrAdmin` | Resource ownership | Resource owner + `admin` |
| `IsPhoneVerified` | Phone verification required | Any authenticated with verified phone |

### Permission Implementation

```python
class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )
```

## Authentication Endpoints

### Public Endpoints (No Authentication Required)

```
POST /api/v1/auth/register/request-email-otp/  # Student email verification request
POST /api/v1/auth/register/verify-email-otp/  # Student email verification confirmation
POST /api/v1/auth/register/                   # User registration
POST /api/v1/auth/login/                      # User login
POST /api/v1/auth/otp/request/                # OTP request
POST /api/v1/auth/otp/verify/                 # OTP verification
POST /api/v1/auth/password-reset/request/    # Password reset request
POST /api/v1/auth/password-reset/confirm/     # Password reset confirmation
POST /api/v1/auth/token/refresh/               # Token refresh
```

### Protected Endpoints (Authentication Required)

```
POST /api/v1/auth/logout/                     # User logout
POST /api/v1/auth/change-password/            # Password change
POST /api/v1/auth/settings/preferences/       # User preferences
POST /api/v1/auth/settings/pin/set/           # Transaction PIN setup
POST /api/v1/auth/settings/pin/verify/        # Transaction PIN verification
POST /api/v1/auth/settings/2fa/start/         # 2FA setup initiation
POST /api/v1/auth/settings/2fa/confirm/       # 2FA setup confirmation
POST /api/v1/auth/settings/2fa/disable/       # 2FA disabling
POST /api/v1/auth/2fa/request/                # 2FA challenge request
POST /api/v1/auth/2fa/verify/                 # 2FA challenge verification
```

## Login Flow Implementation

### Backend Login Serializer (`FutminnaTokenObtainPairSerializer`)

```python
class FutminnaTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "phone_number"
    phone_number = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    
    student_email_regex = re.compile(r"^[A-Za-z]+\.[mM]\d+@st\.futminna\.edu\.ng$")
```

### Login Validation Process

1. **Credential Input Validation**
   - Students must use university email (`name.m1234567@st.futminna.edu.ng`)
   - Other roles use phone number
   - Email validation regex enforced for students

2. **User Retrieval with Optimization**
   ```python
   _USER_SELECT_RELATED = (
       'student_profile__campus',
       'driver_profile__campus',
       'campus_admin_profile__campus',
   )
   ```
   - Uses `select_related` to prevent N+1 queries
   - Retrieves profile and campus data in single query

3. **Security Checks**
   - Account lockout status (`is_locked`)
   - Failed login attempt counter
   - Account activation status (`is_active`)
   - Password verification with BCrypt/Argon2

4. **Two-Factor Authentication**
   - Checks `two_factor_enabled` setting
   - Returns challenge token if 2FA is active
   - Requires completion before token issuance

5. **Token Generation**
   - Creates JWT access and refresh tokens
   - Updates login metadata (IP, timestamp)
   - Resets failed login counter on success

### Frontend Login Integration

```typescript
// Axios interceptor for automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as any
    if (error.response?.status === 401 && !original._retry && !isPublicAuthPath(original?.url)) {
      original._retry = true
      const refresh = getRefreshToken()
      if (refresh) {
        try {
          const res = await axios.post(`${BASE_URL}auth/token/refresh/`, { refresh })
          const token = res.data.access
          setTokens(token, refresh)
          if (original.headers) original.headers.Authorization = `Bearer ${token}`
          return api(original)
        } catch {
          clearTokens()
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
```

## Token Refresh Mechanism

### Backend Refresh Logic (`SessionTokenRefreshSerializer`)

```python
class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user_id = refresh.get("user_id")
        
        # User validation
        user = User.objects.get(id=user_id)
        
        # Session age validation
        session_started_at = user.session_started_at or user.last_login or user.created_at
        max_age = timedelta(days=getattr(settings, "SESSION_MAX_AGE_DAYS", 14))
        if session_started_at and now - session_started_at > max_age:
            raise serializers.ValidationError({
                "error": {
                    "code": "SESSION_EXPIRED",
                    "message": "Your session has expired. Please log in again.",
                }
            })
        
        # Update session metadata
        user.last_refresh_at = timezone.now()
        user.save(update_fields=['last_refresh_at'])
        
        return data
```

### Token Storage Strategy

```typescript
// Prefer sessionStorage for security (cleared on tab close)
export function setTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.setItem(ACCESS_KEY, accessToken)
  sessionStorage.setItem(REFRESH_KEY, refreshToken)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Migration support for legacy localStorage tokens
export function migrateLegacyTokens(): void {
  const legacyAccess = localStorage.getItem(ACCESS_KEY)
  const legacyRefresh = localStorage.getItem(REFRESH_KEY)
  if (legacyAccess && legacyRefresh && !sessionStorage.getItem(ACCESS_KEY)) {
    setTokens(legacyAccess, legacyRefresh)
  }
}
```

## WebSocket Authentication

### Token-Based WebSocket Auth

```python
class TokenAuthMiddleware:
    """Authenticate WebSockets via Authorization header (preferred) or legacy ?token= query."""
    
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        token = _extract_bearer_token(scope.get('headers', []))
        
        if not token:
            query_string = scope.get('query_string', b'').decode()
            query = parse_qs(query_string)
            if 'token' in query and query['token']:
                token = query['token'][0]
        
        if token:
            try:
                scope['user'] = await _get_user(token)
            except Exception:
                scope['user'] = AnonymousUser()
        
        return await self.app(scope, receive, send)
```

### Token Extraction Methods

1. **Authorization Header** (Preferred): `Bearer <token>`
2. **WebSocket Protocol**: `access_token.<token>`
3. **Query Parameter** (Legacy): `?token=<token>`

## Security Features

### Rate Limiting

#### Authentication-Specific Rate Limits

```python
RATE_LIMIT_RULES = {
    "/api/v1/auth/login/": (120, 60),      # 120 requests per minute
    "/api/v1/auth/register/": (60, 300),   # 60 requests per 5 minutes
    "/api/v1/auth/otp/": (60, 300),        # 60 requests per 5 minutes
    "/api/v1/auth/otp/verify/": (120, 300), # 120 requests per 5 minutes
    "/api/v1/auth/pin/verify/": (120, 300), # 120 requests per 5 minutes
    "/api/v1/auth/password/reset/": (60, 300), # 60 requests per 5 minutes
}
```

#### Rate Limit Key Construction

```python
def _build_key(self, request, window):
    ip = self._get_ip(request)
    identifier = self._identifier_from_request(request)
    return f"rl:{request.path}:{ip}:{identifier}:{window}"

def _identifier_from_request(self, request) -> str:
    if request.method not in {"POST", "PUT", "PATCH"}:
        return "request"
    try:
        data = json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return "request"
    for key in ("phone_number", "email", "identifier", "refresh"):
        value = str(data.get(key) or "").strip().lower()
        if value:
            return value[:120]
    return "request"
```

### Account Lockout

```python
def increment_failed_login(self):
    self.failed_login_attempts += 1
    if self.failed_login_attempts >= 5:
        self.locked_until = timezone.now() + timezone.timedelta(minutes=15)
    self.save(update_fields=['failed_login_attempts', 'locked_until'])

@property
def is_locked(self):
    if self.locked_until and self.locked_until > timezone.now():
        return True
    return False
```

### Security Headers

```python
class SecurityHeadersMiddleware:
    def __call__(self, request):
        response = self.get_response(request)
        if getattr(settings, 'DEBUG', False):
            return response
        
        csp = getattr(
            settings,
            'CONTENT_SECURITY_POLICY',
            "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        )
        response['Content-Security-Policy'] = csp
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        return response
```

### Password Hashing

```python
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
]
```

## Two-Factor Authentication (2FA)

### 2FA Configuration

```python
class UserSettings(models.Model):
    two_factor_enabled = models.BooleanField(default=False)
    two_factor_methods = models.JSONField(default=list, blank=True)
    totp_confirmed_at = models.DateTimeField(null=True, blank=True)
```

### 2FA Flow

1. **Setup Phase**
   - User initiates 2FA via `POST /auth/settings/2fa/start/`
   - System generates TOTP secret
   - User confirms via `POST /auth/settings/2fa/confirm/`

2. **Login Challenge**
   - If 2FA enabled, login returns challenge token
   - User must complete 2FA via `POST /auth/2fa/verify/`
   - Successful verification completes token issuance

3. **Management**
   - Disable via `POST /auth/settings/2fa/disable/`
   - Challenge request via `POST /auth/2fa/request/`

## OTP System

### OTP Purposes

```python
class Purpose(models.TextChoices):
    PHONE_VERIFICATION = 'phone_verification', 'Phone Verification'
    LOGIN = 'login', 'Login'
    PASSWORD_RESET = 'password_reset', 'Password Reset'
    TRANSACTION_PIN = 'transaction_pin', 'Transaction PIN'
    TWO_FACTOR = 'two_factor', 'Two-Factor Auth'
    EMAIL_CHANGE = 'email_change', 'Email Change'
    PASSWORD_CHANGE = 'password_change', 'Password Change'
```

### OTP Generation & Delivery

```python
class OTPService:
    @classmethod
    def create_and_send(cls, user: User, purpose: str) -> OTPVerification:
        # Invalidate existing unused OTPs
        OTPVerification.objects.filter(
            user=user,
            purpose=purpose,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).update(is_used=True)
        
        # Generate new OTP
        code = cls.generate_code()
        expiry = timezone.now() + timezone.timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        
        otp = OTPVerification.objects.create(
            user=user,
            phone_number=user.phone_number,
            code=code,
            purpose=purpose,
            expires_at=expiry,
        )
        
        # Send via SMS
        message = cls._compose_message(code, purpose)
        SMSService.send(str(user.phone_number), message)
        return otp
```

### OTP Verification

```python
@staticmethod
def verify(phone_number: str, code: str, purpose: str) -> tuple:
    try:
        otp = OTPVerification.objects.filter(
            phone_number=phone_number,
            purpose=purpose,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).latest('created_at')
    except OTPVerification.DoesNotExist:
        return False, 'No valid code found. Please request a new one.'
    
    if not otp.is_valid:
        return False, 'Code has expired or been used. Please request a new one.'
    
    if otp.code != code:
        otp.attempts += 1
        otp.save(update_fields=['attempts'])
        remaining = max(0, 3 - otp.attempts)
        return False, f'Invalid code. {remaining} attempt(s) remaining.'
    
    otp.is_used = True
    otp.save(update_fields=['is_used'])
    return True, 'Verified successfully.'
```

## Audit Logging

### Audit Events

```python
class Action(models.TextChoices):
    LOGIN = 'login', 'Login'
    LOGOUT = 'logout', 'Logout'
    PASSWORD_CHANGE = 'password_change', 'Password Change'
    ROLE_CHANGE = 'role_change', 'Role Change'
    WALLET_CREDIT = 'wallet_credit', 'Wallet Credit'
    WALLET_DEBIT = 'wallet_debit', 'Wallet Debit'
    PAYMENT_WEBHOOK = 'payment_webhook', 'Payment Webhook'
    INTEGRATION_UPDATE = 'integration_update', 'Integration Update'
    MAP_CONFIG_UPDATE = 'map_config_update', 'Map Config Update'
    USER_UPDATE = 'user_update', 'User Update'
    OTHER = 'other', 'Other'
```

### Audit Implementation

```python
def log_audit(
    request,
    action: str,
    *,
    target_type: str = '',
    target_id: str = '',
    metadata: dict | None = None,
    actor=None,
):
    if actor is None and request is not None:
        actor = getattr(request, 'user', None)
        if actor is not None and not getattr(actor, 'is_authenticated', False):
            actor = None
    try:
        AuditLog.objects.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else '',
            ip_address=get_client_ip(request) if request else None,
            metadata=metadata or {},
        )
    except Exception:
        logger.exception('audit_log_write_failed action=%s', action)
```

## User Profile & Campus Integration

### User-Campus Relationships

```python
class Campus(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
```

### Profile-Campus Mapping

```python
def _build_user_payload(user: User) -> dict:
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
```

## Frontend State Management

### Zustand Auth Store

```typescript
interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  updateUser: (updates: Partial<AuthUser>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        setTokens(accessToken, refreshToken)
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearAuth: () => {
        clearTokens()
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'futminna-ride-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
```

## Logout Process

### Backend Logout Implementation

```python
class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            # Clear push token so this user stops receiving notifications
            if request.user.fcm_token:
                request.user.fcm_token = None
                request.user.save(update_fields=['fcm_token'])

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
```

### Frontend Logout Flow

1. Call `POST /auth/logout/` with refresh token
2. Backend blacklists the refresh token
3. Frontend clears token storage
4. Frontend clears Zustand auth state
5. Redirect to login page

## Configuration & Environment Variables

### Required Environment Variables

```bash
# Core Authentication
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key  # Falls back to SECRET_KEY if not set

# OTP Configuration
OTP_EXPIRY_MINUTES=10  # Default OTP validity period

# Session Configuration
SESSION_MAX_AGE_DAYS=14  # Maximum session duration

# Rate Limiting
RATE_LIMIT_ENABLED=true
AUTH_THROTTLE_ENABLED=true

# SMS Integration (Termii)
TERMII_API_KEY=your-termii-api-key
TERMII_SENDER_ID=FUTMINNA

# Email Configuration
DEFAULT_FROM_EMAIL=noreply@futminna.edu.ng
```

## Security Best Practices

### Implemented Security Measures

1. **Token Security**
   - Short-lived access tokens (60 minutes)
   - Refresh token rotation
   - Token blacklisting on logout
   - HTTP-only cookie support for future implementation

2. **Rate Limiting**
   - IP-based rate limiting
   - User identifier-based limiting
   - Authentication-specific throttling
   - Configurable rate limits per endpoint

3. **Account Security**
   - Failed login attempt tracking
   - Automatic account lockout (5 attempts = 15 min lock)
   - Phone verification requirements
   - Email verification for students

4. **Session Security**
   - Maximum session age enforcement
   - Session activity tracking
   - Automatic session invalidation
   - Secure token storage (sessionStorage preference)

5. **Network Security**
   - HTTPS enforcement in production
   - CORS configuration
   - Content Security Policy headers
   - Permissions policy headers

### Recommended Security Enhancements

1. **Token Storage**: Implement HTTP-only cookies for refresh tokens
2. **Device Fingerprinting**: Add device fingerprinting for anomaly detection
3. **Geo-fencing**: Implement location-based access restrictions
4. **Biometric Auth**: Extend 2FA with biometric verification
5. **Session Analytics**: Add session analytics for security monitoring

## Monitoring & Debugging

### Authentication Logging

```python
logger.info('login_completed user_id=%s role=%s elapsed_ms=%.1f', str(user.id), user.role, _elapsed)
logger.warning('otp_wrong_code phone=%s purpose=%s', phone_number, purpose)
logger.warning('rate_limit_exceeded path=%s ip=%s', request.path, self._get_ip(request))
```

### Audit Trail Access

Audit logs are stored in the `AuditLog` model and can be queried for:
- Login/logout events
- Password changes
- Role modifications
- Financial transactions
- Configuration changes

## Troubleshooting

### Common Issues

1. **Token Refresh Failures**
   - Check session age vs `SESSION_MAX_AGE_DAYS`
   - Verify refresh token not blacklisted
   - Ensure user account is active

2. **Authentication Loop**
   - Verify token storage mechanism
   - Check for localStorage/sessionStorage conflicts
   - Review axios interceptor configuration

3. **Rate Limiting Issues**
   - Check rate limit configuration
   - Verify cache backend connectivity
   - Review IP address detection

4. **2FA Problems**
   - Verify TOTP secret generation
   - Check time synchronization
   - Review 2FA challenge token validity

## API Integration Examples

### Login Request

```bash
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+2348012345678",
    "password": "securepassword123"
  }'
```

### Token Refresh Request

```bash
curl -X POST http://localhost:8000/api/v1/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
  }'
```

### Authenticated Request

```bash
curl -X GET http://localhost:8000/api/v1/users/me/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
```

## Conclusion

The LR Ride authentication system provides a robust, enterprise-grade security foundation with comprehensive JWT-based authentication, role-based authorization, multi-factor authentication support, and extensive security monitoring. The system is designed to scale while maintaining security best practices and providing excellent user experience across web, mobile, and admin interfaces.

For questions or issues related to authentication, refer to the component-specific file locations outlined in this documentation or consult the development team.
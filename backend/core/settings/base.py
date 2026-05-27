import environ
from pathlib import Path
from datetime import timedelta

env = environ.Env(DEBUG=(bool, False))
BASE_DIR = Path(__file__).resolve().parent.parent.parent
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
    "django_celery_beat",
    "django_celery_results",
    "anymail",
]
LOCAL_APPS = [
    "apps.accounts",
    "apps.rides",
    "apps.payments",
    "apps.ratings",
    "apps.verification",
    "apps.tracking",
    "apps.notifications",
    "apps.analytics",
    "apps.support",
    "apps.pricing",
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.RateLimitMiddleware",
]

ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"
ASGI_APPLICATION = "core.asgi.application"
AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardResultsPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env("JWT_SECRET_KEY", default=env("SECRET_KEY")),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SESSION_MAX_AGE_DAYS = 14

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:8002",
])
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "accept", "accept-encoding", "authorization", "content-type",
    "dnt", "origin", "user-agent", "x-csrftoken", "x-requested-with",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True
PHONENUMBER_DEFAULT_REGION = "NG"

STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
STATIC_ROOT = BASE_DIR / "staticfiles"

CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Africa/Lagos"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300
CELERY_RESULT_BACKEND = "django-db"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_BEAT_SCHEDULE = {
    "reconcile-paystack-pending": {
        "task": "apps.payments.tasks.reconcile_paystack_pending",
        "schedule": 300.0,
    },
    "reconcile-flutterwave-pending": {
        "task": "apps.payments.tasks.reconcile_flutterwave_pending",
        "schedule": 300.0,
    },
}

PAYSTACK_SECRET_KEY = env("PAYSTACK_SECRET_KEY", default="")
PAYSTACK_PUBLIC_KEY = env("PAYSTACK_PUBLIC_KEY", default="")
PAYSTACK_WEBHOOK_IP_ALLOWLIST = env.list("PAYSTACK_WEBHOOK_IP_ALLOWLIST", default=[])
PAYSTACK_WEBHOOK_REPLAY_WINDOW_MINUTES = env.int("PAYSTACK_WEBHOOK_REPLAY_WINDOW_MINUTES", default=60)
PAYSTACK_WEBHOOK_MAX_SKEW_MINUTES = env.int("PAYSTACK_WEBHOOK_MAX_SKEW_MINUTES", default=10)
PAYSTACK_RECONCILE_AFTER_MINUTES = env.int("PAYSTACK_RECONCILE_AFTER_MINUTES", default=10)
FLUTTERWAVE_SECRET_KEY = env("FLUTTERWAVE_SECRET_KEY", default="")
FLUTTERWAVE_PUBLIC_KEY = env("FLUTTERWAVE_PUBLIC_KEY", default="")
FLUTTERWAVE_WEBHOOK_SECRET = env("FLUTTERWAVE_WEBHOOK_SECRET", default="")
FLUTTERWAVE_WEBHOOK_SECRET_HASH = env("FLUTTERWAVE_WEBHOOK_SECRET_HASH", default="")
FLUTTERWAVE_WEBHOOK_IP_ALLOWLIST = env.list("FLUTTERWAVE_WEBHOOK_IP_ALLOWLIST", default=[])
FLUTTERWAVE_WEBHOOK_REPLAY_WINDOW_MINUTES = env.int("FLUTTERWAVE_WEBHOOK_REPLAY_WINDOW_MINUTES", default=60)
FLUTTERWAVE_WEBHOOK_MAX_SKEW_MINUTES = env.int("FLUTTERWAVE_WEBHOOK_MAX_SKEW_MINUTES", default=10)
FLUTTERWAVE_RECONCILE_AFTER_MINUTES = env.int("FLUTTERWAVE_RECONCILE_AFTER_MINUTES", default=10)
TERMII_API_KEY = env("TERMII_API_KEY", default="")
TERMII_BASE_URL = env("TERMII_BASE_URL", default="https://api.ng.termii.com/api")
TERMII_SENDER_ID = env("TERMII_SENDER_ID", default="LRRIDE")
FCM_SERVER_KEY = env("FCM_SERVER_KEY", default="")
ENABLE_PUSH_IN_DEBUG = env.bool("ENABLE_PUSH_IN_DEBUG", default=False)
SHOW_API_EXCEPTION_DETAILS = env.bool("SHOW_API_EXCEPTION_DETAILS", default=False)

RIDE_REQUEST_TIMEOUT_SECONDS = 120
MAX_DRIVER_SEARCH_RADIUS_KM = 5.0
PLATFORM_COMMISSION_RATE = 0.15

LOGIN_ATTEMPT_LIMIT = 5
LOGIN_LOCKOUT_DURATION_MINUTES = 30
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 3

# ── Email Configuration ─────────────────────────────────────────────────────────
BREVO_API_KEY = env('BREVO_API_KEY', default='')
BREVO_SENDER_EMAIL = env('BREVO_SENDER_EMAIL', default='heavprograms@gmail.com')
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')

if BREVO_API_KEY:
    # Production: Use Brevo HTTP API (bypasses Render's SMTP port block)
    EMAIL_BACKEND = 'anymail.backends.brevo.EmailBackend'
    ANYMAIL = {
        'BREVO_API_KEY': BREVO_API_KEY,
    }
    DEFAULT_FROM_EMAIL = f'LR-Ride <{BREVO_SENDER_EMAIL}>'
elif EMAIL_HOST_PASSWORD:
    # Fallback: Gmail SMTP (works locally, blocked on Render free tier)
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = 'smtp.gmail.com'
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_TIMEOUT = env.int('EMAIL_TIMEOUT', default=20)
    DEFAULT_FROM_EMAIL = f'LR-Ride <{EMAIL_HOST_USER}>'
else:
    # Development: Print emails to console
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = 'LR-Ride <noreply@lrride.com>'

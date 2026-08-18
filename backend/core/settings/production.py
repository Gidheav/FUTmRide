# backend/core/settings/production.py
import os
import sys
from urllib.parse import urlparse
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

# Add the parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Import environ - it's installed as django-environ
import environ

env = environ.Env()

# Read .env file if it exists
if os.path.exists('/etc/secrets/.env'):
    env.read_env('/etc/secrets/.env')
elif os.path.exists('.env'):
    env.read_env('.env')

from .base import *

# Google Maps API (Directions API for route resolution)
GOOGLE_MAPS_API_KEY = env('GOOGLE_MAPS_API_KEY', default='')

DEBUG = False
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['.onrender.com', 'localhost', '127.0.0.1'])

# Database Configuration
# Require DATABASE_URL in production to avoid accidental SQLite fallback.
DATABASE_URL = env('DATABASE_URL', default=None)
if not DATABASE_URL:
    raise ImproperlyConfigured('DATABASE_URL is required in production')

# ── Supabase connection-pooler mode ──────────────────────────────────────
# Supabase offers two pooler modes:
#   Port 5432 → Session mode   (max 15 concurrent connections on free plan)
#   Port 6543 → Transaction mode (effectively unlimited; connection released after each statement)
#
# We MUST use transaction mode (port 6543) because:
#   • WebSocket consumers each hold a connection open
#   • Multiple components may open WS simultaneously
#   • Session mode gets exhausted at just 15 clients (root cause of EMAXCONNSESSION)
#
# CONN_MAX_AGE must be 0 with transaction mode — Django must not keep a
# persistent connection because pgBouncer (the pooler) handles pooling.
_db_config = env.db('DATABASE_URL')
_db_host = _db_config.get('HOST', '')
_db_port = str(_db_config.get('PORT', '5432'))

# Rewrite port 5432 → 6543 (session → transaction mode) for Supabase pooler
if _db_port == '5432' and 'pooler.supabase.com' in _db_host:
    _db_config['PORT'] = 6543

DATABASES = {
    'default': {
        **_db_config,
        # Release connection back to pool immediately after each request/statement.
        # Required for transaction-mode pooling. Set a small value (30) for
        # non-WS workers to reduce overhead, but WS consumers should use 0.
        'CONN_MAX_AGE': env.int('DB_CONN_MAX_AGE', default=0),
        # Verify connection is alive before using it (avoids stale connection errors)
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {
            # Disable server-side cursors (not supported in transaction mode)
            'cursor_factory': None,
        },
    }
}

# Redis Configuration (required in production)
REDIS_URL = env('REDIS_URL')
REDIS_PASSWORD = env('REDIS_PASSWORD', default='')
if REDIS_PASSWORD and '@' not in REDIS_URL:
    parsed = urlparse(REDIS_URL)
    host = parsed.hostname or 'localhost'
    port = parsed.port or 6379
    db = parsed.path or '/0'
    REDIS_URL = f'redis://:{REDIS_PASSWORD}@{host}:{port}{db}'
REDIS_MAX_CONNECTIONS = env.int('REDIS_MAX_CONNECTIONS', default=30)
REDIS_SOCKET_CONNECT_TIMEOUT = env.float('REDIS_SOCKET_CONNECT_TIMEOUT', default=2.0)
REDIS_SOCKET_TIMEOUT = env.float('REDIS_SOCKET_TIMEOUT', default=2.0)

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
            'capacity': 1500,
            'expiry': 10,
        },
    }
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
        'TIMEOUT': 300,
        'OPTIONS': {
            'max_connections': REDIS_MAX_CONNECTIONS,
            'socket_connect_timeout': REDIS_SOCKET_CONNECT_TIMEOUT,
            'socket_timeout': REDIS_SOCKET_TIMEOUT,
            'retry_on_timeout': True,
        },
    }
}

# Security
SECRET_KEY = env('SECRET_KEY')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}

# CORS — explicit web origins only (native mobile apps do not use CORS)
CORS_ALLOW_ALL_ORIGINS = False
DEFAULT_WEB_ORIGINS = [
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'https://futmapp.vercel.app',
    'https://lrride.ng',
    'https://www.lrride.ng',
    'https://admin.lrride.ng',
]
CORS_ALLOWED_ORIGINS = sorted(set(env.list('CORS_ALLOWED_ORIGINS', default=[]) + DEFAULT_WEB_ORIGINS))
CSRF_TRUSTED_ORIGINS = sorted(set(env.list('CSRF_TRUSTED_ORIGINS', default=[]) + CORS_ALLOWED_ORIGINS))

# Additional security headers
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

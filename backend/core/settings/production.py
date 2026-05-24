# backend/core/settings/production.py
import os
import sys
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

DEBUG = False
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['.onrender.com', 'localhost', '127.0.0.1'])

# Database Configuration
# Require DATABASE_URL in production to avoid accidental SQLite fallback.
DATABASE_URL = env('DATABASE_URL', default=None)
if not DATABASE_URL:
    raise ImproperlyConfigured('DATABASE_URL is required in production')

DATABASES = {
    'default': env.db('DATABASE_URL'),
}

# Redis Configuration
REDIS_URL = env('REDIS_URL', default='redis://red-d84s0m4vikkc739cn740:6379')
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

# CORS — allow all origins in production (mobile apps + web admin)
CORS_ALLOW_ALL_ORIGINS = True
from .base import *

DEBUG = True
TESTING = True

ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [env("REDIS_URL", default="redis://localhost:6379/0")]},
    }
}

CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_TASK_ALWAYS_EAGER = False
CELERY_TASK_EAGER_PROPAGATES = False

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Allow all CORS origins in development
CORS_ALLOW_ALL_ORIGINS = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"verbose": {"format": "[{asctime}] {levelname} {name} {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "verbose"}},
    "root": {"handlers": ["console"], "level": "DEBUG"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}
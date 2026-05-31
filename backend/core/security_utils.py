"""Shared security helpers for IP extraction and proxy trust."""


def get_client_ip(request) -> str:
    """Return client IP, trusting X-Forwarded-For only behind a known reverse proxy."""
    from django.conf import settings

    remote = request.META.get('REMOTE_ADDR', '0.0.0.0')
    if not getattr(settings, 'USE_X_FORWARDED_HOST', False) and not getattr(
        settings, 'SECURE_PROXY_SSL_HEADER', None
    ):
        return remote

    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if not forwarded:
        return remote
    # Use the left-most address (original client) when behind one trusted proxy.
    return forwarded.split(',')[0].strip() or remote

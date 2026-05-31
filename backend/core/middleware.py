import logging
import json
import re
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse, HttpResponse

from core.security_utils import get_client_ip

logger = logging.getLogger("apps.security")

RATE_LIMIT_RULES = {
    "/api/v1/auth/login/": (120, 60),
    "/api/v1/auth/register/": (60, 300),
    "/api/v1/auth/otp/": (60, 300),
    "/api/v1/auth/otp/verify/": (120, 300),
    "/api/v1/auth/pin/verify/": (120, 300),
    "/api/v1/auth/password/reset/": (60, 300),
    "/api/v1/rides/request/": (180, 60),
    "/api/v1/payments/webhooks/": (300, 60),
}
DEFAULT_RATE = None

MOBILE_UA_RE = re.compile(r"Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile", re.IGNORECASE)
DESKTOP_ONLY_EXEMPT_PATH_PREFIXES = ("/health/",)


class SecurityHeadersMiddleware:
    """Apply Content-Security-Policy and related headers."""

    def __init__(self, get_response):
        self.get_response = get_response

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


class DesktopOnlyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._is_exempt_path(request.path):
            return self.get_response(request)
        if request.path.startswith("/api/") or request.path.startswith("/ws/"):
            return self.get_response(request)

        user_agent = request.META.get("HTTP_USER_AGENT", "")
        if user_agent and MOBILE_UA_RE.search(user_agent):
            return HttpResponse(self._html_message(), status=403, content_type="text/html")

        return self.get_response(request)

    def _is_exempt_path(self, path):
        return path.startswith(DESKTOP_ONLY_EXEMPT_PATH_PREFIXES)

    def _html_message(self):
        return (
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\" />"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
            "<title>Desktop Only</title><style>"
            "body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;}"
            ".wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;"
            "text-align:center;padding:32px;}h1{margin:0 0 12px 0;font-size:24px;}"
            "p{margin:0;font-size:16px;color:#444;}</style></head>"
            "<body><div class=\"wrap\"><div><h1>Desktop only</h1>"
            "<p>This application is available on desktop browsers only.</p>"
            "</div></div></body></html>"
        )


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, "TESTING", False):
            return self.get_response(request)
        if not getattr(settings, "RATE_LIMIT_ENABLED", True):
            return self.get_response(request)
        if not request.path.startswith("/api/"):
            return self.get_response(request)
        rule = self._get_rule(request.path)
        if not rule:
            return self.get_response(request)
        limit, window = rule
        key = self._build_key(request, window)
        result = self._check(key, limit, window)
        if not result["allowed"]:
            logger.warning("rate_limit_exceeded path=%s ip=%s", request.path, self._get_ip(request))
            resp = JsonResponse({"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests."}}, status=429)
            resp["Retry-After"] = str(window)
            return resp
        return self.get_response(request)

    def _get_rule(self, path):
        for prefix, rule in RATE_LIMIT_RULES.items():
            if path.startswith(prefix):
                return rule
        return DEFAULT_RATE

    def _build_key(self, request, window):
        ip = self._get_ip(request)
        identifier = self._identifier_from_request(request)
        return f"rl:{request.path}:{ip}:{identifier}:{window}"

    def _get_ip(self, request):
        return get_client_ip(request)

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

    def _check(self, key, limit, window):
        try:
            count = cache.get(key, 0)
        except Exception:
            logger.error("rate_limit_cache_get_failed key=%s", key, exc_info=True)
            return {"allowed": True}
        if count >= limit:
            return {"allowed": False}
        try:
            cache.set(key, count + 1, timeout=window)
        except Exception:
            logger.error("rate_limit_cache_set_failed key=%s", key, exc_info=True)
            return {"allowed": True}
        return {"allowed": True}

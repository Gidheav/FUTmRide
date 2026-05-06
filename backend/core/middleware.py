import logging
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

logger = logging.getLogger("apps.security")

RATE_LIMIT_RULES = {
    "/api/v1/auth/login/": (10, 300),
    "/api/v1/auth/register/": (5, 300),
    "/api/v1/auth/otp/": (5, 300),
    "/api/v1/rides/request/": (20, 60),
    "/api/v1/payments/webhooks/": (30, 60),
}
DEFAULT_RATE = (120, 60)


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, "TESTING", False):
            return self.get_response(request)
        if not request.path.startswith("/api/"):
            return self.get_response(request)
        limit, window = self._get_rule(request.path)
        key = self._build_key(request)
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

    def _build_key(self, request):
        ip = self._get_ip(request)
        uid = str(request.user.id) if hasattr(request, "user") and request.user.is_authenticated else "anon"
        return f"rl:{ip}:{uid}:{request.path}"

    def _get_ip(self, request):
        fwd = request.META.get("HTTP_X_FORWARDED_FOR")
        return fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR", "0.0.0.0")

    def _check(self, key, limit, window):
        count = cache.get(key, 0)
        if count >= limit:
            return {"allowed": False}
        cache.set(key, count + 1, timeout=window)
        return {"allowed": True}
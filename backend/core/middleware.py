import logging
import re
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse, HttpResponse

logger = logging.getLogger("apps.security")

RATE_LIMIT_RULES = {
    "/api/v1/auth/login/": (100, 300),
    "/api/v1/auth/register/": (5, 300),
    "/api/v1/auth/otp/": (5, 300),
    "/api/v1/rides/request/": (20, 60),
    "/api/v1/payments/webhooks/": (30, 60),
}
DEFAULT_RATE = (120, 60)

MOBILE_UA_RE = re.compile(r"Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile", re.IGNORECASE)
DESKTOP_ONLY_EXEMPT_PATH_PREFIXES = ("/health/",)


class DesktopOnlyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._is_exempt_path(request.path):
            return self.get_response(request)

        user_agent = request.META.get("HTTP_USER_AGENT", "")
        if user_agent and MOBILE_UA_RE.search(user_agent):
            if request.path.startswith("/api/") or request.path.startswith("/ws/"):
                return JsonResponse(
                    {"error": {"code": "DESKTOP_ONLY", "message": "Desktop browsers only."}},
                    status=403,
                )
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
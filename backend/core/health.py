import time
from django.db import connection
from django.core.cache import cache
from django.http import JsonResponse
from django.views import View


class HealthCheckView(View):
    def get(self, request):
        checks = {}
        code = 200
        try:
            t = time.monotonic()
            connection.ensure_connection()
            checks["database"] = {"status": "ok", "latency_ms": round((time.monotonic()-t)*1000,2)}
        except Exception as e:
            checks["database"] = {"status": "error", "detail": str(e)}
            code = 503
        try:
            t = time.monotonic()
            cache.set("hc", "1", timeout=5)
            checks["cache"] = {"status": "ok" if cache.get("hc")=="1" else "degraded", "latency_ms": round((time.monotonic()-t)*1000,2)}
        except Exception as e:
            checks["cache"] = {"status": "degraded", "detail": str(e)}
        return JsonResponse({"status": "ok" if code==200 else "degraded", "service": "lrride-api", "checks": checks}, status=code)
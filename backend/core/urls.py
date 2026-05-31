from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from core.health import HealthCheckView


def healthcheck(request):
    return JsonResponse({"status": "ok", "service": "lrride-api"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", HealthCheckView.as_view(), name="health-detail"),
    path("health-simple/", healthcheck, name="healthcheck"),
    path("api/v1/auth/", include("apps.accounts.urls_auth")),
    path("api/v1/users/", include("apps.accounts.urls_users")),
    path("api/v1/rides/", include("apps.rides.urls")),
    path("api/v1/tracking/", include("apps.tracking.urls")),
    path("api/v1/payments/", include("apps.payments.urls")),
    path("api/v1/", include("apps.payments.urls")),
    path("api/v1/pricing/", include("apps.pricing.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/ratings/", include("apps.ratings.urls")),
    path("api/v1/verification/", include("apps.verification.urls")),
    path("api/v1/analytics/", include("apps.analytics.urls")),
    path("api/v1/support/", include("apps.support.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
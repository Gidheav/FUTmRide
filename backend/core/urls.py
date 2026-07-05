import os
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from core.health import HealthCheckView


def healthcheck(request):
    return JsonResponse({"status": "ok", "service": "lrride-api"})

def app_config(request):
    """
    Returns global dynamic configurations for the mobile app clients.
    Values can be changed via Environment Variables on Render without redeploying code.
    """
    return JsonResponse({
        "news_url": os.environ.get("MOBILE_NEWS_URL", "https://futmapp.vercel.app/m-app-portal/news?token=LzR_Secure_App_2026"),
        "events_url": os.environ.get("MOBILE_EVENTS_URL", "https://futmapp.vercel.app/m-app-portal/events?token=LzR_Secure_App_2026"),
        "activities_url": os.environ.get("MOBILE_ACTIVITIES_URL", "https://futmapp.vercel.app/m-app-portal/activities?token=LzR_Secure_App_2026"),
        "safety_guide_url": os.environ.get("MOBILE_SAFETY_GUIDE_URL", "https://futmapp.vercel.app/m-app-portal/safety?token=LzR_Secure_App_2026"),
    })

urlpatterns = [
    path("", healthcheck, name="root"),
    path("api/v1/app-config/", app_config, name="app-config"),
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
    path("api/v1/locations/", include("apps.locations.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
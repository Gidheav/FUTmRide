import os
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse, Http404
from django.shortcuts import render
from core.health import HealthCheckView


def healthcheck(request):
    return JsonResponse({"status": "ok", "service": "lrride-api"})

def app_config(request):
    """
    Returns global dynamic configurations for the mobile app clients.
    Values can be changed via Environment Variables on Render without redeploying code.
    """
    token = os.environ.get("MOBILE_WEBVIEW_TOKEN", "LzR_Secure_App_2026")

    def default_webview_url(page):
        return request.build_absolute_uri(f"/webview/{page}/?token={token}")

    return JsonResponse({
        "news_url": os.environ.get("MOBILE_NEWS_URL", default_webview_url("news")),
        "events_url": os.environ.get("MOBILE_EVENTS_URL", default_webview_url("events")),
        "activities_url": os.environ.get("MOBILE_ACTIVITIES_URL", default_webview_url("activities")),
        "safety_guide_url": os.environ.get("MOBILE_SAFETY_GUIDE_URL", default_webview_url("safety")),
    })

def secure_webview(request, page):
    """
    Renders simple HTML templates for the mobile app webviews.
    Requires a secret token to prevent direct public access.
    """
    token = request.GET.get('token')
    expected_token = os.environ.get("MOBILE_WEBVIEW_TOKEN", "LzR_Secure_App_2026")
    if token != expected_token:
        raise Http404("Not Found")
    
    valid_pages = ['news', 'events', 'activities', 'safety']
    if page not in valid_pages:
        raise Http404("Not Found")
        
    return render(request, f"webview/{page}.html")

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
    
    # Secure Mobile WebViews
    path("webview/<str:page>/", secure_webview, name="secure-webview"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

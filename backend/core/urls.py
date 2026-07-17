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
        # Driver app endpoints
        "driver_news_url": os.environ.get("MOBILE_DRIVER_NEWS_URL", default_webview_url("driver-news")),
        "driver_events_url": os.environ.get("MOBILE_DRIVER_EVENTS_URL", default_webview_url("campus-events")),
        "community_url": os.environ.get("MOBILE_DRIVER_COMMUNITY_URL", default_webview_url("driver-community")),
        "driver_guidelines_url": os.environ.get("MOBILE_DRIVER_GUIDELINES_URL", default_webview_url("driver-guidelines")),
    })


def _resolve_webview_user(request):
    """
    Attempt to resolve the active user from the JWT Bearer token
    sent in the Authorization header by the mobile app.
    Returns the user object if authenticated, or None.
    """
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth_header.startswith("Bearer "):
        return None

    jwt_token = auth_header.split(" ", 1)[1].strip()
    if not jwt_token:
        return None

    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth import get_user_model
        User = get_user_model()
        validated = AccessToken(jwt_token)
        user_id = validated.get("user_id")
        if user_id:
            return User.objects.select_related().get(pk=user_id)
    except Exception:
        # Invalid / expired token — serve the page anonymously
        pass

    return None


def secure_webview(request, page):
    """
    Renders HTML templates for the mobile app webviews.
    - Requires the shared MOBILE_WEBVIEW_TOKEN query param to prevent direct public access.
    - Optionally resolves the active user from the JWT Bearer header so templates
      can personalise content (e.g. {{ user.get_full_name }}).
    """
    token = request.GET.get('token')
    expected_token = os.environ.get("MOBILE_WEBVIEW_TOKEN", "LzR_Secure_App_2026")
    if token != expected_token:
        raise Http404("Not Found")

    valid_pages = [
        'news', 'events', 'activities', 'safety',
        'driver-news', 'campus-events', 'driver-community', 'driver-guidelines'
    ]
    if page not in valid_pages:
        raise Http404("Not Found")

    # Resolve the mobile user from the JWT header (if present)
    webview_user = _resolve_webview_user(request)

    context = {
        "webview_user": webview_user,
        # Convenience aliases for templates
        "user_full_name": webview_user.full_name if webview_user else None,
        "user_first_name": webview_user.first_name if webview_user else None,
        "user_email": webview_user.email if webview_user else None,
        "is_authenticated": webview_user is not None,
    }

    return render(request, f"webview/{page}.html", context)

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

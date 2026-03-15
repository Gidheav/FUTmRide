from django.urls import path
from .views import PlatformSummaryView, RideTrendView

urlpatterns = [
    path('summary/', PlatformSummaryView.as_view(), name='analytics-summary'),
    path('rides/trend/', RideTrendView.as_view(), name='analytics-ride-trend'),
]
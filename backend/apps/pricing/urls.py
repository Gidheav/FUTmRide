from django.urls import path
from .views import (
    FareConfigListView,
    FareConfigDetailView,
    FareEstimateView,
    PlatformSettingsView,
    FareConfigDeactivateView,
)

urlpatterns = [
    path('config/', FareConfigListView.as_view(), name='fare-config-list'),
    path('config/<uuid:pk>/', FareConfigDetailView.as_view(), name='fare-config-detail'),
    path('config/<uuid:pk>/deactivate/', FareConfigDeactivateView.as_view(), name='fare-config-deactivate'),
    path('estimate/', FareEstimateView.as_view(), name='fare-estimate'),
    path('settings/', PlatformSettingsView.as_view(), name='platform-settings'),
]
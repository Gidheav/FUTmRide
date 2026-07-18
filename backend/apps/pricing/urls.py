from django.urls import path
from .views import (
    FareConfigListView,
    FareConfigDetailView,
    FareEstimateView,
    PlatformSettingsView,
    FareConfigDeactivateView,
    ActiveFareConfigsView,
    RouteGraphActiveView,
    RouteGraphPublishView,
    RouteGraphTraceView,
)

urlpatterns = [
    path('config/active/', ActiveFareConfigsView.as_view(), name='fare-config-active'),
    path('config/', FareConfigListView.as_view(), name='fare-config-list'),
    path('config/<uuid:pk>/', FareConfigDetailView.as_view(), name='fare-config-detail'),
    path('config/<uuid:pk>/deactivate/', FareConfigDeactivateView.as_view(), name='fare-config-deactivate'),
    path('estimate/', FareEstimateView.as_view(), name='fare-estimate'),
    path('settings/', PlatformSettingsView.as_view(), name='platform-settings'),
    path('route-graph/active/', RouteGraphActiveView.as_view(), name='route-graph-active'),
    path('route-graph/publish/', RouteGraphPublishView.as_view(), name='route-graph-publish'),
    path('route-graph/trace/', RouteGraphTraceView.as_view(), name='route-graph-trace'),
]

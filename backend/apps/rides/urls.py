from django.urls import path
from .views import (
    RideRequestView,
    StudentRideListView,
    StudentActiveRideView,
    RideDetailView,
    CancelRideView,
    DriverRideStatusUpdateView,
    DriverActiveRideView,
    DriverRideHistoryView,
    AdminRideListView,
    DriverMarketplaceListView,
    DriverAcceptRideView,
)

urlpatterns = [
    path('request/', RideRequestView.as_view(), name='ride-request'),
    path('my/', StudentRideListView.as_view(), name='ride-student-list'),
    path('my/active/', StudentActiveRideView.as_view(), name='ride-student-active'),
    path('<uuid:ride_id>/', RideDetailView.as_view(), name='ride-detail'),
    path('<uuid:ride_id>/cancel/', CancelRideView.as_view(), name='ride-cancel'),
    path('<uuid:ride_id>/advance/', DriverRideStatusUpdateView.as_view(), name='ride-advance'),
    path('driver/active/', DriverActiveRideView.as_view(), name='ride-driver-active'),
    path('driver/history/', DriverRideHistoryView.as_view(), name='ride-driver-history'),
    path('driver/requests/', DriverMarketplaceListView.as_view(), name='ride-driver-requests'),
    path('driver/requests/<uuid:ride_id>/accept/', DriverAcceptRideView.as_view(), name='ride-driver-accept'),

    # Admin
    path('', AdminRideListView.as_view(), name='admin-ride-list'),
]
from django.urls import path
from .views import (
    RideRequestView,
    StudentRideListView,
    RideDetailView,
    CancelRideView,
    DriverRideStatusUpdateView,
    DriverActiveRideView,
    DriverRideHistoryView,
)

urlpatterns = [
    path('request/', RideRequestView.as_view(), name='ride-request'),
    path('my/', StudentRideListView.as_view(), name='ride-student-list'),
    path('<uuid:ride_id>/', RideDetailView.as_view(), name='ride-detail'),
    path('<uuid:ride_id>/cancel/', CancelRideView.as_view(), name='ride-cancel'),
    path('<uuid:ride_id>/advance/', DriverRideStatusUpdateView.as_view(), name='ride-advance'),
    path('driver/active/', DriverActiveRideView.as_view(), name='ride-driver-active'),
    path('driver/history/', DriverRideHistoryView.as_view(), name='ride-driver-history'),
]
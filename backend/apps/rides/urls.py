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
    AvailableRidesView,
)
from .garage_views import (
    GarageRideCreateView,
    DriverGarageRideListView,
    GarageRideDepartView,
    GarageRideCancelView,
    GarageRideCompleteView,
    GarageRideScanView,
    GarageRideBoardView,
    GarageRidePassengersView,
    CampusAdminActiveGarageRidesView,
)

urlpatterns = [
    path('available/', AvailableRidesView.as_view(), name='ride-available'),
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

    # ── Garage / Scan-to-Pay ─────────────────────────────────────────────────
    path('garage/create/', GarageRideCreateView.as_view(), name='garage-ride-create'),
    path('garage/mine/', DriverGarageRideListView.as_view(), name='garage-ride-mine'),
    path('garage/<uuid:ride_id>/depart/', GarageRideDepartView.as_view(), name='garage-ride-depart'),
    path('garage/<uuid:ride_id>/cancel/', GarageRideCancelView.as_view(), name='garage-ride-cancel'),
    path('garage/<uuid:ride_id>/complete/', GarageRideCompleteView.as_view(), name='garage-ride-complete'),
    path('garage/<uuid:ride_id>/passengers/', GarageRidePassengersView.as_view(), name='garage-ride-passengers'),
    # Student scan endpoints — keyed by qr_token (UUID), not ride id
    path('garage/scan/<uuid:qr_token>/', GarageRideScanView.as_view(), name='garage-ride-scan'),
    path('garage/scan/<uuid:qr_token>/board/', GarageRideBoardView.as_view(), name='garage-ride-board'),

    # Campus Admin: active garage rides
    path('garage/active/', CampusAdminActiveGarageRidesView.as_view(), name='garage-ride-active'),

    # Admin
    path('', AdminRideListView.as_view(), name='admin-ride-list'),
]
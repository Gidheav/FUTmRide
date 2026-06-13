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
    DriverSavedRouteListCreateView,
    DriverSavedRouteDetailView,
    GarageRideDepartView,
    GarageRideCancelView,
    GarageRideCompleteView,
    GarageRideScanView,
    GarageRideBoardView,
    GarageRidePassengersView,
    CampusAdminActiveGarageRidesView,
)
from .scheduled_views import (
    ScheduledRideCreateView,
    ScheduledRideListView,
    ScheduledRideDetailView,
    ScheduledRideCancelView,
    ScheduledRideDepartView,
    ScheduledRideCompleteView,
    StudentAvailableScheduledRidesView,
    StudentJoinScheduledRideView,
    StudentLeaveScheduledRideView,
)
from .scheduled_bus_views import (
    BusAssignmentListView,
    BusAssignmentCreateView,
    BusAssignmentUpdateView,
    BusAllocateView,
    BusAutoCheckInView,
    BusDepartView,
    BusArriveView,
    BusCompleteView,
    RidePassengerListView,
    PassengerCheckInView,
    PassengerNoShowView,
    PassengerReassignView,
    RideAutoAllocateView,
    DriverAvailableScheduledRidesView,
    DriverExpressInterestView,
    AdminInterestedDriversView,
    DriverMyInterestedRidesView,
)
from .test_tools import (
    TestToolCreateAdminsView,
    TestToolCreateDriversView,
    TestToolCreateRidesView,
    TestToolCreateStudentsView,
    TestToolDeleteAdminsView,
    TestToolDeleteDriversView,
    TestToolDeleteRidesView,
    TestToolDeleteStudentsView,
    TestToolJoinRideView,
    TestToolSummaryView,
    TestToolCreateOnDemandRidesView,
    TestToolDeleteOnDemandRidesView,
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
    path('garage/routes/', DriverSavedRouteListCreateView.as_view(), name='garage-ride-routes'),
    path('garage/routes/<uuid:route_id>/', DriverSavedRouteDetailView.as_view(), name='garage-ride-route-detail'),
    path('garage/<uuid:ride_id>/depart/', GarageRideDepartView.as_view(), name='garage-ride-depart'),
    path('garage/<uuid:ride_id>/cancel/', GarageRideCancelView.as_view(), name='garage-ride-cancel'),
    path('garage/<uuid:ride_id>/complete/', GarageRideCompleteView.as_view(), name='garage-ride-complete'),
    path('garage/<uuid:ride_id>/passengers/', GarageRidePassengersView.as_view(), name='garage-ride-passengers'),
    # Student scan endpoints — keyed by qr_token (UUID), not ride id
    path('garage/scan/<uuid:qr_token>/', GarageRideScanView.as_view(), name='garage-ride-scan'),
    path('garage/scan/<uuid:qr_token>/board/', GarageRideBoardView.as_view(), name='garage-ride-board'),

    # Campus Admin: active garage rides
    path('garage/active/', CampusAdminActiveGarageRidesView.as_view(), name='garage-ride-active'),

    # ── Scheduled Rides (Campus Admin) ───────────────────────────────────────
    path('scheduled/create/', ScheduledRideCreateView.as_view(), name='scheduled-ride-create'),
    path('scheduled/', ScheduledRideListView.as_view(), name='scheduled-ride-list'),
    path('scheduled/<uuid:ride_id>/', ScheduledRideDetailView.as_view(), name='scheduled-ride-detail'),
    path('scheduled/<uuid:ride_id>/cancel/', ScheduledRideCancelView.as_view(), name='scheduled-ride-cancel'),
    path('scheduled/<uuid:ride_id>/depart/', ScheduledRideDepartView.as_view(), name='scheduled-ride-depart'),
    path('scheduled/<uuid:ride_id>/complete/', ScheduledRideCompleteView.as_view(), name='scheduled-ride-complete'),

    # ── Bus Assignment & Passenger Management (Route Ops) ────────────────────
    path('scheduled/<uuid:ride_id>/buses/', BusAssignmentListView.as_view(), name='bus-assignment-list'),
    path('scheduled/<uuid:ride_id>/buses/assign/', BusAssignmentCreateView.as_view(), name='bus-assignment-create'),
    path('scheduled/<uuid:ride_id>/buses/<uuid:bus_id>/', BusAssignmentUpdateView.as_view(), name='bus-assignment-update'),
    path('scheduled/<uuid:ride_id>/buses/<uuid:bus_id>/allocate/', BusAllocateView.as_view(), name='bus-allocate'),
    path('scheduled/<uuid:ride_id>/buses/<uuid:bus_id>/auto-check-in/', BusAutoCheckInView.as_view(), name='bus-auto-check-in'),
    path('scheduled/<uuid:ride_id>/buses/<uuid:bus_id>/depart/', BusDepartView.as_view(), name='bus-depart'),
    path('scheduled/<uuid:ride_id>/buses/<uuid:bus_id>/arrive/', BusArriveView.as_view(), name='bus-arrive'),
    path('scheduled/<uuid:ride_id>/buses/<uuid:bus_id>/complete/', BusCompleteView.as_view(), name='bus-complete'),
    path('scheduled/<uuid:ride_id>/passengers/', RidePassengerListView.as_view(), name='ride-passenger-list'),
    path('scheduled/<uuid:ride_id>/passengers/<uuid:pax_id>/check-in/', PassengerCheckInView.as_view(), name='passenger-check-in'),
    path('scheduled/<uuid:ride_id>/passengers/<uuid:pax_id>/no-show/', PassengerNoShowView.as_view(), name='passenger-no-show'),
    path('scheduled/<uuid:ride_id>/passengers/<uuid:pax_id>/reassign/', PassengerReassignView.as_view(), name='passenger-reassign'),
    path('scheduled/<uuid:ride_id>/auto-allocate/', RideAutoAllocateView.as_view(), name='ride-auto-allocate'),

    # ── Scheduled Rides (Student) ────────────────────────────────────────────
    path('scheduled/available/', StudentAvailableScheduledRidesView.as_view(), name='scheduled-ride-available'),
    path('scheduled/<uuid:ride_id>/join/', StudentJoinScheduledRideView.as_view(), name='scheduled-ride-join'),
    path('scheduled/<uuid:ride_id>/leave/', StudentLeaveScheduledRideView.as_view(), name='scheduled-ride-leave'),

    # ── Scheduled Rides (Driver Bidding) ─────────────────────────────────────
    path('scheduled/driver/available/', DriverAvailableScheduledRidesView.as_view(), name='driver-scheduled-available'),
    path('scheduled/driver/my-interests/', DriverMyInterestedRidesView.as_view(), name='driver-my-interests'),
    path('scheduled/<uuid:ride_id>/interest/', DriverExpressInterestView.as_view(), name='driver-scheduled-interest'),
    path('scheduled/<uuid:ride_id>/interested-drivers/', AdminInterestedDriversView.as_view(), name='admin-interested-drivers'),

    # Test-only bulk tools. Guarded by DEBUG or ENABLE_TEST_TOOLS.
    path('test-tools/summary/', TestToolSummaryView.as_view(), name='test-tools-summary'),
    path('test-tools/accounts/students/create/', TestToolCreateStudentsView.as_view(), name='test-tools-students-create'),
    path('test-tools/accounts/students/delete/', TestToolDeleteStudentsView.as_view(), name='test-tools-students-delete'),
    path('test-tools/accounts/drivers/create/', TestToolCreateDriversView.as_view(), name='test-tools-drivers-create'),
    path('test-tools/accounts/drivers/delete/', TestToolDeleteDriversView.as_view(), name='test-tools-drivers-delete'),
    path('test-tools/accounts/admins/create/', TestToolCreateAdminsView.as_view(), name='test-tools-admins-create'),
    path('test-tools/accounts/admins/delete/', TestToolDeleteAdminsView.as_view(), name='test-tools-admins-delete'),
    path('test-tools/rides/create/', TestToolCreateRidesView.as_view(), name='test-tools-rides-create'),
    path('test-tools/rides/delete/', TestToolDeleteRidesView.as_view(), name='test-tools-rides-delete'),
    path('test-tools/rides/join/', TestToolJoinRideView.as_view(), name='test-tools-rides-join'),
    path('test-tools/ondemand-rides/create/', TestToolCreateOnDemandRidesView.as_view(), name='test-tools-ondemand-create'),
    path('test-tools/ondemand-rides/delete/', TestToolDeleteOnDemandRidesView.as_view(), name='test-tools-ondemand-delete'),

    # Admin
    path('', AdminRideListView.as_view(), name='admin-ride-list'),
]

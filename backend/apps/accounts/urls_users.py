from django.urls import path
from .views import (
    MeView, StudentProfileView, DriverProfileView,
    DriverProfileCreateView, DriverAvailabilityView,
    AdminUserListView, AdminUserDetailView,
    AdminDriverListView, AdminDriverVerifyView,
    AdminToggleUserActiveView,
)

urlpatterns = [
    path('me/', MeView.as_view(), name='user-me'),
    path('me/student-profile/', StudentProfileView.as_view(), name='user-student-profile'),
    path('me/driver-profile/', DriverProfileView.as_view(), name='user-driver-profile'),
    path('me/driver-profile/create/', DriverProfileCreateView.as_view(), name='user-driver-profile-create'),
    path('me/driver-profile/availability/', DriverAvailabilityView.as_view(), name='user-driver-availability'),

    # Admin endpoints
    path('', AdminUserListView.as_view(), name='admin-user-list'),
    path('<uuid:id>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('<uuid:pk>/toggle-active/', AdminToggleUserActiveView.as_view(), name='admin-user-toggle-active'),
    path('drivers/', AdminDriverListView.as_view(), name='admin-driver-list'),
    path('drivers/<int:pk>/verify/', AdminDriverVerifyView.as_view(), name='admin-driver-verify'),
]
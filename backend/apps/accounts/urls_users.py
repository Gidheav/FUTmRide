from django.urls import path
from .views import (
    MeView,
    StudentProfileView,
    DriverProfileView,
    DriverProfileCreateView,
    DriverAvailabilityView,
)

urlpatterns = [
    path('me/', MeView.as_view(), name='user-me'),
    path('me/student-profile/', StudentProfileView.as_view(), name='user-student-profile'),
    path('me/driver-profile/', DriverProfileView.as_view(), name='user-driver-profile'),
    path('me/driver-profile/create/', DriverProfileCreateView.as_view(), name='user-driver-profile-create'),
    path('me/driver-profile/availability/', DriverAvailabilityView.as_view(), name='user-driver-availability'),
]
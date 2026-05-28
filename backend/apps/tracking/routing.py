from django.urls import re_path
from .consumers import DriverLocationConsumer, RideTrackingConsumer, CampusAdminFleetConsumer

websocket_urlpatterns = [
    re_path(r'^ws/driver/location/$', DriverLocationConsumer.as_asgi()),
    re_path(r'^ws/ride/(?P<ride_id>[0-9a-f-]+)/track/$', RideTrackingConsumer.as_asgi()),
    re_path(r'^ws/campus-admin/fleet/$', CampusAdminFleetConsumer.as_asgi()),
]
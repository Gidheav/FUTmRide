from django.urls import re_path
from .consumers import CampusAdminRidesConsumer

websocket_urlpatterns = [
    re_path(r'^ws/campus-admin/rides/$', CampusAdminRidesConsumer.as_asgi()),
]

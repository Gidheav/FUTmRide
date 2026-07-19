from django.urls import path
from apps.rides import consumers

websocket_urlpatterns = [
    path('ws/campus-admin/rides/', consumers.CampusAdminRidesConsumer.as_asgi()),
]

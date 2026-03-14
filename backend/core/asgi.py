import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.development')

django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

from apps.tracking.routing import websocket_urlpatterns as tracking_ws
from apps.rides.routing import websocket_urlpatterns as rides_ws
from apps.notifications.routing import websocket_urlpatterns as notifications_ws

application = ProtocolTypeRouter(
    {
        'http': django_asgi_app,
        'websocket': AllowedHostsOriginValidator(
            AuthMiddlewareStack(
                URLRouter(tracking_ws + rides_ws + notifications_ws)
            )
        ),
    }
)

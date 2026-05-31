import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.production')

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

from apps.tracking.routing import websocket_urlpatterns as tracking_ws
from apps.rides.routing import websocket_urlpatterns as rides_ws
from apps.notifications.routing import websocket_urlpatterns as notifications_ws
from core.ws_auth import TokenAuthMiddlewareStack

application = ProtocolTypeRouter(
    {
        'http': django_asgi_app,
        'websocket': AllowedHostsOriginValidator(
            TokenAuthMiddlewareStack(
                URLRouter(tracking_ws + rides_ws + notifications_ws)
            )
        ),
    }
)

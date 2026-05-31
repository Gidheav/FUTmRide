from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication


def _extract_bearer_token(headers: list) -> str | None:
    for name, value in headers:
        if name.lower() == b'authorization':
            decoded = value.decode('latin-1')
            if decoded.lower().startswith('bearer '):
                return decoded[7:].strip()
        if name.lower() == b'sec-websocket-protocol':
            for protocol in value.decode('latin-1').split(','):
                protocol = protocol.strip()
                if protocol.startswith('access_token.'):
                    return protocol[len('access_token.'):]
    return None


@database_sync_to_async
def _get_user(token: str):
    jwt_auth = JWTAuthentication()
    validated = jwt_auth.get_validated_token(token)
    return jwt_auth.get_user(validated)


class TokenAuthMiddleware:
    """Authenticate WebSockets via Authorization header (preferred) or legacy ?token= query."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        token = _extract_bearer_token(scope.get('headers', []))

        if not token:
            query_string = scope.get('query_string', b'').decode()
            query = parse_qs(query_string)
            if 'token' in query and query['token']:
                token = query['token'][0]

        if token:
            try:
                scope['user'] = await _get_user(token)
            except Exception:
                scope['user'] = AnonymousUser()

        return await self.app(scope, receive, send)


def TokenAuthMiddlewareStack(inner):
    from channels.auth import AuthMiddlewareStack
    return AuthMiddlewareStack(TokenAuthMiddleware(inner))

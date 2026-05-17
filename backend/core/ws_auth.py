from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication


@database_sync_to_async
def _get_user(token: str):
    jwt_auth = JWTAuthentication()
    validated = jwt_auth.get_validated_token(token)
    return jwt_auth.get_user(validated)


class TokenAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        query = parse_qs(query_string)
        token = None
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

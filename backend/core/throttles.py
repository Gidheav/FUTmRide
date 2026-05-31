from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthAnonRateThrottle(AnonRateThrottle):
    scope = 'auth_anon'


class AuthUserRateThrottle(UserRateThrottle):
    scope = 'auth_user'

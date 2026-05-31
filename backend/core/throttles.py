from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthAnonRateThrottle(AnonRateThrottle):
    scope = 'auth_anon'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        if request.method in {"POST", "PUT", "PATCH"}:
            try:
                data = request.data
            except Exception:
                data = {}
            for key in ("phone_number", "email", "identifier"):
                value = str(data.get(key) or "").strip().lower()
                if value:
                    ident = f"{ident}:{value[:120]}"
                    break
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }


class AuthUserRateThrottle(UserRateThrottle):
    scope = 'auth_user'

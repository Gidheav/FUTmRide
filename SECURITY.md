# LR-Ride Security

## Reporting vulnerabilities

Email security issues privately to your team lead. Do not open public GitHub issues for exploitable bugs.

## Production checklist

- [ ] `DJANGO_SETTINGS_MODULE=core.settings.production` on all WSGI/ASGI workers
- [ ] `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL` set via host secrets (Render env)
- [ ] `PAYSTACK_WEBHOOK_IP_ALLOWLIST` and `FLUTTERWAVE_WEBHOOK_IP_ALLOWLIST` configured
- [ ] `CORS_ALLOWED_ORIGINS` lists only trusted admin web origins
- [ ] `ALLOW_DEV_OTP_BYPASS` unset or `false` in production
- [ ] Google Maps / payment keys restricted in provider dashboards; never committed in `.env.production`
- [ ] Cloudflare (or equivalent) WAF + rate limits in front of `/api/v1/auth/*`
- [ ] Sentry `SENTRY_DSN` configured for error alerting
- [ ] Automated Postgres backups enabled and restore tested quarterly

## Incident response (summary)

1. **Credential leak:** rotate `SECRET_KEY`, `JWT_SECRET_KEY`, Paystack/Flutterwave keys; force logout via JWT blacklist.
2. **Wallet anomaly:** pause top-up webhooks; reconcile `GatewayTransaction` vs provider dashboard; audit `audit_logs` table.
3. **Account takeover spike:** tighten WAF; verify OTP/PIN rate limits and Redis availability.

## Dependency scanning

- Dependabot (`.github/dependabot.yml`)
- CI: `pip-audit` (backend) and `npm audit` (frontend) on pull requests

## Backup and recovery

- Target RPO: 24h (daily DB backups)
- Target RTO: 4h for API restore
- Store backups encrypted; test restore before each major release

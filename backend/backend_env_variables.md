# LR-Ride Backend `.env` Variables

Here is the complete list of all expected environment variables for your Render deployment, grouped by their function. Note that for items expecting a "List", you should provide a comma-separated string without spaces (e.g., `value1,value2`).

## 🔑 Core Application & Security
- `SECRET_KEY` *(Required)* - Core Django secret.
- `JWT_SECRET_KEY` - Used for signing tokens (defaults to `SECRET_KEY` if omitted).
- `ALLOWED_HOSTS` *(List)* - E.g., `lrride-server.onrender.com,localhost`
- `CORS_ALLOWED_ORIGINS` *(List)* - E.g., `https://frontend-domain.onrender.com`
- `CSRF_TRUSTED_ORIGINS` *(List)* - Should match CORS origins.
- `CONTENT_SECURITY_POLICY`

## 🗄️ Database & Redis Cache
- `DATABASE_URL` *(Required)* - Postgres connection string.
- `REDIS_URL` *(Required)* - Redis connection string (include password here if needed).
- `REDIS_PASSWORD` - Explicit password (if not already included in `REDIS_URL`).
- `REDIS_MAX_CONNECTIONS` *(Integer, default: 30)*
- `REDIS_SOCKET_CONNECT_TIMEOUT` *(Float, default: 2.0)*
- `REDIS_SOCKET_TIMEOUT` *(Float, default: 2.0)*

## 💳 Payment Gateways
**Paystack**
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_WEBHOOK_IP_ALLOWLIST` *(List)*
- `PAYSTACK_WEBHOOK_REPLAY_WINDOW_MINUTES` *(Integer)*
- `PAYSTACK_WEBHOOK_MAX_SKEW_MINUTES` *(Integer)*
- `PAYSTACK_RECONCILE_AFTER_MINUTES` *(Integer)*

**Flutterwave**
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_PUBLIC_KEY`
- `FLUTTERWAVE_WEBHOOK_SECRET`
- `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- `FLUTTERWAVE_WEBHOOK_IP_ALLOWLIST` *(List)*
- `FLUTTERWAVE_WEBHOOK_REPLAY_WINDOW_MINUTES` *(Integer)*
- `FLUTTERWAVE_WEBHOOK_MAX_SKEW_MINUTES` *(Integer)*
- `FLUTTERWAVE_RECONCILE_AFTER_MINUTES` *(Integer)*

## 📡 Integrations (SMS, Email, Push)
- `TERMII_API_KEY` - Termii SMS API key.
- `TERMII_SENDER_ID` - E.g., `LRRIDE`
- `TERMII_BASE_URL` - *(Defaults to `https://api.ng.termii.com/api`)*
- `FCM_SERVER_KEY` - Firebase Cloud Messaging Push Key.
- `BREVO_API_KEY` - Email API key.
- `BREVO_SENDER_EMAIL` - E.g., `heavprograms@gmail.com`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_TIMEOUT` *(Integer, default: 20)*

## 🩺 System Health Monitoring
- `UPTIMEROBOT_API_KEY`
- `UPTIMEROBOT_MONITOR_IDS` *(List, Optional)*
- `CRON_JOB_ORG_API_KEY`
- `CRON_JOB_ORG_JOB_IDS` *(List, Optional)*
- `SYSTEM_HEALTH_REQUEST_TIMEOUT_SECONDS` *(Integer)*
- `SYSTEM_HEALTH_CACHE_SECONDS` *(Integer)*
- `SENTRY_DSN` - Sentry error tracking URL.

## 🚖 Dispatch & Fleet Tracking Tuning
*(These usually fallback to defaults and don't need to be set unless tweaking performance)*
- `DISPATCH_FLEET_BROADCAST_INTERVAL_SECONDS` *(Integer)*
- `DISPATCH_FLEET_MAX_AGE_SECONDS` *(Integer)*
- `DISPATCH_INCIDENT_RIDE_AGE_MINUTES` *(Integer)*
- `DISPATCH_INCIDENT_ARRIVED_NO_START_MINUTES` *(Integer)*
- `DISPATCH_INCIDENT_NO_DRIVER_MINUTES` *(Integer)*
- `DISPATCH_INCIDENT_LOW_RATING_THRESHOLD` *(Float)*
- `DISPATCH_INCIDENT_HIGH_CANCELLATION_THRESHOLD` *(Integer)*
- `DISPATCH_INCIDENT_HIGH_DEMAND_LOOKBACK_MINUTES` *(Integer)*
- `DISPATCH_INCIDENT_HIGH_DEMAND_RADIUS_KM` *(Float)*
- `DISPATCH_INCIDENT_HIGH_DEMAND_RIDE_THRESHOLD` *(Integer)*
- `DISPATCH_INCIDENT_HIGH_DEMAND_DRIVER_THRESHOLD` *(Integer)*
- `DISPATCH_INCIDENT_HIGH_DEMAND_MAX_CHECKS` *(Integer)*
- `DISPATCH_INCIDENT_CACHE_TTL_SECONDS` *(Integer)*
- `DISPATCH_KPI_WINDOW_MINUTES` *(Integer)*
- `DISPATCH_SLA_TARGET_MINUTES` *(Integer)*

## 🔧 Developer & Debug Modes
- `RATE_LIMIT_ENABLED` *(Boolean)*
- `DRF_THROTTLE_ENABLED` *(Boolean)*
- `AUTH_THROTTLE_ENABLED` *(Boolean)*
- `ENABLE_PUSH_IN_DEBUG` *(Boolean)*
- `SHOW_API_EXCEPTION_DETAILS` *(Boolean)*
- `ENABLE_TEST_TOOLS` *(Boolean)*
- `ALLOW_DEV_OTP_BYPASS` *(Boolean)*

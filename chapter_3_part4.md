## 3.9 CRITICAL FUNCTIONAL MODULES

### 3.9.1 AUTHENTICATION AND AUTHORIZATION MODULE

The authentication system is built upon JSON Web Tokens (JWT) implemented via `djangorestframework-simplejwt`. Upon successful login, the server issues a short-lived access token and a long-lived refresh token. The access token is included in the `Authorization: Bearer` header of every subsequent API request. The refresh token is used to obtain new access tokens without re-authentication. On the mobile client, both tokens are securely persisted using Expo Secure Store, which leverages the device's hardware-backed keychain (Android Keystore / iOS Keychain).

**Role-Based Access Control (RBAC):** Six custom DRF permission classes enforce granular access control across all API endpoints:

- `IsAdminUser` — Restricts access to super administrators (`role == 'admin'`).
- `IsCampusAdminUser` — Restricts access to campus transport administrators (`role == 'campus_admin'`).
- `IsDriverUser` — Restricts access to verified driver accounts (`role == 'driver'`).
- `IsStudentUser` — Restricts access to student accounts (`role == 'student'`).
- `IsOwnerOrAdmin` — Allows access only to the resource owner or an administrator.
- `IsPhoneVerified` — Ensures the user's phone number has been verified via OTP before granting access to sensitive operations.

**Account Lockout Mechanism:** After five consecutive failed login attempts, the `failed_login_attempts` counter triggers an automatic account lock. The `locked_until` timestamp is set, and the `is_locked` property returns `True`, preventing further authentication until the lockout period expires.

**OTP Verification:** Phone number verification uses a 6-digit OTP code delivered via the Termii SMS gateway. OTP records are stored in the `OTPVerification` model with a maximum of 3 verification attempts per code and automatic expiry. Expired OTPs are cleaned up by the `cleanup_expired_otps` Celery task.

### 3.9.2 DIGITAL WALLET AND PAYMENT MODULE

The digital wallet is the financial backbone of the LR-Ride platform, enabling cashless transactions between students and drivers. Every financial operation is wrapped in Django's `transaction.atomic()` context manager with `select_for_update()` row-level locking to guarantee ACID compliance.

**Wallet Operations:**

The `WalletService` class provides two atomic methods:

- `credit(user, amount, source, narration, ride, metadata)` — Acquires a row-level lock on the user's profile (`StudentProfile` or `DriverProfile`), increments `wallet_balance`, creates an immutable `WalletTransaction` ledger entry with `balance_before` and `balance_after` snapshots, and triggers a push notification ("Your wallet has been credited with NGN {amount}").

- `debit(user, amount, source, narration, ride, metadata)` — Acquires a row-level lock, validates `wallet_balance >= amount` (raising `ValueError` if insufficient), decrements `wallet_balance`, creates the corresponding ledger entry, and triggers a debit notification.

**Payment Gateway Integration:**

Two payment gateways are integrated for wallet top-ups:

- **Paystack (`PaystackService`):** Initialises transactions via `POST https://api.paystack.co/transaction/initialize` with amounts in kobo. Verifies transactions via `GET /transaction/verify/{reference}`. Webhook signatures are validated using HMAC SHA-512 with timing-attack-safe `hmac.compare_digest()`.

- **Flutterwave (`FlutterwaveService`):** Initialises transactions via `POST https://api.flutterwave.com/v3/payments` with amounts in Naira. Verifies transactions by reference via `GET /transactions/verify_by_reference`. Webhook signatures are validated using HMAC SHA-256 or direct secret hash comparison.

**Webhook Security Pipeline:**

Both webhook endpoints implement a multi-layered security pipeline:

1. **IP Allowlisting:** Source IP is checked against a configurable allowlist (`PAYSTACK_WEBHOOK_IP_ALLOWLIST` / `FLUTTERWAVE_WEBHOOK_IP_ALLOWLIST`).
2. **Cryptographic Signature Verification:** HMAC-based signature validation using the gateway's secret key.
3. **Timestamp Validation:** Event timestamps are validated against a configurable replay window and maximum clock skew to prevent replay attacks.
4. **Idempotency Enforcement:** A `WebhookEvent` record is created within an atomic transaction. Unique constraints on `(gateway, event_id)` and `(gateway, signature_hash)` cause `IntegrityError` on duplicate webhooks, silently returning HTTP 200.
5. **Amount and Currency Verification:** The webhook payload amount and currency are compared against the stored `GatewayTransaction` record. Mismatches are logged and silently rejected.
6. **Atomic Wallet Credit:** Only after all validations pass is the wallet credited within the same database transaction.

**Background Reconciliation:**

Celery tasks (`reconcile_paystack_pending` and `reconcile_flutterwave_pending`) periodically query for `GatewayTransaction` records that remain in `INITIATED` or `PENDING` status beyond a configurable cutoff period. They actively verify each transaction's status with the respective payment gateway API and credit the wallet if the payment was successful but the webhook was delayed or lost.

### 3.9.3 RIDE LIFECYCLE AND STATE MACHINE MODULE

The ride lifecycle is managed through a rigorous finite state machine implemented in the `Ride` model's `transition_to()` method. This method enforces strict transition rules and automatically records timestamps at each state change.

**Ride States and Valid Transitions:**

| Current State | Valid Next States |
|--------------|-------------------|
| `REQUESTED` | `SEARCHING` |
| `SEARCHING` | `DRIVER_ASSIGNED`, `CANCELLED_BY_STUDENT`, `CANCELLED_NO_DRIVER` |
| `DRIVER_ASSIGNED` | `DRIVER_EN_ROUTE`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_DRIVER` |
| `DRIVER_EN_ROUTE` | `DRIVER_ARRIVED`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_DRIVER` |
| `DRIVER_ARRIVED` | `IN_PROGRESS`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_DRIVER`, `CANCELLED_NO_SHOW` |
| `IN_PROGRESS` | `COMPLETED`, `DISPUTED` |

Any attempt to transition to an invalid state raises a `ValueError`, preventing data corruption. The `transition_to()` method also sets corresponding timestamp fields (`driver_assigned_at`, `driver_arrived_at`, `trip_started_at`, `trip_completed_at`, `cancelled_at`) automatically.

**Fare Calculation Engine:**

The `FareCalculator` class computes fares using a configurable formula:

```
raw_fare = base_fare + (per_km_rate × distance_km)
surged_fare = raw_fare × surge_multiplier
final_fare = max(surged_fare, minimum_fare)
platform_commission = final_fare × commission_rate (default: 15%)
driver_earnings = final_fare - platform_commission
```

Base fares, per-kilometre rates, and minimum fares are defined per vehicle type:

| Vehicle Type | Base Fare (₦) | Per-KM Rate (₦) | Minimum Fare (₦) |
|-------------|---------------|------------------|-------------------|
| Motorcycle | 200 | 80 | 250 |
| Tricycle | 300 | 100 | 350 |
| Sedan | 500 | 150 | 600 |
| SUV | 700 | 200 | 800 |
| Minivan | 600 | 170 | 700 |

**Ride Cancellation and Refund Logic:**

When a ride is cancelled:

- **By Student (before driver arrival):** Full wallet refund is issued via `WalletService.credit()` with source `RIDE_REFUND`. The driver's `is_on_trip` flag is reset.
- **By Driver:** Full wallet refund is issued to the student. The driver's `is_on_trip` flag is reset.
- **No Show (automated):** The Celery task `auto_mark_no_show` detects rides in `DRIVER_ARRIVED` status where the student has not appeared within 5 minutes. A 40% no-show fee is retained (credited to the driver), and the remaining 60% is refunded to the student.

### 3.9.4 REAL-TIME GEOSPATIAL TRACKING MODULE

Real-time driver tracking is implemented through Django Channels WebSocket consumers backed by a Redis pub/sub channel layer.

**WebSocket Architecture:**

Two ASGI consumers handle the real-time communication:

**`DriverLocationConsumer` (`ws/driver/location/`):**
- On connect: Authenticates the WebSocket connection via `AuthMiddlewareStack`, adds the driver to the `driver_{user_id}` channel group.
- On receive: Parses incoming JSON payloads of type `location_update` containing `latitude`, `longitude`, `heading`, `speed_kmh`, and `accuracy_meters`. Saves the position to the `DriverLocation` table via `update_or_create()`. If the driver has an active ride (status in `DRIVER_ASSIGNED`, `DRIVER_EN_ROUTE`, `DRIVER_ARRIVED`, `IN_PROGRESS`), broadcasts the location to the `ride_{ride_id}` channel group via the Redis channel layer.
- Supports `ping`/`pong` keepalive messages to maintain connection health.

**`RideTrackingConsumer` (`ws/ride/<ride_id>/track/`):**
- On connect: Authenticates the connection, verifies the user is a participant of the specified ride (student, driver, or admin), adds them to the `ride_{ride_id}` channel group.
- Receives `driver_location` broadcasts from the Redis channel layer and forwards them to the student's WebSocket connection.
- Also receives `ride_status_update` messages for real-time status change notifications.

**WebSocket Routing (ASGI Configuration):**

The `ProtocolTypeRouter` in `core/asgi.py` separates HTTP and WebSocket traffic. WebSocket connections pass through `AllowedHostsOriginValidator` (preventing cross-origin attacks) and `AuthMiddlewareStack` (extracting JWT authentication from the connection scope). URL patterns from three routing modules (`tracking`, `rides`, `notifications`) are merged into a single `URLRouter`.

### 3.9.5 DRIVER VERIFICATION MODULE

Driver onboarding follows a strict two-stage verification pipeline ensuring that only properly identified and documented drivers can accept ride requests:

**Stage 1 — Account Verification (Identity):**

1. The driver submits personal details including full name, age, state of origin (all 36 Nigerian states + FCT), residential address, 11-digit NIN (National Identification Number), and a scanned copy of their NIN document via the `AccountVerificationSubmitView`.
2. Duplicate submissions are prevented — if a verification with status `PENDING`, `UNDER_REVIEW`, or `APPROVED` already exists, the API returns HTTP 409 Conflict.
3. Campus administrators review submissions via the `AdminAccountVerificationReviewView`, which allows them to approve or reject with a reason and admin notes.
4. Upon approval, the driver's `is_verified` flag on the `User` model is set to `True`.
5. If rejected, the driver can resubmit via the `AccountVerificationResubmitView`, which resets the status to `PENDING`.

**Stage 2 — Vehicle Document Verification:**

1. Vehicle document upload is gated behind Stage 1 approval — the `DriverDocumentUploadView` checks that the driver's `AccountVerification.status == APPROVED` before accepting any document.
2. Three documents are required: Driver's Licence, Vehicle Registration, and Vehicle Insurance. A unique constraint on `(driver, document_type)` prevents duplicate uploads.
3. Each document is individually reviewed and approved/rejected by administrators via the `AdminDocumentReviewView`.
4. Upon approval of all three required documents, the `_check_driver_full_verification()` method automatically promotes the driver's `DriverProfile.verification_status` to `APPROVED` and sets `verified_at`, enabling the driver to go online and accept rides.

**Verification Progress Tracking:**

The `DriverVerificationProgressView` provides a unified progress report combining account verification status and individual vehicle document statuses, enabling the Driver App to display a clear onboarding checklist.

### 3.9.6 PUSH NOTIFICATION MODULE

The notification system ensures users receive timely, state-aware alerts for all critical platform events.

**Notification Persistence:**

The `NotificationService.notify()` method creates a persistent `Notification` database record for every alert, ensuring notifications remain accessible even if the push delivery fails. It then delegates push delivery to the `PushNotificationService`.

**Dual-Path Push Delivery:**

The `PushNotificationService` implements intelligent token routing:

- **Expo Push Tokens** (prefixed with `ExpoPushToken[` or `ExponentPushToken[`): Sent to the Expo Push API at `https://exp.host/--/api/v2/push/send` with high priority, default sound, and the `ride-status-alerts` Android channel ID.
- **Native FCM Tokens**: Sent directly to the Firebase Cloud Messaging legacy HTTP API at `https://fcm.googleapis.com/fcm/send` with server key authentication.

**Mobile-Side Notification Handling:**

The Student Mobile App's `pushNotifications.ts` module:

1. Configures the Expo notification handler to always display alerts with sound at high priority.
2. Creates an Android notification channel (`ride-status-alerts`) with vibration pattern `[0, 120, 80, 120]`.
3. Requests notification permissions from the user.
4. Obtains an Expo Push Token using the EAS project ID and registers it with the backend by patching the user's `fcm_token` field.
5. Provides `showRideStatusNotification()` for local notifications with sticky/silent options.
6. Provides `addNotificationResponseListener()` for handling notification tap actions.

**Ride Status Notifications:**

The `notify_student_ride_status()` function dispatches contextually appropriate notifications for each ride state transition:

| Ride Status | Notification Title | Notification Body |
|------------|-------------------|-------------------|
| `SEARCHING` | "Ride request received" | "We are searching for nearby drivers now." |
| `DRIVER_ASSIGNED` | "Driver found" | "{Driver Name} accepted your ride request." |
| `DRIVER_EN_ROUTE` | "Driver en route" | "Your driver is on the way to your pickup location." |
| `DRIVER_ARRIVED` | "Driver arrived" | "Your driver has arrived at your pickup point." |
| `IN_PROGRESS` | "Ride in progress" | "Your trip has started. Have a safe ride." |
| `COMPLETED` | "Ride completed" | "Your trip has been completed successfully." |
| `CANCELLED_BY_DRIVER` | "Ride cancelled by driver" | "Your driver cancelled this ride. Please request another ride." |
| `CANCELLED_NO_DRIVER` | "No driver found" | "No nearby driver accepted this ride in time." |
| `CANCELLED_NO_SHOW` | "Ride cancelled (no show)" | "This ride was cancelled because pickup did not happen in time." |

### 3.9.7 ANALYTICS AND PLATFORM MONITORING MODULE

The Campus Admin Dashboard is powered by a dedicated analytics API that provides real-time platform insights:

**Platform Summary (`PlatformSummaryView`):**

Returns aggregated metrics including: total active users (students, drivers), drivers online, drivers with approved/pending verification, total rides (all-time, today, this week, this month), active rides, completed rides, ride completion rate, average fare, total platform commission revenue, and today's revenue.

**Ride Trends (`RideTrendView`):**

Returns daily ride counts (total and completed) over a configurable period (default: 7 days, maximum: 90 days), enabling trend analysis and capacity planning.

### 3.9.8 SUPPORT TICKETING MODULE

A structured support system allows students to report issues:

- Tickets are categorised by type (Ride Issue, Payment Issue, Driver Complaint, Student Complaint, Account Issue, Other).
- Priority levels (Low, Medium, High, Urgent) enable triage by administrators.
- Status tracking (Open, In Progress, Resolved, Closed) with resolution notes.
- Tickets can be linked to specific rides for contextual investigation.

---

## 3.10 SECURITY ARCHITECTURE

### 3.10.1 TRANSPORT LAYER SECURITY

All communication between client applications and the backend server is encrypted using TLS 1.3 (Transport Layer Security). In production, the Nginx reverse proxy handles SSL/TLS certificate termination, serving all HTTP traffic over HTTPS and all WebSocket traffic over WSS (WebSocket Secure). Self-signed or Let's Encrypt certificates are configured via the `infrastructure/ssl/` directory.

### 3.10.2 AUTHENTICATION SECURITY

- **Stateless JWT Tokens:** Access tokens are short-lived, reducing the window of exploitation if a token is compromised. Refresh tokens provide session continuity without server-side session storage.
- **Token Blacklisting:** The `auth-logout` endpoint accepts the refresh token and blacklists it, preventing further token refresh.
- **Account Lockout:** Five consecutive failed login attempts trigger automatic account lockout with a configurable `locked_until` timestamp.
- **Failed Login Tracking:** The `failed_login_attempts` counter and `last_login_ip` fields enable security auditing.

### 3.10.3 FINANCIAL SECURITY

- **ACID Compliance:** All wallet operations use `transaction.atomic()` with `select_for_update()` row-level locking, preventing race conditions and ensuring data consistency under concurrent access.
- **Webhook Signature Verification:** HMAC SHA-512 (Paystack) and HMAC SHA-256 (Flutterwave) signatures are validated using timing-attack-safe comparison (`hmac.compare_digest()`).
- **Webhook IP Allowlisting:** Source IP addresses of incoming webhooks are validated against configurable allowlists.
- **Webhook Replay Protection:** Timestamp validation with configurable replay windows and clock skew tolerance. Unique constraints on `WebhookEvent` records prevent duplicate processing.
- **Amount and Currency Verification:** Webhook payload amounts are cross-referenced against stored transaction records before any wallet credit occurs.
- **Idempotency Keys:** Payment initiation requests support idempotency keys to prevent duplicate charges.
- **Immutable Audit Trail:** All `WalletTransaction` records include `balance_before` and `balance_after` snapshots, enabling forensic financial auditing.

### 3.10.4 CLIENT-SIDE SECURITY

- **Secure Token Storage:** JWT tokens are persisted using Expo Secure Store, which leverages hardware-backed encryption (Android Keystore / iOS Keychain).
- **Local PIN/Biometric Lock:** Users can set a 4-digit PIN or enable biometric authentication (fingerprint/face ID) via Expo Local Authentication. The lock screen intercepts navigation when the app resumes from background state.
- **Input Validation:** Client-side validation using Zod schemas (via React Hook Form) prevents malformed data from reaching the API. Server-side validation via DRF serializers provides a second layer of defence.

### 3.10.5 API SECURITY

- **CORS Protection:** `django-cors-headers` restricts API access to authorised origins.
- **CSRF Protection:** Django's built-in CSRF middleware protects form-based endpoints.
- **Rate Limiting:** `django-ratelimit` prevents brute-force attacks and API abuse.
- **WebSocket Authentication:** `AllowedHostsOriginValidator` prevents cross-origin WebSocket connections. `AuthMiddlewareStack` extracts and validates JWT credentials from WebSocket connection scope.
- **Ride Participant Verification:** The `RideTrackingConsumer` validates that the connecting user is either the ride's student, the assigned driver, or an admin before granting WebSocket access.

---

## 3.11 DEPLOYMENT ARCHITECTURE

### 3.11.1 CONTAINERISATION WITH DOCKER

The entire backend infrastructure is containerised using Docker Compose (v3.9). The production deployment (`docker-compose.prod.yml`) orchestrates seven services:

1. **`db`** — PostgreSQL v16-Alpine database with persistent volume storage and health checks.
2. **`redis`** — Redis v7.2-Alpine with 512MB memory limit, LRU eviction policy, and password authentication in production.
3. **`backend`** — Django application served by Daphne ASGI server on port 8000, with automatic database migrations on startup.
4. **`celery_worker`** — Four concurrent Celery worker processes consuming from `default`, `rides`, `payments`, and `notifications` queues.
5. **`celery_beat`** — Celery Beat scheduler using `django-celery-beat`'s `DatabaseScheduler` for dynamic periodic task management.
6. **`frontend`** — React.js Campus Admin Dashboard served as static files.
7. **`nginx`** — Nginx v1.25-Alpine reverse proxy handling SSL termination, static/media file serving, and HTTP/WebSocket traffic routing.

### 3.11.2 MOBILE APPLICATION DISTRIBUTION

Mobile applications are built and distributed using Expo Application Services (EAS):

- **Development Profile:** Generates development client builds with `expo-dev-client` for testing with native modules (Firebase, Maps).
- **Preview Profile:** Generates internal distribution builds for stakeholder testing.
- **Production Profile:** Generates production-signed builds with auto-incrementing version numbers for distribution via Google Play Store (Android AAB) and Apple App Store (iOS IPA).

### 3.11.3 ENVIRONMENT CONFIGURATION

Environment-specific settings are managed through Django's split settings module (`core/settings/base.py`, `development.py`, `production.py`) and environment variables loaded via `django-environ`. Sensitive credentials (database passwords, API keys, secret keys) are stored in `.env` files excluded from version control via `.gitignore`.

---

## 3.12 TESTING STRATEGY

### 3.12.1 UNIT TESTING

Comprehensive unit tests were developed using Django's `TestCase` framework and DRF's `APIClient`:

**Authentication Tests (`accounts/tests.py`):**
- Student registration with email and password verification
- Driver registration with profile placeholder creation
- OTP generation and delivery upon registration
- Duplicate phone number rejection
- Password mismatch rejection
- Data consent enforcement
- Admin role registration prevention
- JWT token issuance upon successful login
- Wrong password rejection
- Non-existent user rejection
- Authenticated `/me` endpoint access
- Unauthenticated access rejection
- Account lockout after five failed attempts
- Refresh token blacklisting on logout

**Ride Lifecycle Tests (`rides/tests.py`):**
- Student ride request creation and reference generation
- Automatic driver assignment when approved driver is online
- `CANCELLED_NO_DRIVER` when no drivers available
- Duplicate active ride prevention (`ACTIVE_RIDE_EXISTS`)
- Driver role prevented from requesting rides
- Unauthenticated ride request rejection
- Student ride history retrieval
- Full ride lifecycle progression (`DRIVER_ASSIGNED` → `DRIVER_EN_ROUTE` → `DRIVER_ARRIVED` → `IN_PROGRESS` → `COMPLETED`)
- Trip completion timestamp recording and driver stats update
- Student cancellation of assigned rides
- Student prevented from advancing ride status
- Invalid state transition prevention (`ValueError`)

### 3.12.2 INTEGRATION TESTING

Integration testing verified end-to-end workflows including:
- Complete ride booking with wallet payment, fare calculation, and driver assignment
- Wallet top-up via Paystack with webhook processing and balance verification
- WebSocket connection establishment and GPS coordinate broadcasting
- Driver verification pipeline from submission through approval to ride acceptance eligibility

---

## 3.13 SUMMARY

This chapter has presented a thorough and technically precise analysis, design, and implementation of the LR-Ride Campus Transportation Optimization and Ride-Hailing Application. The system was developed using the Agile methodology across five focused sprints, resulting in a production-ready, multi-platform ecosystem comprising a React Native Student Mobile App, a React Native Driver Mobile App, a React.js Campus Admin Dashboard, and a Django REST API backend.

The architecture leverages PostgreSQL for ACID-compliant relational data storage, Redis for real-time WebSocket pub/sub communication and Celery task brokering, Django Channels for persistent bi-directional GPS tracking, and a dual payment gateway integration (Paystack and Flutterwave) with cryptographic webhook verification ensuring financial integrity. Security is enforced at every layer through JWT authentication, RBAC, HMAC signature validation, IP allowlisting, replay protection, account lockout, and client-side PIN/biometric locking.

The system is containerised using Docker Compose for consistent deployment, with Nginx handling production SSL termination and traffic routing. Mobile applications are distributed via Expo Application Services (EAS) with support for both Android and iOS platforms. The comprehensive testing strategy, spanning unit tests and integration tests, ensures system reliability and correctness across all critical workflows.

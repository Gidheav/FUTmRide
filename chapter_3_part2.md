## 3.5 DATABASE DESIGN

The foundation of the LR-Ride backend is a meticulously normalised PostgreSQL relational database. The strategic decision to utilise an RDBMS was driven by the critical requirement for strict data consistency in the financial wallet system. Unlike NoSQL databases, PostgreSQL provides the ACID compliance, foreign key constraints, unique constraints, and transactional integrity necessary for handling monetary operations. The database schema spans ten Django applications and is managed entirely through Django's Object-Relational Mapping (ORM) with version-controlled migrations.

### 3.5.1 POSTGRESQL RELATIONAL SCHEMA

The database is structured into the following interconnected tables designed for high query performance and data integrity:

**Users Table (`users`):** The core authentication model extending Django's `AbstractBaseUser` and `PermissionsMixin`. It stores universal identity attributes including `id` (UUID, primary key), `phone_number` (unique, indexed, via `django-phonenumber-field`), `email` (unique, nullable), `first_name`, `last_name`, `role` (choices: `student`, `driver`, `admin`, `campus_admin`), `profile_photo` (ImageField), `home_address`, `is_active`, `is_staff`, `is_verified`, `is_phone_verified`, `is_email_verified`, `fcm_token` (for push notification delivery), `failed_login_attempts`, `locked_until` (DateTime, for account lockout after five failed attempts), `data_consent_given`, `data_consent_timestamp`, `session_started_at`, `last_refresh_at`, and `last_login_ip`. Database indexes are defined on the `role` field and the compound `(is_active, is_verified)` fields for query optimisation.

**Campus Table (`campuses`):** Stores university campus entities with `id` (UUID), `name` (unique), `code` (unique), and `is_active` fields, enabling multi-campus scoping for students and drivers.

**Student Profiles Table (`student_profiles`):** Extends the base user model for commuters via a One-to-One relationship. It stores `matric_number` (unique), `department`, `level`, `campus` (Foreign Key to `campuses`), `wallet_balance` (DecimalField, `max_digits=12, decimal_places=2`, ensuring high precision for financial calculations), `total_trips`, `total_distance_km`, and `average_rating_given`.

**Driver Profiles Table (`driver_profiles`):** Extends the base user model for transport operators. Key fields include `vehicle_type` (choices: `motorcycle`, `tricycle`, `sedan`, `suv`, `minivan`), `vehicle_make`, `vehicle_model`, `vehicle_year`, `vehicle_color`, `plate_number` (unique), `vehicle_seats`, `campus` (Foreign Key), `verification_status` (choices: `pending`, `under_review`, `approved`, `rejected`, `suspended`; indexed), `verification_notes`, `verified_at`, `verified_by` (Foreign Key to `users`), `is_online` (boolean, indexed, for matchmaking eligibility), `is_on_trip` (boolean), `wallet_balance` (DecimalField), `total_earnings`, `commission_rate` (default 15%), `total_trips`, `total_distance_km`, `average_rating`, `acceptance_rate`, and `cancellation_rate`. Compound indexes are defined on `(is_online, verification_status)` and `(vehicle_type)`.

**Campus Admin Profiles Table (`campus_admin_profiles`):** Links campus administrator users to their assigned campus via a One-to-One relationship with `user` and a Foreign Key to `campuses`.

**OTP Verifications Table (`otp_verifications`):** Manages One-Time Password records for phone verification, login, password reset, and transaction PIN purposes. Fields include `id` (UUID), `user` (Foreign Key), `phone_number`, `code` (6-digit string), `purpose` (choices: `phone_verification`, `login`, `password_reset`, `transaction_pin`), `is_used`, `attempts` (max 3), and `expires_at`. Compound indexes on `(phone_number, purpose, is_used)` and `(expires_at)` ensure efficient lookup and expiry cleanup.

**Rides Table (`rides`):** Manages the entire lifecycle of a transportation request. Fields include `id` (UUID), `reference` (unique, human-readable ride reference), `student` (Foreign Key, `on_delete=PROTECT`), `driver` (Foreign Key, nullable until assigned, `on_delete=SET_NULL`), `status` (choices spanning twelve states: `requested`, `searching`, `driver_assigned`, `driver_en_route`, `driver_arrived`, `in_progress`, `completed`, `cancelled_by_student`, `cancelled_by_driver`, `cancelled_no_driver`, `cancelled_no_show`, `disputed`), `vehicle_type_requested`, `requested_seats`, `pickup_latitude`, `pickup_longitude`, `pickup_address`, `dropoff_latitude`, `dropoff_longitude`, `dropoff_address`, `scheduled_pickup_time` (nullable, for future scheduled rides), `estimated_distance_km`, `actual_distance_km`, `estimated_duration_minutes`, `actual_duration_minutes`, `base_fare`, `surge_multiplier` (default 1.00), `total_fare`, `platform_commission`, `driver_earnings`, `payment_method` (choices: `wallet`, `card`, `cash`), `is_paid`, `cancellation_reason`, `cancelled_at`, `no_show_fee_amount`, `no_show_marked_at`, `emergency_activated`, `shared_with_contacts` (JSONField), `requested_at`, `driver_assigned_at`, `driver_arrived_at`, `trip_started_at`, `trip_completed_at`, and `updated_at`. The model implements a `transition_to()` method that enforces a strict state machine with validated transitions and automatic timestamp recording. Indexes are defined on `(status, requested_at)`, `(student, status)`, and `(driver, status)`.

**Driver Ride Requests Table (`driver_ride_requests`):** Tracks individual ride request offers to drivers with `id` (UUID), `ride` (Foreign Key), `driver` (Foreign Key), `response` (choices: `pending`, `accepted`, `declined`, `timed_out`), `offered_at`, and `responded_at`. A unique constraint on `(ride, driver)` prevents duplicate offers.

**Wallet Transactions Table (`wallet_transactions`):** An immutable ledger providing a complete audit trail of financial activity. It logs `id` (UUID), `reference` (unique, prefixed `CR-` for credits and `DR-` for debits), `user` (Foreign Key, `on_delete=PROTECT`), `ride` (Foreign Key, nullable), `transaction_type` (choices: `credit`, `debit`), `source` (choices: `ride_payment`, `ride_refund`, `topup_paystack`, `topup_flutterwave`, `driver_earning`, `driver_withdrawal`, `platform_commission`, `promotion`, `admin_adjustment`), `amount` (DecimalField), `balance_before`, `balance_after`, `narration`, `metadata` (JSONField), and `created_at`. Indexes on `(user, created_at)` and `(ride)` support efficient transaction history queries.

**Gateway Transactions Table (`gateway_transactions`):** Logs all interactions with external payment providers. It records `id` (UUID), `internal_reference` (unique), `idempotency_key` (indexed, nullable — prevents duplicate payment initiations), `gateway_reference` (indexed), `user` (Foreign Key, `on_delete=PROTECT`), `gateway` (choices: `paystack`, `flutterwave`), `gateway_status` (choices: `initiated`, `pending`, `success`, `failed`, `abandoned`, `reversed`), `amount`, `currency` (default `NGN`), `channel`, `gateway_response` (JSONField storing the full API/webhook response payload), `webhook_received_at`, `ip_address`, `created_at`, and `updated_at`. Compound indexes on `(user, gateway_status)` and `(gateway, gateway_status)` enable efficient reconciliation queries.

**Webhook Events Table (`webhook_events`):** Provides idempotency and replay-attack protection for incoming payment webhooks. Fields include `id` (UUID), `gateway`, `event_id` (indexed), `reference`, `signature_hash` (SHA-256 hash of the webhook signature, indexed), `payload_hash` (SHA-256 hash of the raw payload body), `ip_address`, and `received_at`. Unique constraints on `(gateway, event_id)` and `(gateway, signature_hash)` ensure that duplicate webhook deliveries are silently rejected without re-processing.

**Fare Configurations Table (`fare_configurations`):** Stores configurable pricing parameters per vehicle type. Fields include `id` (UUID), `vehicle_type` (indexed), `is_active` (indexed), `base_fare`, `per_km_rate`, `minimum_fare`, `booking_fee`, `surge_enabled`, `max_surge_multiplier` (default 2.00), `effective_from`, `effective_to` (nullable), `created_by` (Foreign Key, `on_delete=PROTECT`), and `notes`. This table enables campus administrators to adjust pricing without code changes.

**Account Verifications Table (`account_verifications`):** Stage 1 of the driver verification pipeline. Fields include `id` (UUID), `driver` (One-to-One to `users`), `full_name`, `age`, `state_of_origin` (choices covering all 36 Nigerian states plus FCT), `address`, `nin_number` (11-digit National Identification Number), `nin_scan` (FileField for scanned NIN document), `status` (choices: `pending`, `under_review`, `approved`, `rejected`), `rejection_reason`, `admin_notes`, `reviewed_by` (Foreign Key), `reviewed_at`, and `submitted_at`. Indexes on `(status)` and `(driver, status)`.

**Driver Documents Table (`driver_documents`):** Stage 2 of the driver verification pipeline. Fields include `id` (UUID), `driver` (Foreign Key), `document_type` (choices: `drivers_license`, `vehicle_registration`, `vehicle_insurance`, `profile_photo`, `vehicle_photo`), `file` (FileField), `status` (choices: `pending`, `approved`, `rejected`), `rejection_reason`, `admin_notes`, `reviewed_by` (Foreign Key), `reviewed_at`, and `uploaded_at`. A unique constraint on `(driver, document_type)` prevents duplicate document uploads. Upon approval of all three required documents (driver's licence, vehicle registration, vehicle insurance), the system automatically promotes the driver's `verification_status` to `approved`.

**Notifications Table (`notifications`):** Stores persistent records of all system alerts dispatched to users. Fields include `id` (UUID), `user` (Foreign Key), `notification_type` (choices: `ride_requested`, `driver_assigned`, `driver_arrived`, `trip_started`, `trip_completed`, `ride_cancelled`, `payment_received`, `account_approved`, `general`), `title`, `body`, `data` (JSONField for structured payload), `is_read` (boolean, indexed), and `created_at` (indexed). An index on `(user, is_read)` enables efficient unread notification counts.

**Driver Locations Table (`driver_locations`):** Stores the most recent GPS position of each active driver. Uses the driver's user as a One-to-One primary key. Fields include `latitude`, `longitude`, `heading`, `speed_kmh`, `accuracy_meters`, and `updated_at` (indexed). This table is updated via `update_or_create()` from the `DriverLocationConsumer` WebSocket handler on each GPS broadcast.

**Trip Location Snapshots Table (`trip_location_snapshots`):** Records historical GPS breadcrumbs during active trips for route reconstruction and audit purposes. Fields include `id` (UUID), `ride` (Foreign Key), `recorded_by` (Foreign Key to `users`), `latitude`, `longitude`, `heading`, `speed_kmh`, and `timestamp` (indexed). An index on `(ride, timestamp)` supports efficient trip replay queries.

**Support Tickets Table (`support_tickets`):** Manages student-submitted issues and complaints. Fields include `id` (UUID), `reference` (unique), `submitted_by` (Foreign Key), `assigned_to` (Foreign Key, nullable), `ride` (Foreign Key, nullable), `category` (choices: `ride_issue`, `payment_issue`, `driver_complaint`, `student_complaint`, `account_issue`, `other`), `subject`, `description`, `status` (choices: `open`, `in_progress`, `resolved`, `closed`; indexed), `priority` (choices: `low`, `medium`, `high`, `urgent`), `resolution_notes`, `created_at`, `updated_at`, and `resolved_at`. Indexes on `(status, priority)` and `(submitted_by, status)`.

**Ratings Table (`ratings`):** Stores post-ride ratings between students and drivers. Fields include `id` (UUID), `ride` (Foreign Key), `rater` (Foreign Key), `ratee` (Foreign Key), `rating_type` (choices: `student_to_driver`, `driver_to_student`), `score` (1–5, validated via `MinValueValidator` and `MaxValueValidator`), `comment` (max 500 characters), and `created_at`. A unique constraint on `(ride, rater, rating_type)` prevents duplicate ratings per ride.

---

## 3.6 SYSTEM MODELLING USING UML DIAGRAMS

Unified Modeling Language (UML) diagrams were employed to visually formalise the architecture, structural constraints, and behavioural workflows of the LR-Ride application, ensuring precise alignment between system design and codebase implementation. The following UML diagrams were developed: Use Case Diagram, Class Diagram, Sequence Diagrams, Activity Diagram, and Entity Relationship (ER) Diagram.

### 3.6.1 USE CASE DIAGRAM

The Use Case Diagram delineates the boundary of the system and maps the interactions between the four primary actors and their permissible operations:

**Student Actor:**
- Register with Email and Password
- Verify Phone Number via OTP
- Login and Receive JWT Tokens
- Set Security PIN / Enable Biometric Lock
- Fund Digital Wallet (via Paystack or Flutterwave WebView)
- View Wallet Balance and Transaction History
- Request Ride (Select Vehicle Type, Seats, Pickup and Dropoff Locations)
- Track Assigned Driver via WebSocket on Live Map
- Cancel Pending or Active Ride
- View Ride History
- Rate Driver After Completed Ride
- Submit Support Ticket (Ride Issue, Payment Issue, Driver Complaint)
- Receive Push Notifications for Ride Status Updates
- Manage Profile and Notification Settings

**Driver Actor:**
- Register with Phone Number and Password
- Verify Phone Number via OTP
- Submit Account Verification (Personal Details and NIN Scan)
- Submit Vehicle Documents (Driver's Licence, Vehicle Registration, Vehicle Insurance)
- Toggle Online/Offline Matchmaking Availability
- View Ride Marketplace (Available Ride Requests)
- Accept Ride Request from Marketplace
- Advance Ride Status (En Route → Arrived → In Progress → Completed)
- Cancel Assigned Ride
- Broadcast Background GPS Coordinates via WebSocket
- View Earnings, Wallet Balance, and Trip History
- Rate Student After Completed Ride
- Manage Account Settings and Vehicle Profile

**Campus Administrator Actor:**
- Login to Secure Web Dashboard
- View Platform Analytics (Total Users, Rides, Revenue, Trends)
- Review and Approve/Reject Driver Account Verifications (NIN)
- Review and Approve/Reject Driver Vehicle Documents
- Revoke Driver Verification Status
- View and Manage All User Accounts
- Monitor Active and Historical Rides
- Audit Wallet Transactions
- View and Respond to Support Tickets

**Super Administrator Actor:**
- All Campus Administrator privileges
- Access Django Admin Panel
- Create Campus Admin Accounts
- Configure Fare Pricing Parameters
- Manage Campus Entities

### 3.6.2 SEQUENCE DIAGRAMS

Sequence diagrams map the chronological sequence of messages passed between system objects during critical operations.

**Sequence Diagram 1 — Student Requests a Ride (Wallet Payment):**

1. The Student Mobile App transmits a POST request to `/api/v1/rides/request/` containing `pickup_latitude`, `pickup_longitude`, `pickup_address`, `dropoff_latitude`, `dropoff_longitude`, `dropoff_address`, `vehicle_type_requested`, `requested_seats`, and `payment_method: "wallet"`.
2. The Django API verifies the student's JWT access token and checks that no active ride already exists for this student (preventing duplicate bookings).
3. The `RideRequestView` creates a new `Ride` record and transitions its status from `REQUESTED` to `SEARCHING` via the `transition_to()` state machine method.
4. The `FareCalculator.calculate()` service computes the fare based on `base_fare + (per_km_rate × distance_km)`, applies any surge multiplier, enforces the minimum fare, and calculates the platform commission (15%) and driver earnings (85%).
5. Since `payment_method` is `wallet`, the `WalletService.debit()` method is invoked within a `transaction.atomic()` block. It acquires a row-level lock on the student's `StudentProfile` via `select_for_update()`, verifies that `wallet_balance >= total_fare`, deducts the fare, creates a `WalletTransaction` ledger entry (type: `DEBIT`, source: `RIDE_PAYMENT`), and commits the transaction. If the balance is insufficient, the ride is immediately cancelled with status `CANCELLED_BY_STUDENT` and an `INSUFFICIENT_WALLET` error is returned.
6. The `notify_student_ride_status()` function dispatches a push notification: "We are searching for nearby drivers now."
7. The ride appears in the Driver App's marketplace endpoint (`/api/v1/rides/marketplace/`).

**Sequence Diagram 2 — Driver Accepts Ride and Real-Time Tracking:**

1. The Driver Mobile App polls the marketplace endpoint and displays available ride requests.
2. The Driver taps "Accept"; the Driver App sends a POST request to `/api/v1/rides/{ride_id}/accept/`.
3. The `DriverAcceptRideView` acquires atomic locks on both the `DriverProfile` (via `select_for_update()`) and the `Ride` (via `select_for_update()`). It validates that: the driver is approved, online, not already on a trip, has no active ride, and the ride status is still `SEARCHING`. It then assigns the driver to the ride, transitions the status to `DRIVER_ASSIGNED`, creates a `DriverRideRequest` record with response `ACCEPTED`, and sets `is_on_trip = True` on the driver profile.
4. The backend dispatches an Expo/FCM push notification to the Student App: "{Driver Name} accepted your ride request."
5. The Driver App opens a WebSocket connection to `ws://api/ws/driver/location/`. The `DriverLocationConsumer` authenticates the connection, adds the driver to the `driver_{user_id}` channel group, and accepts the connection.
6. The Student App opens a WebSocket connection to `ws://api/ws/ride/{ride_id}/track/`. The `RideTrackingConsumer` verifies the user is a ride participant (student or driver), adds them to the `ride_{ride_id}` channel group, and accepts the connection.
7. The Driver App utilises the Expo Location API to poll the device's GPS hardware and transmits `{ type: "location_update", latitude, longitude, heading, speed_kmh, accuracy_meters }` JSON payloads over the WebSocket.
8. The `DriverLocationConsumer` receives the payload, saves it to the `DriverLocation` table via `update_or_create()`, queries for the driver's active ride ID, and broadcasts the location to the `ride_{ride_id}` Redis channel group.
9. The `RideTrackingConsumer` on the student's connection receives the broadcast and forwards it to the student's WebSocket. The Student App parses the coordinates and animates the vehicle marker on the Google Map.

**Sequence Diagram 3 — Wallet Top-Up via Paystack Webhook:**

1. Student navigates to the Wallet interface, enters a top-up amount, and selects Paystack.
2. The Mobile App sends a POST request to `/api/v1/payments/topup/` with `amount`, `gateway: "paystack"`, and `callback_url`. An `Idempotency-Key` header is optionally included to prevent duplicate initiations.
3. The `InitiateTopUpView` invokes `PaystackService.initialize_transaction()`, which sends a POST to `https://api.paystack.co/transaction/initialize` with the amount in kobo, generates a unique reference (prefixed `PS-`), creates a `GatewayTransaction` record with status `PENDING`, and returns the `authorization_url`.
4. The Mobile App opens the Paystack checkout in a WebView. The student enters card details and completes 3D Secure verification.
5. Paystack processes the payment and asynchronously POSTs a webhook payload to the Django backend's `/api/v1/payments/webhooks/paystack/` endpoint with an `X-Paystack-Signature` HTTP header.
6. The `PaystackWebhookView` first validates the source IP against the configured allowlist. It then computes the HMAC SHA-512 hash of the raw request body using the Paystack secret key and performs a timing-attack-safe comparison (`hmac.compare_digest()`) against the `X-Paystack-Signature` header. If the signature is invalid, the request is rejected with HTTP 400.
7. The view validates the event timestamp against a configurable replay window (default: 60 minutes) and maximum clock skew (default: 10 minutes) to prevent replay attacks.
8. A `WebhookEvent` record is created within `transaction.atomic()`. The unique constraint on `(gateway, event_id)` and `(gateway, signature_hash)` causes an `IntegrityError` if this webhook has already been processed, silently returning HTTP 200 (idempotency).
9. For `charge.success` events: the view acquires a `select_for_update()` lock on the `GatewayTransaction`, verifies the amount (kobo) and currency match exactly, updates the gateway status to `SUCCESS`, and invokes `WalletService.credit()` within the same atomic transaction to increment the student's `wallet_balance` and create a `WalletTransaction` ledger entry (source: `TOPUP_PAYSTACK`).
10. The `WalletService.credit()` method also triggers a push notification via `NotificationService.notify()`: "Your wallet has been credited with NGN {amount}."
11. The Student App, polling the `/api/v1/payments/topup/{reference}/status/` endpoint or receiving the push notification, refreshes the Zustand wallet store, updating the UI balance display.

### 3.6.3 ACTIVITY DIAGRAM

The Activity Diagram models the step-by-step control flow of the ride booking process:

1. **START** — Student opens the LR-Ride application.
2. System checks if a valid JWT access token exists in Expo Secure Store. If not, redirect to Login/Registration screen.
3. If the app lock PIN/biometric is enabled, the `AppLockPage` intercepts navigation and requires verification.
4. On successful authentication, the Dashboard (Live Map) is displayed.
5. Student selects pickup and dropoff locations on the map, chooses a vehicle type, and taps "Book Ride."
6. The `BookRidePage` validates inputs and sends a POST request to the Django API.
7. **Decision Node:** Does the student have sufficient wallet balance (if wallet payment)?
   - If No → System returns `INSUFFICIENT_WALLET` error. Student is prompted to fund wallet. Return to Step 5.
   - If Yes → Proceed to Step 8.
8. Ride is created with status `SEARCHING`. Wallet is debited. `RideMatchingPage` displays a searching animation.
9. Ride appears in the Driver marketplace. Student polls the active ride endpoint.
10. **Decision Node:** Does a driver accept within the timeout window?
    - If No → Celery task `expire_unassigned_rides` transitions the ride to `CANCELLED_NO_DRIVER`. Student is notified and wallet is refunded. Return to Step 5.
    - If Yes → Proceed to Step 11.
11. Ride status transitions to `DRIVER_ASSIGNED`. Student receives push notification with driver details.
12. `ActiveRidePage` displays driver information (name, plate number, vehicle type, phone) and initiates WebSocket connection for live tracking.
13. Driver advances ride through states: `DRIVER_EN_ROUTE` → `DRIVER_ARRIVED` → `IN_PROGRESS` → `COMPLETED`. Push notifications dispatched at each transition.
14. Upon `COMPLETED`: driver earnings are credited to driver's wallet, student's `total_trips` is incremented, driver's `total_trips` and `total_earnings` are updated.
15. Student may optionally rate the driver (1–5 stars with comment).
16. **END.**

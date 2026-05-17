# CHAPTER THREE

## 3.0 SYSTEM ANALYSIS, DESIGN AND IMPLEMENTATION

## 3.1 INTRODUCTION

This chapter presents a comprehensive analysis, design, and implementation of the LR-Ride Campus Transportation Optimization and Ride-Hailing Application developed for the Federal University of Technology, Minna (FUT Minna). The chapter exhaustively covers the adopted software development methodology, system requirements analysis, architectural framework, database design, interface design, Unified Modeling Language (UML) modelling, implementation tools and technologies, and the critical functional modules that constitute the complete system.

The primary objective of the LR-Ride system is to eliminate the persistent transportation challenges faced by students commuting between the Bosso and Gidan Kwano campuses, and within the campus premises. This is achieved through an on-demand ride-matching platform featuring an integrated digital wallet payment system, real-time GPS tracking via WebSockets, and support for multiple vehicle types including sedans, tricycles (Keke), motorcycles, SUVs, and minivan shuttles.

The system is composed of four distinct software applications: a cross-platform Student Mobile Application (React Native and Expo), a dedicated Driver Mobile Application (React Native and Expo), a monolithic backend server (Django and Django REST Framework), and a browser-based Campus Admin Dashboard (React.js with Vite). All four applications communicate over a unified RESTful API layer, supplemented by persistent WebSocket connections for real-time geospatial tracking.

---

## 3.2 SOFTWARE DEVELOPMENT METHODOLOGY

The Agile Software Development Methodology was adopted for the development of the LR-Ride application. Agile is an iterative, incremental, and highly collaborative approach to software engineering that prioritises adaptability, continuous integration, and rapid delivery of functional software modules. Unlike the traditional Waterfall model which requires rigid upfront specifications, the Agile framework was essential for this project due to the complex, dynamic nature of the ride-hailing ecosystem. Features such as real-time WebSocket location streaming, concurrent financial wallet transactions, and third-party payment gateway webhook verification demanded continuous testing, iterative refinement, and rapid adaptation to edge cases discovered during development.

Agile methodology was specifically chosen for this project for several compelling reasons. First, the ride-hailing domain involves multiple real-time subsystems — location tracking, payment processing, and notification delivery — that must be developed and tested incrementally rather than in isolation. Second, Agile facilitates continuous stakeholder feedback, allowing the system to evolve based on actual student and driver usability testing throughout development. Third, the methodology's sprint-based structure ensures that core features such as ride matching, wallet transactions, and live tracking could be developed, evaluated, and refined progressively before full system integration.

The development lifecycle was structured into five distinct, highly focused sprints:

- **Sprint 1 — Requirements and Backend Infrastructure (Weeks 1–2):** This phase involved comprehensive system requirements specification, technology stack selection (React Native, Django, PostgreSQL, Redis), and establishment of the foundational backend infrastructure. It included initial Django application configuration with ten discrete Django apps (`accounts`, `rides`, `payments`, `tracking`, `notifications`, `verification`, `pricing`, `ratings`, `support`, and `analytics`), relational database schema design, Docker containerisation setup, and Redis datastore configuration for asynchronous task processing via Celery.

- **Sprint 2 — Authentication, Security and User Management (Weeks 3–4):** This sprint focused on implementing a secure, token-based authentication system using JSON Web Tokens (JWT) via the `djangorestframework-simplejwt` library. It included developing distinct user profiles (Student, Driver, Campus Admin, and Super Admin), enforcing Role-Based Access Control (RBAC) through custom Django REST Framework permission classes (`IsAdminUser`, `IsCampusAdminUser`, `IsDriverUser`, `IsStudentUser`, `IsOwnerOrAdmin`, `IsPhoneVerified`), implementing OTP-based phone number verification via Termii SMS gateway, and building the local PIN-based and biometric application lock for securing the mobile interface using Expo Secure Store and Expo Local Authentication.

- **Sprint 3 — Digital Wallet and Payment Integration (Weeks 5–7):** A critical sprint dedicated to the financial backbone of the application. The digital wallet module was developed with strict ACID (Atomicity, Consistency, Isolation, Durability) compliance using Django's `transaction.atomic()` database blocks with `select_for_update()` row-level locking. Integrations with Paystack and Flutterwave payment gateways were engineered, including cryptographic HMAC SHA-512 webhook signature verification to prevent fraudulent wallet top-ups. Celery background tasks were implemented for automated payment reconciliation (`reconcile_paystack_pending`, `reconcile_flutterwave_pending`).

- **Sprint 4 — Geospatial Mapping, Ride Matching and WebSockets (Weeks 8–10):** This sprint introduced the core ride-hailing functionality. It encompassed Google Maps integration for route visualisation on both Android and iOS, implementation of the fare calculation engine with configurable base fares, per-kilometre rates, and minimum fares per vehicle type, and deployment of Django Channels (ASGI) backed by Redis to handle persistent, real-time WebSocket connections for live driver tracking. The ride lifecycle state machine was implemented with strict transition validation across twelve distinct states. A two-stage driver verification pipeline was also built, requiring identity verification (NIN submission) followed by vehicle document verification before drivers could accept rides.

- **Sprint 5 — Notifications, Campus Admin Panel and System Optimisation (Weeks 11–12):** The final development phase involved integrating a dual push notification delivery system supporting both Expo Push Notifications (for Expo-managed builds) and Firebase Cloud Messaging (FCM) for production Android builds, with Apple Push Notification service (APNs) support for iOS. The React.js Campus Admin Dashboard was finalised using Vite as the build tool, enabling transport administrators to verify driver accounts, review submitted documents (NIN scans, driver's licences, vehicle registrations, insurance), monitor active rides, audit wallet transactions, manage user accounts, and view platform analytics. The sprint concluded with comprehensive integration testing, performance profiling, Celery Beat periodic task scheduling, and Docker-based production deployment preparation with Nginx reverse proxy configuration.

---

## 3.3 SYSTEM REQUIREMENTS ANALYSIS

### 3.3.1 FUNCTIONAL REQUIREMENTS

Functional requirements explicitly define the operations, behaviours, and core capabilities the system must execute. Based on the operational needs of FUT Minna commuters, the following functional requirements were identified and implemented:

1. The system shall allow students and drivers to securely register and authenticate. Students register via email (university email format) and password, while drivers register via phone number and password. Authentication is managed through JWT token pairs (access and refresh tokens).

2. The system shall enforce phone number verification via One-Time Password (OTP) delivered through the Termii SMS gateway before granting full account access.

3. The system shall provide an integrated digital wallet for both students and drivers, enabling students to fund their accounts via external payment gateways (Paystack and Flutterwave) and seamlessly pay for rides without physical cash.

4. The system shall allow students to request specific vehicle classes (Sedan, Tricycle, Motorcycle, SUV, Minivan/Shuttle) based on seating requirements and intended campus route.

5. The system shall automatically pair a student's ride request with available, verified, online drivers through a marketplace model where drivers can view and accept ride requests.

6. The system shall establish and maintain active WebSocket connections to broadcast live GPS coordinates of the assigned driver to the student's mobile device during an active trip, using Django Channels backed by a Redis channel layer.

7. The system shall deduct the exact ride fare from the student's digital wallet upon ride request creation (for wallet payments), ensuring strict financial accuracy through database atomic transactions with row-level locking via `select_for_update()`.

8. The system shall dispatch intelligent, state-aware push notifications to the student's device when ride status transitions occur (Searching, Driver Assigned, Driver En Route, Driver Arrived, Trip In Progress, Trip Completed, Ride Cancelled).

9. The system shall provide a comprehensive Campus Admin Dashboard for university transport staff to verify driver accounts and vehicle documents, monitor live trips, audit wallet transactions, manage user accounts, view platform analytics (total users, ride trends, revenue), and review support tickets.

10. The system shall incorporate a local security layer — specifically a user-defined PIN and biometric authentication via Expo Local Authentication — to protect the digital wallet and sensitive profile data when the application resumes from background state.

11. The system shall implement a two-stage driver verification pipeline: Stage 1 (Account Verification) requires submission of personal identity details and National Identification Number (NIN) scan; Stage 2 (Vehicle Verification) requires submission of driver's licence, vehicle registration, and vehicle insurance documents, which are individually reviewed and approved by campus administrators.

12. The system shall maintain an immutable, chronologically ordered ledger of all wallet transactions (credits, debits, top-ups, refunds, driver earnings, platform commissions) to facilitate transparent auditing and dispute resolution.

13. The system shall support a ticketing-based support system allowing students to report issues (ride issues, payment issues, driver complaints, account issues) with priority classification (Low, Medium, High, Urgent) and status tracking (Open, In Progress, Resolved, Closed).

14. The system shall allow students and drivers to rate each other after completed rides using a 1-to-5 star rating system with optional text comments.

15. The system shall implement automated background tasks via Celery for expiring unassigned ride requests, reconciling pending payment gateway transactions, marking no-show rides, and cleaning up expired OTP records.

### 3.3.2 NON-FUNCTIONAL REQUIREMENTS

Non-functional requirements dictate the quality attributes, performance metrics, and security standards of the system:

1. **Performance:** The backend ASGI WebSocket server shall broadcast high-frequency GPS coordinate updates to the client application with end-to-end latency not exceeding 1.5 seconds. REST API endpoints shall respond within 200 milliseconds for standard queries.

2. **Reliability:** The core financial engine handling the digital wallet must guarantee data consistency. In the event of network failure during a transaction, the system must utilise database rollbacks via `transaction.atomic()` to prevent accidental fund deduction or duplication. Idempotency keys are enforced on all payment initiation and webhook processing endpoints.

3. **Scalability:** The architecture shall support horizontal scaling. The Docker-containerised Django backend, Celery workers (with four concurrent processes across `default`, `rides`, `payments`, and `notifications` queues), Redis channel layers, and PostgreSQL database must handle hundreds of concurrent WebSocket connections and API requests during peak campus commuting hours.

4. **Security:** All network communication, including REST API endpoints and WebSocket streams, shall be strictly encrypted over TLS 1.3 (HTTPS/WSS) in production. External payment webhooks must be cryptographically validated via HMAC SHA-512 (Paystack) and HMAC SHA-256 (Flutterwave) before any database records are altered. Webhook IP address allowlisting is enforced. Account lockout occurs after five consecutive failed login attempts.

5. **Usability:** The mobile interface, engineered with React Native, must provide an intuitive user experience, ensuring crucial features like ride booking and wallet funding require minimal screen taps and remain responsive under degraded mobile network conditions. The interface utilises React Native's flexbox layout system and SafeAreaContext for proper rendering across all device form factors.

6. **Compatibility:** The mobile application shall be fully compatible with Android devices running OS version 8.0 (Oreo) and above, as well as iOS devices, leveraging Expo's cross-platform rendering engine. The Campus Admin Dashboard shall function on all modern web browsers.

### 3.3.3 SYSTEM CONSTRAINTS

The design and deployment of the system were subject to the following constraints:

1. Real-time driver tracking, ride matching, and wallet synchronisation necessitate an active internet connection; the system architecture does not support offline peer-to-peer ride hailing.

2. Driver mobile devices must possess active GPS hardware and grant location permissions to enable transmission of coordinates via the Expo Location API.

3. The delivery speed of push notifications is subject to Firebase Cloud Messaging (FCM) and Apple Push Notification service (APNs) network availability. Push notifications are not available when running in Expo Go on Android; a development build with `google-services.json` Firebase configuration is required.

4. Wallet top-up finalisation is strictly dependent on the uptime and network reliability of third-party payment processors (Paystack and Flutterwave). Celery-based background reconciliation tasks mitigate delayed webhook delivery.

5. GPS accuracy is subject to satellite signal conditions and may vary by up to 10–15 metres in areas with dense vegetation or tall structures on campus.

6. Driver accounts cannot accept rides until both the Account Verification (NIN) and all required Vehicle Documents (driver's licence, vehicle registration, vehicle insurance) are individually approved by a campus administrator.

---

## 3.4 SYSTEM ARCHITECTURE

### 3.4.1 OVERVIEW OF THE THREE-TIER ARCHITECTURE

The LR-Ride application was engineered using a robust Three-Tier Client-Server Architecture, purposefully selected to cleanly separate concerns, maximise security, and allow independent scaling of the user interface and data-processing backend.

The three tiers interact as follows:

**Tier 1 — Presentation Tier (Frontend):** This tier encompasses the user-facing interfaces. It consists of: (a) the cross-platform Student Mobile Application built with React Native v0.81.5 and Expo SDK 54, (b) the dedicated Driver Mobile Application also built with React Native and Expo, and (c) the React.js Campus Admin Dashboard built with Vite v8.0 and TypeScript. The mobile apps communicate with the backend via Axios for REST API calls and utilise native WebSocket APIs for live location tracking during active rides.

**Tier 2 — Application Logic Tier (Backend):** This tier encapsulates the complex business rules, financial processing, and routing logic. It is powered by Django v5.1.4 (Python 3) utilising the Django REST Framework v3.15.2 for synchronous HTTP requests, Django Channels v4.1.0 paired with the Daphne ASGI server v4.1.2 for handling asynchronous WebSocket connections, and Celery v5.4.0 with Celery Beat for distributed background task processing. This tier processes all ride matching, fare calculation, wallet transactions, driver verification workflows, and notification dispatching across ten discrete Django applications.

**Tier 3 — Data Tier (Database):** This tier is responsible for secure, persistent storage and rapid data retrieval. It employs PostgreSQL v16 (Alpine) as the primary Relational Database Management System (RDBMS) for structured, ACID-compliant persistent data, and Redis v7.2 (Alpine) as an in-memory message broker to facilitate rapid pub/sub communication required by the Django Channels WebSocket layer and as the Celery task broker.

### 3.4.2 COMPONENT DESCRIPTION

The LR-Ride ecosystem comprises the following integral technical components:

**i. Student Mobile Application (`mobile/`):** The primary interface for campus commuters. It features a full-screen interactive Google Map via React Native Maps v1.20.1, a dynamic ride-booking interface with vehicle type selection, a secure digital wallet interface with Paystack/Flutterwave WebView integration, a notification centre, ride history, account management with PIN/biometric lock, and profile editing. It communicates with the backend via Axios for REST API calls and utilises WebSocket connections for live location tracking during active rides.

**ii. Driver Mobile Application (`driver-mobile/`):** A specialised interface for transport operators. It handles driver registration, two-stage identity and vehicle document verification (Account Verification with NIN scan, followed by driver's licence, vehicle registration, and vehicle insurance upload), toggles online/offline availability, presents a ride marketplace showing available ride requests, manages ride lifecycle progression (Accept → En Route → Arrived → In Progress → Completed), and provides wallet and earnings management. It uses React Query (`@tanstack/react-query`) for efficient server state management.

**iii. Campus Admin Dashboard (`frontend/`):** A browser-based React.js application built with Vite, React Router v7, and TailwindCSS. It provides campus administrators with a comprehensive management interface including: a dashboard with platform-wide analytics (total users, rides, revenue), a driver verification review system (account verification and vehicle document approval/rejection), a user management panel, a rides monitor, and support ticket management. It communicates with the backend through Axios and uses Zustand v5 for client-side state management.

**iv. Django REST API and Financial Engine (`backend/`):** The monolithic core of the application comprising ten Django apps. It manages JWT authentication via `djangorestframework-simplejwt`, enforces role-based access permissions through six custom permission classes, calculates ride fares via the `FareCalculator` service class, executes atomic wallet transactions using `transaction.atomic()` with `select_for_update()` row-level locking, processes cryptographically verified payment webhooks, and acts as the ultimate source of truth for all system states.

**v. Django Channels and ASGI Server:** The asynchronous networking layer responsible for maintaining persistent, bi-directional WebSocket connections. It implements two WebSocket consumers: `DriverLocationConsumer` (for drivers to broadcast GPS coordinates) and `RideTrackingConsumer` (for students to receive real-time driver location during active rides). The ASGI application is configured via `ProtocolTypeRouter` to route both HTTP and WebSocket traffic, with `AllowedHostsOriginValidator` and `AuthMiddlewareStack` for security.

**vi. PostgreSQL Database:** A highly reliable, ACID-compliant relational database (v16-Alpine). It was chosen over NoSQL alternatives specifically because the digital wallet system requires strict relational integrity, foreign key constraints, decimal-precision financial fields (`DecimalField` with `max_digits=12, decimal_places=2`), and transactional rollbacks to guarantee financial data consistency.

**vii. Redis Message Broker:** An in-memory data structure store (v7.2-Alpine) utilised in two critical capacities: (a) as the channel layer backend for Django Channels, routing incoming driver GPS coordinates to the specific WebSocket room (`ride_{ride_id}`) that the corresponding student is subscribed to, achieving near-instantaneous data delivery; and (b) as the message broker for Celery, distributing background tasks across four named queues (`default`, `rides`, `payments`, `notifications`).

**viii. Celery Task Queue:** An asynchronous distributed task queue (v5.4.0) responsible for background processing including: expiring unassigned ride requests (`expire_unassigned_rides`), reconciling pending payment transactions with Paystack and Flutterwave (`reconcile_paystack_pending`, `reconcile_flutterwave_pending`), automatically marking no-show rides (`auto_mark_no_show`), cleaning up expired OTP records (`cleanup_expired_otps`), and dispatching asynchronous notifications. Celery Beat provides periodic task scheduling via `django-celery-beat` with database-backed schedule storage.

**ix. Push Notification Delivery System:** A dual-path notification routing engine. The `PushNotificationService` class detects whether the user's FCM token is an Expo Push Token (prefixed with `ExpoPushToken[` or `ExponentPushToken[`) and routes accordingly: Expo tokens are sent to the Expo Push API (`https://exp.host/--/api/v2/push/send`), while native FCM tokens are sent directly to the FCM legacy HTTP API (`https://fcm.googleapis.com/fcm/send`). All notifications are persisted to the database via the `NotificationService` class and dispatched as high-priority alerts with sound on the `ride-status-alerts` Android notification channel.

**x. Nginx Reverse Proxy (Production):** In the production Docker Compose configuration, an Nginx v1.25 (Alpine) container handles SSL/TLS certificate termination, serves static files and media assets, and expertly routes standard HTTP requests versus upgradeable WebSocket (WSS) traffic to the Daphne ASGI backend.

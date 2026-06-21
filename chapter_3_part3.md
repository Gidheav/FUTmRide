## 3.7 INTERFACE DESIGN

### 3.7.1 DESIGN PRINCIPLES

The LR-Ride User Interface (UI) was architected using three fundamental design tenets:

**Simplicity and Intuitiveness:** The application must be operable by any student regardless of technical literacy. All primary functions — booking a ride, funding the wallet, and tracking a driver — are accessible within three taps from the home screen. The interface utilises familiar patterns such as bottom sheet modals, clear iconography, and prominent call-to-action buttons.

**Uncompromising Security:** Financial interfaces are heavily guarded. Accessing the Wallet or modifying profile details triggers the local PIN/Biometric lock screen (implemented via Expo Local Authentication and Expo Secure Store), preventing unauthorised access if the device is left unlocked. Balance visibility is displayed in a secure, toggleable format.

**Contextual Responsiveness:** The interface adapts flawlessly across varying mobile screen dimensions utilising React Native's flexbox layout system and SafeAreaContext (v5.6.0), ensuring that map controls and bottom sheets never overlap with hardware notches or navigation bars. Real-time data (driver location, ETA, wallet balance) is displayed in legible, unambiguous formats even under outdoor lighting conditions.

### 3.7.2 SCREEN LAYOUT DESCRIPTION — STUDENT MOBILE APPLICATION

The Student Mobile Application comprises the following primary screens:

| Screen | Description | Key UI Elements |
|--------|-------------|-----------------|
| **Splash / Onboarding** | Displayed on first launch; introduces the app to new users | FUT Minna branding, app name "LRRIDE", purple gradient theme (#5B2D8E), 'Get Started' button |
| **Login Screen** (`LoginScreen.tsx`) | JWT-based authentication with email and password | Email field, password field, login button, 'Register' link, role-aware routing |
| **Dashboard / Live Map** (`DashboardScreen.tsx`) | Core screen displaying a full-screen interactive Google Map with campus locations | Google Map widget (React Native Maps), campus location markers for Bosso and Gidan Kwano, categorised location directory (Lecture Theatres, Labs, Admin Blocks), ride booking entry point |
| **Book Ride** (`BookRidePage.tsx`) | Ride request creation interface with location and vehicle selection | Pickup/dropoff location selectors, vehicle type picker (Motorcycle, Tricycle, Sedan, SUV, Minivan), seat count, payment method selector (Wallet/Cash), fare estimate display, 'Book Ride' button |
| **Ride Matching** (`RideMatchingPage.tsx`) | Animated searching interface displayed while waiting for driver assignment | Searching animation, ride reference display, real-time status polling, cancel button, transition to Active Ride on driver assignment |
| **Active Ride** (`ActiveRidePage.tsx`) | Replaces the standard dashboard when a ride is in progress | Driver info banner (name, plate number, vehicle type, phone number), ride status indicator (En Route / Arrived / In Progress), WebSocket-powered live driver tracking on map, emergency call button, cancel ride option |
| **Wallet & Transactions** (`WalletPage.tsx`) | Financial hub for managing digital funds | Current balance display (toggleable visibility), 'Fund Wallet' button, gateway selector (Paystack/Flutterwave), top-up amount input, Paystack/Flutterwave WebView checkout, chronological transaction history list with colour-coded icons (green for credits, red for debits), pull-to-refresh |
| **Ride History** (`RidesPage.tsx`) | Chronological list of all completed and cancelled rides | Ride cards with date, pickup/dropoff route, driver name, fare, status indicator badges, ride reference |
| **Notifications** (`NotificationsPage.tsx`) | Dedicated centre for all received push notifications | Notification cards with title, body, timestamp, category (ride update, wallet credit, system alert), read/unread status |
| **Notification Settings** (`NotificationSettingsPage.tsx`) | Configuration for notification preferences | Toggle switches for ride updates, payment alerts, promotional notifications |
| **Security / App Lock** (`SecurityPage.tsx`, `AppLockPage.tsx`) | PIN and biometric lock management | Set/change 4-digit PIN, enable/disable biometric authentication (fingerprint/face), PIN entry screen on app resume from background |
| **Profile & Settings** (`AccountPage.tsx`) | User profile management and app configuration | Name, email, matric number display, profile photo, preferred vehicle type, logout button |
| **Edit Profile** (`EditProfilePage.tsx`) | Detailed profile editing form | Editable fields for name, email, phone, department, level, matric number, home address, profile photo upload via Expo Image Picker |

### 3.7.3 SCREEN LAYOUT DESCRIPTION — DRIVER MOBILE APPLICATION

The Driver Mobile Application comprises the following primary screens:

| Screen | Description | Key UI Elements |
|--------|-------------|-----------------|
| **Login Screen** (`LoginScreen.tsx`) | JWT-based driver authentication | Phone number field, password field, login button, register link |
| **Account Verification** (`AccountVerificationScreen.tsx`) | Stage 1: Personal identity verification | Full name, age, state of origin (all 36 Nigerian states), address, NIN number input, NIN scan upload via Expo Image Picker, submission status tracking |
| **Vehicle Verification** (`VehicleVerificationScreen.tsx`) | Stage 2: Vehicle document submission (gated behind account verification approval) | Driver's licence upload, vehicle registration upload, vehicle insurance upload, individual document status indicators (Pending/Approved/Rejected) |
| **Dashboard** (`DashboardScreen.tsx`) | Main driver interface with online/offline toggle and ride marketplace | Online/offline toggle switch, available ride requests list (marketplace), ride details (pickup, dropoff, fare, vehicle type, seats), 'Accept Ride' button, active ride management with status advancement buttons |
| **Rides History** (`RidesPage.tsx`) | Completed trip history with earnings summary | Trip cards with date, route, fare, earnings, student name, status |
| **Wallet & Earnings** (`WalletPage.tsx`) | Driver financial management | Current wallet balance, total lifetime earnings, transaction history list, earnings breakdown |
| **Profile** (`ProfilePage.tsx`) | Driver profile display | Name, phone, vehicle details (make, model, year, colour, plate number), verification status indicator |
| **Account Settings** (`AccountSettingsPage.tsx`) | Driver account configuration | Vehicle information editing, notification preferences, password change, logout |

### 3.7.4 SCREEN LAYOUT DESCRIPTION — CAMPUS ADMIN DASHBOARD (WEB)

The Campus Admin Dashboard is a browser-based React.js application comprising the following views:

| Screen | Description | Key UI Elements |
|--------|-------------|-----------------|
| **Login** (`LoginScreen.tsx`) | Secure admin authentication | Email/phone field, password field, campus admin badge |
| **Dashboard** (`DashboardScreen.tsx`) | Overview with platform-wide analytics and Google Maps integration | Summary stat cards (Total Students, Total Drivers, Active Rides, Revenue), interactive Google Map with driver locations (@react-google-maps/api), ride trend chart, recent activity feed |
| **Account Verification** (`AccountVerificationPage.tsx`) | Review driver identity submissions | Pending submissions sidebar, driver details panel (full name, age, state, NIN number, NIN scan preview), Approve/Reject buttons with admin notes, rejection reason input |
| **Vehicle Verification** (`UnifiedVerificationPage.tsx`) | Review driver vehicle documents | Combined account + vehicle view, individual document review (licence, registration, insurance), document image preview, Approve/Reject per document, automatic driver approval on all docs approved |
| **Users Management** (`UsersPage.tsx`) | View and manage all platform users | User table with search and filters (role, verification status), user detail modal, account activation/deactivation |
| **Rides Monitor** (`RidesPage.tsx`) | View all rides across the platform | Ride table with filters (status, vehicle type, payment method), search by reference/name/address, sortable columns |
| **Analytics** (`AnalyticsPage.tsx`) | Platform performance metrics | Ride trends chart, revenue breakdown, user growth metrics |
| **Profile** (`ProfilePage.tsx`) | Admin profile management | Name, role, campus assignment display |

---

## 3.8 IMPLEMENTATION TOOLS AND TECHNOLOGIES

### 3.8.1 PROGRAMMING LANGUAGES AND FRAMEWORKS

**TypeScript / JavaScript (React Native v0.81.5 & Expo SDK 54):** The primary languages and framework used for the Presentation Tier. React Native enables compilation of native Android and iOS applications from a single TypeScript codebase. Expo SDK 54 accelerates development by providing a comprehensive suite of pre-compiled native modules including Maps, Location, Notifications, Secure Store, Local Authentication, Image Picker, Camera, Document Picker, and Haptics. TypeScript v5.9.2 adds static type definitions, drastically reducing runtime crashes and improving code maintainability.

**Python 3 & Django v5.1.4:** The foundational language and framework for the Application Logic Tier. Django's "batteries-included" philosophy provides a robust ORM, highly secure authentication mechanisms, CSRF protection, and excellent administrative architecture. The Django REST Framework (DRF) v3.15.2 extends Django to rapidly construct the JSON-based Web APIs consumed by the mobile applications and admin dashboard.

**TypeScript / JavaScript (React v19.2.4 & Vite v8.0):** Utilised for developing the Campus Administrator Web Dashboard, providing a fast, modular, and universally accessible management interface. React Router v7.13 provides client-side routing, and TailwindCSS v4.2 provides utility-first CSS styling.

### 3.8.2 BACKEND AND CLOUD SERVICES

| Service | Version | Role in the Application |
|---------|---------|------------------------|
| PostgreSQL | v16-Alpine | Primary relational database; guarantees data integrity and referential strictness required by the digital wallet and financial modules |
| Redis | v7.2-Alpine | In-memory message broker serving dual purposes: (a) pub/sub channel layer for Django Channels WebSocket communication, (b) message broker for Celery distributed task queue |
| Django Channels | v4.1.0 | Asynchronous server extension handling persistent WebSocket connections for real-time GPS tracking via two consumers: `DriverLocationConsumer` and `RideTrackingConsumer` |
| Daphne | v4.1.2 | ASGI (Asynchronous Server Gateway Interface) server routing both HTTP and WebSocket traffic in production |
| Celery | v5.4.0 | Distributed asynchronous task queue processing background jobs across four named queues (`default`, `rides`, `payments`, `notifications`) with four concurrent worker processes |
| Celery Beat | v2.7.0 (`django-celery-beat`) | Periodic task scheduler with database-backed schedule storage for recurring background tasks |
| Paystack API | — | Payment gateway integration for wallet top-ups via card, bank transfer, and USSD; webhook-verified via HMAC SHA-512 |
| Flutterwave API | v3 | Alternative payment gateway integration for wallet funding; webhook-verified via HMAC SHA-256 |
| Firebase Cloud Messaging (FCM) | — | Underlying infrastructure for delivering background push notifications to Android devices (abstracted via Expo Push API for Expo-managed tokens) |
| Apple Push Notification service (APNs) | — | Push notification delivery infrastructure for iOS devices (abstracted via Expo Push API) |
| Termii SMS API | — | SMS gateway for delivering OTP verification codes to Nigerian phone numbers |
| Expo Push Notification Service | — | Centralised notification routing engine that abstracts FCM and APNs complexity, accepting Expo Push Tokens and routing to the appropriate platform |
| Nginx | v1.25-Alpine | Production reverse proxy handling SSL/TLS termination, static file serving, and HTTP/WebSocket traffic routing |
| Docker | v3.9 Compose | Containerisation platform ensuring identical development and production environments for the backend, Redis, PostgreSQL, Celery workers, Celery Beat, frontend, and Nginx |

### 3.8.3 APIS AND THIRD-PARTY LIBRARIES

#### Mobile Applications (Student & Driver)

| Library / API | Version | Purpose |
|--------------|---------|---------|
| React Native Maps | v1.20.1 | Provides React component API over Google Maps SDK for Android and iOS; enables map rendering, custom markers, and polyline drawing |
| Expo Location | v19.0.8 | Provides high-accuracy access to device GPS hardware for the driver application's tracking module |
| Expo Notifications | v0.32.17 | Manages scheduling and handling of incoming local and remote push notifications (FCM/APNs) |
| Expo Secure Store | v15.0.8 | Encrypts and securely stores sensitive data (JWT tokens, PIN hashes) on device hardware keychain |
| Expo Local Authentication | v17.0.8 | Provides biometric authentication interface (fingerprint/face recognition) for the app lock feature |
| Expo Image Picker | v17.0.11 | Enables photo selection from device gallery and camera for profile photos and document uploads |
| Expo Camera | v17.0.10 | Provides camera access for in-app document scanning |
| Expo Document Picker | v14.0.8 | Enables file selection for NIN scan and vehicle document uploads |
| Expo Haptics | v15.0.8 | Provides tactile feedback on user interactions |
| React Native WebView | v13.15.0 | Renders Paystack and Flutterwave payment checkout pages within the mobile application |
| Zustand | v4.4.0 | Small, fast, scalable state management solution for globally synchronising wallet balance and active ride status across all screens |
| Axios | v1.6.0 | Promise-based HTTP client for transmitting asynchronous REST API requests from frontend to Django backend |
| React Hook Form | v7.48.0 | Performant form library for handling registration, login, and profile editing forms with Zod validation |
| Zod | v3.22.0 | TypeScript-first schema validation library used with React Hook Form for client-side input validation |
| @tanstack/react-query | v5.100.9 | Server state management library used in the Driver App for efficient data fetching, caching, and synchronisation |

#### Campus Admin Dashboard (Web)

| Library / API | Version | Purpose |
|--------------|---------|---------|
| React Router DOM | v7.13.1 | Client-side routing for the single-page admin dashboard |
| @react-google-maps/api | v2.20.8 | Google Maps JavaScript API wrapper for rendering interactive campus maps on the admin dashboard |
| TanStack React Query | v5.90.21 | Server state management for admin data fetching and caching |
| Lucide React | v0.577.0 | Icon library providing consistent, customisable SVG icons across the dashboard |
| Day.js | v1.11.20 | Lightweight date/time formatting and manipulation library |
| React Hot Toast | v2.6.0 | Toast notification system for admin action feedback |
| TailwindCSS | v4.2.1 | Utility-first CSS framework for rapid dashboard UI development |

#### Backend (Python)

| Library / API | Version | Purpose |
|--------------|---------|---------|
| djangorestframework-simplejwt | v5.3.1 | JSON Web Token authentication replacing session-based authentication |
| django-cors-headers | v4.4.0 | Cross-Origin Resource Sharing (CORS) middleware for API access from mobile apps and web dashboard |
| django-filter | v24.3 | Advanced queryset filtering for REST API endpoints (ride list, user list) |
| django-phonenumber-field | v8.0.0 | Phone number model field with validation and formatting for Nigerian phone numbers |
| channels-redis | v4.2.0 | Redis channel layer backend for Django Channels WebSocket communication |
| django-celery-beat | v2.7.0 | Database-backed periodic task scheduler for Celery Beat |
| django-celery-results | v2.5.1 | Storage backend for Celery task results |
| Pillow | v11.0.0 | Image processing library for handling uploaded profile photos and document scans |
| psycopg2-binary | v2.9.10 | PostgreSQL database adapter for Python |
| sentry-sdk | v2.19.0 | Error tracking and performance monitoring integration |
| django-prometheus | v2.3.1 | Prometheus metrics exporter for monitoring API performance |
| django-ratelimit | v4.1.0 | Rate limiting middleware for API endpoints to prevent abuse |
| cryptography | v44.0.0 | Cryptographic primitives used for secure token generation and webhook signature verification |
| boto3 & django-storages | v1.35.76 / v1.14.4 | AWS S3 integration for production media file storage (profile photos, documents) |

### 3.8.4 DEVELOPMENT ENVIRONMENT

The following tools constituted the development environment:

- **Integrated Development Environment (IDE):** Visual Studio Code served as the primary code editor for both TypeScript and Python development, outfitted with linters (ESLint, Flake8) and formatters (Prettier, Black).
- **Version Control:** Git and GitHub were employed for robust source code management, branch management, and version tracking.
- **API Testing & Documentation:** Postman was utilised to meticulously design, test, and document all REST API endpoints and WebSocket streams prior to frontend integration.
- **Database Management:** Django Admin Panel provided a web-based interface for database administration; Redis-CLI was used for monitoring channel layer activity during real-time tracking tests. PostgreSQL was managed through Django's ORM and migration system.
- **UI Prototyping:** Figma was used during Sprint 1 for creating wireframes and high-fidelity mockups before implementation began.
- **Containerisation:** Docker and Docker Compose (v3.9) were used to containerise the entire backend stack (Django, PostgreSQL, Redis, Celery Worker, Celery Beat, and Frontend) ensuring environment consistency.
- **Mobile Testing — Expo Development Client:** The Expo development client (expo-dev-client v6.0.21) was used for testing on physical devices with native module support required for Firebase push notifications.
- **Android Emulator:** Android Virtual Device (AVD) Manager configured with a Pixel 6 profile running Android 13 (API Level 33) for development testing.
- **Physical Test Devices:** VIVO Y04 (Android 15) and Samsung Galaxy A23 (Android 12) were used for real-world GPS accuracy and usability testing across FUT Minna campuses.
- **Build Pipeline:** Expo Application Services (EAS) was configured with three build profiles (development, preview, production) for generating signed Android APKs/AABs and iOS builds.

# LR Ride — Enterprise Production Roadmap & Task Tracker

> **Version:** 1.0  
> **Last Updated:** 30 April 2026  
> **Classification:** Internal Engineering — Confidential  
> **Target Standard:** Industrial / Enterprise-Grade — Production at Scale  
> **Progress:** Track completion by checking `[x]` when each task meets production-grade quality.

---

## Progress Summary

| Phase | Name | Tasks | Done | Progress |
|-------|------|-------|------|----------|
| 0 | Foundation Hardening | 11 | 11 | 🟢 100% |
| 1 | Authentication & Identity | 14 | 14 | 🟢 100% |
| 2 | Ride Engine | 19 | 2 | 🔴 11% |
| 3 | Real-Time Systems | 12 | 0 | 🔴 0% |
| 4 | Payments & Financial | 17 | 3 | 🔴 18% |
| 5 | Driver Ecosystem | 16 | 2 | 🔴 13% |
| 6 | Student Experience | 10 | 0 | 🔴 0% |
| 7 | Admin Command Centre | 14 | 1 | 🔴 7% |
| 8 | Notifications & Comms | 9 | 1 | 🔴 11% |
| 9 | Safety & Emergency | 10 | 1 | 🔴 10% |
| 10 | Analytics & Intelligence | 10 | 0 | 🔴 0% |
| 11 | Campus Zoning | 7 | 0 | 🔴 0% |
| 12 | Premium Features | 12 | 0 | 🔴 0% |
| 13 | Testing & QA | 10 | 0 | 🔴 0% |
| 14 | Deployment & DevOps | 13 | 0 | 🔴 0% |
| 15 | Post-Launch Operations | 8 | 0 | 🔴 0% |
| **TOTAL** | | **192** | **35** | **🔴 18%** |

> **Legend:** 🔴 0-25% · 🟡 26-50% · 🟠 51-75% · 🟢 76-100%

---

## Phase 0 — Foundation Hardening

**Goal:** Ensure the codebase skeleton is structurally sound before building features.

### Backend
- [x] **0.1** Audit and fix all Django model migrations — `makemigrations --check --dry-run` produces 0 changes
- [x] **0.2** Verify all URL pattern registrations — every route in `core/urls.py` resolves without 500 errors
- [x] **0.3** Validate `django-phonenumber-field` + `phonenumbers` lib installed and working correctly
- [x] **0.4** Confirm JWT token rotation + blacklisting works end-to-end (issue → refresh → old token rejected)
- [x] **0.5** Set up structured logging with request correlation IDs in `core/middleware.py`
- [x] **0.6** Configure `django-cors-headers` with explicit production origin list in `settings/production.py`
- [x] **0.7** Add API versioning headers via custom middleware

### Frontend
- [x] **0.8** Configure TypeScript path aliases (`@core/`, `@student/`, `@driver/`, `@admin/`) in `tsconfig` + `vite.config`
- [x] **0.9** Create shared design system tokens (colors, spacing, typography, border radius) in `index.css`
- [x] **0.10** Build shared reusable components: `<LoadingSpinner>`, `<ErrorBoundary>`, `<EmptyState>`, `<PageContainer>`
- [x] **0.11** Add global React Error Boundary with fallback UI and error reporting

### Phase 0 Verification
- [x] `python manage.py check` returns 0 issues
- [x] `python manage.py makemigrations --check --dry-run` returns no changes
- [x] `npm run build` compiles with zero TypeScript errors
- [x] All API endpoints return proper JSON (not HTML 500 errors)

---

## Phase 1 — Authentication & Identity

**Goal:** Production-grade authentication with phone-first identity, OTP, JWT, and role-based access.

### Backend
- [x] **1.1** Phone-based registration for Student + Driver with role assignment
- [x] **1.2** JWT login with account lockout (5-attempt limit, 15-min lockout window)
- [x] **1.3** Token refresh with rotation + blacklisting (SimpleJWT configured)
- [x] **1.4** Termii SMS OTP integration — live API calls in `SMSService`
- [x] **1.5** OTP verification endpoint validates code + marks phone as verified
- [x] **1.6** Password reset via OTP — dedicated endpoint: phone → OTP → set new password
- [x] **1.7** Enforce phone verification before ride booking (middleware/guard on ride endpoints)
- [x] **1.8** Session invalidation on password change — blacklist all existing refresh tokens for that user
- [x] **1.9** Rate limiting on auth endpoints — `/login`, `/register`, `/otp/request` max 5 req/min per IP

### Frontend
- [x] **1.10** OTP Verification Page — 6-digit PIN input, resend countdown timer, auto-redirect on success
- [x] **1.11** Password Reset Flow — "Forgot Password" → Enter Phone → OTP → New Password → Login
- [x] **1.12** Auth state rehydration on app load — validate stored token, fetch `/users/me/`, clear if expired
- [x] **1.13** Redirect authenticated users away from login pages to role-appropriate dashboard
- [x] **1.14** Loading states and skeleton screens during all auth operations

### Phase 1 Verification
- [ ] Register → OTP sent → Verify → Account verified → Login succeeds
- [ ] 5 failed logins → Account locks → Wait 15 min → Login works again
- [ ] Password reset → OTP → New password → Old tokens invalidated
- [ ] Expired access token → Auto-refresh → Request succeeds silently
- [ ] Unverified phone → Blocked from booking → Prompted to verify

---

## Phase 2 — Ride Engine (Core Business Logic)

**Goal:** End-to-end ride lifecycle from booking through completion with state machine integrity.

### Backend
- [ ] **2.1** Ride creation endpoint — validate wallet balance (if `wallet` payment), calculate fare via `FareCalculator`
- [ ] **2.2** Ride reference generation — unique, human-readable format (e.g., `LR-20260430-A7K3`)
- [ ] **2.3** Driver matching pipeline — find nearest available + approved drivers, prioritise by rating & distance
- [ ] **2.4** Driver request/response cycle — send request → 30s timeout → next driver → max 3 attempts → cancel
- [x] **2.5** Ride status FSM enforcement — `transition_to()` with valid transition map
- [ ] **2.6** Ride cancellation logic — calculate cancellation fees, update driver stats, process refunds
- [ ] **2.7** Trip completion handler — calculate actual fare, process payment, credit driver, update stats
- [ ] **2.8** Concurrent ride guard — students and drivers limited to 1 active ride each
- [x] **2.9** Ride expiry Celery task — expire rides stuck in `searching` for >120s
- [ ] **2.10** Full ride detail endpoint — ride info + driver details + route + fare breakdown

### Frontend — Student
- [ ] **2.11** Book Ride Page — GPS pickup, destination (predefined + custom), vehicle type selector, fare preview
- [ ] **2.12** Searching Animation — "Finding your driver..." pulsing radar, timeout countdown
- [ ] **2.13** Driver Assigned Card — photo, name, rating, vehicle details, plate number, ETA
- [ ] **2.14** Active Ride Tracker — real-time map with driver location, status updates bar, cancel button
- [ ] **2.15** Trip Complete Screen — fare breakdown, rating prompt, receipt download
- [ ] **2.16** Ride History — paginated list, date/status filters, detail view on tap

### Frontend — Driver
- [ ] **2.17** Incoming Ride Request Modal — student name, pickup/dropoff, fare, accept/decline countdown (30s)
- [ ] **2.18** Active Trip View — navigation-style layout, status buttons (Arrived → Start → Complete)
- [ ] **2.19** Trip Summary — earnings breakdown, trip distance/duration stats

### Phase 2 Verification
- [ ] Student books → Driver assigned → Track → Arrive → Start → Complete → Pay → Rate ✓
- [ ] No driver found → Timeout → Ride cancelled → Student notified ✓
- [ ] Student cancels mid-ride → Cancellation fee applied ✓
- [ ] Two concurrent ride requests → Second rejected ✓

---

## Phase 3 — Real-Time Systems

**Goal:** Live GPS tracking, WebSocket event streaming, and real-time status updates.

### Backend
- [ ] **3.1** WebSocket JWT authentication middleware — extract token from query params, validate
- [ ] **3.2** `DriverLocationConsumer` — GPS coords received → saved to DB → broadcast to ride subscribers
- [ ] **3.3** `RideTrackingConsumer` — student subscribes → receives driver location + status updates
- [ ] **3.4** Ride status broadcast — on every status transition, push event to ride channel group
- [ ] **3.5** Trip snapshot recording — save GPS snapshots every 5s during active trip for disputes
- [ ] **3.6** Redis channel layer in production — swap `InMemoryChannelLayer` for `channels_redis`
- [ ] **3.7** Connection heartbeat — ping/pong every 30s, auto-disconnect stale connections

### Frontend
- [ ] **3.8** `useWebSocket()` hook — auto-reconnect, exponential backoff, connection status indicator
- [ ] **3.9** Map integration — Leaflet.js or Mapbox GL with OpenStreetMap for live driver tracking
- [ ] **3.10** Driver location streaming — send GPS coords every 3s while online via WebSocket
- [ ] **3.11** Live ride tracking (Student) — render driver marker on map, update ETA, show route polyline
- [ ] **3.12** Status toast notifications — "Driver en route", "Driver arrived", "Trip started" as toasts

### Phase 3 Verification
- [ ] Driver goes online → WebSocket connects → Location updates flow to server
- [ ] Student books → sees live driver marker moving on map → ETA updates
- [ ] Network drop → WebSocket auto-reconnects → state resumes
- [ ] Trip snapshots visible in `trip_location_snapshots` table after ride completes

---

## Phase 4 — Payments & Financial Infrastructure

**Goal:** Secure, auditable payment processing with wallet, card payments, and driver payouts.

### Backend
- [x] **4.1** Wallet top-up via Paystack — initialize → redirect → webhook → credit wallet
- [x] **4.2** Wallet top-up via Flutterwave — same flow, alternative gateway
- [x] **4.3** Wallet debit for rides — atomic `WalletService.debit()` on completion
- [ ] **4.4** Card payment flow — charge card on ride completion, no pre-funding required
- [ ] **4.5** Cash payment tracking — mark ride as cash, driver confirms, commission tracked
- [ ] **4.6** Paystack webhook handler hardening — HMAC validation, idempotent processing
- [ ] **4.7** Flutterwave webhook handler hardening — same security level
- [ ] **4.8** Driver payout system — weekly/manual withdrawal from wallet to bank account
- [ ] **4.9** Immutable transaction ledger — double-entry bookkeeping with before/after balances
- [ ] **4.10** Promotional credits — admin grants bonuses, first-ride discounts, referral rewards
- [ ] **4.11** Refund pipeline — admin-initiated or auto-refund on cancellation by driver

### Frontend — Student
- [ ] **4.12** Wallet Page — balance display, top-up button, transaction history with filters
- [ ] **4.13** Paystack/Flutterwave inline checkout modal — embedded payment experience
- [ ] **4.14** Payment method selector on ride booking — wallet / card / cash toggle
- [ ] **4.15** Receipt generation — downloadable PDF receipt for each completed ride

### Frontend — Driver
- [ ] **4.16** Earnings Dashboard — today / this week / this month with chart visualisation
- [ ] **4.17** Withdrawal request page — enter bank details, request payout, view payout history

### Phase 4 Verification
- [ ] Student tops up ₦5,000 via Paystack → wallet balance updated → transaction visible
- [ ] Student books wallet ride → fare deducted → driver credited → commission recorded
- [ ] Webhook replay → same transaction NOT processed twice (idempotency confirmed)
- [ ] Refund processed → student wallet credited → original transaction linked

---

## Phase 5 — Driver Ecosystem

**Goal:** Complete driver lifecycle: registration → document upload → verification → operations.

### Backend
- [x] **5.1** Driver registration (Step 1) — create user with `role=driver`
- [x] **5.2** Driver profile creation (Step 2) — vehicle details via `DriverProfileCreateView`
- [ ] **5.3** Document upload pipeline — ID, licence, vehicle reg, insurance, photos → storage
- [ ] **5.4** Document review endpoints — admin approve/reject each document with notes
- [ ] **5.5** Auto-verification computation — ALL documents approved → `verification_status = approved`
- [ ] **5.6** Driver stats aggregation — total trips, earnings, rating avg, acceptance/cancellation rates
- [ ] **5.7** Driver suspension/ban logic — rating below 3.0 → auto-suspend → admin review
- [ ] **5.8** Availability toggle (online/offline) with shift tracking

### Frontend — Driver
- [ ] **5.9** Document upload page — categorised file upload with preview, status per document
- [ ] **5.10** Verification status dashboard — which documents pending/approved/rejected
- [ ] **5.11** Online/offline toggle — prominent switch on driver dashboard header
- [ ] **5.12** Performance metrics view — acceptance rate, cancellation rate, average rating

### Frontend — Admin
- [ ] **5.13** Driver verification queue — list of pending drivers with document previews
- [ ] **5.14** Document review modal — view full document image, approve/reject with notes
- [ ] **5.15** Driver detail page — complete profile, ride history, earnings summary, complaints
- [ ] **5.16** Driver suspension controls — suspend/unsuspend with reason logging

### Phase 5 Verification
- [ ] Driver registers → uploads docs → admin reviews → all approved → driver can go online
- [ ] One document rejected → driver notified → re-uploads → re-reviewed
- [ ] Driver rating drops below 3.0 → auto-suspended → admin notified
- [ ] Driver goes online → available in matching pool → offline → removed from pool

---

## Phase 6 — Student Experience Polish

**Goal:** Premium, frictionless student UX that beats every competitor on first impression.

### Frontend
- [ ] **6.1** Student Dashboard Redesign — hero card, quick actions, recent rides, wallet balance, account status
- [ ] **6.2** Quick Book — save frequent routes (e.g., "Hostel → Lecture Hall"), one-tap re-booking
- [ ] **6.3** Predefined Campus Destinations — dropdown with landmarks (Gate, Library, Hostels, Admin)
- [ ] **6.4** GPS Auto-Detect — browser Geolocation API for pickup, reverse geocode to address string
- [ ] **6.5** Fare Estimate Preview — show fare before confirming (base + distance + booking fee breakdown)
- [ ] **6.6** Ride Booking Confirmation — summary screen with all details before final submit
- [ ] **6.7** Student Profile Edit — name, photo upload, matric number, department, level
- [ ] **6.8** Spending Analytics — monthly chart, most visited destinations, average trip cost
- [ ] **6.9** Support Ticket Submission — category select, description, attach ride reference
- [ ] **6.10** Dark Mode — system preference detection + manual toggle, all pages render correctly

### Phase 6 Verification
- [ ] Dashboard loads in <1s, quick book works, GPS auto-detects campus location
- [ ] Fare preview matches actual fare charged after trip completion
- [ ] Dark mode toggled → ALL pages render correctly with no broken styles

---

## Phase 7 — Admin Command Centre

**Goal:** Enterprise-grade admin dashboard with real-time monitoring and financial control.

### Backend
- [x] **7.1** Admin user management with search/filter (role, status, date range)
- [ ] **7.2** Multi-level admin roles — Super Admin + Campus Admin + Operations with permissions
- [ ] **7.3** Campus model — support multiple universities with independent settings
- [ ] **7.4** Admin ride intervention — manually assign / cancel / refund rides
- [ ] **7.5** Financial reports API — revenue, commissions, payouts, wallet totals by date range
- [ ] **7.6** Audit log model — track all admin actions (who changed what, when, old/new values)

### Frontend
- [ ] **7.7** Admin Dashboard — KPI cards (active rides, online drivers, revenue, tickets), live ride map
- [ ] **7.8** User Management — search/filter, view profiles, activate/deactivate, view ride history
- [ ] **7.9** Ride Management — live + historical rides, status filters, manual intervention controls
- [ ] **7.10** Driver Management — verification queue, detail view, earnings, suspension controls
- [ ] **7.11** Pricing Configuration UI — set base fares, per-km rates, surge multipliers per vehicle type
- [ ] **7.12** Financial Reports — revenue charts, commission breakdown, payout history, CSV export
- [ ] **7.13** Support Ticket Management — ticket list, assignment, status updates, resolution notes
- [ ] **7.14** System Settings Page — OTP expiry, ride timeout, commission rate, campus zone config

### Phase 7 Verification
- [ ] Super Admin sees all campuses → manages everything
- [ ] Campus Admin sees only their campus → cannot access other campus data
- [ ] Admin cancels a ride → student refunded → driver notified → audit log recorded

---

## Phase 8 — Notifications & Communication

**Goal:** Multi-channel notifications: in-app, push (FCM), SMS, and real-time WebSocket.

### Backend
- [x] **8.1** In-app notification creation on every significant event (ride assigned, payment, etc.)
- [ ] **8.2** Push notifications via Firebase Cloud Messaging (FCM) using stored `fcm_token`
- [ ] **8.3** SMS notifications for critical events — ride confirmation, payment alerts via Termii
- [ ] **8.4** Notification preferences — users control which channels (push, SMS, in-app) they receive
- [ ] **8.5** WebSocket notification channel — real-time push to currently connected clients
- [ ] **8.6** Batch mark-as-read — mark all or selected notifications as read

### Frontend
- [ ] **8.7** Notification bell icon in navbar — unread count badge, click to open drawer
- [ ] **8.8** Notification drawer/page — grouped by date, mark-as-read, click to navigate to relevant page
- [ ] **8.9** Real-time toast notifications — popup for ride status changes on connected clients

### Phase 8 Verification
- [ ] Student books → driver gets push + in-app notification
- [ ] Driver accepts → student gets push + in-app + SMS
- [ ] User marks all as read → badge clears → state persists after reload

---

## Phase 9 — Safety & Emergency Systems

**Goal:** Military-grade safety pipeline ensuring student and driver security at all times.

### Backend
- [x] **9.1** Trip location logging — `TripLocationSnapshot` model for GPS evidence trail
- [ ] **9.2** SOS endpoint — triggers emergency alert to admin dashboard + campus security contact
- [ ] **9.3** Emergency contact model — students save up to 3 trusted contacts
- [ ] **9.4** Share ride endpoint — generate shareable link with live tracking (accessible without login)
- [ ] **9.5** Incident report endpoint — structured logging with evidence attachment support
- [ ] **9.6** Auto-SOS detection — flag if ride takes unusually long or goes off expected route

### Frontend
- [ ] **9.7** SOS button — prominent red button during active ride, confirmation dialog, sends GPS + ride data
- [ ] **9.8** Share ride screen — share via link / WhatsApp / SMS with live tracking URL
- [ ] **9.9** Emergency contacts management — add/edit/remove trusted contacts in profile
- [ ] **9.10** Admin incident dashboard — real-time SOS alerts, ride details, driver/student info, response log

### Phase 9 Verification
- [ ] Student triggers SOS → admin gets instant alert → ride flagged → GPS snapshot captured
- [ ] Shared ride link opens in browser without login → shows live driver marker
- [ ] Complete GPS trail visible in admin panel after ride completion

---

## Phase 10 — Analytics & Intelligence

**Goal:** Data-driven insights for operations, growth, and competitive advantage.

### Backend
- [ ] **10.1** Aggregated analytics models — daily/weekly/monthly summaries for rides, revenue, users
- [ ] **10.2** Celery daily aggregation task — compute and store stats at midnight
- [ ] **10.3** Peak hour detection — identify high-demand hours from historical ride data
- [ ] **10.4** Demand zone mapping — which campus areas generate the most ride requests
- [ ] **10.5** User acquisition metrics API — daily signups, activation rate, retention cohorts
- [ ] **10.6** Driver utilization metrics API — online hours, trips per hour, idle time analysis
- [ ] **10.7** Revenue analytics API — daily revenue, commissions, avg fare, payment method distribution

### Frontend — Admin
- [ ] **10.8** Analytics Dashboard — interactive charts (line, bar, pie), date range selector, CSV export
- [ ] **10.9** Campus heat map — demand visualization overlay on map with colour intensity
- [ ] **10.10** KPI dashboard cards — avg wait time, completion rate, driver utilization, satisfaction rating

### Phase 10 Verification
- [ ] Daily aggregation runs → stats available next morning → correct values
- [ ] Admin filters by date range → charts update dynamically → CSV export works
- [ ] Heat map renders correctly showing actual demand concentration zones

---

## Phase 11 — Campus Zoning & Optimisation

**Goal:** Campus-aware ride matching that beats generic ride-hailing algorithms.

### Backend
- [ ] **11.1** Campus Zone model — name, GeoJSON boundary polygon, zone type (hostel/academic/gate)
- [ ] **11.2** Zone-aware matching — prioritise drivers within same zone as pickup location
- [ ] **11.3** Predefined destinations model — admin-managed list of campus landmarks with coordinates
- [ ] **11.4** Surge pricing by zone — dynamic multiplier based on demand/supply ratio per zone
- [ ] **11.5** Route optimisation — suggest optimal intra-campus routes (OSRM integration)

### Frontend
- [ ] **11.6** Destination picker — list of campus landmarks with icons, search, recent selections
- [ ] **11.7** Zone visualization on admin map — coloured zones with demand indicators and driver counts

### Phase 11 Verification
- [ ] Ride request in Zone A → driver in Zone A matched first (not Zone B driver even if closer by rating)
- [ ] Admin creates new zone → appears on map → affects matching immediately
- [ ] Surge applied to high-demand zone → fare reflects multiplier → normalizes when demand drops

---

## Phase 12 — Premium & Competitive Features

**Goal:** Features that directly differentiate LR Ride from 1,000+ market competitors.

- [ ] **12.1** Scheduled Rides — book in advance ("Tomorrow 8am, Hostel to Class"), reminder notifications
- [ ] **12.2** Ride Pooling — share rides with other students going same direction, split fare algorithm
- [ ] **12.3** Loyalty Points System — earn points per ride, redeem for discounts, tiered rewards
- [ ] **12.4** Referral Programme — invite friends via unique code, both earn credit on first ride
- [ ] **12.5** Offline/USSD Fallback — SMS-based ride booking for low-internet scenarios (Nigeria market)
- [ ] **12.6** AI Demand Prediction — predict busy locations/times from class schedules + historical data
- [ ] **12.7** Driver Leaderboard — weekly top performers displayed, bonus incentives
- [ ] **12.8** Student ID Integration — verify student status via university database API
- [ ] **12.9** In-App Chat — student ↔ driver messaging during ride, no phone number exposure
- [ ] **12.10** Multi-Campus Support — deploy same system across multiple universities, campus-isolated data
- [ ] **12.11** PWA / Installable Web App — add-to-homescreen, offline caching, native-like experience
- [ ] **12.12** Accessibility (WCAG 2.1 AA) — screen reader support, keyboard navigation, contrast compliance

### Phase 12 Verification
- [ ] Scheduled ride triggers correctly at the specified time
- [ ] Referral code applied → both users receive credit → tracked in admin
- [ ] PWA installable from Chrome → works offline for cached pages → push notifications work

---

## Phase 13 — Testing & Quality Assurance

**Goal:** Enterprise-grade test coverage — zero critical bugs in production.

### Backend Testing
- [ ] **13.1** Unit tests — all services, serializers, model methods — ≥90% code coverage
- [ ] **13.2** Integration tests — full API request/response cycle for every endpoint
- [ ] **13.3** WebSocket tests — connection, authentication, message flow for all consumers
- [ ] **13.4** Payment webhook tests — mock Paystack/Flutterwave, verify idempotency
- [ ] **13.5** Load testing — 500 concurrent ride requests, 100 simultaneous WebSocket connections
- [ ] **13.6** Security testing — SQL injection, XSS, CSRF, IDOR, auth bypass scans

### Frontend Testing
- [ ] **13.7** Component tests — all shared components render correctly with `vitest`
- [ ] **13.8** Integration tests — full page renders with mocked API responses
- [ ] **13.9** E2E tests — complete user flows (register → book → pay → rate) via Playwright
- [ ] **13.10** Accessibility audit — WCAG compliance scan with `axe-core`, 0 critical violations

### Phase 13 Verification
- [ ] `pytest --cov` shows ≥85% backend coverage
- [ ] `npm run test` passes all frontend tests — 0 failures
- [ ] E2E suite completes full booking flow without intervention
- [ ] Load test: 500 concurrent users, <2s response on 95th percentile

---

## Phase 14 — Deployment & DevOps

**Goal:** Zero-downtime deployment pipeline with monitoring and full observability.

### Infrastructure
- [ ] **14.1** Docker images optimised — multi-stage builds, final image <200MB
- [ ] **14.2** Docker Compose (production) hardened — PostgreSQL 16, Redis 7, Daphne, Celery, Nginx
- [ ] **14.3** SSL/TLS — Let's Encrypt certificates via Certbot or Cloudflare
- [ ] **14.4** GitHub Actions CI/CD — test → build → push image → deploy — triggered on `main` push
- [ ] **14.5** Database migrations in CI — auto-run on each deploy with rollback support
- [ ] **14.6** Environment secrets management — GitHub Secrets / Vault, never in source code

### Monitoring & Observability
- [ ] **14.7** Health checks — `/health/` endpoint checks DB + Redis + Celery, used by load balancer
- [ ] **14.8** Structured JSON logging — shipped to log aggregator (ELK or Loki)
- [ ] **14.9** Error tracking — Sentry integration for backend + frontend with source maps
- [ ] **14.10** Uptime monitoring — external health checks every 60s with Slack/email alerting
- [ ] **14.11** Performance monitoring — request latency, DB query time, WS connections via Prometheus
- [ ] **14.12** Database backups — automated daily `pg_dump` to S3 with 30-day retention
- [ ] **14.13** Kubernetes deployment (optional) — horizontal pod autoscaling, rolling updates, ingress

### Phase 14 Verification
- [ ] Push to `main` → CI passes → image built → deployed to staging → smoke tests → production
- [ ] SSL active → all traffic HTTPS → HSTS headers present
- [ ] Health endpoint returns 200 → load balancer routes traffic correctly
- [ ] Sentry captures errors → team notified <60s → source maps resolve

---

## Phase 15 — Post-Launch Operations

**Goal:** Sustain quality, iterate on feedback, and scale after initial launch.

- [ ] **15.1** Security audit — penetration testing, dependency vulnerability scan, OWASP checklist
- [ ] **15.2** Performance baseline — document P50/P95/P99 latencies for all critical endpoints
- [ ] **15.3** Soft launch — 100 beta students + 10 drivers on one campus, iterate on feedback
- [ ] **15.4** Incident response runbook — documented procedures for payment failures, WS drops, SOS alerts
- [ ] **15.5** Performance optimisation — query optimization, caching strategy, CDN for static assets
- [ ] **15.6** Driver onboarding campaign — streamlined signup, referral bonuses, earning guarantees
- [ ] **15.7** API documentation — Swagger/Redoc auto-generated, admin user guide, driver onboarding guide
- [ ] **15.8** Mobile app kickoff — React Native app using shared API layer, reuse auth + state patterns

### Phase 15 Verification
- [ ] Security audit report — 0 critical/high vulnerabilities remaining
- [ ] Soft launch feedback incorporated — top 5 issues resolved within 1 week
- [ ] API docs published and accessible at `/api/docs/`
- [ ] Mobile app prototype connects to production API successfully

---

## Testing Accounts & Credentials

| Role | Phone | Password | Status |
|------|-------|----------|--------|
| Student | `+2348000000001` | `StudentPass123!` | ✅ Created — Phone Unverified |
| Driver | `+2348000000002` | `DriverPass123!` | ✅ Created — Profile Incomplete |
| Admin | `+2348000000000` | `AdminPass123!` | ✅ Created — Superuser Active |

---

## Technology Stack

| Layer | Tech | Version |
|-------|------|---------|
| Backend | Django + DRF | 5.1 |
| Auth | SimpleJWT | Latest |
| WebSocket | Django Channels | Latest |
| Tasks | Celery + Beat | Latest |
| Frontend | React + Vite + TS | 19 / 8 / 5.9 |
| State | Zustand | 5 |
| Data Fetching | TanStack React Query | 5 |
| Forms | React Hook Form + Zod | Latest |
| Database | PostgreSQL | 16 |
| Cache/Queue | Redis | 7 |
| SMS | Termii API | - |
| Payments | Paystack + Flutterwave | API |
| Push | Firebase FCM | API |
| Containers | Docker + Nginx | Latest |
| CI/CD | GitHub Actions | Latest |
| Orchestration | Kubernetes | Latest |

---

## Execution Priority

> **Critical Path (must be sequential):**
> `Phase 0 → 1 → 2 → 3 → 4 → 5 → 6`
>
> **Can run in parallel after Phase 6:**
> - Phase 7 (Admin) + Phase 8 (Notifications)
> - Phase 9 (Safety) + Phase 10 (Analytics)
> - Phase 11 (Zoning) + Phase 12 (Premium)
>
> **Phase 13 (Testing) is continuous — write tests with every phase.**
> **Phase 14 (DevOps) can begin alongside Phase 4.**
> **Phase 15 (Post-Launch) begins after first deployment.**

---

## Risk Registry

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low driver supply at launch | HIGH | CRITICAL | Recruitment + earning guarantees + incentives |
| SMS delivery failures | MEDIUM | HIGH | Multi-provider fallback, console OTP in dev |
| Payment gateway downtime | LOW | CRITICAL | Dual gateway + cash fallback |
| WebSocket scaling limits | MEDIUM | MEDIUM | Redis channel layer + K8s horizontal scaling |
| Database under load | LOW | HIGH | Query optimization + read replicas + pgbouncer |
| Security breach | LOW | CRITICAL | Regular audits + encryption + HTTPS everywhere |
| GPS accuracy on campus | MEDIUM | MEDIUM | Manual pickup + predefined locations fallback |
| User adoption resistance | MEDIUM | HIGH | Referral incentives + campus partnerships |

---

## Success Metrics

| Metric | Month 1 | Month 6 | Year 1 |
|--------|---------|---------|--------|
| Daily Active Students | 100 | 1,000 | 5,000 |
| Daily Rides Completed | 50 | 500 | 2,500 |
| Average Wait Time | <5 min | <3 min | <2 min |
| Ride Completion Rate | >85% | >92% | >95% |
| Driver Utilization | >40% | >60% | >75% |
| Customer Satisfaction | >4.0 | >4.3 | >4.5 |
| Payment Success Rate | >95% | >98% | >99% |
| System Uptime | >99% | >99.5% | >99.9% |
| API Response Time (P95) | <500ms | <300ms | <200ms |

---

*This is a living document. Check off `[x]` as each task reaches production quality. Update the Progress Summary table after each phase milestone.*

# LR Ride — Enterprise Production Roadmap

> **Version:** 1.0  
> **Last Updated:** 30 April 2026  
> **Classification:** Internal Engineering — Confidential  
> **Target Standard:** Industrial / Enterprise-Grade — Production at Scale

---
07074220145
## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Phase 0 — Foundation Hardening](#4-phase-0--foundation-hardening)
5. [Phase 1 — Authentication & Identity](#5-phase-1--authentication--identity)
6. [Phase 2 — Ride Engine (Core Business Logic)](#6-phase-2--ride-engine-core-business-logic)
7. [Phase 3 — Real-Time Systems](#7-phase-3--real-time-systems)
8. [Phase 4 — Payments & Financial Infrastructure](#8-phase-4--payments--financial-infrastructure)
9. [Phase 5 — Driver Ecosystem](#9-phase-5--driver-ecosystem)
10. [Phase 6 — Student Experience Polish](#10-phase-6--student-experience-polish)
11. [Phase 7 — Admin Command Centre](#11-phase-7--admin-command-centre)
12. [Phase 8 — Notifications & Communication](#12-phase-8--notifications--communication)
13. [Phase 9 — Safety & Emergency Systems](#13-phase-9--safety--emergency-systems)
14. [Phase 10 — Analytics & Intelligence](#14-phase-10--analytics--intelligence)
15. [Phase 11 — Campus Zoning & Optimisation](#15-phase-11--campus-zoning--optimisation)
16. [Phase 12 — Premium & Competitive Features](#16-phase-12--premium--competitive-features)
17. [Phase 13 — Testing & Quality Assurance](#17-phase-13--testing--quality-assurance)
18. [Phase 14 — Deployment & DevOps](#18-phase-14--deployment--devops)
19. [Phase 15 — Post-Launch Operations](#19-phase-15--post-launch-operations)
20. [Testing Accounts & Credentials](#20-testing-accounts--credentials)
21. [Technology Stack Reference](#21-technology-stack-reference)
22. [Risk Registry](#22-risk-registry)
23. [Success Metrics](#23-success-metrics)

---

## 1. Executive Summary

LR Ride is a closed-loop, campus-exclusive ride-hailing platform targeting university environments. In a market with **1,000+ competitors**, differentiation demands industrial-grade execution across every layer: authentication, real-time GPS tracking, payment processing, driver operations, safety systems, and analytics.

This roadmap is structured into **16 sequential phases**, each self-contained with clear deliverables, verification criteria, and dependency chains. Every phase is designed to produce **production-deployable increments** — no feature ships without end-to-end testing and security validation.

**Core Differentiation Strategy:**
- Campus zone-aware ride matching (not generic geo-fencing)
- Sub-3-second driver assignment in peak hours
- Offline/USSD fallback for low-connectivity environments (Nigerian market reality)
- AI-driven demand prediction tuned to university class schedules
- Military-grade safety pipeline (SOS → campus security → real-time incident tracking)

---

## 2. Current State Audit

### What Already Exists (Backend — Django 5.1 + DRF)

| App | Models | Views | Services | Tests | Status |
|-----|--------|-------|----------|-------|--------|
| `accounts` | ✅ User, StudentProfile, DriverProfile, OTP | ✅ Register, Login, Logout, OTP, Admin CRUD | ✅ OTPService, SMSService (Termii) | ✅ 7.2KB | **70% Complete** |
| `rides` | ✅ Ride (full FSM), DriverRideRequest | ✅ CRUD + status transitions | ✅ FareCalculator, RideMatchingService | ✅ 8.2KB | **60% Complete** |
| `payments` | ✅ WalletTransaction, GatewayTransaction | ✅ Topup, Webhook, History | ✅ WalletService, PaystackService, FlutterwaveService | ✅ 2.9KB | **55% Complete** |
| `ratings` | ✅ Rating (bidirectional) | ⚠️ Basic | ❌ No aggregation service | ❌ None | **30% Complete** |
| `notifications` | ✅ Notification model | ⚠️ Basic list/mark-read | ✅ NotificationService (FCM-ready) | ❌ None | **40% Complete** |
| `pricing` | ✅ FareConfiguration | ⚠️ Basic CRUD | ❌ No dynamic pricing engine | ❌ None | **25% Complete** |
| `tracking` | ✅ DriverLocation, TripLocationSnapshot | ❌ Minimal | ❌ No consumers logic integration | ❌ None | **35% Complete** |
| `verification` | ✅ DriverDocument | ⚠️ Basic | ❌ No automated verification pipeline | ❌ None | **20% Complete** |
| `support` | ✅ SupportTicket (full model) | ⚠️ Basic CRUD | ❌ No escalation logic | ❌ None | **25% Complete** |
| `analytics` | ❌ Empty models.py | ⚠️ View-only aggregation queries | ❌ None | ❌ None | **10% Complete** |

### What Already Exists (Frontend — React 18 + Vite + TypeScript)

| Portal | Pages | API Integration | Real-time | Status |
|--------|-------|-----------------|-----------|--------|
| **Student** | Login, Register, Dashboard, BookRide, RideHistory, Wallet, Profile, Support (8 pages) | ⚠️ Partial | ❌ No WebSocket | **45% Complete** |
| **Driver** | Login, Register, Dashboard, RideHistory, Profile (5 pages) | ⚠️ Partial | ❌ No WebSocket | **30% Complete** |
| **Admin** | Login, Dashboard, Users, Rides, Drivers, Analytics, Support (7 pages) | ⚠️ Partial | ❌ No live monitoring | **35% Complete** |

### What Already Exists (Infrastructure)

| Component | Status |
|-----------|--------|
| Docker Compose (dev + prod) | ✅ Configured |
| Nginx reverse proxy | ✅ Configured |
| Kubernetes manifests | ✅ 8 YAML files |
| Terraform | ⚠️ Directory exists, likely empty |
| GitHub Actions CI | ⚠️ Directory exists |
| Monitoring | ⚠️ Directory exists |

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Student  │  │   Driver     │  │    Admin     │              │
│  │ Web/PWA  │  │   Web/PWA    │  │   Dashboard  │              │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘              │
│       │               │                 │                       │
│  ┌────┴────────────────┴─────────────────┴───────┐              │
│  │              React 18 + Vite + TS              │              │
│  │    Zustand │ React Query │ React Router        │              │
│  └──────────────────────┬────────────────────────┘              │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTPS / WSS
┌─────────────────────────┼───────────────────────────────────────┐
│                    API GATEWAY (Nginx)                           │
│                 SSL Termination + Rate Limiting                  │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                    BACKEND LAYER                                │
│  ┌──────────────────────┴──────────────────────┐                │
│  │         Django 5.1 + DRF + Channels          │                │
│  │  ┌──────────┐ ┌──────┐ ┌────────┐ ┌───────┐ │                │
│  │  │ Accounts │ │Rides │ │Payments│ │Ratings│ │                │
│  │  ├──────────┤ ├──────┤ ├────────┤ ├───────┤ │                │
│  │  │ Tracking │ │Notif │ │Pricing │ │Support│ │                │
│  │  ├──────────┤ ├──────┤ ├────────┤ ├───────┤ │                │
│  │  │Analytics │ │Verify│ │ Zoning │ │       │ │                │
│  │  └──────────┘ └──────┘ └────────┘ └───────┘ │                │
│  └──────────────────────┬──────────────────────┘                │
│                         │                                       │
│  ┌──────────────────────┼──────────────────────┐                │
│  │              ASYNC LAYER                     │                │
│  │  Celery Workers │ Celery Beat │ Channels     │                │
│  └──────────────────────┬──────────────────────┘                │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                    DATA LAYER                                   │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────┐               │
│  │ PostgreSQL  │  │  Redis   │  │  S3/Spaces   │               │
│  │ 16 (Primary)│  │ 7 (Cache │  │ (Media/Docs) │               │
│  │             │  │  + Queue)│  │              │               │
│  └─────────────┘  └──────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### Role Hierarchy

```
Super Admin (System Owner)
├── Campus Admin (University-Level Manager)
│   ├── Operations / Dispatch Team
│   │   └── Live ride monitoring, manual assignment, emergency response
│   ├── Drivers (Verified)
│   │   └── Accept rides, earn payments, manage availability
│   └── Students (Riders)
│       └── Book rides, track drivers, pay, rate
```

---

## 4. Phase 0 — Foundation Hardening

**Goal:** Ensure the codebase skeleton is structurally sound before building features.

### Backend

| # | Task | Priority | File(s) |
|---|------|----------|---------|
| 0.1 | Audit and fix all Django model migrations — confirm `makemigrations` produces no new changes | CRITICAL | All `migrations/` |
| 0.2 | Verify all URL pattern registrations (`core/urls.py`) resolve without 500 errors | CRITICAL | `core/urls.py` |
| 0.3 | Add `PhoneNumberField` validation — ensure `django-phonenumber-field` is installed with `phonenumbers` lib | HIGH | `requirements/` |
| 0.4 | Validate `SIMPLE_JWT` config — confirm token rotation + blacklisting works end-to-end | HIGH | `core/settings/base.py` |
| 0.5 | Set up structured logging with correlation IDs (request tracing) | MEDIUM | `core/middleware.py` |
| 0.6 | Configure `django-cors-headers` with explicit origin lists for production | HIGH | `core/settings/production.py` |
| 0.7 | Add API versioning headers via custom middleware | MEDIUM | `core/middleware.py` |

### Frontend

| # | Task | Priority | File(s) |
|---|------|----------|---------|
| 0.8 | Configure path aliases in `tsconfig.app.json` (`@core/`, `@student/`, `@driver/`, `@admin/`) | MEDIUM | `tsconfig.app.json`, `vite.config.ts` |
| 0.9 | Create shared design system tokens (colors, spacing, typography) in `index.css` | HIGH | `src/index.css` |
| 0.10 | Build shared `<LoadingSpinner>`, `<ErrorBoundary>`, `<EmptyState>` components | HIGH | `src/core/components/` |
| 0.11 | Add global error handling with React Error Boundary | HIGH | `src/core/ErrorBoundary.tsx` |

### Verification
- `python manage.py check --settings=core.settings.development` returns 0 issues
- `python manage.py makemigrations --check --dry-run` returns no changes
- `npm run build` compiles with zero TypeScript errors
- All API endpoints return proper JSON responses (not HTML 500 errors)

---

## 5. Phase 1 — Authentication & Identity ✅ (Partially Complete)

**Goal:** Production-grade authentication with phone-first identity, OTP verification, JWT session management, and role-based access.

### Backend — Remaining Work

| # | Task | Status | Details |
|---|------|--------|---------|
| 1.1 | Phone-based registration (Student + Driver) | ✅ Done | `RegisterView` with role assignment |
| 1.2 | JWT Login with account lockout protection | ✅ Done | 5-attempt limit, 15-min lockout |
| 1.3 | Token refresh with rotation + blacklisting | ✅ Done | `SIMPLE_JWT` config verified |
| 1.4 | Termii SMS OTP integration | ✅ Done | Live API call in `SMSService` |
| 1.5 | **OTP verification screen & flow** | ⬜ TODO | Backend exists, frontend needs OTP entry page |
| 1.6 | **Password reset via OTP flow** | ⬜ TODO | Backend partially ready, needs dedicated endpoint + frontend |
| 1.7 | **Force phone verification before ride booking** | ⬜ TODO | Add middleware/guard on ride endpoints |
| 1.8 | **Session invalidation on password change** | ⬜ TODO | Blacklist all existing refresh tokens |
| 1.9 | **Rate limiting on auth endpoints** | ⬜ TODO | `/login`, `/register`, `/otp/request` — max 5 req/min |

### Frontend — Remaining Work

| # | Task | Status | Details |
|---|------|--------|---------|
| 1.10 | **OTP Verification Page** (after registration) | ⬜ TODO | 6-digit PIN input, resend timer, auto-redirect |
| 1.11 | **Password Reset Flow** | ⬜ TODO | "Forgot Password" → Enter Phone → OTP → New Password |
| 1.12 | **Auth state rehydration on app load** | ⬜ TODO | Validate stored token, fetch `/users/me/`, clear if expired |
| 1.13 | **Redirect authenticated users away from login** | ⬜ TODO | If logged in, redirect to role-appropriate dashboard |
| 1.14 | **Loading states during auth operations** | ⬜ TODO | Skeleton screens, disabled buttons, toast feedback |

### Verification
- Register → OTP sent → Verify OTP → Account marked verified → Login works
- 5 failed logins → Account locks → 15 mins later → Login works again
- Password reset → OTP → New password → Old tokens invalidated
- Expired access token → Auto-refresh → Request succeeds silently
- Unverified phone → Cannot book a ride → Prompted to verify

---

## 6. Phase 2 — Ride Engine (Core Business Logic)

**Goal:** End-to-end ride lifecycle from booking through completion with state machine integrity.

### Backend

| # | Task | Details |
|---|------|---------|
| 2.1 | **Ride creation endpoint** — validate student wallet balance if `wallet` payment, calculate fare via `FareCalculator` | `rides/views.py` |
| 2.2 | **Ride reference generation** — unique, human-readable (e.g., `LR-20260430-A7K3`) | `rides/services.py` |
| 2.3 | **Driver matching pipeline** — find nearest available + approved drivers, prioritise by rating & distance | `rides/services.py` |
| 2.4 | **Driver request/response cycle** — send request → 30s timeout → next driver → max 3 attempts → cancel if no one accepts | `rides/views.py`, `rides/tasks.py` |
| 2.5 | **Ride status FSM enforcement** — `requested → searching → driver_assigned → en_route → arrived → in_progress → completed` | ✅ Exists (`Ride.transition_to()`) |
| 2.6 | **Ride cancellation logic** — calculate cancellation fees, update driver stats, process refunds | `rides/services.py` |
| 2.7 | **Trip completion handler** — calculate actual fare, process payment, credit driver, update trip stats | `rides/tasks.py` |
| 2.8 | **Concurrent ride guard** — students cannot have >1 active ride; drivers cannot either | `rides/views.py` |
| 2.9 | **Ride expiry task** — Celery beat: expire rides stuck in `searching` for >120s | ✅ Exists (`expire_unassigned_rides`) |
| 2.10 | **Ride detail endpoint** — returns full ride info including driver details, route, fare breakdown | `rides/views.py` |

### Frontend — Student

| # | Task | Details |
|---|------|---------|
| 2.11 | **Book Ride Page** — pickup input (GPS auto-detect + manual), destination (predefined + custom), vehicle type selector, fare preview | `BookRidePage.tsx` |
| 2.12 | **Searching Animation** — "Finding your driver..." with pulsing radar, show timeout countdown | New component |
| 2.13 | **Driver Assigned Card** — driver photo, name, rating, vehicle details, plate number, ETA | New component |
| 2.14 | **Active Ride Tracker** — real-time map with driver location, status updates bar, cancel button | New component |
| 2.15 | **Trip Complete Screen** — fare breakdown, rating prompt, receipt download | New component |
| 2.16 | **Ride History Page** — paginated list with filters (date range, status), tap for detail | `RideHistoryPage.tsx` |

### Frontend — Driver

| # | Task | Details |
|---|------|---------|
| 2.17 | **Incoming Ride Request Modal** — student name, pickup/dropoff, fare, accept/decline timer (30s) | New component |
| 2.18 | **Active Trip View** — navigation-style layout, status buttons (Arrived → Start Trip → Complete) | New component |
| 2.19 | **Trip Summary** — earnings breakdown, trip stats | New component |

### Verification
- Student books ride → Driver gets request → Accepts → Student sees driver on map → Driver marks arrived → Trip starts → Trip completes → Payment processed → Both rate each other
- No driver available → Timeout → Ride cancelled → Student notified
- Student cancels mid-ride → Cancellation fee applied (if applicable)
- Two concurrent ride requests → Second one rejected

---

## 7. Phase 3 — Real-Time Systems

**Goal:** Live GPS tracking, WebSocket event streaming, and real-time status updates.

### Backend

| # | Task | Details |
|---|------|---------|
| 3.1 | **WebSocket authentication middleware** — extract JWT from query params, authenticate user | `core/ws_middleware.py` |
| 3.2 | **DriverLocationConsumer** — driver sends GPS coords → stored in `DriverLocation` → broadcast to ride subscribers | ✅ Exists (needs testing) |
| 3.3 | **RideTrackingConsumer** — student subscribes to ride channel → receives driver location + status updates | ✅ Exists (needs testing) |
| 3.4 | **Ride status broadcast** — on every status transition, push event to ride channel group | `rides/signals.py` or `rides/services.py` |
| 3.5 | **Trip snapshot recording** — save GPS snapshots every 5s during active trip for dispute resolution | `tracking/services.py` |
| 3.6 | **Redis channel layer** — switch from `InMemoryChannelLayer` to `channels_redis.core.RedisChannelLayer` for production | `settings/production.py` |
| 3.7 | **Connection heartbeat** — ping/pong every 30s, auto-disconnect stale connections | `tracking/consumers.py` |

### Frontend

| # | Task | Details |
|---|------|---------|
| 3.8 | **WebSocket hook** — `useWebSocket(url)` with auto-reconnect, exponential backoff, connection status indicator | `src/core/hooks/useWebSocket.ts` |
| 3.9 | **Map integration** — Leaflet.js or Mapbox GL for live driver tracking (free tier / OpenStreetMap) | `src/core/components/Map.tsx` |
| 3.10 | **Driver location streaming** (Driver app) — send GPS coords every 3s while online | `src/driver/hooks/useLocationStream.ts` |
| 3.11 | **Live ride tracking** (Student app) — render driver marker on map, update ETA, show route | `src/student/components/RideTracker.tsx` |
| 3.12 | **Status toast notifications** — "Driver en route", "Driver arrived", "Trip started" | Global toast system |

### Verification
- Driver goes online → WebSocket connected → Location updates flow
- Student books and tracks → sees live driver movement on map
- Network drop → WebSocket auto-reconnects → state resumes
- Trip location snapshots recorded in `trip_location_snapshots` table

---

## 8. Phase 4 — Payments & Financial Infrastructure

**Goal:** Secure, auditable payment processing with wallet system, card payments, and driver payouts.

### Backend

| # | Task | Details |
|---|------|---------|
| 4.1 | **Wallet top-up via Paystack** — initialize → redirect → webhook confirms → credit wallet | ✅ Partially exists |
| 4.2 | **Wallet top-up via Flutterwave** — same flow, alternative gateway | ✅ Partially exists |
| 4.3 | **Wallet payment for rides** — atomic debit on ride completion | ✅ `WalletService.debit()` exists |
| 4.4 | **Card payment flow** — charge card on ride completion, no pre-funding required | ⬜ TODO |
| 4.5 | **Cash payment tracking** — mark ride as cash, driver confirms collection, platform commission tracked | ⬜ TODO |
| 4.6 | **Paystack webhook handler** — validate HMAC signature, idempotent processing, update `GatewayTransaction` | ⬜ TODO — needs hardening |
| 4.7 | **Flutterwave webhook handler** — same security level | ⬜ TODO — needs hardening |
| 4.8 | **Driver payout system** — weekly/manual withdrawal from driver wallet to bank account | ⬜ TODO |
| 4.9 | **Transaction ledger** — immutable audit trail, double-entry bookkeeping | ✅ `WalletTransaction` with before/after balances |
| 4.10 | **Promotional credits** — admin grants bonuses, first-ride discounts, referral rewards | ⬜ TODO |
| 4.11 | **Refund pipeline** — admin-initiated or auto-refund on cancellation by driver | ⬜ TODO |

### Frontend — Student

| # | Task | Details |
|---|------|---------|
| 4.12 | **Wallet Page** — balance display, top-up button, transaction history, filter by type | `WalletPage.tsx` (needs completion) |
| 4.13 | **Paystack/Flutterwave checkout modal** — embedded inline checkout | New component |
| 4.14 | **Payment method selector** — wallet / card / cash toggle on ride booking | `BookRidePage.tsx` |
| 4.15 | **Receipt generation** — downloadable PDF receipt for each completed ride | New component |

### Frontend — Driver

| # | Task | Details |
|---|------|---------|
| 4.16 | **Earnings Dashboard** — today / this week / this month, chart visualisation | `DashboardPage.tsx` |
| 4.17 | **Withdrawal request screen** — enter bank details, request payout, see payout history | New page |

### Verification
- Student tops up ₦5,000 via Paystack → wallet balance updated → transaction visible
- Student books wallet ride → fare deducted → driver earnings credited → commission recorded
- Webhook replay → same transaction not processed twice (idempotency)
- Refund processed → student wallet credited → original transaction linked

---

## 9. Phase 5 — Driver Ecosystem

**Goal:** Complete driver lifecycle from registration through verification, onboarding, and operations.

### Backend

| # | Task | Details |
|---|------|---------|
| 5.1 | **Driver registration (Step 1)** — create user with `role=driver` | ✅ Done |
| 5.2 | **Driver profile creation (Step 2)** — vehicle details | ✅ `DriverProfileCreateView` |
| 5.3 | **Document upload pipeline** — ID, licence, vehicle reg, insurance, photos → S3/local storage | ⬜ TODO |
| 5.4 | **Document review endpoints** — admin approves/rejects each document with notes | ⬜ TODO |
| 5.5 | **Auto-verification status computation** — if ALL documents approved → driver `verification_status = approved` | ⬜ TODO |
| 5.6 | **Availability toggle** — go online/offline | ✅ `DriverAvailabilityView` |
| 5.7 | **Driver stats aggregation** — total trips, earnings, rating average, acceptance/cancellation rates | ⬜ TODO |
| 5.8 | **Driver suspension/ban logic** — rating below threshold → auto-suspend → admin review | ⬜ TODO |
| 5.9 | **Scheduled working hours** — driver sets availability windows (e.g., 8am-6pm weekdays) | ⬜ Future |

### Frontend — Driver

| # | Task | Details |
|---|------|---------|
| 5.10 | **Document upload page** — categorised file upload with preview, status indicators per document | New page |
| 5.11 | **Verification status dashboard** — see which documents are pending/approved/rejected | New component |
| 5.12 | **Online/offline toggle** — prominent switch on driver dashboard | `DashboardPage.tsx` |
| 5.13 | **Performance metrics view** — acceptance rate, cancellation rate, average rating | `ProfilePage.tsx` |

### Frontend — Admin

| # | Task | Details |
|---|------|---------|
| 5.14 | **Driver verification queue** — list of pending drivers with document previews | `DriversPage.tsx` |
| 5.15 | **Document review modal** — view document, approve/reject with notes | New component |
| 5.16 | **Driver detail page** — full driver profile, ride history, earnings, complaints | New page |

### Verification
- Driver registers → uploads documents → admin reviews → all approved → driver can go online
- One document rejected → driver notified → re-uploads → re-reviewed
- Driver rating drops below 3.0 → auto-suspended → admin notified

---

## 10. Phase 6 — Student Experience Polish

**Goal:** Premium, frictionless student experience that beats every competitor.

### Frontend

| # | Task | Details |
|---|------|---------|
| 6.1 | **Student Dashboard Redesign** — hero card with quick actions, recent rides, wallet balance, account status | `DashboardPage.tsx` |
| 6.2 | **Quick Book** — save frequent routes (e.g., "Hostel → Lecture Hall"), one-tap booking | New feature |
| 6.3 | **Predefined Destinations** — dropdown with campus landmarks (Gate, Library, Hostel blocks, Admin building) | `BookRidePage.tsx` |
| 6.4 | **GPS Auto-Detect** — browser Geolocation API for pickup, reverse geocode to address | `BookRidePage.tsx` |
| 6.5 | **Fare Estimate Preview** — show fare before confirming, broken down (base + distance + booking fee) | New component |
| 6.6 | **Ride Booking Confirmation** — summary screen before final submission | New step |
| 6.7 | **Student Profile Page** — edit name, photo, matric number, department | `ProfilePage.tsx` |
| 6.8 | **Spending Analytics** — monthly spending graph, most visited destinations, average trip cost | New component |
| 6.9 | **Support Ticket Submission** — select category, describe issue, attach ride reference | `SupportPage.tsx` |
| 6.10 | **Dark Mode** — system preference detection + manual toggle | Global CSS + Zustand |

### Verification
- Student opens app → dashboard loads in <1s → quick book available
- GPS auto-detects campus location → predefined destinations load → fare shows before booking
- Dark mode toggled → all pages render correctly

---

## 11. Phase 7 — Admin Command Centre

**Goal:** Enterprise-grade admin dashboard with real-time monitoring, user management, and financial control.

### Backend

| # | Task | Details |
|---|------|---------|
| 7.1 | **Multi-level admin roles** — Super Admin + Campus Admin + Operations with granular permissions | `accounts/permissions.py` |
| 7.2 | **Campus model** — support multiple universities with independent settings | New model |
| 7.3 | **Admin ride intervention** — manually assign/cancel/refund rides | `rides/views.py` |
| 7.4 | **Financial reports API** — revenue, commissions, payouts, wallet totals by date range | `analytics/views.py` |
| 7.5 | **User search & filter** — by role, status, date range, campus | ✅ Partially exists |
| 7.6 | **Audit log** — track all admin actions (who changed what, when) | New model |

### Frontend

| # | Task | Details |
|---|------|---------|
| 7.7 | **Admin Dashboard** — KPI cards (active rides, online drivers, today's revenue, open tickets), live ride map | `DashboardPage.tsx` |
| 7.8 | **User Management** — search/filter, view profiles, activate/deactivate, view ride history | `UsersPage.tsx` |
| 7.9 | **Ride Management** — live + historical rides, status filters, manual intervention controls | `RidesPage.tsx` |
| 7.10 | **Driver Management** — verification queue, driver detail, earnings history, suspension controls | `DriversPage.tsx` |
| 7.11 | **Pricing Configuration UI** — set base fares, per-km rates, surge multipliers per vehicle type | New page |
| 7.12 | **Financial Reports** — revenue charts, commission breakdown, payout history, exportable CSV | `AnalyticsPage.tsx` |
| 7.13 | **Support Ticket Management** — ticket list, assignment, status updates, resolution notes | `SupportPage.tsx` |
| 7.14 | **System Settings** — OTP expiry, ride timeout, commission rate, campus zones | New page |

### Verification
- Super Admin logs in → sees all campuses → can manage everything
- Campus Admin logs in → sees only their campus data → cannot access other campus
- Admin cancels a ride → student refunded → driver notified → audit log recorded

---

## 12. Phase 8 — Notifications & Communication

**Goal:** Multi-channel notification delivery (in-app, push, SMS) with real-time updates.

### Backend

| # | Task | Details |
|---|------|---------|
| 8.1 | **In-app notifications** — create notification on every significant event | ✅ Partially exists |
| 8.2 | **Push notifications via FCM** — send to device using FCM token | ⬜ TODO |
| 8.3 | **SMS notifications** — ride confirmation, payment alerts via Termii | ⬜ TODO |
| 8.4 | **Notification preferences** — users control which channels they receive | ⬜ TODO |
| 8.5 | **WebSocket notification channel** — real-time push to connected clients | ⬜ TODO |
| 8.6 | **Batch mark-as-read** — mark all or selected notifications | ⬜ TODO |

### Frontend

| # | Task | Details |
|---|------|---------|
| 8.7 | **Notification bell icon** — unread count badge in navbar | All portals |
| 8.8 | **Notification drawer/page** — grouped by date, mark-as-read, click to navigate | New component |
| 8.9 | **Toast notifications** — real-time popup for ride status changes | ✅ `react-hot-toast` integrated |

### Verification
- Student books ride → push notification sent to driver → in-app notification created
- Driver accepts → student gets push + in-app + SMS notification
- User marks all as read → badge clears → state persists

---

## 13. Phase 9 — Safety & Emergency Systems

**Goal:** Military-grade safety pipeline that ensures student and driver security.

### Backend

| # | Task | Details |
|---|------|---------|
| 9.1 | **SOS endpoint** — student/driver triggers emergency → notification to admin + campus security contact | ⬜ TODO |
| 9.2 | **Emergency contact model** — students save trusted contacts | ⬜ TODO |
| 9.3 | **Share ride details** — generate shareable link with live tracking (accessible without login) | ⬜ TODO |
| 9.4 | **Trip recording/logging** — timestamped location snapshots stored for dispute evidence | ✅ `TripLocationSnapshot` model exists |
| 9.5 | **Incident report endpoint** — structured incident logging with evidence attachment | ⬜ TODO |
| 9.6 | **Auto-SOS detection** — if ride takes unusually long or goes off-route, flag for admin review | ⬜ Future |

### Frontend

| # | Task | Details |
|---|------|---------|
| 9.7 | **SOS button** — prominent, one-tap during active ride, confirmation dialog, sends GPS + ride details | New component |
| 9.8 | **Share ride screen** — share via link/WhatsApp/SMS | New component |
| 9.9 | **Emergency contacts management** — add/edit/remove trusted contacts in profile | New component |
| 9.10 | **Admin incident dashboard** — real-time SOS alerts, ride details, driver/student info | New admin page |

### Verification
- Student triggers SOS → admin receives instant alert → ride flagged → GPS snapshot captured
- Shared ride link works without login → shows live driver location
- Trip log shows complete GPS trail after ride completion

---

## 14. Phase 10 — Analytics & Intelligence

**Goal:** Data-driven insights for operations, growth, and competitive advantage.

### Backend

| # | Task | Details |
|---|------|---------|
| 10.1 | **Aggregated analytics models** — daily/weekly/monthly summaries for rides, revenue, users | `analytics/models.py` |
| 10.2 | **Celery task: daily aggregation** — compute and store daily stats at midnight | `analytics/tasks.py` |
| 10.3 | **Peak hour detection** — identify high-demand hours from historical data | `analytics/services.py` |
| 10.4 | **Demand zone mapping** — which campus areas generate the most ride requests | `analytics/services.py` |
| 10.5 | **User acquisition metrics** — daily signups, activation rate, retention | `analytics/views.py` |
| 10.6 | **Driver utilization metrics** — online hours, trips per hour, idle time | `analytics/views.py` |
| 10.7 | **Revenue analytics** — daily revenue, commission earned, average fare, payment method distribution | `analytics/views.py` |

### Frontend — Admin

| # | Task | Details |
|---|------|---------|
| 10.8 | **Analytics Dashboard** — interactive charts (line, bar, pie), date range selector, export | `AnalyticsPage.tsx` |
| 10.9 | **Heat map** — demand visualization on campus map | New component |
| 10.10 | **KPI cards** — Average wait time, ride completion rate, driver utilization, customer satisfaction | `DashboardPage.tsx` |

### Verification
- Daily aggregation runs → stats available next morning
- Admin filters by date range → charts update → CSV export works

---

## 15. Phase 11 — Campus Zoning & Optimisation

**Goal:** Campus-aware ride matching that beats generic ride-hailing algorithms.

### Backend

| # | Task | Details |
|---|------|---------|
| 11.1 | **Campus Zone model** — name, boundary polygon (GeoJSON), zone type (hostel/academic/gate) | New model in `rides/` or new app |
| 11.2 | **Zone-aware matching** — prioritise drivers within same zone as pickup | `rides/services.py` |
| 11.3 | **Predefined destinations** — admin-managed list of popular campus locations with coordinates | New model |
| 11.4 | **Route optimisation** — suggest optimal routes within campus | ⬜ Future (OSRM integration) |
| 11.5 | **Surge pricing by zone** — dynamic multiplier based on demand/supply ratio per zone | `pricing/services.py` |

### Frontend

| # | Task | Details |
|---|------|---------|
| 11.6 | **Destination picker** — list of campus landmarks with icons, search, recent selections | New component |
| 11.7 | **Zone visualization** — coloured zones on map with demand indicators | Admin dashboard |

---

## 16. Phase 12 — Premium & Competitive Features

**Goal:** Features that directly outcompete the 1,000+ market competitors.

| # | Feature | Details | Priority |
|---|---------|---------|----------|
| 12.1 | **Scheduled Rides** — book in advance (e.g., "Tomorrow 8am from Hostel to class") | HIGH |
| 12.2 | **Ride Pooling** — share rides with other students going same direction, split fare | MEDIUM |
| 12.3 | **Loyalty Points System** — earn points per ride, redeem for discounts | MEDIUM |
| 12.4 | **Referral Programme** — invite friends, earn credit on their first ride | HIGH |
| 12.5 | **Offline/USSD Fallback** — SMS-based ride booking for low-internet scenarios | HIGH (Nigeria market) |
| 12.6 | **AI Demand Prediction** — predict busy locations/times from class schedules + historical data | MEDIUM |
| 12.7 | **Driver Leaderboard** — weekly top performers get bonuses | LOW |
| 12.8 | **Student ID Integration** — verify student status via university database API | MEDIUM |
| 12.9 | **In-App Chat** — student ↔ driver messaging during ride (no phone number exposure) | HIGH |
| 12.10 | **Multi-Campus Support** — deploy same system across multiple universities | HIGH |
| 12.11 | **PWA / Installable Web App** — add to homescreen, offline caching, native-like experience | HIGH |
| 12.12 | **Accessibility (WCAG 2.1 AA)** — screen reader support, keyboard navigation | MEDIUM |

---

## 17. Phase 13 — Testing & Quality Assurance

**Goal:** Enterprise-grade test coverage ensuring zero critical bugs in production.

### Backend Testing

| # | Test Type | Scope | Tool |
|---|-----------|-------|------|
| 13.1 | **Unit Tests** — all services, serializers, model methods | 90%+ coverage target | `pytest` + `pytest-django` |
| 13.2 | **Integration Tests** — full API request/response cycle for every endpoint | All endpoints | `pytest` + DRF test client |
| 13.3 | **WebSocket Tests** — connection, authentication, message flow | All consumers | `channels.testing` |
| 13.4 | **Payment Webhook Tests** — mock Paystack/Flutterwave webhooks, verify idempotency | Payment flows | `pytest` + `responses` |
| 13.5 | **Load Testing** — 500 concurrent ride requests, 100 simultaneous WebSocket connections | System limits | `locust` or `k6` |
| 13.6 | **Security Testing** — SQL injection, XSS, CSRF, IDOR, auth bypass attempts | All endpoints | `bandit` + manual review |

### Frontend Testing

| # | Test Type | Scope | Tool |
|---|-----------|-------|------|
| 13.7 | **Component Tests** — all shared components render correctly | All components | `vitest` + `@testing-library/react` |
| 13.8 | **Integration Tests** — full page renders with mocked API | All pages | `vitest` |
| 13.9 | **E2E Tests** — complete user flows (register → book → pay → rate) | Critical paths | Browser subagent or Playwright |
| 13.10 | **Accessibility Audit** — WCAG compliance check | All pages | `axe-core` |

### Verification
- `pytest --cov` shows >85% coverage on backend
- `npm run test` passes all frontend tests
- E2E test suite completes without failures
- Load test: 500 concurrent users with <2s response time on 95th percentile

---

## 18. Phase 14 — Deployment & DevOps

**Goal:** Zero-downtime deployment pipeline with monitoring and observability.

### Infrastructure

| # | Task | Details |
|---|------|---------|
| 14.1 | **Docker images optimisation** — multi-stage builds, minimal image size (<200MB) | `infrastructure/docker/` |
| 14.2 | **Docker Compose (production)** — PostgreSQL 16, Redis 7, Daphne (ASGI), Celery, Nginx | ✅ Exists, needs hardening |
| 14.3 | **SSL/TLS** — Let's Encrypt certificates via Certbot or Cloudflare | `nginx.conf` |
| 14.4 | **GitHub Actions CI/CD** — test → build → deploy on push to `main` | `.github/workflows/` |
| 14.5 | **Database migrations in CI** — auto-run migrations on deploy | Pipeline step |
| 14.6 | **Environment secrets management** — GitHub Secrets / Vault / DigitalOcean Secrets | Pipeline config |
| 14.7 | **Health checks** — `/health/` endpoint for load balancer, DB + Redis + Celery checks | ✅ `core/health.py` exists |
| 14.8 | **Kubernetes deployment** (optional) — horizontal pod autoscaling, rolling updates | ✅ Manifests exist |

### Monitoring & Observability

| # | Task | Details |
|---|------|---------|
| 14.9 | **Application logging** — structured JSON logs shipped to aggregator (ELK or Loki) | `core/settings/production.py` |
| 14.10 | **Error tracking** — Sentry integration for both backend and frontend | `sentry-sdk` |
| 14.11 | **Uptime monitoring** — external health checks every 60s with alerting | UptimeRobot / Betterstack |
| 14.12 | **Performance monitoring** — request latency, DB query time, WebSocket connection count | Prometheus + Grafana |
| 14.13 | **Database backups** — automated daily backups with 30-day retention | `pg_dump` + S3 |

### Verification
- Push to `main` → CI runs tests → Docker image built → Deployed to staging → Smoke tests pass → Deploy to production
- SSL certificate active → all traffic HTTPS
- Health endpoint returns 200 → load balancer routes traffic
- Sentry captures errors → team notified within 60s

---

## 19. Phase 15 — Post-Launch Operations

**Goal:** Sustain quality and growth after initial launch.

| # | Area | Tasks |
|---|------|-------|
| 15.1 | **Launch Checklist** | Security audit, performance baseline, backup verification, rollback plan |
| 15.2 | **Soft Launch** | 100 beta students + 10 drivers on one campus, iterate on feedback |
| 15.3 | **Incident Response** | Runbook for common issues (payment failures, WebSocket drops, SOS alerts) |
| 15.4 | **Performance Optimization** | Database query optimization, caching strategy, CDN for static assets |
| 15.5 | **User Feedback Loop** | In-app feedback form, weekly review of ratings and complaints |
| 15.6 | **Driver Onboarding Campaign** | Streamlined signup, referral bonuses, initial earning guarantees |
| 15.7 | **Documentation** | API docs (Swagger/Redoc), admin user guide, driver onboarding guide |
| 15.8 | **Mobile App** (React Native) | Port web PWA experience to native iOS/Android using shared API layer |

---

## 20. Testing Accounts & Credentials

| Role | Phone Number | Password | Status |
|------|-------------|----------|--------|
| **Student** | `+2348000000001` | `StudentPass123!` | ✅ Created — Unverified |
| **Driver** | `+2348000000002` | `DriverPass123!` | ✅ Created — Profile Incomplete |
| **Admin (Superuser)** | `+2348000000000` | `AdminPass123!` | ✅ Created — Active |

---

## 21. Technology Stack Reference

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Backend Framework** | Django | 5.1 | Core API, ORM, Admin |
| **API Framework** | Django REST Framework | Latest | RESTful API layer |
| **Auth** | SimpleJWT | Latest | Token-based authentication |
| **Async/WebSocket** | Django Channels | Latest | Real-time communication |
| **Task Queue** | Celery | Latest | Background job processing |
| **Task Scheduler** | Celery Beat | Latest | Periodic tasks |
| **Frontend Framework** | React | 19 | UI rendering |
| **Build Tool** | Vite | 8 | Frontend bundling |
| **Type System** | TypeScript | 5.9 | Type safety |
| **State Management** | Zustand | 5 | Client-side state |
| **Data Fetching** | TanStack React Query | 5 | Server state management |
| **HTTP Client** | Axios | Latest | API communication |
| **Routing** | React Router | 7 | Client-side routing |
| **Forms** | React Hook Form + Zod | Latest | Form validation |
| **Database** | PostgreSQL | 16 | Primary datastore |
| **Cache/Queue** | Redis | 7 | Caching + Celery broker |
| **SMS Provider** | Termii | API | OTP delivery |
| **Payment Gateway 1** | Paystack | API | Card payments + Wallet top-up |
| **Payment Gateway 2** | Flutterwave | API | Alternative payments |
| **Push Notifications** | Firebase FCM | API | Mobile/web push |
| **Containerization** | Docker | Latest | Deployment packaging |
| **Reverse Proxy** | Nginx | Latest | SSL + static files + load balancing |
| **CI/CD** | GitHub Actions | Latest | Automated pipeline |
| **Orchestration** | Kubernetes | Latest | Production scaling (future) |

---

## 22. Risk Registry

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low driver supply at launch | HIGH | CRITICAL | Aggressive driver recruitment + earning guarantees + incentives |
| SMS delivery failures (Termii) | MEDIUM | HIGH | Fallback to console OTP in dev, multi-provider in production |
| Payment gateway downtime | LOW | CRITICAL | Dual gateway (Paystack + Flutterwave), cash fallback |
| WebSocket scaling limits | MEDIUM | MEDIUM | Redis channel layer, horizontal scaling via K8s |
| Database performance under load | LOW | HIGH | Query optimization, read replicas, connection pooling (pgbouncer) |
| Security breach / data leak | LOW | CRITICAL | Regular security audits, encryption at rest, HTTPS everywhere |
| GPS accuracy issues on campus | MEDIUM | MEDIUM | Manual pickup selection + predefined locations as fallback |
| User adoption resistance | MEDIUM | HIGH | Referral incentives, campus partnerships, promotional credits |

---

## 23. Success Metrics

| Metric | Target (Month 1) | Target (Month 6) | Target (Year 1) |
|--------|-----------------|-----------------|-----------------|
| Daily Active Users (Students) | 100 | 1,000 | 5,000 |
| Daily Rides Completed | 50 | 500 | 2,500 |
| Average Wait Time | <5 min | <3 min | <2 min |
| Ride Completion Rate | >85% | >92% | >95% |
| Driver Utilization Rate | >40% | >60% | >75% |
| Customer Satisfaction (avg rating) | >4.0 | >4.3 | >4.5 |
| Payment Success Rate | >95% | >98% | >99% |
| System Uptime | >99% | >99.5% | >99.9% |
| Average Response Time (API) | <500ms | <300ms | <200ms |

---

> **Execution Order:** Phases are designed to be executed sequentially (0 → 15). However, some phases can overlap. For example:
> - Phase 3 (Real-Time) can begin alongside Phase 2 (Ride Engine) since they share the ride lifecycle.
> - Phase 8 (Notifications) can run in parallel with Phase 5 (Driver Ecosystem).
> - Phase 13 (Testing) should be continuous — write tests alongside every phase, not deferred.
>
> **The non-negotiable sequence is:** Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6.  
> Everything after Phase 6 can be parallelised based on team capacity.

---

*This document is a living roadmap. It will be updated as phases complete and new requirements emerge.*

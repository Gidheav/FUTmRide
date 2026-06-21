# LR Ride API Reference

Base URL: https://yourdomain.com/api/v1
Auth header: Authorization: Bearer <access_token>

## Auth
POST /auth/register/
POST /auth/login/
POST /auth/logout/
POST /auth/token/refresh/
POST /auth/otp/request/
POST /auth/otp/verify/
POST /auth/change-password/
GET  /auth/settings/system-health/        [admin]

## Users
GET/PATCH /users/me/
GET/PUT   /users/me/student-profile/
GET/PUT   /users/me/driver-profile/
POST      /users/me/driver-profile/create/
PATCH     /users/me/driver-profile/availability/
GET       /users/                          [admin]
GET/PUT   /users/{id}/                     [admin]
PATCH     /users/{id}/toggle-active/       [admin]
GET       /users/drivers/                  [admin]
PATCH     /users/drivers/{id}/verify/      [admin]

## Rides
POST /rides/request/
GET  /rides/my/
GET  /rides/{id}/
POST /rides/{id}/cancel/
POST /rides/{id}/advance/
GET  /rides/driver/active/
GET  /rides/driver/history/
GET  /rides/                               [admin]

## Payments
GET  /payments/wallet/transactions/
POST /payments/wallet/topup/
POST /payments/webhooks/paystack/
POST /payments/webhooks/flutterwave/

## Ratings
POST /ratings/
GET  /ratings/mine/

## Notifications
GET  /notifications/
POST /notifications/mark-read/
GET  /notifications/unread-count/

## Verification
GET/POST /verification/documents/
GET      /verification/admin/drivers/{id}/documents/  [admin]
PATCH    /verification/admin/documents/{id}/review/   [admin]

## Pricing
GET/POST  /pricing/config/               [admin]
GET/PATCH /pricing/config/{id}/          [admin]
POST      /pricing/estimate/

## Support
POST    /support/tickets/
GET     /support/tickets/mine/
GET     /support/admin/tickets/          [admin]
GET/PUT /support/admin/tickets/{id}/     [admin]

## Analytics (admin only)
GET /analytics/summary/
GET /analytics/rides/trend/?days=7

## WebSockets
ws://host/ws/tracking/driver/{driver_id}/
ws://host/ws/tracking/ride/{ride_id}/

# LR Ride

Production-grade ride-booking platform connecting students and drivers.

## Stack

- **Backend**: Django 5.1 + DRF + Django Channels + Celery
- **Frontend**: React 18 + Vite + TypeScript
- **Database**: PostgreSQL 16 (SQLite in development)
- **Cache / Queue**: Redis 7
- **Real-time**: WebSockets via Django Channels
- **Payments**: Paystack + Flutterwave
- **Infrastructure**: Docker + Nginx + GitHub Actions CI

## Quick Start (Development)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements/development.txt
python manage.py migrate --settings=core.settings.development
python manage.py createsuperuser --settings=core.settings.development
python manage.py runserver 8002 --settings=core.settings.development
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5174
Backend API: http://localhost:8002/api/v1
Admin: http://localhost:8002/admin

## Running Tests
```bash
cd backend
python -m pytest apps/accounts/tests.py apps/rides/tests.py apps/payments/tests.py -v
```

## Environment Variables

Copy `backend/.env` and fill in real values for production.
Never commit `.env` files.

## Portals

| Portal | URL | Description |
|---|---|---|
| Student | /login | Book rides, track driver, view history |
| Driver | /driver/login | Accept rides, manage availability, view earnings |
| Admin | /admin/login | Manage users, drivers, rides, analytics |

## API Endpoints

| Resource | Endpoint |
|---|---|
| Auth | /api/v1/auth/ |
| Users | /api/v1/users/ |
| Rides | /api/v1/rides/ |
| Payments | /api/v1/payments/ |
| Ratings | /api/v1/ratings/ |
| Notifications | /api/v1/notifications/ |
| Verification | /api/v1/verification/ |
| Analytics | /api/v1/analytics/ |
| Pricing | /api/v1/pricing/ |
| Support | /api/v1/support/ |

## WebSocket Endpoints

| Event | URL |
|---|---|
| Driver location | ws://host/ws/tracking/driver/{driver_id}/ |
| Ride tracking | ws://host/ws/tracking/ride/{ride_id}/ |
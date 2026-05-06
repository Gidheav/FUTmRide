# AFRICUL Complete Architecture Guide - How Everything Works Together

This guide explains the **entire AFRICUL system** - how mobile, web, and backend interact to create a complete platform.

---

## 🏛️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AFRICUL PLATFORM                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   MOBILE APP     │  │   WEB FRONTEND   │  │   ADMIN WEB  │  │
│  │  (Expo + RN)     │  │ (Vite + React)   │  │  (Vite +RX)  │  │
│  │  - Feed Screen   │  │  - Public Feed   │  │  - Dashboard │  │
│  │  - Profiles      │  │  - Creator Page  │  │  - Mod Tools │  │
│  │  - Vault         │  │  - Vault         │  │  - Settings  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬──────┘  │
│           │                     │                    │         │
│           └─────────────────────┼────────────────────┘         │
│                                 │                              │
│                    ┌────────────▼────────────┐                │
│                    │  Django REST API        │                │
│                    │  (Port 8000)            │                │
│                    │                         │                │
│                    │  /api/v1/auth/          │                │
│                    │  /api/v1/feed/          │                │
│                    │  /api/v1/content/       │                │
│                    │  /api/v1/profiles/      │                │
│                    │  /api/v1/vault/         │                │
│                    │  /api/v1/notifications/ │                │
│                    │                         │                │
│                    └────────────┬────────────┘                │
│                                 │                              │
│           ┌─────────────────────┼─────────────────────┐       │
│           │                     │                     │       │
│    ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼───┐   │
│    │  PostgreSQL │      │    Redis    │      │ Celery   │   │
│    │  Database   │      │   (Cache)   │      │ (Tasks)  │   │
│    │             │      │             │      │          │   │
│    │  - Users    │      │  - Sessions │      │  - Email │   │
│    │  - Posts    │      │  - Auth     │      │  - Media │   │
│    │  - Profiles │      │  - Locks    │      │          │   │
│    └─────────────┘      └─────────────┘      └──────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 📱 MOBILE APP (Expo + React Native)

### What It Does
- **Primary platform** for AFRICUL (80%+ of African users on mobile)
- Lightweight, fast, works on weak networks
- Real-time feed, creator profiles, content vault
- Works offline, syncs when online

### Technology Stack
```
React Native 0.76
└── Expo SDK 52
    ├── Expo Router (navigation)
    ├── React 18.3.1
    └── TypeScript 5.6
```

### Key Files
```
mobile/
├── app/
│   ├── _layout.tsx           ← Root navigation
│   └── (tabs)/
│       ├── feed.tsx          ← Main feed tab
│       ├── profile.tsx       ← User profile tab
│       └── _layout.tsx       ← Tab navigation setup
│
├── src/
│   ├── platform/api/client.ts
│   │   └── Handles all HTTP requests to backend
│   │
│   ├── platform/state/authStore.ts
│   │   └── Global state: who's logged in
│   │
│   ├── features/public/
│   │   ├── feed/
│   │   │   ├── FeedScreen.tsx     ← UI component
│   │   │   └── feedService.ts    ← Call backend API
│   │   │
│   │   └── profiles/
│   │       ├── ProfileScreen.tsx
│   │       └── profileService.ts
│   │
│   └── components/ui/            ← Shared design primitives
│       └── AppButton.tsx
│
└── .env
    └── EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### How Mobile Talks to Backend

```typescript
// 1. Define what data we need (TypeScript interface)
interface FeedPost {
  id: string;
  title: string;
  content: string;
  creator: string;
}

// 2. Create a service function to fetch from API
async function fetchFeed(): Promise<FeedPost[]> {
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/feed/`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    }
  );
  return response.json();
}

// 3. Use in component
export function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  
  useEffect(() => {
    fetchFeed().then(setPosts);
  }, []);
  
  return (
    <FlatList
      data={posts}
      renderItem={({ item }) => <PostCard post={item} />}
    />
  );
}
```

### Running Mobile App Locally

```powershell
# Terminal 1: Start backend
cd backend
python manage.py runserver

# Terminal 2: Start development server
cd mobile
npm start

# Then in Expo Go app on phone:
# Scan QR code → App opens and connects to backend
```

**Flow when you press "Load Feed":**
1. Mobile app calls: `POST http://localhost:8000/api/v1/feed/`
2. Backend Django API receives request
3. Backend queries PostgreSQL database
4. Backend returns JSON: `[{ id: "1", title: "..." }, ...]`
5. Mobile app receives JSON and displays posts

---

## 🌐 WEB FRONTEND (Vite + React)

### What It Does
- **Depth-first content experience** for desktop users
- Full creator dashboard for uploads
- Better for composing long-form content
- Admin dashboard for moderation and analytics

### Technology Stack
```
Vite 8.0
└── React 18.3.1
    ├── React Router (navigation)
    ├── Axios (HTTP client)
    ├── TanStack Query (server state)
    ├── Zustand (global state)
    └── TypeScript 5.6
```

### Key Files
```
frontend/
├── src/
│   ├── main.tsx                    ← Entry point
│   │
│   ├── app/
│   │   └── App.tsx                 ← Root component + routing
│   │
│   ├── platform/
│   │   ├── api/
│   │   │   └── client.ts           ← Axios HTTP client
│   │   │
│   │   └── state/
│   │       └── authStore.ts        ← Zustand auth store
│   │
│   ├── features/
│   │   ├── public/                 ← Public/user features
│   │   │   ├── feed/
│   │   │   │   ├── FeedPage.tsx
│   │   │   │   └── feedService.ts
│   │   │   └── content/
│   │   │       ├── ContentPage.tsx
│   │   │       └── contentService.ts
│   │   │
│   │   └── admin/                  ← Admin-only features
│   │       ├── dashboard/
│   │       │   ├── AdminDashboardPage.tsx
│   │       │   └── adminService.ts
│   │       └── content-review/
│   │           ├── ContentReviewPage.tsx
│   │           └── reviewService.ts
│   │
│   ├── components/
│   │   └── ui/                     ← Design system primitives
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Input.tsx
│   │
│   └── styles/
│       └── index.css
│
├── index.html                       ← HTML entry point
├── vite.config.ts                   ← Bundler config
└── tsconfig.json
```

### Differences Between Web and Mobile

| Aspect | Mobile (Expo) | Web (Vite) |
|--------|---------------|-----------|
| API Client | Fetch API | Axios |
| HTTP Requests | Plain fetch | Axios with interceptors |
| Navigation | Expo Router | React Router |
| Styling | React Native StyleSheet | CSS/Tailwind |
| State | Zustand | Zustand + TanStack Query |
| UI Primitives | React Native (View, Text) | HTML (div, button) |

### Web Frontend Skeleton

```typescript
// frontend/src/app/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedPage } from "@/features/public/feed/FeedPage";
import { AdminDashboardPage } from "@/features/admin/dashboard/AdminDashboardPage";
import { LoginPage } from "@/features/public/auth/LoginPage";
import { useAuthStore } from "@/platform/state/authStore";

const queryClient = new QueryClient();

export function App() {
  const { accessToken } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        {accessToken ? (
          <>
            <Route path="/" element={<Navigate to="/feed" replace />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
          </>
        ) : (
          <Route path="/" element={<LoginPage />} />
        )}
      </Routes>
    </QueryClientProvider>
  );
}
```

### Running Web Frontend Locally

```powershell
# Terminal 1: Backend
cd backend
python manage.py runserver

# Terminal 2: Frontend
cd frontend
npm install
npm run dev

# Opens: http://localhost:5173
```

---

## 🔌 BACKEND API (Django REST Framework)

### What It Does
- **Single source of truth** for all data
- Handles authentication (JWT tokens)
- Enforces permissions and authorization
- Stores data in PostgreSQL
- Queues async tasks (email, media processing) in Celery

### Architecture Pattern
```
Backend is a "Modular Monolith":
- Single Django project (africul_backend)
- Multiple domain modules (apps)
- Each module is independently testable
- Modules communicate through APIs, not imports
```

### Module Structure
```
backend/
├── africul_backend/              ← Django project config
│   ├── settings/
│   │   ├── base.py               ← Shared settings
│   │   ├── local.py              ← Development (SQLite)
│   │   ├── staging.py            ← Staging environment
│   │   └── production.py         ← Production environment
│   │
│   ├── urls.py                   ← Main URL router
│   ├── wsgi.py                   ← WSGI app (production)
│   ├── asgi.py                   ← ASGI app (real-time)
│   ├── celery.py                 ← Celery config
│   └── routing.py                ← WebSocket routing
│
├── apps/                         ← Domain modules
│   ├── core/                     ← Shared/base models and permissions
│   │   └── models.py             ← Base user model
│   │
│   ├── accounts/                 ← User accounts domain
│   │   ├── models.py             ← User model
│   │   ├── api/
│   │   │   └── views.py          ← Endpoints: register, /me
│   │   ├── services.py           ← Business logic
│   │   ├── selectors.py          ← Query builders
│   │   └── tasks.py              ← Async tasks
│   │
│   ├── identity/                 ← Authentication domain
│   │   ├── api/
│   │   │   └── views.py          ← Endpoints: login, refresh
│   │   ├── services.py           ← Token generation
│   │   └── selectors.py
│   │
│   ├── profiles/                 ← Creator profiles
│   │   ├── models.py             ← Profile model
│   │   ├── api/views.py          ← GET/PATCH profile
│   │   └── services.py
│   │
│   ├── content/                  ← Posts, videos, images
│   │   ├── models.py             ← Post, Video models
│   │   ├── api/
│   │   │   ├── views.py          ← CRUD endpoints
│   │   │   └── serializers.py    ← JSON serialization
│   │   ├── services.py           ← Create/publish logic
│   │   └── selectors.py          ← Query posts
│   │
│   ├── feed/                     ← Personalized feed
│   │   ├── models.py             ← FeedItem model
│   │   ├── api/views.py          ← GET /feed/
│   │   ├── services.py           ← Feed algorithm
│   │   └── selectors.py          ← Query feed
│   │
│   ├── vault/                    ← Private content storage
│   │   ├── models.py
│   │   ├── api/views.py
│   │   └── services.py
│   │
│   ├── notifications/            ← In-app notifications
│   │   ├── models.py             ← Notification model
│   │   ├── api/views.py          ← List notifications
│   │   ├── consumers.py          ← WebSocket real-time
│   │   └── tasks.py              ← Send notifications
│   │
│   ├── media/                    ← Media upload/storage
│   │   ├── models.py
│   │   ├── services.py           ← Upload to S3/Cloudinary
│   │   └── tasks.py              ← Process/transcode
│   │
│   ├── search/                   ← Full-text search
│   │   ├── services.py           ← Elasticsearch queries
│   │   └── indexing.py
│   │
│   ├── moderation/               ← Trust & safety
│   │   ├── models.py             ← Flag, Report models
│   │   ├── services.py           ← Review logic
│   │   └── tasks.py
│   │
│   └── analytics/                ← Usage metrics
│       ├── models.py
│       └── services.py
│
├── manage.py                     ← Django CLI
└── db.sqlite3                    ← Local development DB
```

### Core API Endpoints (What Mobile + Web Call)

```
╔════════════════════════════════════════════════════════════════╗
║            AUTHENTICATION & ACCOUNTS                           ║
╠════════════════════════════════════════════════════════════════╣
║  POST /api/v1/accounts/register/                                ║
║    Request:  { email, password, username }                     ║
║    Response: { id, email, username, access_token }            ║
║                                                                ║
║  POST /api/v1/identity/login/                                  ║
║    Request:  { email, password }                              ║
║    Response: { access_token, refresh_token, user }            ║
║                                                                ║
║  GET /api/v1/accounts/me/                                      ║
║    Response: { id, email, username, profile { ... } }         ║
║    Requires: Authorization: Bearer <token>                    ║
║                                                                ║
║  POST /api/v1/identity/refresh/                                ║
║    Request:  { refresh_token }                                ║
║    Response: { access_token }                                 ║
╠════════════════════════════════════════════════════════════════╣
║            FEED                                                ║
╠════════════════════════════════════════════════════════════════╣
║  GET /api/v1/feed/?limit=20&page=1                            ║
║    Response: { results: [ { id, title, creator, ... } ] }    ║
║    Requires: Authorization: Bearer <token>                    ║
╠════════════════════════════════════════════════════════════════╣
║            CONTENT (Posts, Videos)                             ║
╠════════════════════════════════════════════════════════════════╣
║  GET /api/v1/content/posts/                                    ║
║    Response: [ { id, title, content_type, ... } ]            ║
║                                                                ║
║  POST /api/v1/content/posts/                                   ║
║    Request:  { title, content, content_type }                ║
║    Response: { id, title, ... }                               ║
║    Requires: Authorization: Bearer <token>                    ║
║                                                                ║
║  PATCH /api/v1/content/posts/{id}/                             ║
║    Request:  { title, content }                               ║
║    Response: { id, title, ... }                               ║
║                                                                ║
║  DELETE /api/v1/content/posts/{id}/                            ║
║    Response: 204 No Content                                    ║
║                                                                ║
║  POST /api/v1/content/posts/{id}/publish/                      ║
║    Response: { id, status: "published", ... }                ║
╠════════════════════════════════════════════════════════════════╣
║            NOTIFICATIONS                                       ║
╠════════════════════════════════════════════════════════════════╣
║  GET /api/v1/notifications/                                    ║
║    Response: [ { id, title, body, is_read, ... } ]           ║
║    Requires: Authorization: Bearer <token>                    ║
║                                                                ║
║  POST /api/v1/notifications/read/                              ║
║    Request:  { notification_id }                              ║
║    Response: { success: true }                                ║
║                                                                ║
║  WebSocket (Real-time):                                        ║
║    ws://localhost:8000/ws/notifications/?token=<JWT>         ║
║    Events: { type: "notification_created", data: {...} }     ║
╚════════════════════════════════════════════════════════════════╝
```

### How Backend Processes a Request

**Example: Mobile app fetches feed**

```
1. Mobile app makes request:
   GET /api/v1/feed/?limit=20
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

2. Django URL router (urls.py) receives request:
   path("feed/", include("apps.feed.api.urls"))
   
3. Feed module's view.py handles it:
   class FeedListView(APIView):
       def get(self, request):
           # 1. Check auth (via JWT token)
           # 2. Call selector to query database
           # 3. Return paginated results
           feed_items = feed_selector.list_for_user(
               user=request.user,
               limit=20
           )
           serializer = FeedPostSerializer(feed_items, many=True)
           return Response(serializer.data)

4. Selector queries PostgreSQL:
   SELECT * FROM feed_item 
   WHERE user_id = 123 
   ORDER BY created_at DESC 
   LIMIT 20

5. Database returns results

6. Serializer converts to JSON:
   [
     { "id": "1", "title": "...", "creator": "...", ... },
     { "id": "2", "title": "...", "creator": "...", ... },
   ]

7. Django returns HTTP response:
   HTTP 200 OK
   Content-Type: application/json
   [...]

8. Mobile app receives JSON and displays feed
```

---

## 🗄️ DATABASE SCHEMA (PostgreSQL)

### Key Tables

```sql
-- Users (from accounts app)
CREATE TABLE accounts_user (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  username VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMP,
  is_active BOOLEAN,
  is_staff BOOLEAN
);

-- Creator Profiles (from profiles app)
CREATE TABLE profiles_profile (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES accounts_user,
  display_name VARCHAR,
  bio TEXT,
  avatar_url VARCHAR,
  created_at TIMESTAMP
);

-- Posts (from content app)
CREATE TABLE content_post (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES accounts_user,
  title VARCHAR,
  description TEXT,
  content_type VARCHAR,  -- "video", "image", "text"
  status VARCHAR,        -- "draft", "published", "archived"
  created_at TIMESTAMP,
  published_at TIMESTAMP
);

-- Feed Items (from feed app)
CREATE TABLE feed_feeditem (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES accounts_user,
  post_id UUID REFERENCES content_post,
  created_at TIMESTAMP
);

-- Notifications (from notifications app)
CREATE TABLE notifications_notification (
  id UUID PRIMARY KEY,
  recipient_id UUID REFERENCES accounts_user,
  title VARCHAR,
  body TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMP
);
```

---

## 🔐 Authentication Flow (Complete)

### 1. User Registration

```
┌─────────────────┐
│  Mobile App     │
└────────┬────────┘
         │ POST /api/v1/accounts/register/
         │ { email, password, username }
         ▼
┌─────────────────────────────────┐
│  Backend - accounts.views       │
│  RegisterView.post()            │
│  - Hash password                │
│  - Create user in DB            │
│  - Generate JWT token           │
└────────┬────────────────────────┘
         │ Return { user, access_token }
         ▼
┌──────────────────┐
│  Zustand Store   │
│  setAuth(token)  │
└──────────────────┘
```

### 2. User Login

```
┌─────────────────┐
│  Mobile App     │
│  LoginScreen    │
└────────┬────────┘
         │ POST /api/v1/identity/login/
         │ { email, password }
         ▼
┌──────────────────────────────────┐
│  Backend - identity.views        │
│  LoginView.post()                │
│  - Query user by email           │
│  - Check password hash           │
│  - Generate JWT tokens           │
└────────┬───────────────────────┘
         │ Return { access_token, refresh_token }
         ▼
┌──────────────────────────────────┐
│  Mobile Stores Token             │
│  authStore.setAuth(token)        │
└──────────────────────────────────┘
```

### 3. Authenticated API Requests

```
┌──────────────────────────┐
│  Mobile App              │
│  fetchFeed()             │
└────────┬─────────────────┘
         │ 1. Get token from Zustand
         │    token = useAuthStore.getState().accessToken
         │
         │ 2. Make request with Authorization header
         │    GET /api/v1/feed/
         │    Authorization: Bearer <access_token>
         ▼
┌────────────────────────────────────┐
│  Backend - Django Middleware       │
│  JWTAuthentication                 │
│  - Validate token signature        │
│  - Decode token                    │
│  - Attach user to request          │
└────────┬─────────────────────────┘
         │
         ▼ Authorization successful
         │
┌────────────────────────────────────┐
│  Backend - feed.views              │
│  FeedListView.get(request)         │
│  - request.user = authenticated    │
│  - Query feed for this user        │
│  - Return results                  │
└────────┬─────────────────────────┘
         │ Return JSON [ ... ]
         ▼
┌──────────────────────────┐
│  Mobile App              │
│  Display posts in FlatList
└──────────────────────────┘
```

### 4. Token Refresh (Automatic)

```
When access_token expires (usually 15 minutes):

┌──────────────────┐
│  Mobile App      │
│  Make API call   │ GET /api/v1/feed/
└────────┬─────────┘
         │ (with expired token)
         ▼
┌──────────────────────────┐
│  Django                  │
│  Token expired ❌        │
│  Returns: 401 Unauthorized
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Mobile App Interceptor          │
│  Sees 401 → Need to refresh      │
│  POST /api/v1/identity/refresh/  │
│  { refresh_token }               │
└────────┬───────────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Backend                 │
│  Validates refresh token │
│  Issues new access_token │
└────────┬─────────────────┘
         │ Return { new access_token }
         ▼
┌──────────────────────────────────┐
│  Mobile                          │
│  authStore.setAuth(new_token)   │
│  Retry original request with new token
└──────────────────────────────────┘
```

---

## 🔄 How Frontend & Mobile Share Code Structure

Both use **similar patterns** but different technologies:

### Common Pattern: Feature Service

**Mobile (React Native):**
```typescript
// mobile/src/features/feed/feedService.ts
import { apiGet } from "@/platform/api/client";

export interface FeedPost {
  id: string;
  title: string;
  creator: string;
}

export async function fetchFeed(): Promise<FeedPost[]> {
  return apiGet<FeedPost[]>("/feed/");
}
```

**Web (React + Vite):**
```typescript
// frontend/src/features/feed/feedService.ts
import { apiClient } from "@/platform/api/client";

export interface FeedPost {
  id: string;
  title: string;
  creator: string;
}

export async function fetchFeed(): Promise<FeedPost[]> {
  const { data } = await apiClient.get<FeedPost[]>("/feed/");
  return data;
}
```

**Differences:**
- Mobile uses `fetch` API (simpler, smaller bundle)
- Web uses `axios` (better for complex scenarios, interceptors)
- Both return same TypeScript interfaces
- Both talk to same backend `/feed/` endpoint

---

## 🚀 Deployment Architecture

### Local Development

```
Your machine:
  - Backend: python manage.py runserver (port 8000)
  - Frontend: npm run dev (port 5173)
  - Mobile: npm start (Expo Go)
  - Database: PostgreSQL (port 5432)
  - Cache: Redis (port 6379)
```

### Staging Environment

```
Cloud (AWS/GCP):
  - Backend: Django on Kubernetes
  - Frontend: Static files on CDN
  - Mobile: TestFlight (iOS) / Firebase (Android)
  - Database: Managed PostgreSQL
  - Cache: Managed Redis
```

### Production Environment

```
Cloud (AWS/GCP):
  - Backend: Django on Kubernetes (auto-scaling)
  - Frontend: Static files on CDN (Cloudflare)
  - Mobile: App Store (iOS) / Play Store (Android)
  - Database: Managed PostgreSQL (automated backups)
  - Cache: Managed Redis (high availability)
  - Monitoring: Datadog / New Relic
```

---

## 🔑 Key Configuration Files

### Backend Configuration

**File: `backend/africul_backend/settings/base.py`**
```python
# Database config
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('POSTGRES_DB', default='africul'),
        'USER': env('POSTGRES_USER', default='africul'),
        'PASSWORD': env('POSTGRES_PASSWORD', default='africul'),
        'HOST': env('POSTGRES_HOST', default='localhost'),
        'PORT': env.int('POSTGRES_PORT', default=5432),
    }
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=14),
    'ROTATE_REFRESH_TOKENS': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': env('SECRET_KEY'),
}

# Installed apps
INSTALLED_APPS = [
    'rest_framework',
    'channels',
    'apps.accounts',
    'apps.identity',
    'apps.profiles',
    'apps.content',
    'apps.feed',
    'apps.vault',
    'apps.notifications',
    'apps.media',
]
```

### Frontend Configuration

**File: `frontend/vite.config.ts`**
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

### Mobile Configuration

**File: `mobile/.env`**
```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 📊 Data Flow Examples

### Example 1: Creating a Post (Creator)

```
MOBILE APP
  ↓
  User fills form: title, description, content_type
  ↓
  POST /api/v1/content/posts/
  {
    "title": "My first post",
    "description": "Check this out!",
    "content_type": "text",
    "house": "west_africa"
  }
  ↓
BACKEND
  ↓
  content.views.CreatePostView.post()
  ├─ Check auth (user is logged in) ✓
  ├─ Validate input (title not empty, etc.) ✓
  ├─ Call content.services.create_post()
  │  ├─ Create Post model in DB
  │  ├─ Set status = "draft"
  │  └─ Return post instance
  ├─ Serialize to JSON
  └─ Return { id, title, ... }
  ↓
MOBILE APP
  ↓
  Display: "Post created!"
  Navigate back to feed
  ↓
  POST /api/v1/content/posts/{id}/publish/
  ↓
BACKEND
  ↓
  Update post.status = "published"
  Emit event: post_published
  Trigger task: notify_followers
  ↓
NOTIFICATION SYSTEM
  ↓
  Celery task sends notifications to followers
  Updates feed_item table
  WebSocket broadcasts to live connections
  ↓
OTHER USERS
  ↓
  See new post in their feed
  Get push notification
```

### Example 2: Real-time Notifications (WebSocket)

```
USER 1 (Creator)
  ↓
  Posts new content
  POST /api/v1/content/posts/
  ↓
BACKEND
  ├─ Create post in DB
  ├─ Emit: content_created event
  └─ Notify followers via:
     ├─ Celery task (send email)
     ├─ Notifications table (in-app notification)
     └─ WebSocket connection
  ↓
USER 2 (Follower, Connected via WebSocket)
  ↓
  WebSocket receives: { type: "content_created", ... }
  ↓
  Client-side handler processes notification
  Updates state
  Re-renders feed
  ↓
  USER 2 SEES NEW POST IN FEED IMMEDIATELY
  (no need to refresh!)
```

---

## 🧪 Testing Strategy

### Backend Tests
```
backend/tests/
├── accounts/
│   └── test_register.py      # Test registration flow
├── feed/
│   └── test_feed_list.py     # Test feed endpoint
└── content/
    └── test_create_post.py   # Test post creation
```

### Frontend Tests
```
frontend/src/features/feed/
├── FeedPage.test.tsx         # Component rendering
└── feedService.test.ts       # API calls
```

### Mobile Tests
```
mobile/src/features/feed/
├── FeedScreen.test.tsx       # Component rendering
└── feedService.test.ts       # API calls
```

---

## 🎯 Development Workflow

### Day in the Life of a Feature

**1. Planning**
- "We need a 'Save Post' feature"
- Decide: backend saves to vault / frontend UI / mobile UI / notifications

**2. Backend Development**
```bash
cd backend
# Create model: Vault model with user + post
# Create views: POST /api/v1/vault/save/, DELETE /api/v1/vault/{id}/
# Add tests
python manage.py test apps.vault
```

**3. Frontend Development**
```bash
cd frontend
npm run dev
# Create saveBut button component
# Call POST /api/v1/vault/save/
# Show success message
# Test in browser
```

**4. Mobile Development**
```bash
cd mobile
npm start
# Create save button in post card
# Call POST /api/v1/vault/save/
# Test on device/emulator
```

**5. Deploy**
```bash
# All tested locally
git push
GitHub Actions:
  ├─ Backend tests pass ✓
  ├─ Frontend tests pass ✓
  ├─ Mobile tests pass ✓
  └─ Deploy to staging
```

---

## 🚨 Common Issues & Debug

### Issue: Mobile can't connect to backend

**Problem:** `fetch("http://localhost:8000/...") fails`

**Solution:**
- On physical phone: use your computer's IP, not `localhost`
  ```typescript
  // Instead of:
  const API_URL = "http://localhost:8000/api/v1"
  
  // Use:
  const API_URL = "http://192.168.1.100:8000/api/v1"  // Your PC's IP
  ```

- Or easier: use Expo Tunnel
  ```bash
  npm start -- --tunnel
  # Works from anywhere without IP configuration
  ```

### Issue: 401 Unauthorized errors

**Problem:** Backend returns 401

**Causes:**
1. No token in header
2. Token expired
3. Token is invalid

**Debug:**
```typescript
// Log the token
console.log("Token:", useAuthStore.getState().accessToken);

// Verify token format in request
headers: { Authorization: `Bearer ${token}` }
//                        ^^^^^^^ Must have "Bearer "
```

### Issue: CORS errors (Web only)

**Problem:** `Access to XMLHttpRequest ... blocked by CORS`

**Solution:** Backend needs to allow frontend domain
```python
# backend/settings/local.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Web frontend dev server
    "http://localhost:3000",  # If you also have Node server
]
```

---

## ✅ Checklist for New Feature

- [ ] Backend endpoint created and tested
- [ ] Frontend page/component created and tested
- [ ] Mobile screen created and tested
- [ ] API types match between all three
- [ ] Error handling on all platforms
- [ ] Loading states on all platforms
- [ ] Authentication/authorization working
- [ ] Database migrations created (if needed)
- [ ] Deployed to staging first
- [ ] QA tested on all platforms
- [ ] Deployed to production

---

**Now you understand the complete AFRICUL architecture. Every request flows: Mobile/Web → Backend API → Database. All three use TypeScript for type safety and consistency.**

**Next: Start implementing features following this pattern!**

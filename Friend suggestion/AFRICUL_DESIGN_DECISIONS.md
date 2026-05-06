# AFRICUL Design Decisions - Why We Built It This Way

This guide explains **WHY** AFRICUL chose certain technologies and patterns. Understanding this will help you modify the setup for your own project (LR-Ride).

---

## 🤔 The Big Questions

### 1. Why Expo Instead of React Native CLI?

**Expo Advantages:**
- ✅ **No native code needed** - Everything is JavaScript/TypeScript
- ✅ **EAS builds** - Cloud building (no local Android/Xcode setup)
- ✅ **Instant hot reload** - Changes appear instantly
- ✅ **OTA updates** - Push updates to users without app store
- ✅ **Managed services** - Expo handles iOS/Android complexity

**React Native CLI Advantages:**
- ✅ Access to any native module
- ✅ Full control of native code
- ❌ More complex setup (Android Studio, Xcode required)
- ❌ Slower builds
- ❌ Hair-pulling debugging

**AFRICUL's Choice: Expo**
- Why: 80%+ of AFRICUL's features don't need native code
- Can add native modules later with `expo prebuild` if needed
- For a startup: ship fast > full control

---

### 2. Why Expo Router Instead of React Navigation?

**Expo Router (chosen):**
```typescript
// File-based routing - files = routes
app/
  feed.tsx          → /feed
  profile.tsx       → /profile
  (tabs)/           → Tab group (doesn't affect URL)
    _layout.tsx
```

**React Navigation (alternative):**
```typescript
// Config-based routing - declare routes in code
<NavigationContainer>
  <Stack.Navigator>
    <Stack.Screen name="feed" component={FeedScreen} />
    <Stack.Screen name="profile" component={ProfileScreen} />
  </Stack.Navigator>
</NavigationContainer>
```

**AFRICUL's Choice: Expo Router**
- Why: File-based is like Next.js - easier to scale
- Automatic deep linking support
- Better TypeScript support
- Cleaner folder organization as app grows
- One screen = one file (clear ownership)

---

### 3. Why Zustand Instead of Redux?

**Redux:**
```typescript
// Lots of boilerplate
const initialState = { user: null };
const reducer = (state = initialState, action) => {
  switch(action.type) {
    case "SET_USER": return { ...state, user: action.payload };
    default: return state;
  }
};
const store = createStore(reducer);
```

**Zustand (chosen):**
```typescript
// Minimal boilerplate
const store = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

**AFRICUL's Choice: Zustand**
- Why: Less code, same capability
- Better performance (fine-grained updates)
- Easier to learn for new developers
- Perfect for this app's needs
- If app explodes in complexity: can migrate to Viem later

---

### 4. Why Fetch API Instead of Axios for Mobile?

**Fetch (chosen):**
```typescript
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

**Axios:**
```typescript
const response = await axios.post(url, data);
```

**AFRICUL's Choice: Fetch**
- Why: Already in React Native (no extra library)
- Smaller bundle size (important for mobile)
- Good enough for current needs
- If need interceptors/middleware: can wrap with utility functions
- Web frontend uses Axios (different needs: bigger bundle OK, need interceptors for auth)

---

### 5. Why TypeScript Strict Mode?

**Strict Mode (chosen):**
```typescript
{
  "compilerOptions": {
    "strict": true  // ← Catches bugs at compile time
  }
}
```

**Non-Strict:**
```typescript
{
  "compilerOptions": {
    "strict": false  // ← Bugs slip through
  }
}
```

**AFRICUL's Choice: Strict**
- Why: Catch bugs before they reach users
- Enterprise standard
- Self-documenting code (types are documentation)
- More refactoring confidence
- Learning curve worth it

---

### 6. Why `.env` with `EXPO_PUBLIC_` Prefix?

**Why the special prefix?**

Expo has security concerns:
- Mobile apps are reverse-engineered easily (APK is public)
- Private keys would be exposed
- Needs explicit opt-in for client-side values

**Example:**
```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1  ✅ Visible in client
SECRET_API_KEY=abc123                              ❌ NOT visible in client (correct)
VITE_API_URL=...                                   ❌ This is for Vite, not Expo
```

**AFRICUL's Choice: EXPO_PUBLIC_**
- Why: Forces you to think about security
- API URL is intentionally public (clients need it)
- API keys would stay on backend only

---

### 7. Why Feature-Owned Code?

**Shared Component Anti-Pattern:**
```
components/
  shared/
    FeedCard.tsx       ← Used by feed, vault, profiles
    PostButton.tsx     ← Used by content, feed
```

**Problems:**
- One feature's change breaks others
- Hard to delete features
- Component doesn't know its owner

**Feature-Owned Pattern (chosen):**
```
features/
  feed/
    components/
      FeedCard.tsx     ← Only feed cares about this
  vault/
    components/
      VaultCard.tsx    ← Different from FeedCard, ok!
```

**AFRICUL's Choice: Feature Ownership**
- Why: Features can evolve independently
- Clear deletion path (delete entire feature folder)
- No surprise breaking changes
- Each team owns their feature
- Shared primitives only in `components/ui/` (Button, Card, etc.)

---

### 8. Why Services + Selectors Pattern?

**With Backend Service Layer:**
```typescript
// mobile/src/features/feed/feedService.ts
export async function fetchFeed(): Promise<FeedPost[]> {
  return apiGet<FeedPost[]>("/feed/");
}

// Component
const posts = await fetchFeed();
```

**Without (Direct API Calls):**
```typescript
const posts = await apiGet("/feed/");
```

**AFRICUL's Choice: Services**
- Why: Type safety
- Reusable across components
- Easy to mock for testing
- Logic separated from UI
- If API endpoint changes: update one file, not ten

---

## 📱 Mobile-Specific Decisions

### Why Not Use React Query?

**React Query (Alternative):**
```typescript
const { data: posts, isLoading, error } = useQuery({
  queryKey: ["feed"],
  queryFn: fetchFeed,
});
```

**Plain Zustand + useEffect (Chosen):**
```typescript
const [posts, setPosts] = useState([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetchFeed().then(setPosts).finally(() => setLoading(false));
}, []);
```

**Why Chosen (for MVP):**
- Simpler to understand (less learning curve)
- Fewer dependencies (important for app size)
- Good enough for initial features
- If app needs: caching, pagination, background sync → React Query later
- Web version can use React Query (different needs)

---

### Why StyleSheet.create()?

**React Native StyleSheet (Chosen):**
```typescript
const styles = StyleSheet.create({
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
  },
});
```

**Inline Styles (Alternative):**
```typescript
<TouchableOpacity style={{ backgroundColor: "#007AFF", paddingHorizontal: 16 }}>
```

**Why Chosen:**
- Performance optimization (compiled once)
- Validation (catches invalid styles)
- Tool support (autocomplete)
- Organization (styles at bottom of file)
- Re-usable styles within component

---

### Why Expo Router Over Tab Navigator?

**For Simple Tabs (Expo Router Version):**
```typescript
// app/(tabs)/_layout.tsx
<Tabs>
  <Tabs.Screen name="feed" />
  <Tabs.Screen name="profile" />
</Tabs>
```

**Old React Navigation Style:**
```typescript
<Tab.Navigator>
  <Tab.Screen name="feed" />
  <Tab.Screen name="profile" />
</Tab.Navigator>
```

**AFRICUL's Choice: Expo Router**
- Why: Single routing system (not separate for tabs)
- File structure = visual hierarchy
- Deep links automatic
- Less context switching

---

## 🌐 Frontend (Vite + React) Decisions

### Why Vite Instead of Create React App?

**Vite (Chosen):**
```bash
npm create vite@latest my-app -- --template react
npm run dev  # Instant hot module reload
```

**Create React App (Earlier Alternative):**
```bash
npx create-react-app my-app
npm start  # Slower rebuild
```

**AFRICUL's Choice: Vite**
- Why: **10x faster development** (hot reload)
- Smaller default config to understand
- Industry standard for 2024+
- CRA is basically dead (no major updates)

---

### Why axios + TanStack Query on Web?

**Mobile:** Fetch + Zustand
**Web:** Axios + TanStack Query

**Why Different?**
- Web has larger bundle size budget
- Web needs caching, pagination, background sync
- React Query is standard tool for server state
- Axios has better interceptor system for auth

**Example Web Service:**
```typescript
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/platform/api/client";

export function useFeed() {
  return useQuery({
    queryKey: ["feed"],
    queryFn: () => apiClient.get("/feed/").then(res => res.data),
  });
}
```

**AFRICUL's Choice: Different per platform**
- Why: Each platform has different constraints
- Mobile: Bundle size matters
- Web: Caching/pagination matters more

---

## 🔐 Backend (Django) Decisions

### Why Django?

**Django (Chosen):**
- ✅ Batteries included (auth, ORM, admin panel)
- ✅ Modular structure for domain modules
- ✅ Large ecosystem (packages for everything)
- ✅ Great for 2-person team (built-in safety)
- ❌ Not the fastest
- ❌ Python (slower than Node/Go)

**Node.js/Express (Alternative):**
- ✅ Faster execution
- ✅ JavaScript everywhere
- ❌ No built-in ORM
- ❌ More package management needed
- ❌ Less structure

**FastAPI/Python (Alternative):**
- ✅ Fast
- ✅ Modern async
- ❌ Smaller ecosystem
- ❌ Immature ORM options

**AFRICUL's Choice: Django**
- Why: Team knew Django
- Built-in permission system (critical for content moderation)
- Django ORM is excellent
- Admin panel saves development time
- Can handle Africa-scale growth

---

### Why Modular Monolith Instead of Microservices?

**Modular Monolith (Chosen):**
```
backend/
  apps/
    accounts/      ← Domain module
    content/       ← Domain module
    feed/          ← Domain module
  (Single app, multiple domains)
```

**Microservices (Alternative):**
```
accounts-service/
content-service/
feed-service/
(Separate deployments/databases)
```

**AFRICUL's Choice: Modular Monolith**
- Why: Startup stage needs speed
- Easier debugging
- Shared database (simpler)
- Deploy once (not multiple)
- Can split later if needed

---

### Why JWT Auth?

**JWT (Chosen):**
```typescript
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Session Cookies (Alternative):**
```
Set-Cookie: sessionId=abc123
```

**AFRICUL's Choice: JWT**
- Why: Stateless (no session storage needed)
- Works with mobile
- CORS-friendly
- Standard for modern apps

---

## 📊 Architecture Decision Summary

| Decision | Choice | Why |
|----------|--------|-----|
| Mobile Framework | Expo | No native code, ship fast, OTA updates |
| Mobile Routing | Expo Router | File-based, deep linking, like Next.js |
| Mobile State | Zustand | Minimal boilerplate, performant enough |
| Mobile HTTP | Fetch | Native API, small bundle, good enough |
| Mobile Styles | StyleSheet | Performance, validation, organization |
| Web Framework | Vite + React | 10x faster dev, modern standard |
| Web HTTP | Axios | Interceptors, better DX |
| Web Server State | TanStack Query | Caching, pagination, background sync |
| Backend | Django | Modular structure, built-in safety, ORM |
| Backend Architecture | Modular Monolith | Speed now, scaleability later |
| Auth | JWT | Stateless, mobile-friendly, standard |
| Database | PostgreSQL | Production-grade, PostGIS for location |
| Caching | Redis | Fast session/cache, pub/sub |
| Task Queue | Celery | Async jobs, email, media processing |

---

## 🎯 Guiding Principles

### 1. **Content-First**
Example: Mobile UI is optimized for browsing (vertical scroll feed), not shopping (transactions).

### 2. **Africa-Specific Performance**
- No heavy JavaScript (3G networks)
- Offline-capable screens
- Low data usage
- Works on Android 6+ (old devices)

### 3. **Feature Ownership**
Each feature (feed, profiles, vault) is self-contained.
No shared business components unless explicitly approved.

### 4. **Type Safety**
Strict TypeScript everywhere.
No `any` type.
Types are documentation.

### 5. **Security by Default**
Object-level authorization (not just endpoint-level).
No secrets in client code.
Audit logs for sensitive operations.

### 6. **Scale for Africa**
Assume: weak networks, old devices, high user growth.
Optimize for: offline-first, pagination, efficient APIs.

---

## ⚠️ What We Intentionally Avoided (And Why)

### ❌ Don't Use These

**Relay.js**
- Why not: Too complex for current needs
- If: GraphQL API at scale

**MobX**
- Why not: Zustand is simpler
- If: Complex nested state management

**Redux**
- Why not: Zustand has same power, less code
- If: Multiple teams, strict state auditing needed

**Angular**
- Why not: React/Vue ecosystem is larger
- If: Enterprise enterprise company

**Passport.js (for auth)**
- Why not: JWT is simpler authorization
- If: Session-based legacy system

**NestJS (for Node backend)**
- Why not: Overkill for startup
- If: Node-based backend with microservices

**Storybook**
- Why not: Not needed for MVP
- If: Large design system team

**Cypress (for e2e testing)**
- Why not: Manual testing faster at startup
- If: 100+ user-facing features

---

## 🔮 Future Decisions

### When to Migrate?

**From Zustand → Redux / Jotai:**
- When: 5+ inter-dependent global states
- Signal: State updates become complex

**From Fetch → React Query:**
- When: Need pagination, background sync, caching
- Signal: Manual loading state management becomes tedious

**From Monolith → Microservices:**
- When: 50+ backend engineers
- Signal: Deployment conflicts between teams

**From PostgreSQL → Sharding:**
- When: Table >1 billion rows
- Signal: Query performance degrades

**From Expo → Bare React Native:**
- When: Pure native features needed
- Signal: Expo doesn't support required capability

---

## 🎓 Learning Path

If you're learning AFRICUL's architecture:

1. **Week 1: Mobile (Expo Router + Zustand)**
   - Understand file-based routing
   - Learn Zustand for state
   - Build simple screens

2. **Week 2: Frontend (Vite + React Router)**
   - Learn React Router (similar to Expo Router)
   - Add React Query later
   - Understand feature isolation

3. **Week 3: Backend (Django + DRF)**
   - Understand Django ORM
   - Learn DRF serializers
   - Understand modular structure

4. **Week 4: Integration**
   - Connect all three
   - Understand API contracts
   - Test end-to-end

---

## 🚀 Customizing for LR-Ride

**AFRICUL is:**
- Content platform (feed-first)
- Vertical: African culture
- Features: Feed, Profiles, Vault, Runway, Creator Dashboard

**LR-Ride is:**
- Ride-sharing/logistics platform
- Vertical: Transportation
- Features: Booking, Maps, Driver Management, Payments

**What to Keep from AFRICUL:**
```typescript
// Same architecture
app/
src/platform/api/client.ts
src/platform/state/(userStore, rideStore)
src/features/public/
src/features/admin/
components/ui/
```

**What to Change:**
```typescript
// Different features
features/public/
  ├── booking/         ← New
  ├── active-ride/     ← New
  ├── map/             ← New (location-specific)
  ├── ratings/         ← Different from content
  └── payment/         ← New (commerce)

// Different backend processes
POST /api/v1/booking/                   ← New
GET /api/v1/active-rides/               ← New
POST /api/v1/rides/{id}/rate/           ← Similar to content/posts
POST /api/v1/payment/                   ← New (commerce)
```

---

## 📖 Final Thought

> "All architecture is a series of tradeoffs. AFRICUL chose simplicity now (Expo + Zustand + Django monolith) over scale later (Bare React Native + Redux + Microservices). This is right for a startup. When constraints change, architecture evolves."

**Your job:** Understand WHY each choice was made. Then adapt for YOUR needs.

---

**Questions?**
- **How?** → See [AFRICUL_MOBILE_SETUP_GUIDE.md](./AFRICUL_MOBILE_SETUP_GUIDE.md)
- **What?** → See [AFRICUL_COMPLETE_ARCHITECTURE.md](./AFRICUL_COMPLETE_ARCHITECTURE.md)  
- **Why?** → See this file (you are here)

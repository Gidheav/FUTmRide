# AFRICUL Mobile Expo Setup - Complete Technical Guide

This guide explains **exactly how AFRICUL's mobile app works** using Expo and React Native. Use this to replicate the setup in your own project (LR-Ride).

---

## 📱 Quick Overview

**AFRICUL Mobile** is a **React Native + Expo + TypeScript** app that runs on iOS and Android. Mobile is the PRIMARY platform because 80%+ of African users access via mobile devices.

**Key Facts:**
- Built with **Expo SDK 52** (the easiest way to build React Native apps)
- Uses **Expo Router** for file-based navigation (similar to Next.js)
- **TypeScript** for strict type safety
- **Zustand** for simple state management
- **Minimal dependencies** at launch (intentional - only essentials)
- Runs on **Node 18+** with **npm 9+**

---

## 🏗️ Project Structure

```
mobile/
├── app/                          # Expo Router navigation (file-based routing)
│   ├── (tabs)/                   # Grouped routes (tabs layout)
│   └── _layout.tsx               # Root layout/navigation setup
│
├── src/                          # Application code
│   ├── components/
│   │   └── ui/                   # Shared UI primitives (AppButton, etc.)
│   ├── features/                 # Feature-owned screens and logic
│   │   ├── public/               # Public/user features
│   │   └── admin/                # Admin-only features
│   └── platform/                 # Infrastructure & cross-cutting concerns
│       ├── api/                  # API client & HTTP requests
│       └── state/                # Global state (Zustand stores)
│
├── .env                          # Environment variables (API URL)
├── .env.example                  # Example env file
├── app.json                      # ⚠️ REMOVED - not in current setup
├── package.json                  # Dependencies and npm scripts
├── tsconfig.json                 # TypeScript configuration
└── node_modules/                 # Installed dependencies
```

---

## 🚀 Setup Steps

### Step 1: Prerequisites

**Install Node.js and npm:**
```powershell
# Windows PowerShell or Command Prompt
node --version          # Must be 18.0.0 or higher
npm --version           # Must be 9.0.0 or higher
```

**If you don't have Node installed:**
1. Download from https://nodejs.org/
2. Install LTS version (v20+ recommended)
3. Verify: `node --version` and `npm --version`

### Step 2: Create Mobile Project

```powershell
# Navigate to your project root
cd c:\Users\YourName\Desktop\LR-Ride

# Create mobile app folder
mkdir mobile
cd mobile

# Initialize npm project
npm init -y

# Install Expo and React Native
npm install expo@^52.0.0 expo-router@^4.0.0 react@^18.3.1 react-native@^0.76.0 zustand@^4.5.5

# Install TypeScript and types
npm install --save-dev typescript@^5.6.3 @types/react@^18.3.12
```

### Step 3: Create Project Structure

**Root `package.json` (what AFRICUL uses):**
```json
{
  "name": "africul-mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "^52.0.0",
    "expo-router": "^4.0.0",
    "react": "^18.3.1",
    "react-native": "^0.76.0",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/react": "^18.3.12"
  }
}
```

**Create `tsconfig.json`:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["app", "src"]
}
```

**Create `.env.example`:**
```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**Create `.env`:**
```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Step 4: Create Directory Structure

```powershell
# Create all necessary folders
mkdir -p app\(tabs)
mkdir -p src\components\ui
mkdir -p src\features\public
mkdir -p src\features\admin
mkdir -p src\platform\api
mkdir -p src\platform\state
```

### Step 5: Root Navigation (`app/_layout.tsx`)

**File: `mobile/app/_layout.tsx`**
```typescript
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Explanation:**
- `Stack` = navigation container that displays screens in a stack (iOS style)
- `headerShown: false` = hide the default header (we'll make custom headers)
- This is the ROOT layout that wraps your entire app

---

## 🔌 API Client Setup

AFRICUL's mobile app talks to the backend API using simple fetch-based HTTP requests.

**File: `mobile/src/platform/api/client.ts`**
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}
```

**Key Points:**
1. **`EXPO_PUBLIC_API_URL`** = special Expo variable loaded from `.env`
2. **Must start with `EXPO_PUBLIC_`** to be accessible in the client
3. **`apiGet<T>()`** = generic function - `<T>` lets you specify the response type
4. **Error handling** = if API returns error status, throw an Error

**Usage in a feature:**
```typescript
// mobile/src/features/public/feed/feedService.ts
import { apiGet } from "@/platform/api/client";

export interface FeedPost {
  id: string;
  title: string;
  content: string;
  creator: string;
  created_at: string;
}

export async function fetchFeed(): Promise<FeedPost[]> {
  return apiGet<FeedPost[]>("/feed/");
}
```

---

## 🧠 State Management (Zustand)

AFRICUL uses **Zustand** for simple, lightweight global state. No Redux complexity.

**Example: Auth Store**

**File: `mobile/src/platform/state/authStore.ts`**
```typescript
import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  user: { id: string; username: string } | null;
  setAuth: (token: string, user: { id: string; username: string }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  
  setAuth: (token, user) => set({ accessToken: token, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));
```

**Usage in a component:**
```typescript
import { useAuthStore } from "@/platform/state/authStore";

export function FeedScreen() {
  const { user, accessToken } = useAuthStore();
  
  if (!accessToken) {
    return <LoginScreen />;
  }
  
  return <FeedList user={user} />;
}
```

**Why Zustand?**
- **Simple**: No boilerplate like Redux
- **Fast**: Tiny library, minimal overhead
- **Type-safe**: Full TypeScript support
- **Selective updates**: Components only re-render if their data changes

---

## 📄 Component Structure

### Shared UI Primitives

Keep truly reusable components in `src/components/ui/`. These are design-system building blocks only.

**File: `mobile/src/components/ui/AppButton.tsx`**
```typescript
import { TouchableOpacity, Text, StyleSheet } from "react-native";

interface AppButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export function AppButton({ title, onPress, disabled }: AppButtonProps) {
  return (
    <TouchableOpacity 
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
  },
});
```

### Feature-Owned Components

**Each feature owns its own screens, logic, and business components.**

**File: `mobile/src/features/public/feed/FeedScreen.tsx`**
```typescript
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { FeedPost, fetchFeed } from "./feedService";
import { AppButton } from "@/components/ui/AppButton";

export function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeed()
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Error: {error}</Text>
        <AppButton title="Retry" onPress={() => window.location.reload()} />
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => <FeedPostCard post={item} />}
    />
  );
}

function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#EEE" }}>
      <Text style={{ fontSize: 16, fontWeight: "bold" }}>{post.title}</Text>
      <Text style={{ color: "#666", marginTop: 4 }}>{post.content}</Text>
      <Text style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
        By {post.creator} • {new Date(post.created_at).toLocaleDateString()}
      </Text>
    </View>
  );
}
```

---

## 🔄 How Routing Works (Expo Router)

Expo Router uses **file-based routing** (like Next.js). The file structure = the URL structure.

### Basic Structure

```
app/
├── _layout.tsx           → Root layout (/ + entire app)
├── (tabs)/
│   ├── _layout.tsx       → (tabs) group layout
│   ├── feed.tsx          → /feed tab
│   ├── profile.tsx       → /profile tab
│   └── settings.tsx      → /settings tab
└── auth/
    ├── _layout.tsx       → auth group layout
    ├── login.tsx         → /auth/login
    └── register.tsx      → /auth/register
```

### Root Layout (`app/_layout.tsx`)

```typescript
import { Stack } from "expo-router";
import { useAuthStore } from "@/platform/state/authStore";

export default function RootLayout() {
  const { accessToken } = useAuthStore();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {accessToken ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="auth" />
      )}
    </Stack>
  );
}
```

### Tabs Layout (`app/(tabs)/_layout.tsx`)

```typescript
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### Screen Implementation (`app/(tabs)/feed.tsx`)

```typescript
import { FeedScreen } from "@/features/public/feed/FeedScreen";

export default function FeedTab() {
  return <FeedScreen />;
}
```

**Key Concepts:**
- `(tabs)` = **route group** - groups screens together without affecting URLs
- `_layout.tsx` = special file that defines layout for that directory
- `export default function` = the screen component that renders

---

## 🔐 Authentication Flow

AFRICUL mobile uses JWT tokens. Here's the complete flow:

### 1. Login Service

**File: `mobile/src/features/public/auth/authService.ts`**
```typescript
import { apiGet } from "@/platform/api/client";

interface LoginResponse {
  access_token: string;
  user: { id: string; username: string; email: string };
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/identity/login/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!response.ok) {
    throw new Error("Login failed");
  }

  return response.json();
}
```

### 2. Login Screen

```typescript
import { View, TextInput, StyleSheet } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { login } from "./authService";
import { useAuthStore } from "@/platform/state/authStore";
import { AppButton } from "@/components/ui/AppButton";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const { setAuth } = useAuthStore();

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      const data = await login(email, password);
      setAuth(data.access_token, data.user);
      router.replace("/(tabs)/feed"); // Navigate to main feed
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      <AppButton
        title={loading ? "Logging in..." : "Login"}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
  },
});
```

### 3. Authentication in Root Layout

```typescript
// app/_layout.tsx
import { useAuthStore } from "@/platform/state/authStore";
import { useEffect } from "react";

export default function RootLayout() {
  const { accessToken } = useAuthStore();

  useEffect(() => {
    // Restore token from device storage if needed
    // (implement AsyncStorage or MMKV for persistence)
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {accessToken ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="auth" />
      )}
    </Stack>
  );
}
```

---

## 🏃 Running the App

### Start Development Server

```powershell
cd mobile
npm start
```

**Output:**
```
> expo start  
Starting Metro bundler
Waiting for Metro bundler to be ready...
[... logs ...]
✓ Metro bundler started

You can open the app your phone by scanning this QR code.

┌────────────────────────────────────────────┐
│                                            │
│  expo.dev/[random-id]                      │
│                                            │
└────────────────────────────────────────────┘
```

### Option 1: Run on Android Emulator

```powershell
npm run android
```

Requirements:
- Android Studio installed with emulator configured
- 2-5 minutes first time (Gradle build)

### Option 2: Run on iOS Simulator (Mac only)

```powershell
npm run ios
```

### Option 3: Run on Your Phone

1. **Install Expo Go App**
   - iOS: App Store search "Expo Go"
   - Android: Google Play Store search "Expo Go"

2. **Scan QR code** from `npm start` output

3. **App loads** in 10-30 seconds

**Note:** Expo Go is for development. For production, you'll build standalone apps with `eas build`.

---

## ⚙️ Environment Variables

### How It Works

Expo exposes environment variables prefixed with `EXPO_PUBLIC_` to the client.

**In `.env`:**
```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
EXPO_PUBLIC_APP_NAME=AFRICUL
EXPO_PUBLIC_VERSION=0.1.0
SECRET_KEY=DO_NOT_EXPOSE_THIS  # ❌ This will NOT be available in app
```

**In your code:**
```typescript
const apiUrl = process.env.EXPO_PUBLIC_API_URL; // ✅ Works
const secret = process.env.SECRET_KEY; // ❌ undefined - not exposed
```

### Multiple Environments

Create different env files:

```powershell
.env                    # Used by 'npm start'
.env.production         # Used in production builds
.env.staging           # For staging/testing
```

---

## 📦 Common Utilities

### API Request with Authentication

```typescript
// mobile/src/platform/api/client.ts
import { useAuthStore } from "@/platform/state/authStore";

export async function apiPost<T>(
  path: string, 
  data?: any
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: data ? JSON.stringify(data) : undefined,
    }
  );

  if (response.status === 401) {
    // Token expired, clear auth
    useAuthStore.getState().clearAuth();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}
```

### Error Handling Wrapper

```typescript
// mobile/src/platform/api/errors.ts
export class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any
  ) {
    super(message);
  }
}

export async function handleAPIError(error: unknown): Promise<APIError> {
  if (error instanceof APIError) return error;
  if (error instanceof Error) {
    return new APIError(500, error.message);
  }
  return new APIError(500, "Unknown error");
}
```

---

## 🎨 TypeScript Best Practices (AFRICUL Standard)

### 1. **Strict Mode** (always enabled)

```typescript
// tsconfig
{
  "compilerOptions": {
    "strict": true  // ← Catches bugs
  }
}
```

### 2. **Export Interfaces from Services**

```typescript
// ✅ GOOD: Defined with the API
export interface User {
  id: string;
  username: string;
  email: string;
}

export async function getUser(id: string): Promise<User> {
  // ...
}

// ❌ BAD: Type not exported
async function getUser(id: string) {
  return fetch(...);
}
```

### 3. **Use `unknown` Instead of `any`**

```typescript
// ✅ GOOD: Safe
function handleError(error: unknown) {
  if (error instanceof Error) {
    console.log(error.message);
  }
}

// ❌ BAD: Loses type safety
function handleError(error: any) {
  console.log(error.message); // might crash
}
```

### 4. **Avoid Optional Fields in Type Unions**

```typescript
// ✅ GOOD: Union type - clear states
type LoginState = 
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; user: User }
  | { status: "error"; message: string };

// ❌ BAD: Too many optionals - confusing
interface LoginState {
  status?: "idle" | "loading" | "success" | "error";
  user?: User;
  message?: string;
}
```

---

## 🐛 Debugging

### React Native Debugger

1. Install: https://github.com/jhen0409/react-native-debugger
2. Run app: `npm start`
3. Press `d` in terminal (Android) or `i` (iOS)
4. Opens debugger in React Native Debugger

### Console Logs

```typescript
// Still works in React Native
console.log("Debug message");
console.error("Error message");
console.warn("Warning message");
```

### Common Issues

**App won't start:**
```powershell
# Clear cache and rebuild
npm start -- --clear
```

**Module not found:**
```powershell
# Reinstall dependencies
rm -r node_modules package-lock.json
npm install
```

**Expo Go app won't connect:**
- Make sure your phone is on **same WiFi** as dev machine
- Or use Tunnel mode: `expo start --tunnel`

---

## 📚 Backend API Endpoints (from AFRICUL)

The mobile app calls these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/identity/login/` | User login (returns JWT token) |
| POST | `/accounts/register/` | User registration |
| GET | `/accounts/me/` | Current user profile |
| GET | `/feed/?limit=20` | Get paginated feed |
| GET | `/content/posts/` | List content posts |

**Full API documentation**: Run backend at `http://localhost:8000/api/docs/`

---

## 🚨 Key Gotchas to Avoid

### 1. **Environment Variables Must Start with `EXPO_PUBLIC_`**

```typescript
// ✅ WORKS
process.env.EXPO_PUBLIC_API_URL

// ❌ DOESN'T WORK - will be undefined
process.env.VITE_API_URL  // (that's for web/Vite)
process.env.SECRET_API_KEY  // (no EXPO_PUBLIC_ prefix)
```

### 2. **Module Paths in TypeScript**

```typescript
// ✅ CORRECT
import { AppButton } from "@/components/ui/AppButton";

// ❌ WRONG (relative paths can break)
import { AppButton } from "../../../components/ui/AppButton";
```

This is why `tsconfig.json` has path aliases:
```json
"paths": {
  "@/*": ["src/*"]
}
```

### 3. **Never Import from Node.js Modules**

```typescript
// ❌ DON'T DO THIS
import fs from "fs";  // Node.js only - won't work in mobile

// ✅ DO THIS
import { AsyncStorage } from "@react-native-community/async-storage";
```

### 4. **useEffect Should Have Dependency Array**

```typescript
// ❌ WRONG - runs after every render
useEffect(() => {
  fetchData();
});

// ✅ CORRECT - runs once on mount
useEffect(() => {
  fetchData();
}, []);

// ✅ CORRECT - runs when userId changes
useEffect(() => {
  fetchUserData(userId);
}, [userId]);
```

### 5. **Zustand: Pull State Inside Component**

```typescript
// ✅ GOOD
function MyComponent() {
  const user = useAuthStore((state) => state.user);
  return <Text>{user?.username}</Text>;
}

// Also OK
function MyComponent() {
  const { user } = useAuthStore();
  return <Text>{user?.username}</Text>;
}
```

---

## 📋 Project Checklist

When setting up your mobile project, ensure:

- [ ] Node v18+ and npm v9+ installed
- [ ] `package.json` has all dependencies from AFRICUL example
- [ ] `tsconfig.json` configured with path aliases (`@/*`)
- [ ] `.env` file with `EXPO_PUBLIC_API_URL`
- [ ] Directory structure created: `app/`, `src/components/ui/`, `src/platform/api/`, etc.
- [ ] Root `app/_layout.tsx` with Stack navigation
- [ ] API client in `src/platform/api/client.ts`
- [ ] Auth store in `src/platform/state/authStore.ts`
- [ ] `npm start` runs without errors
- [ ] Can open app in Expo Go or emulator

---

## 🎓 Learning Resources

1. **Expo Official Docs**: https://docs.expo.dev/
2. **Expo Router Docs**: https://docs.expo.dev/routing/introduction/
3. **React Native Docs**: https://reactnative.dev/
4. **Zustand Docs**: https://github.com/pmndrs/zustand
5. **TypeScript for React**: https://www.typescriptlang.org/docs/handbook/react.html

---

## 🤝 Architecture Principles (AFRICUL Standard)

1. **Feature Ownership**: Each feature (feed, profile, etc.) owns its screens, logic, and components
2. **Shared Infrastructure**: Only primitives in `components/ui/` and infrastructure in `platform/`
3. **Type Safety**: Strict TypeScript - no `any`
4. **Simple State**: Zustand for global state, component state for local data
5. **Service Layer**: All API calls go through typed services
6. **Error Handling**: Explicit error states in components

---

## 📞 Quick Reference

### Most Important Files

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Root navigation setup |
| `src/platform/api/client.ts` | HTTP client + auth |
| `src/platform/state/authStore.ts` | Global auth state |
| `package.json` | Dependencies (matching AFRICUL's versions) |
| `tsconfig.json` | TypeScript + path aliases |
| `.env` | API URL and config |

### Most Important Commands

```powershell
npm start           # Start dev server
npm run android     # Run on Android
npm run ios         # Run on iOS
npm run type-check  # Check TypeScript
```

---

**Done! You now understand exactly how AFRICUL's mobile app works. Start with Step 1 of Setup, follow through to Step 5, then experiment with the patterns shown in the API Client and Component Structure sections.**

**Questions? Review the section again or check Expo docs: https://docs.expo.dev/**

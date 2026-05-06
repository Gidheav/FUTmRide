# LR-Ride Mobile Setup - Copy & Paste Quick Start

**⚠️ Getting Expo download errors?** → See [EXPO_DOWNLOAD_ERROR_FIX.md](./EXPO_DOWNLOAD_ERROR_FIX.md) first

This is a **copy-paste guide** to set up your mobile app exactly like AFRICUL. Follow each section in order.

---

## ✅ Prerequisites Check

Run these commands in PowerShell to verify you have everything:

```powershell
node --version          # Must be 18.0.0 or higher
npm --version           # Must be 9.0.0 or higher
```

**If you get "command not found":**
1. Download Node.js from https://nodejs.org/ (choose LTS)
2. Install it
3. Close and reopen PowerShell
4. Try the commands again

---

## 🚀 Step 1: Create Mobile Project Directory

```powershell
# Navigate to your LR-Ride project root
cd C:\Users\YourName\Desktop\LR-Ride

# Create mobile folder
mkdir mobile
cd mobile
```

---

## 📦 Step 2: Initialize npm and Install Dependencies

```powershell
# Initialize npm project
npm init -y

# Install Expo and React Native
npm install expo@^52.0.0 expo-router@^4.0.0 react@^18.3.1 react-native@^0.76.0 zustand@^4.5.5

# Install TypeScript and types
npm install --save-dev typescript@^5.6.3 @types/react@^18.3.12
```

**These commands:**
- Create `package.json` with all dependencies
- Create `node_modules/` folder with all code
- Take 2-5 minutes depending on internet speed

---

## 📄 Step 3: Create Configuration Files

### 3a. Create `package.json` (Copy Entire Content)

Replace your `package.json` with this:

```json
{
  "name": "lr-ride-mobile",
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

Then run:
```powershell
npm install
```

### 3b. Create `tsconfig.json`

Create file: `mobile/tsconfig.json`

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

### 3c. Create `.env.example`

Create file: `mobile/.env.example`

```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 3d. Create `.env`

Create file: `mobile/.env`

```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 📁 Step 4: Create Folder Structure

Run these commands (Windows PowerShell):

```powershell
# Create all folders at once
mkdir -p app\(tabs)
mkdir -p src\components\ui
mkdir -p src\features\public
mkdir -p src\features\admin
mkdir -p src\platform\api
mkdir -p src\platform\state
```

**Result:** Your `mobile/` folder now looks like this:
```
mobile/
├── app/
│   ├── (tabs)/
│   └── _layout.tsx
├── src/
│   ├── components/
│   │   └── ui/
│   ├── features/
│   │   ├── public/
│   │   └── admin/
│   └── platform/
│       ├── api/
│       └── state/
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🔌 Step 5: Create Root Navigation

Create file: `mobile/app/_layout.tsx`

```typescript
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**What this does:** Sets up the main navigation container for your entire app.

---

## 🔌 Step 6: Create API Client

Create file: `mobile/src/platform/api/client.ts`

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}
```

**What this does:** 
- Reads `EXPO_PUBLIC_API_URL` from `.env`
- Provides `apiGet()` and `apiPost()` functions for all API calls
- Automatically throws errors if request fails

---

## 🧠 Step 7: Create Auth Store

Create file: `mobile/src/platform/state/authStore.ts`

```typescript
import { create } from "zustand";

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,

  setAuth: (token, user) => {
    set({ accessToken: token, user });
  },

  clearAuth: () => {
    set({ accessToken: null, user: null });
  },

  isAuthenticated: () => {
    // Will be defined when store is used
    return false;
  },
}));

// Add this after store creation to fix isAuthenticated
useAuthStore.setState({
  isAuthenticated: () => {
    const state = useAuthStore.getState();
    return state.accessToken !== null;
  },
});
```

**What this does:**
- Global state management (who's logged in, their token, user info)
- Can be accessed from ANY component with `useAuthStore()`

---

## 🎨 Step 8: Create UI Components

Create file: `mobile/src/components/ui/AppButton.tsx`

```typescript
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";

interface AppButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function AppButton({
  title,
  onPress,
  disabled = false,
  style,
}: AppButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
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
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
```

---

## 📄 Step 9: Create Your First Screen (Feed)

Create file: `mobile/src/features/public/feed/feedService.ts`

```typescript
import { apiGet } from "@/platform/api/client";

export interface FeedPost {
  id: string;
  title: string;
  description: string;
  creator: string;
  created_at: string;
}

export async function fetchFeed(): Promise<FeedPost[]> {
  try {
    return await apiGet<FeedPost[]>("/feed/");
  } catch (error) {
    console.error("Failed to fetch feed:", error);
    throw error;
  }
}
```

---

Create file: `mobile/src/features/public/feed/FeedScreen.tsx`

```typescript
import { View } from "react-native";
import { useEffect, useState } from "react";
import { FeedPost, fetchFeed } from "./feedService";

export function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFeed();
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <View><Text>Loading...</Text></View>;
  }

  if (error) {
    return <View><Text>Error: {error}</Text></View>;
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {posts.length === 0 ? (
        <Text>No posts yet</Text>
      ) : (
        posts.map((post) => (
          <View key={post.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>{post.title}</Text>
            <Text style={{ marginTop: 8, color: "#666" }}>{post.description}</Text>
            <Text style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
              By {post.creator} • {new Date(post.created_at).toLocaleDateString()}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}
```

---

Create file: `mobile/app/(tabs)/_layout.tsx`

```typescript
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarStyle: {
          borderTopColor: "#E0E0E0",
          backgroundColor: "#FFF",
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarLabel: "Feed",
        }}
      />
    </Tabs>
  );
}
```

---

Create file: `mobile/app/(tabs)/feed.tsx`

```typescript
import { FeedScreen } from "@/features/public/feed/FeedScreen";

export default function FeedTab() {
  return <FeedScreen />;
}
```

---

## 🚀 Step 10: Run Your App

### Option A: Start Dev Server (Recommended First Time)

```powershell
cd mobile
npm start
```

**Output:**
```
> expo start
[... logs ...]
✓ Metro bundler started
Waiting for Metro bundler to be ready...

You can open the app in your phone by scanning this QR code.
┌────────────────────────────────────────┐
│                                        │
│  expo.dev/[random-id]                  │
│                                        │
└────────────────────────────────────────┘
```

### Option B: Run on Android Emulator

```powershell
# Make sure Android Studio and emulator are running
npm run android
```

### Option C: Run on iPhone Simulator (Mac only)

```powershell
npm run ios
```

### Option D: Run on Your Phone (Easiest!)

1. **Install Expo Go:**
   - iPhone: App Store → search "Expo Go" → Install
   - Android: Google Play Store → search "Expo Go" → Install

2. **Scan QR code** from terminal output

3. **Wait** 10-30 seconds, app will load

---

## ✅ Test It's Working

After app opens:
1. You should see "Loading..."
2. If backend is running at `http://localhost:8000`:
   - You'll see feed posts
3. If backend is NOT running:
   - You'll see "Error: Failed to load feed"

To test with your backend:
```powershell
# Terminal 1: Backend
cd backend
python manage.py runserver

# Terminal 2: Mobile (different PowerShell window)
cd mobile
npm start
```

---

## 🐛 Troubleshooting

### "Cannot find module 'expo'"
```powershell
npm install
```

### "EXPO_PUBLIC_API_URL is undefined"
- Check `.env` file exists in `mobile/` folder
- Make sure it has: `EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1`
- Restart: `npm start`

### "Network request failed"
- Check backend is running: `python manage.py runserver 8000`
- On phone: change `localhost` to your computer's IP address in `.env`
  ```
  EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api/v1
  ```
  (Replace 192.168.1.100 with your actual IP)

### App won't start
```powershell
# Clear cache and rebuild
npm start -- --clear
```

### Black screen on app start
- Check `app/_layout.tsx` exists
- Check `app/(tabs)/_layout.tsx` exists
- Check `app/(tabs)/feed.tsx` exists

---

## 📝 Next Steps

Once basic setup is working:

1. **Add Login Screen**
   - Create `app/auth/login.tsx`
   - Call backend `/identity/login/`
   - Save token to `authStore`

2. **Add Protected Navigation**
   - Modify `app/_layout.tsx` to show login or feed based on `accessToken`

3. **Add More Features**
   - Create profiles screen
   - Create vault screen
   - Add notifications

4. **Test on Device**
   - Use Android emulator or iOS simulator
   - Or use Expo Go on your real phone

---

## 📚 File Checklist

After following all steps, you should have:

```
mobile/
├── app/
│   ├── _layout.tsx               ✅
│   └── (tabs)/
│       ├── _layout.tsx           ✅
│       └── feed.tsx              ✅
│
├── src/
│   ├── components/
│   │   └── ui/
│   │       └── AppButton.tsx     ✅
│   │
│   ├── features/
│   │   └── public/
│   │       └── feed/
│   │           ├── FeedScreen.tsx     ✅
│   │           └── feedService.ts     ✅
│   │
│   └── platform/
│       ├── api/
│       │   └── client.ts         ✅
│       └── state/
│           └── authStore.ts      ✅
│
├── .env                          ✅
├── .env.example                  ✅
├── package.json                  ✅
├── tsconfig.json                 ✅
├── node_modules/                 (created by npm install)
└── package-lock.json             (created by npm install)
```

---

## 🎓 Understanding the Flow

When you press "Feed Tab":

```
1. app/(tabs)/feed.tsx loads
2. Renders <FeedScreen />
3. FeedScreen.tsx useEffect runs
4. Calls fetchFeed()
5. fetchFeed() calls apiGet("/feed/")
6. apiGet() makes HTTP request to:
   http://localhost:8000/api/v1/feed/
7. Backend returns: [ { id, title, ... }, ... ]
8. Component displays posts in FlatList
```

---

## 🔒 Security Notes

**DO NOT commit to git:**
- `.env` with real tokens
- `node_modules/` folder
- `.expo/` folder

**Add to `.gitignore`:**
```
node_modules/
.expo/
.env
.env*.local
dist/
```

---

## 📞 Common Patterns for Future Features

### Fetch Data on Screen Load
```typescript
useEffect(() => {
  loadData();
}, []);  // Empty dependency array = runs once
```

### Handle Loading/Error States
```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

if (loading) return <LoadingScreen />;
if (error) return <ErrorScreen message={error} />;
return <SuccessScreen />;
```

### Call API with Auth
```typescript
const { accessToken } = useAuthStore();
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

### Update Global State
```typescript
const { setAuth } = useAuthStore();
setAuth(token, user);  // Now accessible everywhere via useAuthStore()
```

---

## ✨ You're Done!

You now have:
- ✅ Expo project set up
- ✅ TypeScript configured
- ✅ File-based routing (Expo Router)
- ✅ API client that calls backend
- ✅ Global state management (Zustand)
- ✅ First screen (Feed) working
- ✅ Can run on device or emulator

**Next: Customize with your LR-Ride features!**

---

**Questions? Check:** 
- [AFRICUL_MOBILE_SETUP_GUIDE.md](./AFRICUL_MOBILE_SETUP_GUIDE.md) - Detailed explanations
- [AFRICUL_COMPLETE_ARCHITECTURE.md](./AFRICUL_COMPLETE_ARCHITECTURE.md) - How everything works together
- https://docs.expo.dev/ - Official Expo documentation

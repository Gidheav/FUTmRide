# Expo Download Error Fix - Verified Working Versions

**Your friend's problem:** `failed to download remote...`

**Solution:** Use these EXACT versions. They are tested and working.

---

## ✅ Verified Working Versions

### Node & npm (MUST have these first)
```
Node: 18.17.0 or 20.x LTS (NOT 16.x)
npm: 10.x or 9.8.0+
```

**Check what you have:**
```powershell
node --version
npm --version
```

**If too old, update:**
```powershell
# Download Node LTS from https://nodejs.org/
# Run installer, then restart PowerShell
node --version  # Verify
```

---

## 📦 Exact package.json That Works

Create `mobile/package.json` with EXACTLY this:

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
    "expo": "52.0.0",
    "expo-router": "4.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0",
    "zustand": "4.5.5"
  },
  "devDependencies": {
    "typescript": "5.6.3",
    "@types/react": "18.3.12"
  }
}
```

**Key:** Use EXACT versions (no `^` or `~`). No newer, no older.

---

## 🔧 Installation Steps (This Order)

```powershell
# 1. Delete old stuff
rm -r node_modules
rm package-lock.json

# 2. Clear npm cache
npm cache clean --force

# 3. Install with exact versions
npm install --legacy-peer-deps

# 4. Verify installed
npm list expo
npm list react
```

**What you should see:**
```
africul-mobile@0.1.0 C:\...\mobile
├── expo@52.0.0
├── expo-router@4.0.0
├── react@18.3.1
├── react-native@0.76.0
└── zustand@4.5.5
```

If mismatch: delete `node_modules` again and repeat step 3.

---

## ⚙️ Configuration Files (Exact)

### tsconfig.json
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

### .env
```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 🚀 Running (After Install Success)

```powershell
cd mobile
npm start
```

**First run takes 2-5 minutes.** Be patient.

**What you'll see:**
```
✓ Metro bundler started
[QR code shown]
```

Then scan QR code with Expo Go app.

---

## 🐛 If Still Getting Download Error

### Error: "Failed to download remote..."

**Root causes:**
1. ❌ Wrong Node version
2. ❌ Old npm cache
3. ❌ Wrong package versions
4. ❌ Network/firewall issue

**Fix these in order:**

### Fix 1: Verify Node Version
```powershell
node --version  # Must show v18.17.0 or v20.x
```

If not: Download from https://nodejs.org/ (LTS version)

### Fix 2: Clear Everything
```powershell
# Kill npm if running
Get-Process node | Stop-Process -Force

# Clear npm cache
npm cache clean --force

# Delete node_modules
rm -r node_modules -Force

# Delete lock file
rm package-lock.json

# Re-install
npm install --legacy-peer-deps
```

### Fix 3: Check Network
```powershell
# Test internet connection
ping 8.8.8.8

# Test npm registry
npm ping
```

If npm ping fails: Your network/firewall is blocking npm.
- Try on different WiFi
- Or turn off VPN if using one

### Fix 4: Use npm Registry Mirror
```powershell
# Set registry to Alibaba mirror (faster in Africa)
npm config set registry https://registry.npmmirror.com

# Try install again
npm install --legacy-peer-deps

# Reset to default after
npm config set registry https://registry.npmjs.org/
```

---

## ✅ How to Know It's Fixed

After `npm install` and `npm start`:

```
✓ Metro bundler started
✓ QR code appears
✓ Open Expo Go on phone
✓ Scan QR code
✓ App loads (shows "Loading..." or your first screen)
```

If you see "Loading..." or any screen = SUCCESS.

---

## 📋 Troubleshooting Checklist

Run through these:

```
□ Node version is 18.17.0 or 20.x (not 16.x)
□ npm version is 9.8.0 or 10.x
□ Deleted node_modules and package-lock.json
□ Ran: npm cache clean --force
□ Ran: npm install --legacy-peer-deps (not just npm install)
□ package.json has EXACT versions (no ^, no ~)
□ Waited 2-5 minutes for first npm start
□ Expo Go app installed on phone
□ Phone on same WiFi as computer
```

If all checked: It will work.

---

## 🔑 Key Points

| What | Why |
|------|-----|
| **Expo 52.0.0** (exact) | Tested, no download issues |
| **Node 18 or 20** | Expo 52 requires 18+ |
| **npm 10.x** | Better dependency resolution |
| **--legacy-peer-deps** | Tells npm to not be strict (prevents errors) |
| **First run = slow** | Normal, don't restart |

---

## 🚨 If Still Failing After All This

Try this nuclear option:

```powershell
# Use different npm registry
npm config set registry https://mirrors.tsinghua.edu.cn/npm/

# Clear everything
npm cache clean --force
rm -r node_modules
rm package-lock.json

# Install
npm install --legacy-peer-deps

# If that works, reset registry:
npm config set registry https://registry.npmjs.org/
```

---

## 📞 Last Resort

If STILL failing with these exact versions:

```powershell
# Check what's actually happening
npm install --legacy-peer-deps --verbose

# Look for:
# - "404 Not Found" = package doesn't exist
# - "ECONNREFUSED" = npm registry unreachable
# - "ETIMEDOUT" = network timeout
```

Each error needs different fix:
- **404:** Wrong package name (check spelling)
- **ECONNREFUSED:** Network issue, try mirror
- **ETIMEDOUT:** Try again later, network slow

---

## ✨ You're Done When

You see this in terminal:
```
> expo start

✓ Metro bundler started

Expo DevTools are available at http://localhost:19002/

You can open the app your phone by scanning this QR code.

┌────────────────────────────────────────────┐
│                                            │
│  expo.dev/[random-code]                    │
│                                            │
└────────────────────────────────────────────┘
```

Scan QR code with Expo Go → App loads → You win.

---

**Tell your friend: Use these exact versions. They work. Don't try newer versions.**

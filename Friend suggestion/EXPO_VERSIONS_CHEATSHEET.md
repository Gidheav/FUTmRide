# Expo Versions Cheat Sheet - Copy This

**Your friend is getting download errors? Copy-paste these exact versions and commands.**

---

## 🔧 Quick Fix (Do This Now)

```powershell
# 1. Check Node version
node --version
# Should show: v18.17.0 or v20.x
# If older: Download from https://nodejs.org/

# 2. Go to mobile folder
cd mobile

# 3. Delete old installation
rm -r node_modules -Force
rm package-lock.json

# 4. Clear npm cache
npm cache clean --force

# 5. Install with these exact versions
npm install --legacy-peer-deps
```

---

## 📦 package.json (Copy Exact)

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

**KEY:** Exact versions = no `^` or `~`

---

## ✅ Versions That Work

| Package | Version | Why |
|---------|---------|-----|
| **Node** | 18.17.0 or 20.x | Expo 52 needs 18+ |
| **npm** | 10.x or 9.8.0+ | Better peer resolution |
| **expo** | 52.0.0 | Latest stable |
| **react** | 18.3.1 | Works with RN 0.76 |
| **react-native** | 0.76.0 | Latest stable |
| **typescript** | 5.6.3 | Works with all above |

---

## 🚀 Then Run

```powershell
npm start
```

**Wait 2-5 minutes for first run.** You'll see QR code. Scan with Expo Go app.

---

## 🐛 Still Getting Error?

Try this:

```powershell
npm install --legacy-peer-deps --verbose
```

Look at the error message:
- **"404 Not Found"** → Package name wrong
- **"ECONNREFUSED"** → Network issue
- **"ETIMEDOUT"** → Try again, network slow

---

## 💾 Full Reference

For detailed explanation and all fixes → See [EXPO_DOWNLOAD_ERROR_FIX.md](./EXPO_DOWNLOAD_ERROR_FIX.md)

---

**That's it. These versions work. Use them.**

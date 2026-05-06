# Expo Download Error - What Your Friend Needs

**Problem:** `failed to download remote...`

**Solution:** Two files created with ONLY what matters:

---

## 📄 Files for Your Friend

### 1. **[EXPO_VERSIONS_CHEATSHEET.md](./EXPO_VERSIONS_CHEATSHEET.md)** ⚡ (Read First - 2 min)
   - Exact versions (Expo 52.0.0, Node 18+, npm 10.x)
   - Copy-paste commands
   - What to run
   - **Nothing else**

### 2. **[EXPO_DOWNLOAD_ERROR_FIX.md](./EXPO_DOWNLOAD_ERROR_FIX.md)** 🔧 (If Still Failing - 10 min)
   - Why error happens
   - Step-by-step fixes
   - Troubleshooting checklist
   - Network mirror options

---

## 🎯 Tell Your Friend

Use this exact message:

> **Getting `failed to download remote...` error?**
>
> 1. Download the **verified working versions**:
>    - Node: v18.17.0 or v20.x (https://nodejs.org/)
>    - npm: 10.x (comes with Node)
>
> 2. Copy this `package.json` (exact versions, no changes):
>    ```json
>    {
>      "dependencies": {
>        "expo": "52.0.0",
>        "expo-router": "4.0.0",
>        "react": "18.3.1",
>        "react-native": "0.76.0",
>        "zustand": "4.5.5"
>      },
>      "devDependencies": {
>        "typescript": "5.6.3",
>        "@types/react": "18.3.12"
>      }
>    }
>    ```
>
> 3. Run these commands:
>    ```powershell
>    rm -r node_modules -Force
>    rm package-lock.json
>    npm cache clean --force
>    npm install --legacy-peer-deps
>    npm start
>    ```
>
> **If still failing:**
>    - Check Node version: `node --version` (must be 18+)
>    - See: [EXPO_VERSIONS_CHEATSHEET.md](./EXPO_VERSIONS_CHEATSHEET.md)
>    - Full help: [EXPO_DOWNLOAD_ERROR_FIX.md](./EXPO_DOWNLOAD_ERROR_FIX.md)
>
> **These versions work. They're what AFRICUL uses.**

---

## ✅ Verified Working

| Tool | Version | Tested |
|------|---------|--------|
| Node | 18.17.0 / 20.x | ✅ Yes |
| npm | 10.x | ✅ Yes |
| Expo | 52.0.0 | ✅ Yes |
| React | 18.3.1 | ✅ Yes |
| React Native | 0.76.0 | ✅ Yes |
| TypeScript | 5.6.3 | ✅ Yes |

---

## 🚀 What Happens After Fix

```powershell
npm start

# You'll see:
✓ Metro bundler started
[QR code]

# Scan with Expo Go → App loads ✅
```

---

## 🎯 Send Your Friend These Two Links

1. **Quick fix (read first):** [EXPO_VERSIONS_CHEATSHEET.md](./EXPO_VERSIONS_CHEATSHEET.md)
2. **Full help (if needed):** [EXPO_DOWNLOAD_ERROR_FIX.md](./EXPO_DOWNLOAD_ERROR_FIX.md)

Both are in the root folder. Nothing else needed.

---

**No fluff. Just what works.**

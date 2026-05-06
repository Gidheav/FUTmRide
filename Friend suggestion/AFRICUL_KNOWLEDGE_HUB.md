# AFRICUL Knowledge Hub - Complete Documentation

**Hello friend developer!** 👋

This is a **complete guide** to understanding and replicating **AFRICUL's mobile app setup** for your project.

We've documented everything so you can:
1. **Understand** how AFRICUL works
2. **Learn** the patterns and principles
3. **Replicate** the setup in your own project
4. **Adapt** it for your specific needs

---

## � Getting Download Errors? START HERE

**If you're getting:** `failed to download remote...` or `npm install` errors

**Quick versions cheat sheet:** [EXPO_VERSIONS_CHEATSHEET.md](./EXPO_VERSIONS_CHEATSHEET.md) (2 minutes)

**Full explanation + all fixes:** [EXPO_DOWNLOAD_ERROR_FIX.md](./EXPO_DOWNLOAD_ERROR_FIX.md) (10 minutes)

**Contains:**
- Exact versions that work (Expo 52.0.0, Node 18+, npm 10.x)
- Why download fails (wrong versions, old node, etc.)
- Step-by-step fixes in order
- Verified working checklist

---

## �📚 Documentation Files

### 1. **START HERE: Quick Start Guide**
📄 File: [LR_RIDE_QUICK_START.md](./LR_RIDE_QUICK_START.md)

**Use this if:** You want to copy-paste commands and get up and running in 30 minutes.

**Contains:**
- Step-by-step setup instructions
- Copy-paste code for each file
- Commands to run on your computer
- Troubleshooting section
- What to do next

**Time needed:** 30-45 minutes
**Difficulty:** Beginner-friendly

---

### 2. **Deep Dive: Mobile Setup Guide**
📄 File: [AFRICUL_MOBILE_SETUP_GUIDE.md](./AFRICUL_MOBILE_SETUP_GUIDE.md)

**Use this if:** You want to understand HOW Expo, React Native, and TypeScript work together.

**Contains:**
- Project structure explained
- How API communication works
- State management with Zustand
- Component architecture
- Authentication flow
- Environment variables
- Running the app locally
- Common gotchas and solutions

**Time needed:** 2-3 hours reading + experimenting
**Difficulty:** Intermediate
**Best for:** Deep understanding

---

### 3. **System Overview: Complete Architecture**
📄 File: [AFRICUL_COMPLETE_ARCHITECTURE.md](./AFRICUL_COMPLETE_ARCHITECTURE.md)

**Use this if:** You want to see the ENTIRE picture - mobile, web, backend, database.

**Contains:**
- System architecture diagram
- How mobile talks to backend
- How web frontend differs from mobile
- Backend API endpoints
- Database schema
- Authentication flow
- Deployment architecture
- Data flow examples
- Development workflow

**Time needed:** 3-4 hours reading
**Difficulty:** Advanced
**Best for:** Seeing the big picture

---

### 4. **Design Philosophy: Why We Built It This Way**
📄 File: [AFRICUL_DESIGN_DECISIONS.md](./AFRICUL_DESIGN_DECISIONS.md)

**Use this if:** You want to understand THE REASONING behind each choice.

**Contains:**
- Why Expo instead of React Native CLI
- Why Expo Router instead of React Navigation
- Why Zustand instead of Redux
- Why Fetch instead of Axios for mobile
- Why Django for backend
- Why modular monolith vs microservices
- Alternatives considered for each decision
- Customization guide for your project

**Time needed:** 2 hours
**Difficulty:** Expert-level thinking
**Best for:** Making informed decisions for your own project

---

## 🎯 Recommended Learning Path

### Path A: "I Just Want to Build It" (Time: 1-2 days)

```
Day 1:
  1. Read: LR_RIDE_QUICK_START.md sections 1-4
  2. Do: Follow all setup steps
  3. Do: npm start and see it run
  
Day 2:
  1. Read: AFRICUL_MOBILE_SETUP_GUIDE.md sections "API Client" and "State Management"
  2. Do: Create your first feature (follow the pattern)
  3. Do: Test API calls
```

---

### Path B: "I Want to Understand Everything" (Time: 1 week)

```
Day 1: Setup
  - Read: LR_RIDE_QUICK_START.md (full)
  - Do: Complete all setup steps

Day 2: Mobile Architecture
  - Read: AFRICUL_MOBILE_SETUP_GUIDE.md
  - Do: Trace through a complete feature

Day 3: System Architecture
  - Read: AFRICUL_COMPLETE_ARCHITECTURE.md
  - Do: Add a backend endpoint and wire it through all three (mobile, web, backend)

Day 4: Design Decisions
  - Read: AFRICUL_DESIGN_DECISIONS.md
  - Do: Think about what you'd change for YOUR project

Day 5-7: Experimentation
  - Build features using the patterns
  - Test different approaches
  - Read relevant sections again when stuck
```

---

### Path C: "I'm Building LR-Ride with This Setup" (Time: Ongoing)

```
1. Use LR_RIDE_QUICK_START.md to set up
2. Use AFRICUL_MOBILE_SETUP_GUIDE.md as reference for patterns
3. Read AFRICUL_DESIGN_DECISIONS.md section on customization
4. For each feature:
   a. Check what AFRICUL has similar
   b. Copy the pattern
   c. Adapt for your needs
5. Use AFRICUL_COMPLETE_ARCHITECTURE.md when you get stuck on "how does X talk to Y?"
```

---

## 📋 Quick Reference: Where to Find Things

| Question | Answer Location |
|----------|-----------------|
| "Expo download error!" | EXPO_VERSIONS_CHEATSHEET.md (fastest) |
| "How do I fix the download error?" | EXPO_DOWNLOAD_ERROR_FIX.md (complete) |
| "What versions should I use?" | EXPO_VERSIONS_CHEATSHEET.md |
| "How do I install Expo?" | LR_RIDE_QUICK_START - Step 2 |
| "How do I create an API client?" | AFRICUL_MOBILE_SETUP_GUIDE - API Client Setup |
| "How do I use Zustand?" | AFRICUL_MOBILE_SETUP_GUIDE - State Management |
| "How do I create a new screen?" | AFRICUL_MOBILE_SETUP_GUIDE - Component Structure |
| "How does auth work?" | AFRICUL_COMPLETE_ARCHITECTURE - Authentication Flow |
| "What does the backend return?" | AFRICUL_COMPLETE_ARCHITECTURE - API Endpoints |
| "Why this framework vs that one?" | AFRICUL_DESIGN_DECISIONS |
| "How do everything work together?" | AFRICUL_COMPLETE_ARCHITECTURE - System Overview |
| "I'm getting an error" | AFRICUL_MOBILE_SETUP_GUIDE - Debugging / Common Issues |
| "How do I run locally?" | AFRICUL_MOBILE_SETUP_GUIDE - Running the App |

---

## 🛠️ Technology Stack (Explained)

### Mobile (Expo + React Native)
```
Expo SDK 52              ← Platform wrapper (makes React Native easy)
  ├── React Native 0.76  ← Framework for iOS/Android
  ├── React 18.3         ← UI library
  ├── Expo Router 4.0    ← File-based navigation (like Next.js)
  ├── Zustand 4.5        ← Global state management
  └── TypeScript 5.6     ← Type safety
```

### Web (Vite + React)
```
Vite 8.0                 ← Bundler & dev server (10x faster)
  ├── React 18.3         ← UI library
  ├── React Router 6.30   ← Navigation
  ├── Axios 1.8           ← HTTP client
  ├── TanStack Query 5.59 ← Server state management
  ├── Zustand 4.5         ← Global state
  └── TypeScript 5.6      ← Type safety
```

### Backend (Django)
```
Django 4.2+              ← Web framework
  ├── Django REST Framework ← API builder
  ├── Channels            ← WebSocket support
  ├── Celery              ← Task queue (async jobs)
  ├── PostgreSQL          ← Database
  ├── Redis               ← Cache & session storage
  └── JWT (Simple JWT)    ← Authentication tokens
```

---

## 🎓 Key Concepts You'll Master

After completing these guides, you'll understand:

1. **File-based routing** (Expo Router)
   - How file paths become URLs
   - Tab navigation with groups
   - Deep linking

2. **State management** (Zustand)
   - Simple global state
   - Subscribing to state changes
   - When to use local vs global

3. **API communication**
   - Types for API responses
   - Error handling
   - Authentication with JWT tokens

4. **Component architecture**
   - Feature ownership
   - Shared vs business components
   - TypeScript for components

5. **Full-stack integration**
   - How mobile calls backend
   - How web calls backend
   - Why they might make the same call differently

6. **Authentication & Authorization**
   - Login flow
   - Storing tokens
   - Refreshing expired tokens
   - Protected routes

7. **Development workflow**
   - Local development setup
   - Running on physical device
   - Debugging
   - Writing tests

---

## ✨ What Makes AFRICUL's Setup Great

### For Startups
- ✅ **Minimal dependencies** - Start lean, add later
- ✅ **Type-safe** - Catch bugs before users see them
- ✅ **Scalable structure** - Doesn't break at 10 or 100 features
- ✅ **Developer experience** - Fast feedback loops
- ✅ **Mobile-first** - Optimized for Africa (3G, old devices)

### For Teams
- ✅ **Feature ownership** - Each team owns their feature
- ✅ **Clear boundaries** - No spaghetti code
- ✅ **Consistent patterns** - Everyone writes the same way
- ✅ **Easy onboarding** - New devs understand structure fast
- ✅ **Testable** - Services are easy to test

### For Growth
- ✅ **API-first** - Easy to split mobile/web later
- ✅ **Modular backend** - Can become microservices
- ✅ **Performance-focused** - Works on weak networks
- ✅ **Security-focused** - Built-in authorization patterns
- ✅ **Observable** - Can add monitoring easily

---

## 🚀 Your Next Steps

### Immediate (Today)
1. Pick your learning path above (A, B, or C)
2. Open [LR_RIDE_QUICK_START.md](./LR_RIDE_QUICK_START.md)
3. Follow steps 1-5 (should take 30 minutes)
4. Get the app running

### Short Term (This Week)
1. Complete your chosen learning path
2. Read through all setup code
3. Modify one thing (change a color, add a field)
4. Make sure it still works

### Medium Term (This Month)
1. Add your first real feature
2. Connect to YOUR backend
3. Test on physical device
4. Invite others to test

---

## 💡 Pro Tips

### Tip 1: Don't Memorize - Understand
Don't try to memorize all the syntax. Understand the *patterns*.

Once you understand:
- "Files = routes"
- "Services = API calls"
- "Zustand = global state"

You can Google the specific syntax anytime.

### Tip 2: Copy-Paste First, Understand Later
When you hit a sticky part:
1. Copy pattern from existing code
2. Get it working
3. Go back and understand what happened

This is how all experienced developers work.

### Tip 3: Change One Thing at a Time
Don't try to:
- Learn Expo
- Learn TypeScript
- Learn Zustand
- Build your feature

All at once.

Instead:
- Use example code for first 3
- Focus learning energy on your feature

### Tip 4: Read Errors Carefully
React Native and TypeScript give GREAT error messages.

When you see an error:
1. Read the error message (seriously, it says what's wrong)
2. Find the file:line it points to
3. Look at the surrounding code
4. 90% of the time you'll spot the issue

### Tip 5: The Foundation is Worth the Time
First app takes 4-6 hours to set up.
Every app after that? 10 minutes (copy-paste).

Worth it.

---

## 🤝 Common Customizations for Your Project

### If Building a Marketplace
```typescript
// Add to state:
- productStore (list of products)
- orderStore (user's orders)
- cartStore (shopping cart)

// Add to features:
- features/public/products/
- features/public/checkout/
- features/seller/dashboard/
```

### If Building a Chat App
```typescript
// Add to state:
- messageStore (all messages)
- chatStore (active conversations)

// Add to features:
- features/public/conversations/
- features/public/direct-message/

// Backend change:
- WebSocket for real-time messages
```

### If Building a Bookings App (Like LR-Ride)
```typescript
// Modified state:
- bookingStore (current/past bookings)
- locationStore (user location)
- driverStore (available drivers)

// Add to features:
- features/public/booking/
- features/public/active-trip/
- features/public/map/

// Backend change:
- Real-time location updates (WebSocket)
- Payment processing
```

---

## 📞 Getting Help

### When You Get Stuck

**Error in TypeScript?**
- → AFRICUL_MOBILE_SETUP_GUIDE section "TypeScript Best Practices"

**Error when running app?**
- → AFRICUL_MOBILE_SETUP_GUIDE section "Debugging"

**Don't understand a pattern?**
- → AFRICUL_COMPLETE_ARCHITECTURE section that shows the flow

**Want to use a different library?**
- → AFRICUL_DESIGN_DECISIONS section "Alternatives"

### External Resources

- **Expo Docs:** https://docs.expo.dev/
- **React Native Docs:** https://reactnative.dev/
- **Zustand Repo:** https://github.com/pmndrs/zustand
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/

---

## ✅ Verification Checklist

After you've learned this material, you should be able to:

```
□ Explain how Expo Router works (file = route)
□ Create a new screen/route
□ Use Zustand to store global state
□ Call a backend API and display results
□ Handle loading/error states
□ Create TypeScript interfaces for API responses
□ Add authentication
□ Test the app on Expo Go or emulator
□ Modify existing features
□ Explain what happens when you press a button in the app
□ Debug a network request
□ Know when to use local vs global state
□ Explain why AFRICUL made each choice
```

If you can do these? You understand the setup. ✨

---

## 🎯 Final Word

**This is not just documentation. This is your roadmap.**

AFRICUL has already figured out:
- What works
- What doesn't
- What to avoid
- Why each choice matters

By learning from AFRICUL's setup, you:
- Don't repeat their mistakes
- Adopt their best practices
- Understand professional architecture
- Can adapt for your needs

---

## 📖 Document Map

```
You are here: AFRICUL_KNOWLEDGE_HUB.md (this file)
                        ↓
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
   QUICK START     DEEP DIVE      SYSTEM VIEW    DESIGN WHY
   (Get It        (Understand    (See The       (Understand
    Working)      Components)    Big Picture)   Philosophy)
        ↓               ↓               ↓               ↓
    30 min        2-3 hours       3-4 hours      2 hours
```

Pick your starting point above. ⬆️

---

**Happy coding! 🚀**

You've got this. The foundation is solid. Build something great.

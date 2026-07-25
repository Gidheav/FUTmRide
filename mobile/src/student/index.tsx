import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, BackHandler, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuthStore } from '../core/authStore'
import { useSecurityStore } from '../core/securityStore'
import {
  fetchCurrentUser,
  hydrateStudentSessionSnapshot,
  logoutStudentSession,
  refreshStudentSessionTokens,
  saveStudentSessionSnapshotFromStores,
  syncStudentSessionInBackground,
} from '../core/session'
import { StudentLoginScreen, StudentDashboardScreen } from './screens'
import StudentRidesPage from './pages/RidesPage'
import StudentWalletPage from './pages/WalletPage'
import StudentAccountPage from './pages/AccountPage'
import StudentEditProfilePage from './pages/EditProfilePage'
import StudentNotificationsPage from './pages/NotificationsPage'
import StudentNotificationSettingsPage from './pages/NotificationSettingsPage'
import SecurityPage from './pages/SecurityPage'
import SettingsPage from './pages/SettingsPage'
import AppLockPage from './pages/AppLockPage'
import BookRidePage from './pages/BookRidePage'
import RideMatchingPage from './pages/RideMatchingPage'
import ActiveRidePage from './pages/ActiveRidePage'
import GarageRidePage from './pages/GarageRidePage'
import AboutPage from './pages/AboutPage'
import ActivitiesPage from './pages/ActivitiesPage'
import UpdatesPage from './pages/UpdatesPage'
import EventsPage from './pages/EventsPage'
import NewsPage from './pages/NewsPage'
import SafetyGuidePage from './pages/SafetyGuidePage'
import SupportPage from './pages/SupportPage'
import StudentLayout from './layout/StudentLayout'
import InAppAnnouncementModal from './components/InAppAnnouncementModal'
import StudentSidebar from './components/StudentSidebar'
import GenericWebPage from './components/GenericWebPage'
import { WebPageProvider, useWebPage } from './context/WebPageContext'
import type { StudentTab } from './types'
import { clearStoredPinHash } from '../core/security'
import { refreshTransactionPinStatus } from '../core/transactionPin'
import api from '../core/api'
import {
  registerStudentPushToken,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  getLastNotificationResponseData,
} from '../core/pushNotifications'
import useWalletStore from '../core/walletStore'
import LocationDataService from '../../services/locationDataService'
import {
  getPendingInAppAnnouncement,
  markInAppAnnouncementSeen,
  type StudentInAppAnnouncement,
} from './services/inAppAnnouncement'

// Statuses where we show the matching (searching) screen
const MATCHING_STATUSES = ['requested', 'searching']
const ANNOUNCEMENT_GATE_TIMEOUT_MS = 5000

type RideScreen = 'none' | 'booking' | 'matching' | 'active' | 'garage'
type PendingNotificationAction =
  | { type: 'web'; url: string; title?: string }
  | { type: 'ride'; rideId: string; rideStatus?: string }

export default function StudentApp() {
  return (
    <WebPageProvider>
      <StudentAppInner />
    </WebPageProvider>
  )
}

function StudentAppInner() {
  const { isAuthenticated, user, setTokens, setUser, hasHydrated, hydrateTokens, isSessionExpired } = useAuthStore()
  const [tokensLoaded, setTokensLoaded] = useState(false)
  const {
    appLockEnabled,
    biometricEnabled,
    hasPin,
    hasTransactionPin,
    transactionPinStatus,
    locked,
    lockTimeoutMinutes,
    lastUnlockAt,
    pinRecoveryRequired,
    setAppLockEnabled,
    setLocked,
    setLastUnlockAt,
    setHasPin,
    setHasTransactionPin,
    setPinRecoveryRequired,
  } = useSecurityStore()

  const [activeTab, setActiveTab] = useState<StudentTab>('home')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [accountMode, setAccountMode] = useState<'view' | 'edit' | 'notifications' | 'security' | 'settings'>('view')
  const [accountRefreshKey, setAccountRefreshKey] = useState(0)
  const [disputeTx, setDisputeTx] = useState<any>(null)
  const [openPinOnLoad, setOpenPinOnLoad] = useState(false)
  const [skipPinVerify, setSkipPinVerify] = useState(false)
  const [notifHistoryOpen, setNotifHistoryOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingAnnouncement, setPendingAnnouncement] = useState<StudentInAppAnnouncement | null>(null)
  const [announcementGateVisible, setAnnouncementGateVisible] = useState(false)
  const [announcementRefreshKey, setAnnouncementRefreshKey] = useState(0)
  const [transactionPinGateLoading, setTransactionPinGateLoading] = useState(false)
  const { openWebPage, closWebPage, webPage } = useWebPage()
  // Generic in-app webview — used by notifications and other deep links
  // (state managed by WebPageContext, accessible from any component via useWebPage())
  const syncInFlight = useRef(false)
  const lastBackPressAt = useRef(0)
  const lastWalletSyncAt = useRef(0)
  const appStateRef = useRef(AppState.currentState)
  const wentBackgroundAtRef = useRef<number | null>(null)
  const announcementCheckRef = useRef<string | null>(null)
  const lockedRef = useRef(locked)
  const pendingNotificationActionRef = useRef<PendingNotificationAction | null>(null)
  const lastInitialNotificationKeyRef = useRef<string | null>(null)
  const transactionPinStatusUserRef = useRef<string | null>(null)
  // True only on the very first mount (cold start). Cleared after the first lock check.
  const isColdStartRef = useRef(true)
  // Track previous auth state so we can detect a fresh email/password login
  const prevIsAuthenticatedRef = useRef(isAuthenticated)
  const setWalletBalance = useWalletStore((state) => state.setWalletBalance)
  const syncWalletBalance = useWalletStore((state) => state.syncBalance)
  const bumpWalletActivityRefresh = useWalletStore((state) => state.bumpWalletActivityRefresh)
  const triggerWalletFlash = useWalletStore((state) => state.triggerWalletFlash)

  // ─── Ride flow state (single source of truth) ───────────────────────────────
  // Which ride-related screen is currently shown
  const [rideScreen, setRideScreen] = useState<RideScreen>('none')
  // The rideId shared across all ride screens
  const [activeRideId, setActiveRideId] = useState<string | null>(null)
  // Shallow active ride info for the dashboard button
  const [activeRideSummary, setActiveRideSummary] = useState<{ id: string; status: string } | null>(null)
  // Token from scanned garage ride QR code
  const [garageQrToken, setGarageQrToken] = useState<string | null>(null)
  // Track if we have already done the initial active-ride check
  const rideCheckedRef = useRef(false)

  // ─── Deep link: lrride://share/CODE ──────────────────────────────────────
  const [deepLinkShareCode, setDeepLinkShareCode] = useState<string | null>(null)

  const handleDeepLink = useCallback((url: string | null) => {
    if (!url) return
    try {
      // Supports: lrride://share/CODE and https://futmride.app/share/CODE
      const match = url.match(/(?:lrride:\/\/|https:\/\/futmride\.app\/)share\/([A-Z0-9]+)/i)
      if (match?.[1]) {
        setDeepLinkShareCode(match[1].toUpperCase())
        setActiveTab('rides')
      }
    } catch {
      // Malformed URL — ignore
    }
  }, [setActiveTab])

  useEffect(() => {
    // Cold start: app was launched from a share link
    Linking.getInitialURL().then(handleDeepLink).catch(() => null)
    // Warm start: link opened while app is running
    const sub = Linking.addEventListener('url', (event) => handleDeepLink(event.url))
    return () => sub.remove()
  }, [handleDeepLink])

  // ─── Check backend for an existing active ride ────────────────────────────
  const checkActiveRide = useCallback(async () => {
    try {
      const res = await api.get('rides/my/active/')
      const ride = res.data
      const rideId = String(ride.id)
      const status = ride.status as string
      setActiveRideId(rideId)
      setActiveRideSummary({ id: rideId, status })
    } catch {
      // 404 = no active ride — clear everything
      setActiveRideSummary(null)
      if (!['booking'].includes(rideScreen)) {
        setActiveRideId(null)
      }
    }
  }, [rideScreen])

  // Check for active ride once after login / unlock
  useEffect(() => {
    if (!isAuthenticated || locked || rideCheckedRef.current) return
    rideCheckedRef.current = true
    void checkActiveRide()
  }, [isAuthenticated, locked, checkActiveRide])

  // Initialize OTA location data once after auth (non-blocking, silent)
  useEffect(() => {
    if (!isAuthenticated || locked) return
    void LocationDataService.initialize()
  }, [isAuthenticated, locked])

  // Re-check whenever we return to the dashboard (ride screen becomes 'none')
  useEffect(() => {
    if (rideScreen === 'none' && isAuthenticated && !locked) {
      void checkActiveRide()
    }
  }, [rideScreen, isAuthenticated, locked, checkActiveRide])

  // ─── Boot: hydrate tokens from SecureStore into Zustand ──────────────────
  // Tokens are NOT persisted to AsyncStorage (only user + isAuthenticated are).
  // On cold start, accessToken/refreshToken in Zustand are null until we load
  // them here. This must complete before any authenticated API calls fire.
  useEffect(() => {
    hydrateTokens().finally(() => {
      setTokensLoaded(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  useEffect(() => {
    if (!hasHydrated || !tokensLoaded || !isAuthenticated || !user?.id) return
    let cancelled = false
    hydrateStudentSessionSnapshot(user.id)
      .then(() => {
        if (!cancelled) {
          void syncStudentSessionInBackground()
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [hasHydrated, isAuthenticated, tokensLoaded, user?.id])

  // ─── Session sync (fresh email/password login only) ─────────────────────
  // Only fires when the user just completed a full login (not after PIN unlock).
  // PIN unlock uses the proactive refresh in AppLockPage + the 401 interceptor.
  const syncSession = async () => {
    if (syncInFlight.current) return
    syncInFlight.current = true
    try {
      const tokens = await refreshStudentSessionTokens()
      if (tokens.accessToken) {
        setTokens(tokens.accessToken, tokens.refreshToken)
      }
      const profile = await fetchCurrentUser()
      if (profile) {
        setUser(profile)
        if (profile.wallet_balance !== undefined) {
          useWalletStore.getState().setWalletBalance(profile.wallet_balance)
        }
      }
    } catch {
      // Sync failure on login is non-fatal — the interceptor will handle
      // the next 401 transparently.
    } finally {
      syncInFlight.current = false
    }
  }

  // ─── Fresh login detection ────────────────────────────────────────────────
  // When the user logs in with email + password, isAuthenticated flips false→true.
  // We stamp lastUnlockAt immediately so the AppLock timeout check never triggers
  // on a fresh login. AppLock is ONLY for when the app returns from the background.
  useEffect(() => {
    const wasAuthenticated = prevIsAuthenticatedRef.current
    prevIsAuthenticatedRef.current = isAuthenticated
    if (!wasAuthenticated && isAuthenticated) {
      // Fresh login — treat as an immediate unlock so AppLock doesn't fire
      setLastUnlockAt(Date.now())
      setLocked(false)
    }
  }, [isAuthenticated, setLastUnlockAt, setLocked])

  // ─── App lock / timeout ───────────────────────────────────────────────────
  // This effect runs once the security store has rehydrated from AsyncStorage.
  // On cold start (isColdStartRef = true), we ALWAYS lock if appLock is enabled —
  // regardless of the timeout setting — because the user fully closed the app.
  // On subsequent background → foreground transitions, only lock if the timeout
  // has elapsed (handled by the AppState listener below).
  useEffect(() => {
    if (!appLockEnabled || lockTimeoutMinutes === -1) { setLocked(false); return }
    if (!hasPin && !biometricEnabled) { setAppLockEnabled(false); setLocked(false); return }

    if (isColdStartRef.current) {
      // Cold start: always show AppLock when it is enabled
      isColdStartRef.current = false
      setLocked(true)
      return
    }

    // Non-cold-start (store value changed mid-session): use timeout logic
    if (!lastUnlockAt) { setLocked(true); return }
    if (lockTimeoutMinutes === 0) return
    if ((Date.now() - lastUnlockAt) / 60000 >= lockTimeoutMinutes) setLocked(true)
  }, [appLockEnabled, biometricEnabled, hasPin, lastUnlockAt, lockTimeoutMinutes, setAppLockEnabled, setLocked])

  useEffect(() => {
    const handleChange = (state: string) => {
      const previousState = appStateRef.current
      appStateRef.current = state as typeof appStateRef.current

      if (state === 'active' && previousState !== 'active') {
        setAnnouncementRefreshKey((value) => value + 1)
      }

      if (!appLockEnabled) return
      if (state === 'background') {
        if (wentBackgroundAtRef.current === null) {
          wentBackgroundAtRef.current = Date.now()
        }
        void saveStudentSessionSnapshotFromStores()
        return
      }
      if (state === 'active' && previousState !== 'active') {
        const leftAt = wentBackgroundAtRef.current
        wentBackgroundAtRef.current = null
        if (!leftAt) return

        const hasUnlockMethod = hasPin || biometricEnabled
        if (lockTimeoutMinutes === -1 || !hasUnlockMethod) {
          setLocked(false)
          void syncStudentSessionInBackground()
          return
        }

        if (lockTimeoutMinutes === 0) {
          setLocked(true)
          return
        }

        const awayMs = Date.now() - leftAt
        const timeoutMs = lockTimeoutMinutes * 60 * 1000
        if (awayMs >= timeoutMs) {
          setLocked(true)
          return
        }

        setLocked(false)
        setLastUnlockAt(Date.now())
        void syncStudentSessionInBackground()
      }
    }

    const changeSub = AppState.addEventListener('change', handleChange)
    return () => {
      changeSub.remove()
    }
  }, [appLockEnabled, biometricEnabled, hasPin, lockTimeoutMinutes, setLastUnlockAt, setLocked])

  useEffect(() => {
    // Only sync session after a fresh email/password login, not after PIN unlock.
    // PIN unlock is handled by AppLockPage's kickoffProactiveRefresh + interceptor.
    if (!isAuthenticated || locked) return
    void syncSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]) // intentionally omit locked — only fires on auth change

  useEffect(() => {
    if (!isAuthenticated) {
      setPendingAnnouncement(null)
      setAnnouncementGateVisible(false)
      announcementCheckRef.current = null
      return
    }
    if (!user || user.role !== 'student' || locked || pinRecoveryRequired) {
      setAnnouncementGateVisible(false)
      return
    }

    const firstCheckForUser = announcementCheckRef.current
      ? !announcementCheckRef.current.startsWith(`${user.id}:`)
      : true
    const checkKey = `${user.id}:${announcementRefreshKey}`
    if (announcementCheckRef.current === checkKey) return
    announcementCheckRef.current = checkKey

    let cancelled = false
    let gateTimeout: ReturnType<typeof setTimeout> | null = null

    if (firstCheckForUser) {
      setAnnouncementGateVisible(true)
      gateTimeout = setTimeout(() => {
        if (!cancelled) setAnnouncementGateVisible(false)
      }, ANNOUNCEMENT_GATE_TIMEOUT_MS)
    }

    const hideAnnouncementGate = () => {
      if (gateTimeout) {
        clearTimeout(gateTimeout)
        gateTimeout = null
      }
      if (firstCheckForUser) setAnnouncementGateVisible(false)
    }

    const loadAnnouncement = async () => {
      const announcement = await getPendingInAppAnnouncement(user.id)
      if (cancelled) return
      try {
        setPendingAnnouncement(announcement)
      } finally {
        hideAnnouncementGate()
      }
    }

    void loadAnnouncement()
    return () => {
      cancelled = true
      hideAnnouncementGate()
    }
  }, [announcementRefreshKey, isAuthenticated, locked, pinRecoveryRequired, user?.id, user?.role])

  const handleDismissAnnouncement = useCallback(async () => {
    if (!pendingAnnouncement || !user?.id) {
      setPendingAnnouncement(null)
      return
    }

    const campaignId = pendingAnnouncement.campaignId
    setPendingAnnouncement(null)
    try {
      await markInAppAnnouncementSeen(user.id, campaignId)
    } catch {
      // Non-fatal: the user should never be trapped by local storage failure.
    }
  }, [pendingAnnouncement, user?.id])

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'student') return
    let stillMounted = true
    const syncPushToken = async () => {
      const syncedToken = await registerStudentPushToken(user.fcm_token)
      if (!stillMounted || !syncedToken || syncedToken === user.fcm_token) return
      setUser({ ...user, fcm_token: syncedToken })
    }
    void syncPushToken()
    return () => {
      stillMounted = false
    }
  }, [isAuthenticated, user?.id, user?.role, user?.fcm_token, setUser])

  useEffect(() => {
    if (!isAuthenticated || locked || !user || user.role !== 'student') {
      transactionPinStatusUserRef.current = null
      return
    }
    if (transactionPinStatusUserRef.current === user.id) return
    if (transactionPinStatus === 'loading' || transactionPinStatus === 'ready') return

    transactionPinStatusUserRef.current = user.id
    void refreshTransactionPinStatus().catch(() => {
      // User-triggered wallet/booking flows show a retryable error if this fails.
    })
  }, [isAuthenticated, locked, transactionPinStatus, user?.id, user?.role])

  const handleWalletNotification = useCallback((data: Record<string, any>) => {
    if (!data) return
    const isWalletEvent = Boolean(
      data.wallet_balance !== undefined ||
      data.transfer_reference ||
      data.transaction_reference ||
      data.transaction_id ||
      data.reference,
    )
    if (isWalletEvent) {
      triggerWalletFlash()
      bumpWalletActivityRefresh()
    }
    const balance = data.wallet_balance
    if (balance !== undefined && balance !== null) {
      setWalletBalance(balance)
      return
    }
    const shouldSync = Boolean(
      data.transfer_reference ||
      data.transaction_reference ||
      data.transaction_id ||
      data.reference,
    )
    if (!shouldSync) return
    const now = Date.now()
    if (now - lastWalletSyncAt.current < 2000) return
    lastWalletSyncAt.current = now
    void syncWalletBalance()
  }, [bumpWalletActivityRefresh, setWalletBalance, syncWalletBalance, triggerWalletFlash])

  useEffect(() => {
    lockedRef.current = locked
  }, [locked])

  const runNotificationAction = useCallback((action: PendingNotificationAction) => {
    if (action.type === 'web') {
      openWebPage(action.url, action.title)
      return
    }

    setActiveRideId(action.rideId)
    if (MATCHING_STATUSES.includes(action.rideStatus || '')) {
      setRideScreen('matching')
    } else {
      setRideScreen('active')
    }
  }, [openWebPage])

  const getNotificationAction = useCallback((data: Record<string, any>): PendingNotificationAction | null => {
    const webUrl = data?.web_url || data?.cta_url
    if (typeof webUrl === 'string' && webUrl.trim()) {
      const webTitle = typeof data?.web_title === 'string'
        ? data.web_title
        : typeof data?.title === 'string'
          ? data.title
          : undefined
      return { type: 'web', url: webUrl, title: webTitle }
    }

    const rideId = data?.ride_id
    if (typeof rideId === 'string' && rideId.trim()) {
      const rideStatus = typeof data?.ride_status === 'string' ? data.ride_status : undefined
      return { type: 'ride', rideId, rideStatus }
    }

    return null
  }, [])

  const handleNotificationResponse = useCallback((data: Record<string, any>) => {
    handleWalletNotification(data)
    const action = getNotificationAction(data)
    if (!action) return

    if (lockedRef.current) {
      pendingNotificationActionRef.current = action
      return
    }

    runNotificationAction(action)
  }, [getNotificationAction, handleWalletNotification, runNotificationAction])

  const getInitialNotificationKey = (data: Record<string, any>) => JSON.stringify({
    campaign_id: data?.campaign_id,
    web_url: data?.web_url,
    cta_url: data?.cta_url,
    ride_id: data?.ride_id,
    ride_status: data?.ride_status,
  })

  // ─── Notification tap → navigate to ride screen or web page ───────────────
  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'student') return

    let cancelled = false
    const cleanup = addNotificationResponseListener(handleNotificationResponse)

    getLastNotificationResponseData()
      .then((data) => {
        if (cancelled || !data) return
        const key = getInitialNotificationKey(data)
        if (lastInitialNotificationKeyRef.current === key) return
        lastInitialNotificationKeyRef.current = key
        handleNotificationResponse(data)
      })
      .catch(() => null)

    return () => {
      cancelled = true
      cleanup()
    }
  }, [handleNotificationResponse, isAuthenticated, user?.id, user?.role])

  useEffect(() => {
    if (!isAuthenticated || locked) return
    const action = pendingNotificationActionRef.current
    if (!action) return
    pendingNotificationActionRef.current = null
    runNotificationAction(action)
  }, [isAuthenticated, locked, runNotificationAction])


  useEffect(() => {
    if (!isAuthenticated || locked) return
    const cleanup = addNotificationReceivedListener((data) => {
      handleWalletNotification(data)
    })
    return cleanup
  }, [isAuthenticated, locked, handleWalletNotification])

  // ─── Poll unread notification count ─────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    let isMounted = true
    const fetchCount = () => {
      api.get('notifications/unread-count/').then((r) => {
        if (isMounted && typeof r.data?.unread_count === 'number') setUnreadCount(r.data.unread_count)
      }).catch(() => { })
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [isAuthenticated])

  useEffect(() => {
    if (pinRecoveryRequired && locked) setLocked(false)
  }, [pinRecoveryRequired, locked, setLocked])

  // Store latest state in refs for BackHandler to avoid re-attaching and stealing the top of the stack
  const backStateRef = useRef({ activeTab, accountMode, rideScreen, isSidebarOpen })
  useEffect(() => {
    backStateRef.current = { activeTab, accountMode, rideScreen, isSidebarOpen }
  }, [activeTab, accountMode, rideScreen, isSidebarOpen])

  // ─── Hardware back button ────────────────────────────────────────────────
  useEffect(() => {
    const handleBackPress = () => {
      const state = backStateRef.current
      // Close ride overlay screens on back press
      if (state.rideScreen !== 'none') {
        setRideScreen('none')
        return true
      }
      if (state.isSidebarOpen) { setIsSidebarOpen(false); return true }
      if (state.accountMode !== 'view') { setAccountMode('view'); return true }
      if (state.activeTab !== 'home') { setActiveTab('home'); return true }
      const now = Date.now()
      if (now - lastBackPressAt.current < 1500) return false
      lastBackPressAt.current = now
      return true
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress)
    return () => sub.remove()
  }, [])

  // ─── Guards ───────────────────────────────────────────────────────────────
  // Wait for Zustand rehydration + SecureStore token load before rendering
  if (!hasHydrated || !tokensLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#6A1B9A" />
      </View>
    )
  }

  // Handle 14-day session expiry limit
  if (isAuthenticated && isSessionExpired?.()) {
    // We defer the state update slightly to avoid rendering issues
    setTimeout(() => {
      void logoutStudentSession()
    }, 0)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#6A1B9A" />
      </View>
    )
  }

  if (!isAuthenticated || !user) return <StudentLoginScreen />
  if (user.role !== 'student') return <View style={{ flex: 1 }}><StudentLoginScreen /></View>

  if (appLockEnabled && locked && !pinRecoveryRequired) {
    return (
      <AppLockPage
        onUnlocked={() => {
          // Note: kickoffProactiveRefresh() is called inside AppLockPage
          // BEFORE onUnlocked fires, so the refresh mutex is already primed
          // when these state updates trigger screen re-renders.
          setLocked(false)
          setLastUnlockAt(Date.now())
          void saveStudentSessionSnapshotFromStores()
          // Do NOT call syncSession() here — it reads from Zustand (null on boot).
          // The 401 interceptor handles stale tokens transparently.
        }}
        onForgotPin={() => {
          setPinRecoveryRequired(true)
          setLocked(false)
          void logoutStudentSession()
        }}
      />
    )
  }

  // ─── Ride overlay screens (user opens via button, can back out freely) ────
  // These render INSTEAD of the main shell only when the user explicitly
  // taps "Book Ride" or "Ride Status". Back button returns to normal app.
  const renderRideOverlay = () => {
    if (rideScreen === 'booking') {
      return (
        <BookRidePage
          onClose={() => {
            setRideScreen('none')
          }}
          onRideCreated={(rideId) => {
            setActiveRideId(rideId)
            setActiveRideSummary({ id: rideId, status: 'searching' })
            setRideScreen('matching')
          }}
        />
      )
    }

    if (rideScreen === 'matching') {
      return (
        <RideMatchingPage
          rideId={activeRideId}
          onBack={() => {
            // Back = return to normal app. Ride still tracked in background.
            setRideScreen('none')
          }}
          onMatched={() => {
            // Driver accepted — switch to active ride screen, no reload
            setRideScreen('active')
            setActiveRideSummary((prev) => prev ? { ...prev, status: 'driver_assigned' } : null)
          }}
          onCancelled={() => {
            // Student cancelled the ride — clear everything
            setActiveRideId(null)
            setActiveRideSummary(null)
            setRideScreen('none')
          }}
        />
      )
    }

    if (rideScreen === 'active') {
      return (
        <ActiveRidePage
          rideId={activeRideId}
          onBack={() => {
            // Back = return to normal app. Ride still tracked in background.
            setRideScreen('none')
          }}
          onRideEnded={() => {
            // Ride completed or cancelled — clear ride state
            setActiveRideId(null)
            setActiveRideSummary(null)
            setRideScreen('none')
          }}
        />
      )
    }

    if (rideScreen === 'garage' && garageQrToken) {
      return (
        <GarageRidePage
          qrToken={garageQrToken}
          onClose={() => setRideScreen('none')}
          onBoarded={() => {
            // Optionally, we could show a list of boarded garage rides somewhere, 
            // but for now returning to dashboard is fine.
            setRideScreen('none')
          }}
        />
      )
    }
    return null
  }

  const showTransactionPinRequired = () => {
    Alert.alert(
      'Transaction PIN Required',
      'Please set up a Transaction PIN in Security settings before you can book rides or access your wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Setup PIN', onPress: () => {
          setActiveTab('account')
          setAccountMode('security')
        }}
      ]
    )
  }

  const handleRequireSecurity = (onSuccess: () => void) => {
    if (transactionPinStatus === 'ready') {
      if (hasTransactionPin) {
        onSuccess()
      } else {
        showTransactionPinRequired()
      }
      return
    }

    setTransactionPinGateLoading(true)
    refreshTransactionPinStatus()
      .then((hasPin) => {
        if (hasPin) {
          onSuccess()
        } else {
          showTransactionPinRequired()
        }
      })
      .catch(() => {
        Alert.alert(
          'Connection Required',
          'Unable to confirm your Transaction PIN status. Please check your internet connection and try again.',
        )
      })
      .finally(() => {
        setTransactionPinGateLoading(false)
      })
  }

  // ─── Main app shell (always accessible) ───────────────────────────────────
  const renderTabPage = () => (
    <View style={{ flex: 1, position: 'relative' }}>
      <View style={{ display: activeTab === 'home' ? 'flex' : 'none', flex: 1 }}>
        <StudentDashboardScreen
          onNavigateToWallet={() => handleRequireSecurity(() => setActiveTab('wallet'))}
          onBookRide={() => handleRequireSecurity(() => setRideScreen('booking'))}
          onViewRideStatus={() => {
            if (!activeRideSummary) return
            setActiveRideId(activeRideSummary.id)
            if (MATCHING_STATUSES.includes(activeRideSummary.status)) {
              setRideScreen('matching')
            } else {
              setRideScreen('active')
            }
          }}
          onQrScanned={(token) => {
            setGarageQrToken(token)
            setRideScreen('garage')
          }}
          activeRide={activeRideSummary}
        />
      </View>

      <View style={{ display: activeTab === 'rides' ? 'flex' : 'none', flex: 1 }}>
        <StudentRidesPage isActive={activeTab === 'rides'} deepLinkShareCode={deepLinkShareCode} onDeepLinkConsumed={() => setDeepLinkShareCode(null)} />
      </View>

      <View style={{ display: activeTab === 'wallet' ? 'flex' : 'none', flex: 1 }}>
        <StudentWalletPage 
          onNavigateToMap={() => setActiveTab('home')} 
          onDisputeTransaction={(tx) => {
            setDisputeTx(tx)
            setActiveTab('support')
          }}
        />
      </View>

      {activeTab === 'account' && accountMode === 'edit' && (
        <StudentEditProfilePage
          onClose={() => setAccountMode('view')}
          onSaved={() => { setAccountMode('view'); setAccountRefreshKey((p) => p + 1) }}
        />
      )}
      {activeTab === 'account' && accountMode === 'notifications' && (
        <StudentNotificationSettingsPage
          onClose={() => setAccountMode('view')}
        />
      )}
      {activeTab === 'account' && accountMode === 'security' && (
        <SecurityPage
          onClose={() => { setAccountMode('view'); setOpenPinOnLoad(false); setSkipPinVerify(false) }}
          openPinOnLoad={openPinOnLoad}
          skipCurrentPin={skipPinVerify}
        />
      )}
      {activeTab === 'account' && accountMode === 'settings' && (
        <SettingsPage
          onClose={() => setAccountMode('view')}
        />
      )}
      {activeTab === 'account' && accountMode === 'view' && (
        <StudentAccountPage
          onEditProfile={() => setAccountMode('edit')}
          onOpenNotifications={() => setAccountMode('notifications')}
          onOpenSettings={() => setAccountMode('settings')}
          onOpenSecurity={() => setAccountMode('security')}
          onLogout={() => {
            void logoutStudentSession()
          }}
          refreshKey={accountRefreshKey}
        />
      )}
      
      {/* Sidebar Pages */}
      {activeTab === 'about' && <AboutPage />}
      {activeTab === 'activities' && <ActivitiesPage />}
      {activeTab === 'updates' && <UpdatesPage />}
      {activeTab === 'events' && <EventsPage />}
      {activeTab === 'news' && <NewsPage />}
      {activeTab === 'safety' && <SafetyGuidePage />}
      {activeTab === 'support' && (
        <SupportPage 
          initialDisputeTx={disputeTx} 
          onClearDispute={() => setDisputeTx(null)} 
        />
      )}
    </View>
  )

  // ─── Generic In-App Web Page (opened by notifications or deep links) ───────
  const renderGenericWebPage = () => (
    <Modal
      visible={Boolean(webPage)}
      animationType="slide"
      onRequestClose={closWebPage}
      statusBarTranslucent
    >
      {webPage && (
        <GenericWebPage
          url={webPage.url}
          title={webPage.title}
          onClose={closWebPage}
        />
      )}
    </Modal>
  )

  return (
    <View style={{ flex: 1 }}>
      <StudentLayout
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'wallet') {
            handleRequireSecurity(() => setActiveTab(tab))
          } else {
            setActiveTab(tab)
          }
        }}
        onMenuPress={() => setIsSidebarOpen(true)}
        onBackPress={
          activeTab === 'account' && accountMode !== 'view' ? () => setAccountMode('view') :
          ['about', 'activities', 'updates', 'events', 'news', 'safety', 'support'].includes(activeTab) ? () => setActiveTab('home') : undefined
        }
        title={
          activeTab === 'account' && accountMode === 'edit' ? 'Edit Profile' :
          activeTab === 'account' && accountMode === 'settings' ? 'Settings' :
          activeTab === 'account' && accountMode === 'notifications' ? 'Notification Settings' :
          activeTab === 'account' && accountMode === 'security' ? 'Security' : undefined
        }
        onNotificationPress={() => setNotifHistoryOpen(true)}
        unreadCount={unreadCount}
      >
        {renderTabPage()}
      </StudentLayout>

      <Modal
        visible={notifHistoryOpen}
        animationType="slide"
        onRequestClose={() => setNotifHistoryOpen(false)}
      >
        <StudentNotificationsPage
          onClose={() => { setNotifHistoryOpen(false); setUnreadCount(0) }}
        />
      </Modal>

      {rideScreen !== 'none' && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 999, backgroundColor: '#f9f9f9' }]}>
          {renderRideOverlay()}
        </View>
      )}

      <Modal visible={isAuthenticated && Boolean(pinRecoveryRequired)} transparent animationType="fade">
        <View style={styles.recoveryBackdrop}>
          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryTitle}>Reset App PIN</Text>
            <Text style={styles.recoveryText}>
              You signed in with your password. Choose to update your PIN or disable it.
            </Text>
            <TouchableOpacity
              style={styles.recoveryPrimary}
              onPress={() => {
                setActiveTab('account')
                setOpenPinOnLoad(true)
                setSkipPinVerify(true)
                setAccountMode('security')
                setPinRecoveryRequired(false)
              }}
            >
              <Text style={styles.recoveryPrimaryText}>Change PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.recoverySecondary}
              onPress={async () => {
                await clearStoredPinHash()
                setHasPin(false)
                if (!biometricEnabled) setAppLockEnabled(false)
                setPinRecoveryRequired(false)
              }}
            >
              <Text style={styles.recoverySecondaryText}>Disable PIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StudentSidebar
        visible={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={(page) => { setIsSidebarOpen(false); setActiveTab(page) }}
      />

      <Modal
        visible={announcementGateVisible && !pendingAnnouncement}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => undefined}
      >
        <View style={styles.announcementGate}>
          <ActivityIndicator size="large" color="#6A1B9A" />
        </View>
      </Modal>

      <Modal
        visible={transactionPinGateLoading}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => undefined}
      >
        <View style={styles.securityGate}>
          <ActivityIndicator size="large" color="#6A1B9A" />
          <Text style={styles.securityGateText}>Checking Transaction PIN...</Text>
        </View>
      </Modal>

      <InAppAnnouncementModal
        visible={Boolean(pendingAnnouncement)}
        announcement={pendingAnnouncement}
        onDismiss={handleDismissAnnouncement}
      />

      {/* Generic in-app webview: opened from notifications or any link */}
      {renderGenericWebPage()}
    </View>
  )
}

const styles = StyleSheet.create({
  announcementGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  securityGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  securityGateText: {
    color: '#3d4a3e',
    fontSize: 13,
    fontWeight: '600',
  },
  recoveryBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  recoveryCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  recoveryTitle: { fontSize: 18, fontWeight: '700', color: '#1a1c1c' },
  recoveryText: { fontSize: 13, color: '#6b7280' },
  recoveryPrimary: {
    backgroundColor: '#6A1B9A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  recoveryPrimaryText: { color: '#ffffff', fontWeight: '700' },
  recoverySecondary: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  recoverySecondaryText: { color: '#6A1B9A', fontWeight: '600' },
})

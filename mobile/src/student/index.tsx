import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, BackHandler, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuthStore } from '../core/authStore'
import { useSecurityStore } from '../core/securityStore'
import { fetchCurrentUser, refreshSession } from '../core/session'
import { StudentLoginScreen, StudentDashboardScreen } from './screens'
import StudentRidesPage from './pages/RidesPage'
import StudentWalletPage from './pages/WalletPage'
import StudentAccountPage from './pages/AccountPage'
import StudentEditProfilePage from './pages/EditProfilePage'
import StudentNotificationsPage from './pages/NotificationsPage'
import StudentNotificationSettingsPage from './pages/NotificationSettingsPage'
import SecurityPage from './pages/SecurityPage'
import AppLockPage from './pages/AppLockPage'
import BookRidePage from './pages/BookRidePage'
import RideMatchingPage from './pages/RideMatchingPage'
import ActiveRidePage from './pages/ActiveRidePage'
import GarageRidePage from './pages/GarageRidePage'
import StudentLayout from './layout/StudentLayout'
import StudentSidebar from './components/StudentSidebar'
import type { StudentTab } from './types'
import { clearStoredPinHash } from '../core/security'
import api from '../core/api'
import { registerStudentPushToken, addNotificationResponseListener, addNotificationReceivedListener } from '../core/pushNotifications'
import useWalletStore from '../core/walletStore'

// Statuses where we show the matching (searching) screen
const MATCHING_STATUSES = ['requested', 'searching']

type RideScreen = 'none' | 'booking' | 'matching' | 'active' | 'garage'

export default function StudentApp() {
  const { isAuthenticated, user, refreshToken, setTokens, setUser, logout } = useAuthStore()
  const {
    appLockEnabled,
    biometricEnabled,
    hasPin,
    locked,
    lockTimeoutMinutes,
    lastUnlockAt,
    pinRecoveryRequired,
    setAppLockEnabled,
    setLocked,
    setLastUnlockAt,
    setHasPin,
    setPinRecoveryRequired,
  } = useSecurityStore()

  const [activeTab, setActiveTab] = useState<StudentTab>('home')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [accountMode, setAccountMode] = useState<'view' | 'edit' | 'notifications' | 'security'>('view')
  const [accountRefreshKey, setAccountRefreshKey] = useState(0)
  const [openPinOnLoad, setOpenPinOnLoad] = useState(false)
  const [skipPinVerify, setSkipPinVerify] = useState(false)
  const [notifHistoryOpen, setNotifHistoryOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const syncInFlight = useRef(false)
  const lastBackPressAt = useRef(0)
  const lastWalletSyncAt = useRef(0)
  const setWalletBalance = useWalletStore((state) => state.setWalletBalance)
  const syncWalletBalance = useWalletStore((state) => state.syncBalance)

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

  // Re-check whenever we return to the dashboard (ride screen becomes 'none')
  useEffect(() => {
    if (rideScreen === 'none' && isAuthenticated && !locked) {
      void checkActiveRide()
    }
  }, [rideScreen, isAuthenticated, locked, checkActiveRide])

  // ─── Session sync ─────────────────────────────────────────────────────────
  const syncSession = async () => {
    if (!refreshToken || syncInFlight.current) return
    syncInFlight.current = true
    try {
      const tokens = await refreshSession(refreshToken)
      if (tokens.access) {
        setTokens(tokens.access, tokens.refresh || refreshToken)
      }
      const profile = await fetchCurrentUser()
      if (profile) {
        setUser(profile)
        if (profile.wallet_balance !== undefined) {
          useWalletStore.getState().setWalletBalance(profile.wallet_balance)
        }
      }
    } catch {
      logout()
    } finally {
      syncInFlight.current = false
    }
  }

  // ─── App lock / timeout ───────────────────────────────────────────────────
  useEffect(() => {
    if (!appLockEnabled) return
    if (!hasPin && !biometricEnabled) { setAppLockEnabled(false); setLocked(false); return }
    if (!lastUnlockAt) { setLocked(true); return }
    if (lockTimeoutMinutes === 0) return
    if ((Date.now() - lastUnlockAt) / 60000 >= lockTimeoutMinutes) setLocked(true)
  }, [appLockEnabled, biometricEnabled, hasPin, lastUnlockAt, lockTimeoutMinutes, setAppLockEnabled, setLocked])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!appLockEnabled) return
      if (state === 'background' || state === 'inactive') { setLocked(true); return }
      if (state === 'active' && lockTimeoutMinutes !== 0 && lastUnlockAt) {
        if ((Date.now() - lastUnlockAt) / 60000 >= lockTimeoutMinutes) setLocked(true)
      }
    })
    return () => sub.remove()
  }, [appLockEnabled, lastUnlockAt, lockTimeoutMinutes, setLocked])

  useEffect(() => {
    if (!isAuthenticated || locked) return
    void syncSession()
  }, [isAuthenticated, locked])

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

  const handleWalletNotification = useCallback((data: Record<string, any>) => {
    if (!data) return
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
  }, [setWalletBalance, syncWalletBalance])

  // ─── Notification tap → navigate to ride screen ────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || locked) return
    const cleanup = addNotificationResponseListener((data) => {
      handleWalletNotification(data)
      const rideId = data?.ride_id as string | undefined
      const rideStatus = data?.ride_status as string | undefined
      if (rideId) {
        setActiveRideId(rideId)
        if (MATCHING_STATUSES.includes(rideStatus || '')) {
          setRideScreen('matching')
        } else {
          setRideScreen('active')
        }
      }
    })
    return cleanup
  }, [isAuthenticated, locked, handleWalletNotification])

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

  // ─── Hardware back button ────────────────────────────────────────────────
  useEffect(() => {
    const handleBackPress = () => {
      // Close ride overlay screens on back press
      if (rideScreen !== 'none') {
        setRideScreen('none')
        return true
      }
      if (isSidebarOpen) { setIsSidebarOpen(false); return true }
      if (accountMode !== 'view') { setAccountMode('view'); return true }
      if (activeTab !== 'home') { setActiveTab('home'); return true }
      const now = Date.now()
      if (now - lastBackPressAt.current < 1500) return false
      lastBackPressAt.current = now
      return true
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress)
    return () => sub.remove()
  }, [activeTab, accountMode, rideScreen, isSidebarOpen])

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (!isAuthenticated || !user) return <StudentLoginScreen />
  if (user.role !== 'student') return <View style={{ flex: 1 }}><StudentLoginScreen /></View>

  if (appLockEnabled && locked && !pinRecoveryRequired) {
    return (
      <AppLockPage
        onUnlocked={() => {
          setLocked(false)
          setLastUnlockAt(Date.now())
          void syncSession()
        }}
        onForgotPin={() => {
          setPinRecoveryRequired(true)
          setLocked(false)
          logout()
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

  // ─── Main app shell (always accessible) ───────────────────────────────────
  const renderTabPage = () => (
    <View style={{ flex: 1, position: 'relative' }}>
      <View style={{ display: activeTab === 'home' ? 'flex' : 'none', flex: 1 }}>
        <StudentDashboardScreen
          onNavigateToWallet={() => setActiveTab('wallet')}
          onBookRide={() => setRideScreen('booking')}
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
        <StudentRidesPage />
      </View>

      <View style={{ display: activeTab === 'wallet' ? 'flex' : 'none', flex: 1 }}>
        <StudentWalletPage />
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
      {activeTab === 'account' && accountMode === 'view' && (
        <StudentAccountPage
          onEditProfile={() => setAccountMode('edit')}
          onOpenNotifications={() => setAccountMode('notifications')}
          onOpenSecurity={() => setAccountMode('security')}
          onLogout={logout}
          refreshKey={accountRefreshKey}
        />
      )}
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
      <StudentLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onMenuPress={() => setIsSidebarOpen(true)}
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

      <Modal
        visible={rideScreen !== 'none'}
        animationType="slide"
        onRequestClose={() => setRideScreen('none')}
      >
        {renderRideOverlay()}
      </Modal>

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
        onLogout={() => { setIsSidebarOpen(false); logout() }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
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

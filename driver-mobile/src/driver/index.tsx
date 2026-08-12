import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, BackHandler, Platform, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuthStore } from '../core/authStore'
import { authApi, settingsApi, verificationApi, notificationsApi } from '../core/api'
import { COLORS, FONTS } from '../core/theme'
import { useSettingsStore } from '../core/settingsStore'
import { useAppLockStore } from '../core/appLockStore'
import {
  fetchDriverSessionSnapshot,
  getSessionErrorMessage,
  hydrateDriverSessionFromSandbox,
  kickoffProactiveRefresh,
  logoutDriverSession,
  prefetchDriverEssentials,
  refreshAndFetchDriverSession,
  refreshDriverSessionTokens,
  syncDriverSessionInBackground,
} from '../core/session'
import {
  saveDriverSessionSnapshotFromStores,
  saveOfflinePinVerifier,
  verifyOfflinePin,
} from '../core/driverSandbox'
import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  registerDriverPushToken,
  showRideStatusNotification,
  clearRideStatusNotification,
} from '../core/pushNotifications'
// Safe no-op – expo-task-manager isn't installed; prevents the old ReferenceError
const stopRideForegroundService = async () => { /* no-op */ }
import { useDriverWalletStore } from '../core/driverWalletStore'
import { useDriverRidesStore } from '../core/driverRidesStore'
import {
  getPendingInAppAnnouncement,
  markInAppAnnouncementSeen,
  type DriverInAppAnnouncement,
} from './services/inAppAnnouncement'
import LocationDataService from '../core/locationDataService'
import InAppAnnouncementModal from './components/InAppAnnouncementModal'
import DriverLoginScreen from './screens/LoginScreen'
import DriverDashboardScreen from './screens/DashboardScreen'
import AccountVerificationScreen from './screens/AccountVerificationScreen'
import VehicleVerificationScreen from './screens/VehicleVerificationScreen'
import DriverRidesPage from './pages/RidesPage'
import DriverWalletPage from './pages/WalletPage'
import DriverProfilePage from './pages/ProfilePage'
import EditProfilePage from './pages/EditProfilePage'
import AccountSettingsPage from './pages/AccountSettingsPage'
import DriverTransactionsPage from './pages/TransactionsPage'
import AppLockScreen from './screens/AppLockScreen'
import PinSetupScreen from './screens/PinSetupScreen'
import NotificationsPage from './pages/NotificationsPage'
import DriverLayout from './layout/DriverLayout'
import LoadingOverlay from './components/LoadingOverlay'
import type { DriverTab } from './types'

const WebViewScreen = lazy(() => import('./screens/WebViewScreen'))

type SubPage = null | 'settings' | 'edit-profile' | 'account-verification' | 'vehicle-verification' | 'verification-success' | 'webview' | 'notifications'

const GARAGE_STATUS_LABELS: Record<string, string> = {
  open: 'Accepting passengers',
  full: 'Full (ready to depart)',
  departed: 'Departed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default function DriverApp() {
  const {
    isAuthenticated,
    user,
    patchUser,
    hydrateTokens,
    hasHydrated: authHasHydrated,
    loginCompletedAt,
  } = useAuthStore()
  const { setSummary } = useDriverWalletStore()
  const { garageRide, garagePassengers, isOnline, offlineMode } = useDriverRidesStore()
  const { settings } = useSettingsStore()
  const {
    isLocked,
    lockTimeoutMinutes,
    setLocked,
    setUnlocked,
    reset: resetLock,
  } = useAppLockStore()
  const [activeTab, setActiveTab] = useState<DriverTab>('home')
  const [subPage, setSubPage] = useState<SubPage>(null)
  const [lockBusy, setLockBusy] = useState(false)
  const [sessionBooting, setSessionBooting] = useState(true)
  const [lockError, setLockError] = useState('')
  const [lockStatus, setLockStatus] = useState('')
  const [sessionWarning, setSessionWarning] = useState('')
  const [sessionRefreshing, setSessionRefreshing] = useState(false)
  const [pinSetupRequired, setPinSetupRequired] = useState(false)
  const [pendingAnnouncement, setPendingAnnouncement] = useState<DriverInAppAnnouncement | null>(null)
  const [requestedRidesFilter, setRequestedRidesFilter] = useState<string | null>(null)

  const hideTopBar = activeTab === 'rides' && !isOnline && offlineMode === 'scheduled';
  const [announcementGateVisible, setAnnouncementGateVisible] = useState(false)
  const [announcementRefreshKey, setAnnouncementRefreshKey] = useState(0)
  const [webviewUrl, setWebviewUrl] = useState('')
  const [webviewTitle, setWebviewTitle] = useState('')
  const announcementCheckRef = useRef<string | null>(null)
  const lastBackPressRef = useRef(0)
  const lastRideNotificationKey = useRef<string | null>(null)
  const rideClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Timestamp of when the app last left the foreground. Used to calculate
  // how long the user was actually away, so system dialogs (permissions,
  // notification shade, etc.) never trigger a lock.
  const wentBackgroundAtRef = useRef<number | null>(null)
  const sessionActive = isAuthenticated && user?.role === 'driver' && !isLocked && !pinSetupRequired

  const endDriverSession = () => {
    void logoutDriverSession()
    setPinSetupRequired(false)
    setLockError('')
    setLockStatus('')
    setSessionWarning('')
  }

  const completeUnlock = async () => {
    setUnlocked()
    setPinSetupRequired(false)
    setLockError('')
    setLockStatus('')
    setSessionWarning('')
    // Kick off a background token refresh so screens that mount immediately
    // after unlock queue on the in-flight promise via the 401 interceptor,
    // rather than hitting stale tokens and racing to refresh simultaneously.
    void kickoffProactiveRefresh()
    void saveDriverSessionSnapshotFromStores()
    void syncDriverSessionInBackground()
  }

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return
    }

    const onBackPress = () => {
      if (subPage) {
        setSubPage(null)
        return true
      }

      if (activeTab === 'transactions') {
        setActiveTab('wallet')
        return true
      }

      if (activeTab !== 'home') {
        setActiveTab('home')
        return true
      }

      const now = Date.now()
      if (now - lastBackPressRef.current < 1500) {
        return false
      }

      lastBackPressRef.current = now
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT)
      return true
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => subscription.remove()
  }, [activeTab, subPage])

  // Boot: hydrate cached driver data first; network sync happens silently after.
  useEffect(() => {
    if (!authHasHydrated) {
      return
    }

    if (!isAuthenticated || !user) {
      resetLock()
      setSessionBooting(false)
      setPinSetupRequired(false)
      return
    }

    let isMounted = true
    const bootLockedSession = async () => {
      setSessionBooting(true)
      setLockStatus('Preparing secure driver app...')
      setLockError('')
      setSessionWarning('')

      try {
        const justLoggedIn = Boolean(loginCompletedAt && Date.now() - loginCompletedAt < 10000)
        if (justLoggedIn) {
          const hasUnlockMethod = Boolean(settings.hasPin || settings.biometricEnabled)
          setPinSetupRequired(!hasUnlockMethod)
          setLocked(false)
          void syncDriverSessionInBackground()
          return
        }

        await hydrateTokens()
        const localSnapshot = await hydrateDriverSessionFromSandbox(user.id)
        if (!isMounted) return

        const localSettings = localSnapshot?.settings || settings
        const hasUnlockMethod = Boolean(localSettings.hasPin || localSettings.biometricEnabled)
        setPinSetupRequired(!hasUnlockMethod)

        setLocked(true)

        if (localSnapshot) {
          void syncDriverSessionInBackground().then((ok) => {
            if (!ok && isMounted) {
              setSessionWarning('You appear to be offline.')
            }
          })
          return
        }

        // Empty cache: first install / legacy session. This is the one boot path
        // allowed to block while we build the local sandbox.
        setLockStatus('Building secure offline cache...')
        const snapshot = await refreshAndFetchDriverSession()
        await prefetchDriverEssentials()
        await saveDriverSessionSnapshotFromStores()
        if (!isMounted) return

        const hasRemoteUnlockMethod = Boolean(snapshot.settings.has_pin || snapshot.settings.biometric_enabled)
        setPinSetupRequired(!hasRemoteUnlockMethod)
      } catch (error) {
        if (!isMounted) return
        setPinSetupRequired(false)
        setLockError(getSessionErrorMessage(error, 'Unable to verify your saved driver session.'))
      } finally {
        if (isMounted) {
          setLockStatus('')
          setSessionBooting(false)
        }
      }
    }

    void bootLockedSession()
    return () => {
      isMounted = false
    }
  }, [
    authHasHydrated,
    hydrateTokens,
    isAuthenticated,
    loginCompletedAt,
    resetLock,
    setLocked,
    user?.id,
  ])

  // AppState: the lock timer only counts while the app is actually backgrounded.
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'driver') {
      return
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        if (wentBackgroundAtRef.current === null) {
          wentBackgroundAtRef.current = Date.now()
        }
        return
      }

      if (nextState !== 'active') {
        return
      }

      setAnnouncementRefreshKey((value) => value + 1)

      const leftAt = wentBackgroundAtRef.current
      wentBackgroundAtRef.current = null

      if (!sessionActive || !leftAt) {
        if (sessionActive) {
          void syncDriverSessionInBackground().then((ok) => {
            if (ok) setSessionWarning('')
            else setSessionWarning('You appear to be offline.')
          })
        }
        return
      }

      // Safety: never lock if the driver has no unlock method (PIN or biometric).
      // This prevents a state where the user is stuck behind the lock screen with
      // no way to get back in.
      const hasUnlockMethod = settings.hasPin || settings.biometricEnabled

      // -1 means "None" (auto-lock disabled) – always return seamlessly.
      if (lockTimeoutMinutes === -1 || !hasUnlockMethod) {
        void syncDriverSessionInBackground().then((ok) => {
          if (ok) setSessionWarning('')
          else setSessionWarning('You appear to be offline.')
        })
        return
      }

      const awayMs = Date.now() - leftAt

      // 0 = Immediate: lock as soon as the app comes back from background.
      if (lockTimeoutMinutes === 0) {
        setLocked(true)
        setLockStatus('Unlock the app to continue.')
        return
      }

      const timeoutMs = Math.min(lockTimeoutMinutes, 30) * 60 * 1000
      if (awayMs >= timeoutMs) {
        setLocked(true)
        setLockStatus('Unlock the app to continue.')
        return
      }

      // Returned before timeout: reset the background clock and sync quietly.
      setUnlocked()
      void syncDriverSessionInBackground().then((ok) => {
        if (ok) setSessionWarning('')
        else setSessionWarning('You appear to be offline.')
      })
    })

    return () => subscription.remove()
  }, [isAuthenticated, lockTimeoutMinutes, sessionActive, setLocked, setUnlocked, settings.biometricEnabled, settings.hasPin, user?.role])

  useEffect(() => {
    if (!sessionActive || !settings.pushEnabled) {
      if (sessionActive) {
        authApi.updateMe({ fcm_token: null }).catch(() => null)
      }
      return
    }

    let isMounted = true
    registerDriverPushToken(user?.fcm_token)
      .then((token) => {
        if (!isMounted || !token) {
          return
        }
        return authApi.updateMe({ fcm_token: token })
      })
      .catch(() => null)
    return () => {
      isMounted = false
    }
  }, [sessionActive, settings.pushEnabled, user?.fcm_token])

  const handleWalletNotification = (data: Record<string, any>) => {
    if (!data) return
    const balance = data.wallet_balance
    if (balance !== undefined && balance !== null) {
      patchUser({ wallet_balance: String(balance) })
      const current = useDriverWalletStore.getState().summary
      if (current) {
        setSummary({
          ...current,
          wallet_balance: String(balance),
        })
      }
      return
    }
  }

  useEffect(() => {
    if (!sessionActive) return
    const cleanup = addNotificationResponseListener((data) => {
      handleWalletNotification(data)
      const rideId = data?.ride_id as string | undefined
      const garageRideId = data?.garage_ride_id as string | undefined
      if (rideId || garageRideId) {
        setActiveTab('rides')
        setSubPage(null)
        return
      }
      const isWalletEvent = Boolean(
        data?.wallet_balance !== undefined ||
        data?.transaction_id ||
        data?.reference
      )
      if (isWalletEvent) {
        setActiveTab('wallet')
        setSubPage(null)
      }
    })
    return cleanup
  }, [sessionActive])

  useEffect(() => {
    if (!sessionActive) return
    const cleanup = addNotificationReceivedListener((data) => {
      handleWalletNotification(data)
    })
    return cleanup
  }, [sessionActive])

  useEffect(() => {
    if (rideClearTimer.current) {
      clearTimeout(rideClearTimer.current)
      rideClearTimer.current = null
    }

    if (!sessionActive || !garageRide) {
      lastRideNotificationKey.current = null
      void clearRideStatusNotification()
      return
    }

    const status = String(garageRide.status || 'open')
    const isActive = ['open', 'full', 'departed'].includes(status)
    const booked = Number(garageRide.booked_seats || 0)
    const total = Number(garageRide.total_seats || 0)
    const statusLabel = GARAGE_STATUS_LABELS[status] || 'Ride update'
    const message = `Garage ride: ${booked}/${total} seats booked • ${statusLabel}`
    const key = `${garageRide.id}:${status}:${booked}:${total}`

    if (key === lastRideNotificationKey.current) return
    lastRideNotificationKey.current = key

    void showRideStatusNotification(
      'Active garage ride',
      message,
      {
        garage_ride_id: String(garageRide.id || ''),
        garage_status: status,
        seats_booked: String(booked),
        total_seats: String(total),
      },
      'driver-ride-status',
      { sticky: isActive, silent: false },
    )

    if (!isActive) {
      rideClearTimer.current = setTimeout(() => {
        void clearRideStatusNotification()
      }, 1500)
    }
  }, [garageRide, garagePassengers.length, sessionActive])

  // ——— Map Locations Initialization —————————————————————————————————————————————
  useEffect(() => {
    if (!sessionActive) return
    void LocationDataService.initialize()
  }, [sessionActive])

  // ——— In-App Announcements —————————————————————————————————————————————————————
  useEffect(() => {
    if (!sessionActive || !user) return

    const checkAnnouncements = async () => {
      // Prevent overlapping checks
      const checkId = Math.random().toString(36).slice(2)
      announcementCheckRef.current = checkId

      const announcement = await getPendingInAppAnnouncement(user.id)
      
      // If a newer check started, abandon this one
      if (announcementCheckRef.current !== checkId) return

      if (announcement) {
        setPendingAnnouncement(announcement)
        setAnnouncementGateVisible(true)
      }
    }

    void checkAnnouncements()
  }, [sessionActive, user, announcementRefreshKey])

  const handleDismissAnnouncement = async () => {
    setAnnouncementGateVisible(false)
    if (user && pendingAnnouncement) {
      await markInAppAnnouncementSeen(user.id, pendingAnnouncement.campaignId)
    }
  }

  // Fetch verification progress for the banner
  const { data: progressData } = useQuery({
    queryKey: ['verification-progress'],
    queryFn: () => verificationApi.getProgress().then(r => r.data),
    enabled: sessionActive,
    staleTime: 30000,
  })

  // Fetch unread notifications count
  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r: any) => r.data),
    enabled: sessionActive,
    refetchInterval: 60000, // Poll every minute
  })
  const hasUnreadNotifications = (unreadCountData?.count || 0) > 0

  const handleRetrySecureSession = async () => {
    setLockBusy(true)
    setLockError('')
    setLockStatus('Connecting to LR Ride...')
    try {
      await hydrateTokens()
      const snapshot = await refreshAndFetchDriverSession()
      await prefetchDriverEssentials()
      await saveDriverSessionSnapshotFromStores()
      const hasUnlockMethod = Boolean(snapshot.settings.has_pin || snapshot.settings.biometric_enabled)
      setPinSetupRequired(!hasUnlockMethod)
      setLocked(true)
      setLockError('')
    } catch (error) {
      setLockError(getSessionErrorMessage(error, 'Unable to verify your driver session.'))
    } finally {
      setLockStatus('')
      setLockBusy(false)
    }
  }

  const handleRefreshCachedSession = async () => {
    if (sessionRefreshing) return
    setSessionRefreshing(true)
    setSessionWarning('')
    try {
      await hydrateTokens()
      await refreshAndFetchDriverSession()
      await prefetchDriverEssentials()
      await saveDriverSessionSnapshotFromStores()
    } catch (error) {
      setSessionWarning('You appear to be offline.')
    } finally {
      setSessionRefreshing(false)
    }
  }

  const handleUnlockPin = async (pin: string) => {
    if (!pin) {
      setLockError('Enter your PIN to unlock.')
      return
    }

    setLockBusy(true)
    setLockError('')
    setLockStatus('Verifying PIN...')
    try {
      const localResult = await verifyOfflinePin(pin, user?.id)
      if (localResult === 'matched') {
        await completeUnlock()
        return
      }

      if (localResult === 'mismatch') {
        setLockError('PIN is incorrect.')
        return
      }

      setLockStatus('Verifying PIN online once...')
      void kickoffProactiveRefresh()
      const pinResponse = await settingsApi.verifyPin({ pin })
      await saveOfflinePinVerifier(pinResponse.data?.offline_pin_verifier)
      const snapshot = await fetchDriverSessionSnapshot()
      const hasUnlockMethod = Boolean(snapshot.settings.has_pin || snapshot.settings.biometric_enabled)

      if (!hasUnlockMethod) {
        setPinSetupRequired(true)
        setLocked(true)
        return
      }

      await completeUnlock()
    } catch (error) {
      setLockError(getSessionErrorMessage(error, 'Invalid PIN or unable to unlock. Please try again.'))
    } finally {
      setLockStatus('')
      setLockBusy(false)
    }
  }

  const handleUnlockBiometric = async () => {
    setLockError('')
    try {
      const LocalAuth = await import('expo-local-authentication')
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Unlock LR Ride Driver',
        fallbackLabel: settings.hasPin ? 'Use PIN' : undefined,
      })

      if (!result.success) {
        return
      }
    } catch {
      setLockError('Biometric unlock is not available on this device.')
      return
    }

    setLockBusy(true)
    setLockStatus('Unlocking...')
    try {
      await completeUnlock()
    } catch (error) {
      setLockError(getSessionErrorMessage(error, 'Unable to unlock with biometrics.'))
    } finally {
      setLockStatus('')
      setLockBusy(false)
    }
  }

  const handleSetRequiredPin = async (pin: string) => {
    setLockBusy(true)
    setLockError('')
    try {
      await refreshDriverSessionTokens()
      const pinResponse = await settingsApi.setPin({ new_pin: pin })
      await saveOfflinePinVerifier(pinResponse.data?.offline_pin_verifier)
      await fetchDriverSessionSnapshot()
      await completeUnlock()
    } catch (error) {
      setLockError(getSessionErrorMessage(error, 'Unable to save PIN. Please try again.'))
    } finally {
      setLockBusy(false)
    }
  }

  if (!authHasHydrated || sessionBooting) {
    return (
      <SafeAreaProvider>
        <LoadingOverlay 
          visible={true} 
          message={lockStatus || 'Preparing secure driver app...'} 
        />
      </SafeAreaProvider>
    )
  }

  if (!isAuthenticated || !user) {
    if (Platform.OS === 'android') {
      void stopRideForegroundService()
    }
    return (
      <SafeAreaProvider>
        <DriverLoginScreen />
      </SafeAreaProvider>
    )
  }

  if (user.role !== 'driver') {
    return (
      <SafeAreaProvider>
        <DriverLoginScreen />
      </SafeAreaProvider>
    )
  }

  if (pinSetupRequired) {
    return (
      <SafeAreaProvider>
        <PinSetupScreen
          busy={lockBusy}
          errorMessage={lockError}
          onSetPin={handleSetRequiredPin}
          onLogout={endDriverSession}
        />
      </SafeAreaProvider>
    )
  }

  if (isLocked) {
    return (
      <SafeAreaProvider>
        <AppLockScreen
          hasPin={settings.hasPin}
          biometricEnabled={settings.biometricEnabled}
          busy={lockBusy}
          errorMessage={lockError}
          statusMessage={lockStatus || 'Unlock to continue.'}
          onUnlockPin={handleUnlockPin}
          onUnlockBiometric={handleUnlockBiometric}
          onRetry={handleRetrySecureSession}
          onLogout={endDriverSession}
        />
      </SafeAreaProvider>
    )
  }

  // ——— Sub-page rendering (full screen, no layout) —————————————————————————————————————————————————————
  if (subPage && subPage !== 'webview') {
    return (
      <SafeAreaProvider>
        {(() => {
          switch (subPage) {
            case 'settings':
              return (
                <AccountSettingsPage
                  onBack={() => setSubPage(null)}
                  onLogout={endDriverSession}
                  verificationProgress={progressData}
                  onStartAccountVerification={() => setSubPage('account-verification')}
                  onStartVehicleVerification={() => setSubPage('vehicle-verification')}
                />
              )
            case 'edit-profile': return <EditProfilePage onBack={() => setSubPage(null)} />
            case 'account-verification':
              return (
                <AccountVerificationScreen
                  onBack={() => setSubPage(null)}
                  onSuccess={() => setSubPage('verification-success')}
                />
              )
            case 'vehicle-verification':
              return (
                <VehicleVerificationScreen
                  onBack={() => setSubPage(null)}
                  onAllUploaded={() => setSubPage('verification-success')}
                />
              )
            case 'verification-success':
              return <VerificationSuccessScreen onContinue={() => setSubPage(null)} />
            case 'notifications': return <NotificationsPage onBack={() => setSubPage(null)} />
            default: return null
          }
        })()}
      </SafeAreaProvider>
    )
  }

  // ——— Compute verification state for banner —————————————————————————————————————————————————————
  const accountStatus = progressData?.account_verification?.status ?? null
  const vehicleDocs = progressData?.vehicle_documents ?? []
  const allVehicleApproved = vehicleDocs.length > 0 &&
    vehicleDocs.every((d: any) => d.status === 'approved')

  const getBannerConfig = () => {
    if (!accountStatus) {
      return {
        label: 'Complete Account Verification to start accepting rides',
        cta: 'Start Now',
        action: () => setSubPage('account-verification'),
        color: '#F57F17',
        bg: '#FFF8E1',
        icon: 'account-circle' as const,
      }
    }
    if (accountStatus === 'pending' || accountStatus === 'under_review') {
      return {
        label: 'Account verification is under review by campus admin.',
        cta: null,
        action: null,
        color: '#1565C0',
        bg: '#E3F2FD',
        icon: 'hourglass-top' as const,
      }
    }
    if (accountStatus === 'rejected') {
      return {
        label: 'Account verification was rejected. Please resubmit.',
        cta: 'Resubmit',
        action: () => setSubPage('account-verification'),
        color: '#B71C1C',
        bg: '#FFEBEE',
        icon: 'error' as const,
      }
    }
    if (accountStatus === 'approved' && !allVehicleApproved) {
      return {
        label: 'Account verified! Now upload your vehicle documents.',
        cta: 'Upload Docs',
        action: () => setSubPage('vehicle-verification'),
        color: '#2E7D32',
        bg: '#E8F5E9',
        icon: 'directions-car' as const,
      }
    }
    return null // Fully verified — no banner
  }

  const banner = getBannerConfig()

  const handleCreateGarageRide = () => {
    if (sessionWarning) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Internet is required for live driver actions.', ToastAndroid.SHORT)
      }
      return
    }
    setRequestedRidesFilter('Garage')
    setActiveTab('rides')
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'home':  return <DriverDashboardScreen onCreateGarageRide={handleCreateGarageRide} onNavigateToRide={() => setActiveTab('rides')} />
      case 'rides': return <DriverRidesPage />
      case 'wallet': return <DriverWalletPage onNavigateToAllTransactions={() => setActiveTab('transactions')} />
      case 'transactions': return <DriverTransactionsPage />
      case 'profile':
        return (
          <DriverProfilePage
            onNavigateToSettings={() => setSubPage('settings')}
            onEditProfile={() => setSubPage('edit-profile')}
          />
        )
      default: return <DriverDashboardScreen onNavigateToRide={() => setActiveTab('rides')} />
    }
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <DriverLayout 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          onLogout={endDriverSession}
          hideTopBar={hideTopBar}
          onOpenWebLink={(url, title) => {
            setWebviewUrl(url)
            setWebviewTitle(title)
            setSubPage('webview')
          }}
          onOpenNotifications={() => setSubPage('notifications')}
          hasUnreadNotifications={hasUnreadNotifications}
          title={activeTab === 'transactions' ? 'All Transactions' : undefined}
          onBack={activeTab === 'transactions' ? () => setActiveTab('wallet') : undefined}
        >
          {sessionWarning ? (
            <View style={s.sessionWarning}>
              <MaterialIcons name="wifi-off" size={16} color="#B45309" />
              <Text style={s.sessionWarningText}>{sessionWarning}</Text>
              <TouchableOpacity
                style={s.sessionRefreshBtn}
                onPress={handleRefreshCachedSession}
                disabled={sessionRefreshing}
                activeOpacity={0.85}
              >
                {sessionRefreshing ? (
                  <ActivityIndicator size="small" color="#92400E" />
                ) : (
                  <>
                    <MaterialIcons name="refresh" size={14} color="#92400E" />
                    <Text style={s.sessionRefreshText}>Refresh</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
          {/* All tab screens stay mounted to preserve state (esp. MapView).
              Inactive tabs are hidden via opacity/pointerEvents for home to prevent MapView unmounting. */}
          <View style={activeTab === 'home' ? { flex: 1 } : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: -1 }} pointerEvents={activeTab === 'home' ? 'auto' : 'none'}>
            <DriverDashboardScreen onCreateGarageRide={handleCreateGarageRide} onNavigateToRide={() => setActiveTab('rides')} />
          </View>
          <View style={activeTab === 'rides' ? { flex: 1 } : { display: 'none' }}>
            <DriverRidesPage onBack={() => setActiveTab('home')} requestedFilter={requestedRidesFilter} onFilterConsumed={() => setRequestedRidesFilter(null)} />
          </View>
          <View style={activeTab === 'wallet' ? { flex: 1 } : { display: 'none' }}>
            <DriverWalletPage onNavigateToAllTransactions={() => setActiveTab('transactions')} />
          </View>
          {activeTab === 'transactions' && <DriverTransactionsPage />}
          <View style={activeTab === 'profile' ? { flex: 1 } : { display: 'none' }}>
            <DriverProfilePage
              onNavigateToSettings={() => setSubPage('settings')}
              onEditProfile={() => setSubPage('edit-profile')}
            />
          </View>
          <InAppAnnouncementModal
            announcement={pendingAnnouncement}
            visible={announcementGateVisible}
            onDismiss={handleDismissAnnouncement}
          />
        </DriverLayout>

        {subPage === 'webview' && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: COLORS.background }}>
            <Suspense fallback={<WebViewLoadingScreen />}>
              <WebViewScreen
                url={webviewUrl}
                title={webviewTitle}
                onClose={() => {
                  setSubPage(null)
                  setWebviewUrl('')
                  setWebviewTitle('')
                }}
              />
            </Suspense>
          </View>
        )}
      </View>
    </SafeAreaProvider>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Verification Success Screen Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function WebViewLoadingScreen() {
  return (
    <View style={s.webviewLoadingRoot}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  )
}

function VerificationSuccessScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={s.successRoot}>
      <MaterialIcons name="check-circle" size={80} color={COLORS.primaryContainer} />
      <Text style={[FONTS.headlineXl, { color: COLORS.onSurface, textAlign: 'center', marginTop: 24 }]}>
        Submitted!
      </Text>
      <Text style={[FONTS.bodyLg, { color: COLORS.onSurfaceVariant, textAlign: 'center', marginTop: 12, paddingHorizontal: 32 }]}>
        Your documents are under review. You'll be notified once a campus admin processes your application.
      </Text>
      <TouchableOpacity style={s.successBtn} onPress={onContinue}>
        <Text style={[FONTS.labelLg, { color: COLORS.onPrimary }]}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  )
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Styles Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const s = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  loadingText: {
    ...FONTS.bodySm,
    color: COLORS.tertiary,
    textAlign: 'center',
  },
  webviewLoadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  sessionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sessionWarningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  sessionRefreshBtn: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sessionRefreshText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  bannerCta: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  bannerCtaText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  successRoot: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, padding: 32,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  successBtn: {
    marginTop: 40, backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 48, paddingVertical: 16, borderRadius: 12,
  },
})

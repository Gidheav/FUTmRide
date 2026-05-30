import { useEffect, useRef, useState } from 'react'
import { Alert, AppState, BackHandler, Platform, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuthStore } from '../core/authStore'
import { authApi, settingsApi, verificationApi } from '../core/api'
import { COLORS, FONTS } from '../core/theme'
import { useSettingsStore } from '../core/settingsStore'
import { useAppLockStore } from '../core/appLockStore'
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
import DriverLoginScreen from './screens/LoginScreen'
import DriverDashboardScreen from './screens/DashboardScreen'
import AccountVerificationScreen from './screens/AccountVerificationScreen'
import VehicleVerificationScreen from './screens/VehicleVerificationScreen'
import DriverRidesPage from './pages/RidesPage'
import DriverWalletPage from './pages/WalletPage'
import DriverProfilePage from './pages/ProfilePage'
import EditProfilePage from './pages/EditProfilePage'
import AccountSettingsPage from './pages/AccountSettingsPage'
import CreateGarageRideScreen from './screens/CreateGarageRideScreen'
import AppLockScreen from './screens/AppLockScreen'
import DriverLayout from './layout/DriverLayout'
import type { DriverTab } from './types'

type SubPage = null | 'settings' | 'edit-profile' | 'account-verification' | 'vehicle-verification' | 'verification-success' | 'garage-ride'

const GARAGE_STATUS_LABELS: Record<string, string> = {
  open: 'Accepting passengers',
  full: 'Full (ready to depart)',
  departed: 'Departed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default function DriverApp() {
  const { isAuthenticated, user, logout, patchUser } = useAuthStore()
  const { setSummary } = useDriverWalletStore()
  const { garageRide, garagePassengers } = useDriverRidesStore()
  const { settings, hydrateFromApi } = useSettingsStore()
  const { isLocked, setLocked, setUnlocked, reset: resetLock } = useAppLockStore()
  const [activeTab, setActiveTab] = useState<DriverTab>('home')
  const [subPage, setSubPage] = useState<SubPage>(null)
  const [lockBusy, setLockBusy] = useState(false)
  const lastBackPressRef = useRef(0)
  const lastRideNotificationKey = useRef<string | null>(null)
  const rideClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return
    }

    const onBackPress = () => {
      if (subPage) {
        setSubPage(null)
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

  useEffect(() => {
    if (!isAuthenticated) {
      resetLock()
      return
    }
    settingsApi
      .getPreferences()
      .then((res) => {
        if (res?.data) {
          hydrateFromApi(res.data)
        }
      })
      .catch(() => null)
  }, [hydrateFromApi, isAuthenticated, resetLock])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (settings.biometricEnabled || settings.hasPin) {
          setLocked(true)
        }
      }
    })
    return () => subscription.remove()
  }, [isAuthenticated, setLocked, settings.biometricEnabled, settings.hasPin])

  useEffect(() => {
    if (!isAuthenticated || !settings.pushEnabled) {
      if (isAuthenticated) {
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
  }, [isAuthenticated, settings.pushEnabled, user?.fcm_token])

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
    if (!isAuthenticated) return
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
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const cleanup = addNotificationReceivedListener((data) => {
      handleWalletNotification(data)
    })
    return cleanup
  }, [isAuthenticated])

  useEffect(() => {
    if (rideClearTimer.current) {
      clearTimeout(rideClearTimer.current)
      rideClearTimer.current = null
    }

    if (!garageRide) {
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
  }, [garageRide, garagePassengers.length])

  // Fetch verification progress for the banner
  const { data: progressData } = useQuery({
    queryKey: ['verification-progress'],
    queryFn: () => verificationApi.getProgress().then(r => r.data),
    enabled: isAuthenticated && user?.role === 'driver',
    staleTime: 30000,
  })

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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <DriverLoginScreen />
        </View>
      </SafeAreaProvider>
    )
  }

  if ((settings.biometricEnabled || settings.hasPin) && isLocked) {
    return (
      <SafeAreaProvider>
        <AppLockScreen
          hasPin={settings.hasPin}
          biometricEnabled={settings.biometricEnabled}
          busy={lockBusy}
          onUnlockPin={async (pin) => {
            if (!pin) {
              return
            }
            setLockBusy(true)
            try {
              await settingsApi.verifyPin({ pin })
              setUnlocked()
            } catch (error) {
              if (Platform.OS === 'android') {
                ToastAndroid.show('Invalid PIN', ToastAndroid.SHORT)
              } else {
                Alert.alert('Invalid PIN', 'Please try again.')
              }
            } finally {
              setLockBusy(false)
            }
          }}
          onUnlockBiometric={async () => {
            setLockBusy(true)
            try {
              const LocalAuth = await import('expo-local-authentication')
              const result = await LocalAuth.authenticateAsync({
                promptMessage: 'Unlock LR Ride',
                fallbackLabel: 'Use PIN',
              })
              if (result.success) {
                setUnlocked()
              }
            } catch (error) {
              if (Platform.OS === 'android') {
                ToastAndroid.show('Biometric failed', ToastAndroid.SHORT)
              } else {
                Alert.alert('Biometric failed', 'Please try again.')
              }
            } finally {
              setLockBusy(false)
            }
          }}
          onLogout={() => {
            logout()
            resetLock()
          }}
        />
      </SafeAreaProvider>
    )
  }

  // ── Sub-page rendering (full screen, no layout) ────────────────────────────
  if (subPage === 'settings') {
    return (
      <SafeAreaProvider>
        <AccountSettingsPage
          onBack={() => setSubPage(null)}
          verificationProgress={progressData}
          onStartAccountVerification={() => setSubPage('account-verification')}
          onStartVehicleVerification={() => setSubPage('vehicle-verification')}
        />
      </SafeAreaProvider>
    )
  }

  if (subPage === 'edit-profile') {
    return (
      <SafeAreaProvider>
        <EditProfilePage onBack={() => setSubPage(null)} />
      </SafeAreaProvider>
    )
  }

  if (subPage === 'account-verification') {
    return (
      <SafeAreaProvider>
        <AccountVerificationScreen
          onBack={() => setSubPage(null)}
          onSuccess={() => setSubPage('verification-success')}
        />
      </SafeAreaProvider>
    )
  }

  if (subPage === 'vehicle-verification') {
    return (
      <SafeAreaProvider>
        <VehicleVerificationScreen
          onBack={() => setSubPage(null)}
          onAllUploaded={() => setSubPage('verification-success')}
        />
      </SafeAreaProvider>
    )
  }

  if (subPage === 'verification-success') {
    return (
      <SafeAreaProvider>
        <VerificationSuccessScreen onContinue={() => setSubPage(null)} />
      </SafeAreaProvider>
    )
  }

  if (subPage === 'garage-ride') {
    return (
      <SafeAreaProvider>
        <CreateGarageRideScreen onBack={() => setSubPage(null)} />
      </SafeAreaProvider>
    )
  }

  // ── Compute verification state for banner ──────────────────────────────────
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

  const renderPage = () => {
    switch (activeTab) {
      case 'home':  return <DriverDashboardScreen onCreateGarageRide={() => setSubPage('garage-ride')} />
      case 'rides': return <DriverRidesPage />
      case 'wallet': return <DriverWalletPage />
      case 'profile':
        return (
          <DriverProfilePage
            onNavigateToSettings={() => setSubPage('settings')}
            onEditProfile={() => setSubPage('edit-profile')}
          />
        )
      default: return <DriverDashboardScreen />
    }
  }

  return (
    <SafeAreaProvider>
      <DriverLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderPage()}
      </DriverLayout>
    </SafeAreaProvider>
  )
}

// ─── Verification Success Screen ──────────────────────────────────────────────
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
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

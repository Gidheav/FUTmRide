import { useEffect, useRef, useState } from 'react'
import { BackHandler, Platform, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuthStore } from '../core/authStore'
import { verificationApi } from '../core/api'
import { COLORS, FONTS } from '../core/theme'
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
import DriverLayout from './layout/DriverLayout'
import type { DriverTab } from './types'

type SubPage = null | 'settings' | 'edit-profile' | 'account-verification' | 'vehicle-verification' | 'verification-success' | 'garage-ride'

export default function DriverApp() {
  const { isAuthenticated, user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<DriverTab>('home')
  const [subPage, setSubPage] = useState<SubPage>(null)
  const lastBackPressRef = useRef(0)

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

  // Fetch verification progress for the banner
  const { data: progressData } = useQuery({
    queryKey: ['verification-progress'],
    queryFn: () => verificationApi.getProgress().then(r => r.data),
    enabled: isAuthenticated && user?.role === 'driver',
    staleTime: 30000,
  })

  if (!isAuthenticated || !user) {
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

  // ── Sub-page rendering (full screen, no layout) ────────────────────────────
  if (subPage === 'settings') {
    return (
      <SafeAreaProvider>
        <AccountSettingsPage onBack={() => setSubPage(null)} />
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
        {/* Verification Banner */}
        {banner && (
          <TouchableOpacity
            style={[s.banner, { backgroundColor: banner.bg }]}
            onPress={banner.action ?? undefined}
            activeOpacity={banner.action ? 0.8 : 1}
            disabled={!banner.action}
          >
            <MaterialIcons name={banner.icon} size={20} color={banner.color} />
            <Text style={[s.bannerText, { color: banner.color }]} numberOfLines={2}>
              {banner.label}
            </Text>
            {banner.cta && (
              <View style={[s.bannerCta, { backgroundColor: banner.color }]}>
                <Text style={s.bannerCtaText}>{banner.cta}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
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

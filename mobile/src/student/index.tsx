import { useEffect, useRef, useState } from 'react'
import { AppState, BackHandler, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuthStore } from '../core/authStore'
import { useSecurityStore } from '../core/securityStore'
import { fetchCurrentUser, refreshSession } from '../core/session'
import { StudentLoginScreen, StudentDashboardScreen } from './screens'
import StudentRidesPage from './pages/RidesPage'
import StudentWalletPage from './pages/WalletPage'
import StudentAccountPage from './pages/AccountPage'
import StudentEditProfilePage from './pages/EditProfilePage'
import SecurityPage from './pages/SecurityPage'
import AppLockPage from './pages/AppLockPage'
import StudentLayout from './layout/StudentLayout'
import StudentSidebar from './components/StudentSidebar'
import type { StudentTab } from './types'
import { clearStoredPinHash } from '../core/security'

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
  const [accountMode, setAccountMode] = useState<'view' | 'edit' | 'security'>('view')
  const [accountRefreshKey, setAccountRefreshKey] = useState(0)
  const [openPinOnLoad, setOpenPinOnLoad] = useState(false)
  const syncInFlight = useRef(false)
  const [skipPinVerify, setSkipPinVerify] = useState(false)
  const lastBackPressAt = useRef(0)

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
      }
    } catch (err) {
      logout()
    } finally {
      syncInFlight.current = false
    }
  }

  useEffect(() => {
    if (!appLockEnabled) return
    if (!hasPin && !biometricEnabled) {
      setAppLockEnabled(false)
      setLocked(false)
      return
    }
    if (!lastUnlockAt) {
      setLocked(true)
      return
    }
    if (lockTimeoutMinutes === 0) return
    const elapsedMinutes = (Date.now() - lastUnlockAt) / 60000
    if (elapsedMinutes >= lockTimeoutMinutes) {
      setLocked(true)
    }
  }, [appLockEnabled, biometricEnabled, hasPin, lastUnlockAt, lockTimeoutMinutes, setAppLockEnabled, setLocked])

  useEffect(() => {
    const handleStateChange = (state: string) => {
      if (!appLockEnabled) return
      if (state === 'background' || state === 'inactive') {
        setLocked(true)
        return
      }
      if (state === 'active') {
        if (lockTimeoutMinutes === 0) return
        if (lastUnlockAt && lockTimeoutMinutes > 0) {
          const elapsedMinutes = (Date.now() - lastUnlockAt) / 60000
          if (elapsedMinutes >= lockTimeoutMinutes) {
            setLocked(true)
          }
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleStateChange)
    return () => subscription.remove()
  }, [appLockEnabled, lastUnlockAt, lockTimeoutMinutes, setLocked])

  useEffect(() => {
    if (!isAuthenticated || locked) return
    void syncSession()
  }, [isAuthenticated, locked])

  useEffect(() => {
    if (!pinRecoveryRequired) return
    if (locked) {
      setLocked(false)
    }
  }, [pinRecoveryRequired, locked, setLocked])

  useEffect(() => {
    const handleBackPress = () => {
      if (isSidebarOpen) {
        setIsSidebarOpen(false)
        return true
      }
      if (accountMode !== 'view') {
        setAccountMode('view')
        return true
      }
      if (activeTab !== 'home') {
        setActiveTab('home')
        return true
      }
      const now = Date.now()
      if (now - lastBackPressAt.current < 1500) {
        return false
      }
      lastBackPressAt.current = now
      return true
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress)
    return () => subscription.remove()
  }, [activeTab, accountMode, isSidebarOpen])

  if (!isAuthenticated || !user) {
    return <StudentLoginScreen />
  }

  if (user.role !== 'student') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <StudentLoginScreen />
      </View>
    )
  }

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

  const renderTabPage = () => {
    return (
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Home Tab - Always mounted */}
        <View style={{ display: activeTab === 'home' ? 'flex' : 'none', flex: 1 }}>
          <StudentDashboardScreen />
        </View>

        {/* Rides Tab - Always mounted */}
        <View style={{ display: activeTab === 'rides' ? 'flex' : 'none', flex: 1 }}>
          <StudentRidesPage />
        </View>

        {/* Wallet Tab - Always mounted */}
        <View style={{ display: activeTab === 'wallet' ? 'flex' : 'none', flex: 1 }}>
          <StudentWalletPage />
        </View>

        {/* Account Tab with mode variants - Always mounted */}
        {activeTab === 'account' && accountMode === 'edit' && (
          <StudentEditProfilePage
            onClose={() => setAccountMode('view')}
            onSaved={() => {
              setAccountMode('view')
              setAccountRefreshKey((prev) => prev + 1)
            }}
          />
        )}

        {activeTab === 'account' && accountMode === 'security' && (
          <SecurityPage
            onClose={() => {
              setAccountMode('view')
              setOpenPinOnLoad(false)
              setSkipPinVerify(false)
            }}
            openPinOnLoad={openPinOnLoad}
            skipCurrentPin={skipPinVerify}
          />
        )}

        {activeTab === 'account' && accountMode === 'view' && (
          <StudentAccountPage
            onEditProfile={() => setAccountMode('edit')}
            onOpenSecurity={() => setAccountMode('security')}
            onLogout={logout}
            refreshKey={accountRefreshKey}
          />
        )}
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <StudentLayout activeTab={activeTab} onTabChange={setActiveTab} onMenuPress={() => setIsSidebarOpen(true)}>
        {renderTabPage()}
      </StudentLayout>

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
                if (!biometricEnabled) {
                  setAppLockEnabled(false)
                }
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
        onLogout={() => {
          setIsSidebarOpen(false)
          logout()
        }}
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
  recoveryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  recoveryText: {
    fontSize: 13,
    color: '#6b7280',
  },
  recoveryPrimary: {
    backgroundColor: '#6A1B9A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  recoveryPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  recoverySecondary: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  recoverySecondaryText: {
    color: '#6A1B9A',
    fontWeight: '600',
  },
})

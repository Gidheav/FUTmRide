import { useEffect, useState, useRef, useMemo } from 'react'
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import LocationDataService from '../../../services/locationDataService'

type VersionInfo = {
  localVersion: number
  serverVersion: number
  locationCount: number
  publishedAt: string | null
}

type ModalState = 'idle' | 'running' | 'success' | 'error'

// ── Premium Animated Pressable ──
const AnimatedPressable = ({
  children,
  onPress,
  style,
  disabled,
  activeOpacity = 0.85,
}: {
  children: React.ReactNode
  onPress?: () => void
  style?: any
  disabled?: boolean
  activeOpacity?: number
}) => {
  const scale = useRef(new Animated.Value(1)).current
  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start()
  }
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start()
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        style,
        {
          opacity: pressed ? activeOpacity : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      {children}
    </Pressable>
  )
}

export default function UpdatesPage() {
  const insets = useSafeAreaInsets()
  
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  
  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [modalState, setModalState] = useState<ModalState>('idle')
  const [modalMessage, setModalMessage] = useState('')

  // Load local version on mount
  useEffect(() => {
    void (async () => {
      const v = await LocationDataService.getCurrentVersion()
      if (v > 0) {
        setVersionInfo((prev) => ({
          ...(prev ?? { serverVersion: 0, locationCount: 0, publishedAt: null }),
          localVersion: v,
        }))
      }
    })()
  }, [])

  // Derived status: is the local version matching the server version?
  const isUpToDate = useMemo(() => {
    if (!versionInfo || versionInfo.localVersion === 0) return null
    return versionInfo.localVersion >= versionInfo.serverVersion
  }, [versionInfo])

  const handleRun = async () => {
    setIsModalVisible(true)
    setModalState('running')
    setModalMessage('Checking for updates...')

    try {
      const check = await LocationDataService.checkForUpdate()
      setVersionInfo({
        localVersion: check.localVersion,
        serverVersion: check.serverVersion,
        locationCount: check.locationCount ?? 0,
        publishedAt: check.publishedAt ?? null,
      })

      if (!check.updateAvailable) {
        setModalState('success')
        setModalMessage(`Your map is already up to date (v${check.localVersion}).`)
        return
      }

      setModalMessage(`Downloading map data...`)

      const result = await LocationDataService.downloadUpdate(
        (p) => setModalMessage(`Downloading map data (${Math.round(p * 100)}%)...`),
        (stage, status, detail) => {
          if (status === 'running') {
            const label = {
              fetch: 'Downloading update...',
              validate: 'Validating data...',
              save: 'Saving to device...',
              apply: 'Applying updates...',
            }[stage] || 'Updating...'
            setModalMessage(label)
          }
        },
      )

      if (result.success) {
        setModalState('success')
        setVersionInfo((prev) =>
          prev ? { ...prev, localVersion: result.version ?? check.serverVersion } : prev
        )
        setModalMessage(
          `Successfully updated to v${result.version ?? check.serverVersion}!`
        )
      } else {
        setModalState('error')
        setModalMessage(result.error ?? 'Update failed. Please try again.')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Could not connect. Please check your internet connection and try again.'
      setModalState('error')
      setModalMessage(`Check failed: ${msg}`)
    }
  }

  const closeModal = () => {
    setIsModalVisible(false)
    setTimeout(() => {
      setModalState('idle')
      setModalMessage('')
    }, 300)
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      
      {/* ── Main Screen ────────────────────────────────────────────────── */}
      <View style={styles.container}>
        
        {/* Decorative background accent */}
        <View style={styles.bgAccent} />

        <View style={styles.contentBlock}>
          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={styles.heroIconWrapper}>
              <MaterialIcons name="map" size={40} color="#6A1B9A" />
            </View>
            <Text style={styles.heroTitle}>Campus Map</Text>
            <Text style={styles.heroSubtitle}>
              Keep your location data fresh for accurate routing.
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {versionInfo?.localVersion && versionInfo.localVersion > 0 
                  ? `v${versionInfo.localVersion}` 
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>Current Version</Text>
              {isUpToDate === true && (
                <View style={styles.statusBadge}>
                  <MaterialIcons name="check-circle" size={12} color="#2E7D32" />
                  <Text style={styles.statusBadgeText}>Up to date</Text>
                </View>
              )}
              {isUpToDate === false && (
                <View style={[styles.statusBadge, styles.statusBadgeWarning]}>
                  <MaterialIcons name="warning" size={12} color="#B45309" />
                  <Text style={[styles.statusBadgeText, styles.statusBadgeTextWarning]}>
                    Update available
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {versionInfo?.locationCount && versionInfo.locationCount > 0 
                  ? versionInfo.locationCount 
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>Locations</Text>
              <View style={styles.statusBadgeSpacer} />
            </View>
          </View>

          {/* Premium Pill Button (not full width) */}
          <AnimatedPressable 
            style={[styles.actionButton, isModalVisible && styles.actionButtonDisabled]} 
            onPress={handleRun} 
            disabled={isModalVisible}
          >
            <MaterialIcons name="system-update-alt" size={18} color="#ffffff" />
            <Text style={styles.actionButtonText}>Check for Updates</Text>
          </AnimatedPressable>

          <Text style={styles.footnote}>
            Last checked {versionInfo?.publishedAt ? new Date(versionInfo.publishedAt).toLocaleDateString() : 'just now'}
          </Text>
        </View>
      </View>

      {/* ── Update Modal (Premium) ───────────────────────────────────── */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {modalState === 'running' && (
              <View style={styles.modalStateContainer}>
                <ActivityIndicator size="large" color="#6A1B9A" />
                <Text style={styles.modalStateTitle}>Updating…</Text>
                <Text style={styles.modalStateText}>{modalMessage}</Text>
              </View>
            )}

            {modalState === 'success' && (
              <View style={styles.modalStateContainer}>
                <View style={styles.modalIconSuccess}>
                  <MaterialIcons name="check-circle" size={56} color="#ffffff" />
                </View>
                <Text style={styles.modalStateTitle}>All Set</Text>
                <Text style={styles.modalStateText}>{modalMessage}</Text>
                <AnimatedPressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={closeModal}>
                  <Text style={styles.modalButtonText}>Done</Text>
                </AnimatedPressable>
              </View>
            )}

            {modalState === 'error' && (
              <View style={styles.modalStateContainer}>
                <View style={styles.modalIconError}>
                  <MaterialIcons name="error" size={56} color="#ffffff" />
                </View>
                <Text style={styles.modalStateTitle}>Update Failed</Text>
                <Text style={styles.modalStateTextError}>{modalMessage}</Text>
                <View style={styles.modalButtonRow}>
                  <AnimatedPressable style={[styles.modalButton, styles.modalButtonOutline]} onPress={closeModal}>
                    <Text style={[styles.modalButtonText, { color: '#6A1B9A' }]}>Cancel</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={handleRun}>
                    <Text style={styles.modalButtonText}>Retry</Text>
                  </AnimatedPressable>
                </View>
              </View>
            )}

          </View>
        </View>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  page: { 
    flex: 1, 
    backgroundColor: '#F8F7F4',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center', // Vertical center – premium balance
    position: 'relative',
  },
  
  // Decorative background
  bgAccent: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(106, 27, 154, 0.04)',
  },
  contentBlock: {
    alignItems: 'center',
    width: '100%',
    gap: 32,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.2,
    paddingHorizontal: 16,
  },

  // Stats Row (side by side cards)
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(106, 27, 154, 0.05)',
    minHeight: 96,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeWarning: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2E7D32',
    letterSpacing: 0.3,
  },
  statusBadgeTextWarning: {
    color: '#B45309',
  },
  statusBadgeSpacer: {
    height: 18, // placeholder to keep card height consistent
  },

  // Pill Action Button (not full width)
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 999, // pill shape
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 4,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footnote: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 0.2,
    marginTop: -8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.08,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  modalStateContainer: {
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  modalStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  modalStateText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.2,
    paddingHorizontal: 8,
  },
  modalStateTextError: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 22,
    letterSpacing: 0.2,
    paddingHorizontal: 8,
  },
  modalIconSuccess: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalIconError: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalButton: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  modalButtonPrimary: {
    backgroundColor: '#6A1B9A',
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  modalButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#6A1B9A',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
})
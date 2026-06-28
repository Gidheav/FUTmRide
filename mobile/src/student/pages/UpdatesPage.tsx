import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
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

  const handleRun = async () => {
    setIsModalVisible(true)
    setModalState('running')
    setModalMessage('Checking server for updates...')

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
              fetch: 'Downloading from server...',
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
      const msg = err?.response?.data?.detail || err?.message || 'Could not reach server'
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
        <View style={styles.heroSection}>
          <View style={styles.heroIconWrapper}>
            <MaterialIcons name="map" size={64} color="#6A1B9A" />
          </View>
          <Text style={styles.heroTitle}>Campus Map</Text>
          <Text style={styles.heroSubtitle}>
            Ensure you have the latest location data for accurate routing and quick access.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Version</Text>
            <Text style={styles.infoValue}>
              {versionInfo?.localVersion && versionInfo.localVersion > 0 
                ? `v${versionInfo.localVersion}` 
                : 'Not Installed'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Locations</Text>
            <Text style={styles.infoValue}>
              {versionInfo?.locationCount && versionInfo.locationCount > 0 
                ? versionInfo.locationCount 
                : '—'}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.actionButton} onPress={handleRun} activeOpacity={0.85}>
          <MaterialIcons name="system-update-alt" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>Check for Updates</Text>
        </TouchableOpacity>
      </View>

      {/* ── Update Modal ───────────────────────────────────────────────── */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {modalState === 'running' && (
              <View style={styles.modalStateContainer}>
                <ActivityIndicator size="large" color="#6A1B9A" />
                <Text style={styles.modalStateText}>{modalMessage}</Text>
              </View>
            )}

            {modalState === 'success' && (
              <View style={styles.modalStateContainer}>
                <MaterialIcons name="check-circle" size={56} color="#1a7340" />
                <Text style={styles.modalStateTitle}>Up to Date</Text>
                <Text style={styles.modalStateText}>{modalMessage}</Text>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#1a7340' }]} onPress={closeModal}>
                  <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {modalState === 'error' && (
              <View style={styles.modalStateContainer}>
                <MaterialIcons name="error" size={56} color="#ba1a1a" />
                <Text style={styles.modalStateTitle}>Update Failed</Text>
                <Text style={styles.modalStateTextError}>{modalMessage}</Text>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity style={[styles.modalButton, styles.modalButtonOutline]} onPress={closeModal}>
                    <Text style={[styles.modalButtonText, { color: '#ba1a1a' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#ba1a1a' }]} onPress={handleRun}>
                    <Text style={styles.modalButtonText}>Retry</Text>
                  </TouchableOpacity>
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
    backgroundColor: '#ffffff' 
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1c1c',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#6d7b6d',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  // Info Section
  infoSection: {
    backgroundColor: '#fafafa',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f2f2f7',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#f2f2f7',
    marginVertical: 16,
  },
  infoLabel: {
    fontSize: 16,
    color: '#5e5e5e',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1c1c',
    fontWeight: '700',
  },

  // Action Button
  actionButton: {
    backgroundColor: '#6A1B9A',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  modalStateContainer: {
    alignItems: 'center',
    width: '100%',
  },
  modalStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1c1c',
    marginTop: 16,
    marginBottom: 8,
  },
  modalStateText: {
    fontSize: 15,
    color: '#5e5e5e',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  modalStateTextError: {
    fontSize: 15,
    color: '#ba1a1a',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  modalButton: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  modalButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ba1a1a',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})

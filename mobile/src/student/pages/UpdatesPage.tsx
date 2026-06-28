import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import LocationDataService from '../../../services/locationDataService'

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'up_to_date' | 'updated' | 'error'

type VersionInfo = {
  localVersion: number
  serverVersion: number
  locationCount: number
  publishedAt: string | null
}

export default function UpdatesPage() {
  const insets = useSafeAreaInsets()
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [progress, setProgress] = useState<number>(0) // 0–100
  const progressAnim = useRef(new Animated.Value(0)).current

  // Load current local version on mount
  useEffect(() => {
    void (async () => {
      const v = await LocationDataService.getCurrentVersion()
      if (v > 0) {
        setVersionInfo((prev) => ({ ...(prev ?? { serverVersion: 0, locationCount: 0, publishedAt: null }), localVersion: v }))
      }
    })()
  }, [])

  const animateTo = (toValue: number) => {
    Animated.timing(progressAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }

  const handleCheck = async () => {
    setStatus('checking')
    setMessage(null)
    animateTo(20)
    try {
      const check = await LocationDataService.checkForUpdate()
      animateTo(60)
      setVersionInfo({
        localVersion: check.localVersion,
        serverVersion: check.serverVersion,
        locationCount: check.locationCount ?? 0,
        publishedAt: check.publishedAt ?? null,
      })
      if (!check.updateAvailable) {
        animateTo(100)
        setStatus('up_to_date')
        setMessage(`Map data is already up to date (v${check.localVersion})`)
        return
      }
      // Auto-download when update is available
      setStatus('downloading')
      animateTo(75)
      setProgress(75)
      const result = await LocationDataService.downloadUpdate()
      if (result.success) {
        animateTo(100)
        setStatus('updated')
        // Update localVersion in UI to reflect what's now on device
        setVersionInfo((prev) => prev ? { ...prev, localVersion: result.version ?? check.serverVersion } : prev)
        setMessage(
          `Updated to v${result.version ?? check.serverVersion} — ${result.locationCount ?? check.locationCount} location(s) now on device`
        )
      } else {
        // Download failed — version on device is still the old one
        setStatus('error')
        animateTo(0)
        setMessage(result.error ?? 'Download failed. Please try again.')
      }
    } catch {
      setStatus('error')
      animateTo(0)
      setMessage('Could not reach server. Check your internet connection.')
    }
  }

  const statusIcon: Record<UpdateStatus, keyof typeof MaterialIcons.glyphMap> = {
    idle: 'cloud-download',
    checking: 'cloud-sync',
    downloading: 'cloud-download',
    up_to_date: 'check-circle',
    updated: 'check-circle',
    error: 'error-outline',
  }

  const statusColor: Record<UpdateStatus, string> = {
    idle: '#6A1B9A',
    checking: '#6A1B9A',
    downloading: '#6A1B9A',
    up_to_date: '#1a7340',
    updated: '#1a7340',
    error: '#ba1a1a',
  }

  const isBusy = status === 'checking' || status === 'downloading'

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <MaterialIcons name="system-update" size={32} color="#6A1B9A" />
          </View>
          <Text style={styles.headerTitle}>App Updates</Text>
          <Text style={styles.headerSub}>Keep your campus map data current</Text>
        </View>

        {/* Map Data Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="map" size={20} color="#6A1B9A" />
            <Text style={styles.cardTitle}>Campus Map Data</Text>
          </View>

          {versionInfo && (
            <View style={styles.versionGrid}>
              <View style={styles.versionCell}>
                <Text style={styles.versionLabel}>On Device</Text>
                <Text style={styles.versionValue}>
                  {versionInfo.localVersion > 0 ? `v${versionInfo.localVersion}` : 'None'}
                </Text>
              </View>
              <View style={styles.versionDivider} />
              <View style={styles.versionCell}>
                <Text style={styles.versionLabel}>Latest</Text>
                <Text style={styles.versionValue}>
                  {versionInfo.serverVersion > 0 ? `v${versionInfo.serverVersion}` : '\u2014'}
                </Text>
              </View>
              <View style={styles.versionDivider} />
              <View style={styles.versionCell}>
                <Text style={styles.versionLabel}>Locations</Text>
                <Text style={styles.versionValue}>
                  {versionInfo.locationCount > 0 ? versionInfo.locationCount : '\u2014'}
                </Text>
              </View>
            </View>
          )}

          {/* Progress bar */}
          {isBusy && (
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}

          {/* Status message */}
          {message && (
            <View style={[styles.msgRow, status === 'error' && styles.msgRowError]}>
              <MaterialIcons
                name={statusIcon[status]}
                size={16}
                color={statusColor[status]}
              />
              <Text style={[styles.msgText, { color: statusColor[status] }]}>{message}</Text>
            </View>
          )}

          {/* Action button */}
          <TouchableOpacity
            style={[styles.btn, isBusy && styles.btnDisabled]}
            activeOpacity={0.85}
            onPress={isBusy ? undefined : handleCheck}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialIcons name={statusIcon[status]} size={18} color="#ffffff" />
            )}
            <Text style={styles.btnText}>
              {status === 'checking'
                ? 'Checking\u2026'
                : status === 'downloading'
                  ? 'Downloading\u2026'
                  : status === 'up_to_date'
                    ? 'Check Again'
                    : status === 'updated'
                      ? 'Check Again'
                      : 'Check for Map Update'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.cardNote}>
            Map data is automatically refreshed in the background when you open the app.
            Tap above to force an immediate check.
          </Text>
        </View>

        {/* App version card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="info-outline" size={20} color="#6A1B9A" />
            <Text style={styles.cardTitle}>App Version</Text>
          </View>
          <View style={styles.appVersionRow}>
            <Text style={styles.appVersionLabel}>LR Ride Student</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>Latest</Text>
            </View>
          </View>
          <Text style={styles.cardNote}>
            App updates are distributed through the app store. You are running the latest version.
          </Text>
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  headerIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1c1c',
  },
  headerSub: {
    fontSize: 14,
    color: '#6d7b6d',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eeeeee',
    padding: 16,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  versionGrid: {
    flexDirection: 'row',
    backgroundColor: '#faf5ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    padding: 12,
  },
  versionCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  versionDivider: {
    width: 1,
    backgroundColor: '#e9d5ff',
    marginVertical: 4,
  },
  versionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6d7b6d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e9d5ff',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6A1B9A',
    borderRadius: 2,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
  },
  msgRowError: {
    backgroundColor: '#fff1f2',
  },
  msgText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6A1B9A',
    borderRadius: 10,
    paddingVertical: 13,
    gap: 8,
  },
  btnDisabled: {
    backgroundColor: '#9c5bbf',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cardNote: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
  appVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  appVersionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  versionBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  versionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a7340',
  },
})

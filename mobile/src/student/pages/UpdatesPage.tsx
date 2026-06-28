import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import LocationDataService from '../../../services/locationDataService'

// ── Types ──────────────────────────────────────────────────────────────────────

type StageStatus = 'idle' | 'running' | 'ok' | 'error' | 'skipped'

type Stage = {
  key: string
  label: string
  icon: keyof typeof MaterialIcons.glyphMap
  status: StageStatus
  detail: string | null
}

type VersionInfo = {
  localVersion: number
  serverVersion: number
  locationCount: number
  publishedAt: string | null
}

type OverallStatus = 'idle' | 'checking' | 'up_to_date' | 'downloading' | 'done' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────

const INITIAL_STAGES: Stage[] = [
  { key: 'check',    label: 'Check for update',          icon: 'cloud-sync',      status: 'idle', detail: null },
  { key: 'fetch',    label: 'Download from server',       icon: 'cloud-download',  status: 'idle', detail: null },
  { key: 'validate', label: 'Validate data',              icon: 'verified',        status: 'idle', detail: null },
  { key: 'save',     label: 'Save to device',             icon: 'save',            status: 'idle', detail: null },
  { key: 'apply',    label: 'Apply to campus map',        icon: 'map',             status: 'idle', detail: null },
]

const stageColor: Record<StageStatus, string> = {
  idle:    '#c0c0c0',
  running: '#6A1B9A',
  ok:      '#1a7340',
  error:   '#ba1a1a',
  skipped: '#8a9e8a',
}

const stageIcon: Record<StageStatus, keyof typeof MaterialIcons.glyphMap> = {
  idle:    'radio-button-unchecked',
  running: 'autorenew',
  ok:      'check-circle',
  error:   'error',
  skipped: 'remove-circle-outline',
}

function formatPublishedAt(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UpdatesPage() {
  const insets = useSafeAreaInsets()
  const [overall, setOverall] = useState<OverallStatus>('idle')
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES)
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [finalMessage, setFinalMessage] = useState<string | null>(null)
  const progressAnim = useRef(new Animated.Value(0)).current
  const isBusy = overall === 'checking' || overall === 'downloading'

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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const animateTo = (toValue: number, duration = 350) => {
    Animated.timing(progressAnim, {
      toValue,
      duration,
      useNativeDriver: false,
    }).start()
  }

  const setStage = (key: string, status: StageStatus, detail?: string) => {
    setStages((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status, detail: detail ?? s.detail } : s))
    )
  }

  const resetStages = () => {
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: 'idle', detail: null })))
    animateTo(0, 0)
    setFinalMessage(null)
  }

  // ── Main handler ─────────────────────────────────────────────────────────────

  const handleRun = async () => {
    resetStages()
    setOverall('checking')
    animateTo(10)

    // ── Stage 1: Check ────────────────────────────────────────────────────────
    setStage('check', 'running')
    let check: Awaited<ReturnType<typeof LocationDataService.checkForUpdate>>
    try {
      check = await LocationDataService.checkForUpdate()
      setVersionInfo({
        localVersion: check.localVersion,
        serverVersion: check.serverVersion,
        locationCount: check.locationCount ?? 0,
        publishedAt: check.publishedAt ?? null,
      })
      animateTo(25)

      if (!check.updateAvailable) {
        setStage('check', 'ok', `Already on v${check.localVersion} — server is also v${check.serverVersion}`)
        // Mark remaining stages as skipped
        setStages((prev) =>
          prev.map((s) => (s.key !== 'check' ? { ...s, status: 'skipped', detail: 'Not needed' } : s))
        )
        animateTo(100)
        setOverall('up_to_date')
        setFinalMessage(`Map data is already up to date (v${check.localVersion})`)
        return
      }

      setStage('check', 'ok', `Update available: v${check.localVersion} → v${check.serverVersion} (${check.locationCount} locations)`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Could not reach server'
      setStage('check', 'error', msg)
      setOverall('error')
      setFinalMessage(`Check failed: ${msg}`)
      return
    }

    // ── Stages 2-5: Download pipeline ─────────────────────────────────────────
    setOverall('downloading')
    animateTo(35)

    const result = await LocationDataService.downloadUpdate(
      // onProgress
      (p) => animateTo(35 + p * 60),
      // onStage — maps service stage keys to UI stage keys & messages
      (stage, status, detail) => {
        const key = stage // 'fetch' | 'validate' | 'save' | 'apply'
        setStage(key, status, detail)
      },
    )

    if (result.success) {
      animateTo(100)
      setOverall('done')
      setVersionInfo((prev) =>
        prev ? { ...prev, localVersion: result.version ?? check.serverVersion } : prev
      )
      setFinalMessage(
        `✓ Campus map updated to v${result.version ?? check.serverVersion} — ${result.locationCount} location(s) now live in the app`
      )
    } else {
      setOverall('error')
      setFinalMessage(result.error ?? 'Update failed. Check the steps above for details.')
    }
  }

  // ── Button label ──────────────────────────────────────────────────────────────

  const btnLabel = {
    idle:        'Check for Map Update',
    checking:    'Checking server…',
    up_to_date:  'Check Again',
    downloading: 'Updating…',
    done:        'Check Again',
    error:       'Retry',
  }[overall]

  const btnColor = overall === 'error' ? '#ba1a1a' : '#6A1B9A'
  const btnBusyColor = overall === 'error' ? '#d44' : '#9c5bbf'

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <MaterialIcons name="system-update" size={32} color="#6A1B9A" />
          </View>
          <Text style={styles.headerTitle}>Map Data Updates</Text>
          <Text style={styles.headerSub}>Keep your campus map current with the latest locations</Text>
        </View>

        {/* ── Version Info ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="info-outline" size={18} color="#6A1B9A" />
            <Text style={styles.cardTitle}>Version Status</Text>
          </View>

          <View style={styles.versionGrid}>
            <View style={styles.versionCell}>
              <Text style={styles.versionLabel}>On Device</Text>
              <Text style={[styles.versionValue, !versionInfo?.localVersion && styles.versionValueNone]}>
                {versionInfo?.localVersion && versionInfo.localVersion > 0
                  ? `v${versionInfo.localVersion}`
                  : 'None'}
              </Text>
            </View>
            <View style={styles.versionDivider} />
            <View style={styles.versionCell}>
              <Text style={styles.versionLabel}>Server</Text>
              <Text style={styles.versionValue}>
                {versionInfo?.serverVersion && versionInfo.serverVersion > 0
                  ? `v${versionInfo.serverVersion}`
                  : '—'}
              </Text>
            </View>
            <View style={styles.versionDivider} />
            <View style={styles.versionCell}>
              <Text style={styles.versionLabel}>Locations</Text>
              <Text style={styles.versionValue}>
                {versionInfo?.locationCount && versionInfo.locationCount > 0
                  ? versionInfo.locationCount
                  : '—'}
              </Text>
            </View>
          </View>

          {versionInfo?.publishedAt && (
            <Text style={styles.publishedAt}>
              Published: {formatPublishedAt(versionInfo.publishedAt)}
            </Text>
          )}
        </View>

        {/* ── Progress Bar ───────────────────────────────────────────────── */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: overall === 'error' ? '#ba1a1a' : overall === 'done' || overall === 'up_to_date' ? '#1a7340' : '#6A1B9A',
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* ── Pipeline Stages ────────────────────────────────────────────── */}
        {(() => {
          const visibleStages = stages.filter(s => s.status !== 'idle' && s.status !== 'skipped')
          if (visibleStages.length === 0) return null
          
          return (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="account-tree" size={18} color="#6A1B9A" />
                <Text style={styles.cardTitle}>Update Progress</Text>
              </View>

              {visibleStages.map((stage, idx) => (
                <View key={stage.key}>
                  <View style={styles.stageRow}>
                    {/* Step number or status icon */}
                    <View style={[styles.stageIconWrap, { backgroundColor: stageColor[stage.status] + '18' }]}>
                      {stage.status === 'running' ? (
                        <ActivityIndicator size={14} color={stageColor[stage.status]} />
                      ) : (
                        <MaterialIcons
                          name={stage.status === 'idle' ? stage.icon : stageIcon[stage.status]}
                          size={16}
                          color={stageColor[stage.status]}
                        />
                      )}
                    </View>

                    <View style={styles.stageBody}>
                      <View style={styles.stageLabelRow}>
                        <Text style={[
                          styles.stageLabel,
                          stage.status === 'ok' && styles.stageLabelOk,
                          stage.status === 'error' && styles.stageLabelError,
                          stage.status === 'running' && styles.stageLabelRunning,
                        ]}>
                          {stage.label}
                        </Text>
                        <View style={[styles.stageBadge, { backgroundColor: stageColor[stage.status] + '1a' }]}>
                          <Text style={[styles.stageBadgeText, { color: stageColor[stage.status] }]}>
                            {stage.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      {stage.detail && (
                        <Text style={[
                          styles.stageDetail,
                          stage.status === 'error' && styles.stageDetailError,
                        ]}>
                          {stage.detail}
                        </Text>
                      )}
                    </View>
                  </View>
                  {idx < visibleStages.length - 1 && (
                    <View style={[
                      styles.stageConnector,
                      { backgroundColor: stage.status === 'ok' ? '#1a7340' : stage.status === 'error' ? '#ba1a1a' : '#e2e2e2' },
                    ]} />
                  )}
                </View>
              ))}
            </View>
          )
        })()}

        {/* ── Final message ──────────────────────────────────────────────── */}
        {finalMessage && (
          <View style={[
            styles.finalMsg,
            overall === 'error' && styles.finalMsgError,
            overall === 'up_to_date' && styles.finalMsgInfo,
          ]}>
            <MaterialIcons
              name={overall === 'error' ? 'error-outline' : overall === 'up_to_date' ? 'check-circle-outline' : 'check-circle'}
              size={18}
              color={overall === 'error' ? '#ba1a1a' : overall === 'up_to_date' ? '#1a5a9a' : '#1a7340'}
            />
            <Text style={[
              styles.finalMsgText,
              overall === 'error' && styles.finalMsgTextError,
              overall === 'up_to_date' && styles.finalMsgTextInfo,
            ]}>
              {finalMessage}
            </Text>
          </View>
        )}

        {/* ── Action button ──────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isBusy ? btnBusyColor : btnColor }]}
          activeOpacity={0.85}
          onPress={isBusy ? undefined : handleRun}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <MaterialIcons
              name={overall === 'error' ? 'refresh' : overall === 'done' || overall === 'up_to_date' ? 'cloud-sync' : 'cloud-download'}
              size={18}
              color="#ffffff"
            />
          )}
          <Text style={styles.btnText}>{btnLabel}</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          The campus map auto-refreshes silently when you open the app.
          Use the button above to force an immediate update and see each step's status.
        </Text>

        {/* ── App version card ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="phone-android" size={18} color="#6A1B9A" />
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f7f9' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 14 },

  // Header
  header: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  headerIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#f3e5f5', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1c1c' },
  headerSub: { fontSize: 13, color: '#6d7b6d', textAlign: 'center', lineHeight: 20 },

  // Card
  card: {
    backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#eeeeee',
    padding: 16, gap: 12, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  cardTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f3f3', paddingBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1c1c' },
  cardNote: { fontSize: 12, color: '#9ca3af', lineHeight: 18 },

  // Version grid
  versionGrid: {
    flexDirection: 'row', backgroundColor: '#faf5ff',
    borderRadius: 10, borderWidth: 1, borderColor: '#e9d5ff', padding: 12,
  },
  versionCell: { flex: 1, alignItems: 'center', gap: 4 },
  versionDivider: { width: 1, backgroundColor: '#e9d5ff', marginVertical: 4 },
  versionLabel: { fontSize: 11, fontWeight: '600', color: '#6d7b6d', textTransform: 'uppercase', letterSpacing: 0.5 },
  versionValue: { fontSize: 17, fontWeight: '800', color: '#6A1B9A' },
  versionValueNone: { color: '#c0c0c0' },
  publishedAt: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },

  // Progress bar
  progressTrack: { height: 5, backgroundColor: '#e9d5ff', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // Pipeline stages
  stageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  stageIconWrap: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  stageBody: { flex: 1, gap: 3 },
  stageLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stageLabel: { fontSize: 14, fontWeight: '600', color: '#5e5e5e', flex: 1 },
  stageLabelOk: { color: '#1a7340' },
  stageLabelError: { color: '#ba1a1a' },
  stageLabelRunning: { color: '#6A1B9A' },
  stageBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  stageBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  stageDetail: { fontSize: 12, color: '#6d7b6d', lineHeight: 17 },
  stageDetailError: { color: '#ba1a1a' },
  stageConnector: { width: 2, height: 8, marginLeft: 15, borderRadius: 1 },

  // Final message
  finalMsg: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  finalMsgError: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  finalMsgInfo: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  finalMsgText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1a7340', lineHeight: 20 },
  finalMsgTextError: { color: '#ba1a1a' },
  finalMsgTextInfo: { color: '#1a5a9a' },

  // Button
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 15, gap: 8,
  },
  btnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  footerNote: { fontSize: 12, color: '#a0a0a0', textAlign: 'center', lineHeight: 18, paddingHorizontal: 4 },

  // App version
  appVersionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  appVersionLabel: { fontSize: 15, fontWeight: '600', color: '#1a1c1c' },
  versionBadge: { backgroundColor: '#f0fdf4', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#bbf7d0' },
  versionBadgeText: { fontSize: 12, fontWeight: '700', color: '#1a7340' },
})

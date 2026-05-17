import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@lr_notif_prefs'

type NotifPrefs = {
  soundEnabled: boolean
  rideRequested: boolean
  driverAssigned: boolean
  driverEnRoute: boolean
  driverArrived: boolean
  tripStarted: boolean
  tripCompleted: boolean
  rideCancelled: boolean
  walletCredit: boolean
  walletDebit: boolean
  promotions: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  soundEnabled: true,
  rideRequested: true,
  driverAssigned: true,
  driverEnRoute: true,
  driverArrived: true,
  tripStarted: true,
  tripCompleted: true,
  rideCancelled: true,
  walletCredit: true,
  walletDebit: true,
  promotions: false,
}

type Props = {
  onClose: () => void
}

type ToggleRowProps = {
  icon: keyof typeof MaterialIcons.glyphMap
  iconColor: string
  iconBg: string
  label: string
  description?: string
  value: boolean
  onValueChange: (v: boolean) => void
}

function ToggleRow({ icon, iconColor, iconBg, label, description, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.toggleIconWrap, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e0e0e0', true: '#ce93d8' }}
        thumbColor={value ? '#6A1B9A' : '#f4f4f4'}
      />
    </View>
  )
}

export default function StudentNotificationSettingsPage({ onClose }: Props) {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
        } catch { /* use defaults */ }
      }
    })
  }, [])

  const update = (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {})
  }

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: Math.max(14, insets.top + 10) }]}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={22} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.title}>Notification Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* ── General ─────────────────────────── */}
        <Text style={styles.sectionLabel}>General</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="volume-up"
            iconColor="#1565C0"
            iconBg="#e3f2fd"
            label="Notification Sound"
            description="Play sound for notifications"
            value={prefs.soundEnabled}
            onValueChange={(v) => update('soundEnabled', v)}
          />
        </View>

        {/* ── Ride Notifications ──────────────── */}
        <Text style={styles.sectionLabel}>Ride Updates</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="local-taxi"
            iconColor="#6A1B9A"
            iconBg="#f3e5f5"
            label="Ride Requested"
            description="When your ride request is submitted"
            value={prefs.rideRequested}
            onValueChange={(v) => update('rideRequested', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="person"
            iconColor="#1565C0"
            iconBg="#e3f2fd"
            label="Driver Assigned"
            description="When a driver accepts your ride"
            value={prefs.driverAssigned}
            onValueChange={(v) => update('driverAssigned', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="directions-car"
            iconColor="#E65100"
            iconBg="#fff3e0"
            label="Driver En Route"
            description="When your driver is heading to you"
            value={prefs.driverEnRoute}
            onValueChange={(v) => update('driverEnRoute', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="place"
            iconColor="#2e7d32"
            iconBg="#e8f5e9"
            label="Driver Arrived"
            description="When driver arrives at pickup point"
            value={prefs.driverArrived}
            onValueChange={(v) => update('driverArrived', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="navigation"
            iconColor="#E65100"
            iconBg="#fff3e0"
            label="Trip Started"
            description="When your trip begins"
            value={prefs.tripStarted}
            onValueChange={(v) => update('tripStarted', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="check-circle"
            iconColor="#2e7d32"
            iconBg="#e8f5e9"
            label="Trip Completed"
            description="When your ride is finished"
            value={prefs.tripCompleted}
            onValueChange={(v) => update('tripCompleted', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="cancel"
            iconColor="#b91c1c"
            iconBg="#fef2f2"
            label="Ride Cancelled"
            description="When a ride is cancelled"
            value={prefs.rideCancelled}
            onValueChange={(v) => update('rideCancelled', v)}
          />
        </View>

        {/* ── Wallet Notifications ────────────── */}
        <Text style={styles.sectionLabel}>Wallet & Payments</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="arrow-downward"
            iconColor="#2e7d32"
            iconBg="#e8f5e9"
            label="Wallet Credit"
            description="Top-up, refunds, and incoming transfers"
            value={prefs.walletCredit}
            onValueChange={(v) => update('walletCredit', v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="arrow-upward"
            iconColor="#b91c1c"
            iconBg="#fef2f2"
            label="Wallet Debit"
            description="Ride payments and deductions"
            value={prefs.walletDebit}
            onValueChange={(v) => update('walletDebit', v)}
          />
        </View>

        {/* ── Other ───────────────────────────── */}
        <Text style={styles.sectionLabel}>Other</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="campaign"
            iconColor="#6b7280"
            iconBg="#f3f4f6"
            label="Promotions & News"
            description="Special offers and platform updates"
            value={prefs.promotions}
            onValueChange={(v) => update('promotions', v)}
          />
        </View>

        <Text style={styles.footerNote}>
          These settings control local notification preferences. Push notifications for critical
          ride safety updates cannot be disabled.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f1f1',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  headerSpacer: {
    width: 36,
  },
  body: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  toggleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f5f5f5',
    marginLeft: 62,
  },
  footerNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
})

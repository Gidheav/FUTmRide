import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../core/api'

type NotifPrefs = {
  notif_sound_enabled: boolean
  notif_ride_requested: boolean
  notif_driver_assigned: boolean
  notif_driver_en_route: boolean
  notif_driver_arrived: boolean
  notif_trip_started: boolean
  notif_trip_completed: boolean
  notif_ride_cancelled: boolean
  notif_wallet_credit: boolean
  notif_wallet_debit: boolean
  notif_promotions: boolean
  email_announcements: boolean
  email_transactions: boolean
  email_rides: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  notif_sound_enabled: false,
  notif_ride_requested: false,
  notif_driver_assigned: false,
  notif_driver_en_route: false,
  notif_driver_arrived: false,
  notif_trip_started: false,
  notif_trip_completed: false,
  notif_ride_cancelled: false,
  notif_wallet_credit: false,
  notif_wallet_debit: false,
  notif_promotions: false,
  email_announcements: false,
  email_transactions: false,
  email_rides: false,
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
  disabled?: boolean
}

function ToggleRow({ icon, iconColor, iconBg, label, description, value, onValueChange, disabled }: ToggleRowProps) {
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
        disabled={disabled}
      />
    </View>
  )
}

export default function StudentNotificationSettingsPage({ onClose }: Props) {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    api.get('auth/settings/preferences/')
      .then((res) => {
        if (res.data) {
          setPrefs((prev) => ({ ...prev, ...res.data }))
        }
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false))
  }, [])

  const update = async (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setSaving(true)
    try {
      await api.patch('auth/settings/preferences/', { [key]: value })
    } catch {
      setPrefs(prefs)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.page}>
      {/* Removed header since StudentLayout handles it */}

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#6A1B9A" />
            <Text style={styles.loadingText}>Loading preferences...</Text>
          </View>
        ) : (
          <>
            {/* ── General ─────────────────────────── */}
            <Text style={styles.sectionLabel}>General</Text>
            <View style={styles.card}>
              <ToggleRow
                icon="volume-up"
                iconColor="#1565C0"
                iconBg="#e3f2fd"
                label="Notification Sound"
                description="Play sound for notifications"
                value={prefs.notif_sound_enabled}
                onValueChange={(v) => void update('notif_sound_enabled', v)}
                disabled={saving}
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
                value={prefs.notif_ride_requested}
                onValueChange={(v) => void update('notif_ride_requested', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="person"
                iconColor="#1565C0"
                iconBg="#e3f2fd"
                label="Driver Assigned"
                description="When a driver accepts your ride"
                value={prefs.notif_driver_assigned}
                onValueChange={(v) => void update('notif_driver_assigned', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="directions-car"
                iconColor="#E65100"
                iconBg="#fff3e0"
                label="Driver En Route"
                description="When your driver is heading to you"
                value={prefs.notif_driver_en_route}
                onValueChange={(v) => void update('notif_driver_en_route', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="place"
                iconColor="#2e7d32"
                iconBg="#e8f5e9"
                label="Driver Arrived"
                description="When driver arrives at pickup point"
                value={prefs.notif_driver_arrived}
                onValueChange={(v) => void update('notif_driver_arrived', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="navigation"
                iconColor="#E65100"
                iconBg="#fff3e0"
                label="Trip Started"
                description="When your trip begins"
                value={prefs.notif_trip_started}
                onValueChange={(v) => void update('notif_trip_started', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="check-circle"
                iconColor="#2e7d32"
                iconBg="#e8f5e9"
                label="Trip Completed"
                description="When your ride is finished"
                value={prefs.notif_trip_completed}
                onValueChange={(v) => void update('notif_trip_completed', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="cancel"
                iconColor="#b91c1c"
                iconBg="#fef2f2"
                label="Ride Cancelled"
                description="When a ride is cancelled"
                value={prefs.notif_ride_cancelled}
                onValueChange={(v) => void update('notif_ride_cancelled', v)}
                disabled={saving}
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
                value={prefs.notif_wallet_credit}
                onValueChange={(v) => void update('notif_wallet_credit', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="arrow-upward"
                iconColor="#b91c1c"
                iconBg="#fef2f2"
                label="Wallet Debit"
                description="Ride payments and deductions"
                value={prefs.notif_wallet_debit}
                onValueChange={(v) => void update('notif_wallet_debit', v)}
                disabled={saving}
              />
            </View>

            {/* ── Email Notifications ─────────────── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Email Notifications</Text>
              {saving && <ActivityIndicator size="small" color="#6A1B9A" style={{ marginLeft: 8, marginBottom: 6 }} />}
            </View>
            <View style={styles.card}>
              <ToggleRow
                icon="campaign"
                iconColor="#6A1B9A"
                iconBg="#f3e5f5"
                label="Announcements"
                description="Receive emails for platform announcements"
                value={prefs.email_announcements}
                onValueChange={(v) => void update('email_announcements', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="account-balance-wallet"
                iconColor="#2e7d32"
                iconBg="#e8f5e9"
                label="Transactions"
                description="Email receipts for wallet top-ups and payments"
                value={prefs.email_transactions}
                onValueChange={(v) => void update('email_transactions', v)}
                disabled={saving}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="directions-car"
                iconColor="#1565C0"
                iconBg="#e3f2fd"
                label="Ride Updates"
                description="Email summaries for completed rides"
                value={prefs.email_rides}
                onValueChange={(v) => void update('email_rides', v)}
                disabled={saving}
              />
            </View>

            {/* ── Other ───────────────────────────── */}
            <Text style={styles.sectionLabel}>Other</Text>
            <View style={styles.card}>
              <ToggleRow
                icon="local-offer"
                iconColor="#6b7280"
                iconBg="#f3f4f6"
                label="Promotions & News"
                description="Special offers and platform updates"
                value={prefs.notif_promotions}
                onValueChange={(v) => void update('notif_promotions', v)}
                disabled={saving}
              />
            </View>

            <Text style={styles.footerNote}>
              Email preferences are synced to your account. Push notifications for critical
              ride safety updates cannot be disabled.
            </Text>
          </>
        )}
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
    paddingBottom: 8,
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
    padding: 14,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
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
    paddingVertical: 12,
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
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f5f5f5',
    marginLeft: 62,
  },
  centerLoading: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  footerNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
})

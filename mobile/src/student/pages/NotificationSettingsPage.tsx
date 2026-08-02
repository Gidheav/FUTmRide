import { useEffect, useState, useRef } from 'react'
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
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
  notif_sound_enabled: true,
  notif_ride_requested: true,
  notif_driver_assigned: true,
  notif_driver_en_route: true,
  notif_driver_arrived: true,
  notif_trip_started: true,
  notif_trip_completed: true,
  notif_ride_cancelled: true,
  notif_wallet_credit: true,
  notif_wallet_debit: true,
  notif_promotions: true,
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

// ── Premium Animated Pressable (consistent with Wallet) ──
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

// ── Premium Toggle Row ──
function ToggleRow({ icon, iconColor, iconBg, label, description, value, onValueChange, disabled }: ToggleRowProps) {
  return (
    <AnimatedPressable
      style={styles.toggleRow}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
    >
      <View style={[styles.toggleIconWrap, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E7EB', true: '#C084FC' }}
        thumbColor={value ? '#6A1B9A' : '#ffffff'}
        ios_backgroundColor="#E5E7EB"
        disabled={disabled}
      />
    </AnimatedPressable>
  )
}

// ── Section Header with accent ──
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
  )
}

export default function StudentNotificationSettingsPage({ onClose }: Props) {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
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

  // Optimistic update: toggle flips instantly, PATCH fires in background.
  // Only reverts the specific toggle on failure — page stays responsive.
  const update = (key: keyof NotifPrefs, value: boolean) => {
    const prev = prefs[key]
    setPrefs((current) => ({ ...current, [key]: value }))
    api.patch('auth/settings/preferences/', { [key]: value }).catch(() => {
      setPrefs((current) => ({ ...current, [key]: prev }))
    })
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {/* Decorative background accent */}
      <View style={styles.bgAccent} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#6A1B9A" />
            <Text style={styles.loadingText}>Loading preferences...</Text>
          </View>
        ) : (
          <>
            {/* ── General ─────────────────────────── */}
            <SectionHeader title="General" />
            <View style={styles.card}>
              <ToggleRow
                icon="volume-up"
                iconColor="#7C3AED"
                iconBg="#EDE9FE"
                label="Notification Sound"
                description="Play sound for notifications"
                value={prefs.notif_sound_enabled}
                onValueChange={(v) => void update('notif_sound_enabled', v)}
              />
            </View>

            {/* ── Ride Notifications ──────────────── */}
            <SectionHeader title="Ride Updates" />
            <View style={styles.card}>
              <ToggleRow
                icon="local-taxi"
                iconColor="#6A1B9A"
                iconBg="#F3E8FF"
                label="Ride Requested"
                description="When your ride request is submitted"
                value={prefs.notif_ride_requested}
                onValueChange={(v) => void update('notif_ride_requested', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="person"
                iconColor="#2563EB"
                iconBg="#DBEAFE"
                label="Driver Assigned"
                description="When a driver accepts your ride"
                value={prefs.notif_driver_assigned}
                onValueChange={(v) => void update('notif_driver_assigned', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="directions-car"
                iconColor="#EA580C"
                iconBg="#FFF7ED"
                label="Driver En Route"
                description="When your driver is heading to you"
                value={prefs.notif_driver_en_route}
                onValueChange={(v) => void update('notif_driver_en_route', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="place"
                iconColor="#16A34A"
                iconBg="#DCFCE7"
                label="Driver Arrived"
                description="When driver arrives at pickup point"
                value={prefs.notif_driver_arrived}
                onValueChange={(v) => void update('notif_driver_arrived', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="navigation"
                iconColor="#EA580C"
                iconBg="#FFF7ED"
                label="Trip Started"
                description="When your trip begins"
                value={prefs.notif_trip_started}
                onValueChange={(v) => void update('notif_trip_started', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="check-circle"
                iconColor="#16A34A"
                iconBg="#DCFCE7"
                label="Trip Completed"
                description="When your ride is finished"
                value={prefs.notif_trip_completed}
                onValueChange={(v) => void update('notif_trip_completed', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="cancel"
                iconColor="#DC2626"
                iconBg="#FEE2E2"
                label="Ride Cancelled"
                description="When a ride is cancelled"
                value={prefs.notif_ride_cancelled}
                onValueChange={(v) => void update('notif_ride_cancelled', v)}
              />
            </View>

            {/* ── Wallet Notifications ────────────── */}
            <SectionHeader title="Wallet & Payments" />
            <View style={styles.card}>
              <ToggleRow
                icon="arrow-downward"
                iconColor="#16A34A"
                iconBg="#DCFCE7"
                label="Wallet Credit"
                description="Top-up, refunds, and incoming transfers"
                value={prefs.notif_wallet_credit}
                onValueChange={(v) => void update('notif_wallet_credit', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="arrow-upward"
                iconColor="#DC2626"
                iconBg="#FEE2E2"
                label="Wallet Debit"
                description="Ride payments and deductions"
                value={prefs.notif_wallet_debit}
                onValueChange={(v) => void update('notif_wallet_debit', v)}
              />
            </View>

            {/* ── Email Notifications ─────────────── */}
            <SectionHeader title="Email Notifications" />
            <View style={styles.card}>
              <ToggleRow
                icon="campaign"
                iconColor="#6A1B9A"
                iconBg="#F3E8FF"
                label="Announcements"
                description="Receive emails for platform announcements"
                value={prefs.email_announcements}
                onValueChange={(v) => void update('email_announcements', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="account-balance-wallet"
                iconColor="#16A34A"
                iconBg="#DCFCE7"
                label="Transactions"
                description="Email receipts for wallet top-ups and payments"
                value={prefs.email_transactions}
                onValueChange={(v) => void update('email_transactions', v)}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="directions-car"
                iconColor="#2563EB"
                iconBg="#DBEAFE"
                label="Ride Updates"
                description="Email summaries for completed rides"
                value={prefs.email_rides}
                onValueChange={(v) => void update('email_rides', v)}
              />
            </View>

            {/* ── Other ───────────────────────────── */}
            <SectionHeader title="Other" />
            <View style={styles.card}>
              <ToggleRow
                icon="local-offer"
                iconColor="#6B7280"
                iconBg="#F3F4F6"
                label="Promotions & News"
                description="Special offers and platform updates"
                value={prefs.notif_promotions}
                onValueChange={(v) => void update('notif_promotions', v)}
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
    backgroundColor: '#F8F7F4', // warm off-white
  },
  bgAccent: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(106, 27, 154, 0.05)',
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 24, // 8-point spacing: 24 between sections
  },
  centerLoading: {
    flex: 1,
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    paddingLeft: 4,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#6A1B9A',
    marginRight: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // ── Card ──
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#6A1B9A',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(106, 27, 154, 0.05)',
    overflow: 'hidden',
  },

  // ── Toggle Row ──
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    minHeight: 56,
  },
  toggleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContent: {
    flex: 1,
    gap: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#6B7280',
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 70, // aligns with label start
  },

  // ── Footer ──
  footerNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 12,
    letterSpacing: 0.2,
  },
})
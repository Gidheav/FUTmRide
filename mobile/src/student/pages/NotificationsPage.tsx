import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import api from '../../core/api'
import LoadingOverlay from '../components/LoadingOverlay'

type NotificationsPageProps = {
  onClose: () => void
}

type NotificationItem = {
  id: string
  notification_type: string
  title: string
  body: string
  data: Record<string, any>
  is_read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }> = {
  ride_requested: { icon: 'local-taxi', color: '#6A1B9A', bg: '#f3e5f5' },
  driver_assigned: { icon: 'person', color: '#1565C0', bg: '#e3f2fd' },
  driver_arrived: { icon: 'place', color: '#2e7d32', bg: '#e8f5e9' },
  trip_started: { icon: 'navigation', color: '#E65100', bg: '#fff3e0' },
  trip_completed: { icon: 'check-circle', color: '#2e7d32', bg: '#e8f5e9' },
  ride_cancelled: { icon: 'cancel', color: '#b91c1c', bg: '#fef2f2' },
  payment_received: { icon: 'account-balance-wallet', color: '#6A1B9A', bg: '#f3e5f5' },
  payment_debited: { icon: 'payment', color: '#b91c1c', bg: '#fef2f2' },
  account_approved: { icon: 'verified', color: '#2e7d32', bg: '#e8f5e9' },
  general: { icon: 'notifications', color: '#6b7280', bg: '#f3f4f6' },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

export default function StudentNotificationsPage({ onClose }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null)
  const insets = useSafeAreaInsets()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('notifications/')
      const data = res.data?.results ?? res.data ?? []
      setNotifications(Array.isArray(data) ? data : [])
    } catch {
      // silent fail
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  const handleRefresh = () => {
    setRefreshing(true)
    void fetchNotifications()
  }

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`notifications/${id}/read/`)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    } catch {
      // silent
    }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await api.post('notifications/mark-all-read/')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      // silent
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const cfg = TYPE_ICONS[item.notification_type] || TYPE_ICONS.general
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
        activeOpacity={0.85}
        onPress={() => {
          if (!item.is_read) void handleMarkRead(item.id)
          setSelectedNotification(item)
        }}
      >
        <View style={[styles.notifIconWrap, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifTitleRow}>
            <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmpty = () => {
    if (loading) return null
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconWrap}>
          <MaterialIcons name="notifications-off" size={48} color="#d1d5db" />
        </View>
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptySubtitle}>
          You'll receive updates about your rides, payments, and account here.
        </Text>
      </View>
    )
  }

  // Keys to never show in the raw data rows for wallet transactions
  const HIDDEN_WALLET_KEYS = new Set(['wallet_balance', 'source', 'message'])

  if (selectedNotification) {
    const cfg = TYPE_ICONS[selectedNotification.notification_type] || TYPE_ICONS.general
    const isCredit = selectedNotification.notification_type === 'payment_received'
    const isDebit = selectedNotification.notification_type === 'payment_debited'
    const isTransaction = isCredit || isDebit
    const isBroadcast =
      selectedNotification.notification_type === 'broadcast' &&
      selectedNotification.data?.in_app_announcement === true

    // ── Rich announcement view ──────────────────────────────────────
    if (isBroadcast) {
      const announcementData = selectedNotification.data
      return (
        <View style={styles.page}>
          <View style={[styles.header, { paddingTop: Math.max(14, insets.top + 10) }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedNotification(null)}>
              <MaterialIcons name="arrow-back" size={22} color="#1a1c1c" />
            </TouchableOpacity>
            <Text style={styles.title}>Announcement</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Hero image */}
            {announcementData?.image_url ? (
              <Image
                source={{ uri: announcementData.image_url }}
                style={styles.announcementHero}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.announcementIconHero}>
                <View style={[styles.announcementIconCircle, { backgroundColor: '#f3e5f5' }]}>
                  <MaterialIcons
                    name={(announcementData?.icon_name as any) || 'campaign'}
                    size={48}
                    color="#6A1B9A"
                  />
                </View>
              </View>
            )}

            <View style={styles.announcementBody}>
              {/* Badge */}
              <View style={styles.announcementBadge}>
                <MaterialIcons name="campaign" size={12} color="#6A1B9A" />
                <Text style={styles.announcementBadgeText}>Announcement</Text>
              </View>

              {/* Title */}
              <Text style={styles.announcementTitle}>{selectedNotification.title}</Text>

              {/* Date */}
              <Text style={styles.announcementDate}>
                {new Date(selectedNotification.created_at).toLocaleString('en-NG', {
                  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>

              {/* Divider */}
              <View style={styles.announcementDivider} />

              {/* Body text */}
              <Text style={styles.announcementMessage}>{selectedNotification.body}</Text>

              {/* CTA button */}
              <TouchableOpacity
                style={styles.announcementCta}
                onPress={() => setSelectedNotification(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.announcementCtaText}>
                  {announcementData?.cta_label || 'Got it'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )
    }

    // Extract amount for prominent display on debit/credit
    const txAmount = selectedNotification.data?.amount
      ? `₦${Number(selectedNotification.data.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
      : null

    return (
      <View style={styles.page}>
        <View style={[styles.header, { paddingTop: Math.max(14, insets.top + 10) }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedNotification(null)}>
            <MaterialIcons name="arrow-back" size={22} color="#1a1c1c" />
          </TouchableOpacity>
          <Text style={styles.title}>Notification Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <MaterialIcons 
                name={isTransaction ? (isCredit ? 'check-circle' : 'receipt') : cfg.icon} 
                size={48} 
                color={isTransaction ? (isCredit ? '#2e7d32' : '#b91c1c') : cfg.color} 
              />
              {isTransaction && txAmount ? (
                <Text style={[styles.receiptAmount, { color: isCredit ? '#2e7d32' : '#b91c1c' }]}>
                  {isDebit ? '−' : '+'}{txAmount}
                </Text>
              ) : null}
              <Text style={styles.receiptTitle}>{selectedNotification.title}</Text>
              <Text style={styles.receiptDate}>
                {new Date(selectedNotification.created_at).toLocaleString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptBody}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Details</Text>
                <Text style={styles.receiptValue}>{selectedNotification.body}</Text>
              </View>

              {Object.entries(selectedNotification.data || {}).map(([key, value]) => {
                if (value === null || value === undefined || value === '') return null
                // Hide developer-facing keys and the amount (already shown prominently)
                if (HIDDEN_WALLET_KEYS.has(key)) return null
                if (isTransaction && key === 'amount') return null
                const formattedKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                return (
                  <View style={styles.receiptRow} key={key}>
                    <Text style={styles.receiptLabel}>{formattedKey}</Text>
                    <Text style={styles.receiptValue}>{String(value)}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.receiptDivider} />
            
            <TouchableOpacity 
              style={styles.receiptCloseButton}
              onPress={() => setSelectedNotification(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.receiptCloseText}>Back to Notifications</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: Math.max(14, insets.top + 10) }]}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={22} color="#1a1c1c" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllRead}
            disabled={markingAll}
            activeOpacity={0.85}
          >
            {markingAll ? (
              <LoadingOverlay visible={true} inline size={20} />
            ) : (
              <MaterialIcons name="done-all" size={20} color="#6A1B9A" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <MaterialIcons name="mark-email-unread" size={16} color="#6A1B9A" />
          <Text style={styles.unreadBannerText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <LoadingOverlay visible={true} inline size={40} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6A1B9A']} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  markAllButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e5f5',
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#faf5ff',
    borderBottomWidth: 1,
    borderBottomColor: '#ede5f5',
  },
  unreadBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A1B9A',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 5,
    paddingTop: 0,
    paddingBottom: 24,
  },
  listSeparator: {
    height: 0,
  },
  // Notification card
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  notifCardUnread: {
    backgroundColor: '#faf5ff',
    borderColor: '#ede5f5',
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6A1B9A',
  },
  notifBody: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  // Empty state
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Details/Receipt view
  detailsContent: {
    padding: 5,
    paddingBottom: 40,
  },
  receiptAmount: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 24,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  receiptHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
  },
  receiptDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  receiptDivider: {
    height: 0,
    borderTopWidth: 1,
    borderColor: '#e2e2e2',
    borderStyle: 'dashed',
    marginVertical: 16,
  },
  receiptBody: {
    gap: 16,
  },
  receiptRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  receiptLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  receiptValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1c',
    lineHeight: 20,
  },
  receiptCloseButton: {
    backgroundColor: '#f5effb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  receiptCloseText: {
    color: '#6A1B9A',
    fontWeight: '700',
    fontSize: 15,
  },
  // Rich announcement view styles
  announcementHero: {
    width: '100%',
    height: 220,
    backgroundColor: '#f3e5f5',
  },
  announcementIconHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#faf5ff',
  },
  announcementIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementBody: {
    padding: 24,
    paddingBottom: 48,
    backgroundColor: '#ffffff',
    flex: 1,
  },
  announcementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f3e5f5',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 14,
  },
  announcementBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6A1B9A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  announcementTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1c1c',
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  announcementDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 20,
  },
  announcementDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 20,
  },
  announcementMessage: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 32,
  },
  announcementCta: {
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  announcementCtaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
})

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'

import api from '../../core/api'
import LoadingOverlay from '../components/LoadingOverlay'
import LinkedText from '../components/LinkedText'
import { useWebPage } from '../context/WebPageContext'

type NotificationsPageProps = { onClose: () => void }
type NotificationItem = {
  id: string
  notification_type: string
  title: string
  body: string
  data: Record<string, any>
  is_read: boolean
  created_at: string
}

type FilterTab = 'All' | 'Unread' | 'Rides' | 'Payments' | 'Announcements'

const TYPE_ICONS: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }> = {
  ride_requested: { icon: 'local-taxi', color: '#6A1B9A', bg: '#F3E8FF' },
  driver_assigned: { icon: 'person', color: '#2563EB', bg: '#DBEAFE' },
  driver_arrived: { icon: 'place', color: '#16A34A', bg: '#DCFCE7' },
  trip_started: { icon: 'navigation', color: '#EA580C', bg: '#FFF7ED' },
  trip_completed: { icon: 'check-circle', color: '#16A34A', bg: '#DCFCE7' },
  ride_cancelled: { icon: 'cancel', color: '#DC2626', bg: '#FEE2E2' },
  payment_received: { icon: 'account-balance-wallet', color: '#6A1B9A', bg: '#F3E8FF' },
  payment_debited: { icon: 'payment', color: '#DC2626', bg: '#FEE2E2' },
  account_approved: { icon: 'verified', color: '#16A34A', bg: '#DCFCE7' },
  general: { icon: 'notifications', color: '#6B7280', bg: '#F3F4F6' },
}

const TYPE_CATEGORY: Record<string, 'Rides' | 'Payments' | 'Announcements' | 'General'> = {
  ride_requested: 'Rides',
  driver_assigned: 'Rides',
  driver_arrived: 'Rides',
  trip_started: 'Rides',
  trip_completed: 'Rides',
  ride_cancelled: 'Rides',
  payment_received: 'Payments',
  payment_debited: 'Payments',
  account_approved: 'General',
  general: 'General',
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

// ── Premium Animated Pressable ──
const AnimatedPressable = ({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
}: {
  children: React.ReactNode
  onPress?: () => void
  onLongPress?: () => void
  style?: any
  disabled?: boolean
}) => {
  const scale = useRef(new Animated.Value(1)).current
  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
  }
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.85}
      style={style}
    >
      {children}
    </TouchableOpacity>
  )
}

export default function StudentNotificationsPage({ onClose }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null)
  const [announcementVisible, setAnnouncementVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>('All')
  const slideAnim = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()
  const { openWebPage } = useWebPage()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('notifications/')
      const data = res.data?.results ?? res.data ?? []
      setNotifications(Array.isArray(data) ? data : [])
    } catch { /* silent */ } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { void fetchNotifications() }, [fetchNotifications])
  const handleRefresh = () => { setRefreshing(true); void fetchNotifications() }

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`notifications/${id}/read/`)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    } catch { /* silent */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`notifications/${id}/`)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch { /* silent */ }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await api.post('notifications/mark-all-read/')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch { /* silent */ } finally { setMarkingAll(false) }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const openAnnouncement = (item: NotificationItem) => {
    setSelectedNotification(item)
    setAnnouncementVisible(true)
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start()
  }
  const closeAnnouncement = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setAnnouncementVisible(false)
      setSelectedNotification(null)
    })
  }

  // ── Filtering ──
  const filteredNotifications = useMemo(() => {
    let list = notifications
    if (activeTab === 'Unread') list = list.filter((n) => !n.is_read)
    else if (activeTab === 'Rides') list = list.filter((n) => TYPE_CATEGORY[n.notification_type] === 'Rides')
    else if (activeTab === 'Payments') list = list.filter((n) => TYPE_CATEGORY[n.notification_type] === 'Payments')
    else if (activeTab === 'Announcements') list = list.filter((n) => n.notification_type === 'broadcast')
    return list
  }, [notifications, activeTab])

  // ── Notification Card with long-press actions ──
  const [actionItemId, setActionItemId] = useState<string | null>(null)

  const renderNotificationCard = ({ item }: { item: NotificationItem }) => {
    const cfg = TYPE_ICONS[item.notification_type] || TYPE_ICONS.general
    const isBroadcast = item.notification_type === 'broadcast' && item.data?.in_app_announcement === true
    const categoryLabel = TYPE_CATEGORY[item.notification_type] || 'General'
    const showActions = actionItemId === item.id

    return (
      <View>
        <AnimatedPressable
          style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
          onPress={() => {
            if (showActions) { setActionItemId(null); return }
            if (!item.is_read) void handleMarkRead(item.id)
            if (isBroadcast) openAnnouncement(item)
            else setSelectedNotification(item)
          }}
          onLongPress={() => setActionItemId(showActions ? null : item.id)}
        >
          <View style={styles.notifCardLeft}>
            <View style={[styles.notifIconWrap, { backgroundColor: cfg.bg }]}>
              <MaterialIcons name={cfg.icon} size={20} color={cfg.color} />
            </View>
            <View style={styles.notifContent}>
              <View style={styles.notifTitleRow}>
                <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
                {!item.is_read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifBody} numberOfLines={1}>{item.body}</Text>
              <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </AnimatedPressable>
        {showActions && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtnRead} onPress={() => { handleMarkRead(item.id); setActionItemId(null) }}>
              <MaterialIcons name="mark-email-read" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Mark Read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnDelete} onPress={() => { handleDelete(item.id); setActionItemId(null) }}>
              <MaterialIcons name="delete" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  const renderEmpty = () => {
    if (loading) return null
    const emptyMessages: Record<FilterTab, { title: string; subtitle: string }> = {
      All: { title: 'All quiet here', subtitle: 'Ride updates, payments, and announcements will appear here.' },
      Unread: { title: 'Nothing unread', subtitle: 'You\'re all caught up! Great job.' },
      Rides: { title: 'No ride updates', subtitle: 'Your ride activity will show up here.' },
      Payments: { title: 'No payment activity', subtitle: 'Wallet transactions and receipts will appear here.' },
      Announcements: { title: 'No announcements', subtitle: 'Important news from the university will be shared here.' },
    }
    const msg = emptyMessages[activeTab] || emptyMessages.All
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconWrap}>
          <MaterialIcons name={activeTab === 'Unread' ? 'done-all' : 'notifications-off'} size={48} color="#D1D5DB" />
        </View>
        <Text style={styles.emptyTitle}>{msg.title}</Text>
        <Text style={styles.emptySubtitle}>{msg.subtitle}</Text>
      </View>
    )
  }

  // ── Detail / Receipt Modal ──
  const renderDetailModal = () => {
    if (!selectedNotification || announcementVisible) return null
    const item = selectedNotification
    const cfg = TYPE_ICONS[item.notification_type] || TYPE_ICONS.general
    const isCredit = item.notification_type === 'payment_received'
    const isDebit = item.notification_type === 'payment_debited'
    const isTransaction = isCredit || isDebit
    const txAmount = item.data?.amount
      ? `₦${Number(item.data.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
      : null
    const HIDDEN_WALLET_KEYS = new Set(['wallet_balance', 'source', 'message'])

    return (
      <Modal visible transparent animationType="slide" statusBarTranslucent>
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={styles.detailIconWrap}>
                <MaterialIcons name={isTransaction ? (isCredit ? 'check-circle' : 'receipt') : cfg.icon} size={40} color={isTransaction ? (isCredit ? '#16A34A' : '#DC2626') : cfg.color} />
              </View>
              {isTransaction && txAmount && (
                <Text style={[styles.detailAmount, { color: isCredit ? '#16A34A' : '#DC2626' }]}>
                  {isDebit ? '−' : '+'}{txAmount}
                </Text>
              )}
              <Text style={styles.detailTitle}>{item.title}</Text>
              <Text style={styles.detailDate}>
                {new Date(item.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.detailDivider} />
            <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Details</Text>
                <Text style={styles.detailValue}>{item.body}</Text>
              </View>
              {Object.entries(item.data || {}).map(([key, value]) => {
                if (value === null || value === undefined || value === '') return null
                if (HIDDEN_WALLET_KEYS.has(key)) return null
                if (isTransaction && key === 'amount') return null
                const formattedKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                return (
                  <View style={styles.detailRow} key={key}>
                    <Text style={styles.detailLabel}>{formattedKey}</Text>
                    <Text style={styles.detailValue}>{String(value)}</Text>
                  </View>
                )
              })}
            </ScrollView>
            <View style={styles.detailDivider} />
            <AnimatedPressable style={styles.detailCloseButton} onPress={() => setSelectedNotification(null)}>
              <Text style={styles.detailCloseText}>Close</Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>
    )
  }

  // ── Announcement Bottom Sheet (Competition Grade) ──
  const renderAnnouncementSheet = () => {
    if (!selectedNotification || !announcementVisible) return null
    const item = selectedNotification
    const data = item.data
    const sheetHeight = Dimensions.get('window').height * 0.78
    const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] })
    const ctaUrl = typeof data?.cta_url === 'string' && data.cta_url.trim() ? data.cta_url : typeof data?.web_url === 'string' && data.web_url.trim() ? data.web_url : ''

    const handleCta = () => { closeAnnouncement(); if (ctaUrl) setTimeout(() => openWebPage(ctaUrl, data?.web_title || item.title), 250) }

    return (
      <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={closeAnnouncement}>
        <TouchableWithoutFeedback onPress={closeAnnouncement}>
          <View style={styles.sheetScrim} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY }] }]}>
          <View style={styles.sheetHandle} />
          {data?.image_url ? (
            <Image source={{ uri: data.image_url }} style={styles.sheetHero} resizeMode="cover" />
          ) : (
            <View style={styles.sheetIconWrap}>
              <View style={styles.sheetIconCircle}><MaterialIcons name={(data?.icon_name as any) || 'campaign'} size={40} color="#6A1B9A" /></View>
              <View style={styles.sheetBadge}><MaterialIcons name="campaign" size={12} color="#6A1B9A" /><Text style={styles.sheetBadgeText}>ANNOUNCEMENT</Text></View>
            </View>
          )}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>{item.title}</Text>
            <Text style={styles.sheetDate}>{new Date(item.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            <View style={styles.sheetDivider} />
            <LinkedText text={item.body} style={styles.sheetBody} />
          </ScrollView>
          <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <AnimatedPressable style={styles.sheetCta} onPress={handleCta}><Text style={styles.sheetCtaText}>{data?.cta_label || 'Got it'}</Text></AnimatedPressable>
            {ctaUrl ? <AnimatedPressable style={styles.sheetDismiss} onPress={closeAnnouncement}><Text style={styles.sheetDismissText}>Dismiss</Text></AnimatedPressable> : null}
          </View>
        </Animated.View>
      </Modal>
    )
  }

  // ── Main Render ──
  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AnimatedPressable style={styles.backButton} onPress={onClose}><MaterialIcons name="arrow-back" size={22} color="#1A1A1A" /></AnimatedPressable>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <AnimatedPressable style={styles.markAllButton} onPress={handleMarkAllRead} disabled={markingAll}>
            <View style={styles.markAllContent}><MaterialIcons name="done-all" size={18} color="#6A1B9A" /><Text style={styles.markAllText}>Mark all</Text></View>
          </AnimatedPressable>
        ) : <View style={styles.headerSpacer} />}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['All', 'Unread', 'Rides', 'Payments', 'Announcements'] as FilterTab[]).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            {activeTab === tab && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Unread banner */}
      {unreadCount > 0 && activeTab === 'All' && (
        <View style={styles.unreadBanner}><MaterialIcons name="mark-email-unread" size={16} color="#6A1B9A" /><Text style={styles.unreadBannerText}>{unreadCount} unread</Text></View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}><LoadingOverlay visible inline size={40} /></View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotificationCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6A1B9A']} tintColor="#6A1B9A" />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {renderDetailModal()}
      {renderAnnouncementSheet()}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8F7F4' },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#ffffff', shadowColor: '#6A1B9A', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 },
  headerSpacer: { width: 40 },
  markAllButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3E8FF' },
  markAllContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markAllText: { fontSize: 13, fontWeight: '600', color: '#6A1B9A' },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tab: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 4, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280', letterSpacing: 0.2 },
  tabTextActive: { color: '#6A1B9A', fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 12, right: 12, height: 3, borderRadius: 2, backgroundColor: '#6A1B9A' },

  unreadBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FAF5FF', borderBottomWidth: 1, borderBottomColor: '#EDE5F5' },
  unreadBannerText: { fontSize: 13, fontWeight: '600', color: '#6A1B9A' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  listSeparator: { height: 0 },

  // Card (Redesigned like Wallet Transactions)
  notifCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0', backgroundColor: '#F8F7F4' },
  notifCardUnread: { backgroundColor: '#F3E8FF', borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -8 },
  notifCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12, marginRight: 12 },
  notifIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  notifTitle: { flex: 1, fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#1a1c1c', letterSpacing: -0.1 },
  notifBody: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#6B7280', marginBottom: 4 },
  notifTime: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#9CA3AF' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6A1B9A' },

  // Long-press action row
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingBottom: 8, marginTop: -4 },
  actionBtnRead: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  actionBtnDelete: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Empty
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  emptySubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  // Detail Modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.45)', alignItems: 'center', justifyContent: 'flex-end', padding: 16, paddingBottom: 32 },
  detailCard: { width: '100%', maxWidth: 400, backgroundColor: '#ffffff', borderRadius: 20, padding: 24, shadowColor: '#6A1B9A', shadowOpacity: 0.08, shadowRadius: 32, shadowOffset: { width: 0, height: 8 }, elevation: 12, maxHeight: '80%' },
  detailHeader: { alignItems: 'center', gap: 6, marginBottom: 12 },
  detailIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  detailAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  detailTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  detailDate: { fontSize: 13, color: '#6B7280' },
  detailDivider: { height: 0, borderTopWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', marginVertical: 16 },
  detailBody: { gap: 14, paddingHorizontal: 4 },
  detailRow: { flexDirection: 'column', alignItems: 'flex-start', gap: 4, marginBottom: 12 },
  detailLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', lineHeight: 22 },
  detailCloseButton: { backgroundColor: '#F3E8FF', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  detailCloseText: { color: '#6A1B9A', fontWeight: '700', fontSize: 16 },

  // Announcement Sheet
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,26,0.55)' },
  sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '78%', backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowColor: '#6A1B9A', shadowOpacity: 0.06, shadowRadius: 40, shadowOffset: { width: 0, height: -8 }, elevation: 20 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHero: { width: '100%', height: 180, backgroundColor: '#F3E8FF' },
  sheetIconWrap: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, gap: 12 },
  sheetIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#6A1B9A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  sheetBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FAF5FF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#EDE5F5' },
  sheetBadgeText: { fontSize: 10, fontWeight: '700', color: '#6A1B9A', letterSpacing: 0.8 },
  sheetContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.3, lineHeight: 30 },
  sheetDate: { fontSize: 13, color: '#9CA3AF', marginBottom: 16, fontWeight: '500' },
  sheetDivider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 16 },
  sheetBody: { fontSize: 16, color: '#374151', lineHeight: 26 },
  sheetFooter: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 10 },
  sheetCta: { backgroundColor: '#6A1B9A', borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#6A1B9A', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  sheetCtaText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  sheetDismiss: { paddingVertical: 8, alignItems: 'center' },
  sheetDismissText: { color: '#9CA3AF', fontWeight: '600', fontSize: 14 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
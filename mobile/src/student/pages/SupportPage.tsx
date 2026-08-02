import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../core/api'
import LoadingOverlay from '../components/LoadingOverlay'

type TicketCategory =
  | 'ride_issue'
  | 'payment_issue'
  | 'driver_complaint'
  | 'student_complaint'
  | 'account_issue'
  | 'other'

type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
type SupportMode = 'feedback' | 'problem' | 'complaint'
type ViewMode = 'home' | 'requests'

type Ticket = {
  id: string
  reference: string
  category: TicketCategory
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: TicketPriority
  resolution_notes?: string
  created_at: string
  resolved_at?: string | null
}

type SupportOption = {
  mode: SupportMode
  title: string
  subtitle: string
  icon: keyof typeof MaterialIcons.glyphMap
  color: string
  bg: string
  category: TicketCategory
  priority: TicketPriority
}

const SUPPORT_OPTIONS: SupportOption[] = [
  {
    mode: 'problem',
    title: 'Report a Problem',
    subtitle: 'Ride, payment, wallet, or account issue that needs help.',
    icon: 'report-problem',
    color: '#D97706', // amber-600
    bg: '#FFFBEB', // amber-50
    category: 'ride_issue',
    priority: 'medium',
  },
  {
    mode: 'feedback',
    title: 'Send Feedback',
    subtitle: 'Share ideas about the app experience or what we can improve.',
    icon: 'tips-and-updates',
    color: '#059669', // emerald-600
    bg: '#ECFDF5', // emerald-50
    category: 'other',
    priority: 'low',
  },
  {
    mode: 'complaint',
    title: 'Make a Complaint',
    subtitle: 'Formal complaint about a driver, ride, payment, or safety concern.',
    icon: 'gavel',
    color: '#DC2626', // red-600
    bg: '#FEF2F2', // red-50
    category: 'driver_complaint',
    priority: 'high',
  },
]

const CATEGORY_OPTIONS: { value: TicketCategory; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'ride_issue', label: 'Ride Issue', icon: 'local-taxi' },
  { value: 'payment_issue', label: 'Payment Issue', icon: 'account-balance-wallet' },
  { value: 'driver_complaint', label: 'Driver Complaint', icon: 'person-off' },
  { value: 'account_issue', label: 'Account Issue', icon: 'manage-accounts' },
  { value: 'other', label: 'App Feedback / Other', icon: 'chat-bubble-outline' },
]

const FAQ_ITEMS = [
  {
    icon: 'local-taxi' as const,
    title: 'Ride support',
    body: 'Use Report a Problem for cancelled rides, wrong pickup, fare issues, or trip delays.',
  },
  {
    icon: 'star-rate' as const,
    title: 'Driver ratings',
    body: 'Rate a driver after a completed ride. Use complaints only when admin should investigate.',
  },
  {
    icon: 'payments' as const,
    title: 'Wallet and payments',
    body: 'For failed top-ups, duplicate debits, or missing refunds, choose Payment Issue.',
  },
]

const STATUS_STYLE: Record<Ticket['status'], { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#B45309', bg: '#FEF3C7' },
  in_progress: { label: 'In Progress', color: '#1D4ED8', bg: '#DBEAFE' },
  resolved: { label: 'Resolved', color: '#15803D', bg: '#DCFCE7' },
  closed: { label: 'Closed', color: '#4B5563', bg: '#F3F4F6' },
}

const PRIORITY_STYLE: Record<TicketPriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: '#4B5563', bg: '#F3F4F6' },
  medium: { label: 'Medium', color: '#B45309', bg: '#FEF3C7' },
  high: { label: 'High', color: '#C2410C', bg: '#FFEDD5' },
  urgent: { label: 'Urgent', color: '#B91C1C', bg: '#FEE2E2' },
}

const categoryLabel = (category: string) =>
  category.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

export default function SupportPage({ 
  initialDisputeTx,
  onClearDispute
}: { 
  initialDisputeTx?: any
  onClearDispute?: () => void 
} = {}) {
  const insets = useSafeAreaInsets()
  const [viewMode, setViewMode] = useState<ViewMode>('home')
  const [formVisible, setFormVisible] = useState(false)
  const [ticketActionsVisible, setTicketActionsVisible] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [selectedOption, setSelectedOption] = useState<SupportOption>(SUPPORT_OPTIONS[0])
  const [category, setCategory] = useState<TicketCategory>(SUPPORT_OPTIONS[0].category)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  // Track if we are currently disputing a specific transaction
  const [transactionRef, setTransactionRef] = useState<string | null>(null)

  useEffect(() => {
    if (initialDisputeTx) {
      setTransactionRef(initialDisputeTx.reference)
      setSelectedOption(SUPPORT_OPTIONS[0]) // Report a Problem
      setCategory('payment_issue')
      setSubject(`Dispute Transaction: ${initialDisputeTx.reference}`)
      setDescription(`I would like to dispute the debit transaction of NGN ${initialDisputeTx.amount} on ${formatDate(initialDisputeTx.created_at)}.\n\nReason: `)
      setFormVisible(true)
    }
  }, [initialDisputeTx])

  const priority = useMemo<TicketPriority>(() => {
    if (selectedOption.mode === 'feedback') return 'low'
    if (category === 'driver_complaint' || selectedOption.mode === 'complaint') return 'high'
    if (category === 'payment_issue') return 'high'
    return selectedOption.priority
  }, [category, selectedOption])

  const openForm = (option: SupportOption) => {
    setSelectedOption(option)
    setCategory(option.category)
    setSubject('')
    setDescription('')
    setTransactionRef(null)
    setFormVisible(true)
  }

  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoadingTickets(true)
    try {
      const res = await api.get('support/tickets/mine/')
      const data = res.data?.results ?? res.data ?? []
      setTickets(Array.isArray(data) ? data : [])
    } catch {
      if (!silent) Alert.alert('Unable to load requests', 'Please check your connection and try again.')
    } finally {
      setLoadingTickets(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchTickets(true)
  }, [fetchTickets])

  const handleSubmit = async () => {
    const cleanSubject = subject.trim()
    const cleanDescription = description.trim()
    if (cleanSubject.length < 5) {
      Alert.alert('Add a subject', 'Please enter a short subject for this request.')
      return
    }
    if (cleanDescription.length < 15) {
      Alert.alert('Add more details', 'Please describe what happened so support can help properly.')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        category,
        subject: cleanSubject,
        description: cleanDescription,
        priority,
      }
      if (transactionRef) {
        payload.transaction_reference = transactionRef
      }
      const res = await api.post('support/tickets/', payload)
      const newTicket = res.data

      Alert.alert('Request Submitted', 'Support will review this shortly.')
      setTickets((prev) => [newTicket, ...prev])
      setFormVisible(false)
      setViewMode('requests')
      onClearDispute?.()
      setTransactionRef(null)
    } catch (err: any) {
      const message = err?.response?.data?.error?.message ||
        err?.response?.data?.subject?.[0] ||
        err?.response?.data?.description?.[0] ||
        'Unable to submit your request. Please try again.'
      Alert.alert('Submission failed', String(message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    void fetchTickets(true)
  }

  const openTicketActions = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setTicketActionsVisible(true)
  }

  const closeTicketActions = () => {
    setTicketActionsVisible(false)
    setSelectedTicket(null)
  }

  const handleTicketAction = async (action: 'close' | 'archive' | 'delete') => {
    const ticket = selectedTicket
    closeTicketActions()
    if (!ticket) return

    if (action === 'delete') {
      try {
        await api.delete(`support/tickets/${ticket.id}/`)
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id))
        Alert.alert('Ticket Deleted', 'The support request has been removed.')
      } catch {
        Alert.alert('Error', 'Unable to delete the ticket right now.')
      }
    } else if (action === 'close') {
      try {
        await api.patch(`support/tickets/${ticket.id}/`, { status: 'closed' })
        setTickets((prev) => prev.map((t) => t.id === ticket.id ? { ...t, status: 'closed' } : t))
      } catch {
        Alert.alert('Error', 'Unable to close the ticket right now.')
      }
    } else {
      // For archive, just hide it locally
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id))
    }
  }

  const renderTicket = ({ item }: { item: Ticket }) => {
    const status = STATUS_STYLE[item.status] || STATUS_STYLE.open
    const priorityStyle = PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.medium
    return (
      <TouchableOpacity
        style={styles.ticketCard}
        activeOpacity={0.92}
        onLongPress={() => openTicketActions(item)}
        delayLongPress={250}
      >
        <View style={styles.ticketHeader}>
          <View style={styles.ticketIconWrap}>
            <MaterialIcons name="confirmation-number" size={18} color="#6A1B9A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketRef}>{item.reference} · {categoryLabel(item.category)}</Text>
            <Text style={styles.ticketSubject}>{item.subject}</Text>
            <Text style={styles.ticketDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        <Text style={styles.ticketDescription} numberOfLines={3}>{item.description}</Text>
        <View style={styles.ticketMetaRow}>
          <View style={[styles.pill, { backgroundColor: status.bg }]}>
            <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: priorityStyle.bg }]}>
            <Text style={[styles.pillText, { color: priorityStyle.color }]}>{priorityStyle.label}</Text>
          </View>
        </View>
        {item.resolution_notes ? (
          <View style={styles.resolutionBox}>
            <Text style={styles.resolutionLabel}>Resolution</Text>
            <Text style={styles.resolutionText}>{item.resolution_notes}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Help & Support</Text>
          <Text style={styles.subtitle}>Feedback, complaints, and support requests in one place.</Text>
        </View>
      </View>

      <View style={styles.segmentWrap}>
        <TouchableOpacity
          style={[styles.segment, viewMode === 'home' && styles.segmentActive]}
          onPress={() => setViewMode('home')}
          activeOpacity={0.85}
        >
          <Text style={viewMode === 'home' ? styles.segmentTextActive : styles.segmentText}>Support</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, viewMode === 'requests' && styles.segmentActive]}
          onPress={() => {
            setViewMode('requests')
            void fetchTickets(true)
          }}
          activeOpacity={0.85}
        >
          <Text style={viewMode === 'requests' ? styles.segmentTextActive : styles.segmentText}>My Requests</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'home' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.optionsGrid}>
            {SUPPORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.mode}
                style={styles.optionCard}
                activeOpacity={0.88}
                onPress={() => openForm(option)}
              >
                <View style={[styles.optionIconWrap, { backgroundColor: option.bg }]}>
                  <MaterialIcons name={option.icon} size={28} color={option.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <View style={styles.optionChevron}>
                  <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Quick Help</Text>
          {FAQ_ITEMS.map((item) => (
            <View style={styles.faqCard} key={item.title}>
              <View style={styles.faqIconWrap}>
                <MaterialIcons name={item.icon} size={22} color="#6A1B9A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.faqTitle}>{item.title}</Text>
                <Text style={styles.faqBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.requestsWrap}>
          {loadingTickets ? (
            <View style={styles.loadingWrap}>
              <LoadingOverlay visible={true} inline size={36} />
            </View>
          ) : (
            <FlatList
              data={tickets}
              keyExtractor={(item) => item.id}
              renderItem={renderTicket}
              contentContainerStyle={tickets.length ? styles.ticketList : styles.emptyContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6A1B9A']} tintColor="#6A1B9A" />}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconBg}>
                    <MaterialIcons name="support-agent" size={46} color="#9ca3af" />
                  </View>
                  <Text style={styles.emptyTitle}>No requests yet</Text>
                  <Text style={styles.emptyText}>Submitted feedback, complaints, and support tickets will appear here.</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      <Modal visible={formVisible} animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalPage}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 18) }]}>
            <TouchableOpacity
              style={styles.closeButton}
              activeOpacity={0.8}
              onPress={() => {
                setFormVisible(false)
                onClearDispute?.()
                setTransactionRef(null)
              }}
              disabled={submitting}
            >
              <MaterialIcons name="close" size={24} color="#4b5563" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedOption.title}</Text>
            <View style={styles.closePlaceholder} />
          </View>

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.formIntro, { borderColor: selectedOption.color + '22', backgroundColor: selectedOption.bg }]}>
              <View style={styles.formIntroIcon}>
                <MaterialIcons name={selectedOption.icon} size={24} color={selectedOption.color} />
              </View>
              <Text style={[styles.formIntroText, { color: selectedOption.color }]}>{selectedOption.subtitle}</Text>
            </View>

            <Text style={styles.formLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_OPTIONS.map((item) => {
                const active = category === item.value
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.categoryButton, active && styles.categoryButtonActive]}
                    onPress={() => setCategory(item.value)}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name={item.icon} size={20} color={active ? '#6A1B9A' : '#6b7280'} />
                    <Text style={active ? styles.categoryTextActive : styles.categoryText}>{item.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.formLabel}>Subject</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Short title"
                placeholderTextColor="#9ca3af"
                style={styles.input}
                maxLength={120}
                selectionColor="#6A1B9A"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.formLabel}>Details</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Tell us what happened or what we can improve"
                placeholderTextColor="#9ca3af"
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                selectionColor="#6A1B9A"
              />
              <Text style={styles.counterText}>{description.length}/1000</Text>
            </View>

            <View style={styles.priorityPreview}>
              <Text style={styles.priorityLabel}>Admin priority</Text>
              <View style={[styles.pill, { backgroundColor: PRIORITY_STYLE[priority].bg }]}>
                <Text style={[styles.pillText, { color: PRIORITY_STYLE[priority].color }]}>{PRIORITY_STYLE[priority].label}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.9}
            >
              <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
            </TouchableOpacity>
          </ScrollView>

          <LoadingOverlay visible={submitting} />
        </View>
      </Modal>

      <Modal
        visible={ticketActionsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeTicketActions}
      >
        <View style={styles.actionSheetOverlay}>
          <TouchableOpacity style={styles.actionSheetBackdrop} activeOpacity={1} onPress={closeTicketActions} />
          <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Ticket actions</Text>
            <Text style={styles.actionSheetSubtitle} numberOfLines={1}>
              {selectedTicket?.reference} · {selectedTicket ? categoryLabel(selectedTicket.category) : ''}
            </Text>

            <TouchableOpacity style={styles.actionRow} activeOpacity={0.85} onPress={() => handleTicketAction('close')}>
              <MaterialIcons name="close" size={20} color="#4b5563" />
              <Text style={styles.actionText}>Close Ticket</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} activeOpacity={0.85} onPress={() => handleTicketAction('archive')}>
              <MaterialIcons name="archive" size={20} color="#4b5563" />
              <Text style={styles.actionText}>Archive</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRowDanger} activeOpacity={0.85} onPress={() => handleTicketAction('delete')}>
              <MaterialIcons name="delete-outline" size={20} color="#dc2626" />
              <Text style={styles.actionTextDanger}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  headerTextWrap: {
    gap: 4,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#64748b',
  },
  segmentTextActive: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#0f172a',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 24,
  },
  optionsGrid: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  optionSubtitle: {
    marginTop: 4,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  optionChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: -0.3,
    marginTop: 8,
  },
  faqCard: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 12,
  },
  faqIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#0f172a',
  },
  faqBody: {
    marginTop: 4,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  requestsWrap: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  ticketHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  ticketIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketRef: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ticketSubject: {
    marginTop: 2,
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#0f172a',
  },
  ticketDate: {
    marginTop: 4,
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#64748b',
  },
  ticketDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  resolutionBox: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
    gap: 4,
  },
  resolutionLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#16a34a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resolutionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#14532d',
    lineHeight: 18,
  },
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 16,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  actionSheetBackdrop: {
    flex: 1,
  },
  actionSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  actionSheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#0f172a',
    textAlign: 'center',
  },
  actionSheetSubtitle: {
    marginTop: 4,
    marginBottom: 20,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
  },
  actionRowDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
  },
  actionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#1e293b',
  },
  actionTextDanger: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#dc2626',
  },
  modalPage: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePlaceholder: {
    width: 40,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
  },
  formIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  formIntroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formIntroText: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  formLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  categoryGrid: {
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoryButtonActive: {
    backgroundColor: '#f3e8ff',
    borderColor: '#6A1B9A',
  },
  categoryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: '#64748b',
  },
  categoryTextActive: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#6A1B9A',
  },
  fieldGroup: {
    gap: 10,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 140,
    lineHeight: 22,
  },
  counterText: {
    textAlign: 'right',
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: -4,
  },
  priorityPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  priorityLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#0f172a',
  },
  submitButton: {
    backgroundColor: '#6A1B9A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6A1B9A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  submitText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
})

import { useState, useCallback, type CSSProperties } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Bell, CheckCheck, Megaphone, X, Send,
  Car, CreditCard, ShieldCheck, AlertTriangle,
  Radio, Info, Users, Truck, ChevronDown,
  CheckCircle2, Clock, MessageSquare
} from 'lucide-react'
import api from '../../core/api'
import { T } from '../theme'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Notification {
  id: string
  notification_type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
  data: Record<string, unknown>
}

type CategoryFilter = 'all' | 'rides' | 'payments' | 'verifications' | 'support' | 'system' | 'broadcasts'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TYPE_CATEGORY: Record<string, CategoryFilter> = {
  ride_requested: 'rides',
  driver_assigned: 'rides',
  driver_arrived: 'rides',
  trip_started: 'rides',
  trip_completed: 'rides',
  ride_cancelled: 'rides',
  payment_received: 'payments',
  account_approved: 'verifications',
  verification_submitted: 'verifications',
  support_ticket: 'support',
  broadcast: 'broadcasts',
  system_alert: 'system',
  general: 'system',
}

const TYPE_ICON: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  ride_requested:        { icon: Car,          color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  driver_assigned:       { icon: Truck,        color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  driver_arrived:        { icon: Truck,        color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  trip_started:          { icon: Radio,        color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  trip_completed:        { icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ride_cancelled:        { icon: X,            color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  payment_received:      { icon: CreditCard,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  account_approved:      { icon: ShieldCheck,  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  verification_submitted:{ icon: ShieldCheck,  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  support_ticket:        { icon: MessageSquare,color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  broadcast:             { icon: Megaphone,    color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  system_alert:          { icon: AlertTriangle,color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  general:               { icon: Info,         color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const CATEGORIES: { key: CategoryFilter; label: string; icon: typeof Bell }[] = [
  { key: 'all',           label: 'All',            icon: Bell },
  { key: 'rides',         label: 'Rides',          icon: Car },
  { key: 'payments',      label: 'Payments',        icon: CreditCard },
  { key: 'verifications', label: 'Verifications',  icon: ShieldCheck },
  { key: 'support',       label: 'Support',         icon: MessageSquare },
  { key: 'broadcasts',    label: 'Broadcasts',     icon: Megaphone },
  { key: 'system',        label: 'System',          icon: AlertTriangle },
]

// ─── Broadcast Composer Modal ─────────────────────────────────────────────────
interface BroadcastModalProps { onClose: () => void }

function BroadcastModal({ onClose }: BroadcastModalProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'students' | 'drivers' | 'all'>('all')
  const [type, setType] = useState('broadcast')
  const [preview, setPreview] = useState(false)
  const qc = useQueryClient()

  const sendMutation = useMutation({
    mutationFn: () => api.post('/notifications/broadcast/', { title, body, audience, notification_type: type }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] })
      alert(`✅ Broadcast sent to ${res.data.sent_count} users (${res.data.push_sent} push notifications).`)
      onClose()
    },
    onError: () => alert('❌ Failed to send broadcast. Please try again.'),
  })

  const canSend = title.trim() && body.trim()

  const audienceOptions = [
    { value: 'all', label: 'All Users', icon: Users },
    { value: 'students', label: 'Students Only', icon: Users },
    { value: 'drivers', label: 'Drivers Only', icon: Truck },
  ] as const

  const typeOptions = [
    { value: 'broadcast', label: 'Informational', color: T.accent },
    { value: 'system_alert', label: 'Alert', color: '#f59e0b' },
    { value: 'general', label: 'General', color: '#64748b' },
  ]

  return (
    <div style={ms.overlay}>
      <div style={ms.modal}>
        {/* Header */}
        <div style={ms.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={16} color={T.accent} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: T.textWhite }}>Broadcast Message</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Send a notification to selected users</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Audience */}
        <div style={ms.field}>
          <label style={ms.label}>Audience</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {audienceOptions.map(o => (
              <button key={o.value} onClick={() => setAudience(o.value)}
                style={{ ...ms.chip, ...(audience === o.value ? ms.chipActive : {}) }}>
                <o.icon size={13} />
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div style={ms.field}>
          <label style={ms.label}>Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {typeOptions.map(o => (
              <button key={o.value} onClick={() => setType(o.value)}
                style={{ ...ms.chip, ...(type === o.value ? { ...ms.chipActive, borderColor: o.color, color: o.color, background: `${o.color}18` } : {}) }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div style={ms.field}>
          <label style={ms.label}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Bus Route Update" maxLength={120}
            style={ms.input} />
          <div style={{ fontSize: 11, color: T.textMuted, textAlign: 'right', marginTop: 4 }}>{title.length}/120</div>
        </div>

        {/* Body */}
        <div style={ms.field}>
          <label style={ms.label}>Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your message to the users..." rows={4}
            style={{ ...ms.input, resize: 'vertical', minHeight: 96, fontFamily: T.fontFamily }} />
        </div>

        {/* Preview */}
        {preview && canSend && (
          <div style={ms.preview}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Preview</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Megaphone size={16} color={T.accent} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: T.textWhite }}>{title}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>{body}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
                  To: {audience === 'all' ? 'All Users' : audience === 'students' ? 'Students' : 'Drivers'} · Just now
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={() => setPreview(p => !p)}
            style={{ ...ms.btnSecondary }}>
            {preview ? 'Hide Preview' : 'Preview'}
          </button>
          <button onClick={onClose} style={ms.btnSecondary}>Cancel</button>
          <button onClick={() => sendMutation.mutate()} disabled={!canSend || sendMutation.isPending}
            style={{ ...ms.btnPrimary, opacity: !canSend || sendMutation.isPending ? 0.6 : 1 }}>
            <Send size={13} />
            {sendMutation.isPending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Notification Card ────────────────────────────────────────────────────────
function NotifCard({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const meta = TYPE_ICON[n.notification_type] ?? TYPE_ICON.general
  const IconComp = meta.icon

  return (
    <div
      onClick={() => { setExpanded(e => !e); if (!n.is_read) onRead(n.id) }}
      style={{
        ...s.card,
        background: n.is_read ? T.bgPanel : T.bgCard,
        borderLeft: n.is_read ? `3px solid transparent` : `3px solid ${T.accent}`,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Icon */}
        <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconComp size={16} color={meta.color} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: n.is_read ? 500 : 700, fontSize: 13, color: T.textWhite, lineHeight: 1.3 }}>
              {n.title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {!n.is_read && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent }} />
              )}
              <span style={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' }}>
                <Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                {timeAgo(n.created_at)}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: T.textSecondary, margin: '4px 0 0', lineHeight: 1.55,
            overflow: expanded ? 'visible' : 'hidden',
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 2,
            WebkitBoxOrient: 'vertical' as any,
          }}>
            {n.body}
          </p>
          {n.body.length > 120 && (
            <span style={{ fontSize: 11, color: T.accent, marginTop: 4, display: 'block' }}>
              {expanded ? 'Show less' : 'Show more'} <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : '', transition: 'transform 0.2s', verticalAlign: 'middle' }} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['admin-notifications'],
    queryFn: () => api.get('/notifications/').then(r => r.data.results ?? r.data),
    staleTime: 30000,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read/'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] })
    },
  })

  const handleRead = useCallback((id: string) => {
    markReadMutation.mutate(id)
  }, [])

  const filtered = notifications.filter(n =>
    category === 'all' ? true : TYPE_CATEGORY[n.notification_type] === category
  )

  const unreadCount = notifications.filter(n => !n.is_read).length
  const catCounts = CATEGORIES.reduce((acc, c) => {
    acc[c.key] = c.key === 'all'
      ? notifications.length
      : notifications.filter(n => TYPE_CATEGORY[n.notification_type] === c.key).length
    return acc
  }, {} as Record<CategoryFilter, number>)

  return (
    <div style={s.page}>
      {showBroadcast && <BroadcastModal onClose={() => setShowBroadcast(false)} />}

      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sideHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={18} color={T.accent} />
            <span style={{ fontWeight: 700, fontSize: 14, color: T.textWhite }}>Notifications</span>
          </div>
          {unreadCount > 0 && (
            <div style={{ background: T.accent, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', minWidth: 22, textAlign: 'center' }}>
              {unreadCount}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={s.statRow}>
          <div style={s.statBox}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.textWhite }}>{notifications.length}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Total</div>
          </div>
          <div style={s.statBox}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.accent }}>{unreadCount}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Unread</div>
          </div>
          <div style={s.statBox}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{notifications.length - unreadCount}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Read</div>
          </div>
        </div>

        {/* Categories */}
        <div style={s.catSection}>
          <div style={s.catTitle}>Categories</div>
          {CATEGORIES.map(c => {
            const Icon = c.icon
            const active = category === c.key
            return (
              <button key={c.key} onClick={() => setCategory(c.key)}
                style={{ ...s.catBtn, ...(active ? s.catBtnActive : {}) }}>
                <Icon size={14} color={active ? T.accent : T.textMuted} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12, color: active ? T.accent : T.textSecondary, fontWeight: active ? 600 : 400 }}>
                  {c.label}
                </span>
                {catCounts[c.key] > 0 && (
                  <span style={{ fontSize: 11, color: active ? T.accent : T.textMuted, fontWeight: 600 }}>
                    {catCounts[c.key]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div style={s.sideActions}>
          <button onClick={() => markAllReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            style={{ ...s.actionBtn, opacity: unreadCount === 0 ? 0.5 : 1 }}>
            <CheckCheck size={13} />
            Mark All Read
          </button>
          <button onClick={() => setShowBroadcast(true)} style={{ ...s.actionBtn, ...s.broadcastBtn }}>
            <Megaphone size={13} />
            Broadcast
          </button>
        </div>
      </aside>

      {/* ── Main Feed ── */}
      <main style={s.main}>
        <div style={s.feedHeader}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: T.textWhite }}>
              {CATEGORIES.find(c => c.key === category)?.label ?? 'All'} Notifications
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
              {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
            </div>
          </div>
        </div>

        <div style={s.feed}>
          {isLoading ? (
            <div style={s.emptyState}>
              <Bell size={40} color={T.border} style={{ marginBottom: 12 }} />
              <div style={{ color: T.textMuted, fontSize: 13 }}>Loading notifications...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={s.emptyState}>
              <Bell size={40} color={T.border} style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>No notifications</div>
              <div style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', maxWidth: 260 }}>
                {category === 'all'
                  ? 'System events will appear here as they happen.'
                  : `No ${category} notifications yet.`}
              </div>
            </div>
          ) : (
            filtered.map(n => <NotifCard key={n.id} n={n} onRead={handleRead} />)
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  page: { display: 'flex', height: 'calc(100vh - 44px)', background: T.bg, overflow: 'hidden' },

  sidebar: {
    width: 240, background: T.bgPanel, borderRight: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
  },
  sideHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 16px 12px', borderBottom: `1px solid ${T.border}`,
  },
  statRow: { display: 'flex', borderBottom: `1px solid ${T.border}` },
  statBox: { flex: 1, padding: '12px 8px', textAlign: 'center', borderRight: `1px solid ${T.border}` },
  catSection: { padding: '12px 10px', flex: 1 },
  catTitle: { fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingLeft: 6 },
  catBtn: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '8px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
    background: 'transparent', transition: 'all 0.15s',
  },
  catBtnActive: { background: T.accentBg },
  sideActions: { padding: '12px 10px', borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 6 },
  actionBtn: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 8,
    cursor: 'pointer', background: 'transparent', color: T.textSecondary,
    fontSize: 12, fontWeight: 600, fontFamily: T.fontFamily, transition: 'all 0.15s',
  },
  broadcastBtn: { background: T.accentBg, color: T.accent, borderColor: T.accent },

  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' },
  feedHeader: {
    padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
    background: T.bgPanel, flexShrink: 0,
  },
  feed: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 },
  card: {
    padding: '14px 16px', borderRadius: 10, border: `1px solid ${T.border}`,
    transition: 'all 0.15s', userSelect: 'none',
  },
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 48, color: T.textMuted,
  },
}

// ─── Modal Styles ─────────────────────────────────────────────────────────────
const ms: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 14,
    width: 520, maxWidth: '95vw', padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: T.textMuted },
  input: {
    background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8,
    padding: '10px 12px', color: T.textPrimary, fontSize: 13,
    fontFamily: T.fontFamily, outline: 'none', width: '100%',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 6, border: `1px solid ${T.border}`,
    background: 'transparent', color: T.textSecondary, cursor: 'pointer',
    fontSize: 12, fontWeight: 500, fontFamily: T.fontFamily, transition: 'all 0.15s',
  },
  chipActive: { borderColor: T.accent, color: T.accent, background: T.accentBg },
  preview: {
    background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16,
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '9px 18px', background: T.accent, border: 'none', borderRadius: 8,
    color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
    fontFamily: T.fontFamily, transition: 'all 0.15s',
  },
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '9px 18px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8,
    color: T.textSecondary, fontWeight: 600, fontSize: 13, cursor: 'pointer',
    fontFamily: T.fontFamily, transition: 'all 0.15s',
  },
}

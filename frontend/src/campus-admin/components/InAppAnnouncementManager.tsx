import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  Edit2,
  ExternalLink,
  Image,
  Megaphone,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import api from '../../core/api'
import { T } from '../theme'

type AnnouncementCampus = {
  id: string
  name: string
  code: string
}

type InAppAnnouncement = {
  id: string
  campaign_id: string
  title: string
  body: string
  image_url: string
  icon_name: string
  cta_label: string
  cta_url: string
  audience: 'all' | 'student' | 'driver'
  is_active: boolean
  send_push_notification: boolean
  starts_at: string | null
  ends_at: string | null
  priority: number
  campus: AnnouncementCampus | null
  created_at: string
  updated_at: string
}

type FormState = {
  campaign_id: string
  title: string
  body: string
  image_url: string
  icon_name: string
  cta_label: string
  cta_url: string
  audience: 'all' | 'student' | 'driver'
  is_active: boolean
  send_push_notification: boolean
  starts_at: string
  ends_at: string
  priority: string
}

const emptyForm: FormState = {
  campaign_id: '',
  title: '',
  body: '',
  image_url: '',
  icon_name: 'campaign',
  cta_label: 'Got it',
  cta_url: '',
  audience: 'all',
  is_active: false,
  send_push_notification: false,
  starts_at: '',
  ends_at: '',
  priority: '0',
}

const toList = (data: any): InAppAnnouncement[] => data?.results ?? data ?? []

const toDateInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const toApiStartDateTime = (value: string) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
}

const toApiEndDateTime = (value: string) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString()
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Any time'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 54)

const getErrorMessage = (error: any) => {
  const data = error?.response?.data
  if (!data) return error?.message || 'Request failed. Please try again.'
  if (typeof data === 'string') return data
  if (data.detail) return String(data.detail)
  if (data.error) return String(data.error)
  
  // Try to parse the first key/value pair nicely
  try {
    const firstKey = Object.keys(data)[0]
    const firstValue = firstKey ? data[firstKey] : null
    
    let messageStr = ''
    if (Array.isArray(firstValue)) {
      messageStr = typeof firstValue[0] === 'object' ? JSON.stringify(firstValue[0]) : String(firstValue[0])
    } else if (typeof firstValue === 'object' && firstValue !== null) {
      messageStr = JSON.stringify(firstValue)
    } else if (firstValue !== undefined && firstValue !== null) {
      messageStr = String(firstValue)
    }
    
    if (messageStr) return `${firstKey}: ${messageStr}`
  } catch (e) {
    // Ignore and fallback
  }

  // Fallback to full JSON stringification
  try {
    return JSON.stringify(data)
  } catch {
    return 'Request failed. Please check the form.'
  }
}

const formFromAnnouncement = (item: InAppAnnouncement): FormState => ({
  campaign_id: item.campaign_id,
  title: item.title,
  body: item.body,
  image_url: item.image_url || '',
  icon_name: item.icon_name || 'campaign',
  cta_label: item.cta_label || 'Got it',
  cta_url: item.cta_url || '',
  audience: item.audience || 'all',
  is_active: item.is_active,
  send_push_notification: item.send_push_notification || false,
  starts_at: toDateInput(item.starts_at),
  ends_at: toDateInput(item.ends_at),
  priority: String(item.priority ?? 0),
})

export default function InAppAnnouncementManager() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<InAppAnnouncement | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const { data: announcements = [], isLoading } = useQuery<InAppAnnouncement[]>({
    queryKey: ['in-app-announcements'],
    queryFn: () => api.get('/notifications/announcements/admin/').then((r) => toList(r.data)),
    staleTime: 30000,
  })

  const activeCount = useMemo(
    () => announcements.filter((item) => item.is_active).length,
    [announcements],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        campaign_id: form.campaign_id.trim(),
        title: form.title.trim(),
        body: form.body.trim(),
        image_url: form.image_url.trim(),
        icon_name: form.icon_name.trim() || 'campaign',
        cta_label: form.cta_label.trim() || 'Got it',
        cta_url: form.cta_url.trim(),
        audience: form.audience,
        is_active: form.is_active,
        send_push_notification: form.send_push_notification,
        starts_at: toApiStartDateTime(form.starts_at),
        ends_at: toApiEndDateTime(form.ends_at),
        priority: Number(form.priority || 0),
      }
      if (editing) {
        return api.patch(`/notifications/announcements/admin/${editing.id}/`, payload)
      }
      return api.post('/notifications/announcements/admin/', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['in-app-announcements'] })
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm)
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const toggleMutation = useMutation({
    mutationFn: (item: InAppAnnouncement) =>
      api.patch(`/notifications/announcements/admin/${item.id}/`, { is_active: !item.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['in-app-announcements'] }),
    onError: (error) => alert(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/announcements/admin/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['in-app-announcements'] }),
    onError: (error) => alert(getErrorMessage(error)),
  })

  const retriggerMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/announcements/admin/${id}/retrigger/`),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['in-app-announcements'] })
      alert(data?.data?.message || 'Announcement retriggered successfully! It will now show up again for all users.')
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (item: InAppAnnouncement) => {
    setEditing(item)
    setForm(formFromAnnouncement(item))
    setFormOpen(true)
  }

  const handleGenerateCampaignId = () => {
    const base = slugify(form.title || 'announcement')
    const suffix = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    setForm((prev) => ({ ...prev, campaign_id: `${base}_${suffix}` }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.campaign_id.trim() || !form.title.trim() || !form.body.trim()) {
      alert('Campaign ID, title, and message are required.')
      return
    }
    saveMutation.mutate()
  }

  const handleDelete = (item: InAppAnnouncement) => {
    if (!confirm(`Delete "${item.title}"?`)) return
    deleteMutation.mutate(item.id)
  }

  const handleRetrigger = (item: InAppAnnouncement) => {
    if (!confirm(`Are you sure you want to retrigger "${item.title}"? This will reset its ID so users who have already seen it will see it again, and it will re-send the push notification if active.`)) return
    retriggerMutation.mutate(item.id)
  }

  return (
    <div style={s.shell}>
      {formOpen && (
        <div style={s.overlay}>
          <form style={s.modal} onSubmit={handleSubmit}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>{editing ? 'Edit In-app Announcement' : 'New In-app Announcement'}</div>
                <div style={s.modalSub}>{editing ? editing.campaign_id : 'Student app campaign'}</div>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} style={s.iconButton}>
                <X size={17} />
              </button>
            </div>

            <div style={s.formGrid}>
              <label style={s.fieldWide}>
                <span style={s.label}>Campaign ID</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={form.campaign_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, campaign_id: event.target.value }))}
                    placeholder="semester_update_v1"
                    style={s.input}
                  />
                  <button type="button" onClick={handleGenerateCampaignId} style={s.smallButton}>
                    Generate
                  </button>
                </div>
              </label>

              <label style={s.fieldWide}>
                <span style={s.label}>Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="New Semester Update"
                  maxLength={120}
                  style={s.input}
                />
              </label>

              <label style={s.fieldWide}>
                <span style={s.label}>Message</span>
                <textarea
                  value={form.body}
                  onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
                  rows={4}
                  style={{ ...s.input, resize: 'vertical', minHeight: 96, lineHeight: 1.5 }}
                />
              </label>

              <label style={s.field}>
                <span style={s.label}>CTA Button</span>
                <input
                  value={form.cta_label}
                  onChange={(event) => setForm((prev) => ({ ...prev, cta_label: event.target.value }))}
                  maxLength={30}
                  style={s.input}
                />
              </label>

              <label style={s.field}>
                <span style={s.label}>Priority</span>
                <input
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                  type="number"
                  min={0}
                  max={32767}
                  style={s.input}
                />
              </label>

              <label style={s.fieldWide}>
                <span style={s.label}>CTA URL</span>
                <input
                  value={form.cta_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, cta_url: event.target.value }))}
                  placeholder="https://example.com/page"
                  type="url"
                  style={s.input}
                />
              </label>

              <label style={s.fieldWide}>
                <span style={s.label}>Image URL</span>
                <input
                  value={form.image_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
                  placeholder="https://..."
                  style={s.input}
                />
              </label>

              <label style={s.field}>
                <span style={s.label}>Icon Name</span>
                <input
                  value={form.icon_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, icon_name: event.target.value }))}
                  placeholder="campaign"
                  style={s.input}
                />
              </label>

              <label style={s.field}>
                <span style={s.label}>Audience</span>
                <select
                  value={form.audience}
                  onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value as any }))}
                  style={s.input}
                >
                  <option value="all">All (Students & Drivers)</option>
                  <option value="student">Students Only</option>
                  <option value="driver">Drivers Only</option>
                </select>
              </label>

              <label style={s.field}>
                <span style={s.label}>Status</span>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  style={{ ...s.toggleButton, ...(form.is_active ? s.toggleButtonActive : {}) }}
                >
                  <Power size={13} />
                  {form.is_active ? 'Active' : 'Inactive'}
                </button>
              </label>

              <label style={s.field}>
                <span style={s.label}>Notifications</span>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, send_push_notification: !prev.send_push_notification }))}
                  style={{ ...s.toggleButton, ...(form.send_push_notification ? s.toggleButtonActive : {}) }}
                  title="If enabled, this will also send a push notification to all students."
                >
                  <Megaphone size={13} />
                  {form.send_push_notification ? 'Send Push' : 'No Push'}
                </button>
              </label>

              <label style={s.field}>
                <span style={s.label}>Start date</span>
                <input
                  value={form.starts_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
                  type="date"
                  style={s.input}
                />
              </label>

              <label style={s.field}>
                <span style={s.label}>End date</span>
                <input
                  value={form.ends_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
                  type="date"
                  style={s.input}
                />
              </label>
            </div>

            <div style={s.preview}>
              {form.image_url ? (
                <div style={{ ...s.previewImage, backgroundImage: `url(${form.image_url})` }} />
              ) : (
                <div style={s.previewIcon}>
                  <Megaphone size={24} />
                </div>
              )}
              <div style={s.previewTitle}>{form.title || 'Announcement title'}</div>
              <div style={s.previewBody}>{form.body || 'Message body appears here.'}</div>
              <div style={s.previewButton}>
                {form.cta_url ? <ExternalLink size={13} /> : null}
                {form.cta_label || 'Got it'}
              </div>
            </div>

            <div style={s.modalActions}>
              <button type="button" onClick={() => setFormOpen(false)} style={s.secondaryButton}>
                Cancel
              </button>
              <button type="submit" disabled={saveMutation.isPending} style={s.primaryButton}>
                {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Campaign'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={s.header}>
        <div>
          <div style={s.title}>In-app Announcements</div>
          <div style={s.subtitle}>{activeCount} active · {announcements.length} total</div>
        </div>
        <button type="button" onClick={openCreate} style={s.primaryButton}>
          <Plus size={14} />
          New Campaign
        </button>
      </div>

      <div style={s.grid}>
        {isLoading ? (
          <div style={s.empty}>Loading campaigns...</div>
        ) : announcements.length === 0 ? (
          <div style={s.empty}>No in-app campaigns yet.</div>
        ) : (
          announcements.map((item) => (
            <div key={item.id} style={s.card}>
              <div style={s.cardTop}>
                <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                  <div style={item.image_url ? s.imageBadge : s.badge}>
                    {item.image_url ? <Image size={18} /> : <Megaphone size={18} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={s.cardTitle}>{item.title}</div>
                    <div style={s.campaignId}>{item.campaign_id}</div>
                  </div>
                </div>
                <span style={{ ...s.status, ...(item.is_active ? s.statusActive : s.statusInactive) }}>
                  {item.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p style={s.body}>{item.body}</p>

              <div style={s.metaRow}>
                <span style={s.metaItem}><Calendar size={12} /> {formatDate(item.starts_at)}</span>
                <span style={s.metaItem}>Audience: {item.audience === 'all' ? 'All' : item.audience === 'student' ? 'Students' : 'Drivers'}</span>
                <span style={s.metaItem}>Priority {item.priority}</span>
                <span style={s.metaItem}>{item.campus?.code || 'Global'}</span>
                {item.cta_url ? <span style={s.metaItem}><ExternalLink size={12} /> CTA link</span> : null}
              </div>

              <div style={s.actions}>
                <button type="button" onClick={() => openEdit(item)} style={s.secondaryButton}>
                  <Edit2 size={13} />
                  Edit
                </button>
                <button type="button" onClick={() => toggleMutation.mutate(item)} style={s.secondaryButton}>
                  <Power size={13} />
                  {item.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button 
                  type="button" 
                  onClick={() => handleRetrigger(item)} 
                  style={s.secondaryButton}
                  title="Force this campaign to display again for everyone"
                >
                  <RefreshCw size={13} />
                  Retrigger
                </button>
                <button type="button" onClick={() => handleDelete(item)} style={s.dangerButton}>
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  shell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
    background: T.bg,
  },
  header: {
    padding: '14px 20px',
    borderBottom: `1px solid ${T.border}`,
    background: T.bgPanel,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontSize: 14, fontWeight: 700, color: T.textWhite },
  subtitle: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    alignContent: 'start',
    gap: 12,
  },
  card: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: T.accentBg,
    color: T.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  imageBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: 'rgba(16,185,129,0.12)',
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    color: T.textWhite,
    fontSize: 14,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  campaignId: { color: T.textMuted, fontSize: 11, marginTop: 3 },
  status: {
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  statusActive: { background: 'rgba(16,185,129,0.14)', color: '#10b981' },
  statusInactive: { background: 'rgba(100,116,139,0.14)', color: T.textMuted },
  body: {
    color: T.textSecondary,
    fontSize: 12,
    lineHeight: 1.55,
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as any,
    overflow: 'hidden',
  },
  metaRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  metaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    border: `1px solid ${T.border}`,
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 11,
    color: T.textMuted,
  },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 8,
    background: T.accent,
    color: '#ffffff',
    padding: '9px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    background: 'transparent',
    color: T.textSecondary,
    padding: '8px 11px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
  },
  dangerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 8,
    background: 'rgba(239,68,68,0.08)',
    color: '#ef4444',
    padding: '8px 11px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
  },
  empty: {
    minHeight: 220,
    border: `1px dashed ${T.border}`,
    borderRadius: 8,
    color: T.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gridColumn: '1 / -1',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(0,0,0,0.62)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: 760,
    maxWidth: '96vw',
    maxHeight: '92vh',
    overflowY: 'auto',
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  modalTitle: { color: T.textWhite, fontSize: 16, fontWeight: 800 },
  modalSub: { color: T.textMuted, fontSize: 11, marginTop: 3 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    color: T.textMuted,
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldWide: { gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, color: T.textMuted, fontWeight: 700 },
  input: {
    width: '100%',
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    background: T.bgInput,
    color: T.textPrimary,
    fontFamily: T.fontFamily,
    fontSize: 13,
    padding: '10px 11px',
    outline: 'none',
  },
  smallButton: {
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    background: T.bgCard,
    color: T.textSecondary,
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  toggleButton: {
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    background: 'transparent',
    color: T.textSecondary,
    height: 39,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: T.fontFamily,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  toggleButtonActive: { color: '#10b981', borderColor: '#10b981', background: 'rgba(16,185,129,0.1)' },
  preview: {
    width: 360,
    maxWidth: '100%',
    alignSelf: 'center',
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    background: T.bgCard,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: T.bgInput,
  },
  previewIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: T.accentBg,
    color: T.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: { color: T.textWhite, fontWeight: 800, textAlign: 'center', fontSize: 17 },
  previewBody: { color: T.textSecondary, textAlign: 'center', fontSize: 12, lineHeight: 1.5 },
  previewButton: {
    width: '100%',
    minHeight: 40,
    borderRadius: 8,
    background: T.accent,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontWeight: 800,
    fontSize: 12,
  },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
}

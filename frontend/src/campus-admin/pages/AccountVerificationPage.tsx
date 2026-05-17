import { type CSSProperties, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  UserCheck, CarFront, Filter, ZoomOut, ZoomIn, Download,
  X, Check, ChevronRight, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react'
import api from '../../core/api'
import { T } from '../theme'

const FONT = T.fontFamily

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountVerification {
  id: string
  driver: { id: string; full_name: string; email: string; phone_number: string; profile_photo: string | null }
  full_name: string; age: number; state_of_origin: string; address: string
  nin_number: string; nin_scan_url: string | null
  status: 'pending' | 'under_review' | 'approved' | 'rejected'
  rejection_reason: string; admin_notes: string
  reviewed_by_name: string | null; reviewed_at: string | null; submitted_at: string
}

interface PendingItem {
  id: string; type: 'account' | 'vehicle'; driver_id: string
  driver_name: string; driver_phone: string; profile_photo: string | null
  document_type: string | null; status: string; submitted_at: string
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    pending:       { color: T.warn,    bg: T.warnBg,   label: 'Pending' },
    under_review:  { color: T.blue,    bg: 'rgba(59,130,246,0.1)', label: 'Under Review' },
    approved:      { color: T.accent,  bg: T.accentBg, label: 'Approved' },
    rejected:      { color: T.error,   bg: 'rgba(239,68,68,0.1)', label: 'Rejected' },
  }
  const c = cfg[status] || cfg.pending
  return (
    <span style={{ ...s.badge, color: c.color, background: c.bg, border: `1px solid ${c.color}` }}>
      {c.label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AccountVerificationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [zoom, setZoom] = useState(100)

  // Pending submissions list (right sidebar)
  const { data: pendingData } = useQuery({
    queryKey: ['admin-pending', 'account'],
    queryFn: () => api.get('/verification/admin/pending/?type=account').then(r => r.data),
    refetchInterval: 30000,
  })
  const pendingList: PendingItem[] = pendingData?.results ?? []

  // Active selection detail
  const activeId = selectedId || (pendingList.find(p => p.type === 'account')?.id ?? null)

  // Load account list for left-sidebar selection
  const { data: accountListData } = useQuery({
    queryKey: ['admin-account-list'],
    queryFn: () => api.get('/verification/admin/account/').then(r => r.data),
    staleTime: 20000,
  })
  const accountList: AccountVerification[] = accountListData?.results ?? accountListData ?? []

  // Active account detail
  const activeAccountItem = pendingList.find(p => p.id === activeId)
  const activeDriverId = activeAccountItem?.driver_id

  const { data: detail, isLoading } = useQuery<AccountVerification>({
    queryKey: ['admin-account-detail', activeId],
    queryFn: () => api.get(`/verification/admin/account/${activeId}/`).then(r => r.data),
    enabled: !!activeId,
    staleTime: 10000,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ status, reason }: { status: 'approved' | 'rejected'; reason?: string }) =>
      api.patch(`/verification/admin/account/${detail?.id}/review/`, {
        status, admin_notes: adminNotes, rejection_reason: reason ?? '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-account-list'] })
      queryClient.invalidateQueries({ queryKey: ['admin-pending'] })
      queryClient.invalidateQueries({ queryKey: ['admin-account-detail', activeDriverId] })
      setAdminNotes('')
    },
  })

  const displayStatus = (reviewMutation.isSuccess && reviewMutation.variables?.status) || detail?.status || 'pending'
  const isFinalized = displayStatus === 'approved' || displayStatus === 'rejected'

  const handleAction = (action: 'approved' | 'rejected') => {
    if (action === 'rejected' && !adminNotes.trim()) {
      alert('Please enter a rejection reason in Admin Notes.')
      return
    }
    reviewMutation.mutate({ status: action, reason: action === 'rejected' ? adminNotes : undefined })
  }

  return (
    <div style={s.root}>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Left Sidebar: Applicant Profile ─────────────────────────────── */}
      <aside className="hide-scrollbar" style={s.sidebar}>
        <div style={s.profileHeader}>
          <div style={s.avatarWrap}>
            {detail?.driver.profile_photo ? (
              <img src={detail.driver.profile_photo} alt="Driver" style={s.avatarImg} />
            ) : (
              <div style={s.avatarInitial}>
                {detail?.driver.full_name?.[0] ?? '?'}
              </div>
            )}
          </div>
          <h2 style={s.profileName}>{detail?.driver.full_name ?? '—'}</h2>
          <p style={s.profileId}>{detail?.driver.phone_number ?? ''}</p>
          {detail && <StatusBadge status={displayStatus} />}
        </div>

        {/* Contact Info */}
        <div style={s.infoSection}>
          {[
            { label: 'Email', value: detail?.driver.email },
            { label: 'Address', value: detail?.address },
            { label: 'State of Origin', value: detail?.state_of_origin },
            { label: 'Age', value: detail?.age?.toString() },
          ].map(({ label, value }) => (
            <div key={label} style={s.infoBlock}>
              <span style={s.infoLabel}>{label}</span>
              <span style={s.infoValue}>{value ?? '—'}</span>
            </div>
          ))}
        </div>

        {/* Verification Checklist */}
        <div style={s.docListSection}>
          <h3 style={s.docListTitle}>Verification Checklist</h3>
          <div style={s.docList}>
            {[
              { label: 'Personal Info', done: displayStatus === 'approved', icon: UserCheck },
              { label: 'NIN Document', done: displayStatus === 'approved', icon: CheckCircle2 },
            ].map(({ label, done, icon: Icon }) => (
              <div key={label} style={{ ...s.docBtn, ...(done ? s.docBtnActive : {}) }}>
                <div style={s.docBtnInner}>
                  <Icon size={18} color={done ? T.accent : T.textMuted} />
                  <span style={done ? s.docBtnTextActive : s.docBtnText}>{label}</span>
                </div>
                {done
                  ? <CheckCircle2 size={18} color={T.accent} />
                  : <Clock size={18} color={T.textMuted} />
                }
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Middle: Document Viewer + Audit Panel ───────────────────────── */}
      <section style={s.mainArea}>
        <div style={s.mainContent}>

          {/* Fixed Document Header */}
          <div style={s.viewerHeader}>
            <div style={s.vhLeft}>
              <UserCheck size={18} color={T.textPrimary} />
              <span style={s.vhTitle}>NIN Document</span>
              {detail?.nin_number && (
                <span style={s.ninBadge}>NIN: {detail.nin_number.slice(0,3)}•••{detail.nin_number.slice(-4)}</span>
              )}
            </div>
            <div style={s.vhRight}>
              <button style={s.iconBtn} onClick={() => setZoom(z => Math.max(50, z - 25))}>
                <ZoomOut size={15} color={T.textSecondary} />
              </button>
              <span style={s.zoomText}>{zoom}%</span>
              <button style={s.iconBtn} onClick={() => setZoom(z => Math.min(200, z + 25))}>
                <ZoomIn size={15} color={T.textSecondary} />
              </button>
              <div style={s.vDivider} />
              {detail?.nin_scan_url && (
                <a href={detail.nin_scan_url} target="_blank" rel="noreferrer" style={s.textBtn}>
                  <Download size={14} /> <span>Download</span>
                </a>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="hide-scrollbar" style={s.mainScrollable}>

            {/* NIN Scan Viewer */}
            <div style={s.canvasWrap}>
              {isLoading ? (
                <span style={{ color: T.textMuted, fontSize: 13 }}>Loading…</span>
              ) : detail?.nin_scan_url ? (
                <img
                  src={detail.nin_scan_url}
                  alt="NIN document scan"
                  style={{ ...s.canvasImg, transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
                />
              ) : (
                <div style={s.noDoc}>
                  <AlertCircle size={32} color={T.textMuted} />
                  <span style={{ color: T.textMuted, fontSize: 13, marginTop: 8 }}>No NIN scan uploaded</span>
                </div>
              )}
            </div>

            {/* Extracted Info + Audit Actions */}
            <div style={s.bottomPanels}>

              {/* Extracted Info */}
              <div style={s.extractPanel}>
                <h3 style={s.panelTitle}>Submitted Information</h3>
                <div style={s.extractGrid}>
                  {[
                    { label: 'Full Name', value: detail?.full_name },
                    { label: 'NIN Number', value: detail?.nin_number },
                    { label: 'Age', value: detail?.age?.toString() },
                    { label: 'State of Origin', value: detail?.state_of_origin },
                  ].map(({ label, value }) => (
                    <div key={label} style={s.inputGroup}>
                      <label style={s.inputLabel}>{label}</label>
                      <input style={s.inputField} readOnly value={value ?? '—'} />
                    </div>
                  ))}
                  <div style={{ ...s.inputGroup, gridColumn: '1 / -1' }}>
                    <label style={s.inputLabel}>Home Address</label>
                    <input style={s.inputField} readOnly value={detail?.address ?? '—'} />
                  </div>
                </div>
              </div>

              {/* Audit Actions */}
              <div style={s.auditPanel}>
                <h3 style={s.panelTitleNoBorder}>Audit Actions</h3>
                {isFinalized ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <StatusBadge status={displayStatus} />
                    {(detail?.rejection_reason || (reviewMutation.isSuccess && reviewMutation.variables?.reason)) && (
                      <p style={{ fontSize: 12, color: T.textSecondary, margin: 0 }}>
                        Reason: {detail?.rejection_reason || reviewMutation.variables?.reason}
                      </p>
                    )}
                    {detail.reviewed_by_name && (
                      <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>
                        Reviewed by {detail.reviewed_by_name}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1, marginBottom: 12 }}>
                      <label style={s.inputLabel}>Admin Notes</label>
                      <textarea
                        style={s.textArea}
                        placeholder="Add notes before approving or rejecting…"
                        value={adminNotes}
                        onChange={e => setAdminNotes(e.target.value)}
                      />
                    </div>
                    <div style={s.actionBtns}>
                      <button
                        style={{ ...s.rejectBtn, opacity: (reviewMutation.isPending || !detail) ? 0.6 : 1 }}
                        onClick={() => handleAction('rejected')}
                        disabled={reviewMutation.isPending || !detail}
                      >
                        <X size={16} /> Reject
                      </button>
                      <button
                        style={{ ...s.approveBtn, opacity: (reviewMutation.isPending || !detail) ? 0.6 : 1 }}
                        onClick={() => handleAction('approved')}
                        disabled={reviewMutation.isPending || !detail}
                      >
                        <Check size={16} /> Approve
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Right Sidebar: Pending Submissions ──────────────────────────── */}
      <aside className="hide-scrollbar" style={s.rightSidebar}>
        <div style={s.pvHeader}>
          <div>
            <h3 style={s.pvTitle}>Pending Verifications</h3>
            <p style={s.pvSubtitle}>{pendingList.length} applications await review</p>
          </div>
          <button style={s.pvFilterBtn}><Filter size={15} /></button>
        </div>
        <div style={s.pvList}>
          {pendingList.filter(p => p.type === 'account').map(pv => (
            <div
              key={pv.id}
              style={{ ...s.pvItem, ...(pv.id === activeId ? s.pvItemActive : {}) }}
              onClick={() => {
                setSelectedId(pv.id)
                setAdminNotes('')
                reviewMutation.reset()
              }}
            >
              <div style={s.pvAvatarWrap}>
                {pv.profile_photo
                  ? <img src={pv.profile_photo} alt={pv.driver_name} style={s.pvAvatarImg} />
                  : <div style={s.pvAvatarInit}>{pv.driver_name?.[0] ?? '?'}</div>
                }
              </div>
              <div style={s.pvItemContent}>
                <div style={s.pvItemTop}>
                  <h4 style={s.pvItemName}>{pv.driver_name}</h4>
                  <span style={s.pvItemTime}>
                    {new Date(pv.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p style={s.pvItemIdStr}>{pv.driver_phone}</p>
                <div style={s.pvItemTag}>
                  <UserCheck size={10} style={{ marginRight: 4 }} />
                  Account Verification
                </div>
              </div>
            </div>
          ))}
          {pendingList.filter(p => p.type === 'account').length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
              No pending account verifications
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  root: { display: 'flex', flex: 1, minHeight: 0, background: T.bg, fontFamily: FONT },
  sidebar: {
    width: 300, background: T.bgPanel, borderRight: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', overflowY: 'auto',
  },
  profileHeader: {
    padding: '20px 16px', borderBottom: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: T.bgPanel, gap: 8,
  },
  avatarWrap: { width: 72, height: 72, borderRadius: 0, overflow: 'hidden', border: `1px solid ${T.border}`, marginBottom: 8 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: T.accentBg, color: T.accent, fontSize: 24, fontWeight: 700,
  },
  profileName: { fontSize: 14, fontWeight: 700, color: T.textPrimary, margin: 0, textTransform: 'uppercase' },
  profileId: { fontSize: 12, color: T.textSecondary, margin: 0 },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' },
  infoSection: { padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 },
  infoBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
  infoLabel: { fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' },
  infoValue: { fontSize: 13, color: T.textPrimary, fontWeight: 600 },
  docListSection: { display: 'flex', flexDirection: 'column', background: T.border, gap: 1 },
  docListTitle: { fontSize: 11, fontWeight: 700, color: T.textSecondary, margin: 0, padding: '10px 16px', background: T.bgCard, textTransform: 'uppercase', letterSpacing: '0.05em' },
  docList: { display: 'flex', flexDirection: 'column', gap: 1, background: T.border },
  docBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: T.bgPanel, border: 'none', cursor: 'default' },
  docBtnActive: { background: T.bgCardHover },
  docBtnInner: { display: 'flex', alignItems: 'center', gap: 10 },
  docBtnText: { fontSize: 13, color: T.textPrimary, fontWeight: 600 },
  docBtnTextActive: { fontSize: 13, fontWeight: 700, color: T.accent },

  mainArea: { flex: 1, display: 'flex', flexDirection: 'column', background: T.border, overflow: 'hidden' },
  mainContent: { flex: 1, display: 'flex', flexDirection: 'column', width: '100%', gap: 1, background: T.border, overflow: 'hidden' },
  viewerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: T.bgPanel, padding: '10px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0,
  },
  vhLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  vhTitle: { fontSize: 14, fontWeight: 700, color: T.textPrimary, textTransform: 'uppercase' },
  ninBadge: { fontSize: 11, fontWeight: 700, color: T.textMuted, background: T.bgCard, padding: '2px 8px', border: `1px solid ${T.border}` },
  vhRight: { display: 'flex', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 5, border: `1px solid ${T.border}`, background: T.bgCardHover, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  zoomText: { fontSize: 12, fontWeight: 600, color: T.textSecondary, padding: '0 6px' },
  vDivider: { width: 1, height: 18, background: T.border, margin: '0 6px' },
  textBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: `1px solid ${T.border}`, background: T.bgCardHover, color: T.textPrimary, fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textTransform: 'uppercase' },
  mainScrollable: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 1, background: T.border },
  canvasWrap: { flex: 1, minHeight: 320, background: T.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0 },
  canvasImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' },
  noDoc: { display: 'flex', flexDirection: 'column', alignItems: 'center', color: T.textMuted },
  bottomPanels: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1, background: T.border },
  extractPanel: { background: T.bgPanel, padding: 20 },
  panelTitle: { fontSize: 11, fontWeight: 700, color: T.textSecondary, margin: '0 0 14px', borderBottom: `1px solid ${T.border}`, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  panelTitleNoBorder: { fontSize: 11, fontWeight: 700, color: T.textSecondary, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  extractGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  inputLabel: { fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' },
  inputField: { width: '100%', background: T.bgCard, border: `1px solid ${T.borderLight}`, color: T.textPrimary, fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: FONT, fontWeight: 600, boxSizing: 'border-box' },
  auditPanel: { background: T.bgPanel, padding: 20, display: 'flex', flexDirection: 'column' },
  textArea: { width: '100%', height: 90, background: T.bgCard, border: `1px solid ${T.borderLight}`, color: T.textPrimary, fontSize: 13, padding: 10, outline: 'none', resize: 'none', fontFamily: FONT },
  actionBtns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  rejectBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: T.warnBg, color: T.error, padding: '10px 12px', border: `1px solid ${T.error}`, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, textTransform: 'uppercase' },
  approveBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: T.accentBg, color: T.accent, padding: '10px 12px', border: `1px solid ${T.accent}`, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, textTransform: 'uppercase' },
  rightSidebar: { width: 300, background: T.bgPanel, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  pvHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: T.bgCard, borderBottom: `1px solid ${T.border}` },
  pvTitle: { fontSize: 11, fontWeight: 700, color: T.textSecondary, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  pvSubtitle: { fontSize: 11, color: T.textMuted, margin: 0 },
  pvFilterBtn: { background: 'transparent', border: `1px solid ${T.border}`, color: T.textSecondary, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  pvList: { display: 'flex', flexDirection: 'column' },
  pvItem: { display: 'flex', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${T.border}`, borderLeft: '3px solid transparent', cursor: 'pointer', background: T.bgPanel },
  pvItemActive: { background: T.bgCardHover, borderLeft: `3px solid ${T.accent}` },
  pvAvatarWrap: { width: 36, height: 36, borderRadius: 0, overflow: 'hidden', flexShrink: 0, border: `1px solid ${T.borderLight}` },
  pvAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  pvAvatarInit: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, color: T.accent, fontSize: 14, fontWeight: 700 },
  pvItemContent: { flex: 1, minWidth: 0 },
  pvItemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  pvItemName: { fontSize: 13, fontWeight: 700, color: T.textPrimary, margin: 0 },
  pvItemTime: { fontSize: 10, fontWeight: 700, color: T.textSecondary, background: T.bgCard, padding: '2px 5px', border: `1px solid ${T.border}` },
  pvItemIdStr: { fontSize: 12, color: T.textSecondary, margin: '0 0 5px' },
  pvItemTag: { display: 'inline-flex', alignItems: 'center', background: T.bgCard, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: T.textSecondary, border: `1px solid ${T.border}` },
}

import { type CSSProperties, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Contact, CarFront, Shield, FileText,
  CheckCircle2, Circle, Clock,
  ZoomOut, ZoomIn, Download, X, Check, Filter, AlertCircle,
} from 'lucide-react'
import api from '../../core/api'
import { T } from '../theme'

const FONT = T.fontFamily

const REQUIRED_DOCS = [
  { type: 'drivers_license',     label: "Driver's Licence",     icon: Contact },
  { type: 'vehicle_registration', label: 'Vehicle Registration',  icon: CarFront },
  { type: 'vehicle_insurance',   label: 'Comprehensive Insurance', icon: Shield },
]

interface DriverDoc {
  id: string; document_type: string; file: string; file_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string; admin_notes: string; reviewed_at: string | null; uploaded_at: string
}

interface VehicleDetail {
  driver: { id: string; full_name: string; email: string; phone_number: string; profile_photo: string | null }
  account_verification_status: string | null
  documents: DriverDoc[]
}

interface PendingItem {
  id: string; type: 'account' | 'vehicle'; driver_id: string
  driver_name: string; driver_phone: string; profile_photo: string | null
  document_type: string | null; status: string; submitted_at: string
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    pending:  { color: T.warn, bg: T.warnBg, label: 'Pending' },
    approved: { color: T.accent, bg: T.accentBg, label: 'Approved' },
    rejected: { color: T.error, bg: 'rgba(239,68,68,0.1)', label: 'Rejected' },
  }
  const c = cfg[status] || cfg.pending
  return (
    <span style={{ ...s.badge, color: c.color, background: c.bg, border: `1px solid ${c.color}` }}>
      {c.label}
    </span>
  )
}

export default function VehicleVerificationPage() {
  const queryClient = useQueryClient()
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [activeDocType, setActiveDocType] = useState<string>('drivers_license')
  const [adminNotes, setAdminNotes] = useState('')
  const [zoom, setZoom] = useState(100)

  // Pending list for right sidebar
  const { data: pendingData } = useQuery({
    queryKey: ['admin-pending', 'vehicle'],
    queryFn: () => api.get('/verification/admin/pending/?type=vehicle').then(r => r.data),
    refetchInterval: 30000,
  })
  const pendingList: PendingItem[] = pendingData?.results ?? []

  const activeDriverId = selectedDriverId || pendingList.find(p => p.type === 'vehicle')?.driver_id || null

  // Vehicle detail for active driver
  const { data: detail, isLoading } = useQuery<VehicleDetail>({
    queryKey: ['admin-vehicle-detail', activeDriverId],
    queryFn: () => api.get(`/verification/admin/vehicle/${activeDriverId}/`).then(r => r.data),
    enabled: !!activeDriverId,
    staleTime: 10000,
  })

  const activeDoc = detail?.documents.find(d => d.document_type === activeDocType)

  const reviewMutation = useMutation({
    mutationFn: ({ docId, status, reason }: { docId: string; status: 'approved' | 'rejected'; reason?: string }) =>
      api.patch(`/verification/admin/documents/${docId}/review/`, {
        status, admin_notes: adminNotes, rejection_reason: reason ?? '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vehicle-detail', activeDriverId] })
      queryClient.invalidateQueries({ queryKey: ['admin-pending', 'vehicle'] })
      setAdminNotes('')
    },
  })

  const handleAction = (action: 'approved' | 'rejected') => {
    if (!activeDoc) return
    if (action === 'rejected' && !adminNotes.trim()) {
      alert('Please enter a rejection reason in Admin Notes.')
      return
    }
    reviewMutation.mutate({ docId: activeDoc.id, status: action, reason: action === 'rejected' ? adminNotes : undefined })
  }

  const currentDocStatus = (reviewMutation.isSuccess && activeDoc && reviewMutation.variables?.docId === activeDoc.id)
    ? reviewMutation.variables.status
    : activeDoc?.status ?? null

  const getDocStatus = (type: string) => {
    if (reviewMutation.isSuccess && activeDoc?.document_type === type && reviewMutation.variables?.docId === activeDoc.id) {
      return reviewMutation.variables.status
    }
    return detail?.documents.find(d => d.document_type === type)?.status ?? null
  }

  return (
    <div style={s.root}>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Left Sidebar ── */}
      <aside className="hide-scrollbar" style={s.sidebar}>
        <div style={s.profileHeader}>
          <div style={s.avatarWrap}>
            {detail?.driver.profile_photo
              ? <img src={detail.driver.profile_photo} alt="Driver" style={s.avatarImg} />
              : <div style={s.avatarInitial}>{detail?.driver.full_name?.[0] ?? '?'}</div>
            }
          </div>
          <h2 style={s.profileName}>{detail?.driver.full_name ?? '—'}</h2>
          <p style={s.profileId}>{detail?.driver.phone_number ?? ''}</p>
          {detail?.account_verification_status && <StatusBadge status={detail.account_verification_status} />}
        </div>

        <div style={s.infoSection}>
          {[
            { label: 'Email', value: detail?.driver.email },
            { label: 'Account Status', value: detail?.account_verification_status ?? 'Not Verified' },
          ].map(({ label, value }) => (
            <div key={label} style={s.infoBlock}>
              <span style={s.infoLabel}>{label}</span>
              <span style={s.infoValue}>{value ?? '—'}</span>
            </div>
          ))}
        </div>

        <div style={s.docListSection}>
          <h3 style={s.docListTitle}>Required Documents</h3>
          <div style={s.docList}>
            {REQUIRED_DOCS.map(({ type, label, icon: Icon }) => {
              const docStatus = getDocStatus(type)
              const isActive = type === activeDocType
              return (
                <button
                  key={type}
                  style={{ ...s.docBtn, ...(isActive ? s.docBtnActive : {}) }}
                  onClick={() => setActiveDocType(type)}
                >
                  <div style={s.docBtnInner}>
                    <Icon size={17} color={isActive ? T.accent : T.textMuted} />
                    <span style={isActive ? s.docBtnTextActive : s.docBtnText}>{label}</span>
                  </div>
                  {docStatus === 'approved'
                    ? <CheckCircle2 size={17} color={T.accent} />
                    : docStatus === 'pending'
                    ? <Clock size={17} color={T.warn} />
                    : docStatus === 'rejected'
                    ? <AlertCircle size={17} color={T.error} />
                    : <Circle size={17} color={T.textMuted} />
                  }
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      {/* ── Center: Document Viewer ── */}
      <section style={s.mainArea}>
        <div style={s.mainContent}>
          <div style={s.viewerHeader}>
            <div style={s.vhLeft}>
              <FileText size={17} color={T.textPrimary} />
              <span style={s.vhTitle}>
                {REQUIRED_DOCS.find(d => d.type === activeDocType)?.label ?? 'Document'}
              </span>
              {activeDoc && <StatusBadge status={activeDoc.status} />}
            </div>
            <div style={s.vhRight}>
              <button style={s.iconBtn} onClick={() => setZoom(z => Math.max(50, z - 25))}><ZoomOut size={14} /></button>
              <span style={s.zoomText}>{zoom}%</span>
              <button style={s.iconBtn} onClick={() => setZoom(z => Math.min(200, z + 25))}><ZoomIn size={14} /></button>
              <div style={s.vDivider} />
              {activeDoc?.file_url && (
                <a href={activeDoc.file_url} target="_blank" rel="noreferrer" style={s.textBtn}>
                  <Download size={13} /> <span>Download</span>
                </a>
              )}
            </div>
          </div>

          <div className="hide-scrollbar" style={s.mainScrollable}>
            <div style={s.canvasWrap}>
              {isLoading ? (
                <span style={{ color: T.textMuted, fontSize: 13 }}>Loading…</span>
              ) : activeDoc?.file_url ? (
                <img
                  src={activeDoc.file_url}
                  alt="Document scan"
                  style={{ ...s.canvasImg, transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
                />
              ) : (
                <div style={s.noDoc}>
                  <AlertCircle size={32} color={T.textMuted} />
                  <span style={{ color: T.textMuted, fontSize: 13, marginTop: 8 }}>
                    {activeDoc ? 'File not available' : 'Document not uploaded yet'}
                  </span>
                </div>
              )}
            </div>

            <div style={s.bottomPanels}>
              <div style={s.extractPanel}>
                <h3 style={s.panelTitle}>Document Details</h3>
                <div style={s.extractGrid}>
                  <div style={s.inputGroup}>
                    <label style={s.inputLabel}>Document Type</label>
                    <input style={s.inputField} readOnly value={REQUIRED_DOCS.find(d => d.type === activeDocType)?.label ?? '—'} />
                  </div>
                  <div style={s.inputGroup}>
                    <label style={s.inputLabel}>Status</label>
                    <input style={s.inputField} readOnly value={activeDoc?.status ?? 'Not Uploaded'} />
                  </div>
                  <div style={s.inputGroup}>
                    <label style={s.inputLabel}>Driver Name</label>
                    <input style={s.inputField} readOnly value={detail?.driver.full_name ?? '—'} />
                  </div>
                  <div style={s.inputGroup}>
                    <label style={s.inputLabel}>Uploaded At</label>
                    <input style={s.inputField} readOnly value={activeDoc?.uploaded_at ? new Date(activeDoc.uploaded_at).toLocaleDateString() : '—'} />
                  </div>
                </div>
                {activeDoc?.rejection_reason && (
                  <div style={{ marginTop: 12, padding: 10, background: 'rgba(239,68,68,0.08)', border: `1px solid ${T.error}` }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.error, textTransform: 'uppercase' }}>Rejection Reason: </span>
                    <span style={{ fontSize: 12, color: T.textSecondary }}>{activeDoc.rejection_reason}</span>
                  </div>
                )}
              </div>

              <div style={s.auditPanel}>
                <h3 style={s.panelTitleNoBorder}>Audit Actions</h3>
                {currentDocStatus === 'approved' || currentDocStatus === 'rejected' ? (
                  <div style={{ flex: 1 }}>
                    <StatusBadge status={currentDocStatus as any} />
                    {(activeDoc?.reviewed_at || reviewMutation.isSuccess) && (
                      <p style={{ fontSize: 11, color: T.textMuted, margin: '8px 0 0' }}>
                        Processed just now
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
                        style={{ ...s.rejectBtn, opacity: reviewMutation.isPending || !activeDoc ? 0.5 : 1 }}
                        onClick={() => handleAction('rejected')}
                        disabled={reviewMutation.isPending || !activeDoc}
                      >
                        <X size={15} /> Reject
                      </button>
                      <button
                        style={{ ...s.approveBtn, opacity: reviewMutation.isPending || !activeDoc ? 0.5 : 1 }}
                        onClick={() => handleAction('approved')}
                        disabled={reviewMutation.isPending || !activeDoc}
                      >
                        <Check size={15} /> Approve
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Right Sidebar: Pending List ── */}
      <aside className="hide-scrollbar" style={s.rightSidebar}>
        <div style={s.pvHeader}>
          <div>
            <h3 style={s.pvTitle}>Pending Vehicle Docs</h3>
            <p style={s.pvSubtitle}>{pendingList.filter(p => p.type === 'vehicle').length} drivers pending</p>
          </div>
          <button style={s.pvFilterBtn}><Filter size={15} /></button>
        </div>
        <div style={s.pvList}>
          {pendingList.filter(p => p.type === 'vehicle').map(pv => (
            <div
              key={pv.driver_id}
              style={{ ...s.pvItem, ...(pv.driver_id === activeDriverId ? s.pvItemActive : {}) }}
              onClick={() => {
                setSelectedDriverId(pv.driver_id)
                if (pv.document_type) setActiveDocType(pv.document_type)
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
                  <CarFront size={10} style={{ marginRight: 4 }} />
                  Vehicle Docs
                </div>
              </div>
            </div>
          ))}
          {pendingList.filter(p => p.type === 'vehicle').length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
              No pending vehicle verifications
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
  sidebar: { width: 300, background: T.bgPanel, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  profileHeader: { padding: '20px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: T.bgPanel, gap: 8 },
  avatarWrap: { width: 72, height: 72, borderRadius: 0, overflow: 'hidden', border: `1px solid ${T.border}`, marginBottom: 8 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, color: T.accent, fontSize: 24, fontWeight: 700 },
  profileName: { fontSize: 14, fontWeight: 700, color: T.textPrimary, margin: 0, textTransform: 'uppercase' },
  profileId: { fontSize: 12, color: T.textSecondary, margin: 0 },
  badge: { display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' },
  infoSection: { padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 },
  infoBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
  infoLabel: { fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' },
  infoValue: { fontSize: 13, color: T.textPrimary, fontWeight: 600 },
  docListSection: { display: 'flex', flexDirection: 'column', background: T.border, gap: 1 },
  docListTitle: { fontSize: 11, fontWeight: 700, color: T.textSecondary, margin: 0, padding: '10px 16px', background: T.bgCard, textTransform: 'uppercase', letterSpacing: '0.05em' },
  docList: { display: 'flex', flexDirection: 'column', gap: 1, background: T.border },
  docBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: T.bgPanel, border: 'none', cursor: 'pointer', transition: 'background 0.15s' },
  docBtnActive: { background: T.bgCardHover },
  docBtnInner: { display: 'flex', alignItems: 'center', gap: 10 },
  docBtnText: { fontSize: 13, color: T.textPrimary, fontWeight: 600 },
  docBtnTextActive: { fontSize: 13, fontWeight: 700, color: T.accent },
  mainArea: { flex: 1, display: 'flex', flexDirection: 'column', background: T.border, overflow: 'hidden' },
  mainContent: { flex: 1, display: 'flex', flexDirection: 'column', width: '100%', gap: 1, background: T.border, overflow: 'hidden' },
  viewerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgPanel, padding: '10px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 },
  vhLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  vhTitle: { fontSize: 14, fontWeight: 700, color: T.textPrimary, textTransform: 'uppercase' },
  vhRight: { display: 'flex', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 5, border: `1px solid ${T.border}`, background: T.bgCardHover, cursor: 'pointer', display: 'flex', alignItems: 'center', color: T.textSecondary },
  zoomText: { fontSize: 12, fontWeight: 600, color: T.textSecondary, padding: '0 6px' },
  vDivider: { width: 1, height: 18, background: T.border, margin: '0 6px' },
  textBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: `1px solid ${T.border}`, background: T.bgCardHover, color: T.textPrimary, fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textTransform: 'uppercase' },
  mainScrollable: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 1, background: T.border },
  canvasWrap: { flex: 1, minHeight: 320, background: T.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  canvasImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' },
  noDoc: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
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

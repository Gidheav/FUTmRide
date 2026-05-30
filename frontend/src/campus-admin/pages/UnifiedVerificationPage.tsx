import { type CSSProperties, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  ZoomOut, ZoomIn,
  X, Check, Clock, CheckCircle2, AlertCircle,
  CreditCard, FileText, ShieldCheck, Mail, Phone, MapPin, User,
  Calendar, ShieldAlert
} from 'lucide-react'
import api, { getMediaUrl } from '../../core/api'
import { T } from '../theme'

const FONT = T.fontFamily

// ─── Types ────────────────────────────────────────────────────────────────────
interface UnifiedVerificationData {
  driver: { id: string; full_name: string; email: string; phone_number: string; profile_photo: string | null; verification_status: string }
  account_verification: {
    id: string
    full_name: string; age: number; state_of_origin: string; address: string
    nin_number: string; nin_scan_url: string | null
    status: string; rejection_reason: string; admin_notes: string
    reviewed_by_name: string | null; reviewed_at: string | null; submitted_at: string
  } | null
  vehicle_documents: Array<{
    id: string; document_type: string; document_type_display: string
    status: string; rejection_reason: string; admin_notes: string
    file_url: string; uploaded_at: string
  }>
}

// ─── Circular Progress ────────────────────────────────────────────────────────
function CircularProgress({ percent }: { percent: number }) {
  const size = 52;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percent / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="transparent" stroke={T.border} strokeWidth={stroke}
        />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="transparent" stroke={T.accent} strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', fontSize: 11, fontWeight: 800, color: T.textWhite }}>
        {Math.round(percent)}%
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UnifiedVerificationPage() {
  const { driverId } = useParams()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'personal'
  const setActiveTab = (tab: string) => {
    const p = new URLSearchParams(searchParams)
    p.set('tab', tab)
    setSearchParams(p)
  }

  const [adminNotes, setAdminNotes] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [zoom, setZoom] = useState(100)
  
  const { data: detail, isLoading } = useQuery<UnifiedVerificationData>({
    queryKey: ['admin-unified-detail', driverId],
    queryFn: () => api.get(`/verification/admin/unified/${driverId}/`).then(r => r.data),
    enabled: !!driverId,
  })

  // Review Mutations
  const accountReviewMutation = useMutation({
    mutationFn: ({ status, reason }: { status: 'approved' | 'rejected'; reason?: string }) =>
      api.patch(`/verification/admin/account/${detail?.account_verification?.id}/review/`, {
        status, admin_notes: adminNotes, rejection_reason: reason ?? '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-unified-detail', driverId] })
      setAdminNotes('')
    },
  })

  const vehicleReviewMutation = useMutation({
    mutationFn: ({ docId, status, reason }: { docId: string; status: 'approved' | 'rejected'; reason?: string }) =>
      api.patch(`/verification/admin/documents/${docId}/review/`, {
        status, admin_notes: adminNotes, rejection_reason: reason ?? '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-unified-detail', driverId] })
      setAdminNotes('')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (reason: string) => 
      api.post(`/verification/admin/revoke/${driverId}/`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-unified-detail', driverId] })
      searchParams.delete('revoke')
      setSearchParams(searchParams)
      setRevokeReason('')
    },
  })

  if (isLoading) return <div style={{ color: '#fff', padding: 40 }}>Loading verification data...</div>
  if (!detail) return <div style={{ color: '#fff', padding: 40 }}>Driver not found.</div>

  const isVehicleDoc = !['personal', 'nin'].includes(activeTab)
  const currentDoc = detail?.vehicle_documents.find(d => d.document_type === activeTab)
  
  const displayStatus = isVehicleDoc 
    ? (vehicleReviewMutation.isSuccess && vehicleReviewMutation.variables?.docId === currentDoc?.id ? vehicleReviewMutation.variables.status : currentDoc?.status)
    : activeTab === 'personal' || activeTab === 'nin' 
      ? (accountReviewMutation.isSuccess ? accountReviewMutation.variables?.status : detail?.account_verification?.status)
      : null

  const isRevokeMode = searchParams.get('revoke') === 'true' && displayStatus === 'approved'
  const isProcessed = displayStatus === 'approved' || displayStatus === 'rejected'

  const handleReview = (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !adminNotes.trim()) {
      alert('Please provide a reason in Admin Notes.')
      return
    }
    if (isVehicleDoc) {
      if (currentDoc) vehicleReviewMutation.mutate({ docId: currentDoc.id, status, reason: adminNotes })
    } else {
      accountReviewMutation.mutate({ status, reason: adminNotes })
    }
  }

  const approvedCount = [
    detail.account_verification?.status === 'approved', // Personal
    detail.account_verification?.status === 'approved', // NIN
    detail.vehicle_documents.find(d => d.document_type === 'drivers_license')?.status === 'approved',
    detail.vehicle_documents.find(d => d.document_type === 'vehicle_registration')?.status === 'approved',
    detail.vehicle_documents.find(d => d.document_type === 'vehicle_insurance')?.status === 'approved',
  ].filter(Boolean).length;
  const progressPercent = (approvedCount / 5) * 100;

  return (
    <div style={s.root}>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Left Sidebar: Verification Menu ──────────────────────────────── */}
      <aside className="hide-scrollbar" style={s.sidebar}>
        <div style={s.profileHeader}>
          <div style={s.avatarWrap}>
            {detail.driver.profile_photo ? (
              <img src={getMediaUrl(detail.driver.profile_photo)} alt="Driver" style={s.avatarImg} />
            ) : (
              <div style={s.avatarInitial}>{detail.driver.full_name?.[0] ?? '?'}</div>
            )}
          </div>
          <h2 style={s.profileName}>{detail.driver.full_name}</h2>
          <p style={s.profileId}>{detail.driver.phone_number}</p>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress percent={progressPercent} />
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' }}>
              Verification Progress
            </div>
          </div>
        </div>

        <div style={s.docListSection}>
          <h3 style={s.docListTitle}>Identity Verification</h3>
          <div style={s.docList}>
            {[
              { id: 'personal', label: 'Personal Info', icon: User, status: detail.account_verification?.status },
              { id: 'nin', label: 'NIN Document', icon: CreditCard, status: detail.account_verification?.status },
            ].map(item => (
              <button
                key={item.id}
                style={{ ...s.docBtn, ...(activeTab === item.id ? s.docBtnActive : {}) }}
                onClick={() => { setActiveTab(item.id); setAdminNotes(''); }}
              >
                <div style={s.docBtnInner}>
                  <item.icon size={16} color={activeTab === item.id ? T.accent : T.textMuted} />
                  <span style={activeTab === item.id ? s.docBtnTextActive : s.docBtnText}>{item.label}</span>
                </div>
                <StatusIcon status={item.status} />
              </button>
            ))}
          </div>

          <h3 style={{ ...s.docListTitle, marginTop: 24 }}>Vehicle Verification</h3>
          <div style={s.docList}>
            {[
              { id: 'drivers_license', label: "Driver's License", icon: CreditCard },
              { id: 'vehicle_registration', label: 'Vehicle Registration', icon: FileText },
              { id: 'vehicle_insurance', label: 'Compliance Insurance', icon: ShieldCheck },
            ].map(item => {
              const doc = detail.vehicle_documents.find(d => d.document_type === item.id);
              const status = doc ? doc.status : null;
              return (
                <button
                  key={item.id}
                  style={{ ...s.docBtn, ...(activeTab === item.id ? s.docBtnActive : {}) }}
                  onClick={() => { setActiveTab(item.id); setAdminNotes(''); }}
                >
                  <div style={s.docBtnInner}>
                    <item.icon size={16} color={activeTab === item.id ? T.accent : T.textMuted} />
                    <span style={activeTab === item.id ? s.docBtnTextActive : s.docBtnText}>{item.label}</span>
                  </div>
                  <StatusIcon status={status} />
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Middle: Content Viewer ────────────────────────────────────────── */}
      <section style={s.mainArea}>
        <div style={s.viewerHeader}>
          <div style={s.vhLeft}>
            {activeTab === 'personal' ? (
              <>
                <User size={18} color={T.textPrimary} />
                <span style={s.vhTitle}>Personal Information</span>
              </>
            ) : activeTab === 'nin' ? (
              <>
                <CreditCard size={18} color={T.textPrimary} />
                <span style={s.vhTitle}>National Identity Number (NIN)</span>
              </>
            ) : (
              <>
                {activeTab === 'vehicle_insurance' ? <ShieldCheck size={18} color={T.textPrimary} /> :
                 activeTab === 'drivers_license' ? <CreditCard size={18} color={T.textPrimary} /> :
                 <FileText size={18} color={T.textPrimary} />}
                <span style={s.vhTitle}>
                  {activeTab === 'drivers_license' ? "Driver's License" :
                   activeTab === 'vehicle_registration' ? "Vehicle Registration" :
                   "Compliance Insurance"}
                </span>
              </>
            )}
          </div>
          <div style={s.vhRight}>
            {/* Status removed per request */}
          </div>
        </div>

        <div style={s.viewerContent}>
          {activeTab === 'personal' ? (
            <div style={s.personalGrid}>
              <InfoTile icon={User} label="Full Name" value={detail.account_verification?.full_name} />
              <InfoTile icon={Mail} label="Email Address" value={detail.driver.email} />
              <InfoTile icon={Phone} label="Phone Number" value={detail.driver.phone_number} />
              <InfoTile icon={Calendar} label="Age" value={detail.account_verification?.age.toString()} />
              <InfoTile icon={MapPin} label="State of Origin" value={detail.account_verification?.state_of_origin} />
              <InfoTile icon={MapPin} label="Residential Address" value={detail.account_verification?.address} full />
            </div>
          ) : (
            <div style={s.imageContainer}>
              {activeTab === 'nin' ? (
                detail.account_verification?.nin_scan_url ? (
                  <img 
                    src={getMediaUrl(detail.account_verification.nin_scan_url)} 
                    style={{ ...s.scanImg, transform: `scale(${zoom/100})` }} 
                    alt="NIN Scan"
                  />
                ) : <EmptyState message="No NIN scan uploaded" />
              ) : (
                currentDoc?.file_url ? (
                  <img 
                    src={getMediaUrl(currentDoc.file_url)} 
                    style={{ ...s.scanImg, transform: `scale(${zoom/100})` }} 
                    alt="Document"
                  />
                ) : <EmptyState message="No document file uploaded" />
              )}
              
              {(activeTab === 'nin' || isVehicleDoc) && (
                <div style={s.zoomControls}>
                  <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={s.zoomBtn}><ZoomOut size={16}/></button>
                  <span style={s.zoomText}>{zoom}%</span>
                  <button onClick={() => setZoom(z => Math.min(300, z + 10))} style={s.zoomBtn}><ZoomIn size={16}/></button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audit Footer */}
        <div style={s.auditFooter}>
          {!isProcessed && (
            <div style={s.auditLayout}>
              <div style={s.notesArea}>
                <label style={s.label}>Internal Admin Notes</label>
                <textarea 
                  style={s.textarea} 
                  placeholder="Review findings..." 
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                />
              </div>
              <div style={s.btnGroup}>
                <button 
                  style={s.rejectBtn} 
                  onClick={() => handleReview('rejected')}
                  disabled={!detail.account_verification && !isVehicleDoc}
                >
                  <X size={16} /> Reject
                </button>
                <button 
                  style={s.approveBtn} 
                  onClick={() => handleReview('approved')}
                  disabled={!detail.account_verification && !isVehicleDoc}
                >
                  <Check size={16} /> Approve
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Right Column: Revoke / Audit ───────────────────────────────────── */}
      <aside style={s.rightColumn}>
        {isRevokeMode ? (
          <div style={s.revokePanel}>
            <div style={s.revokeHeader}>
              <ShieldAlert size={20} color={T.textSecondary} />
              <h3 style={s.revokeTitle}>Revoke Verification</h3>
            </div>
            
            <div style={s.revokeInputSection}>
              <label style={s.label}>Reason for Revocation</label>
              <textarea 
                style={{ ...s.textarea, height: 120 }}
                placeholder="Explain why verification is being revoked..."
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
              />
            </div>

            <div style={s.revokeActions}>
              <button 
                style={s.cancelBtn} 
                onClick={() => {
                  searchParams.delete('revoke')
                  setSearchParams(searchParams)
                }}
              >
                Cancel
              </button>
              <button 
                style={s.confirmRevokeBtn}
                onClick={() => {
                  if (!revokeReason.trim()) return alert('Please enter a reason.')
                  if (confirm('Are you sure you want to revoke this driver\'s verification?')) {
                    revokeMutation.mutate(revokeReason)
                  }
                }}
                disabled={revokeMutation.isPending}
              >
                {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          </div>
        ) : (
          <div style={s.emptyRightContent}>
            <ShieldCheck size={48} color={T.border} style={{ opacity: 0.5, marginBottom: 16 }} />
            <p style={{ color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
              System Audit Log<br/>coming soon
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status?: string | null }) {
  if (!status) return <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.border }} />
  if (status === 'approved') return <CheckCircle2 size={14} color={T.accent} />
  if (status === 'rejected') return <AlertCircle size={14} color={T.error} />
  return <Clock size={14} color={T.warn} />
}

function InfoTile({ icon: Icon, label, value, full }: { icon: any; label: string; value?: string; full?: boolean }) {
  return (
    <div style={{ ...s.infoTile, gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={s.tileIcon}><Icon size={16} color={T.textMuted} /></div>
      <div>
        <div style={s.tileLabel}>{label}</div>
        <div style={s.tileValue}>{value ?? '—'}</div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={s.emptyState}>
      <AlertCircle size={40} color={T.textMuted} />
      <p style={{ color: T.textMuted, marginTop: 12 }}>{message}</p>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex', height: 'calc(100vh - 64px)', background: T.bg,
    color: T.textPrimary, fontFamily: FONT, overflow: 'hidden',
  },
  sidebar: {
    width: 280, background: T.bgPanel, borderRight: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
  },
  profileHeader: {
    padding: '24px 20px', borderBottom: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
  },
  avatarWrap: {
    width: 80, height: 80, borderRadius: '50%', background: T.accentDim,
    overflow: 'hidden', marginBottom: 12, border: `2px solid ${T.accent}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: 32, fontWeight: 700, color: '#fff' },
  profileName: { fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: T.textWhite },
  profileId: { fontSize: 13, color: T.textMuted, margin: 0 },
 
  docListSection: { padding: '20px 12px' },
  docListTitle: { 
    fontSize: 11, fontWeight: 700, color: T.textMuted, 
    textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 8px' 
  },
  docList: { display: 'flex', flexDirection: 'column', gap: 4 },
  docBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', border: 'none', background: 'transparent',
    borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', width: '100%',
    textAlign: 'left',
  },
  docBtnActive: { background: T.accentBg },
  docBtnInner: { display: 'flex', alignItems: 'center', gap: 10 },
  docBtnText: { fontSize: 13, color: T.textSecondary },
  docBtnTextActive: { fontSize: 13, fontWeight: 600, color: T.accent },
 
  mainArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: T.bg },
  viewerHeader: {
    height: 56, padding: '0 24px', borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: T.bgPanel, flexShrink: 0,
  },
  vhLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  vhTitle: { fontSize: 15, fontWeight: 600, color: T.textWhite },
  vhRight: { display: 'flex', alignItems: 'center' },
 
  viewerContent: { flex: 1, overflow: 'hidden', position: 'relative', padding: 0 },
  personalGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 0, width: '100%', margin: 0,
    borderBottom: `1px solid ${T.border}`,
  },
  infoTile: {
    background: T.bgCard, borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
    borderRadius: 0, padding: 20, display: 'flex', gap: 16, alignItems: 'center',
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 10, background: T.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  tileLabel: { fontSize: 12, color: T.textMuted, marginBottom: 2 },
  tileValue: { fontSize: 14, fontWeight: 600, color: T.textSecondary },
 
  imageContainer: {
    height: '100%', width: '100%', background: '#000', borderRadius: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative', border: `1px solid ${T.border}`,
  },
  scanImg: { maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', transition: 'transform 0.2s' },
  zoomControls: {
    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.7)', padding: '6px 16px', borderRadius: 20,
    display: 'flex', alignItems: 'center', gap: 16, backdropFilter: 'blur(8px)',
  },
  zoomBtn: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer' },
  zoomText: { color: '#fff', fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'center' },
 
  auditFooter: {
    padding: '20px 24px', borderTop: `1px solid ${T.border}`,
    background: T.bgPanel, flexShrink: 0,
  },
  auditLayout: { display: 'flex', gap: 24, alignItems: 'flex-end' },
  notesArea: { flex: 1 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 8 },
  textarea: {
    width: '100%', height: 72, background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 8, padding: 12, color: T.textSecondary, fontSize: 13,
    fontFamily: FONT, resize: 'none',
  },
  btnGroup: { display: 'flex', gap: 12 },
  approveBtn: {
    height: 44, padding: '0 24px', borderRadius: 8, border: 'none',
    background: T.accent, color: '#fff', fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  rejectBtn: {
    height: 44, padding: '0 24px', borderRadius: 8, border: `1px solid ${T.error}`,
    background: 'transparent', color: T.error, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  processedStatus: { display: 'flex', flexDirection: 'column', gap: 4 },
  processedMeta: { fontSize: 12, color: T.textMuted, margin: 0 },
 
  rightColumn: {
    width: 280, background: T.bgPanel, borderLeft: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  emptyRightContent: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  badge: {
    padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
 
  /* Revoke Panel */
  revokePanel: {
    padding: 20, display: 'flex', flexDirection: 'column', height: '100%',
    width: '100%',
  },
  revokeHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  revokeTitle: { fontSize: 15, fontWeight: 700, color: T.textWhite, margin: 0 },
  revokeInputSection: { flex: 1 },
  revokeActions: { display: 'flex', marginTop: 20 },
  confirmRevokeBtn: {
    height: 44, flex: 1, background: '#7f1d1d', color: '#fff',
    border: 'none', borderRadius: 0, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: {
    height: 44, flex: 1, background: 'transparent', color: T.textMuted,
    border: `1px solid ${T.border}`, borderRadius: 0, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}

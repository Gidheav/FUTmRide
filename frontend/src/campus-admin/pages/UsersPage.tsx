import { useState, useCallback, type CSSProperties } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Users, GraduationCap, BadgeCheck, Clock, Search,
  UserCheck, ShieldCheck, ChevronRight, ChevronLeft, RotateCcw,
  Activity, Phone, Mail, CalendarDays, Fingerprint,
  Power, X, Shield,
} from 'lucide-react'
import api from '../../core/api'
import { useNavigate } from 'react-router-dom'
import { campusPanel } from '../shared/campusPanelStyles'
import { T } from '../theme'

// ─── types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone_number?: string
  role: 'student' | 'driver' | string
  is_active: boolean
  is_verified: boolean
  created_at: string
  driver_profile?: {
    verification_status: string
    vehicle_type?: string
    plate_number?: string
    vehicle_make?: string
    vehicle_model?: string
    is_online?: boolean
  }
  student_profile?: {
    matric_number?: string
    department?: string
  }
}

interface Stats {
  total_users: number
  students: number
  drivers: number
  verified_drivers: number
}

type RoleFilter = 'all' | 'student' | 'driver'
type StatusFilter = 'all' | 'active' | 'inactive'

const PAGE_SIZE = 25

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─── sub-components ───────────────────────────────────────────────────────────
function KpiTile({ icon: Icon, label, value, sub, accent, isLoading }: {
  icon: React.FC<{ size: number; color?: string }>
  label: string; value: string; sub: string; accent: string; isLoading?: boolean
}) {
  return (
    <div style={{ ...campusPanel.card, borderTop: `2px solid ${accent}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <Icon size={13} color={accent} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent, fontFamily: 'monospace', lineHeight: 1 }}>
        {isLoading ? '…' : value}
      </div>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 6 }}>{sub}</div>
    </div>
  )
}

function SecHead({ icon: Icon, title, sub }: {
  icon: React.FC<{ size: number; color?: string }>; title: string; sub?: string
}) {
  return (
    <div style={{ padding: '9px 14px', borderBottom: `1px solid ${T.border}`, background: T.bgCard, display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={13} color={T.accent} />
      <span style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary }}>{title}</span>
      {sub && <span style={{ fontSize: 9, color: T.textMuted, marginLeft: 2 }}>{sub}</span>}
    </div>
  )
}

function RolePill({ role }: { role: string }) {
  const color = role === 'driver' ? T.accent : T.purple
  const bg = role === 'driver' ? T.accentBg : 'rgba(139,92,246,0.12)'
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color, background: bg, border: `1px solid ${color}`, padding: '2px 8px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
      {role}
    </span>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      color: active ? '#10b981' : T.textMuted,
      background: active ? 'rgba(16,185,129,0.1)' : T.bgInput,
      border: `1px solid ${active ? 'rgba(16,185,129,0.3)' : T.border}`,
      padding: '2px 8px', textTransform: 'uppercase' as const, letterSpacing: 0.5,
    }}>
      {active ? 'Active' : 'Suspended'}
    </span>
  )
}

// ─── User Detail Drawer ────────────────────────────────────────────────────────
function UserDrawer({ userId, onClose, onToggle }: {
  userId: string; onClose: () => void; onToggle: (id: string) => void
}) {
  const { data: user, isLoading } = useQuery<UserRecord>({
    queryKey: ['user-detail', userId],
    queryFn: () => api.get(`/users/${userId}/`).then(r => r.data),
    staleTime: 10000,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'relative', width: 380, background: T.bgPanel, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgCard, position: 'sticky', top: 0, zIndex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>User Detail</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 4 }}><X size={16} /></button>
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.textMuted }}>
            <Activity size={24} /><p style={{ marginTop: 12, fontSize: 12 }}>Loading…</p>
          </div>
        ) : user ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: T.bgCard, border: `1px solid ${T.border}` }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>{user.first_name} {user.last_name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' as const }}>
                  <RolePill role={user.role} />
                  <StatusPill active={user.is_active} />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div style={campusPanel.card}>
              <SecHead icon={Phone} title="Contact" />
              <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  [Phone, 'Phone', user.phone_number || '—'],
                  [Mail, 'Email', user.email || '—'],
                  [CalendarDays, 'Joined', fmtDate(user.created_at)],
                  [Fingerprint, 'ID', user.id.slice(0, 8).toUpperCase()],
                ] as const).map(([Icon, label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 10, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon size={11} /> {label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, fontFamily: 'monospace' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver profile */}
            {user.driver_profile && (
              <div style={campusPanel.card}>
                <SecHead icon={BadgeCheck} title="Driver Profile" />
                <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Vehicle', `${user.driver_profile.vehicle_make ?? ''} ${user.driver_profile.vehicle_model ?? ''}`.trim() || '—'],
                    ['Plate', user.driver_profile.plate_number || '—'],
                    ['Type', user.driver_profile.vehicle_type || '—'],
                    ['Verification', user.driver_profile.verification_status],
                    ['Online now', user.driver_profile.is_online ? 'Yes' : 'No'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 10, color: T.textMuted }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, fontFamily: 'monospace' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Student profile */}
            {user.student_profile && (
              <div style={campusPanel.card}>
                <SecHead icon={GraduationCap} title="Student Profile" />
                <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Matric no.', user.student_profile.matric_number || '—'],
                    ['Department', user.student_profile.department || '—'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 10, color: T.textMuted }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, fontFamily: 'monospace' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                style={{
                  ...campusPanel.btnSecondary, justifyContent: 'center', padding: '10px',
                  color: user.is_active ? T.error : '#10b981',
                  borderColor: user.is_active ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)',
                }}
                onClick={() => onToggle(user.id)}
              >
                <Power size={13} />
                {user.is_active ? 'Suspend Account' : 'Reactivate Account'}
              </button>
              {user.role === 'driver' && (
                <button
                  type="button"
                  style={{ ...campusPanel.btnSecondary, justifyContent: 'center', padding: '10px' }}
                  onClick={() => { window.location.href = '/users/verification' }}
                >
                  <Shield size={13} /> Go to Verification
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: 32, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>Could not load user details.</div>
        )}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const buildParams = useCallback(() => {
    const p: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE) }
    if (search) p.search = search
    if (roleFilter !== 'all') p.role = roleFilter
    if (statusFilter === 'active') p.is_active = 'true'
    if (statusFilter === 'inactive') p.is_active = 'false'
    return p
  }, [search, roleFilter, statusFilter, page])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['users', roleFilter, statusFilter, search, page],
    queryFn: () => api.get('/users/', { params: buildParams() }).then(r => r.data),
    staleTime: 20000,
    placeholderData: keepPreviousData,
  })

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['admin-summary-stats'],
    queryFn: () => api.get('/users/admin/summary-stats/').then(r => r.data),
    staleTime: 60000,
  })

  const { data: pendingData } = useQuery({
    queryKey: ['admin-pending'],
    queryFn: () => api.get('/verification/admin/pending/').then(r => r.data),
    staleTime: 30000,
  })

  const toggleActive = useMutation({
    mutationFn: (userId: string) => api.patch(`/users/${userId}/toggle-active/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user-detail', selectedUserId] })
      qc.invalidateQueries({ queryKey: ['admin-summary-stats'] })
    },
  })

  // Provide a safe fallback type for our results 
  type ResultList = { results?: UserRecord[], pagination?: { total_items: number }, count?: number }
  const typedData = data as ResultList | undefined

  const users: UserRecord[] = typedData?.results || []
  const totalCount: number = typedData?.pagination?.total_items ?? typedData?.count ?? users.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pendingCount: number = (pendingData as { count?: number })?.count ?? 0

  const handleSearch = (val: string) => { setSearch(val); setPage(1) }
  const handleRoleFilter = (r: RoleFilter) => { setRoleFilter(r); setPage(1) }
  const handleStatusFilter = (s: StatusFilter) => { setStatusFilter(s); setPage(1) }

  const inp: CSSProperties = { background: T.bgInput, border: `1px solid ${T.border}`, color: T.textPrimary, padding: '7px 10px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }

  const tabBtn = (active: boolean): CSSProperties => ({
    padding: '5px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${active ? T.accent : T.border}`,
    background: active ? T.accentBg : T.bgInput,
    color: active ? T.accent : T.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .usr-row { cursor: pointer; transition: background 0.1s; }
        .usr-row:hover { background: ${T.bgCardHover} !important; }
        .usr-arrow { opacity: 0; transition: opacity 0.12s; }
        .usr-row:hover .usr-arrow { opacity: 1; }
      `}</style>

      <div style={{ flex: 1, overflowY: 'auto', padding: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
          <KpiTile icon={Users} label="Total Users" value={(stats?.total_users ?? 0).toLocaleString()} sub={`${stats?.students ?? 0} students · ${stats?.drivers ?? 0} drivers`} accent={T.accent} isLoading={statsLoading} />
          <KpiTile icon={GraduationCap} label="Students" value={(stats?.students ?? 0).toLocaleString()} sub="Registered riders on platform" accent={T.purple} isLoading={statsLoading} />
          <KpiTile icon={BadgeCheck} label="Drivers" value={(stats?.drivers ?? 0).toLocaleString()} sub={`${stats?.verified_drivers ?? 0} fully verified`} accent="#10b981" isLoading={statsLoading} />
          <KpiTile icon={Clock} label="Pending Verification" value={pendingCount.toLocaleString()} sub={pendingCount > 0 ? 'Action required' : 'All clear'} accent={pendingCount > 0 ? T.error : T.textMuted} />
        </div>

        {/* Quick action cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
          {[
            { icon: UserCheck, title: 'Account Verification', sub: `${pendingCount} pending review`, accent: pendingCount > 0 ? T.error : T.accent, onClick: () => navigate('/users/account-verification') },
            { icon: BadgeCheck, title: 'Vehicle Verification', sub: 'Driver document checks', accent: T.accent, onClick: () => navigate('/users/verification') },
            { icon: ShieldCheck, title: 'Driver Registry', sub: `${stats?.drivers ?? 0} total drivers`, accent: '#10b981', onClick: () => handleRoleFilter('driver') },
            { icon: GraduationCap, title: 'Student Directory', sub: `${stats?.students ?? 0} active riders`, accent: T.purple, onClick: () => handleRoleFilter('student') },
          ].map(card => (
            <button key={card.title} type="button" onClick={card.onClick} style={{ ...campusPanel.card, borderLeft: `3px solid ${card.accent}`, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, background: `${card.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <card.icon size={16} color={card.accent} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, marginBottom: 3 }}>{card.title}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>{card.sub}</div>
              </div>
              <ChevronRight size={14} color={T.textMuted} style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </button>
          ))}
        </div>

        {/* User table */}
        <div style={{ ...campusPanel.card, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 400 }}>

          {/* Toolbar */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: T.bgCard, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 160px', minWidth: 0 }}>
              <Users size={13} color={T.accent} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary }}>User Registry</span>
              {isFetching && <Activity size={11} color={T.textMuted} />}
              <span style={{ fontSize: 9, color: T.textMuted }}>{totalCount.toLocaleString()} total</span>
            </div>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
              <Search size={12} color={T.textMuted} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input style={{ ...inp, paddingLeft: 28 }} placeholder="Search name, email, phone…" value={search} onChange={e => handleSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['all', 'student', 'driver'] as RoleFilter[]).map(r => (
                <button key={r} type="button" style={tabBtn(roleFilter === r)} onClick={() => handleRoleFilter(r)}>
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['all', 'active', 'inactive'] as StatusFilter[]).map(s => (
                <button key={s} type="button" style={tabBtn(statusFilter === s)} onClick={() => handleStatusFilter(s)}>
                  {s === 'all' ? 'Any' : s}
                </button>
              ))}
            </div>
            <button type="button" style={{ ...campusPanel.btnSecondary, padding: '5px 8px' }} onClick={() => refetch()} title="Refresh">
              <RotateCcw size={12} />
            </button>
          </div>

          {/* Table head */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 80px 90px 80px 28px', padding: '7px 14px', borderBottom: `1px solid ${T.border}`, background: T.bgCard }}>
            {['User', 'Contact', 'Role', 'Status', 'Joined', ''].map(h => (
              <div key={h} style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: T.textMuted }}><Activity size={22} /><p style={{ marginTop: 10, fontSize: 12 }}>Loading users…</p></div>
            ) : users.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: T.textMuted, fontSize: 12 }}>No users match the current filters.</div>
            ) : users.map((u, i) => (
              <div
                key={u.id}
                className="usr-row"
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 80px 90px 80px 28px', padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: i % 2 ? T.bgInput : 'transparent', alignItems: 'center' }}
                onClick={() => setSelectedUserId(u.id)}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{u.first_name} {u.last_name}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{u.email || '—'}</div>
                </div>
                <div style={{ fontSize: 11, color: T.textSecondary, fontFamily: 'monospace' }}>{u.phone_number || '—'}</div>
                <div><RolePill role={u.role} /></div>
                <div><StatusPill active={u.is_active} /></div>
                <div style={{ fontSize: 10, color: T.textMuted, fontFamily: 'monospace' }}>{fmtDate(u.created_at)}</div>
                <div className="usr-arrow" style={{ display: 'flex', justifyContent: 'flex-end' }}><ChevronRight size={13} color={T.textMuted} /></div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '8px 14px', borderTop: `1px solid ${T.border}`, background: T.bgCard, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: T.textMuted }}>Page {page} of {totalPages} ({totalCount.toLocaleString()} total)</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" style={{ ...campusPanel.btnSecondary, padding: '4px 10px', fontSize: 10 }} disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft size={12} /> Prev
                </button>
                <button type="button" style={{ ...campusPanel.btnSecondary, padding: '4px 10px', fontSize: 10 }} disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedUserId && (
        <UserDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onToggle={(id) => { toggleActive.mutate(id); setSelectedUserId(null) }}
        />
      )}
    </div>
  )
}

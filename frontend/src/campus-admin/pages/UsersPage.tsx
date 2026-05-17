import { useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users, GraduationCap, ShieldCheck, Clock,
  Search, Download, Megaphone,
  Contact, BadgeCheck, FileWarning,
  HeartPulse, BarChart3, ChevronRight, ArrowRight,
  TrendingUp, Minus, UserCheck
} from 'lucide-react'
import api from '../../core/api'
import { useNavigate } from 'react-router-dom'
import { T } from '../theme'

/* ══════════════════════════════════════════════════════════════════════════════
   MOCK DATA  (replace with real API later)
   ══════════════════════════════════════════════════════════════════════════════ */

const ACTIVITY_FEED = [
  { icon: BadgeCheck, label: 'New driver application', desc: 'submitted by John Doe.', time: '10 mins ago', color: T.accent, bg: T.accentBg },
  { icon: FileWarning, label: 'User account suspended', desc: 'for multiple policy violations.', time: '45 mins ago', color: T.error, bg: 'rgba(239,68,68,0.1)' },
  { icon: Download, label: 'Bulk student import', desc: 'completed successfully (450 records).', time: '2 hours ago', color: T.textSecondary, bg: T.bgCardHover },
  { icon: Megaphone, label: 'System Notification', desc: 'sent to all active drivers.', time: '5 hours ago', color: T.purple, bg: 'rgba(139,92,246,0.1)' },
]

const CHART_BARS = [
  { h: 30, label: 'W1', val: '120' },
  { h: 45, label: 'W2', val: '180' },
  { h: 60, label: 'W3', val: '240' },
  { h: 50, label: 'W4', val: '200' },
  { h: 85, label: 'W5', val: '340' },
]

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [chartPeriod, setChartPeriod] = useState('month')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['campus-admin-users', search],
    queryFn: async () => {
      let url = '/users/?page=1&page_size=20&role=driver'
      if (search) url += `&search=${encodeURIComponent(search)}`
      return (await api.get(url)).data
    },
    staleTime: 20000,
  })

  const users = data?.results || []
  const totalUsersCount = data?.pagination?.total_items ?? users.length

  const { data: stats } = useQuery({
    queryKey: ['admin-summary-stats'],
    queryFn: () => api.get('/users/admin/summary-stats/').then(r => r.data),
    staleTime: 60000,
  })

  const { data: pendingData } = useQuery({
    queryKey: ['admin-pending'],
    queryFn: () => api.get('/verification/admin/pending/').then(r => r.data),
    staleTime: 30000,
  })

  const pendingCount = pendingData?.count ?? 0

  return (
    <div style={s.scroll}>
      <div style={s.main}>


        {/* ── Executive Summary Cards ─────────────────────────────────────── */}
        <div style={s.statsGrid}>
          <StatCard icon={Users} label="Total Drivers" value={(stats?.drivers ?? 0).toLocaleString()} trend="+12%" up />
          <StatCard icon={ShieldCheck} label="Verified Drivers" value={(stats?.verified_drivers ?? 0).toLocaleString()} trend="0%" />
          <StatCard icon={Clock} label="Pending Applications" value={pendingCount.toString()} isError />
        </div>

        {/* ── Split Container: Independently Scrollable Panes ─────────────── */}
        <div style={s.splitContainer}>

          {/* Left Pane (Scrollable) */}
          <div style={s.leftPane}>
            <div style={s.segmentsGrid}>
              {/* Student Directory */}
              <SegmentCard
                icon={Contact}
                title="Student Directory"
                sub={`Manage ${(stats?.students ?? 0).toLocaleString()} active riders`}
                cta="View Directory"
              />
              {/* Driver Management */}
              <SegmentCard
                icon={BadgeCheck}
                title="Driver Management Hub"
                sub={`Manage ${(stats?.drivers ?? 0).toLocaleString()} active drivers`}
                cta="Manage Drivers"
              />
            </div>

            {/* Verification Center */}
            <div style={s.verifyCard}>
              <div style={s.verifyTop}>
                <div style={s.verifyInfo}>
                  <div style={s.segIconWrap}>
                    <ShieldCheck size={20} color={T.textSecondary} />
                  </div>
                  <div>
                    <h4 style={s.segTitle}>Verification Center</h4>
                    <p style={s.segSub}>Review pending documents and background checks</p>
                  </div>
                </div>
                <span style={s.pendingBadge}>{pendingCount} Pending</span>
              </div>
              <div style={s.verifyLinksGrid}>
                <VerifyLink
                  icon={UserCheck}
                  label="Account Verification"
                  onClick={() => navigate('/campus-admin/users/account-verification')}
                />
                <VerifyLink
                  icon={BadgeCheck}
                  label="Vehicle Verification"
                  onClick={() => navigate('/campus-admin/users/verification')}
                />
              </div>
            </div>

            {/* Bottom segment cards */}
            <div style={s.segmentsGrid}>
              <SegmentCard
                icon={HeartPulse}
                title="Safety & Complaints"
                sub="12 Active Reports"
                cta=""
                isError
              />
              <SegmentCard
                icon={BarChart3}
                title="Performance Analytics"
                sub="User retention & growth"
                cta=""
              />
            </div>
            {/* ── User Table ──────────────────────────────────────────────────── */}
            <div style={{ marginTop: 0 }}>
              <style>{`
                .user-table-row:hover { background: ${T.bgCardHover} !important; }
              `}</style>
              <div style={s.toolbar}>
                <div style={s.searchWrap}>
                  <Search size={14} color={T.textMuted} style={s.searchIcon} />
                  <input
                    style={s.searchInput}
                    placeholder="Search users..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div style={s.tableCard}>
                <div style={s.tableHead}>
                  <div>User</div>
                  <div>Phone</div>
                  <div>Role</div>
                  <div>Status</div>
                </div>
                {isLoading ? (
                  <div style={s.tableEmpty}>Loading users...</div>
                ) : users.length === 0 ? (
                  <div style={s.tableEmpty}>No users found</div>
                ) : (
                  users.map((u: any) => (
                    <div key={u.id} className="user-table-row" style={s.tableRow} onClick={() => navigate(`/campus-admin/users/${u.id}/verify`)}>
                      <div>
                        <div style={{ fontWeight: 600, color: T.textPrimary, fontSize: 13 }}>{u.first_name} {u.last_name}</div>
                        <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{u.email || 'No email'}</div>
                      </div>
                      <div style={{ color: T.textSecondary, fontSize: 13 }}>{u.phone_number}</div>
                      <div><span style={s.rolePill}>{u.role}</span></div>
                      <div style={{ color: u.is_verified ? T.accent : T.textMuted, fontSize: 12, fontWeight: 600 }}>
                        {u.is_verified ? 'Verified' : 'Unverified'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ height: 32 }} />
          </div>

          {/* Right Pane (Scrollable) */}
          <div style={s.rightPane}>

            {/* User Growth Chart */}
            <div style={s.chartCard}>
              <div style={s.chartHeader}>
                <h3 style={s.sectionTitleSm}>User Growth</h3>
                <select
                  value={chartPeriod}
                  onChange={e => setChartPeriod(e.target.value)}
                  style={s.chartSelect}
                >
                  <option value="month">This Month</option>
                  <option value="last">Last Month</option>
                </select>
              </div>
              <div style={s.chartArea}>
                {/* grid lines */}
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ ...s.gridLine, top: `${i * 25}%` }} />
                ))}
                {/* bars */}
                {CHART_BARS.map((b, i) => (
                  <div key={i} style={s.barCol}>
                    <div
                      style={{
                        ...s.bar,
                        height: `${b.h}%`,
                        opacity: 0.25 + (i * 0.18),
                        background: T.accent,
                      }}
                      title={b.val}
                    />
                    <span style={s.barLabel}>{b.label}</span>
                  </div>
                ))}
                {/* trend svg */}
                <svg style={s.trendSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M 10 70 Q 30 55, 50 40 T 90 15" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Recent Activity */}
            <div style={s.activityCard}>
              <h3 style={s.sectionTitleSm}>Recent Activity</h3>
              <div style={s.activityList}>
                {/* timeline line */}
                <div style={s.timelineLine} />
                {ACTIVITY_FEED.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div key={i} style={s.activityRow}>
                      <div style={{ ...s.activityDot, background: item.bg, borderColor: T.bgCard }}>
                        <Icon size={14} color={item.color} />
                      </div>
                      <div>
                        <p style={s.activityText}>
                          <strong>{item.label}</strong> {item.desc}
                        </p>
                        <span style={s.activityTime}>{item.time}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button style={s.viewAllBtn}>View All Activity</button>
            </div>
            <div style={{ height: 32 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════════════════ */

function StatCard({ icon: Icon, label, value, trend, up, isError }: {
  icon: any; label: string; value: string; trend?: string; up?: boolean; isError?: boolean
}) {
  return (
    <div style={{ ...s.statCard, ...(isError ? { position: 'relative' as const, overflow: 'hidden' } : {}) }}>
      {isError && <div style={s.errorCorner} />}
      <div style={s.statTop}>
        <div style={{ ...s.statIconWrap, background: isError ? 'rgba(239,68,68,0.12)' : T.accentBg }}>
          <Icon size={18} color={isError ? T.error : T.accent} />
        </div>
        {trend && (
          <span style={{ ...s.statTrend, color: up ? T.accent : T.textMuted }}>
            {up ? <TrendingUp size={12} style={{ marginRight: 3 }} /> : <Minus size={12} style={{ marginRight: 3 }} />}
            {trend}
          </span>
        )}
      </div>
      <p style={s.statLabel}>{label}</p>
      <h3 style={{ ...s.statValue, color: isError ? T.error : T.textPrimary }}>{value}</h3>
    </div>
  )
}

function SegmentCard({ icon: Icon, title, sub, cta, isError }: {
  icon: any; title: string; sub: string; cta: string; isError?: boolean
}) {
  return (
    <div style={{ ...s.segCard, ...(isError ? {} : {}) }}>
      <div style={s.segCardTop}>
        <div style={{
          ...s.segIconWrap,
          background: isError ? 'rgba(239,68,68,0.12)' : T.bgCardHover,
        }}>
          <Icon size={20} color={isError ? T.error : T.textSecondary} />
        </div>
        <div>
          <h4 style={s.segTitle}>{title}</h4>
          <p style={s.segSub}>{sub}</p>
        </div>
      </div>
      {cta && (
        <div style={s.segBottom}>
          <span style={{ ...s.segCta, color: T.accent }}>{cta}</span>
          <ArrowRight size={14} color={T.accent} />
        </div>
      )}
    </div>
  )
}

function VerifyLink({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  return (
    <div style={s.verifyLink} onClick={onClick}>
      <div style={s.verifyLinkInner}>
        <Icon size={16} color={T.textSecondary} />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{label}</span>
      </div>
      <ChevronRight size={16} color={T.textMuted} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   STYLES  (all theme-reactive via T tokens)
   ══════════════════════════════════════════════════════════════════════════════ */

const FONT = T.fontFamily

const s: Record<string, CSSProperties> = {
  scroll: {
    flex: 1, display: 'flex', flexDirection: 'column', background: T.bg, minHeight: 0,
    overflow: 'hidden',
  },
  main: {
    width: '100%', margin: 0, padding: 0,
    fontFamily: FONT, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
  },


  /* Stats Grid */
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 1, background: T.border, marginBottom: 0,
    borderTop: `1px solid ${T.border}`, flexShrink: 0,
  },
  statCard: {
    background: T.bgPanel, padding: '16px 20px', borderRadius: 0,
  },
  errorCorner: {
    position: 'absolute' as const, top: 0, right: 0, width: 40, height: 40,
    background: 'rgba(239,68,68,0.1)', borderLeft: `1px solid rgba(239,68,68,0.2)`, borderBottom: `1px solid rgba(239,68,68,0.2)`,
  },
  statTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 14,
  },
  statIconWrap: {
    width: 28, height: 28, borderRadius: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${T.border}`,
  },
  statTrend: {
    display: 'inline-flex', alignItems: 'center',
    fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
  },
  statLabel: {
    fontSize: 11, fontWeight: 700, color: T.textMuted,
    textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0,
  },
  statValue: {
    fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em',
    lineHeight: '32px', marginTop: 4, fontFamily: FONT, margin: 0,
  },

  /* Split Container & Panes */
  splitContainer: {
    display: 'flex', flex: 1, minHeight: 0,
    background: T.border, gap: 1,
    borderTop: `1px solid ${T.border}`,
  },
  leftPane: {
    flex: 2, display: 'flex', flexDirection: 'column', gap: 1, background: T.border,
    overflowY: 'auto',
  },
  rightPane: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 1, background: T.border,
    overflowY: 'auto',
  },

  sectionTitle: {
    fontSize: 14, fontWeight: 700, color: T.textPrimary,
    letterSpacing: '-0.01em', margin: 0, textTransform: 'uppercase' as const,
    padding: '12px 20px', background: T.bgPanel, borderBottom: `1px solid ${T.border}`
  },
  sectionTitleSm: {
    fontSize: 12, fontWeight: 700, color: T.textPrimary,
    letterSpacing: '-0.01em', margin: 0, textTransform: 'uppercase' as const,
  },

  /* Segment cards */
  segmentsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: T.border,
  },
  segCard: {
    background: T.bgPanel, padding: 16, borderRadius: 0,
    cursor: 'pointer', transition: 'background 0.2s',
    position: 'relative' as const, overflow: 'hidden',
  },
  segCardTop: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  segIconWrap: {
    width: 32, height: 32, borderRadius: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.border}`,
    flexShrink: 0,
  },
  segTitle: {
    fontSize: 13, fontWeight: 700, color: T.textPrimary, margin: 0,
    letterSpacing: '-0.01em',
  },
  segSub: { fontSize: 11, color: T.textMuted, margin: '2px 0 0' },
  segBottom: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12,
  },
  segCta: { fontSize: 11, fontWeight: 600 },

  /* Verification card */
  verifyCard: {
    background: T.bgPanel, padding: '16px 20px', borderRadius: 0,
  },
  verifyTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 18, gap: 12, flexWrap: 'wrap' as const,
  },
  verifyInfo: { display: 'flex', alignItems: 'center', gap: 14 },
  pendingBadge: {
    background: 'rgba(239,68,68,0.12)', color: T.error,
    padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  },
  verifyLinksGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: T.border, border: `1px solid ${T.border}`,
  },
  verifyLink: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', borderRadius: 0,
    background: T.bgCard,
    cursor: 'pointer', transition: 'background 0.15s',
  },
  verifyLinkInner: { display: 'flex', alignItems: 'center', gap: 10 },

  /* Chart */
  chartCard: {
    background: T.bgPanel, padding: '16px 20px', borderRadius: 0, flex: 1,
  },
  chartHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  chartSelect: {
    background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 0,
    color: T.textSecondary, fontSize: 11, fontWeight: 600,
    padding: '2px 6px', outline: 'none', fontFamily: FONT,
    cursor: 'pointer',
  },
  chartArea: {
    position: 'relative' as const, height: 160,
    display: 'flex', alignItems: 'flex-end', gap: 8,
    paddingTop: 8, borderBottom: `1px solid ${T.border}`,
  },
  gridLine: {
    position: 'absolute' as const, left: 0, right: 0, height: 0,
    borderTop: `1px dashed ${T.border}`, opacity: 0.4,
  },
  barCol: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: 6, zIndex: 2,
  },
  bar: {
    width: '100%', borderRadius: 0,
    transition: 'height 0.3s ease',
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10, fontWeight: 600, color: T.textMuted,
    position: 'absolute' as const, bottom: -18,
  },
  trendSvg: {
    position: 'absolute' as const, inset: 0,
    width: '100%', height: '100%', zIndex: 3,
    pointerEvents: 'none' as const,
  },

  /* Activity */
  activityCard: {
    background: T.bgPanel, padding: '16px 20px', borderRadius: 0,
  },
  activityList: {
    position: 'relative' as const, marginTop: 18,
    display: 'flex', flexDirection: 'column' as const, gap: 20,
  },
  timelineLine: {
    position: 'absolute' as const, left: 15, top: 8, bottom: 8,
    width: 2, background: T.border, zIndex: 0,
  },
  activityRow: {
    position: 'relative' as const, zIndex: 1,
    display: 'flex', gap: 12, alignItems: 'flex-start',
  },
  activityDot: {
    width: 24, height: 24, borderRadius: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, borderWidth: 1, borderStyle: 'solid',
  },
  activityText: { fontSize: 12, color: T.textPrimary, lineHeight: '18px', margin: 0 },
  activityTime: { fontSize: 10, color: T.textMuted, fontWeight: 600 },
  viewAllBtn: {
    width: '100%', marginTop: 18, padding: '8px 0',
    background: 'none', border: 'none', cursor: 'pointer',
    color: T.accent, fontSize: 12, fontWeight: 600,
    fontFamily: FONT, borderRadius: 8,
    transition: 'background 0.15s',
  },

  /* User Table */
  toolbar: { padding: '12px 20px', background: T.bgPanel, borderBottom: `1px solid ${T.border}` },
  searchWrap: { position: 'relative' as const, maxWidth: 320 },
  searchIcon: {
    position: 'absolute' as const, left: 12, top: '50%',
    transform: 'translateY(-50%)', pointerEvents: 'none' as const,
  },
  searchInput: {
    width: '100%', height: 32,
    border: `1px solid ${T.border}`, background: 'transparent',
    color: T.textPrimary, borderRadius: 0,
    padding: '0 12px 0 32px', outline: 'none',
    fontSize: 12, fontFamily: FONT,
  },
  tableCard: {
    background: T.bgPanel, borderBottom: `1px solid ${T.border}`,
    borderRadius: 0, overflow: 'hidden',
  },
  tableHead: {
    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr',
    padding: '12px 18px', alignItems: 'center',
    borderBottom: `1px solid ${T.borderLight}`,
    fontSize: 11, color: T.textMuted,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 700,
  },
  tableRow: {
    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr',
    padding: '10px 20px', alignItems: 'center',
    borderBottom: `1px solid ${T.borderLight}`,
    transition: 'background 0.12s',
    cursor: 'pointer',
  },
  tableEmpty: {
    padding: '28px 20px', textAlign: 'center' as const,
    color: T.textMuted, fontSize: 12,
  },
  rolePill: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 0,
    fontSize: 10, fontWeight: 700, background: T.accentBg, color: T.accent,
    textTransform: 'uppercase' as const, border: `1px solid ${T.accent}`,
  },
}

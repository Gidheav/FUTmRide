import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, CalendarClock, BarChart3, Settings,
  LogOut, User as UserIcon, Sun, Moon,
  Download, Megaphone, UserPlus,
  ArrowLeft, ChevronRight, History, ShieldAlert, UserX
} from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'
import { T, useCampusThemeStore } from '../theme'


const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/campus-admin' },
  { label: 'Open Requests', icon: FolderOpen, path: '/campus-admin/rides' },
  { label: 'Scheduled Rides', icon: CalendarClock, path: '/campus-admin/schedule' },
  { label: 'Analytics', icon: BarChart3, path: '/campus-admin/analytics' },
  { label: 'Settings', icon: Settings, path: '/campus-admin/settings' },
]

export default function CampusAdminTopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { clearAuth } = useAuthStore()
  const { mode, toggleMode } = useCampusThemeStore()

  const verifyMatch = location.pathname.match(/\/campus-admin\/users\/(.*)\/verify/)
  const verifyDriverId = verifyMatch ? verifyMatch[1] : null
  const activeTab = new URLSearchParams(location.search).get('tab') || 'personal'

  const { data: unifiedDetail } = useQuery<any>({
    queryKey: ['admin-unified-detail', verifyDriverId],
    enabled: !!verifyDriverId,
    staleTime: 0,
  })

  const isVehicleDoc = !['personal', 'nin'].includes(activeTab)
  const currentDoc = unifiedDetail?.vehicle_documents?.find((d: any) => d.document_type === activeTab)
  
  const displayStatus = isVehicleDoc 
    ? currentDoc?.status
    : unifiedDetail?.account_verification?.status

  const isApproved = displayStatus === 'approved'

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout/', { refresh })
    },
    onSettled: () => {
      clearAuth()
      navigate('/campus-admin/login')
    },
  })

  return (
    <header style={s.topBar}>
      <div style={s.topLeft}>
        {location.pathname === '/campus-admin/users' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3 }}>
              User Management
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Central hub for all student and driver administration.
            </div>
          </div>
        ) : location.pathname === '/campus-admin/users/verification' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/campus-admin/users')} style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent', padding: 0 }}>
              <ArrowLeft size={16} />
              <span style={{ fontSize: 14 }}>Back</span>
            </button>
            <div style={{ width: 1, height: 24, background: T.borderLight }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMuted, fontSize: 13 }}>
              <span>User Management</span>
              <ChevronRight size={14} />
              <span>Applications</span>
              <ChevronRight size={14} />
              <span style={{ color: T.textWhite }}>Vehicle Verification</span>
            </div>
          </div>
        ) : location.pathname === '/campus-admin/users/account-verification' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/campus-admin/users')} style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent', padding: 0 }}>
              <ArrowLeft size={16} />
              <span style={{ fontSize: 14 }}>Back</span>
            </button>
            <div style={{ width: 1, height: 24, background: T.borderLight }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMuted, fontSize: 13 }}>
              <span>User Management</span>
              <ChevronRight size={14} />
              <span>Applications</span>
              <ChevronRight size={14} />
              <span style={{ color: T.textWhite }}>Account Verification</span>
            </div>
          </div>
        ) : location.pathname.match(/\/campus-admin\/users\/.*\/verify/) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/campus-admin/users')} style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent', padding: 0 }}>
              <ArrowLeft size={16} />
              <span style={{ fontSize: 14 }}>Back</span>
            </button>
            <div style={{ width: 1, height: 24, background: T.borderLight }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMuted, fontSize: 13 }}>
              <span>User Management</span>
              <ChevronRight size={14} />
              <span>Applications</span>
              <ChevronRight size={14} />
              <span style={{ color: T.textWhite }}>Driver Status</span>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3 }}>
              Elite Driver Logistics Command
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Replacing Pro Rides &amp; Dispatch Center
            </div>
          </div>
        )}
      </div>

      {location.pathname === '/campus-admin/users' ? (
        <nav style={s.topNav}>
          <button style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}>
            <Download size={13} strokeWidth={1.8} />
            <span>Export User Data</span>
          </button>
          <button style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}>
            <Megaphone size={13} strokeWidth={1.8} />
            <span>Broadcast Notification</span>
          </button>
          <button style={{ ...s.topNavBtn, color: T.accent, background: T.accentBg }}>
            <UserPlus size={13} strokeWidth={1.8} />
            <span>Add New User</span>
          </button>
        </nav>
      ) : location.pathname === '/campus-admin/users/verification' || location.pathname === '/campus-admin/users/account-verification' ? (
        <nav style={s.topNav}>
          <button style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}>
            <History size={13} strokeWidth={1.8} />
            <span>Audit Log</span>
          </button>
        </nav>
      ) : verifyMatch ? (
        <nav style={s.topNav}>
          {isApproved && (
            <button 
              style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                if (params.get('revoke') === 'true') params.delete('revoke');
                else params.set('revoke', 'true');
                navigate(`${location.pathname}?${params.toString()}`);
              }}
              title="Revoke Verification"
            >
              <UserX size={16} />
            </button>
          )}
        </nav>
      ) : (
        <nav style={s.topNav}>
          {NAV_ITEMS.map((t) => {
            const Icon = t.icon
            const isActive = location.pathname === t.path
            return (
              <Link
                key={t.label}
                to={t.path}
                style={{
                  ...s.topNavBtn,
                  color: isActive ? T.accent : T.textSecondary,
                  background: isActive ? T.accentBg : 'transparent',
                  textDecoration: 'none'
                }}
              >
                <Icon size={13} strokeWidth={1.8} />
                <span>{t.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      <div style={s.topRight}>
        {location.pathname === '/campus-admin/users/verification' ? (
          <button style={{ ...s.topNavBtn, color: T.textPrimary, background: T.bgCard, border: `1px solid ${T.border}` }}>
            <History size={14} />
            <span style={{ fontSize: 13 }}>Audit Log</span>
          </button>
        ) : (
          <>
            <button style={s.topIconBtn} onClick={toggleMode}>
              {mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <Link to="/campus-admin/profile" style={s.topAvatar}>
              <UserIcon size={16} color={T.textSecondary} />
            </Link>
            <button style={s.topIconBtn} onClick={() => logoutMutation.mutate()}>
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

const s: Record<string, CSSProperties> = {
  topBar: {
    height: 44, background: T.topBar, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', paddingLeft: 16, paddingRight: 12,
    borderBottom: `1px solid ${T.border}`, flexShrink: 0,
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  topNav: { display: 'flex', alignItems: 'center', gap: 2 },
  topNavBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none',
    cursor: 'pointer', padding: '5px 10px', borderRadius: 6,
    fontSize: 11, fontWeight: 600, fontFamily: T.fontFamily, transition: 'all 0.15s',
  },
  topRight: { display: 'flex', alignItems: 'center', gap: 6 },
  topIconBtn: {
    width: 28, height: 28, borderRadius: 6, border: 'none',
    background: 'transparent', color: T.textSecondary, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  topAvatar: {
    width: 28, height: 28, borderRadius: 14, background: T.bgCard,
    border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: T.textSecondary,
  },
}

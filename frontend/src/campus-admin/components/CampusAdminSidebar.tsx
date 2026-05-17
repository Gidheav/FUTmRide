import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Navigation, Users, Truck, CalendarClock, BarChart3, Bell, User, Settings } from 'lucide-react'
import { type CSSProperties } from 'react'
import { T } from '../theme'

const SIDEBAR_ICONS = [
  { icon: LayoutDashboard, path: '/campus-admin' },
  { icon: Navigation, path: '/campus-admin/dispatch' },
  { icon: Users, path: '/campus-admin/users' },
  { icon: Truck, path: '/campus-admin/fleet' },
  { icon: CalendarClock, path: '/campus-admin/schedule' },
  { icon: BarChart3, path: '/campus-admin/analytics' },
  { icon: Bell, path: '/campus-admin/notifications' },
  { icon: User, path: '/campus-admin/profile' },
  { icon: Settings, path: '/campus-admin/settings' },
]

const s: Record<string, CSSProperties> = {
  sidebar: {
    width: 52, background: T.sidebar, display: 'flex', flexDirection: 'column',
    alignItems: 'center', borderRight: `1px solid ${T.border}`, paddingTop: 12,
    flexShrink: 0, height: '100vh'
  },
  sidebarLogo: { marginBottom: 16 },
  logoCircle: {
    width: 32, height: 32, borderRadius: 8, background: T.accentDim,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sidebarIcons: { display: 'flex', flexDirection: 'column', gap: 2, width: '100%' },
  sidebarBtn: {
    width: '100%', height: 40, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 0, transition: 'background 0.15s',
  }
}

export default function CampusAdminSidebar() {
  const location = useLocation()

  return (
    <aside style={s.sidebar}>
      <div style={s.sidebarLogo}>
        <div style={s.logoCircle}>
          <span style={{ fontWeight: 700, fontSize: 11, color: '#fff', letterSpacing: -0.5 }}>LR</span>
        </div>
      </div>
      <div style={s.sidebarIcons}>
        {SIDEBAR_ICONS.map((item, i) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={i}
              to={item.path}
              style={{
                ...s.sidebarBtn,
                background: isActive ? T.accentBg : 'transparent',
                color: isActive ? T.accent : T.textMuted,
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
            </Link>
          )
        })}
      </div>
    </aside>
  )
}

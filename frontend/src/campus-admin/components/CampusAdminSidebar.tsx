import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Navigation, Users, Truck, RadioTower, BarChart3, Banknote, Bell, Settings, Calculator, FlaskConical, BookOpen } from 'lucide-react'
import { type CSSProperties } from 'react'
import { T } from '../theme'

const SIDEBAR_ICONS = [
  { icon: LayoutDashboard, path: '/' },
  { icon: Navigation, path: '/dispatch' },
  { icon: RadioTower, path: '/operations' },
  { icon: FlaskConical, path: '/test' },
  { icon: Calculator, path: '/engine' },
  { icon: Banknote, path: '/financial' },
  { icon: Users, path: '/users' },
  { icon: BookOpen, path: '/docs' },
  { icon: Bell, path: '/notifications' },
  { icon: Settings, path: '/settings' },
]

const s: Record<string, CSSProperties> = {
  sidebar: {
    width: 52, background: T.sidebar, display: 'flex', flexDirection: 'column',
    alignItems: 'center', borderRight: `1px solid ${T.border}`, paddingTop: 12,
    flexShrink: 0, height: '100vh'
  },
  sidebarLogo: { marginBottom: 8 },
  logoCircle: {
    width: 40, height: 40, borderRadius: 8, background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(2.05)'
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
          <img src="/fut-icon.png" alt="FUT Logo" style={s.logoImg} />
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

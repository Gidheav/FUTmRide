import { Outlet } from 'react-router-dom'
import CampusAdminSidebar from '../components/CampusAdminSidebar'
import CampusAdminTopNav from '../components/CampusAdminTopNav'
import { useLocation } from 'react-router-dom'
import CampusAdminDashboard from '../screens/DashboardScreen'
import { type CSSProperties } from 'react'
import { useCampusThemeStore, themeCss, T } from '../theme'

export default function CampusAdminLayout() {
  const { mode } = useCampusThemeStore()
  const location = useLocation()
  const isDashboard = location.pathname === '/campus-admin'

  const s: Record<string, CSSProperties> = {
    root: {
      display: 'flex', height: '100vh', width: '100vw',
      background: T.bg, overflow: 'hidden',
    },
    body: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  }

  return (
    <>
      <style>{themeCss}</style>
      <div style={s.root} className={`campus-theme-${mode}`}>
        <CampusAdminSidebar />
        <div style={s.body}>
          <CampusAdminTopNav />
          <div style={{ display: isDashboard ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <CampusAdminDashboard />
          </div>
          <div style={{ display: isDashboard ? 'none' : 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </>
  )
}

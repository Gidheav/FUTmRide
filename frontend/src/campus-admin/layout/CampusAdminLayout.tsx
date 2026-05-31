import { Outlet } from 'react-router-dom'
import CampusAdminSidebar from '../components/CampusAdminSidebar'
import CampusAdminTopNav from '../components/CampusAdminTopNav'
import { useLocation } from 'react-router-dom'
import CampusAdminDashboard from '../screens/DashboardScreen'
import CampusAdminDispatch from '../pages/DispatchPage'
import { type CSSProperties } from 'react'
import { useCampusThemeStore, themeCss, T } from '../theme'

export default function CampusAdminLayout() {
  const { mode } = useCampusThemeStore()
  const location = useLocation()
  const isDashboard = location.pathname === '/'
  const isDispatch = location.pathname === '/dispatch'
  const isFinancial = location.pathname === '/financial'

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
      <div style={s.root} className={`campus-theme-${mode} ${mode === 'dark' ? 'dark' : ''}`}>
        <CampusAdminSidebar />
        <div style={s.body}>
          <CampusAdminTopNav />
          <div style={{ display: isDashboard ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <CampusAdminDashboard />
          </div>
          <div style={{ display: isDispatch ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <CampusAdminDispatch />
          </div>
          <div style={{ display: (!isDashboard && !isDispatch) ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflowY: isFinancial ? 'hidden' : 'auto', overflowX: 'hidden' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </>
  )
}

import { useEffect, useState } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "./authStore"
import api from "./api"
import { getAccessToken, getRefreshToken, migrateLegacyTokens } from "./tokenStorage"

import AdminLoginPage from "../admin/pages/LoginPage"
import AdminDashboard from "../admin/pages/DashboardPage"
import AdminUsers from "../admin/pages/UsersPage"
import AdminRides from "../admin/pages/RidesPage"
import AdminDrivers from "../admin/pages/DriversPage"
import AdminAnalytics from "../admin/pages/AnalyticsPage"
import AdminSupport from "../admin/pages/SupportPage"
import CampusAdminLoginPage from "../campus-admin/screens/LoginScreen"
import CampusAdminDashboard from "../campus-admin/screens/DashboardScreen"
import CampusAdminUsers from "../campus-admin/pages/UsersPage"
import CampusAdminVerification from "../campus-admin/pages/VerificationPage"
import CampusAdminAccountVerification from "../campus-admin/pages/AccountVerificationPage"
import CampusAdminUnifiedVerification from "../campus-admin/pages/UnifiedVerificationPage"
import CampusAdminRides from "../campus-admin/pages/RidesPage"
import CampusAdminDispatch from "../campus-admin/pages/DispatchPage"
import CampusAdminFleet from "../campus-admin/pages/FleetPage"
import CampusAdminOperations from "../campus-admin/pages/OperationsPage"
import CampusAdminAnalytics from "../campus-admin/pages/AnalyticsPage"
import CampusAdminSettings from "../campus-admin/pages/SettingsPage"
import CampusAdminNotifications from "../campus-admin/pages/NotificationsPage"
import CampusAdminEngine from "../campus-admin/pages/EngineCalculationPage"
import CampusAdminFinancialHub from "../campus-admin/FinancialManagement/hub/FinancialHub"
import CampusAdminLayout from "../campus-admin/layout/CampusAdminLayout"
import CampusAdminTestPage from "../campus-admin/pages/TestPage"

const MOBILE_UA_RE = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i
const MIN_DESKTOP_WIDTH = 1024

const isDesktopAllowed = () => {
  const isMobileUa = MOBILE_UA_RE.test(navigator.userAgent || "")
  const isSmallScreen = window.innerWidth < MIN_DESKTOP_WIDTH
  return !(isMobileUa || isSmallScreen)
}

function DesktopOnlyScreen() {
  return (
    <div className="desktop-only-screen" role="alert" aria-live="assertive">
      <div>
        <h1>Desktop only</h1>
        <p>This application is available on desktop browsers only.</p>
      </div>
    </div>
  )
}

function RequireAuth({ children, role }: { children: React.ReactNode; role?: string }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) {
    if (role === "admin") return <Navigate to="/admin/login" replace />
    if (role === "campus_admin") return <Navigate to="/login" replace />
    return <Navigate to="/login" replace />
  }
  if (role && user?.role !== role) {
    if (user?.role === "admin") return <Navigate to="/admin" replace />
    if (user?.role === "campus_admin") return <Navigate to="/" replace />
    return <Navigate to="/login" replace />
  }
  return children
}

export default function AppRouter() {
  const { setAuth, clearAuth } = useAuthStore()
  const [isHydrating, setIsHydrating] = useState(true)
  const [desktopAllowed, setDesktopAllowed] = useState(isDesktopAllowed())

  useEffect(() => {
    const evaluate = () => setDesktopAllowed(isDesktopAllowed())
    window.addEventListener("resize", evaluate)
    window.addEventListener("orientationchange", evaluate)
    return () => {
      window.removeEventListener("resize", evaluate)
      window.removeEventListener("orientationchange", evaluate)
    }
  }, [])

  useEffect(() => {
    const hydrate = async () => {
      migrateLegacyTokens()
      const access = getAccessToken()
      const refresh = getRefreshToken()
      
      if (access && refresh) {
        try {
          const res = await api.get("/users/me/")
          setAuth(res.data, access, refresh)
        } catch (error) {
          clearAuth()
        }
      } else {
        clearAuth()
      }
      setIsHydrating(false)
    }
    
    hydrate()
  }, [setAuth, clearAuth])

  if (!desktopAllowed) return <DesktopOnlyScreen />
  if (isHydrating) return null

  return (
    <Routes>

      <Route path="/login" element={<CampusAdminLoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth role="admin"><AdminUsers /></RequireAuth>} />
      <Route path="/admin/rides" element={<RequireAuth role="admin"><AdminRides /></RequireAuth>} />
      <Route path="/admin/drivers" element={<RequireAuth role="admin"><AdminDrivers /></RequireAuth>} />
      <Route path="/admin/analytics" element={<RequireAuth role="admin"><AdminAnalytics /></RequireAuth>} />
      <Route path="/admin/support" element={<RequireAuth role="admin"><AdminSupport /></RequireAuth>} />
      <Route element={<RequireAuth role="campus_admin"><CampusAdminLayout /></RequireAuth>}>
        <Route path="/" element={<CampusAdminDashboard />} />
        <Route path="/users" element={<CampusAdminUsers />} />
        <Route path="/users/verification" element={<CampusAdminVerification />} />
        <Route path="/users/account-verification" element={<CampusAdminAccountVerification />} />
        <Route path="/users/:driverId/verify" element={<CampusAdminUnifiedVerification />} />
        <Route path="/rides" element={<CampusAdminRides />} />
        <Route path="/dispatch" element={null} />
        <Route path="/fleet" element={<CampusAdminFleet />} />
        <Route path="/operations" element={<CampusAdminOperations />} />
        <Route path="/analytics" element={<CampusAdminAnalytics />} />
        <Route path="/financial" element={<CampusAdminFinancialHub />} />
        <Route path="/engine" element={<CampusAdminEngine />} />
        <Route path="/settings" element={<CampusAdminSettings />} />
        <Route path="/notifications" element={<CampusAdminNotifications />} />
        <Route path="/test" element={<CampusAdminTestPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

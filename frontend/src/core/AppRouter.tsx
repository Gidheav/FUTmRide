import { useEffect, useState } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "./authStore"
import api from "./api"

import StudentLoginPage from "../student/pages/LoginPage"
import StudentRegisterPage from "../student/pages/RegisterPage"
import StudentDashboard from "../student/pages/DashboardPage"
import StudentBookRide from "../student/pages/BookRidePage"
import StudentRideHistory from "../student/pages/RideHistoryPage"
import StudentWallet from "../student/pages/WalletPage"
import StudentProfile from "../student/pages/ProfilePage"
import StudentSupport from "../student/pages/SupportPage"
import OTPVerificationPage from "../student/pages/OTPVerificationPage"
import PasswordResetPage from "../student/pages/PasswordResetPage"

import DriverLoginPage from "../driver/pages/LoginPage"
import DriverRegisterPage from "../driver/pages/RegisterPage"
import DriverDashboard from "../driver/pages/DashboardPage"
import DriverRideHistory from "../driver/pages/RideHistoryPage"
import DriverProfile from "../driver/pages/ProfilePage"

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
import CampusAdminSchedule from "../campus-admin/pages/SchedulePage"
import CampusAdminAnalytics from "../campus-admin/pages/AnalyticsPage"
import CampusAdminProfile from "../campus-admin/pages/ProfilePage"
import CampusAdminSettings from "../campus-admin/pages/SettingsPage"
import CampusAdminNotifications from "../campus-admin/pages/NotificationsPage"
import CampusAdminEngine from "../campus-admin/pages/EngineCalculationPage"
import CampusAdminLayout from "../campus-admin/layout/CampusAdminLayout"

function RequireAuth({ children, role }: { children: React.ReactNode; role?: string }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) {
    if (role === "driver") return <Navigate to="/driver/login" replace />
    if (role === "admin") return <Navigate to="/admin/login" replace />
    if (role === "campus_admin") return <Navigate to="/campus-admin/login" replace />
    return <Navigate to="/login" replace />
  }
  if (role && user?.role !== role) {
    if (user?.role === "driver") return <Navigate to="/driver" replace />
    if (user?.role === "admin") return <Navigate to="/admin" replace />
    if (user?.role === "campus_admin") return <Navigate to="/campus-admin" replace />
    return <Navigate to="/student" replace />
  }
  return children
}

export default function AppRouter() {
  const { setAuth, clearAuth } = useAuthStore()
  const [isHydrating, setIsHydrating] = useState(true)

  useEffect(() => {
    const hydrate = async () => {
      const access = localStorage.getItem("access_token")
      const refresh = localStorage.getItem("refresh_token")
      
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

  if (isHydrating) return null // Or a full page LoadingSpinner if preferred

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<StudentLoginPage />} />
      <Route path="/register" element={<StudentRegisterPage />} />
      <Route path="/verify" element={<OTPVerificationPage />} />
      <Route path="/password-reset" element={<PasswordResetPage />} />
      <Route path="/student" element={<RequireAuth role="student"><StudentDashboard /></RequireAuth>} />
      <Route path="/student/book" element={<RequireAuth role="student"><StudentBookRide /></RequireAuth>} />
      <Route path="/student/rides" element={<RequireAuth role="student"><StudentRideHistory /></RequireAuth>} />
      <Route path="/student/wallet" element={<RequireAuth role="student"><StudentWallet /></RequireAuth>} />
      <Route path="/student/profile" element={<RequireAuth role="student"><StudentProfile /></RequireAuth>} />
      <Route path="/student/support" element={<RequireAuth role="student"><StudentSupport /></RequireAuth>} />

      <Route path="/driver/login" element={<DriverLoginPage />} />
      <Route path="/driver/register" element={<DriverRegisterPage />} />
      <Route path="/driver" element={<RequireAuth role="driver"><DriverDashboard /></RequireAuth>} />
      <Route path="/driver/rides" element={<RequireAuth role="driver"><DriverRideHistory /></RequireAuth>} />
      <Route path="/driver/profile" element={<RequireAuth role="driver"><DriverProfile /></RequireAuth>} />

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth role="admin"><AdminUsers /></RequireAuth>} />
      <Route path="/admin/rides" element={<RequireAuth role="admin"><AdminRides /></RequireAuth>} />
      <Route path="/admin/drivers" element={<RequireAuth role="admin"><AdminDrivers /></RequireAuth>} />
      <Route path="/admin/analytics" element={<RequireAuth role="admin"><AdminAnalytics /></RequireAuth>} />
      <Route path="/admin/support" element={<RequireAuth role="admin"><AdminSupport /></RequireAuth>} />

      <Route path="/campus-admin/login" element={<CampusAdminLoginPage />} />
      <Route element={<RequireAuth role="campus_admin"><CampusAdminLayout /></RequireAuth>}>
        <Route path="/campus-admin" element={null} />
        <Route path="/campus-admin/users" element={<CampusAdminUsers />} />
        <Route path="/campus-admin/users/verification" element={<CampusAdminVerification />} />
        <Route path="/campus-admin/users/account-verification" element={<CampusAdminAccountVerification />} />
        <Route path="/campus-admin/users/:driverId/verify" element={<CampusAdminUnifiedVerification />} />
        <Route path="/campus-admin/rides" element={<CampusAdminRides />} />
        <Route path="/campus-admin/dispatch" element={<CampusAdminDispatch />} />
        <Route path="/campus-admin/fleet" element={<CampusAdminFleet />} />
        <Route path="/campus-admin/schedule" element={<CampusAdminSchedule />} />
        <Route path="/campus-admin/analytics" element={<CampusAdminAnalytics />} />
        <Route path="/campus-admin/engine" element={<CampusAdminEngine />} />
        <Route path="/campus-admin/profile" element={<CampusAdminProfile />} />
        <Route path="/campus-admin/settings" element={<CampusAdminSettings />} />
        <Route path="/campus-admin/notifications" element={<CampusAdminNotifications />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
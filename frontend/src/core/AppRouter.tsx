import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './authStore'

import StudentLoginPage from '../student/pages/LoginPage'
import StudentRegisterPage from '../student/pages/RegisterPage'
import StudentDashboard from '../student/pages/DashboardPage'
import StudentBookRide from '../student/pages/BookRidePage'
import StudentRideHistory from '../student/pages/RideHistoryPage'
import StudentWallet from '../student/pages/WalletPage'

import DriverLoginPage from '../driver/pages/LoginPage'
import DriverRegisterPage from '../driver/pages/RegisterPage'
import DriverDashboard from '../driver/pages/DashboardPage'
import DriverRideHistory from '../driver/pages/RideHistoryPage'

import AdminLoginPage from '../admin/pages/LoginPage'
import AdminDashboard from '../admin/pages/DashboardPage'
import AdminUsers from '../admin/pages/UsersPage'
import AdminRides from '../admin/pages/RidesPage'
import AdminDrivers from '../admin/pages/DriversPage'
import AdminAnalytics from '../admin/pages/AnalyticsPage'

function RequireAuth({ children, role }: { children: JSX.Element; role?: string }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) {
    if (role === 'driver') return <Navigate to="/driver/login" replace />
    if (role === 'admin') return <Navigate to="/admin/login" replace />
    return <Navigate to="/login" replace />
  }
  if (role && user?.role !== role) return <Navigate to="/login" replace />
  return children
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Student */}
      <Route path="/login" element={<StudentLoginPage />} />
      <Route path="/register" element={<StudentRegisterPage />} />
      <Route path="/student" element={<RequireAuth role="student"><StudentDashboard /></RequireAuth>} />
      <Route path="/student/book" element={<RequireAuth role="student"><StudentBookRide /></RequireAuth>} />
      <Route path="/student/rides" element={<RequireAuth role="student"><StudentRideHistory /></RequireAuth>} />
      <Route path="/student/wallet" element={<RequireAuth role="student"><StudentWallet /></RequireAuth>} />

      {/* Driver */}
      <Route path="/driver/login" element={<DriverLoginPage />} />
      <Route path="/driver/register" element={<DriverRegisterPage />} />
      <Route path="/driver" element={<RequireAuth role="driver"><DriverDashboard /></RequireAuth>} />
      <Route path="/driver/rides" element={<RequireAuth role="driver"><DriverRideHistory /></RequireAuth>} />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth role="admin"><AdminUsers /></RequireAuth>} />
      <Route path="/admin/rides" element={<RequireAuth role="admin"><AdminRides /></RequireAuth>} />
      <Route path="/admin/drivers" element={<RequireAuth role="admin"><AdminDrivers /></RequireAuth>} />
      <Route path="/admin/analytics" element={<RequireAuth role="admin"><AdminAnalytics /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
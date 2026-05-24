import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Car, Wallet, Star, ToggleLeft, ToggleRight, ArrowRight, History, LayoutDashboard, LogOut, TrendingUp, Clock, MapPin, User } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

const css = '' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #f4f6f3; font-family: system-ui, -apple-system, sans-serif; }' +
  '.dash { min-height: 100vh; background: #f4f6f3; }' +
  '.nav { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 0 40px; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }' +
  '.nav-left { display: flex; align-items: center; gap: 10px; }' +
  '.nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }' +
  '.nav-brand { font-weight: 700; font-size: 17px; color: #0a0a0a; letter-spacing: -0.3px; }' +
  '.driver-pill { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 700; color: #16a34a; text-transform: uppercase; }' +
  '.nav-links { display: flex; align-items: center; gap: 4px; }' +
  '.nav-link { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #6b7280; text-decoration: none; transition: background 0.15s, color 0.15s; }' +
  '.nav-link:hover { background: #f4f6f3; color: #0a0a0a; }' +
  '.nav-link.active { background: #f0fdf4; color: #007A47; }' +
  '.nav-right { display: flex; align-items: center; gap: 12px; }' +
  '.nav-greeting { font-size: 13px; color: #6b7280; }' +
  '.nav-greeting strong { color: #0a0a0a; font-weight: 600; }' +
  '.avatar-wrap { position: relative; }' +
  '.nav-avatar { width: 36px; height: 36px; background: #0a0a0a; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s; }' +
  '.nav-avatar:hover { border-color: #007A47; }' +
  '.nav-menu { position: absolute; top: 44px; right: 0; background: #fff; border: 1px solid #e8e8e8; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.1); padding: 6px; min-width: 180px; z-index: 200; }' +
  '.nav-menu-divider { height: 1px; background: #f3f4f6; margin: 4px 0; }' +
  '.nav-menu-item { display: flex; align-items: center; gap: 9px; padding: 9px 12px; font-size: 13.5px; color: #374151; font-weight: 500; cursor: pointer; border-radius: 8px; border: none; background: none; width: 100%; text-align: left; font-family: system-ui, -apple-system, sans-serif; transition: background 0.15s; text-decoration: none; }' +
  '.nav-menu-item:hover { background: #f4f6f3; }' +
  '.nav-menu-item.danger { color: #dc2626; }' +
  '.nav-menu-item.danger:hover { background: #fef2f2; }' +
  '.main { max-width: 1080px; margin: 0 auto; padding: 36px 40px; }' +
  '.pending-card { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }' +
  '.pending-icon { width: 36px; height: 36px; background: #ffedd5; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
  '.pending-title { font-size: 14px; font-weight: 600; color: #9a3412; margin-bottom: 3px; }' +
  '.pending-sub { font-size: 12px; color: #c2410c; }' +
  '.status-card { background: #0a0a0a; border-radius: 20px; padding: 32px 36px; position: relative; overflow: hidden; margin-bottom: 24px; }' +
  '.status-badge { display: inline-flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 100px; padding: 5px 12px 5px 8px; margin-bottom: 20px; }' +
  '.status-dot { width: 7px; height: 7px; border-radius: 50%; }' +
  '.status-dot.online { background: #4ade80; }' +
  '.status-dot.offline { background: #6b7280; }' +
  '.status-badge-text { font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; }' +
  '.status-badge-text.online { color: #4ade80; }' +
  '.status-badge-text.offline { color: rgba(255,255,255,0.4); }' +
  '.status-title { font-family: ui-serif, Georgia, serif; font-size: 28px; color: #fff; letter-spacing: -0.8px; line-height: 1.2; margin-bottom: 8px; }' +
  '.status-sub { font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 24px; }' +
  '.toggle-btn { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 12px 18px; cursor: pointer; transition: all 0.2s; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; color: #fff; }' +
  '.toggle-btn:hover { background: rgba(0,122,71,0.3); border-color: rgba(0,122,71,0.5); }' +
  '.toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }' +
  '.toggle-btn.online { background: rgba(0,122,71,0.2); border-color: rgba(0,122,71,0.4); }' +
  '.active-ride { background: #007A47; border-radius: 16px; padding: 22px 26px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }' +
  '.active-ride-left { display: flex; align-items: center; gap: 14px; }' +
  '.active-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
  '.active-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }' +
  '.active-route { font-size: 14px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px; }' +
  '.active-cta { display: flex; align-items: center; gap: 7px; background: #fff; color: #007A47; padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; transition: transform 0.15s; }' +
  '.active-cta:hover { transform: translateY(-1px); }' +
  '.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }' +
  '.stat-card { background: #fff; border-radius: 14px; padding: 20px 22px; border: 1px solid #eaeaea; }' +
  '.stat-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }' +
  '.stat-icon { width: 34px; height: 34px; border-radius: 9px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; }' +
  '.stat-label { font-size: 11px; font-weight: 600; color: #9ca3af; letter-spacing: 0.5px; text-transform: uppercase; }' +
  '.stat-value { font-family: ui-serif, Georgia, serif; font-size: 26px; color: #0a0a0a; letter-spacing: -0.8px; line-height: 1; }' +
  '.stat-sub { font-size: 12px; color: #9ca3af; margin-top: 4px; }' +
  '.section { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; overflow: hidden; }' +
  '.section-head { padding: 20px 26px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }' +
  '.section-title { font-size: 14px; font-weight: 700; color: #0a0a0a; }' +
  '.section-link { font-size: 12.5px; color: #007A47; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px; }' +
  '.section-link:hover { text-decoration: underline; }' +
  '.ride-row { padding: 16px 26px; border-bottom: 1px solid #f9fafb; display: flex; align-items: center; gap: 14px; transition: background 0.12s; }' +
  '.ride-row:last-child { border-bottom: none; }' +
  '.ride-row:hover { background: #fafafa; }' +
  '.ride-icon-wrap { width: 40px; height: 40px; border-radius: 10px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
  '.ride-info { flex: 1; min-width: 0; }' +
  '.ride-route { font-size: 13.5px; font-weight: 600; color: #0a0a0a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; }' +
  '.ride-meta { font-size: 12px; color: #9ca3af; }' +
  '.ride-right { text-align: right; flex-shrink: 0; }' +
  '.ride-fare { font-size: 14px; font-weight: 700; color: #0a0a0a; margin-bottom: 5px; }' +
  '.status-pill { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }' +
  '.empty { padding: 48px 28px; text-align: center; }' +
  '.empty-icon { width: 52px; height: 52px; background: #f0fdf4; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }' +
  '.empty-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 5px; }' +
  '.empty-sub { font-size: 13px; color: #9ca3af; }' +
  '@media (max-width: 900px) { .stats { grid-template-columns: 1fr 1fr; } .nav-links { display: none; } }' +
  '@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } .stats { grid-template-columns: 1fr 1fr; } .active-ride { flex-direction: column; align-items: flex-start; gap: 14px; } }'

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
  in_progress: { bg: '#eff6ff', color: '#2563eb', label: 'In Progress' },
  driver_assigned: { bg: '#fefce8', color: '#ca8a04', label: 'Assigned' },
  driver_en_route: { bg: '#fefce8', color: '#ca8a04', label: 'En Route' },
  driver_arrived: { bg: '#eff6ff', color: '#2563eb', label: 'Arrived' },
}

export default function DashboardPage() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [togglingOnline, setTogglingOnline] = useState(false)

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['driver-profile'],
    queryFn: async () => {
      const res = await api.get('/users/me/driver-profile/')
      return res.data
    },
    staleTime: 30000,
    refetchInterval: (data) => (data?.verification_status === 'approved' ? false : 60000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  const { data: activeRide } = useQuery({
    queryKey: ['driver-active-ride'],
    queryFn: async () => {
      try {
        const res = await api.get('/rides/driver/active/')
        return res.data
      } catch {
        return null
      }
    },
    refetchInterval: 15000,
  })

  const { data: recentRides } = useQuery({
    queryKey: ['driver-recent-rides'],
    queryFn: async () => {
      const res = await api.get('/rides/driver/history/?page_size=3')
      return res.data
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout/', { refresh })
    },
    onSettled: () => { clearAuth(); navigate('/driver/login') },
  })

  const toggleOnline = async () => {
    if (!profile) return
    if (profile.verification_status !== 'approved') {
      toast.error('Your account must be approved before going online.')
      return
    }
    setTogglingOnline(true)
    try {
      await api.patch('/users/me/driver-profile/availability/', { is_online: !profile.is_online })
      await refetchProfile()
      toast.success(profile.is_online ? 'You are now offline' : 'You are now online')
    } catch {
      toast.error('Failed to update availability.')
    } finally {
      setTogglingOnline(false)
    }
  }

  const naira = (val: string | number) =>
    '\u20A6' + parseFloat(String(val || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

  const isOnline = profile?.is_online
  const isApproved = profile?.verification_status === 'approved'

  return (
    <>
      <style>{css}</style>
      <div className="dash">
        <nav className="nav">
          <div className="nav-left">
            <div className="nav-badge">LR</div>
            <span className="nav-brand">LR Ride</span>
            <span className="driver-pill">Driver</span>
          </div>
          <div className="nav-links">
            <Link to="/driver" className="nav-link active"><LayoutDashboard size={15} /> Dashboard</Link>
            <Link to="/driver/rides" className="nav-link"><History size={15} /> My Trips</Link><Link to="/driver/profile" className="nav-link"><User size={15} /> Profile</Link>
          </div>
          <div className="nav-right">
            <span className="nav-greeting">Hello, <strong>{user?.first_name}</strong></span>
            <div className="avatar-wrap">
              <div className="nav-avatar" onClick={() => setMenuOpen(!menuOpen)}>
                {user?.first_name?.[0]?.toUpperCase()}
              </div>
              {menuOpen && (
                <div className="nav-menu">
                  <Link to="/driver" className="nav-menu-item" onClick={() => setMenuOpen(false)}><LayoutDashboard size={15} /> Dashboard</Link>
                  <Link to="/driver/rides" className="nav-menu-item" onClick={() => setMenuOpen(false)}><History size={15} /> My Trips</Link>
                  <div className="nav-menu-divider" />
                  <button className="nav-menu-item danger" onClick={() => logoutMutation.mutate()}><LogOut size={15} /> Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="main">
          {!isApproved && (
            <div className="pending-card">
              <div className="pending-icon"><Clock size={18} color="#ea580c" /></div>
              <div>
                <div className="pending-title">Account pending approval</div>
                <div className="pending-sub">Our team is reviewing your documents. You will be notified once approved.</div>
              </div>
            </div>
          )}

          <div className="status-card">
            <div className="status-badge">
              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
              <span className={`status-badge-text ${isOnline ? 'online' : 'offline'}`}>
                {isOnline ? 'Online - accepting rides' : 'Offline'}
              </span>
            </div>
            <div className="status-title">{isOnline ? 'You are live.' : 'You are offline.'}</div>
            <div className="status-sub">
              {isOnline ? 'Ride requests will appear here in real time.' : 'Go online to start receiving ride requests.'}
            </div>
            <button
              className={`toggle-btn ${isOnline ? 'online' : ''}`}
              onClick={toggleOnline}
              disabled={togglingOnline || !isApproved}
            >
              {isOnline
                ? <><ToggleRight size={20} color="#4ade80" /> Go Offline</>
                : <><ToggleLeft size={20} color="#6b7280" /> Go Online</>
              }
            </button>
          </div>

          {activeRide && (
            <div className="active-ride">
              <div className="active-ride-left">
                <div className="active-icon"><Car size={22} color="#fff" /></div>
                <div>
                  <div className="active-label">Active Trip</div>
                  <div className="active-route">
                    {activeRide.pickup_address}
                    <ArrowRight size={13} color="rgba(255,255,255,0.6)" />
                    {activeRide.dropoff_address}
                  </div>
                </div>
              </div>
              <Link to="/driver/rides" className="active-cta">View Trip <ArrowRight size={14} /></Link>
            </div>
          )}

          <div className="stats">
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">Total Trips</span>
                <div className="stat-icon"><Car size={16} color="#007A47" /></div>
              </div>
              <div className="stat-value">{profile?.total_trips ?? 0}</div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">Total Earnings</span>
                <div className="stat-icon"><TrendingUp size={16} color="#007A47" /></div>
              </div>
              <div className="stat-value" style={{ fontSize: '20px' }}>{naira(profile?.total_earnings || 0)}</div>
              <div className="stat-sub">Lifetime</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">Wallet</span>
                <div className="stat-icon"><Wallet size={16} color="#007A47" /></div>
              </div>
              <div className="stat-value" style={{ fontSize: '20px' }}>{naira(profile?.wallet_balance || 0)}</div>
              <div className="stat-sub">Available</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">Rating</span>
                <div className="stat-icon"><Star size={16} color="#007A47" /></div>
              </div>
              <div className="stat-value">
                {profile?.average_rating ? parseFloat(profile.average_rating).toFixed(1) : '-'}
              </div>
              <div className="stat-sub">Average score</div>
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <span className="section-title">Recent Trips</span>
              <Link to="/driver/rides" className="section-link">View all <ArrowRight size={13} /></Link>
            </div>
            {!recentRides?.results?.length ? (
              <div className="empty">
                <div className="empty-icon"><Car size={24} color="#007A47" /></div>
                <div className="empty-title">No trips yet</div>
                <div className="empty-sub">Go online to start receiving ride requests</div>
              </div>
            ) : (
              recentRides.results.map((ride: any) => {
                const s = statusMap[ride.status] || { bg: '#f3f4f6', color: '#6b7280', label: ride.status }
                return (
                  <div className="ride-row" key={ride.id}>
                    <div className="ride-icon-wrap"><Car size={18} color="#007A47" /></div>
                    <div className="ride-info">
                      <div className="ride-route">
                        <MapPin size={12} color="#9ca3af" />
                        {ride.pickup_address}
                        <ArrowRight size={12} color="#9ca3af" />
                        {ride.dropoff_address}
                      </div>
                      <div className="ride-meta">{fmt(ride.requested_at)}</div>
                    </div>
                    <div className="ride-right">
                      <div className="ride-fare">{ride.driver_earnings ? naira(ride.driver_earnings) : '-'}</div>
                      <span className="status-pill" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </main>
      </div>
    </>
  )
}
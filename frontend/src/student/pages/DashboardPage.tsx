import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Car, Wallet, ShieldCheck, MapPin, ArrowRight, LayoutDashboard, History, LogOut, MessageSquare, User } from 'lucide-react'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

export default function DashboardPage() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: ridesData } = useQuery({
    queryKey: ['rides-recent'],
    queryFn: async () => {
      const res = await api.get('/rides/my/?page_size=3')
      return res.data
    },
  })

  const { data: profile } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => {
      const res = await api.get('/users/me/student-profile/')
      return res.data
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout/', { refresh })
    },
    onSettled: () => {
      clearAuth()
      navigate('/login')
    },
  })

  const recentRides = ridesData?.results || []

  const statusMap: Record<string, { bg: string; color: string; label: string }> = {
    completed:            { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
    cancelled_by_student: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
    cancelled_by_driver:  { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
    cancelled_no_driver:  { bg: '#fef2f2', color: '#dc2626', label: 'No Driver' },
    in_progress:          { bg: '#eff6ff', color: '#2563eb', label: 'In Progress' },
    driver_assigned:      { bg: '#fefce8', color: '#ca8a04', label: 'Driver Assigned' },
    driver_en_route:      { bg: '#fefce8', color: '#ca8a04', label: 'En Route' },
    driver_arrived:       { bg: '#eff6ff', color: '#2563eb', label: 'Arrived' },
    searching:            { bg: '#fefce8', color: '#ca8a04', label: 'Searching' },
    disputed:             { bg: '#fff7ed', color: '#ea580c', label: 'Disputed' },
    requested:            { bg: '#fefce8', color: '#ca8a04', label: 'Requested' },
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

  const naira = (val: string | number) =>
    '\u20A6' + parseFloat(String(val)).toLocaleString('en-NG', { minimumFractionDigits: 2 })

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f4f6f3; font-family: var(--font-sans); }
        .dash { min-height: 100vh; background: #f4f6f3; }

        .nav { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 0 40px; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
        .nav-left { display: flex; align-items: center; gap: 10px; }
        .nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; letter-spacing: -0.5px; }
        .nav-brand { font-weight: 700; font-size: 17px; color: #0a0a0a; letter-spacing: -0.3px; }
        .nav-links { display: flex; align-items: center; gap: 4px; }
        .nav-link { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #6b7280; text-decoration: none; transition: background 0.15s, color 0.15s; }
        .nav-link:hover { background: #f4f6f3; color: #0a0a0a; }
        .nav-link.active { background: #f0fdf4; color: #007A47; }
        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-greeting { font-size: 13px; color: #6b7280; }
        .nav-greeting strong { color: #0a0a0a; font-weight: 600; }
        .avatar-wrap { position: relative; }
        .nav-avatar { width: 36px; height: 36px; background: #007A47; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s; }
        .nav-avatar:hover { border-color: #005c35; }
        .nav-menu { position: absolute; top: 44px; right: 0; background: #fff; border: 1px solid #e8e8e8; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.1); padding: 6px; min-width: 180px; z-index: 200; }
        .nav-menu-divider { height: 1px; background: #f3f4f6; margin: 4px 0; }
        .nav-menu-item { display: flex; align-items: center; gap: 9px; padding: 9px 12px; font-size: 13.5px; color: #374151; font-weight: 500; cursor: pointer; border-radius: 8px; border: none; background: none; width: 100%; text-align: left; font-family: var(--font-sans); transition: background 0.15s; text-decoration: none; }
        .nav-menu-item:hover { background: #f4f6f3; }
        .nav-menu-item.danger { color: #dc2626; }
        .nav-menu-item.danger:hover { background: #fef2f2; }

        .main { max-width: 1080px; margin: 0 auto; padding: 36px 40px; }

        .hero-card { background: #007A47; border-radius: 20px; padding: 36px 44px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; position: relative; overflow: hidden; }
        .hero-card::before { content: ''; position: absolute; top: -80px; right: -80px; width: 260px; height: 260px; border-radius: 50%; background: rgba(255,255,255,0.05); }
        .hero-card::after { content: ''; position: absolute; bottom: -50px; right: 160px; width: 160px; height: 160px; border-radius: 50%; background: rgba(255,255,255,0.04); }
        .hero-text { position: relative; z-index: 1; }
        .hero-text h2 { font-family: var(--font-serif); font-size: 30px; color: #fff; letter-spacing: -0.8px; line-height: 1.2; margin-bottom: 8px; }
        .hero-text h2 em { font-style: italic; color: rgba(255,255,255,0.62); }
        .hero-text p { color: rgba(255,255,255,0.62); font-size: 14px; line-height: 1.6; }
        .hero-cta { position: relative; z-index: 1; background: #fff; border: none; border-radius: 12px; padding: 13px 26px; color: #007A47; font-family: var(--font-sans); font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; text-decoration: none; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); transition: transform 0.15s, box-shadow 0.15s; }
        .hero-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(0,0,0,0.18); }

        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #fff; border-radius: 16px; padding: 22px 24px; border: 1px solid #eaeaea; }
        .stat-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .stat-card-icon { width: 36px; height: 36px; border-radius: 9px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; }
        .stat-card-label { font-size: 12px; font-weight: 600; color: #9ca3af; letter-spacing: 0.5px; text-transform: uppercase; }
        .stat-card-value { font-family: var(--font-serif); font-size: 30px; color: #0a0a0a; letter-spacing: -1px; line-height: 1; }
        .stat-card-sub { font-size: 12px; color: #9ca3af; margin-top: 4px; }

        .section { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; overflow: hidden; }
        .section-head { padding: 20px 26px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
        .section-title { font-size: 14px; font-weight: 700; color: #0a0a0a; }
        .section-link { font-size: 12.5px; color: #007A47; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px; }
        .section-link:hover { text-decoration: underline; }

        .ride-row { padding: 16px 26px; border-bottom: 1px solid #f9fafb; display: flex; align-items: center; gap: 14px; transition: background 0.12s; }
        .ride-row:last-child { border-bottom: none; }
        .ride-row:hover { background: #fafafa; }
        .ride-icon-wrap { width: 40px; height: 40px; border-radius: 10px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ride-info { flex: 1; min-width: 0; }
        .ride-route { font-size: 13.5px; font-weight: 600; color: #0a0a0a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; }
        .ride-meta { font-size: 12px; color: #9ca3af; }
        .ride-right { text-align: right; flex-shrink: 0; }
        .ride-fare { font-size: 14px; font-weight: 700; color: #0a0a0a; margin-bottom: 5px; }
        .status-pill { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }

        .empty { padding: 52px 28px; text-align: center; }
        .empty-icon { width: 56px; height: 56px; background: #f0fdf4; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .empty-title { font-size: 15px; font-weight: 600; color: #374151; margin-bottom: 6px; }
        .empty-sub { font-size: 13px; color: #9ca3af; margin-bottom: 20px; }
        .empty-btn { display: inline-flex; align-items: center; gap: 6px; background: #007A47; color: #fff; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none; transition: background 0.15s; }
        .empty-btn:hover { background: #006339; }

        @media (max-width: 768px) {
          .nav { padding: 0 20px; }
          .nav-links { display: none; }
          .main { padding: 24px 16px; }
          .stats { grid-template-columns: 1fr 1fr; }
          .hero-card { flex-direction: column; align-items: flex-start; gap: 20px; }
        }
      `}</style>

      <div className="dash">
        <nav className="nav">
          <div className="nav-left">
            <div className="nav-badge">LR</div>
            <span className="nav-brand">LR Ride</span>
          </div>
          <div className="nav-links">
            <Link to="/student" className="nav-link active">
              <LayoutDashboard size={15} /> Dashboard
            </Link>
            <Link to="/student/rides" className="nav-link">
              <History size={15} /> My Rides
            </Link>
          </div>
          <div className="nav-right">
            <span className="nav-greeting">Hello, <strong>{user?.first_name}</strong></span>
            <div className="avatar-wrap">
              <div className="nav-avatar" onClick={() => setMenuOpen(!menuOpen)}>
                {user?.first_name?.[0]?.toUpperCase()}
              </div>
              {menuOpen && (
                <div className="nav-menu">
                  <Link to="/student" className="nav-menu-item" onClick={() => setMenuOpen(false)}>
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                  <Link to="/student/rides" className="nav-menu-item" onClick={() => setMenuOpen(false)}>
                    <History size={15} /> My Rides
                  </Link>
                  <div className="nav-menu-divider" />
                  <button className="nav-menu-item danger" onClick={() => logoutMutation.mutate()}>
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="main">
          <div className="hero-card">
            <div className="hero-text">
              <h2>Ready for your<br /><em>next ride?</em></h2>
              <p>Book instantly, track your driver in real time, arrive safely.</p>
            </div>
            <Link to="/student/book" className="hero-cta">
              Book a Ride <ArrowRight size={16} />
            </Link>
          </div>

          <div className="stats">
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-card-label">Total Rides</span>
                <div className="stat-card-icon"><Car size={17} color="#007A47" /></div>
              </div>
              <div className="stat-card-value">{profile?.total_trips ?? 0}</div>
              <div className="stat-card-sub">All time</div>
            </div>
            <a href="/student/wallet" style={{ textDecoration: "none" }}><div className="stat-card"><div className="stat-card-top"><span className="stat-card-label">Wallet Balance</span>
                <div className="stat-card-icon"><Wallet size={17} color="#007A47" /></div>
              </div>
              <div className="stat-card-value" style={{ fontSize: '24px' }}>
                {naira(profile?.wallet_balance || 0)}
              </div>
              <div className="stat-card-sub">Tap to top up</div></div></a><div className="stat-card"><div className="stat-card-top"><span className="stat-card-label">Account</span>
                <div className="stat-card-icon"><ShieldCheck size={17} color="#007A47" /></div>
              </div>
              <div className="stat-card-value" style={{ fontSize: '20px', marginTop: '4px' }}>
                {user?.is_verified ? 'Verified' : 'Unverified'}
              </div>
              <div className="stat-card-sub" style={{ color: user?.is_phone_verified ? '#16a34a' : '#dc2626' }}>
                {user?.is_phone_verified ? 'Phone confirmed' : 'Phone unconfirmed'}
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <span className="section-title">Recent Rides</span>
              <Link to="/student/rides" className="section-link">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {recentRides.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><Car size={26} color="#007A47" /></div>
                <div className="empty-title">No rides yet</div>
                <div className="empty-sub">Book your first ride and it will appear here</div>
                <Link to="/student/book" className="empty-btn">
                  <Car size={14} /> Book Now
                </Link>
              </div>
            ) : (
              recentRides.map((ride: any) => {
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
                      <div className="ride-meta">{fmt(ride.requested_at)} &middot; {ride.vehicle_type_requested}</div>
                    </div>
                    <div className="ride-right">
                      <div className="ride-fare">
                        {ride.total_fare ? naira(ride.total_fare) : '-'}
                      </div>
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
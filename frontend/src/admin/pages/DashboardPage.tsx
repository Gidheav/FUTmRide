import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Users, Car, ShieldCheck, TrendingUp, ArrowRight, LayoutDashboard, UserCheck, LogOut, AlertCircle, BarChart2, MessageSquare } from 'lucide-react'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

const css = '' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #f4f6f3; font-family: system-ui, -apple-system, sans-serif; }' +
  '.dash { min-height: 100vh; background: #f4f6f3; }' +
  '.nav { background: #0a0a0a; padding: 0 40px; height: 64px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }' +
  '.nav-left { display: flex; align-items: center; gap: 10px; }' +
  '.nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }' +
  '.nav-brand { font-weight: 700; font-size: 16px; color: #fff; }' +
  '.nav-admin { background: rgba(0,122,71,0.2); border: 1px solid rgba(0,122,71,0.4); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: #4ade80; letter-spacing: 0.8px; text-transform: uppercase; }' +
  '.nav-links { display: flex; align-items: center; gap: 2px; }' +
  '.nav-link { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.5); text-decoration: none; transition: all 0.15s; }' +
  '.nav-link:hover { background: rgba(255,255,255,0.06); color: #fff; }' +
  '.nav-link.active { background: rgba(0,122,71,0.2); color: #4ade80; }' +
  '.nav-right { display: flex; align-items: center; gap: 10px; }' +
  '.nav-user { font-size: 13px; color: rgba(255,255,255,0.5); }' +
  '.nav-user strong { color: #fff; }' +
  '.logout-btn { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 7px 12px; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); cursor: pointer; transition: all 0.15s; }' +
  '.logout-btn:hover { background: rgba(220,38,38,0.1); border-color: rgba(220,38,38,0.3); color: #ef4444; }' +
  '.main { max-width: 1200px; margin: 0 auto; padding: 36px 40px; }' +
  '.page-head { margin-bottom: 28px; }' +
  '.page-title { font-family: ui-serif, Georgia, serif; font-size: 30px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 4px; }' +
  '.page-sub { font-size: 14px; color: #9ca3af; }' +
  '.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }' +
  '.stat-card { background: #fff; border-radius: 16px; padding: 22px 24px; border: 1px solid #eaeaea; }' +
  '.stat-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }' +
  '.stat-label { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; }' +
  '.stat-icon { width: 36px; height: 36px; border-radius: 10px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; }' +
  '.stat-value { font-family: ui-serif, Georgia, serif; font-size: 32px; color: #0a0a0a; letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }' +
  '.stat-sub { font-size: 12px; color: #9ca3af; }' +
  '.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }' +
  '.section { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; overflow: hidden; }' +
  '.section-head { padding: 20px 24px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }' +
  '.section-title { font-size: 14px; font-weight: 700; color: #0a0a0a; }' +
  '.section-link { font-size: 12.5px; color: #007A47; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px; }' +
  '.section-link:hover { text-decoration: underline; }' +
  '.table-row { padding: 14px 24px; border-bottom: 1px solid #f9fafb; display: flex; align-items: center; gap: 12px; }' +
  '.table-row:last-child { border-bottom: none; }' +
  '.row-avatar { width: 36px; height: 36px; border-radius: 50%; background: #007A47; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; flex-shrink: 0; }' +
  '.row-name { font-size: 13.5px; font-weight: 600; color: #0a0a0a; margin-bottom: 2px; }' +
  '.row-meta { font-size: 12px; color: #9ca3af; }' +
  '.row-right { margin-left: auto; text-align: right; }' +
  '.role-pill { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }' +
  '.role-student { background: #eff6ff; color: #2563eb; }' +
  '.role-driver { background: #f0fdf4; color: #16a34a; }' +
  '.status-pill { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }' +
  '.empty-row { padding: 40px 24px; text-align: center; color: #9ca3af; font-size: 13px; }' +
  '@media (max-width: 900px) { .stats { grid-template-columns: 1fr 1fr; } .grid-2 { grid-template-columns: 1fr; } .nav-links { display: none; } }' +
  '@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } }'

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
  cancelled_by_student: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
  cancelled_by_driver: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
  cancelled_no_driver: { bg: '#fef2f2', color: '#dc2626', label: 'No Driver' },
  in_progress: { bg: '#eff6ff', color: '#2563eb', label: 'In Progress' },
  searching: { bg: '#fefce8', color: '#ca8a04', label: 'Searching' },
  driver_assigned: { bg: '#fefce8', color: '#ca8a04', label: 'Assigned' },
}

export default function DashboardPage() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const { data: recentUsers } = useQuery({
    queryKey: ['admin-recent-users'],
    queryFn: async () => {
      const res = await api.get('/users/?page_size=5')
      return res.data
    },
  })

  const { data: recentRides } = useQuery({
    queryKey: ['admin-recent-rides'],
    queryFn: async () => {
      const res = await api.get('/rides/?page_size=5')
      return res.data
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout/', { refresh })
    },
    onSettled: () => { clearAuth(); navigate('/admin/login') },
  })

  const naira = (val: string | number) =>
    '\u20A6' + parseFloat(String(val || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      <style>{css}</style>
      <div className="dash">
        <nav className="nav">
          <div className="nav-left">
            <div className="nav-badge">LR</div>
            <span className="nav-brand">LR Ride</span>
            <span className="nav-admin">Admin</span>
          </div>
          <div className="nav-links">
            <Link to="/admin" className="nav-link active"><LayoutDashboard size={14} /> Dashboard</Link>
            <Link to="/admin/users" className="nav-link"><Users size={14} /> Users</Link>
            <Link to="/admin/drivers" className="nav-link"><UserCheck size={14} /> Drivers</Link>
            <Link to="/admin/rides" className="nav-link"><Car size={14} /> Rides</Link><Link to="/admin/analytics" className="nav-link"><BarChart2 size={14} /> Analytics</Link><Link to="/admin/support" className="nav-link"><MessageSquare size={14} /> Support</Link>
          </div>
          <div className="nav-right">
            <span className="nav-user">Hello, <strong>{user?.first_name}</strong></span>
            <button className="logout-btn" onClick={() => logoutMutation.mutate()}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </nav>

        <main className="main">
          <div className="page-head">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-sub">Platform overview and recent activity</p>
          </div>

          <div className="stats">
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">Total Users</span>
                <div className="stat-icon"><Users size={17} color="#007A47" /></div>
              </div>
              <div className="stat-value">{recentUsers?.pagination?.count ?? '-'}</div>
              <div className="stat-sub">Students and drivers</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">Total Rides</span>
                <div className="stat-icon"><Car size={17} color="#007A47" /></div>
              </div>
              <div className="stat-value">{recentRides?.pagination?.count ?? '-'}</div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">Active Now</span>
                <div className="stat-icon"><TrendingUp size={17} color="#007A47" /></div>
              </div>
              <div className="stat-value">-</div>
              <div className="stat-sub">Live trips</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-label">Pending Review</span>
                <div className="stat-icon"><AlertCircle size={17} color="#007A47" /></div>
              </div>
              <div className="stat-value">-</div>
              <div className="stat-sub">Driver verifications</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="section">
              <div className="section-head">
                <span className="section-title">Recent Users</span>
                <Link to="/admin/users" className="section-link">View all <ArrowRight size={13} /></Link>
              </div>
              {!recentUsers?.results?.length ? (
                <div className="empty-row">No users yet</div>
              ) : (
                recentUsers.results.map((u: any) => (
                  <div className="table-row" key={u.id}>
                    <div className="row-avatar">{u.first_name?.[0]?.toUpperCase()}</div>
                    <div>
                      <div className="row-name">{u.first_name} {u.last_name}</div>
                      <div className="row-meta">{u.phone_number}</div>
                    </div>
                    <div className="row-right">
                      <span className={`role-pill role-${u.role}`}>{u.role}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="section">
              <div className="section-head">
                <span className="section-title">Recent Rides</span>
                <Link to="/admin/rides" className="section-link">View all <ArrowRight size={13} /></Link>
              </div>
              {!recentRides?.results?.length ? (
                <div className="empty-row">No rides yet</div>
              ) : (
                recentRides.results.map((ride: any) => {
                  const s = statusMap[ride.status] || { bg: '#f3f4f6', color: '#6b7280', label: ride.status }
                  return (
                    <div className="table-row" key={ride.id}>
                      <div className="row-avatar" style={{ background: '#0a0a0a', borderRadius: '10px' }}>
                        <Car size={16} color="#fff" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ride.pickup_address} → {ride.dropoff_address}
                        </div>
                        <div className="row-meta">{ride.reference} · {fmt(ride.requested_at)}</div>
                      </div>
                      <div className="row-right">
                        <span className="status-pill" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { LayoutDashboard, LogOut, Building2, ArrowRight } from 'lucide-react'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

const css = '@import url(https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap);' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #f8fafc; font-family: Instrument Sans, sans-serif; }' +
  '.dash { min-height: 100vh; background: #f8fafc; }' +
  '.nav { background: #0f172a; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }' +
  '.nav-left, .nav-right { display: flex; align-items: center; gap: 10px; }' +
  '.nav-badge { width: 34px; height: 34px; background: #0f766e; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }' +
  '.nav-brand { color: #fff; font-weight: 700; font-size: 16px; }' +
  '.nav-role { background: rgba(45,212,191,0.15); border: 1px solid rgba(45,212,191,0.4); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: #5eead4; text-transform: uppercase; letter-spacing: 0.8px; }' +
  '.nav-link { color: #94a3b8; text-decoration: none; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }' +
  '.nav-link.active { background: rgba(45,212,191,0.15); color: #5eead4; }' +
  '.logout { border: 1px solid rgba(255,255,255,0.14); background: transparent; color: #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }' +
  '.main { max-width: 1100px; margin: 0 auto; padding: 28px 24px; }' +
  '.hero { background: linear-gradient(120deg, #0f766e, #115e59); border-radius: 18px; padding: 28px; color: #ecfeff; margin-bottom: 20px; }' +
  '.hero h1 { font-family: Instrument Serif, serif; font-size: 34px; letter-spacing: -0.8px; margin-bottom: 6px; }' +
  '.hero p { color: rgba(236,254,255,0.85); font-size: 14px; }' +
  '.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px; }' +
  '.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; }' +
  '.label { color: #94a3b8; text-transform: uppercase; letter-spacing: 0.7px; font-size: 11px; font-weight: 700; margin-bottom: 8px; }' +
  '.value { font-size: 30px; line-height: 1; color: #0f172a; font-family: Instrument Serif, serif; }' +
  '.sub { margin-top: 6px; font-size: 12px; color: #64748b; }' +
  '.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }' +
  '.action { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; text-decoration: none; color: #0f172a; }' +
  '.action-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }' +
  '.action-sub { font-size: 13px; color: #64748b; margin-bottom: 10px; }' +
  '.action-more { color: #0f766e; display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; }' +
  '@media (max-width: 900px) { .cards { grid-template-columns: 1fr; } .actions { grid-template-columns: 1fr; } }'

export default function DashboardPage() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const { data: usersData } = useQuery({
    queryKey: ['campus-admin-users-count'],
    queryFn: async () => (await api.get('/users/?page_size=1')).data,
  })

  const { data: ridesData } = useQuery({
    queryKey: ['campus-admin-rides-count'],
    queryFn: async () => (await api.get('/rides/?page_size=1')).data,
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout/', { refresh })
    },
    onSettled: () => {
      clearAuth()
      navigate('/campus-admin/login')
    },
  })

  return (
    <>
      <style>{css}</style>
      <div className="dash">
        <nav className="nav">
          <div className="nav-left">
            <div className="nav-badge">LR</div>
            <span className="nav-brand">LR Ride</span>
            <span className="nav-role">Campus Admin</span>
            <Link to="/campus-admin" className="nav-link active"><LayoutDashboard size={14} /> Dashboard</Link>
          </div>
          <div className="nav-right">
            <span style={{ color: '#cbd5e1', fontSize: '13px' }}>Hello, <strong style={{ color: '#fff' }}>{user?.first_name}</strong></span>
            <button className="logout" onClick={() => logoutMutation.mutate()}><LogOut size={14} /> Sign Out</button>
          </div>
        </nav>

        <main className="main">
          <section className="hero">
            <h1>Campus Operations</h1>
            <p>Moderate users and rides for your campus environment.</p>
          </section>

          <section className="cards">
            <div className="card">
              <div className="label">Users</div>
              <div className="value">{usersData?.pagination?.count ?? '-'}</div>
              <div className="sub">Registered students and drivers</div>
            </div>
            <div className="card">
              <div className="label">Rides</div>
              <div className="value">{ridesData?.pagination?.count ?? '-'}</div>
              <div className="sub">Total ride requests</div>
            </div>
            <div className="card">
              <div className="label">Scope</div>
              <div className="value" style={{ fontSize: '22px' }}><Building2 size={20} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Campus</div>
              <div className="sub">Moderator-level workspace</div>
            </div>
          </section>

          <section className="actions">
            <Link to="/campus-admin/users" className="action">
              <div className="action-title">Manage Users</div>
              <div className="action-sub">Review students and drivers in your campus scope.</div>
              <span className="action-more">Open users <ArrowRight size={14} /></span>
            </Link>
            <Link to="/campus-admin/rides" className="action">
              <div className="action-title">Monitor Rides</div>
              <div className="action-sub">Track ride activity and status transitions.</div>
              <span className="action-more">Open rides <ArrowRight size={14} /></span>
            </Link>
          </section>
        </main>
      </div>
    </>
  )
}

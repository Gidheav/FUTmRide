import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, Search, ArrowRight, ShieldCheck, ShieldOff } from 'lucide-react'
import api from '../../core/api'

const css = '@import url(https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap);' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #f4f6f3; font-family: Instrument Sans, sans-serif; }' +
  '.page { min-height: 100vh; background: #f4f6f3; }' +
  '.nav { background: #0a0a0a; padding: 0 40px; height: 64px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; }' +
  '.nav-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.6); cursor: pointer; text-decoration: none; transition: all 0.15s; }' +
  '.nav-back:hover { background: rgba(255,255,255,0.06); color: #fff; }' +
  '.nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }' +
  '.nav-title { font-weight: 700; font-size: 16px; color: #fff; }' +
  '.main { max-width: 1100px; margin: 0 auto; padding: 36px 40px; }' +
  '.page-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 20px; }' +
  '.page-title { font-family: Instrument Serif, serif; font-size: 28px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 4px; }' +
  '.page-sub { font-size: 14px; color: #9ca3af; }' +
  '.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }' +
  '.search-wrap { position: relative; flex: 1; max-width: 360px; }' +
  '.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; }' +
  '.search-input { width: 100%; height: 40px; padding: 0 14px 0 38px; background: #fff; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: Instrument Sans, sans-serif; font-size: 13px; color: #0a0a0a; outline: none; transition: border-color 0.15s; box-sizing: border-box; }' +
  '.search-input:focus { border-color: #007A47; }' +
  '.search-input::placeholder { color: #9ca3af; }' +
  '.filter-btn { padding: 8px 14px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fff; font-family: Instrument Sans, sans-serif; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; transition: all 0.15s; }' +
  '.filter-btn:hover { border-color: #007A47; color: #007A47; }' +
  '.filter-btn.active { background: #007A47; border-color: #007A47; color: #fff; }' +
  '.table-card { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; overflow: hidden; }' +
  '.table-head { display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr; padding: 12px 24px; border-bottom: 1px solid #f3f4f6; }' +
  '.th { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; }' +
  '.table-row { display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr; padding: 14px 24px; border-bottom: 1px solid #f9fafb; align-items: center; transition: background 0.12s; }' +
  '.table-row:last-child { border-bottom: none; }' +
  '.table-row:hover { background: #fafafa; }' +
  '.cell-user { display: flex; align-items: center; gap: 10px; }' +
  '.user-avatar { width: 34px; height: 34px; border-radius: 50%; background: #007A47; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 12px; flex-shrink: 0; }' +
  '.user-name { font-size: 13.5px; font-weight: 600; color: #0a0a0a; margin-bottom: 1px; }' +
  '.user-phone { font-size: 12px; color: #9ca3af; }' +
  '.td { font-size: 13px; color: #374151; }' +
  '.role-pill { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }' +
  '.role-student { background: #eff6ff; color: #2563eb; }' +
  '.role-driver { background: #f0fdf4; color: #16a34a; }' +
  '.role-admin { background: #fef3c7; color: #92400e; }' +
  '.verified-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; }' +
  '.verified-yes { color: #16a34a; }' +
  '.verified-no { color: #9ca3af; }' +
  '.skeleton { background: #f3f4f6; height: 52px; margin: 0; animation: shimmer 1.2s infinite; }' +
  '@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }' +
  '.empty { padding: 60px 24px; text-align: center; color: #9ca3af; font-size: 14px; }' +
  '.pagination { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-top: 1px solid #f3f4f6; }' +
  '.page-info { font-size: 13px; color: #9ca3af; }' +
  '.page-btns { display: flex; align-items: center; gap: 6px; }' +
  '.page-btn { height: 34px; padding: 0 14px; border-radius: 8px; border: 1.5px solid #e8e8e8; background: #fff; font-family: Instrument Sans, sans-serif; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s; }' +
  '.page-btn:hover:not(:disabled) { border-color: #007A47; color: #007A47; }' +
  '.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }' +
  '@media (max-width: 900px) { .table-head { display: none; } .table-row { grid-template-columns: 1fr; gap: 4px; } }' +
  '@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } }'

export default function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'all' | 'student' | 'driver'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, role],
    queryFn: async () => {
      let url = `/users/?page=${page}&page_size=15`
      if (search) url += `&search=${encodeURIComponent(search)}`
      if (role !== 'all') url += `&role=${role}`
      const res = await api.get(url)
      return res.data
    },
    staleTime: 30000,
  })

  const users = data?.results || []
  const pagination = data?.pagination

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/admin" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">Users</span>
        </nav>
        <main className="main">
          <div className="page-head">
            <div>
              <h1 className="page-title">All Users</h1>
              <p className="page-sub">{pagination?.count ?? 0} total users registered</p>
            </div>
          </div>
          <div className="toolbar">
            <div className="search-wrap">
              <span className="search-icon"><Search size={14} color="#9ca3af" /></span>
              <input
                className="search-input"
                placeholder="Search by name or phone..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            {(['all', 'student', 'driver'] as const).map(r => (
              <button key={r} className={`filter-btn${role === r ? ' active' : ''}`} onClick={() => { setRole(r); setPage(1) }}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <div className="table-card">
            <div className="table-head">
              <div className="th">User</div>
              <div className="th">Phone</div>
              <div className="th">Role</div>
              <div className="th">Verified</div>
              <div className="th">Joined</div>
            </div>
            {isLoading ? (
              [1,2,3,4,5].map(i => <div key={i} className="skeleton" />)
            ) : users.length === 0 ? (
              <div className="empty">No users found</div>
            ) : (
              users.map((u: any) => (
                <div className="table-row" key={u.id}>
                  <div className="cell-user">
                    <div className="user-avatar">{u.first_name?.[0]?.toUpperCase()}</div>
                    <div>
                      <div className="user-name">{u.first_name} {u.last_name}</div>
                      <div className="user-phone">{u.email || 'No email'}</div>
                    </div>
                  </div>
                  <div className="td">{u.phone_number}</div>
                  <div className="td"><span className={`role-pill role-${u.role}`}>{u.role}</span></div>
                  <div className="td">
                    {u.is_verified
                      ? <span className="verified-badge verified-yes"><ShieldCheck size={13} /> Verified</span>
                      : <span className="verified-badge verified-no"><ShieldOff size={13} /> Unverified</span>
                    }
                  </div>
                  <div className="td" style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {new Date(u.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              ))
            )}
            {pagination && pagination.total_pages > 1 && (
              <div className="pagination">
                <span className="page-info">Page {page} of {pagination.total_pages} &middot; {pagination.count} users</span>
                <div className="page-btns">
                  <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    <ArrowLeft size={13} /> Prev
                  </button>
                  <button className="page-btn" disabled={page === pagination.total_pages} onClick={() => setPage(p => p + 1)}>
                    Next <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
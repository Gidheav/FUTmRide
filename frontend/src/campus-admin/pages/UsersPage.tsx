import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search } from 'lucide-react'
import api from '../../core/api'

const css = '@import url(https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap);' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #f8fafc; font-family: Instrument Sans, sans-serif; }' +
  '.page { min-height: 100vh; }' +
  '.nav { background: #0f172a; padding: 0 24px; height: 64px; display: flex; align-items: center; gap: 14px; }' +
  '.back { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; text-decoration: none; }' +
  '.title { color: #fff; font-weight: 700; font-size: 16px; }' +
  '.main { max-width: 1050px; margin: 0 auto; padding: 26px 24px; }' +
  '.toolbar { margin-bottom: 14px; }' +
  '.search-wrap { position: relative; max-width: 320px; }' +
  '.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); }' +
  '.input { width: 100%; height: 40px; border: 1px solid #dbe2ea; border-radius: 10px; padding: 0 12px 0 36px; }' +
  '.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }' +
  '.head, .row { display: grid; grid-template-columns: 2fr 1.2fr 1fr 1fr; padding: 12px 16px; align-items: center; }' +
  '.head { border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }' +
  '.row { border-bottom: 1px solid #f8fafc; font-size: 13px; color: #0f172a; }' +
  '.row:last-child { border-bottom: none; }' +
  '.muted { color: #64748b; font-size: 12px; }' +
  '.pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #eff6ff; color: #1d4ed8; }' +
  '.empty { padding: 28px 16px; text-align: center; color: #64748b; }' +
  '@media (max-width: 760px) { .head { display: none; } .row { grid-template-columns: 1fr; gap: 6px; } }'

export default function UsersPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['campus-admin-users', search],
    queryFn: async () => {
      let url = '/users/?page=1&page_size=20'
      if (search) url += `&search=${encodeURIComponent(search)}`
      return (await api.get(url)).data
    },
    staleTime: 20000,
  })

  const users = data?.results || []

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/campus-admin" className="back"><ArrowLeft size={16} /></Link>
          <span className="title">Campus Users</span>
        </nav>

        <main className="main">
          <div className="toolbar">
            <div className="search-wrap">
              <span className="search-icon"><Search size={14} color="#94a3b8" /></span>
              <input className="input" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div className="head">
              <div>User</div>
              <div>Phone</div>
              <div>Role</div>
              <div>Status</div>
            </div>
            {isLoading ? (
              <div className="empty">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="empty">No users found</div>
            ) : (
              users.map((u: any) => (
                <div className="row" key={u.id}>
                  <div>
                    <div>{u.first_name} {u.last_name}</div>
                    <div className="muted">{u.email || 'No email'}</div>
                  </div>
                  <div>{u.phone_number}</div>
                  <div><span className="pill">{u.role}</span></div>
                  <div className="muted">{u.is_verified ? 'Verified' : 'Unverified'}</div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </>
  )
}

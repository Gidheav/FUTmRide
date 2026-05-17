import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Car, ArrowRight, Search, CheckCircle, Clock, XCircle } from 'lucide-react'
import api from '../../core/api'

const css = '' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #f4f6f3; font-family: system-ui, -apple-system, sans-serif; }' +
  '.page { min-height: 100vh; }' +
  '.nav { background: #0a0a0a; padding: 0 40px; height: 64px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; }' +
  '.nav-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.6); cursor: pointer; text-decoration: none; transition: all 0.15s; }' +
  '.nav-back:hover { background: rgba(255,255,255,0.06); color: #fff; }' +
  '.nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }' +
  '.nav-title { font-weight: 700; font-size: 16px; color: #fff; }' +
  '.main { max-width: 1100px; margin: 0 auto; padding: 36px 40px; }' +
  '.page-head { margin-bottom: 24px; }' +
  '.page-title { font-family: ui-serif, Georgia, serif; font-size: 28px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 4px; }' +
  '.page-sub { font-size: 14px; color: #9ca3af; }' +
  '.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }' +
  '.search-wrap { position: relative; flex: 1; max-width: 320px; }' +
  '.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; }' +
  '.search-input { width: 100%; height: 40px; padding: 0 14px 0 38px; background: #fff; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #0a0a0a; outline: none; transition: border-color 0.15s; box-sizing: border-box; }' +
  '.search-input:focus { border-color: #007A47; }' +
  '.search-input::placeholder { color: #9ca3af; }' +
  '.filter-btn { padding: 8px 14px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; transition: all 0.15s; }' +
  '.filter-btn:hover { border-color: #007A47; color: #007A47; }' +
  '.filter-btn.active { background: #007A47; border-color: #007A47; color: #fff; }' +
  '.driver-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }' +
  '.driver-card { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; padding: 20px; transition: box-shadow 0.15s; }' +
  '.driver-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }' +
  '.driver-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }' +
  '.driver-avatar { width: 44px; height: 44px; border-radius: 12px; background: #0a0a0a; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; flex-shrink: 0; }' +
  '.driver-name { font-size: 14px; font-weight: 700; color: #0a0a0a; margin-bottom: 2px; }' +
  '.driver-phone { font-size: 12px; color: #9ca3af; }' +
  '.driver-status { margin-left: auto; }' +
  '.vs-approved { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #16a34a; background: #f0fdf4; border-radius: 100px; padding: 3px 10px; }' +
  '.vs-pending { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #ca8a04; background: #fefce8; border-radius: 100px; padding: 3px 10px; }' +
  '.vs-rejected { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #dc2626; background: #fef2f2; border-radius: 100px; padding: 3px 10px; }' +
  '.vs-suspended { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #6b7280; background: #f3f4f6; border-radius: 100px; padding: 3px 10px; }' +
  '.driver-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }' +
  '.d-stat { background: #f9fafb; border-radius: 10px; padding: 10px; text-align: center; }' +
  '.d-stat-val { font-size: 16px; font-weight: 700; color: #0a0a0a; font-family: ui-serif, Georgia, serif; }' +
  '.d-stat-lbl { font-size: 10px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }' +
  '.driver-vehicle { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; gap: 8px; }' +
  '.vehicle-badge { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #6b7280; font-weight: 500; }' +
  '.online-dot { width: 7px; height: 7px; border-radius: 50%; }' +
  '.online-dot.yes { background: #4ade80; }' +
  '.online-dot.no { background: #d1d5db; }' +
  '.skeleton { background: #f3f4f6; border-radius: 16px; height: 180px; animation: shimmer 1.2s infinite; }' +
  '@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }' +
  '.empty { text-align: center; padding: 60px; color: #9ca3af; font-size: 14px; }' +
  '.pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 24px; }' +
  '.page-btn { height: 36px; padding: 0 14px; border-radius: 8px; border: 1.5px solid #e8e8e8; background: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s; }' +
  '.page-btn:hover:not(:disabled) { border-color: #007A47; color: #007A47; }' +
  '.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }' +
  '.page-info { font-size: 13px; color: #9ca3af; padding: 0 8px; }' +
  '@media (max-width: 900px) { .driver-grid { grid-template-columns: 1fr 1fr; } }' +
  '@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } .driver-grid { grid-template-columns: 1fr; } }'

const naira = (v: string | number) => '\u20A6' + parseFloat(String(v || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })

export default function DriversPage() {
  const [page, setPage] = useState(1)
  const [vStatus, setVStatus] = useState('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-drivers', page, vStatus, search],
    queryFn: async () => {
      let url = `/users/?page=${page}&page_size=12&role=driver`
      if (search) url += `&search=${encodeURIComponent(search)}`
      const res = await api.get(url)
      return res.data
    },
    staleTime: 30000,
  })

  const drivers = data?.results || []
  const pagination = data?.pagination

  const StatusBadge = ({ s }: { s: string }) => {
    if (s === 'approved') return <span className="vs-approved"><CheckCircle size={11} /> Approved</span>
    if (s === 'pending' || s === 'under_review') return <span className="vs-pending"><Clock size={11} /> {s === 'under_review' ? 'In Review' : 'Pending'}</span>
    if (s === 'rejected') return <span className="vs-rejected"><XCircle size={11} /> Rejected</span>
    return <span className="vs-suspended">Suspended</span>
  }

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/admin" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">Drivers</span>
        </nav>
        <main className="main">
          <div className="page-head">
            <h1 className="page-title">All Drivers</h1>
            <p className="page-sub">{pagination?.count ?? 0} registered drivers</p>
          </div>
          <div className="toolbar">
            <div className="search-wrap">
              <span className="search-icon"><Search size={14} color="#9ca3af" /></span>
              <input
                className="search-input"
                placeholder="Search drivers..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            {(['all', 'approved', 'pending', 'under_review'] as const).map(s => (
              <button key={s} className={`filter-btn${vStatus === s ? ' active' : ''}`} onClick={() => { setVStatus(s); setPage(1) }}>
                {s === 'under_review' ? 'In Review' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
              {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" />)}
            </div>
          ) : drivers.length === 0 ? (
            <div className="empty">No drivers found</div>
          ) : (
            <>
              <div className="driver-grid">
                {drivers.map((driver: any) => {
                  const dp = driver.driver_profile
                  return (
                    <div className="driver-card" key={driver.id}>
                      <div className="driver-card-top">
                        <div className="driver-avatar">{driver.first_name?.[0]?.toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="driver-name">{driver.first_name} {driver.last_name}</div>
                          <div className="driver-phone">{driver.phone_number}</div>
                        </div>
                        <div className="driver-status">
                          <StatusBadge s={dp?.verification_status || 'pending'} />
                        </div>
                      </div>
                      <div className="driver-stats">
                        <div className="d-stat">
                          <div className="d-stat-val">{dp?.total_trips ?? 0}</div>
                          <div className="d-stat-lbl">Trips</div>
                        </div>
                        <div className="d-stat">
                          <div className="d-stat-val" style={{ fontSize: '13px' }}>{naira(dp?.total_earnings || 0)}</div>
                          <div className="d-stat-lbl">Earned</div>
                        </div>
                        <div className="d-stat">
                          <div className="d-stat-val">{dp?.average_rating ? parseFloat(dp.average_rating).toFixed(1) : '-'}</div>
                          <div className="d-stat-lbl">Rating</div>
                        </div>
                      </div>
                      {dp && (
                        <div className="driver-vehicle">
                          <span className={`online-dot ${dp.is_online ? 'yes' : 'no'}`} />
                          <div className="vehicle-badge">
                            <Car size={13} />
                            {dp.vehicle_make} {dp.vehicle_model} &middot; {dp.plate_number}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {pagination && pagination.total_pages > 1 && (
                <div className="pagination">
                  <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ArrowLeft size={13} /> Prev</button>
                  <span className="page-info">Page {page} of {pagination.total_pages}</span>
                  <button className="page-btn" disabled={page === pagination.total_pages} onClick={() => setPage(p => p + 1)}>Next <ArrowRight size={13} /></button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
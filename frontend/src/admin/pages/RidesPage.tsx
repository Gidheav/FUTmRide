import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Car, MapPin, ArrowRight, Search } from 'lucide-react'
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
  '.filter-btn { padding: 8px 14px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; transition: all 0.15s; white-space: nowrap; }' +
  '.filter-btn:hover { border-color: #007A47; color: #007A47; }' +
  '.filter-btn.active { background: #007A47; border-color: #007A47; color: #fff; }' +
  '.rides-list { display: flex; flex-direction: column; gap: 10px; }' +
  '.ride-card { background: #fff; border-radius: 14px; border: 1px solid #eaeaea; overflow: hidden; }' +
  '.ride-card-top { padding: 16px 20px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #f9fafb; }' +
  '.ride-icon { width: 42px; height: 42px; border-radius: 10px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
  '.ride-main { flex: 1; min-width: 0; }' +
  '.ride-ref { font-size: 11px; font-weight: 600; color: #9ca3af; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 3px; }' +
  '.ride-route { font-size: 13.5px; font-weight: 600; color: #0a0a0a; display: flex; align-items: center; gap: 5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }' +
  '.ride-right { text-align: right; flex-shrink: 0; }' +
  '.ride-fare { font-size: 15px; font-weight: 700; color: #0a0a0a; margin-bottom: 4px; }' +
  '.status-pill { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }' +
  '.ride-card-bottom { padding: 10px 20px; display: flex; align-items: center; gap: 20px; background: #fafafa; }' +
  '.ride-meta { font-size: 12px; color: #9ca3af; }' +
  '.ride-meta strong { color: #6b7280; font-weight: 500; }' +
  '.skeleton { background: #f3f4f6; border-radius: 14px; height: 96px; animation: shimmer 1.2s infinite; }' +
  '@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }' +
  '.empty { text-align: center; padding: 60px; color: #9ca3af; font-size: 14px; }' +
  '.pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 24px; }' +
  '.page-btn { height: 36px; padding: 0 14px; border-radius: 8px; border: 1.5px solid #e8e8e8; background: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s; }' +
  '.page-btn:hover:not(:disabled) { border-color: #007A47; color: #007A47; }' +
  '.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }' +
  '.page-info { font-size: 13px; color: #9ca3af; padding: 0 8px; }' +
  '@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } }'

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  completed: { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
  cancelled_by_student: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
  cancelled_by_driver: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
  cancelled_no_driver: { bg: '#fef2f2', color: '#dc2626', label: 'No Driver' },
  in_progress: { bg: '#eff6ff', color: '#2563eb', label: 'In Progress' },
  searching: { bg: '#fefce8', color: '#ca8a04', label: 'Searching' },
  driver_assigned: { bg: '#fefce8', color: '#ca8a04', label: 'Assigned' },
  driver_en_route: { bg: '#fefce8', color: '#ca8a04', label: 'En Route' },
  driver_arrived: { bg: '#eff6ff', color: '#2563eb', label: 'Arrived' },
  disputed: { bg: '#fff7ed', color: '#ea580c', label: 'Disputed' },
}

const naira = (v: string | number) => '\u20A6' + parseFloat(String(v || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

export default function RidesPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-rides', page, status],
    queryFn: async () => {
      let url = `/rides/?page=${page}&page_size=15`
      if (status !== 'all') url += `&status=${status}`
      const res = await api.get(url)
      return res.data
    },
    staleTime: 15000,
  })

  const rides = data?.results || []
  const pagination = data?.pagination
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'completed', label: 'Completed' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'cancelled_by_student', label: 'Cancelled' },
    { key: 'disputed', label: 'Disputed' },
  ]

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/admin" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">All Rides</span>
        </nav>
        <main className="main">
          <div className="page-head">
            <h1 className="page-title">Rides</h1>
            <p className="page-sub">{pagination?.count ?? 0} total rides on the platform</p>
          </div>
          <div className="toolbar">
            {filters.map(f => (
              <button key={f.key} className={`filter-btn${status === f.key ? ' active' : ''}`} onClick={() => { setStatus(f.key); setPage(1) }}>
                {f.label}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" />)}
            </div>
          ) : rides.length === 0 ? (
            <div className="empty">No rides found</div>
          ) : (
            <>
              <div className="rides-list">
                {rides.map((ride: any) => {
                  const s = statusMap[ride.status] || { bg: '#f3f4f6', color: '#6b7280', label: ride.status }
                  return (
                    <div className="ride-card" key={ride.id}>
                      <div className="ride-card-top">
                        <div className="ride-icon"><Car size={19} color="#007A47" /></div>
                        <div className="ride-main">
                          <div className="ride-ref">{ride.reference}</div>
                          <div className="ride-route">
                            <MapPin size={11} color="#9ca3af" />
                            {ride.pickup_address}
                            <ArrowRight size={11} color="#9ca3af" />
                            {ride.dropoff_address}
                          </div>
                        </div>
                        <div className="ride-right">
                          <div className="ride-fare">{ride.total_fare ? naira(ride.total_fare) : '-'}</div>
                          <span className="status-pill" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        </div>
                      </div>
                      <div className="ride-card-bottom">
                        <span className="ride-meta">{fmt(ride.requested_at)}</span>
                        <span className="ride-meta"><strong>{ride.student?.full_name || 'Student'}</strong></span>
                        <span className="ride-meta">Driver: <strong>{ride.driver?.full_name || 'Unassigned'}</strong></span>
                        <span className="ride-meta" style={{ textTransform: 'capitalize' }}>{ride.payment_method}</span>
                      </div>
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
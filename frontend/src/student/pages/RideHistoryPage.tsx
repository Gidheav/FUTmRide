import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Car, MapPin, ArrowRight, Calendar, CreditCard, Filter } from 'lucide-react'
import api from '../../core/api'

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

export default function RideHistoryPage() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['rides', filter, page],
    queryFn: async () => {
      let url = `/rides/my/?page=${page}&page_size=10`
      if (filter === 'completed') url += '&status=completed'
      if (filter === 'cancelled') url += '&status=cancelled_by_student'
      const res = await api.get(url)
      return res.data
    },
  })

  const rides = data?.results || []
  const pagination = data?.pagination

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f4f6f3; font-family: 'Instrument Sans', sans-serif; }
        .page { min-height: 100vh; background: #f4f6f3; }

        .nav { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 0 40px; height: 64px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; }
        .nav-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e8e8e8; background: #fff; color: #374151; cursor: pointer; text-decoration: none; transition: background 0.15s; }
        .nav-back:hover { background: #f4f6f3; }
        .nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }
        .nav-title { font-weight: 700; font-size: 16px; color: #0a0a0a; letter-spacing: -0.3px; }
        .nav-spacer { flex: 1; }
        .nav-book { display: flex; align-items: center; gap: 7px; background: #007A47; color: #fff; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none; transition: background 0.15s; }
        .nav-book:hover { background: #006339; }

        .main { max-width: 860px; margin: 0 auto; padding: 36px 40px; }

        .page-header { margin-bottom: 28px; }
        .page-title { font-family: 'Instrument Serif', serif; font-size: 30px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 6px; }
        .page-sub { font-size: 14px; color: #9ca3af; }

        .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        .filter-icon { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .filter-btn { padding: 7px 14px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fff; font-family: 'Instrument Sans', sans-serif; font-size: 13px; font-weight: 500; color: #6b7280; cursor: pointer; transition: all 0.15s; }
        .filter-btn:hover { border-color: #007A47; color: #007A47; }
        .filter-btn.active { background: #007A47; border-color: #007A47; color: #fff; }

        .rides-list { display: flex; flex-direction: column; gap: 12px; }

        .ride-card { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; overflow: hidden; transition: box-shadow 0.15s; }
        .ride-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }

        .ride-card-top { padding: 18px 22px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #f9fafb; }
        .ride-icon { width: 44px; height: 44px; border-radius: 12px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ride-main { flex: 1; min-width: 0; }
        .ride-ref { font-size: 11px; font-weight: 600; color: #9ca3af; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px; }
        .ride-route { font-size: 14px; font-weight: 600; color: #0a0a0a; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ride-card-right { text-align: right; flex-shrink: 0; }
        .ride-fare { font-size: 16px; font-weight: 700; color: #0a0a0a; margin-bottom: 5px; }
        .status-pill { display: inline-block; padding: 4px 11px; border-radius: 100px; font-size: 11px; font-weight: 600; }

        .ride-card-bottom { padding: 12px 22px; display: flex; align-items: center; gap: 20px; }
        .ride-meta-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #9ca3af; }
        .ride-meta-item strong { color: #6b7280; font-weight: 500; }

        .empty { text-align: center; padding: 72px 28px; }
        .empty-icon { width: 64px; height: 64px; background: #f0fdf4; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .empty-title { font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 8px; }
        .empty-sub { font-size: 14px; color: #9ca3af; margin-bottom: 24px; }
        .empty-btn { display: inline-flex; align-items: center; gap: 7px; background: #007A47; color: #fff; padding: 11px 22px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none; transition: background 0.15s; }
        .empty-btn:hover { background: #006339; }

        .skeleton { background: #f3f4f6; border-radius: 16px; height: 100px; animation: shimmer 1.2s infinite; }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 28px; }
        .page-btn { width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #e8e8e8; background: #fff; font-family: 'Instrument Sans', sans-serif; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .page-btn:hover:not(:disabled) { border-color: #007A47; color: #007A47; }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-info { font-size: 13px; color: #9ca3af; padding: 0 8px; }

        @media (max-width: 640px) {
          .nav { padding: 0 16px; }
          .main { padding: 24px 16px; }
        }
      `}</style>

      <div className="page">
        <nav className="nav">
          <Link to="/student" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">My Rides</span>
          <div className="nav-spacer" />
          <Link to="/student/book" className="nav-book">
            <Car size={14} /> Book Ride
          </Link>
        </nav>

        <main className="main">
          <div className="page-header">
            <h1 className="page-title">Ride History</h1>
            <p className="page-sub">All your trips in one place</p>
          </div>

          <div className="toolbar">
            <span className="filter-icon"><Filter size={13} /> Filter</span>
            {(['all', 'completed', 'cancelled'] as const).map(f => (
              <button
                key={f}
                className={`filter-btn${filter === f ? ' active' : ''}`}
                onClick={() => { setFilter(f); setPage(1) }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" />)}
            </div>
          ) : rides.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><Car size={28} color="#007A47" /></div>
              <div className="empty-title">No rides found</div>
              <div className="empty-sub">
                {filter === 'all' ? 'You have not taken any rides yet' : `No ${filter} rides found`}
              </div>
              <Link to="/student/book" className="empty-btn">
                <Car size={14} /> Book your first ride
              </Link>
            </div>
          ) : (
            <>
              <div className="rides-list">
                {rides.map((ride: any) => {
                  const s = statusMap[ride.status] || { bg: '#f3f4f6', color: '#6b7280', label: ride.status }
                  return (
                    <div className="ride-card" key={ride.id}>
                      <div className="ride-card-top">
                        <div className="ride-icon"><Car size={20} color="#007A47" /></div>
                        <div className="ride-main">
                          <div className="ride-ref">Ref: {ride.reference}</div>
                          <div className="ride-route">
                            <MapPin size={12} color="#9ca3af" />
                            {ride.pickup_address}
                            <ArrowRight size={12} color="#9ca3af" />
                            {ride.dropoff_address}
                          </div>
                        </div>
                        <div className="ride-card-right">
                          <div className="ride-fare">
                            {ride.total_fare ? naira(ride.total_fare) : '-'}
                          </div>
                          <span className="status-pill" style={{ background: s.bg, color: s.color }}>
                            {s.label}
                          </span>
                        </div>
                      </div>
                      <div className="ride-card-bottom">
                        <div className="ride-meta-item">
                          <Calendar size={13} />
                          <strong>{fmt(ride.requested_at)}</strong>
                        </div>
                        <div className="ride-meta-item">
                          <Car size={13} />
                          <strong style={{ textTransform: 'capitalize' }}>{ride.vehicle_type_requested}</strong>
                        </div>
                        <div className="ride-meta-item">
                          <CreditCard size={13} />
                          <strong style={{ textTransform: 'capitalize' }}>{ride.payment_method}</strong>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {pagination && pagination.total_pages > 1 && (
                <div className="pagination">
                  <button
                    className="page-btn"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <span className="page-info">Page {page} of {pagination.total_pages}</span>
                  <button
                    className="page-btn"
                    disabled={page === pagination.total_pages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
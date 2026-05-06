import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import api from '../../core/api'

const css = '@import url(https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap);' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #f8fafc; font-family: Instrument Sans, sans-serif; }' +
  '.page { min-height: 100vh; }' +
  '.nav { background: #0f172a; padding: 0 24px; height: 64px; display: flex; align-items: center; gap: 14px; }' +
  '.back { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; text-decoration: none; }' +
  '.title { color: #fff; font-weight: 700; font-size: 16px; }' +
  '.main { max-width: 1050px; margin: 0 auto; padding: 26px 24px; }' +
  '.filters { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }' +
  '.btn { border: 1px solid #dbe2ea; background: #fff; color: #475569; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }' +
  '.btn.active { background: #0f766e; border-color: #0f766e; color: #fff; }' +
  '.list { display: flex; flex-direction: column; gap: 10px; }' +
  '.item { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }' +
  '.top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }' +
  '.ref { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }' +
  '.status { border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 700; background: #ecfeff; color: #0f766e; text-transform: capitalize; }' +
  '.route { font-size: 13px; color: #0f172a; margin-bottom: 6px; }' +
  '.meta { font-size: 12px; color: #64748b; }' +
  '.empty { padding: 28px; text-align: center; color: #64748b; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; }'

export default function RidesPage() {
  const [status, setStatus] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['campus-admin-rides', status],
    queryFn: async () => {
      let url = '/rides/?page=1&page_size=20'
      if (status !== 'all') url += `&status=${status}`
      return (await api.get(url)).data
    },
    staleTime: 20000,
  })

  const rides = data?.results || []
  const options = ['all', 'completed', 'in_progress', 'searching', 'cancelled_by_student']

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/campus-admin" className="back"><ArrowLeft size={16} /></Link>
          <span className="title">Campus Rides</span>
        </nav>

        <main className="main">
          <div className="filters">
            {options.map((key) => (
              <button key={key} className={`btn${status === key ? ' active' : ''}`} onClick={() => setStatus(key)}>
                {key.replaceAll('_', ' ')}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="empty">Loading rides...</div>
          ) : rides.length === 0 ? (
            <div className="empty">No rides found</div>
          ) : (
            <div className="list">
              {rides.map((ride: any) => (
                <div className="item" key={ride.id}>
                  <div className="top">
                    <div className="ref">{ride.reference}</div>
                    <span className="status">{ride.status}</span>
                  </div>
                  <div className="route">{ride.pickup_address} to {ride.dropoff_address}</div>
                  <div className="meta">
                    Fare: {ride.total_fare ? `\u20A6${Number(ride.total_fare).toLocaleString('en-NG')}` : '-'} | Payment: {ride.payment_method || '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}

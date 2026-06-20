import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../core/api'
import { routeLineLabel } from '../shared/routeDisplay'

const css = '' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  '.main { max-width: 1050px; margin: 0 auto; padding: 26px 24px; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }' +
  '.filters { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }' +
  '.btn { border: 1px solid var(--theme-border); background: var(--theme-bgCard); color: var(--theme-textSecondary); border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; }' +
  '.btn.active { background: var(--theme-accent); border-color: var(--theme-accent); color: var(--theme-bgPanel); }' +
  '.list { display: flex; flex-direction: column; gap: 10px; }' +
  '.item { background: var(--theme-bgCard); border: 1px solid var(--theme-border); border-radius: 12px; padding: 14px; }' +
  '.top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }' +
  '.ref { color: var(--theme-textMuted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }' +
  '.status { border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 700; background: var(--theme-accentBg); color: var(--theme-accent); text-transform: capitalize; }' +
  '.route { font-size: 13px; color: var(--theme-textPrimary); margin-bottom: 6px; }' +
  '.meta { font-size: 12px; color: var(--theme-textMuted); }' +
  '.empty { padding: 28px; text-align: center; color: var(--theme-textMuted); background: var(--theme-bgCard); border: 1px solid var(--theme-border); border-radius: 12px; }'

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
                <div className="route">{routeLineLabel(ride, 'pickup')}</div>
                <div className="meta">
                  Fare: {ride.total_fare ? `\u20A6${Number(ride.total_fare).toLocaleString('en-NG')}` : '-'} | Payment: {ride.payment_method || '-'}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}

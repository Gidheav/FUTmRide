import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, Car, TrendingUp, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react'
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
  '.page-head { margin-bottom: 28px; }' +
  '.page-title { font-family: Instrument Serif, serif; font-size: 28px; color: #0a0a0a; letter-spacing: -0.8px; margin-bottom: 4px; }' +
  '.page-sub { font-size: 14px; color: #9ca3af; }' +
  '.section-label { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px; }' +
  '.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 32px; }' +
  '.stat-card { background: #fff; border-radius: 14px; padding: 20px 22px; border: 1px solid #eaeaea; }' +
  '.stat-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }' +
  '.stat-label { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 0.5px; text-transform: uppercase; }' +
  '.stat-icon { width: 34px; height: 34px; border-radius: 9px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; }' +
  '.stat-value { font-family: Instrument Serif, serif; font-size: 28px; color: #0a0a0a; letter-spacing: -0.8px; line-height: 1; margin-bottom: 4px; }' +
  '.stat-sub { font-size: 12px; color: #9ca3af; }' +
  '.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 32px; }' +
  '.metric-card { background: #fff; border-radius: 14px; padding: 20px 22px; border: 1px solid #eaeaea; }' +
  '.metric-title { font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }' +
  '.metric-value { font-family: Instrument Serif, serif; font-size: 24px; color: #0a0a0a; letter-spacing: -0.6px; }' +
  '.metric-sub { font-size: 12px; color: #9ca3af; margin-top: 4px; }' +
  '.trend-card { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; padding: 24px; }' +
  '.trend-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }' +
  '.trend-title { font-size: 14px; font-weight: 700; color: #0a0a0a; }' +
  '.trend-days { display: flex; gap: 6px; }' +
  '.day-btn { padding: 5px 12px; border-radius: 8px; border: 1.5px solid #e8e8e8; background: #fff; font-family: Instrument Sans, sans-serif; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; transition: all 0.15s; }' +
  '.day-btn.active { background: #007A47; border-color: #007A47; color: #fff; }' +
  '.chart-area { position: relative; height: 200px; display: flex; align-items: flex-end; gap: 4px; }' +
  '.bar-group { flex: 1; display: flex; align-items: flex-end; gap: 2px; height: 100%; }' +
  '.bar { border-radius: 3px 3px 0 0; min-height: 4px; transition: opacity 0.15s; cursor: pointer; }' +
  '.bar:hover { opacity: 0.8; }' +
  '.bar.total { background: #e2e8f0; }' +
  '.bar.completed { background: #007A47; }' +
  '.chart-labels { display: flex; gap: 4px; margin-top: 8px; }' +
  '.chart-label { flex: 1; text-align: center; font-size: 10px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
  '.legend { display: flex; align-items: center; gap: 16px; margin-top: 16px; }' +
  '.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6b7280; }' +
  '.legend-dot { width: 10px; height: 10px; border-radius: 2px; }' +
  '.skeleton { background: #f3f4f6; border-radius: 14px; animation: shimmer 1.2s infinite; }' +
  '@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }' +
  '@media (max-width: 900px) { .stats-grid { grid-template-columns: 1fr 1fr; } .grid-3 { grid-template-columns: 1fr 1fr; } }' +
  '@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } .stats-grid { grid-template-columns: 1fr 1fr; } .grid-3 { grid-template-columns: 1fr; } }'

const naira = (v: number) => '\u20A6' + v.toLocaleString('en-NG', { minimumFractionDigits: 2 })

import { useState } from 'react'

export default function AnalyticsPage() {
  const [trendDays, setTrendDays] = useState(7)

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const res = await api.get('/analytics/summary/')
      return res.data
    },
    refetchInterval: 60000,
  })

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ['analytics-trend', trendDays],
    queryFn: async () => {
      const res = await api.get(`/analytics/rides/trend/?days=${trendDays}`)
      return res.data
    },
  })

  const maxTrendValue = trend?.trend
    ? Math.max(...trend.trend.map((d: any) => d.total), 1)
    : 1

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/admin" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">Analytics</span>
        </nav>

        <main className="main">
          <div className="page-head">
            <h1 className="page-title">Platform Analytics</h1>
            <p className="page-sub">Live platform metrics — auto-refreshes every 60 seconds</p>
          </div>

          <div className="section-label">Users</div>
          {summaryLoading ? (
            <div className="stats-grid" style={{ marginBottom: '32px' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '96px' }} />)}
            </div>
          ) : (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">Total Users</span>
                  <div className="stat-icon"><Users size={16} color="#007A47" /></div>
                </div>
                <div className="stat-value">{summary?.users?.total ?? 0}</div>
                <div className="stat-sub">{summary?.users?.students ?? 0} students · {summary?.users?.drivers ?? 0} drivers</div>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">Drivers Online</span>
                  <div className="stat-icon"><Car size={16} color="#007A47" /></div>
                </div>
                <div className="stat-value">{summary?.users?.drivers_online ?? 0}</div>
                <div className="stat-sub">of {summary?.users?.drivers_approved ?? 0} approved</div>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">Pending Approval</span>
                  <div className="stat-icon"><Clock size={16} color="#007A47" /></div>
                </div>
                <div className="stat-value">{summary?.users?.drivers_pending_review ?? 0}</div>
                <div className="stat-sub">Driver documents</div>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">Active Rides</span>
                  <div className="stat-icon"><TrendingUp size={16} color="#007A47" /></div>
                </div>
                <div className="stat-value">{summary?.rides?.active_now ?? 0}</div>
                <div className="stat-sub">Right now</div>
              </div>
            </div>
          )}

          <div className="section-label">Rides</div>
          {summaryLoading ? (
            <div className="grid-3" style={{ marginBottom: '32px' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '88px' }} />)}
            </div>
          ) : (
            <div className="grid-3">
              <div className="metric-card">
                <div className="metric-title">Total Rides</div>
                <div className="metric-value">{summary?.rides?.total ?? 0}</div>
                <div className="metric-sub">{summary?.rides?.completed ?? 0} completed</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Completion Rate</div>
                <div className="metric-value">{summary?.rides?.completion_rate ?? 0}%</div>
                <div className="metric-sub">All time</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Average Fare</div>
                <div className="metric-value" style={{ fontSize: '20px' }}>
                  {naira(summary?.rides?.average_fare ?? 0)}
                </div>
                <div className="metric-sub">Per completed ride</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Rides Today</div>
                <div className="metric-value">{summary?.rides?.today ?? 0}</div>
                <div className="metric-sub">{summary?.rides?.this_week ?? 0} this week</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Total Commission</div>
                <div className="metric-value" style={{ fontSize: '20px' }}>
                  {naira(summary?.revenue?.total_commission ?? 0)}
                </div>
                <div className="metric-sub">{naira(summary?.revenue?.today ?? 0)} today</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">This Month</div>
                <div className="metric-value">{summary?.rides?.this_month ?? 0}</div>
                <div className="metric-sub">Ride requests</div>
              </div>
            </div>
          )}

          <div className="trend-card">
            <div className="trend-head">
              <span className="trend-title">Ride Volume</span>
              <div className="trend-days">
                {[7, 14, 30].map(d => (
                  <button
                    key={d}
                    className={`day-btn${trendDays === d ? ' active' : ''}`}
                    onClick={() => setTrendDays(d)}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {trendLoading ? (
              <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
            ) : (
              <>
                <div className="chart-area">
                  {trend?.trend?.map((day: any) => (
                    <div className="bar-group" key={day.date}>
                      <div
                        className="bar total"
                        style={{ height: `${(day.total / maxTrendValue) * 100}%` }}
                        title={`${day.date}: ${day.total} total`}
                      />
                      <div
                        className="bar completed"
                        style={{ height: `${(day.completed / maxTrendValue) * 100}%` }}
                        title={`${day.date}: ${day.completed} completed`}
                      />
                    </div>
                  ))}
                </div>
                <div className="chart-labels">
                  {trend?.trend?.map((day: any) => (
                    <div className="chart-label" key={day.date}>
                      {new Date(day.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </div>
                  ))}
                </div>
                <div className="legend">
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: '#e2e8f0' }} />
                    Total requests
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: '#007A47' }} />
                    Completed
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
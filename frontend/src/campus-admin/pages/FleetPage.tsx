import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bus, Settings, Fuel, AlertTriangle, Grid, Search, Filter, CheckCircle,
  Wrench, XCircle, LineChart, BarChart2, Package, Plus
} from 'lucide-react'
import api from '../../core/api'
import { T } from '../theme'

export default function FleetPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['campus-admin-fleet', debouncedSearch],
    queryFn: async () => {
      let url = '/users/fleet/?page=1&page_size=100'
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`
      return (await api.get(url)).data
    },
    staleTime: 20000,
  })

  const fleetRows = useMemo(() => {
    if (!data) return []
    if (Array.isArray(data)) return data
    return data?.results || []
  }, [data])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const isOverdue = (dateStr?: string | null) => {
    if (!dateStr) return false
    const d = new Date(`${dateStr}T00:00:00`)
    return !Number.isNaN(d.getTime()) && d < today
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A'
    const d = new Date(`${dateStr}T00:00:00`)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const vehicleTypeLabel = (value?: string | null) => {
    if (!value) return 'Unknown'
    const map: Record<string, string> = {
      motorcycle: 'Motorcycle',
      tricycle: 'Tricycle (Keke)',
      sedan: 'Sedan',
      suv: 'SUV',
      minivan: 'Minivan / Shuttle',
    }
    return map[value] || value
  }

  const statusLabel = (value?: string | null) => {
    if (!value) return 'Active'
    const map: Record<string, string> = {
      active: 'Active',
      in_service: 'In-Service',
      grounded: 'Grounded',
      in_shop: 'In Shop',
    }
    return map[value] || value
  }

  const statusColor = (value?: string | null) => {
    if (value === 'in_service') return T.accent
    if (value === 'grounded') return T.error
    if (value === 'in_shop') return T.warn
    return T.heatTeal
  }

  const statusBorder = (value?: string | null) => {
    if (value === 'in_service') return 'rgba(168,85,247,0.3)'
    if (value === 'grounded') return 'rgba(239,68,68,0.3)'
    if (value === 'in_shop') return 'rgba(245,158,11,0.3)'
    return 'rgba(20,184,166,0.3)'
  }

  const statusBg = (value?: string | null) => {
    if (value === 'in_service') return T.accentBg
    if (value === 'grounded') return 'rgba(239,68,68,0.1)'
    if (value === 'in_shop') return 'rgba(245,158,11,0.1)'
    return 'rgba(20,184,166,0.1)'
  }

  return (
    <>
      <style>{`
        .fleet-container {
          padding: 0px;
          display: flex;
          flex-direction: column;
          gap: 1px;
          height: 100%;
          overflow-y: auto;
          font-family: var(--font-sans);
          background: var(--theme-border);
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1px;
          background: var(--theme-border);
        }
        .main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1px;
          background: var(--theme-border);
        }
        @media (min-width: 1280px) {
          .main-grid {
            grid-template-columns: 2fr 1fr;
          }
        }
        .analytics-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1px;
          background: var(--theme-border);
        }
        @media (min-width: 768px) {
          .analytics-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .tr-hover:hover {
          background-color: var(--theme-bgCardHover) !important;
        }
        .bar-hover:hover {
          background-color: var(--theme-warn) !important;
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="fleet-container hide-scrollbar">
        {/* SECTION 1: Operational KPIs (Top Row) */}
        <div className="kpi-grid">
          {/* KPI: Total Fleet */}
          <div style={s.kpiCard}>
            <div style={s.kpiIconWrap}><Bus size={36} color={T.heatTeal} /></div>
            <span style={s.kpiLabel}>Total Fleet Active</span>
            <div style={s.kpiValueRow}>
              <span style={s.kpiValue}>142</span>
              <span style={s.kpiSubValue}>/ 156 Total</span>
            </div>
            <div style={s.progressBarBg}>
              <div style={{ ...s.progressBarFill, width: '91%', background: T.heatTeal }} />
            </div>
            <div style={s.kpiFooter}>
              <span>91% Utilization</span>
              <span style={{ color: T.heatTeal }}>+2.4% vs last week</span>
            </div>
          </div>

          {/* KPI: Maintenance Health */}
          <div style={s.kpiCard}>
            <div style={s.kpiIconWrap}><Settings size={36} color={T.accent} /></div>
            <span style={s.kpiLabel}>Maintenance Health Index</span>
            <div style={s.kpiValueRow}>
              <span style={s.kpiValue}>88.4</span>
              <span style={s.kpiSubValue}>/ 100</span>
            </div>
            <div style={s.badgeRow}>
              <span style={{ ...s.badge, color: T.accent, background: T.accentBg }}>9 In Shop</span>
              <span style={{ ...s.badge, color: T.heatTeal, background: 'rgba(20,184,166,0.1)' }}>132 Cleared</span>
              <span style={{ ...s.badge, color: T.error, background: 'rgba(239,68,68,0.1)' }}>5 Critical</span>
            </div>
          </div>

          {/* KPI: Fuel Efficiency */}
          <div style={s.kpiCard}>
            <div style={s.kpiIconWrap}><Fuel size={36} color={T.warn} /></div>
            <span style={s.kpiLabel}>Fleet Fuel Efficiency</span>
            <div style={s.kpiValueRow}>
              <span style={s.kpiValue}>8.2</span>
              <span style={s.kpiSubValue}>km/L Avg</span>
            </div>
            <div style={s.sparklineRow}>
              <div style={{ ...s.sparkBar, height: '40%' }}></div>
              <div style={{ ...s.sparkBar, height: '50%' }}></div>
              <div style={{ ...s.sparkBar, height: '45%' }}></div>
              <div style={{ ...s.sparkBar, height: '60%' }}></div>
              <div style={{ ...s.sparkBar, height: '75%' }}></div>
              <div style={{ ...s.sparkBarActive, height: '80%' }}></div>
            </div>
          </div>

          {/* KPI: Compliance Alerts */}
          <div style={{ ...s.kpiCard, borderLeft: `4px solid ${T.error}` }}>
            <div style={s.kpiIconWrap}><AlertTriangle size={36} color={T.error} /></div>
            <span style={s.kpiLabel}>Compliance Alerts</span>
            <div style={s.kpiValueRow}>
              <span style={{ ...s.kpiValue, color: T.error }}>12</span>
              <span style={s.kpiSubValue}>Action Req.</span>
            </div>
            <div style={s.listCol}>
              <div style={s.listItem}>
                <span style={{ color: T.textMuted }}>Expiring Insurance</span>
                <span style={{ color: T.textPrimary, fontFamily: 'monospace', fontWeight: 600 }}>4</span>
              </div>
              <div style={s.listItem}>
                <span style={{ color: T.textMuted }}>Permit Renewals</span>
                <span style={{ color: T.textPrimary, fontFamily: 'monospace', fontWeight: 600 }}>8</span>
              </div>
            </div>
          </div>
        </div>

        <div className="main-grid">
          {/* Left Column */}
          <div style={s.leftCol}>
            {/* Fleet Inventory Command */}
            <div style={s.inventoryPanel}>
              <div style={s.panelHeader}>
                <div style={s.headerLeft}>
                  <Grid size={18} color={T.accent} />
                  <h2 style={s.panelTitle}>Fleet Inventory Command</h2>
                </div>
                <div style={s.headerRight}>
                  <div style={s.searchWrap}>
                    <Search size={14} color={T.textMuted} style={s.searchIcon} />
                    <input
                      style={s.searchInput}
                      placeholder="Search ID, Model..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <button style={s.filterBtn}>
                    <Filter size={14} /> Filter
                  </button>
                </div>
              </div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead style={s.thead}>
                    <tr>
                      <th style={s.th}>Vehicle ID</th>
                      <th style={s.th}>Model & Type</th>
                      <th style={s.th}>Status</th>
                      <th style={s.th}>Assigned Driver</th>
                      <th style={s.th}>Last Service</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Odometer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr>
                        <td style={{ ...s.td, textAlign: 'center', color: T.textMuted }} colSpan={6}>
                          Loading fleet inventory...
                        </td>
                      </tr>
                    )}
                    {isError && !isLoading && (
                      <tr>
                        <td style={{ ...s.td, textAlign: 'center', color: T.error }} colSpan={6}>
                          Unable to load fleet inventory. Please try again.
                        </td>
                      </tr>
                    )}
                    {!isLoading && !isError && fleetRows.length === 0 && (
                      <tr>
                        <td style={{ ...s.td, textAlign: 'center', color: T.textMuted }} colSpan={6}>
                          No fleet records found.
                        </td>
                      </tr>
                    )}
                    {!isLoading && !isError && fleetRows.map((v: any, i: number) => {
                      const maintenance = v.maintenance_status || 'active'
                      const isShop = maintenance === 'in_shop'
                      const overdue = isOverdue(v.service_due_date)
                      const modelText = `${v.vehicle_make ?? ''} ${v.vehicle_model ?? ''} ${v.vehicle_year ?? ''}`.trim()
                      const odoText = typeof v.odometer_km === 'number'
                        ? `${v.odometer_km.toLocaleString()} km`
                        : '0 km'
                      const lastServiceText = isShop ? 'In Shop' : formatDate(v.last_service_date)

                      return (
                        <tr key={v.id ?? i} className="tr-hover" style={isShop ? { ...s.tr, background: T.accentBg } : overdue ? { ...s.tr, background: T.warnBg } : s.tr}>
                          <td style={s.td}>
                            <div style={s.idWrap}>
                              <div style={{ ...s.dot, background: statusColor(maintenance) }} />
                              <span style={s.idText}>{v.plate_number || 'N/A'}</span>
                            </div>
                          </td>
                          <td style={s.td}>
                            <div style={s.modelWrap}>
                              <span style={s.modelText}>{modelText || 'Unknown Vehicle'}</span>
                              <span style={s.typeText}>{vehicleTypeLabel(v.vehicle_type)}</span>
                            </div>
                          </td>
                          <td style={s.td}>
                            <span style={{
                              ...s.statusBadge,
                              color: statusColor(maintenance),
                              borderColor: statusBorder(maintenance),
                              background: statusBg(maintenance),
                            }}>
                              {maintenance === 'active' ? <CheckCircle size={10} /> : maintenance === 'in_service' || maintenance === 'in_shop' ? <Wrench size={10} /> : <XCircle size={10} />}
                              {statusLabel(maintenance)}
                            </span>
                          </td>
                          <td style={s.td}>
                            <span style={{ color: v.user?.full_name ? T.textPrimary : T.textMuted, fontStyle: v.user?.full_name ? 'normal' : 'italic', fontSize: 13 }}>
                              {v.user?.full_name || 'Unassigned'}
                            </span>
                          </td>
                          <td style={s.td}>
                            <span style={{ fontFamily: 'monospace', fontSize: 13, color: isShop ? T.accent : T.textMuted, fontWeight: isShop ? 600 : 400 }}>
                              {lastServiceText} {overdue && <span style={{ color: T.error, fontSize: 10, marginLeft: 4 }}>(Overdue)</span>}
                            </span>
                          </td>
                          <td style={{ ...s.td, textAlign: 'right' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 13, color: T.textPrimary }}>
                              {odoText}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analytics Engine */}
            <div className="analytics-grid">
              <div style={s.chartCard}>
                <div style={s.chartHeader}>
                  <h3 style={s.chartTitle}><LineChart size={16} color={T.accent} /> Uptime vs Maintenance Costs</h3>
                  <span style={s.moreBtn}>•••</span>
                </div>
                <div style={s.chartBody}>
                  <div style={s.chartAbstract}>
                    <svg style={s.svgChart} preserveAspectRatio="none" viewBox="0 0 100 100">
                      <path d="M 0 80 Q 20 60 40 70 T 80 30 T 100 20" fill="none" stroke={T.accent} strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
                      <path d="M 0 90 L 20 85 L 40 88 L 60 70 L 80 75 L 100 60" fill="none" stroke={T.heatTeal} strokeDasharray="4" strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
                    </svg>
                  </div>
                  <div style={s.chartLabels}>
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                  </div>
                </div>
              </div>

              <div style={s.chartCard}>
                <div style={s.chartHeader}>
                  <h3 style={s.chartTitle}><BarChart2 size={16} color={T.warn} /> Grounded Fleet Duration</h3>
                  <span style={s.timeBadge}>This Month</span>
                </div>
                <div style={s.barChartBody}>
                  <div style={{ ...s.barWrap, height: '20%' }}><div className="bar-hover" style={s.bar}></div></div>
                  <div style={{ ...s.barWrap, height: '35%' }}><div className="bar-hover" style={s.bar}></div></div>
                  <div style={{ ...s.barWrap, height: '80%' }}><div style={{ ...s.bar, background: T.error }}></div></div>
                  <div style={{ ...s.barWrap, height: '15%' }}><div className="bar-hover" style={s.bar}></div></div>
                  <div style={{ ...s.barWrap, height: '40%' }}><div className="bar-hover" style={s.bar}></div></div>
                  <div style={{ ...s.barWrap, height: '10%' }}><div className="bar-hover" style={s.bar}></div></div>
                </div>
                <div style={s.chartLabels}>
                  <span>V-01</span><span>V-02</span><span>V-03</span><span>V-04</span><span>V-05</span><span>V-06</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Service & Maintenance Pipeline */}
          <div style={s.rightCol}>
            <div style={s.queuePanel}>
              <div style={s.panelHeaderCol}>
                <div style={s.qHeaderTop}>
                  <h2 style={s.panelTitle}><Wrench size={18} color={T.accent} /> Maintenance Queue</h2>
                  <span style={s.qActiveBadge}>9 Active</span>
                </div>
                <div style={s.qFilters}>
                  <button style={s.qFilterBtnActive}>All</button>
                  <button style={s.qFilterBtn}>In Workshop</button>
                  <button style={s.qFilterBtn}>Pending</button>
                </div>
              </div>
              <div style={s.qList}>

                {/* Critical */}
                <div style={{ ...s.qItem, borderLeft: `4px solid ${T.error}` }}>
                  <div style={s.qItemTop}>
                    <div>
                      <div style={s.qItemTitle}>LR-VAN-082</div>
                      <div style={s.qItemSub}>Ford Transit • Engine Overhaul</div>
                    </div>
                    <span style={{ ...s.qStatusBadge, background: 'rgba(239,68,68,0.1)', color: T.error, borderColor: 'rgba(239,68,68,0.3)' }}>CRITICAL</span>
                  </div>
                  <div style={s.qProgressWrap}>
                    <div style={s.qProgressLabels}>
                      <span>Workshop Bay 4</span>
                      <span style={{ color: T.textMuted }}>Est. Completion: 48h</span>
                    </div>
                    <div style={s.qProgressBarBg}>
                      <div style={{ ...s.qProgressBarFill, width: '25%', background: T.error }} />
                    </div>
                    <div style={s.qProgressSteps}>
                      <span>Diagnosis</span><span>Parts Ordered</span><span>Repair</span><span>Testing</span>
                    </div>
                  </div>
                </div>

                {/* Routine */}
                <div style={{ ...s.qItem, borderLeft: `4px solid ${T.accent}` }}>
                  <div style={s.qItemTop}>
                    <div>
                      <div style={s.qItemTitle}>LR-BUS-011</div>
                      <div style={s.qItemSub}>Toyota Hiace • 50k Routine Service</div>
                    </div>
                    <span style={{ ...s.qStatusBadge, background: T.accentBg, color: T.accent, borderColor: 'rgba(168,85,247,0.3)' }}>IN WORKSHOP</span>
                  </div>
                  <div style={s.qProgressWrap}>
                    <div style={s.qProgressLabels}>
                      <span>Workshop Bay 2</span>
                      <span style={{ color: T.textMuted }}>Est. Completion: 2h</span>
                    </div>
                    <div style={s.qProgressBarBg}>
                      <div style={{ ...s.qProgressBarFill, width: '70%', background: T.accent }} />
                    </div>
                  </div>
                </div>

                {/* Parts Pending */}
                <div style={{ ...s.qItem, borderLeft: `4px solid ${T.warn}` }}>
                  <div style={s.qItemTop}>
                    <div>
                      <div style={s.qItemTitle}>LR-CAR-042</div>
                      <div style={s.qItemSub}>Hyundai Elantra • Brake Pad Replacement</div>
                    </div>
                    <span style={{ ...s.qStatusBadge, background: T.warnBg, color: T.warn, borderColor: 'rgba(245,158,11,0.3)' }}>PARTS DELAYED</span>
                  </div>
                  <div style={s.qNote}>
                    <Package size={14} color={T.warn} />
                    <span>Waiting on OEM Brake Pads (ETA: Tomorrow)</span>
                  </div>
                </div>

                {/* Scheduled */}
                <div style={{ ...s.qItem, border: `1px dashed ${T.border}`, opacity: 0.7 }}>
                  <div style={s.qItemTop}>
                    <div>
                      <div style={s.qItemTitle}>LR-BUS-033</div>
                      <div style={s.qItemSub}>Nissan Urvan • Tire Rotation</div>
                    </div>
                    <span style={{ ...s.qStatusBadge, background: T.bgInput, color: T.textPrimary, borderColor: T.border }}>SCHEDULED 14:00</span>
                  </div>
                </div>

                <div style={{ ...s.qItem, border: `1px dashed ${T.border}`, opacity: 0.7 }}>
                  <div style={s.qItemTop}>
                    <div>
                      <div style={s.qItemTitle}>LR-VAN-015</div>
                      <div style={s.qItemSub}>Ford Transit • AC Inspection</div>
                    </div>
                    <span style={{ ...s.qStatusBadge, background: T.bgInput, color: T.textPrimary, borderColor: T.border }}>SCHEDULED 16:30</span>
                  </div>
                </div>
              </div>
              <div style={s.qFooter}>
                <button style={s.qAddBtn}>
                  <Plus size={16} /> Log New Maintenance Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const s: Record<string, CSSProperties> = {
  // KPI Section
  kpiCard: {
    background: T.bgPanel,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  kpiIconWrap: {
    position: 'absolute',
    top: 16,
    right: 16,
    opacity: 0.15,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  kpiValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: 800,
    color: T.textPrimary,
    lineHeight: 1,
  },
  kpiSubValue: {
    fontSize: 12,
    color: T.textMuted,
  },
  progressBarBg: {
    width: '100%',
    background: T.border,
    height: 6,
    borderRadius: 3,
    marginTop: 'auto',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  kpiFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    fontSize: 10,
    color: T.textMuted,
    fontWeight: 600,
  },
  badgeRow: {
    display: 'flex',
    gap: 8,
    marginTop: 'auto',
  },
  badge: {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    border: '1px solid transparent',
  },
  sparklineRow: {
    height: 32,
    width: '100%',
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
  },
  sparkBar: {
    flex: 1,
    background: T.border,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  sparkBarActive: {
    flex: 1,
    background: T.warn,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    boxShadow: `0 0 8px ${T.warnBg}`,
  },
  listCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 'auto',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
  },

  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    background: T.border,
  },
  
  // Inventory Panel
  inventoryPanel: {
    background: T.bgPanel,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: 600,
  },
  panelHeader: {
    padding: 16,
    borderBottom: `1px solid ${T.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: T.bgCard,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: T.textPrimary,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    display: 'flex',
    gap: 12,
  },
  searchWrap: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 8,
    top: 8,
  },
  searchInput: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    fontSize: 13,
    borderRadius: 6,
    padding: '6px 12px 6px 30px',
    outline: 'none',
    width: 200,
    fontFamily: T.fontFamily,
  },
  filterBtn: {
    padding: '6px 12px',
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.textPrimary,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  thead: {
    position: 'sticky',
    top: 0,
    background: T.bgCard,
    zIndex: 10,
    boxShadow: `0 1px 0 ${T.border}`,
  },
  th: {
    padding: '12px 16px',
    fontSize: 11,
    color: T.textMuted,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tr: {
    borderBottom: `1px solid ${T.border}`,
    transition: 'background 0.2s',
  },
  td: {
    padding: '12px 16px',
  },
  idWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  idText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 600,
    color: T.textPrimary,
  },
  modelWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  modelText: {
    fontSize: 13,
    color: T.textPrimary,
  },
  typeText: {
    fontSize: 11,
    color: T.textMuted,
  },
  statusBadge: {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    border: '1px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    textTransform: 'uppercase',
  },

  chartCard: {
    background: T.bgPanel,
    padding: '16px 20px',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: T.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  moreBtn: {
    color: T.textMuted,
    cursor: 'pointer',
    letterSpacing: 2,
  },
  timeBadge: {
    fontSize: 10,
    color: T.textMuted,
    background: T.bgInput,
    padding: '2px 6px',
    borderRadius: 4,
  },
  chartBody: {
    height: 160,
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    borderBottom: `1px solid ${T.border}`,
    borderLeft: `1px solid ${T.border}`,
    paddingBottom: 4,
    paddingLeft: 4,
  },
  chartAbstract: {
    position: 'absolute',
    inset: 0,
  },
  svgChart: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  chartLabels: {
    position: 'absolute',
    bottom: -24,
    left: 0,
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    color: T.textMuted,
  },
  barChartBody: {
    height: 160,
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 16,
    position: 'relative',
    borderBottom: `1px solid ${T.border}`,
    marginBottom: 8,
  },
  barWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    height: '100%',
  },
  bar: {
    width: '100%',
    background: T.border,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    transition: 'background 0.2s',
  },

  // Right Column
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  queuePanel: {
    background: T.bgPanel,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
  },
  panelHeaderCol: {
    padding: 16,
    borderBottom: `1px solid ${T.border}`,
    background: T.bgCard,
  },
  qHeaderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qActiveBadge: {
    background: T.bgInput,
    color: T.textPrimary,
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  qFilters: {
    display: 'flex',
    gap: 8,
  },
  qFilterBtnActive: {
    padding: '4px 12px',
    background: T.border,
    color: T.textPrimary,
    fontSize: 11,
    border: `1px solid ${T.textMuted}`,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
  },
  qFilterBtn: {
    padding: '4px 12px',
    background: 'transparent',
    color: T.textMuted,
    fontSize: 11,
    border: `1px solid ${T.border}`,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
  },
  qList: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  qItem: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    padding: 12,
    position: 'relative',
  },
  qItemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  qItemTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 700,
    color: T.textPrimary,
  },
  qItemSub: {
    fontSize: 11,
    color: T.textMuted,
  },
  qStatusBadge: {
    padding: '2px 6px',
    fontSize: 9,
    fontWeight: 700,
    border: '1px solid transparent',
  },
  qProgressWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  qProgressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    color: T.textPrimary,
  },
  qProgressBarBg: {
    width: '100%',
    background: T.border,
    height: 4,
    borderRadius: 2,
  },
  qProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  qProgressSteps: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    color: T.textMuted,
    marginTop: 2,
  },
  qNote: {
    background: T.bgCard,
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    color: T.textMuted,
  },
  qFooter: {
    padding: 16,
    borderTop: `1px solid ${T.border}`,
    background: T.bgCard,
  },
  qAddBtn: {
    width: '100%',
    background: T.bgInput,
    color: T.textPrimary,
    border: `1px solid ${T.border}`,
    padding: '8px',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontFamily: T.fontFamily,
  },
}


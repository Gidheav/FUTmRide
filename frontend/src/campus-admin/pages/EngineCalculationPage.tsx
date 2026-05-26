import { useState, useEffect, type CSSProperties } from 'react'
import {
  Calculator, Terminal, CheckCircle, AlertTriangle, Play,
  ChevronDown, ToggleLeft, ToggleRight, Save, Activity, Check, Edit2, RotateCcw
} from 'lucide-react'
import { T } from '../theme'
import api from '../../core/api'

// ── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  // Page shell
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    background: T.border,
    minHeight: '100%',
    fontFamily: T.fontFamily,
  },

  // KPI row
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 1,
    background: T.border,
  },
  kpiCard: {
    background: T.bgPanel,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  kpiValueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 800,
    color: T.textPrimary,
    fontFamily: 'monospace',
    lineHeight: 1,
  },

  // Main grid
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 1,
    background: T.border,
  },

  // Panel shared
  panel: {
    background: T.bgPanel,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '14px 18px',
    borderBottom: `1px solid ${T.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: T.bgCard,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: T.textPrimary,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  panelFooter: {
    padding: '12px 18px',
    borderTop: `1px solid ${T.border}`,
    background: T.bgCard,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Form fields
  fieldGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: T.textMuted,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  inputWarning: {
    background: T.bgInput,
    border: `1px solid rgba(239,68,68,0.4)`,
    color: T.textPrimary,
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    cursor: 'pointer',
    appearance: 'none',
    fontFamily: T.fontFamily,
  },

  // Tabs
  tabGroup: {
    display: 'flex',
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: 3,
    gap: 2,
    overflowX: 'auto',
  },
  tabActive: {
    padding: '5px 14px',
    background: T.bgCard,
    color: T.textPrimary,
    border: `1px solid ${T.border}`,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
    whiteSpace: 'nowrap',
  },
  tabInactive: {
    padding: '5px 14px',
    background: 'transparent',
    color: T.textMuted,
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
    whiteSpace: 'nowrap',
  },

  // Badges
  badgeGreen: {
    padding: '2px 8px',
    background: 'rgba(16,185,129,0.12)',
    color: '#10b981',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
  },
  badgeWarning: {
    fontSize: 10,
    color: T.error,
    fontWeight: 700,
  },
  badgeMuted: {
    padding: '2px 8px',
    background: T.bgInput,
    color: T.textMuted,
    border: `1px solid ${T.border}`,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: T.textMuted,
  },

  // Buttons
  btnPrimary: {
    padding: '8px 16px',
    background: T.accentDim,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
    transition: 'opacity 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  btnSecondary: {
    padding: '8px 16px',
    background: T.bgInput,
    color: T.textPrimary,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  btnRun: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '9px 0',
    background: T.bgCard,
    color: T.textPrimary,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
    width: '100%',
    marginTop: 8,
  },

  // Simulation console
  simGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 16,
    padding: 18,
  },
  simInputCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  simSelects: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  selectWarning: {
    background: T.bgInput,
    border: `1px solid rgba(239,68,68,0.4)`,
    color: T.textPrimary,
    padding: '7px 12px',
    borderRadius: 6,
    fontSize: 12,
    outline: 'none',
    width: '100%',
    cursor: 'pointer',
    appearance: 'none',
    fontFamily: T.fontFamily,
  },

  // Output trace
  traceBox: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: 16,
    fontFamily: 'monospace',
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
  },
  traceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    color: T.textMuted,
    fontSize: 10,
    fontWeight: 700,
    borderBottom: `1px solid ${T.border}`,
    paddingBottom: 10,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  traceLine: {
    display: 'flex',
    justifyContent: 'space-between',
    color: T.textPrimary,
    padding: '3px 0',
  },
  traceSubtotal: {
    display: 'flex',
    justifyContent: 'space-between',
    color: T.purple,
    borderTop: `1px dashed ${T.border}`,
    marginTop: 8,
    paddingTop: 8,
    padding: '8px 0',
  },
  traceSurge: {
    display: 'flex',
    justifyContent: 'space-between',
    color: T.error,
  },
  traceFinal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: `1px solid ${T.border}`,
    marginTop: 12,
    paddingTop: 12,
  },
  traceFinalLabel: {
    fontSize: 11,
    color: T.textMuted,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  traceFinalValue: {
    fontSize: 22,
    fontWeight: 800,
    color: '#10b981',
  },

  // Live badge
  liveBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#10b981',
    border: '1px solid rgba(16,185,129,0.3)',
    background: 'rgba(16,185,129,0.1)',
    padding: '3px 8px',
    borderRadius: 4,
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },

  // Global constraints
  constraintRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderBottom: `1px solid ${T.border}`,
    paddingBottom: 14,
  },
  constraintLast: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  rangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  hint: {
    fontSize: 10,
    color: T.textMuted,
    marginTop: 2,
  },
}

// ── Types ──────────────────────────────────────────────────────────────────
interface PlatformSettings {
  commission_rate: number
  distance_provider: string
  max_distance_km: number
  no_show_fee_enabled: boolean
  no_show_fee_amount: number
  no_show_wait_minutes: number
}

interface FareConfig {
  id?: string
  vehicle_type: string
  is_active: boolean
  base_fare: number
  per_km_rate: number
  minimum_fare: number
  booking_fee: number
  surge_enabled: boolean
  max_surge_multiplier: number
  effective_from: string
}

interface SimulationResult {
  base_fare: number
  per_km_rate: number
  booking_fee: number
  distance_km: number
  distance_charge: number
  subtotal: number
  surge_multiplier: number
  surged_amount: number
  minimum_fare: number
  total_fare: number
  commission_rate: number
  platform_commission: number
  driver_earnings: number
  distance_clamped: boolean
  max_distance_km: number
  config_source: string
}

const VEHICLE_TYPES = [
  { id: 'motorcycle', label: 'Motorcycle' },
  { id: 'tricycle', label: 'Tricycle' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
  { id: 'minivan', label: 'Minivan' },
]

// ── Component ────────────────────────────────────────────────────────────────
export default function EngineCalculationPage() {
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  
  // Settings State
  const [settings, setSettings] = useState<PlatformSettings>({
    commission_rate: 0.15,
    distance_provider: 'osrm',
    max_distance_km: 150.0,
    no_show_fee_enabled: true,
    no_show_fee_amount: 200,
    no_show_wait_minutes: 5,
  })

  // Config State
  const [activeTab, setActiveTab] = useState<string>('sedan')
  const [configs, setConfigs] = useState<Record<string, FareConfig>>({})
  const [currentConfig, setCurrentConfig] = useState<FareConfig | null>(null)
  
  // Simulation State
  const [simDistance, setSimDistance] = useState(12.5)
  const [simVehicle, setSimVehicle] = useState('sedan')
  const [simSurge, setSimSurge] = useState(1.0)
  const [simResult, setSimResult] = useState<SimulationResult | null>(null)
  const [simulating, setSimulating] = useState(false)

  // Initialization
  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (configs[activeTab]) {
      setCurrentConfig({ ...configs[activeTab] })
    } else {
      // Default empty config if none exists
      const now = new Date()
      // adjust to local time string for datetime-local input
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
      setCurrentConfig({
        vehicle_type: activeTab,
        is_active: true,
        base_fare: 500,
        per_km_rate: 150,
        minimum_fare: 800,
        booking_fee: 50,
        surge_enabled: true,
        max_surge_multiplier: 2.5,
        effective_from: now.toISOString().slice(0, 16),
      })
    }
  }, [activeTab, configs])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch settings
      const settingsRes = await api.get('/pricing/settings/')
      setSettings(settingsRes.data)

      // Fetch configs
      const configsRes = await api.get('/pricing/config/')
      const configMap: Record<string, FareConfig> = {}
      configsRes.data.forEach((c: FareConfig) => {
        // Just take the first one since API returns ordered by effective_from descending
        if (!configMap[c.vehicle_type]) {
          // Format date for datetime-local input
          const date = new Date(c.effective_from)
          date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
          configMap[c.vehicle_type] = {
            ...c,
            effective_from: date.toISOString().slice(0, 16)
          }
        }
      })
      setConfigs(configMap)
    } catch (err) {
      console.error('Failed to load pricing data', err)
      alert('Failed to load pricing engine data.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await api.patch('/pricing/settings/', settings)
      alert('Global settings updated successfully.')
    } catch (err) {
      console.error(err)
      alert('Failed to update settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!currentConfig) return
    setSavingConfig(true)
    try {
      // Format back to ISO
      const payload = { ...currentConfig }
      const date = new Date(payload.effective_from)
      payload.effective_from = date.toISOString()
      
      await api.post('/pricing/config/', payload)
      alert('Pricing configuration deployed successfully.')
      await fetchData() // Refresh all to get the newly created config
    } catch (err) {
      console.error(err)
      alert('Failed to save configuration.')
    } finally {
      setSavingConfig(false)
    }
  }

  const runSimulation = async () => {
    setSimulating(true)
    try {
      const res = await api.post('/pricing/estimate/', {
        vehicle_type: simVehicle,
        distance_km: simDistance,
        surge_multiplier: simSurge,
      })
      setSimResult(res.data)
    } catch (err) {
      console.error(err)
      alert('Simulation failed.')
    } finally {
      setSimulating(false)
    }
  }

  if (loading) {
    return (
      <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center', color: T.textMuted }}>
        <Activity size={32} className="animate-pulse" />
        <p style={{ marginTop: 16 }}>Loading Engine Configuration...</p>
      </div>
    )
  }

  const isConfigDirty = currentConfig && configs[activeTab] && JSON.stringify(currentConfig) !== JSON.stringify(configs[activeTab])
  const isNewConfig = !configs[activeTab]

  return (
    <>
      <style>{`
        .engine-page-grid-main {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1px;
          background: var(--theme-border);
        }
        @media (min-width: 1100px) {
          .engine-page-grid-main { grid-template-columns: 2fr 1fr; }
        }
        .engine-sim-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          padding: 18px;
        }
        @media (min-width: 900px) {
          .engine-sim-grid { grid-template-columns: 5fr 7fr; }
        }
        .engine-sim-divider {
          border-right: none;
        }
        @media (min-width: 900px) {
          .engine-sim-divider { border-right: 1px solid var(--theme-border); padding-right: 18px; }
        }
        input[type=range] { accent-color: var(--theme-accent); width: 100%; }
        select option { background: var(--theme-bgInput); color: var(--theme-textPrimary); }
      `}</style>

      <div style={s.page}>

        {/* ── KPI Row ──────────────────────────────────────────────────── */}
        <div style={s.kpiGrid}>
          {/* Active Pricing Model */}
          <div style={s.kpiCard}>
            <span style={s.kpiLabel}>Active Pricing Models</span>
            <div style={s.kpiValueRow}>
              <span style={s.kpiValue}>{Object.keys(configs).length} / {VEHICLE_TYPES.length}</span>
              <CheckCircle size={16} color="#10b981" fill="#10b981" />
            </div>
          </div>

          {/* Comm. */}
          <div style={s.kpiCard}>
            <span style={s.kpiLabel}>Platform Commission</span>
            <div style={s.kpiValueRow}>
              <span style={{ ...s.kpiValue, color: '#10b981' }}>{(settings.commission_rate * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Surge Cap */}
          <div style={s.kpiCard}>
            <span style={s.kpiLabel}>Avg. Base Fare</span>
            <div style={s.kpiValueRow}>
              <span style={{ ...s.kpiValue, color: T.purple }}>
                ₦{Object.values(configs).length ? (Object.values(configs).reduce((acc, c) => acc + Number(c.base_fare), 0) / Object.values(configs).length).toFixed(0) : '0'}
              </span>
            </div>
          </div>

          {/* Distance Source */}
          <div style={s.kpiCard}>
            <span style={s.kpiLabel}>Distance Provider</span>
            <div style={s.kpiValueRow}>
              <span style={{ ...s.kpiValue, fontSize: 16 }}>
                {settings.distance_provider === 'osrm' ? 'OSRM Routing' : settings.distance_provider === 'google' ? 'Google Maps' : 'Haversine'}
              </span>
              <span style={s.badgeGreen}>Active</span>
            </div>
          </div>
        </div>

        {/* ── Main Grid ────────────────────────────────────────────────── */}
        <div className="engine-page-grid-main">

          {/* Vehicle Class Tariffs */}
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>
                <Calculator size={16} color={T.accent} />
                Vehicle Class Tariffs
              </h2>
              <div style={s.tabGroup}>
                {VEHICLE_TYPES.map(vt => (
                  <button
                    key={vt.id}
                    style={activeTab === vt.id ? s.tabActive : s.tabInactive}
                    onClick={() => setActiveTab(vt.id)}
                  >
                    {vt.label}
                  </button>
                ))}
              </div>
            </div>

            {currentConfig && (
              <div style={s.panelBody}>
                <div style={s.fieldGroup}>
                  <div style={s.field}>
                    <label style={s.fieldLabel}>Base Fare (₦)</label>
                    <input 
                      style={s.input} type="number" 
                      value={currentConfig.base_fare} 
                      onChange={e => setCurrentConfig({ ...currentConfig, base_fare: Number(e.target.value) })}
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.fieldLabel}>Per-KM Rate (₦)</label>
                    <input 
                      style={s.input} type="number" 
                      value={currentConfig.per_km_rate}
                      onChange={e => setCurrentConfig({ ...currentConfig, per_km_rate: Number(e.target.value) })}
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.fieldLabel}>Minimum Fare (₦)</label>
                    <input 
                      style={s.input} type="number" 
                      value={currentConfig.minimum_fare}
                      onChange={e => setCurrentConfig({ ...currentConfig, minimum_fare: Number(e.target.value) })}
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.fieldLabel}>Booking Fee (₦)</label>
                    <input 
                      style={s.input} type="number" 
                      value={currentConfig.booking_fee}
                      onChange={e => setCurrentConfig({ ...currentConfig, booking_fee: Number(e.target.value) })}
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.fieldLabel}>
                      <span>Surge Cap (Multiplier)</span>
                      {currentConfig.surge_enabled && (
                        <span style={s.badgeWarning}>
                          <AlertTriangle size={10} style={{ display: 'inline', marginRight: 2 }} />
                          Enabled
                        </span>
                      )}
                    </label>
                    <input 
                      style={currentConfig.surge_enabled ? s.inputWarning : s.input} 
                      type="number" step={0.1} 
                      value={currentConfig.max_surge_multiplier}
                      onChange={e => setCurrentConfig({ ...currentConfig, max_surge_multiplier: Number(e.target.value) })}
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.fieldLabel}>Effective Date (Starts At)</label>
                    <input 
                      style={s.input} type="datetime-local" 
                      value={currentConfig.effective_from}
                      onChange={e => setCurrentConfig({ ...currentConfig, effective_from: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={currentConfig.surge_enabled}
                      onChange={e => setCurrentConfig({ ...currentConfig, surge_enabled: e.target.checked })}
                      style={{ accentColor: T.accent }}
                    />
                    <span style={{ fontSize: 13, color: T.textPrimary }}>Enable Surge Pricing Guardrails</span>
                  </label>
                </div>
              </div>
            )}

            <div style={s.panelFooter}>
              <div style={s.statusRow}>
                <span style={s.statusText}>Status:</span>
                {isNewConfig ? (
                  <span style={s.badgeMuted}>No Config - Using Default</span>
                ) : (
                  <span style={s.badgeGreen}>Active in DB</span>
                )}
                {isConfigDirty && <span style={s.badgeWarning}>Unsaved Changes</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  style={s.btnSecondary}
                  onClick={() => setCurrentConfig(configs[activeTab] ? { ...configs[activeTab] } : null)}
                  disabled={!isConfigDirty && !isNewConfig}
                >
                  <RotateCcw size={14} />
                  Revert
                </button>
                <button 
                  style={s.btnPrimary}
                  onClick={handleSaveConfig}
                  disabled={savingConfig || (!isConfigDirty && !isNewConfig)}
                >
                  {savingConfig ? <Activity size={14} className="animate-spin" /> : <Save size={14} />}
                  Deploy Config
                </button>
              </div>
            </div>
          </div>

          {/* Global Constraints */}
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>Global Constraints</h2>
              <button 
                style={{ ...s.btnPrimary, padding: '4px 12px', fontSize: 12 }}
                onClick={handleSaveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? <Activity size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
            </div>
            <div style={s.panelBody}>

              <div style={s.constraintRow}>
                <label style={s.fieldLabel}>Platform Commission (%)</label>
                <div style={s.rangeRow}>
                  <input
                    type="range" min={0} max={50} step={0.5}
                    value={settings.commission_rate * 100}
                    onChange={e => setSettings({ ...settings, commission_rate: Number(e.target.value) / 100 })}
                  />
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: T.textPrimary, minWidth: 40, textAlign: 'right' }}>
                    {(settings.commission_rate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div style={s.constraintRow}>
                <label style={s.fieldLabel}>Distance Provider</label>
                <div style={{ position: 'relative' }}>
                  <select 
                    style={s.select}
                    value={settings.distance_provider}
                    onChange={e => setSettings({ ...settings, distance_provider: e.target.value })}
                  >
                    <option value="osrm">OSRM Routing (Primary)</option>
                    <option value="google">Google Distance Matrix</option>
                    <option value="haversine">Haversine (Fallback)</option>
                  </select>
                  <ChevronDown size={12} color={T.textMuted} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>

              <div style={s.constraintRow}>
                <label style={s.fieldLabel}>Max Distance Reject Policy (KM)</label>
                <input 
                  style={s.input} type="number" 
                  value={settings.max_distance_km}
                  onChange={e => setSettings({ ...settings, max_distance_km: Number(e.target.value) })}
                />
                <span style={s.hint}>Requests exceeding this will be clamped or rejected.</span>
              </div>

              <div style={s.constraintRow}>
                <label style={s.fieldLabel}>No-Show Fee Amount (₦)</label>
                <input 
                  style={s.input} type="number" 
                  value={settings.no_show_fee_amount}
                  onChange={e => setSettings({ ...settings, no_show_fee_amount: Number(e.target.value) })}
                  disabled={!settings.no_show_fee_enabled}
                />
              </div>

              <div style={{ ...s.constraintLast, paddingBottom: 0, borderBottom: 'none' }}>
                <div>
                  <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>Enable No-Show Fee</div>
                  <div style={s.hint}>Triggers after {settings.no_show_wait_minutes} min wait</div>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, no_show_fee_enabled: !settings.no_show_fee_enabled })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: settings.no_show_fee_enabled ? '#10b981' : T.textMuted }}
                >
                  {settings.no_show_fee_enabled
                    ? <ToggleRight size={32} fill="#10b981" color="#10b981" />
                    : <ToggleLeft size={32} color={T.textMuted} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Simulation Console ───────────────────────────────────────── */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={s.panelTitle}>
              <Terminal size={16} color={T.purple} />
              Simulation Console
            </h2>
            <span style={s.liveBadge}>
              <Activity size={10} className="animate-pulse" />
              LIVE ENV: ACTIVE
            </span>
          </div>

          <div className="engine-sim-grid">
            {/* Left: Inputs */}
            <div className="engine-sim-divider" style={s.simInputCol}>
              <div style={s.field}>
                <label style={s.fieldLabel}>Estimated Distance (KM)</label>
                <input
                  style={s.input}
                  type="number"
                  step="0.1"
                  value={simDistance}
                  onChange={e => setSimDistance(Number(e.target.value))}
                />
              </div>

              <div style={s.simSelects}>
                <div style={s.field}>
                  <label style={s.fieldLabel}>Vehicle Class</label>
                  <div style={{ position: 'relative' }}>
                    <select style={s.select} value={simVehicle} onChange={e => setSimVehicle(e.target.value)}>
                      {VEHICLE_TYPES.map(vt => (
                        <option key={vt.id} value={vt.id}>{vt.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} color={T.textMuted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div style={s.field}>
                  <label style={s.fieldLabel}>Simulate Surge</label>
                  <div style={{ position: 'relative' }}>
                    <select style={s.selectWarning} value={simSurge} onChange={e => setSimSurge(Number(e.target.value))}>
                      <option value={1.0}>1.0x (Normal)</option>
                      <option value={1.5}>1.5x (Rain/Busy)</option>
                      <option value={2.0}>2.0x (Peak)</option>
                      <option value={3.0}>3.0x (Extreme)</option>
                    </select>
                    <ChevronDown size={12} color={T.error} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              <button style={s.btnRun} onClick={runSimulation} disabled={simulating}>
                {simulating ? <Activity size={14} className="animate-spin" /> : <Play size={14} />}
                Run Calculation
              </button>
            </div>

            {/* Right: Trace output */}
            <div style={s.traceBox}>
              <div style={s.traceHeader}>
                <span>CALCULATION TRACE</span>
                <span>
                  {simResult ? `SOURCE: ${simResult.config_source.toUpperCase()}` : 'WAITING FOR INPUT'}
                </span>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {simResult ? (
                  <>
                    <div style={s.traceLine}>
                      <span>Base Fare</span>
                      <span>₦ {simResult.base_fare.toLocaleString()}</span>
                    </div>
                    <div style={s.traceLine}>
                      <span>Distance ({simResult.distance_km} KM @ ₦{simResult.per_km_rate}/KM)</span>
                      <span>₦ {simResult.distance_charge.toLocaleString()}</span>
                    </div>
                    <div style={s.traceLine}>
                      <span>Booking Fee</span>
                      <span>₦ {simResult.booking_fee.toLocaleString()}</span>
                    </div>

                    <div style={s.traceSubtotal}>
                      <span>Subtotal</span>
                      <span>₦ {simResult.subtotal.toLocaleString()}</span>
                    </div>
                    {simResult.surged_amount > 0 && (
                      <div style={s.traceSurge}>
                        <span>Surge Multiplier (x{simResult.surge_multiplier})</span>
                        <span>+ ₦ {simResult.surged_amount.toLocaleString()}</span>
                      </div>
                    )}
                    {simResult.subtotal + simResult.surged_amount < simResult.minimum_fare && (
                      <div style={{ ...s.traceLine, color: T.warn, marginTop: 4 }}>
                        <span>Minimum Fare Adjustment</span>
                        <span>
                          + ₦ {(simResult.minimum_fare - (simResult.subtotal + simResult.surged_amount)).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: T.textMuted, fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                    Enter distance and vehicle type, then run calculation to see breakdown.
                  </div>
                )}
              </div>

              {simResult && (
                <>
                  <div style={s.traceFinal}>
                    <span style={s.traceFinalLabel}>Final Estimated Fare</span>
                    <span style={s.traceFinalValue}>₦ {simResult.total_fare.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: T.textMuted }}>
                    <span>Platform: ₦ {simResult.platform_commission.toLocaleString()} ({(simResult.commission_rate * 100).toFixed(1)}%)</span>
                    <span>Driver: ₦ {simResult.driver_earnings.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  )
}

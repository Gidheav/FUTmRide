import { useState, useCallback, useMemo, useEffect, type CSSProperties, type ReactNode } from 'react'
import {
  Play, Activity, Copy, RotateCcw, SlidersHorizontal, Shield,
} from 'lucide-react'
import api from '../../../core/api'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { VEHICLE_TYPES, TRIP_PRESETS, SENSITIVITY_DISTANCES } from '../constants'
import { calculateFare, configToDraft, defaultFareDraft } from '../fareCalculator'
import { CompactTrace } from '../components/FareBreakdown'
import {
  TotalsComparisonChart,
  SensitivityLineChart,
  FleetBarChart,
  ComponentSplitChart,
  DeltaInsightStrip,
} from '../components/FareCharts'
import type { FareConfig, FareDraft, PlatformSettings, SimulationResult } from '../types'

const inp: CSSProperties = {
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  color: T.textPrimary,
  padding: '8px 10px',
  fontSize: 12,
  fontFamily: 'monospace',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      color: T.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      display: 'block',
      marginBottom: 4,
    }}
    >
      {children}
    </span>
  )
}

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div style={{
      background: T.bgPanel,
      border: `1px solid ${T.border}`,
      borderTop: `2px solid ${accent}`,
      padding: '10px 12px',
      minWidth: 0,
    }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent, fontFamily: 'monospace', marginTop: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function resultParts(r: SimulationResult | null) {
  if (!r) return null
  return {
    base: r.base_fare,
    distance: r.distance_charge,
    booking: r.booking_fee,
    surge: r.surged_amount,
    minAdj: r.minimum_adjustment ?? 0,
  }
}

export function SimulationTab({
  settings,
  liveConfigs,
  scheduledConfigs,
  tariffsDraft,
  tariffsVehicle,
}: {
  settings: PlatformSettings
  liveConfigs: Record<string, FareConfig>
  scheduledConfigs: Record<string, FareConfig>
  tariffsDraft: FareDraft
  tariffsVehicle: string
}) {
  const [vehicle, setVehicle] = useState(tariffsVehicle)
  const [distance, setDistance] = useState(12.5)
  const [surge, setSurge] = useState(1)
  const [tariff, setTariff] = useState<FareDraft>(() =>
    liveConfigs[tariffsVehicle]
      ? configToDraft(liveConfigs[tariffsVehicle])
      : defaultFareDraft(tariffsVehicle),
  )

  const [liveResult, setLiveResult] = useState<SimulationResult | null>(null)
  const [whatIfResult, setWhatIfResult] = useState<SimulationResult | null>(null)
  const [running, setRunning] = useState(false)
  const [chartAnimKey, setChartAnimKey] = useState(0)
  const [activeTrace, setActiveTrace] = useState<'live' | 'whatif'>('whatif')

  const vehicleLabel = VEHICLE_TYPES.find((v) => v.id === vehicle)?.label ?? vehicle

  const loadFromLive = useCallback((vt?: string) => {
    const id = vt ?? vehicle
    const c = liveConfigs[id]
    setTariff(c ? configToDraft(c) : defaultFareDraft(id))
  }, [vehicle, liveConfigs])

  useEffect(() => {
    const c = liveConfigs[vehicle]
    setTariff(c ? configToDraft(c) : defaultFareDraft(vehicle))
  }, [vehicle, liveConfigs])

  const loadFromTariffs = useCallback(() => {
    if (vehicle === tariffsVehicle) {
      setTariff({ ...tariffsDraft })
      return
    }
    const c = liveConfigs[vehicle]
    setTariff(c ? configToDraft(c) : defaultFareDraft(vehicle))
  }, [vehicle, tariffsVehicle, tariffsDraft, liveConfigs])

  const run = useCallback(async () => {
    setRunning(true)
    try {
      const liveRes = await api.post('/pricing/estimate/', {
        vehicle_type: vehicle,
        distance_km: distance,
        surge_multiplier: surge,
      })
      setLiveResult(liveRes.data)
      setWhatIfResult(calculateFare(vehicle, distance, surge, settings, tariff, 'custom_sandbox'))
      setChartAnimKey((k) => k + 1)
    } catch {
      alert('Could not reach pricing API for live baseline.')
    } finally {
      setRunning(false)
    }
  }, [vehicle, distance, surge, settings, tariff])

  const delta = useMemo(() => {
    if (!liveResult || !whatIfResult) return null
    const d = whatIfResult.total_fare - liveResult.total_fare
    const pct = liveResult.total_fare > 0 ? (d / liveResult.total_fare) * 100 : 0
    return { amount: d, pct }
  }, [liveResult, whatIfResult])

  const sensitivity = useMemo(() => {
    return SENSITIVITY_DISTANCES.map((km) => {
      const liveCfg = liveConfigs[vehicle]
      const liveCalc = liveCfg
        ? calculateFare(vehicle, km, surge, settings, configToDraft(liveCfg), 'database')
        : null
      const whatIf = calculateFare(vehicle, km, surge, settings, tariff, 'custom_sandbox')
      return {
        km,
        live: liveCalc?.total_fare ?? null,
        whatIf: whatIf.total_fare,
        delta: liveCalc ? whatIf.total_fare - liveCalc.total_fare : null,
      }
    })
  }, [vehicle, surge, settings, tariff, liveConfigs])

  const fleetRows = useMemo(() => {
    return VEHICLE_TYPES.map((vt) => {
      const liveCfg = liveConfigs[vt.id]
      const draft = liveCfg ? configToDraft(liveCfg) : defaultFareDraft(vt.id)
      const r = calculateFare(vt.id, distance, surge, settings, draft, 'database')
      return { id: vt.id, label: vt.label, total: r.total_fare, hasLive: !!liveCfg }
    }).sort((a, b) => b.total - a.total)
  }, [distance, surge, settings, liveConfigs])

  const traceResult = activeTrace === 'live' ? liveResult : whatIfResult
  const scheduled = scheduledConfigs[vehicle]
  const hasResults = !!(liveResult && whatIfResult)

  const copySummary = () => {
    if (!liveResult || !whatIfResult) return
    navigator.clipboard.writeText([
      `LR-Ride Fare Lab`,
      `${vehicleLabel} · ${distance} km · surge ${surge}×`,
      `Live: ₦${liveResult.total_fare}`,
      `What-if: ₦${whatIfResult.total_fare}`,
      delta ? `Delta: ${delta.amount >= 0 ? '+' : ''}₦${delta.amount}` : '',
    ].filter(Boolean).join('\n'))
  }

  return (
    <>
      <style>{`
        .fare-lab-shell {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
          align-items: start;
        }
        @media (min-width: 1080px) {
          .fare-lab-shell { grid-template-columns: 268px 1fr; }
        }
        .fare-lab-sidebar {
          display: flex;
          flex-direction: column;
          gap: 0;
          align-self: start;
          position: sticky;
          top: 8px;
          max-height: calc(100vh - 96px);
          min-width: 0;
        }
        .fare-lab-sidebar-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-bottom: 4px;
        }
        .fare-lab-sidebar-footer {
          flex-shrink: 0;
          padding: 10px 0 4px;
          margin-top: 2px;
          background: ${T.bgPanel};
          border-top: 1px solid ${T.border};
          box-shadow: 0 -12px 20px rgba(0, 0, 0, 0.35);
          z-index: 2;
        }
        .fare-lab-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .fare-lab-kpi-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
        }
        @media (max-width: 900px) {
          .fare-lab-kpi-row { grid-template-columns: repeat(2, 1fr); }
        }
        .fare-lab-chart-row-2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
        }
        @media (min-width: 900px) {
          .fare-lab-chart-row-2 { grid-template-columns: 1fr 1fr; }
        }
        .fare-lab-chart-row-bottom {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
        }
        @media (min-width: 960px) {
          .fare-lab-chart-row-bottom { grid-template-columns: 1fr 1fr; }
        }
        .fare-lab-presets { display: flex; flex-wrap: wrap; gap: 4px; }
        .fare-lab-preset {
          padding: 4px 8px; font-size: 9px; font-weight: 600;
          border: 1px solid ${T.border}; background: transparent;
          color: ${T.textMuted}; cursor: pointer;
        }
        .fare-lab-preset:hover { border-color: ${T.accent}; color: ${T.textPrimary}; }
        .fare-lab-tariff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .fare-lab-chip {
          padding: 4px 8px; font-size: 9px; font-weight: 600;
          border: 1px solid ${T.border}; background: ${T.bgInput};
          color: ${T.textSecondary}; cursor: pointer;
          display: inline-flex; align-items: center; gap: 4px;
        }
        .fare-lab-chip:hover { color: ${T.accent}; border-color: ${T.accent}; }
      `}</style>

      <div className="fare-lab-shell">
        {/* Sidebar */}
        <aside className="fare-lab-sidebar">
          <div className="fare-lab-sidebar-body">
          <div style={{ ...campusPanel.card, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={12} color={T.accent} />
              <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: 'uppercase' }}>Read-only</span>
            </div>
          </div>

          <div style={campusPanel.card}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, background: T.bgCard, fontSize: 11, fontWeight: 700, color: T.textPrimary }}>
              Trip
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <Label>Presets</Label>
                <div className="fare-lab-presets">
                  {TRIP_PRESETS.map((p) => (
                    <button key={p.id} type="button" className="fare-lab-preset" onClick={() => { setDistance(p.distance); setSurge(p.surge) }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Vehicle</Label>
                <select style={{ ...inp, fontFamily: T.fontFamily }} value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                  {VEHICLE_TYPES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Distance · {distance} km</Label>
                <input type="range" min={1} max={50} step={0.5} value={distance} onChange={(e) => setDistance(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent }} />
                <input type="number" min={0.1} step={0.1} style={{ ...inp, marginTop: 4 }} value={distance} onChange={(e) => setDistance(Number(e.target.value))} />
              </div>
              <div>
                <Label>Surge</Label>
                <select style={inp} value={surge} onChange={(e) => setSurge(Number(e.target.value))}>
                  {[1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((s) => <option key={s} value={s}>{s}×</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={campusPanel.card}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, background: T.bgCard, fontSize: 11, fontWeight: 700, color: T.textPrimary }}>
              What-if tariff
            </div>
            <div style={{ padding: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                <button type="button" className="fare-lab-chip" onClick={() => loadFromLive()}><Copy size={10} /> Live</button>
                <button type="button" className="fare-lab-chip" onClick={loadFromTariffs}><SlidersHorizontal size={10} /> Tariffs</button>
                <button type="button" className="fare-lab-chip" onClick={() => setTariff(defaultFareDraft(vehicle))}><RotateCcw size={10} /> Reset</button>
              </div>
              <div className="fare-lab-tariff-grid">
                {([
                  ['base_fare', 'Base'],
                  ['per_km_rate', '/km'],
                  ['minimum_fare', 'Min'],
                  ['booking_fee', 'Book'],
                  ['max_surge_multiplier', 'Cap'],
                ] as const).map(([key, lbl]) => (
                  <div key={key}>
                    <Label>{lbl}</Label>
                    <input type="number" style={inp} value={tariff[key]} min={0} step={key === 'max_surge_multiplier' ? 0.1 : 1} onChange={(e) => setTariff({ ...tariff, [key]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 10, color: T.textPrimary, cursor: 'pointer' }}>
                <input type="checkbox" checked={tariff.surge_enabled} onChange={(e) => setTariff({ ...tariff, surge_enabled: e.target.checked })} style={{ accentColor: T.accent }} />
                Surge cap on
              </label>
            </div>
          </div>
          </div>

          <div className="fare-lab-sidebar-footer">
            <button type="button" style={{ ...campusPanel.btnPrimary, justifyContent: 'center', padding: 12, width: '100%' }} onClick={run} disabled={running}>
              {running ? <Activity size={15} /> : <Play size={15} />}
              Calculate comparison
            </button>
          </div>
        </aside>

        {/* Dashboard */}
        <main className="fare-lab-dashboard">
          {scheduled && (
            <div style={{ padding: '8px 12px', fontSize: 10, color: T.warn, background: 'rgba(245,158,11,0.08)', border: `1px solid ${T.border}` }}>
              Scheduled deploy pending — live uses production rates only until effective date.
            </div>
          )}

          <div className="fare-lab-kpi-row">
            <MetricTile
              label="Live"
              value={liveResult ? `₦${liveResult.total_fare.toLocaleString()}` : '—'}
              sub={liveResult ? `Drv ₦${liveResult.driver_earnings.toLocaleString()}` : 'Not calculated'}
              accent="#10b981"
            />
            <MetricTile
              label="What-if"
              value={whatIfResult ? `₦${whatIfResult.total_fare.toLocaleString()}` : '—'}
              sub={whatIfResult ? `Drv ₦${whatIfResult.driver_earnings.toLocaleString()}` : 'Not calculated'}
              accent={T.purple}
            />
            <MetricTile
              label="Delta"
              value={delta ? `${delta.amount >= 0 ? '+' : ''}₦${Math.abs(delta.amount).toLocaleString()}` : '—'}
              sub={delta ? `${delta.pct >= 0 ? '+' : ''}${delta.pct.toFixed(1)}% vs live` : '—'}
              accent={delta && delta.amount > 0 ? T.error : delta && delta.amount < 0 ? '#10b981' : T.textMuted}
            />
            <MetricTile
              label="Commission"
              value={whatIfResult ? `${(whatIfResult.commission_rate * 100).toFixed(1)}%` : `${(settings.commission_rate * 100).toFixed(1)}%`}
              sub={whatIfResult ? `₦${whatIfResult.platform_commission.toLocaleString()} platform` : 'From global settings'}
              accent={T.accent}
            />
          </div>

          <DeltaInsightStrip
            delta={delta}
            distance={distance}
            surge={surge}
            vehicleLabel={vehicleLabel}
            hasResults={hasResults}
          />

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '0 0 0' }}>
            <button type="button" className="fare-lab-chip" onClick={copySummary} disabled={!hasResults}>
              <Copy size={10} /> Copy report
            </button>
          </div>

          <div className="fare-lab-chart-row-2">
            <TotalsComparisonChart
              live={liveResult ? { total: liveResult.total_fare, platform: liveResult.platform_commission, driver: liveResult.driver_earnings } : null}
              whatIf={whatIfResult ? { total: whatIfResult.total_fare, platform: whatIfResult.platform_commission, driver: whatIfResult.driver_earnings } : null}
            />
            <ComponentSplitChart live={resultParts(liveResult)} whatIf={resultParts(whatIfResult)} />
          </div>

          <SensitivityLineChart rows={sensitivity} highlightKm={distance} animKey={chartAnimKey} />

          <div className="fare-lab-chart-row-bottom">
            <div style={{ ...campusPanel.card, padding: 12 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {(['live', 'whatif'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTrace(t)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      border: `1px solid ${activeTrace === t ? T.accent : T.border}`,
                      background: activeTrace === t ? T.accentBg : 'transparent',
                      color: activeTrace === t ? T.accent : T.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'live' ? 'Live detail' : 'What-if detail'}
                  </button>
                ))}
              </div>
              {traceResult ? <CompactTrace result={traceResult} /> : (
                <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Calculation breakdown appears here.</p>
              )}
            </div>

            <FleetBarChart rows={fleetRows} activeId={vehicle} onSelect={setVehicle} />
          </div>
        </main>
      </div>
    </>
  )
}

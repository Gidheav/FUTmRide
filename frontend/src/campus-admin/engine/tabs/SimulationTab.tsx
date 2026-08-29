import { useState, useCallback, useMemo, useEffect, type CSSProperties, type ReactNode } from 'react'
import {
  Play, Activity, Copy, RotateCcw, SlidersHorizontal, Shield,
  Bookmark, BookmarkCheck, TrendingUp, TrendingDown, Minus,
  Users, Zap, AlertTriangle, CheckCircle2, Info,
  BarChart3, Target, Clock, Wallet,
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

// ─── helpers ──────────────────────────────────────────────────────────────────
const ngn = (n: number) => `₦${Math.round(n).toLocaleString()}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
const r2 = (n: number) => Math.round(n * 100) / 100

// ─── shared style primitives ──────────────────────────────────────────────────
const inp: CSSProperties = {
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  color: T.textPrimary,
  padding: '7px 10px',
  fontSize: 12,
  fontFamily: 'monospace',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

const upLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: T.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  display: 'block',
  marginBottom: 4,
}

// ─── tiny atoms ───────────────────────────────────────────────────────────────
function UL({ children }: { children: ReactNode }) {
  return <span style={upLabel}>{children}</span>
}

function SecHead({ icon: Icon, title, sub }: {
  icon: React.FC<{ size: number; color?: string }>
  title: string
  sub?: string
}) {
  return (
    <div style={{
      padding: '9px 14px',
      borderBottom: `1px solid ${T.border}`,
      background: T.bgCard,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <Icon size={13} color={T.accent} />
      <span style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary }}>{title}</span>
      {sub && <span style={{ fontSize: 9, color: T.textMuted, marginLeft: 2 }}>{sub}</span>}
    </div>
  )
}

// ─── KPI Tile — grows to fit, never clips ─────────────────────────────────────
function KpiTile({ label, value, sub, accent, icon: Icon, deltaPct }: {
  label: string
  value: string
  sub?: string
  accent: string
  icon?: React.FC<{ size: number; color?: string }>
  deltaPct?: number | null
}) {
  return (
    <div style={{
      background: T.bgPanel,
      border: `1px solid ${T.border}`,
      borderTop: `2px solid ${accent}`,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.3 }}>
          {label}
        </div>
        {Icon && <Icon size={12} color={accent} />}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent, fontFamily: 'monospace', lineHeight: 1.1, wordBreak: 'break-word' }}>
        {value}
      </div>
      <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
        {deltaPct != null && (
          <span style={{ fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2, color: deltaPct > 0 ? T.error : deltaPct < 0 ? '#10b981' : T.textMuted }}>
            {deltaPct > 0 ? <TrendingUp size={9} /> : deltaPct < 0 ? <TrendingDown size={9} /> : <Minus size={9} />}
            {fmtPct(deltaPct)}
          </span>
        )}
        {sub && <span style={{ fontSize: 9, color: T.textMuted, lineHeight: 1.3, wordBreak: 'break-word' }}>{sub}</span>}
      </div>
    </div>
  )
}

// ─── Affordability gauge ──────────────────────────────────────────────────────
function AffordGauge({ fare, budget }: { fare: number; budget: number }) {
  const pctVal = budget > 0 ? Math.round(Math.min(fare / budget, 1) * 100) : 0
  const color = pctVal < 30 ? '#10b981' : pctVal < 60 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: T.textMuted }}>Fare as % of student budget</span>
        <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'monospace' }}>{pctVal}%</span>
      </div>
      <div style={{ height: 6, background: T.bgInput, borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pctVal}%`, background: color, borderRadius: 3, transition: 'width 0.4s, background 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 9, color: '#10b981' }}>Low</span>
        <span style={{ fontSize: 9, color: '#f59e0b' }}>Moderate</span>
        <span style={{ fontSize: 9, color: '#ef4444' }}>High</span>
      </div>
    </div>
  )
}

// ─── data row with label + value ─────────────────────────────────────────────
function DataRow({ label, value, note, mono }: { label: string; value: string; note?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '8px 14px', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
        {note && <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>{note}</div>}
      </div>
    </div>
  )
}

// ─── Saved scenario interface ─────────────────────────────────────────────────
interface SavedScenario {
  id: string
  name: string
  vehicle: string
  distance: number
  surge: number
  tariff: FareDraft
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
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
  const [tripsPerDay, setTripsPerDay] = useState(8)
  const [studentBudget, setStudentBudget] = useState(500)
  const [activeView, setActiveView] = useState<'compare' | 'sensitivity' | 'fleet' | 'projections' | 'trace'>('compare')

  const [tariff, setTariff] = useState<FareDraft>(() =>
    liveConfigs[tariffsVehicle] ? configToDraft(liveConfigs[tariffsVehicle]) : defaultFareDraft(tariffsVehicle),
  )
  const [liveResult, setLiveResult] = useState<SimulationResult | null>(null)
  const [running, setRunning] = useState(false)
  const [chartAnimKey, setChartAnimKey] = useState(0)
  const [activeTrace, setActiveTrace] = useState<'live' | 'whatif'>('whatif')
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([])
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)

  const vehicleLabel = VEHICLE_TYPES.find(v => v.id === vehicle)?.label ?? vehicle

  useEffect(() => {
    const c = liveConfigs[vehicle]
    setTariff(c ? configToDraft(c) : defaultFareDraft(vehicle))
  }, [vehicle, liveConfigs])

  const loadFromLive = useCallback(() => {
    const c = liveConfigs[vehicle]
    setTariff(c ? configToDraft(c) : defaultFareDraft(vehicle))
  }, [vehicle, liveConfigs])

  const loadFromTariffs = useCallback(() => {
    if (vehicle === tariffsVehicle) { setTariff({ ...tariffsDraft }); return }
    const c = liveConfigs[vehicle]
    setTariff(c ? configToDraft(c) : defaultFareDraft(vehicle))
  }, [vehicle, tariffsVehicle, tariffsDraft, liveConfigs])

  // what-if always live — no button needed
  const whatIfResult = useMemo(
    () => calculateFare(vehicle, distance, surge, settings, tariff, 'custom_sandbox'),
    [vehicle, distance, surge, settings, tariff],
  )

  const delta = useMemo(() => {
    if (!liveResult) return null
    const d = r2(whatIfResult.total_fare - liveResult.total_fare)
    const p = liveResult.total_fare > 0 ? r2((d / liveResult.total_fare) * 100) : 0
    return { amount: d, pct: p }
  }, [liveResult, whatIfResult])

  const sensitivity = useMemo(() => SENSITIVITY_DISTANCES.map(km => {
    const liveCfg = liveConfigs[vehicle]
    const liveCalc = liveCfg ? calculateFare(vehicle, km, surge, settings, configToDraft(liveCfg), 'database') : null
    const wi = calculateFare(vehicle, km, surge, settings, tariff, 'custom_sandbox')
    return { km, live: liveCalc?.total_fare ?? null, whatIf: wi.total_fare, delta: liveCalc ? wi.total_fare - liveCalc.total_fare : null }
  }), [vehicle, surge, settings, tariff, liveConfigs])

  const fleetRows = useMemo(() => VEHICLE_TYPES.map(vt => {
    const liveCfg = liveConfigs[vt.id]
    const draft = liveCfg ? configToDraft(liveCfg) : defaultFareDraft(vt.id)
    const r = calculateFare(vt.id, distance, surge, settings, draft, 'database')
    return { id: vt.id, label: vt.label, total: r.total_fare, hasLive: !!liveCfg }
  }).sort((a, b) => b.total - a.total), [distance, surge, settings, liveConfigs])

  const breakEven = useMemo(() => {
    const liveCfg = liveConfigs[vehicle]
    if (!liveCfg) return null
    const ld = configToDraft(liveCfg)
    const baseDiff = tariff.base_fare - ld.base_fare
    const perKmDiff = tariff.per_km_rate - ld.per_km_rate
    if (perKmDiff === 0) {
      return { km: null, note: baseDiff > 0 ? 'What-if always pricier' : baseDiff < 0 ? 'What-if always cheaper' : 'Identical tariffs' }
    }
    const crossKm = r2(-baseDiff / perKmDiff)
    return {
      km: crossKm > 0 ? crossKm : null,
      note: crossKm <= 0 ? (baseDiff < 0 ? 'What-if cheaper at all distances' : 'What-if pricier at all distances') : undefined,
    }
  }, [vehicle, tariff, liveConfigs])

  const projection = useMemo(() => {
    const driverCut = whatIfResult.driver_earnings
    const daily = r2(driverCut * tripsPerDay)
    const weekly = r2(daily * 6)
    const monthly = r2(weekly * 4)
    const liveDailyDelta = liveResult ? r2((driverCut - liveResult.driver_earnings) * tripsPerDay) : null
    return { driverCut, daily, weekly, monthly, liveDailyDelta }
  }, [whatIfResult, tripsPerDay, liveResult])

  const batchRows = useMemo(() => [5, 10, 15, 20, 30].map(count => ({
    count,
    whatIf: r2(whatIfResult.total_fare * count),
    live: liveResult ? r2(liveResult.total_fare * count) : null,
    driverNet: r2(whatIfResult.driver_earnings * count),
  })), [whatIfResult, liveResult])

  const run = useCallback(async () => {
    setRunning(true)
    try {
      const res = await api.post('/pricing/estimate/', { vehicle_type: vehicle, distance_km: distance, surge_multiplier: surge })
      setLiveResult(res.data)
      setChartAnimKey(k => k + 1)
    } catch {
      alert('Could not reach pricing API for live baseline.')
    } finally { setRunning(false) }
  }, [vehicle, distance, surge])

  const saveScenario = () => {
    if (!saveName.trim() || savedScenarios.length >= 4) return
    setSavedScenarios(p => [...p, { id: Date.now().toString(), name: saveName.trim(), vehicle, distance, surge, tariff: { ...tariff } }])
    setSaveName('')
    setShowSave(false)
  }

  const copySummary = () => {
    navigator.clipboard.writeText([
      'LR-Ride Fare Simulation',
      `${vehicleLabel} · ${distance} km · surge ${surge}×`,
      liveResult ? `Live: ${ngn(liveResult.total_fare)} (driver ${ngn(liveResult.driver_earnings)})` : 'Live: not fetched',
      `What-if: ${ngn(whatIfResult.total_fare)} (driver ${ngn(whatIfResult.driver_earnings)})`,
      delta ? `Delta: ${delta.amount >= 0 ? '+' : ''}${ngn(delta.amount)} (${fmtPct(delta.pct)})` : '',
      `Driver est: ${ngn(projection.daily)}/day · ${ngn(projection.monthly)}/month`,
    ].filter(Boolean).join('\n'))
  }

  const hasLive = !!liveResult
  const scheduled = scheduledConfigs[vehicle]
  const traceResult = activeTrace === 'live' ? liveResult : whatIfResult
  const liveCfgForVehicle = liveConfigs[vehicle]

  /* ── Shared button base styles ────────────────────────────────────────────── */
  const chipBtn: CSSProperties = {
    padding: '4px 8px', fontSize: 9, fontWeight: 600,
    border: `1px solid ${T.border}`, background: T.bgInput,
    color: T.textSecondary, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4,
    whiteSpace: 'nowrap',
  }

  const viewTab = (key: typeof activeView): CSSProperties => ({
    padding: '7px 14px', fontSize: 10, fontWeight: 600,
    border: `1px solid ${activeView === key ? T.accent : T.border}`,
    background: activeView === key ? T.accentBg : 'transparent',
    color: activeView === key ? T.accent : T.textMuted,
    cursor: 'pointer', whiteSpace: 'nowrap',
  })

  return (
    <>
      {/* ── GLOBAL STYLES for this page ────────────────────────────────────── */}
      <style>{`
        .sim-wrap {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr) 260px;
          gap: 2px;
          align-items: stretch;
          height: 100%;
        }
        @media (max-width: 1280px) {
          .sim-wrap { grid-template-columns: 260px minmax(0, 1fr); }
        }
        @media (max-width: 900px) {
          .sim-wrap { grid-template-columns: 1fr; }
        }
        .sim-sidebar {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sim-right-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sim-main {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-height: 0;
        }
        .sim-kpi4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
        }
        @media (max-width: 840px) {
          .sim-kpi4 { grid-template-columns: repeat(2, 1fr); }
        }
        .sim-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
        }
        .sim-3col {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 2px;
        }
        @media (max-width: 840px) {
          .sim-2col { grid-template-columns: 1fr; }
          .sim-3col { grid-template-columns: 1fr; }
        }
        .sim-view-tabs {
          display: flex;
          gap: 2px;
          flex-wrap: wrap;
        }
        .sim-preset-row { display: flex; flex-wrap: wrap; gap: 4px; }
        .sim-preset {
          padding: 4px 8px; font-size: 9px; font-weight: 600;
          border: 1px solid ${T.border}; background: transparent;
          color: ${T.textMuted}; cursor: pointer;
        }
        .sim-preset:hover { border-color: ${T.accent}; color: ${T.textPrimary}; }
        .sim-chip {
          padding: 4px 8px; font-size: 9px; font-weight: 600;
          border: 1px solid ${T.border}; background: ${T.bgInput};
          color: ${T.textSecondary}; cursor: pointer;
          display: inline-flex; align-items: center; gap: 4px;
        }
        .sim-chip:hover { color: ${T.accent}; border-color: ${T.accent}; }
        .sim-tariff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .sim-batch-row {
          display: grid;
          grid-template-columns: 56px 1fr 1fr 1fr;
          gap: 0;
          border-bottom: 1px solid ${T.border};
        }
        .sim-batch-cell { padding: 7px 12px; font-size: 11px; }
      `}</style>

      <div className="sim-wrap">

        {/* ═══════════════════════════════════════════════════════════════════
            SIDEBAR — stacks top-to-bottom
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="sim-sidebar">
          {/* Trip parameters */}
          <div style={{ ...campusPanel.card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <SecHead icon={Target} title="Trip Parameters" />
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>

              <div>
                <UL>Quick presets</UL>
                <div className="sim-preset-row">
                  {TRIP_PRESETS.map(p => (
                    <button key={p.id} type="button" className="sim-preset"
                      onClick={() => { setDistance(p.distance); setSurge(p.surge) }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <UL>Vehicle class</UL>
                <select style={{ ...inp, fontFamily: T.fontFamily }} value={vehicle} onChange={e => setVehicle(e.target.value)}>
                  {VEHICLE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <UL>Distance</UL>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, fontFamily: 'monospace' }}>{distance} km</span>
                </div>
                <input type="range" min={0.5} max={50} step={0.5} value={distance}
                  onChange={e => setDistance(Number(e.target.value))}
                  style={{ width: '100%', accentColor: T.accent }} />
                <input type="number" min={0.5} step={0.5} style={{ ...inp, marginTop: 4 }} value={distance}
                  onChange={e => setDistance(Number(e.target.value))} />
              </div>

              <div>
                <UL>Surge multiplier</UL>
                <select style={inp} value={surge} onChange={e => setSurge(Number(e.target.value))}>
                  {[1, 1.25, 1.5, 1.75, 2, 2.5, 3].map(s => <option key={s} value={s}>{s}×</option>)}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <UL>Trips per day (projections)</UL>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>{tripsPerDay}</span>
                </div>
                <input type="range" min={1} max={25} step={1} value={tripsPerDay}
                  onChange={e => setTripsPerDay(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#f59e0b' }} />
              </div>

              <div>
                <UL>Student daily budget (₦)</UL>
                <input type="number" min={100} step={50} style={inp} value={studentBudget}
                  onChange={e => setStudentBudget(Number(e.target.value))} />
              </div>
            </div>
          </div>


        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN DASHBOARD — flex column, everything stacks cleanly
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="sim-main">

          {/* Scheduled tariff warning */}
          {scheduled && (
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: T.warn, background: 'rgba(245,158,11,0.08)', border: `1px solid ${T.border}` }}>
              <AlertTriangle size={12} color={T.warn} />
              Scheduled deploy pending for {vehicleLabel} — live baseline uses production rates only.
            </div>
          )}

          {/* ── KPI row ──────────────────────────────────────────────────── */}
          <div className="sim-kpi4">
            <KpiTile
              label="Live fare"
              value={hasLive ? ngn(liveResult!.total_fare) : '—'}
              sub={hasLive ? `Driver ${ngn(liveResult!.driver_earnings)}` : 'Fetch to compare'}
              accent="#10b981"
              icon={CheckCircle2}
            />
            <KpiTile
              label="What-if fare"
              value={ngn(whatIfResult.total_fare)}
              sub={`Driver ${ngn(whatIfResult.driver_earnings)}`}
              accent={T.purple}
              icon={Zap}
              deltaPct={delta?.pct ?? null}
            />
            <KpiTile
              label="Fare delta"
              value={delta ? `${delta.amount >= 0 ? '+' : ''}${ngn(delta.amount)}` : '—'}
              sub={delta ? `${fmtPct(delta.pct)} vs live` : 'No baseline yet'}
              accent={delta && delta.amount > 0 ? T.error : delta && delta.amount < 0 ? '#10b981' : T.textMuted}
              icon={delta && delta.amount > 0 ? TrendingUp : TrendingDown}
            />
            <KpiTile
              label="Platform commission"
              value={`${(whatIfResult.commission_rate * 100).toFixed(1)}%`}
              sub={`${ngn(whatIfResult.platform_commission)} per trip`}
              accent={T.accent}
              icon={Wallet}
            />
          </div>

          {/* ── Delta insight strip ──────────────────────────────────────── */}
          <DeltaInsightStrip
            delta={delta}
            distance={distance}
            surge={surge}
            vehicleLabel={vehicleLabel}
            hasResults={hasLive}
          />

          {/* ── Affordability + Break-even + Scenarios ───────────────────── */}
          <div className="sim-3col">
            {/* Affordability */}
            <div style={campusPanel.card}>
              <SecHead icon={Users} title="Student Affordability" sub={`budget ${ngn(studentBudget)}`} />
              <AffordGauge fare={whatIfResult.total_fare} budget={studentBudget} />
              <div style={{ padding: '0 14px 12px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={upLabel}>What-if fare</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.purple, fontFamily: 'monospace' }}>{ngn(whatIfResult.total_fare)}</div>
                </div>
                {hasLive && (
                  <div>
                    <div style={upLabel}>Live fare</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>{ngn(liveResult!.total_fare)}</div>
                  </div>
                )}
                <div>
                  <div style={upLabel}>Trips in budget</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.accent, fontFamily: 'monospace' }}>
                    {whatIfResult.total_fare > 0 ? Math.floor(studentBudget / whatIfResult.total_fare) : '∞'}
                  </div>
                </div>
              </div>
            </div>

            {/* Break-even */}
            <div style={campusPanel.card}>
              <SecHead icon={Target} title="Break-Even Distance" />
              {breakEven ? (
                <>
                  <DataRow label="Crossover at" value={breakEven.km != null ? `${breakEven.km} km` : '—'} note={breakEven.note} mono />
                  <DataRow label="Your test distance" value={`${distance} km`}
                    note={breakEven.km != null
                      ? (distance >= breakEven.km ? 'What-if is more expensive here' : 'What-if is cheaper here')
                      : undefined} mono />
                  <DataRow
                    label="Base diff"
                    value={`${tariff.base_fare - Number(liveCfgForVehicle?.base_fare ?? 0) >= 0 ? '+' : ''}${ngn(tariff.base_fare - Number(liveCfgForVehicle?.base_fare ?? 0))}`}
                    mono
                  />
                  <DataRow
                    label="/km diff"
                    value={`${tariff.per_km_rate - Number(liveCfgForVehicle?.per_km_rate ?? 0) >= 0 ? '+' : ''}${ngn(tariff.per_km_rate - Number(liveCfgForVehicle?.per_km_rate ?? 0))}`}
                    mono
                  />
                </>
              ) : (
                <p style={{ padding: 14, fontSize: 10, color: T.textMuted, margin: 0 }}>
                  No live tariff for {vehicleLabel} to compare against.
                </p>
              )}
            </div>

            {/* Scenarios & Fetch */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
              {/* Saved scenarios */}
              <div style={{ ...campusPanel.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <SecHead icon={Bookmark} title="Saved Scenarios" sub={`${savedScenarios.length}/4`} />
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
                  {savedScenarios.length === 0 && (
                    <p style={{ fontSize: 10, color: T.textMuted, margin: 0, fontStyle: 'italic' }}>No scenarios saved yet.</p>
                  )}
                  {savedScenarios.map(s => {
                    const r = calculateFare(s.vehicle, s.distance, s.surge, settings, s.tariff, 'custom_sandbox')
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                        <BookmarkCheck size={10} color={T.accent} style={{ flexShrink: 0 }} />
                        <button style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: T.textPrimary, fontSize: 10, fontWeight: 600, padding: 0 }}
                          onClick={() => { setVehicle(s.vehicle); setDistance(s.distance); setSurge(s.surge); setTariff(s.tariff) }}>
                          {s.name}
                        </button>
                        <span style={{ fontSize: 9, color: T.textMuted, fontFamily: 'monospace', flexShrink: 0 }}>{ngn(r.total_fare)}</span>
                        <button onClick={() => setSavedScenarios(p => p.filter(x => x.id !== s.id))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: '0 2px', fontSize: 12, lineHeight: 1 }}>×</button>
                      </div>
                    )
                  })}
                  {savedScenarios.length < 4 && !showSave && (
                    <button className="sim-chip" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowSave(true)}>
                      <Bookmark size={10} /> Save current scenario
                    </button>
                  )}
                  {showSave && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input autoFocus placeholder="Scenario name…" style={{ ...inp, flex: 1, fontSize: 10 }} value={saveName}
                        onChange={e => setSaveName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveScenario(); if (e.key === 'Escape') setShowSave(false) }} />
                      <button className="sim-chip" onClick={saveScenario}>Save</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Fetch buttons */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button"
                  style={{ ...campusPanel.btnPrimary, flex: 1, justifyContent: 'center', padding: '10px 12px' }}
                  onClick={run} disabled={running}>
                  {running ? <Activity size={14} /> : <Play size={14} />}
                  {running ? 'Fetching…' : 'Fetch live baseline'}
                </button>
                <button type="button"
                  style={{ ...campusPanel.btnSecondary, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={copySummary} title="Copy report">
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* ── View tabs ───────────────────────────────────────────────── */}
          <div className="sim-view-tabs">
            {([
              ['compare',     'Fare Comparison',    BarChart3 ],
              ['sensitivity', 'Sensitivity Curve',  TrendingUp],
              ['fleet',       'Fleet at a Glance',  Users     ],
              ['projections', 'Driver Projections', Clock     ],
              ['trace',       'Calc Breakdown',     Info      ],
            ] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" style={viewTab(key)} onClick={() => setActiveView(key)}>
                <Icon size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: '-1px' }} />
                {label}
              </button>
            ))}
          </div>

          {/* ── View: Fare Comparison ────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {activeView === 'compare' && (
              <div className="sim-2col" style={{ flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, '& > div': { flex: 1, display: 'flex', flexDirection: 'column' } } as any}>
                  <TotalsComparisonChart
                    live={liveResult ? { total: liveResult.total_fare, platform: liveResult.platform_commission, driver: liveResult.driver_earnings } : null}
                    whatIf={{ total: whatIfResult.total_fare, platform: whatIfResult.platform_commission, driver: whatIfResult.driver_earnings }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, '& > div': { flex: 1, display: 'flex', flexDirection: 'column' } } as any}>
                  <ComponentSplitChart
                    live={liveResult ? { base: liveResult.base_fare, distance: liveResult.distance_charge, booking: liveResult.booking_fee, surge: liveResult.surged_amount, minAdj: liveResult.minimum_adjustment ?? 0 } : null}
                    whatIf={{ base: whatIfResult.base_fare, distance: whatIfResult.distance_charge, booking: whatIfResult.booking_fee, surge: whatIfResult.surged_amount, minAdj: whatIfResult.minimum_adjustment ?? 0 }}
                  />
                </div>
              </div>
            )}

            {/* ── View: Sensitivity ────────────────────────────────────────── */}
            {activeView === 'sensitivity' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, '& > div': { flex: 1, display: 'flex', flexDirection: 'column' } } as any}>
                <SensitivityLineChart rows={sensitivity} highlightKm={distance} animKey={chartAnimKey} />
              </div>
            )}

            {/* ── View: Fleet ──────────────────────────────────────────────── */}
            {activeView === 'fleet' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
                <FleetBarChart rows={fleetRows} activeId={vehicle} onSelect={setVehicle} />
              </div>
            )}

            {/* ── View: Driver Projections ──────────────────────────────────── */}
            {activeView === 'projections' && (
              <div className="sim-2col" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {/* Earnings projection */}
                <div style={{ ...campusPanel.card, display: 'flex', flexDirection: 'column' }}>
                <SecHead icon={Clock} title="Driver Earnings Projection" sub={`${tripsPerDay} trips/day`} />
                <DataRow label="Per trip (driver net)" value={ngn(projection.driverCut)} mono />
                <DataRow
                  label="Daily"
                  value={ngn(projection.daily)}
                  note={projection.liveDailyDelta != null ? `${projection.liveDailyDelta >= 0 ? '+' : ''}${ngn(projection.liveDailyDelta)} vs live` : undefined}
                  mono
                />
                <DataRow label="Weekly (6 days)" value={ngn(projection.weekly)} mono />
                <DataRow label="Monthly (~24 days)" value={ngn(projection.monthly)} mono />
                <div style={{ padding: '10px 14px' }}>
                  <UL>Adjust trips / day</UL>
                  <input type="range" min={1} max={25} step={1} value={tripsPerDay}
                    onChange={e => setTripsPerDay(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#f59e0b' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 9, color: T.textMuted }}>1</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b' }}>{tripsPerDay} trips</span>
                    <span style={{ fontSize: 9, color: T.textMuted }}>25</span>
                  </div>
                </div>
              </div>

              {/* Batch trip estimator */}
              <div style={campusPanel.card}>
                <SecHead icon={Wallet} title="Batch Trip Estimator" sub="multi-ride totals" />
                {/* Table header */}
                <div className="sim-batch-row" style={{ background: T.bgCard }}>
                  {['Trips', 'What-if', hasLive ? 'Live' : '(no live)', 'Driver net'].map(h => (
                    <div key={h} className="sim-batch-cell" style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</div>
                  ))}
                </div>
                {batchRows.map(row => (
                  <div key={row.count} className="sim-batch-row" style={{ background: row.count === tripsPerDay ? T.accentBg : undefined }}>
                    <div className="sim-batch-cell" style={{ fontWeight: 700, fontFamily: 'monospace', color: row.count === tripsPerDay ? T.accent : T.textMuted }}>{row.count}×</div>
                    <div className="sim-batch-cell" style={{ color: T.purple, fontWeight: 600, fontFamily: 'monospace' }}>{ngn(row.whatIf)}</div>
                    <div className="sim-batch-cell" style={{ color: '#10b981', fontWeight: 600, fontFamily: 'monospace' }}>{row.live ? ngn(row.live) : '—'}</div>
                    <div className="sim-batch-cell" style={{ color: T.accent, fontWeight: 600, fontFamily: 'monospace' }}>{ngn(row.driverNet)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── View: Calc Breakdown ─────────────────────────────────────── */}
          {activeView === 'trace' && (
            <div style={campusPanel.card}>
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(['live', 'whatif'] as const).map(t => (
                  <button key={t} type="button"
                    style={{
                      padding: '5px 12px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      border: `1px solid ${activeTrace === t ? T.accent : T.border}`,
                      background: activeTrace === t ? T.accentBg : 'transparent',
                      color: activeTrace === t ? T.accent : T.textMuted, cursor: 'pointer',
                    }}
                    onClick={() => setActiveTrace(t)}>
                    {t === 'live' ? 'Live detail' : 'What-if detail'}
                  </button>
                ))}
                {!hasLive && activeTrace === 'live' && (
                  <span style={{ fontSize: 10, color: T.warn, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={10} color={T.warn} /> Fetch live baseline first
                  </span>
                )}
              </div>
              <div style={{ padding: 14 }}>
                {traceResult
                  ? <CompactTrace result={traceResult} />
                  : <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Click "Fetch live baseline" to see live calculation trace.</p>
                }
              </div>
            </div>
          )}

          {/* ── Saved Scenarios comparison table ─────────────────────────── */}
          {savedScenarios.length > 0 && (
            <div style={campusPanel.card}>
              <SecHead icon={BookmarkCheck} title="Scenario Comparison" sub={`${savedScenarios.length} saved`} />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 500 }}>
                  <thead>
                    <tr style={{ background: T.bgCard, borderBottom: `1px solid ${T.border}` }}>
                      {['Scenario', 'Vehicle', 'Dist', 'Surge', 'Total fare', 'Driver cut', 'Commission'].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {savedScenarios.map((s, i) => {
                      const r = calculateFare(s.vehicle, s.distance, s.surge, settings, s.tariff, 'custom_sandbox')
                      return (
                        <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? T.bgPanel : T.bgInput }}>
                          <td style={{ padding: '7px 12px', color: T.accent, fontWeight: 600 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <BookmarkCheck size={10} /> {s.name}
                            </span>
                          </td>
                          <td style={{ padding: '7px 12px', color: T.textMuted }}>{VEHICLE_TYPES.find(v => v.id === s.vehicle)?.label}</td>
                          <td style={{ padding: '7px 12px', color: T.textPrimary, fontFamily: 'monospace' }}>{s.distance} km</td>
                          <td style={{ padding: '7px 12px', color: T.textPrimary, fontFamily: 'monospace' }}>{s.surge}×</td>
                          <td style={{ padding: '7px 12px', color: T.purple, fontWeight: 700, fontFamily: 'monospace' }}>{ngn(r.total_fare)}</td>
                          <td style={{ padding: '7px 12px', color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>{ngn(r.driver_earnings)}</td>
                          <td style={{ padding: '7px 12px', color: T.accent, fontFamily: 'monospace' }}>{ngn(r.platform_commission)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT COLUMN — What-If Tariff, Scenarios, Actions
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="sim-right-col">
          {/* What-if tariff editor */}
          <div style={{ ...campusPanel.card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <SecHead icon={SlidersHorizontal} title="What-If Tariff" sub="auto-recalculates" />
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button type="button" className="sim-chip" onClick={loadFromLive}><Copy size={10} /> From live</button>
                <button type="button" className="sim-chip" onClick={loadFromTariffs}><SlidersHorizontal size={10} /> From tariffs</button>
                <button type="button" className="sim-chip" onClick={() => setTariff(defaultFareDraft(vehicle))}><RotateCcw size={10} /> Reset</button>
              </div>
              <div className="sim-tariff-grid">
                {([
                  ['base_fare', 'Base (₦)'],
                  ['per_km_rate', '/km (₦)'],
                  ['minimum_fare', 'Min (₦)'],
                  ['booking_fee', 'Booking (₦)'],
                  ['max_surge_multiplier', 'Surge cap'],
                ] as const).map(([key, lbl]) => (
                  <div key={key}>
                    <UL>{lbl}</UL>
                    <input type="number" style={inp} value={tariff[key]} min={0}
                      step={key === 'max_surge_multiplier' ? 0.1 : 10}
                      onChange={e => setTariff({ ...tariff, [key]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: T.textPrimary, cursor: 'pointer', marginTop: 2 }}>
                <input type="checkbox" checked={tariff.surge_enabled}
                  onChange={e => setTariff({ ...tariff, surge_enabled: e.target.checked })}
                  style={{ accentColor: T.accent }} />
                Surge enabled
              </label>
            </div>
          </div>
        </div>
        {/* end .sim-right-col */}
      </div>
      {/* end .sim-wrap */}
    </>
  )
}

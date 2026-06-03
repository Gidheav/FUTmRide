import { useState, useCallback, useMemo, useEffect, type CSSProperties } from 'react'
import {
  Play, Activity, Copy, RotateCcw, SlidersHorizontal, Grid3X3,
  TrendingUp, TrendingDown, Minus, Shield,
} from 'lucide-react'
import api from '../../../core/api'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { VEHICLE_TYPES, TRIP_PRESETS, SENSITIVITY_DISTANCES } from '../constants'
import { calculateFare, configToDraft, defaultFareDraft } from '../fareCalculator'
import { FareHero, FareWaterfall, CompactTrace } from '../components/FareBreakdown'
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

function Label({ children }: { children: React.ReactNode }) {
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
  const [showFleet, setShowFleet] = useState(false)
  const [activeTrace, setActiveTrace] = useState<'live' | 'whatif'>('whatif')

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
      const [liveRes] = await Promise.all([
        api.post('/pricing/estimate/', {
          vehicle_type: vehicle,
          distance_km: distance,
          surge_multiplier: surge,
        }),
      ])
      setLiveResult(liveRes.data)
      setWhatIfResult(calculateFare(vehicle, distance, surge, settings, tariff, 'custom_sandbox'))
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
    if (!showFleet) return []
    return VEHICLE_TYPES.map((vt) => {
      const live = liveConfigs[vt.id]
      const draft = live ? configToDraft(live) : defaultFareDraft(vt.id)
      const r = calculateFare(vt.id, distance, surge, settings, draft, 'database')
      return { id: vt.id, label: vt.label, total: r.total_fare, hasLive: !!live }
    }).sort((a, b) => b.total - a.total)
  }, [showFleet, distance, surge, settings, liveConfigs])

  const traceResult = activeTrace === 'live' ? liveResult : whatIfResult
  const scheduled = scheduledConfigs[vehicle]

  const copySummary = () => {
    if (!liveResult || !whatIfResult) return
    const text = [
      `LR-Ride Fare Lab`,
      `Vehicle: ${vehicle} · ${distance} km · surge ${surge}×`,
      `Live: ₦${liveResult.total_fare}`,
      `What-if: ₦${whatIfResult.total_fare}`,
      delta ? `Delta: ${delta.amount >= 0 ? '+' : ''}₦${delta.amount}` : '',
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <>
      <style>{`
        .fare-lab {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
          min-height: 480px;
        }
        @media (min-width: 1100px) {
          .fare-lab { grid-template-columns: minmax(300px, 340px) 1fr; }
        }
        .fare-lab-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .fare-lab-preset {
          padding: 5px 10px;
          font-size: 10px;
          font-weight: 600;
          border: 1px solid var(--theme-border, #1e293b);
          background: transparent;
          color: var(--theme-textSecondary, #94a3b8);
          cursor: pointer;
        }
        .fare-lab-preset:hover { border-color: var(--theme-accent, #a855f7); color: var(--theme-textPrimary, #e2e8f0); }
        .fare-lab-tariff-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .fare-lab-chip {
          padding: 5px 10px;
          font-size: 10px;
          font-weight: 600;
          border: 1px solid var(--theme-border, #1e293b);
          background: var(--theme-bgInput, #0f1525);
          color: var(--theme-textSecondary, #94a3b8);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .fare-lab-chip:hover { color: var(--theme-accent, #a855f7); border-color: var(--theme-accent, #a855f7); }
        .fare-lab-heroes { display: flex; flex-wrap: wrap; gap: 2px; }
        .fare-lab-results-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
        }
        @media (min-width: 900px) {
          .fare-lab-results-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="fare-lab">
        {/* ── Left: controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ ...campusPanel.card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Shield size={14} color={T.accent} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Read-only lab
              </span>
            </div>
            <p style={{ fontSize: 11, color: T.textSecondary, margin: 0, lineHeight: 1.5 }}>
              Compare production fares against custom tariff inputs. Nothing on this page writes to the database.
            </p>
          </div>

          <div style={campusPanel.card}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, background: T.bgCard }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>Trip</span>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Label>Quick presets</Label>
                <div className="fare-lab-presets">
                  {TRIP_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="fare-lab-preset"
                      onClick={() => { setDistance(p.distance); setSurge(p.surge) }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Vehicle</Label>
                <select style={{ ...inp, fontFamily: T.fontFamily }} value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Distance — {distance} km</Label>
                <input
                  type="range"
                  min={1}
                  max={50}
                  step={0.5}
                  value={distance}
                  onChange={(e) => setDistance(Number(e.target.value))}
                  style={{ width: '100%', accentColor: T.accent }}
                />
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  style={{ ...inp, marginTop: 6 }}
                  value={distance}
                  onChange={(e) => setDistance(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Surge multiplier</Label>
                <select style={inp} value={surge} onChange={(e) => setSurge(Number(e.target.value))}>
                  {[1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((s) => (
                    <option key={s} value={s}>{s}×</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={campusPanel.card}>
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${T.border}`,
              background: T.bgCard,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>What-if tariff</span>
              <span style={{ fontSize: 9, color: T.textMuted }}>editable</span>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                <button type="button" className="fare-lab-chip" onClick={loadFromLive}>
                  <Copy size={11} /> Live rates
                </button>
                <button type="button" className="fare-lab-chip" onClick={loadFromTariffs}>
                  <SlidersHorizontal size={11} /> Tariffs tab
                </button>
                <button type="button" className="fare-lab-chip" onClick={() => setTariff(defaultFareDraft(vehicle))}>
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
              <div className="fare-lab-tariff-grid">
                {([
                  ['base_fare', 'Base ₦'],
                  ['per_km_rate', 'Per km ₦'],
                  ['minimum_fare', 'Minimum ₦'],
                  ['booking_fee', 'Booking ₦'],
                  ['max_surge_multiplier', 'Max surge'],
                ] as const).map(([key, lbl]) => (
                  <div key={key}>
                    <Label>{lbl}</Label>
                    <input
                      type="number"
                      style={inp}
                      value={tariff[key]}
                      min={0}
                      step={key === 'max_surge_multiplier' ? 0.1 : 1}
                      onChange={(e) => setTariff({ ...tariff, [key]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11, color: T.textPrimary, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={tariff.surge_enabled}
                  onChange={(e) => setTariff({ ...tariff, surge_enabled: e.target.checked })}
                  style={{ accentColor: T.accent }}
                />
                Surge guardrails enabled
              </label>
            </div>
          </div>

          <button
            type="button"
            style={{ ...campusPanel.btnPrimary, justifyContent: 'center', padding: '12px 16px', width: '100%' }}
            onClick={run}
            disabled={running}
          >
            {running ? <Activity size={16} /> : <Play size={16} />}
            Calculate comparison
          </button>
        </div>

        {/* ── Right: results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {scheduled && (
            <div style={{
              padding: '8px 12px',
              fontSize: 11,
              color: T.warn,
              background: 'rgba(245,158,11,0.08)',
              border: `1px solid ${T.border}`,
            }}
            >
              Scheduled tariff deploy pending for this vehicle — live column reflects today&apos;s production rates only.
            </div>
          )}

          <div className="fare-lab-heroes">
            <FareHero
              label="Live production"
              sublabel="API · ride booking"
              result={liveResult}
              accent="#10b981"
            />
            <FareHero
              label="What-if"
              sublabel="your inputs · no save"
              result={whatIfResult}
              accent={T.purple}
            />
            {delta && (
              <div style={{
                minWidth: 120,
                padding: '14px 16px',
                background: T.bgPanel,
                border: `1px solid ${T.border}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
              >
                <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase' }}>Delta</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: delta.amount > 0 ? T.error : delta.amount < 0 ? '#10b981' : T.textMuted,
                }}
                >
                  {delta.amount > 0 ? <TrendingUp size={18} /> : delta.amount < 0 ? <TrendingDown size={18} /> : <Minus size={18} />}
                  {delta.amount >= 0 ? '+' : ''}₦{Math.abs(delta.amount).toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
                  {delta.pct >= 0 ? '+' : ''}{delta.pct.toFixed(1)}% vs live
                </div>
              </div>
            )}
          </div>

          {(liveResult || whatIfResult) && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button type="button" className="fare-lab-chip" onClick={copySummary} disabled={!liveResult || !whatIfResult}>
                <Copy size={11} /> Copy summary
              </button>
              <button
                type="button"
                className="fare-lab-chip"
                onClick={() => setShowFleet((f) => !f)}
              >
                <Grid3X3 size={11} /> {showFleet ? 'Hide' : 'Show'} fleet matrix
              </button>
            </div>
          )}

          <div className="fare-lab-results-grid">
            <div style={{ ...campusPanel.card, padding: 16 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {(['live', 'whatif'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTrace(t)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      border: `1px solid ${activeTrace === t ? T.accent : T.border}`,
                      background: activeTrace === t ? T.accentBg : 'transparent',
                      color: activeTrace === t ? T.accent : T.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'live' ? 'Live breakdown' : 'What-if breakdown'}
                  </button>
                ))}
              </div>
              {traceResult ? (
                <>
                  <FareWaterfall result={traceResult} />
                  <div style={{ marginTop: 14 }}>
                    <CompactTrace result={traceResult} />
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic', margin: 0 }}>
                  Run calculation to see fare composition.
                </p>
              )}
            </div>

            <div style={{ ...campusPanel.card, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginBottom: 10 }}>
                Distance sensitivity
              </div>
              <p style={{ fontSize: 10, color: T.textMuted, margin: '0 0 10px', lineHeight: 1.45 }}>
                Total fare at common distances using current what-if tariff vs live config.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace' }}>
                <thead>
                  <tr style={{ color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ padding: '6px 8px', fontWeight: 700, fontSize: 9 }}>KM</th>
                    <th style={{ padding: '6px 8px', fontWeight: 700, fontSize: 9 }}>LIVE</th>
                    <th style={{ padding: '6px 8px', fontWeight: 700, fontSize: 9 }}>WHAT-IF</th>
                    <th style={{ padding: '6px 8px', fontWeight: 700, fontSize: 9 }}>Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.map((row) => (
                    <tr
                      key={row.km}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        background: row.km === distance ? 'rgba(168,85,247,0.08)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '6px 8px', color: T.textPrimary }}>{row.km}</td>
                      <td style={{ padding: '6px 8px', color: T.textSecondary }}>
                        {row.live != null ? `₦${row.live.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', color: T.purple }}>₦{row.whatIf.toLocaleString()}</td>
                      <td style={{
                        padding: '6px 8px',
                        color: row.delta == null ? T.textMuted : row.delta > 0 ? T.error : row.delta < 0 ? '#10b981' : T.textMuted,
                      }}
                      >
                        {row.delta == null ? '—' : `${row.delta >= 0 ? '+' : ''}₦${row.delta.toLocaleString()}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showFleet && (
            <div style={{ ...campusPanel.card, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginBottom: 8 }}>
                Fleet matrix · {distance} km · {surge}× surge
              </div>
              <p style={{ fontSize: 10, color: T.textMuted, margin: '0 0 12px' }}>
                Live tariff per vehicle class (client-side, same rules as production).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 2 }}>
                {fleetRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setVehicle(row.id)}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      border: `1px solid ${vehicle === row.id ? T.accent : T.border}`,
                      background: vehicle === row.id ? T.accentBg : T.bgInput,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textPrimary }}>{row.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#10b981', marginTop: 4 }}>
                      ₦{row.total.toLocaleString()}
                    </div>
                    {!row.hasLive && (
                      <div style={{ fontSize: 9, color: T.warn, marginTop: 2 }}>legacy default</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

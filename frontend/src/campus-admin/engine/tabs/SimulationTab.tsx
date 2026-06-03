import { Play, Activity, Terminal, AlertTriangle } from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { VEHICLE_TYPES } from '../constants'
import { TracePanel } from '../components/TracePanel'
import type { FareConfig, SimulationResult } from '../types'

export function SimulationTab({
  simDistance,
  setSimDistance,
  simVehicle,
  setSimVehicle,
  simSurge,
  setSimSurge,
  simMode,
  setSimMode,
  simResult,
  liveResult,
  draftResult,
  simMismatch,
  isDraftDirty,
  simulating,
  onRun,
  scheduledConfig,
}: {
  simDistance: number
  setSimDistance: (n: number) => void
  simVehicle: string
  setSimVehicle: (v: string) => void
  simSurge: number
  setSimSurge: (n: number) => void
  simMode: 'live' | 'draft'
  setSimMode: (m: 'live' | 'draft') => void
  simResult: SimulationResult | null
  liveResult: SimulationResult | null
  draftResult: SimulationResult | null
  simMismatch: boolean
  isDraftDirty: boolean
  simulating: boolean
  onRun: () => void
  scheduledConfig?: FareConfig
}) {
  const inputStyle: React.CSSProperties = {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: 'monospace',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={campusPanel.card}>
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          background: T.bgCard,
        }}
        >
          <h2 style={{ ...campusPanel.cardTitle, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Terminal size={16} color={T.purple} />
            Fare simulation
          </h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['live', 'draft'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSimMode(m)}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  border: `1px solid ${simMode === m ? T.accent : T.border}`,
                  background: simMode === m ? T.accentBg : 'transparent',
                  color: simMode === m ? T.accent : T.textMuted,
                  cursor: 'pointer',
                }}
              >
                {m === 'live' ? 'Live (deployed)' : 'Draft preview'}
              </button>
            ))}
          </div>
        </div>

        {(simMismatch || scheduledConfig) && (
          <div style={{ padding: '10px 18px', fontSize: 11, color: T.warn, borderBottom: `1px solid ${T.border}`, background: 'rgba(245,158,11,0.06)' }}>
            {scheduledConfig && (
              <div style={{ marginBottom: simMismatch ? 6 : 0 }}>
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
                Scheduled tariff not yet live — simulation uses current deployed rates.
              </div>
            )}
            {simMismatch && liveResult && draftResult && (
              <div>
                Live total ₦{liveResult.total_fare.toLocaleString()} vs draft ₦{draftResult.total_fare.toLocaleString()}
                {isDraftDirty ? ' — deploy tariff to align production.' : '.'}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 320px) 1fr',
          gap: 2,
        }}
        >
          <div style={{ padding: 18, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Distance (km)</label>
              <input
                type="number"
                step={0.1}
                style={{ ...inputStyle, marginTop: 6 }}
                value={simDistance}
                onChange={(e) => setSimDistance(Number(e.target.value))}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Vehicle</label>
                <select
                  style={{ ...inputStyle, marginTop: 6 }}
                  value={simVehicle}
                  onChange={(e) => setSimVehicle(e.target.value)}
                >
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt.id} value={vt.id}>{vt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Surge</label>
                <select
                  style={{ ...inputStyle, marginTop: 6, borderColor: simSurge > 1 ? 'rgba(239,68,68,0.4)' : T.border }}
                  value={simSurge}
                  onChange={(e) => setSimSurge(Number(e.target.value))}
                >
                  <option value={1}>1.0× Normal</option>
                  <option value={1.5}>1.5× Busy</option>
                  <option value={2}>2.0× Peak</option>
                  <option value={3}>3.0× Extreme</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              style={{ ...campusPanel.btnSecondary, width: '100%', justifyContent: 'center', marginTop: 4 }}
              onClick={onRun}
              disabled={simulating}
            >
              {simulating ? <Activity size={14} /> : <Play size={14} />}
              Run calculation
            </button>
            <p style={{ fontSize: 10, color: T.textMuted, margin: 0, lineHeight: 1.45 }}>
              Live mode uses the same API as ride booking. Draft preview uses your unsaved tariff form values.
            </p>
          </div>

          <div style={{ padding: 18 }}>
            <TracePanel
              result={simResult}
              emptyLabel="Set distance and vehicle, then run calculation."
            />
            {liveResult && draftResult && simMode === 'live' && simMismatch && (
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 12 }}>
                Switch to <strong style={{ color: T.accent }}>Draft preview</strong> to see unsaved tariff changes.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

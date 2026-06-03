import type { CSSProperties } from 'react'
import {
  Calculator, AlertTriangle, Save, RotateCcw, Activity, ChevronDown,
} from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { VEHICLE_TYPES, EFFECTIVE_DELAY_OPTIONS } from '../constants'
import type { FareConfig, FareDraft } from '../types'

const fieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: T.textMuted,
  display: 'flex',
  justifyContent: 'space-between',
}

const inputStyle: CSSProperties = {
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  color: T.textPrimary,
  padding: '8px 12px',
  borderRadius: 0,
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export function TariffsTab({
  activeVehicle,
  setActiveVehicle,
  draft,
  setDraft,
  liveConfig,
  scheduledConfig,
  effectiveDelay,
  setEffectiveDelay,
  customEffective,
  setCustomEffective,
  isDraftDirty,
  isNewConfig,
  savingConfig,
  onSave,
  onRevert,
}: {
  activeVehicle: string
  setActiveVehicle: (v: string) => void
  draft: FareDraft
  setDraft: (d: FareDraft) => void
  liveConfig?: FareConfig
  scheduledConfig?: FareConfig
  effectiveDelay: string
  setEffectiveDelay: (v: string) => void
  customEffective: string
  setCustomEffective: (v: string) => void
  isDraftDirty: boolean
  isNewConfig: boolean
  savingConfig: boolean
  onSave: () => void
  onRevert: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={campusPanel.card}>
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          background: T.bgCard,
        }}
        >
          <h2 style={{ ...campusPanel.cardTitle, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Calculator size={16} color={T.accent} />
            Vehicle class tariffs
          </h2>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {VEHICLE_TYPES.map((vt) => (
              <button
                key={vt.id}
                type="button"
                onClick={() => setActiveVehicle(vt.id)}
                style={{
                  padding: '5px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${activeVehicle === vt.id ? T.accent : T.border}`,
                  background: activeVehicle === vt.id ? T.accentBg : 'transparent',
                  color: activeVehicle === vt.id ? T.accent : T.textMuted,
                }}
              >
                {vt.label}
              </button>
            ))}
          </div>
        </div>

        {scheduledConfig && (
          <div style={{ padding: '10px 18px', background: 'rgba(245,158,11,0.08)', borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.warn }}>
            <AlertTriangle size={12} style={{ display: 'inline', marginRight: 6 }} />
            A newer tariff is scheduled for {new Date(scheduledConfig.effective_from).toLocaleString()}.
            Simulation uses the live tariff until that time.
          </div>
        )}

        <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {([
            ['base_fare', 'Base fare (₦)'],
            ['per_km_rate', 'Per-km rate (₦)'],
            ['minimum_fare', 'Minimum fare (₦)'],
            ['booking_fee', 'Booking fee (₦)'],
            ['max_surge_multiplier', 'Max surge multiplier'],
          ] as const).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={fieldLabel}>{label}</label>
              <input
                type="number"
                style={inputStyle}
                value={draft[key]}
                min={0}
                step={key === 'max_surge_multiplier' ? 0.1 : 1}
                onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
              />
            </div>
          ))}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={fieldLabel}>Deploy timing</label>
            <div style={{ position: 'relative' }}>
              <select
                style={{ ...inputStyle, fontFamily: T.fontFamily, cursor: 'pointer' }}
                value={effectiveDelay}
                onChange={(e) => setEffectiveDelay(e.target.value)}
              >
                {EFFECTIVE_DELAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.value === 'existing' && !liveConfig}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} color={T.textMuted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            {effectiveDelay === 'custom' && (
              <input
                type="datetime-local"
                style={inputStyle}
                value={customEffective}
                onChange={(e) => setCustomEffective(e.target.value)}
              />
            )}
            {effectiveDelay === 'existing' && liveConfig && (
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'monospace' }}>
                Active since {new Date(liveConfig.effective_from).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 24px 16px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.surge_enabled}
            onChange={(e) => setDraft({ ...draft, surge_enabled: e.target.checked })}
            style={{ accentColor: T.accent }}
          />
          <span style={{ fontSize: 13, color: T.textPrimary }}>Enable surge pricing guardrails</span>
        </label>

        <div style={{
          padding: '12px 18px',
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          background: T.bgCard,
        }}
        >
          <div style={{ fontSize: 12, color: T.textMuted }}>
            {isNewConfig ? 'No live config — using defaults until deployed' : isDraftDirty ? 'Unsaved draft — simulation can preview before deploy' : 'Matches live tariff in database'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={campusPanel.btnSecondary} onClick={onRevert} disabled={!isDraftDirty && !isNewConfig}>
              <RotateCcw size={14} />
              Revert
            </button>
            <button
              type="button"
              style={campusPanel.btnPrimary}
              onClick={onSave}
              disabled={savingConfig || (!isDraftDirty && !isNewConfig)}
            >
              {savingConfig ? <Activity size={14} /> : <Save size={14} />}
              Deploy tariff
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

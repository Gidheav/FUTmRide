import type { CSSProperties } from 'react'
import {
  Calculator, AlertTriangle, Save, RotateCcw, Activity, ChevronDown, Zap,
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
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
}

const inputStyle: CSSProperties = {
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  color: T.textPrimary,
  padding: '12px 14px',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'all 0.2s ease',
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  fontFamily: T.fontFamily,
  cursor: 'pointer',
}

const formFieldContainer: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px' }}>
      {/* ── Header ─────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: T.textWhite, margin: '0 0 8px 0', letterSpacing: -0.5 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={28} color={T.accent} />
            Vehicle Class Tariffs
          </span>
        </h2>
        <p style={{ fontSize: 13, color: T.textSecondary, margin: 0 }}>
          Configure pricing rules for each vehicle type. Changes take effect immediately when deployed.
        </p>
      </div>

      {/* ── Vehicle Selector Pills ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Select Vehicle</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {VEHICLE_TYPES.map((vt) => (
            <button
              key={vt.id}
              type="button"
              onClick={() => setActiveVehicle(vt.id)}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1.5px solid ${activeVehicle === vt.id ? T.accent : T.border}`,
                background: activeVehicle === vt.id ? `${T.accent}20` : 'transparent',
                color: activeVehicle === vt.id ? T.accent : T.textSecondary,
                borderRadius: 6,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (activeVehicle !== vt.id) {
                  (e.currentTarget).style.borderColor = T.accent
                  (e.currentTarget).style.background = `${T.accent}10`
                }
              }}
              onMouseLeave={(e) => {
                if (activeVehicle !== vt.id) {
                  (e.currentTarget).style.borderColor = T.border
                  (e.currentTarget).style.background = 'transparent'
                }
              }}
            >
              {vt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scheduled Config Alert ─────────────────────────────── */}
      {scheduledConfig && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: `1px solid rgba(245, 158, 11, 0.3)`,
          borderRadius: 8,
          padding: '14px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <AlertTriangle size={18} color={T.warn} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.warn }}>Scheduled Update Pending</span>
            <span style={{ fontSize: 12, color: T.textMuted }}>
              A new tariff is scheduled to deploy on {new Date(scheduledConfig.effective_from).toLocaleString()}. Simulations will use the live tariff until then.
            </span>
          </div>
        </div>
      )}

      {/* ── Tariff Fields Grid ─────────────────────────────── */}
      <div style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
        }}>
          {([
            ['base_fare', 'Base Fare', '₦', 'Starting charge per ride'],
            ['per_km_rate', 'Per-Km Rate', '₦', 'Distance-based pricing'],
            ['minimum_fare', 'Minimum Fare', '₦', 'Lowest possible fare'],
            ['booking_fee', 'Booking Fee', '₦', 'Fixed booking charge'],
            ['max_surge_multiplier', 'Max Surge', '×', 'Surge pricing cap'],
          ] as const).map(([key, label, unit, hint]) => (
            <div key={key} style={formFieldContainer}>
              <div>
                <label style={fieldLabel}>{label}</label>
                <span style={{ fontSize: 11, color: T.textMuted, marginBottom: 8, display: 'block' }}>{hint}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, fontSize: 13, fontWeight: 600, color: T.textMuted, pointerEvents: 'none' }}>
                  {unit}
                </span>
                <input
                  type="number"
                  style={{ ...inputStyle, paddingLeft: '32px' }}
                  value={draft[key]}
                  min={0}
                  step={key === 'max_surge_multiplier' ? 0.1 : 1}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                  onFocus={(e) => {
                    (e.target).style.borderColor = T.accent
                    (e.target).style.boxShadow = `0 0 0 3px rgba(168, 85, 247, 0.1)`
                  }}
                  onBlur={(e) => {
                    (e.target).style.borderColor = T.border
                    (e.target).style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── Deployment Settings ─────────────────────────────── */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <div style={formFieldContainer}>
              <label style={fieldLabel}>Deploy Timing</label>
              <div style={{ position: 'relative' }}>
                <select
                  style={selectStyle as any}
                  value={effectiveDelay}
                  onChange={(e) => setEffectiveDelay(e.target.value)}
                  onFocus={(e) => {
                    (e.target as any).style.borderColor = T.accent
                  }}
                  onBlur={(e) => {
                    (e.target as any).style.borderColor = T.border
                  }}
                >
                  {EFFECTIVE_DELAY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} disabled={o.value === 'existing' && !liveConfig}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} color={T.textMuted} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
              {effectiveDelay === 'existing' && liveConfig && (
                <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>
                  ✓ Active since {new Date(liveConfig.effective_from).toLocaleString()}
                </span>
              )}
            </div>

            {effectiveDelay === 'custom' && (
              <div style={formFieldContainer}>
                <label style={fieldLabel}>Deployment Date & Time</label>
                <input
                  type="datetime-local"
                  style={selectStyle as any}
                  value={customEffective}
                  onChange={(e) => setCustomEffective(e.target.value)}
                  onFocus={(e) => {
                    (e.target as any).style.borderColor = T.accent
                  }}
                  onBlur={(e) => {
                    (e.target as any).style.borderColor = T.border
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Surge Enable Checkbox ─────────────────────────────── */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', paddingTop: 12 }}>
          <input
            type="checkbox"
            checked={draft.surge_enabled}
            onChange={(e) => setDraft({ ...draft, surge_enabled: e.target.checked })}
            style={{ accentColor: T.accent, width: 18, height: 18, cursor: 'pointer' }}
          />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} color={T.accent} />
              Enable Surge Pricing Guardrails
            </span>
            <span style={{ fontSize: 11, color: T.textMuted, display: 'block', marginTop: 2 }}>
              Limit fare multipliers during peak demand periods
            </span>
          </div>
        </label>
      </div>

      {/* ── Status & Actions ─────────────────────────────── */}
      <div style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>
          {isNewConfig ? '⚡ No live config — defaults apply until deployed' : isDraftDirty ? '✏️ Unsaved changes — preview in simulation' : '✓ Matches live tariff in database'}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onRevert}
            disabled={!isDraftDirty && !isNewConfig}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 6,
              border: `1.5px solid ${T.border}`,
              background: 'transparent',
              color: T.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: (!isDraftDirty && !isNewConfig) ? 'not-allowed' : 'pointer',
              fontFamily: T.fontFamily,
              opacity: (!isDraftDirty && !isNewConfig) ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!(!isDraftDirty && !isNewConfig)) {
                (e.currentTarget).style.borderColor = T.accent
                (e.currentTarget).style.color = T.accent
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget).style.borderColor = T.border
              (e.currentTarget).style.color = T.textSecondary
            }}
          >
            <RotateCcw size={16} />
            Revert
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={savingConfig || (!isDraftDirty && !isNewConfig)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              background: (savingConfig || (!isDraftDirty && !isNewConfig)) ? `${T.accent}50` : T.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: (savingConfig || (!isDraftDirty && !isNewConfig)) ? 'not-allowed' : 'pointer',
              fontFamily: T.fontFamily,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!(savingConfig || (!isDraftDirty && !isNewConfig))) {
                (e.currentTarget).style.opacity = '0.9'
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget).style.opacity = '1'
            }}
          >
            {savingConfig ? <Activity size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
            Deploy Tariff
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

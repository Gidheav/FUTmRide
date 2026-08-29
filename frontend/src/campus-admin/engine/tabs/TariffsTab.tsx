import type { CSSProperties } from 'react'
import {
  Activity,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock3,
  RotateCcw,
  Save,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import { EFFECTIVE_DELAY_OPTIONS, VEHICLE_TYPES } from '../constants'
import type { FareConfig, FareDraft } from '../types'

const money = (value: number) => `NGN ${Number(value || 0).toLocaleString()}`

const previewFare = (draft: FareDraft, distance: number, surge: number) => {
  const subtotal = Number(draft.base_fare || 0)
    + (Number(draft.per_km_rate || 0) * distance)
    + Number(draft.booking_fee || 0)
  const cappedSurge = draft.surge_enabled ? Math.min(surge, Number(draft.max_surge_multiplier || 1)) : 1
  return Math.max(Number(draft.minimum_fare || 0), Math.round(subtotal * cappedSurge))
}

const inputStyle: CSSProperties = {
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  color: T.textPrimary,
  padding: '9px 10px',
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 0,
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  fontFamily: T.fontFamily,
  cursor: 'pointer',
  appearance: 'none',
}

const labelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: T.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const sectionHeader: CSSProperties = {
  padding: '12px 16px',
  borderBottom: `1px solid ${T.border}`,
  background: T.bgCard,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

function StatusBadge({
  isNewConfig,
  isDraftDirty,
}: {
  isNewConfig: boolean
  isDraftDirty: boolean
}) {
  const meta = isNewConfig
    ? { label: 'No live tariff', color: T.warn, bg: T.warnBg, icon: AlertTriangle }
    : isDraftDirty
      ? { label: 'Unsaved draft', color: T.warn, bg: T.warnBg, icon: Clock3 }
      : { label: 'Live matches draft', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle2 }
  const Icon = meta.icon

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: meta.color,
      background: meta.bg,
      border: `1px solid ${meta.color}35`,
      padding: '5px 9px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      <Icon size={12} />
      {meta.label}
    </span>
  )
}

function FieldCard({
  label,
  hint,
  value,
  unit,
  step,
  onChange,
}: {
  label: string
  hint: string
  value: number
  unit: string
  step: number
  onChange: (value: number) => void
}) {
  return (
    <div style={s.fieldCard}>
      <div>
        <div style={labelStyle}>{label}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{hint}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 38, fontSize: 11, fontWeight: 700, color: T.textMuted, textAlign: 'right' }}>
          {unit}
        </span>
        <input
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          style={inputStyle}
        />
      </div>
    </div>
  )
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
  canSaveConfig,
  draftError,
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
  canSaveConfig: boolean
  draftError: string | null
  onSave: () => void
  onRevert: () => void
}) {
  const activeVehicleLabel = VEHICLE_TYPES.find((vehicle) => vehicle.id === activeVehicle)?.label ?? activeVehicle
  const canRevert = isDraftDirty || isNewConfig
  const canSave = canSaveConfig
  const standardPreview = previewFare(draft, 10, 1)
  const peakPreview = previewFare(draft, 10, 1.5)
  const liveDraft = liveConfig
    ? {
        base_fare: Number(liveConfig.base_fare),
        per_km_rate: Number(liveConfig.per_km_rate),
        minimum_fare: Number(liveConfig.minimum_fare),
        booking_fee: Number(liveConfig.booking_fee),
        surge_enabled: liveConfig.surge_enabled,
        max_surge_multiplier: Number(liveConfig.max_surge_multiplier),
      }
    : null
  const livePreview = liveDraft ? previewFare(liveDraft, 10, 1) : null
  const previewDelta = livePreview == null ? null : standardPreview - livePreview
  const checks = [
    ['Base >= 0', draft.base_fare >= 0],
    ['Per-km >= 0', draft.per_km_rate >= 0],
    ['Minimum covers base', draft.minimum_fare >= draft.base_fare],
    ['Surge cap >= 1x', !draft.surge_enabled || draft.max_surge_multiplier >= 1],
  ] as const

  const updateDraft = (key: keyof FareDraft, value: number | boolean) => {
    setDraft({ ...draft, [key]: value })
  }

  return (
    <>
      <style>{`
        .engine-tariff-shell {
          display: grid;
          grid-template-columns: 288px minmax(0, 1fr);
          gap: 2px;
          min-height: 100%;
          align-items: start;
        }
        .engine-tariff-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 2px;
        }
        .engine-tariff-deploy {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 2px;
        }
        .engine-tariff-insights {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 2px;
        }
        @media (max-width: 920px) {
          .engine-tariff-shell { grid-template-columns: 1fr; }
          .engine-tariff-insights { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="engine-tariff-shell">
        <aside style={s.rail}>
          <section style={campusPanel.card}>
            <div style={sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={14} color={T.textMuted} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Vehicle Tariffs</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 2 }}>
              {VEHICLE_TYPES.map((vehicle) => {
                const isActive = activeVehicle === vehicle.id
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setActiveVehicle(vehicle.id)}
                    style={{
                      ...s.vehicleButton,
                      borderColor: isActive ? T.borderLight : T.border,
                      background: isActive ? T.bgCard : T.bgPanel,
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>
                        {vehicle.label}
                      </span>
                      <span style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>
                        {vehicle.id === activeVehicle && liveConfig ? `${money(liveConfig.base_fare)} live base` : 'Vehicle class'}
                      </span>
                    </span>
                    {isActive && <CheckCircle2 size={13} color={T.textSecondary} />}
                  </button>
                )
              })}
            </div>
          </section>

          <section style={campusPanel.card}>
            <div style={sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={14} color={T.textMuted} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Live Snapshot</span>
              </div>
            </div>
            <div style={s.snapshotList}>
              {[
                ['Base', liveConfig ? money(liveConfig.base_fare) : '-'],
                ['Per km', liveConfig ? money(liveConfig.per_km_rate) : '-'],
                ['Minimum', liveConfig ? money(liveConfig.minimum_fare) : '-'],
                ['Booking', liveConfig ? money(liveConfig.booking_fee) : '-'],
                ['Surge cap', liveConfig?.surge_enabled ? `${liveConfig.max_surge_multiplier}x` : 'Off'],
              ].map(([label, value]) => (
                <div key={label} style={s.snapshotRow}>
                  <span style={labelStyle}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main style={s.editor}>
          <section style={campusPanel.card}>
            <div style={{ ...sectionHeader, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.textWhite }}>{activeVehicleLabel}</span>
                  <StatusBadge isNewConfig={isNewConfig} isDraftDirty={isDraftDirty} />
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: T.textMuted }}>
                  Edit the active vehicle tariff, then deploy it with a controlled effective time.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={onRevert}
                  disabled={!canRevert}
                  style={{
                    ...campusPanel.btnSecondary,
                    opacity: canRevert ? 1 : 0.5,
                    cursor: canRevert ? 'pointer' : 'not-allowed',
                  }}
                >
                  <RotateCcw size={13} />
                  Revert
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!canSave}
                  style={{
                    ...campusPanel.btnPrimary,
                    background: '#334155',
                    opacity: canSave ? 1 : 0.55,
                    cursor: canSave ? 'pointer' : 'not-allowed',
                  }}
                >
                  {savingConfig ? <Activity size={13} /> : <Save size={13} />}
                  Deploy tariff
                </button>
              </div>
            </div>

            {scheduledConfig && (
              <div style={s.pendingBar}>
                <AlertTriangle size={14} color={T.warn} />
                <span>
                  Scheduled deploy: {new Date(scheduledConfig.effective_from).toLocaleString()}
                </span>
              </div>
            )}

            {draftError && (
              <div style={s.errorBar}>
                <AlertTriangle size={14} color={T.error} />
                <span>{draftError}</span>
              </div>
            )}

            <div className="engine-tariff-fields">
              <FieldCard
                label="Base fare"
                hint="Starting charge"
                unit="NGN"
                value={draft.base_fare}
                step={1}
                onChange={(value) => updateDraft('base_fare', value)}
              />
              <FieldCard
                label="Per-km rate"
                hint="Distance pricing"
                unit="NGN"
                value={draft.per_km_rate}
                step={1}
                onChange={(value) => updateDraft('per_km_rate', value)}
              />
              <FieldCard
                label="Minimum fare"
                hint="Fare floor"
                unit="NGN"
                value={draft.minimum_fare}
                step={1}
                onChange={(value) => updateDraft('minimum_fare', value)}
              />
              <FieldCard
                label="Booking fee"
                hint="Fixed rider fee"
                unit="NGN"
                value={draft.booking_fee}
                step={1}
                onChange={(value) => updateDraft('booking_fee', value)}
              />
              <FieldCard
                label="Max surge"
                hint="Multiplier cap"
                unit="x"
                value={draft.max_surge_multiplier}
                step={0.1}
                onChange={(value) => updateDraft('max_surge_multiplier', value)}
              />
            </div>
          </section>

          <section style={campusPanel.card}>
            <div style={sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock3 size={14} color={T.textMuted} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Deployment</span>
              </div>
            </div>
            <div className="engine-tariff-deploy" style={{ padding: 2 }}>
              <div style={s.deployPanel}>
                <label style={labelStyle}>Effective time</label>
                <div style={{ position: 'relative', marginTop: 8 }}>
                  <select
                    value={effectiveDelay}
                    onChange={(event) => setEffectiveDelay(event.target.value)}
                    style={selectStyle}
                  >
                    {EFFECTIVE_DELAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} disabled={option.value === 'existing' && !liveConfig}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} color={T.textMuted} style={s.selectIcon} />
                </div>
                {effectiveDelay === 'existing' && liveConfig && (
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 7 }}>
                    Active since {new Date(liveConfig.effective_from).toLocaleString()}
                  </div>
                )}
              </div>

              {effectiveDelay === 'custom' && (
                <div style={s.deployPanel}>
                  <label style={labelStyle}>Custom deploy date</label>
                  <input
                    type="datetime-local"
                    value={customEffective}
                    onChange={(event) => setCustomEffective(event.target.value)}
                    style={{ ...inputStyle, marginTop: 8, fontFamily: T.fontFamily }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => updateDraft('surge_enabled', !draft.surge_enabled)}
                style={{
                  ...s.surgePanel,
                  borderColor: draft.surge_enabled ? T.borderLight : T.border,
                  background: draft.surge_enabled ? T.bgCard : T.bgPanel,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={14} color={draft.surge_enabled ? T.textPrimary : T.textMuted} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>Surge guardrail</span>
                </span>
                <span style={{ fontSize: 10, color: draft.surge_enabled ? T.textPrimary : T.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                  {draft.surge_enabled ? 'enabled' : 'disabled'}
                </span>
              </button>
            </div>
          </section>

          <div className="engine-tariff-insights">
            <section style={campusPanel.card}>
              <div style={sectionHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calculator size={14} color={T.textMuted} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Draft Preview</span>
                </div>
                <span style={labelStyle}>10 km sample</span>
              </div>
              <div style={s.previewGrid}>
                {[
                  ['Standard', standardPreview, '1x surge'],
                  ['Peak', peakPreview, draft.surge_enabled ? '1.5x requested' : 'Surge off'],
                  ['Live delta', previewDelta, livePreview == null ? 'No live tariff' : 'vs current live'],
                ].map(([label, value, hint]) => (
                  <div key={label as string} style={s.previewCard}>
                    <div style={labelStyle}>{label}</div>
                    <div style={{ marginTop: 8, fontSize: 20, lineHeight: 1, fontFamily: 'monospace', fontWeight: 800, color: value == null ? T.textMuted : T.textPrimary }}>
                      {value == null ? '-' : `${Number(value) >= 0 && label === 'Live delta' ? '+' : ''}${money(Number(value))}`}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 10, color: T.textMuted }}>{hint}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={campusPanel.card}>
              <div style={sectionHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={14} color={T.textMuted} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Validation</span>
                </div>
              </div>
              <div style={s.validationList}>
                {checks.map(([label, ok]) => (
                  <div key={label} style={s.validationRow}>
                    <span style={labelStyle}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ok ? T.textPrimary : T.warn }}>
                      {ok ? 'Pass' : 'Check'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section style={{ ...campusPanel.card, minHeight: 160 }}>
            <div style={sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock3 size={14} color={T.textMuted} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textWhite }}>Live vs Draft</span>
              </div>
              <span style={labelStyle}>{activeVehicleLabel}</span>
            </div>
            <div style={s.compareGrid}>
              {([
                ['Base fare', liveConfig?.base_fare, draft.base_fare],
                ['Per-km rate', liveConfig?.per_km_rate, draft.per_km_rate],
                ['Minimum fare', liveConfig?.minimum_fare, draft.minimum_fare],
                ['Booking fee', liveConfig?.booking_fee, draft.booking_fee],
                ['Max surge', liveConfig?.max_surge_multiplier, draft.max_surge_multiplier],
              ] as const).map(([label, liveValue, draftValue]) => {
                const changed = liveValue != null && Number(liveValue) !== Number(draftValue)
                return (
                  <div key={label} style={s.compareRow}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{label}</span>
                    <span style={s.compareValue}>{liveValue == null ? '-' : label === 'Max surge' ? `${liveValue}x` : money(Number(liveValue))}</span>
                    <span style={{ ...s.compareValue, color: changed ? T.warn : T.textPrimary }}>{label === 'Max surge' ? `${draftValue}x` : money(Number(draftValue))}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </main>
      </div>
    </>
  )
}

const s: Record<string, CSSProperties> = {
  rail: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  editor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  vehicleButton: {
    width: '100%',
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    cursor: 'pointer',
    padding: '12px 14px',
    fontFamily: T.fontFamily,
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  snapshotList: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  snapshotRow: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    padding: '9px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pendingBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 16px',
    borderBottom: `1px solid ${T.border}`,
    background: 'rgba(245,158,11,0.08)',
    color: T.warn,
    fontSize: 11,
    fontWeight: 700,
  },
  errorBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 16px',
    borderBottom: `1px solid ${T.border}`,
    background: 'rgba(239,68,68,0.08)',
    color: T.error,
    fontSize: 11,
    fontWeight: 700,
  },
  fieldCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 116,
  },
  deployPanel: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    padding: 14,
    minHeight: 90,
  },
  surgePanel: {
    border: `1px solid ${T.border}`,
    padding: 14,
    minHeight: 90,
    color: T.textPrimary,
    fontFamily: T.fontFamily,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'left',
  },
  selectIcon: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  previewGrid: {
    padding: 2,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 2,
  },
  previewCard: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    padding: 14,
    minHeight: 94,
  },
  validationList: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  validationRow: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compareGrid: {
    padding: 2,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 2,
  },
  compareRow: {
    background: T.bgPanel,
    border: `1px solid ${T.border}`,
    padding: 14,
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: 14,
    alignItems: 'center',
    minHeight: 58,
  },
  compareValue: {
    fontSize: 11,
    fontWeight: 700,
    color: T.textPrimary,
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
  },
}

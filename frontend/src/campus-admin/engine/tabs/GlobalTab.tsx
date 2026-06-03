import { Check, Activity, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import type { PlatformSettings } from '../types'

export function GlobalTab({
  settings,
  setSettings,
  saving,
  onSave,
}: {
  settings: PlatformSettings
  setSettings: (s: PlatformSettings) => void
  saving: boolean
  onSave: () => void
}) {
  const inputStyle: React.CSSProperties = {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={campusPanel.card}>
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: T.bgCard,
      }}
      >
        <h2 style={{ ...campusPanel.cardTitle, margin: 0 }}>Global constraints</h2>
        <button type="button" style={campusPanel.btnPrimary} onClick={onSave} disabled={saving}>
          {saving ? <Activity size={12} /> : <Check size={12} />}
          Save
        </button>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 560 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Platform commission</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <input
              type="range"
              min={0}
              max={50}
              step={0.5}
              value={settings.commission_rate * 100}
              onChange={(e) => setSettings({ ...settings, commission_rate: Number(e.target.value) / 100 })}
              style={{ flex: 1, accentColor: T.accent }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 13, minWidth: 44 }}>{(settings.commission_rate * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Distance provider</label>
          <div style={{ position: 'relative', marginTop: 8 }}>
            <select
              style={inputStyle}
              value={settings.distance_provider}
              onChange={(e) => setSettings({ ...settings, distance_provider: e.target.value })}
            >
              <option value="osrm">OSRM routing</option>
              <option value="google">Google distance matrix</option>
              <option value="haversine">Haversine fallback</option>
            </select>
            <ChevronDown size={12} color={T.textMuted} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>Max distance (km)</label>
          <input
            type="number"
            style={{ ...inputStyle, marginTop: 8, fontFamily: 'monospace' }}
            value={settings.max_distance_km}
            onChange={(e) => setSettings({ ...settings, max_distance_km: Number(e.target.value) })}
          />
          <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Fare calculation clamps distance to this cap.</p>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>No-show fee (₦)</label>
          <input
            type="number"
            style={{ ...inputStyle, marginTop: 8, fontFamily: 'monospace' }}
            value={settings.no_show_fee_amount}
            disabled={!settings.no_show_fee_enabled}
            onChange={(e) => setSettings({ ...settings, no_show_fee_amount: Number(e.target.value) })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Enable no-show fee</div>
            <div style={{ fontSize: 10, color: T.textMuted }}>After {settings.no_show_wait_minutes} min wait</div>
          </div>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, no_show_fee_enabled: !settings.no_show_fee_enabled })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {settings.no_show_fee_enabled
              ? <ToggleRight size={32} color="#10b981" />
              : <ToggleLeft size={32} color={T.textMuted} />}
          </button>
        </div>
      </div>
    </div>
  )
}

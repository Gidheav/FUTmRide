import { useState, useEffect } from 'react'
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react'
import axios from 'axios'
import api from '../../core/api'
import { campusPanel } from '../shared/campusPanelStyles'
import { T } from '../theme'
import { useEngineStore } from '../engineStore'
import {
  configToDraft,
  defaultFareDraft,
  draftsEqual,
  resolveEffectiveFrom,
  toDatetimeLocal,
} from './fareCalculator'
import type { FareDraft } from './types'
import { OverviewTab } from './tabs/OverviewTab'
import { TariffsTab } from './tabs/TariffsTab'
import { SimulationTab } from './tabs/SimulationTab'
import { GlobalTab } from './tabs/GlobalTab'
import { HistoryTab } from './tabs/HistoryTab'

const fieldLabels: Record<string, string> = {
  vehicle_type: 'Vehicle type',
  base_fare: 'Base fare',
  per_km_rate: 'Per-km rate',
  minimum_fare: 'Minimum fare',
  booking_fee: 'Booking fee',
  surge_enabled: 'Surge',
  max_surge_multiplier: 'Max surge',
  effective_from: 'Effective time',
  effective_to: 'Effective end time',
  non_field_errors: 'Error',
  detail: 'Error',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const firstMessage = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const msg = firstMessage(item)
      if (msg) return msg
    }
    return null
  }
  if (isRecord(value)) {
    if (typeof value.message === 'string') return value.message
    if (typeof value.detail === 'string') return value.detail
    if (typeof value.error === 'string') return value.error
    return Object.entries(value)
      .map(([key, item]) => {
        const msg = firstMessage(item)
        return msg ? `${fieldLabels[key] ?? key}: ${msg}` : null
      })
      .find(Boolean) ?? null
  }
  return null
}

const readApiError = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      return 'Request timed out. The server may be waking up; try again in a few seconds.'
    }
    if (!err.response) {
      return 'Cannot reach the API. Check that the backend is running and the frontend API URL points to it.'
    }
    return firstMessage(err.response.data) || `Server error ${err.response.status}.`
  }
  return err instanceof Error ? err.message : fallback
}

const validateFareDraft = (draft: FareDraft, effectiveDelay: string, customEffective: string) => {
  const numericFields: Array<[keyof FareDraft, string]> = [
    ['base_fare', 'Base fare'],
    ['per_km_rate', 'Per-km rate'],
    ['minimum_fare', 'Minimum fare'],
    ['booking_fee', 'Booking fee'],
    ['max_surge_multiplier', 'Max surge'],
  ]

  for (const [key, label] of numericFields) {
    const value = Number(draft[key])
    if (!Number.isFinite(value)) return `${label} must be a valid number.`
    if (value < 0) return `${label} cannot be negative.`
  }
  if (draft.minimum_fare < draft.base_fare) {
    return 'Minimum fare must be greater than or equal to the base fare.'
  }
  if (draft.max_surge_multiplier < 1 || draft.max_surge_multiplier > 5) {
    return 'Max surge must be between 1.0x and 5.0x.'
  }
  if (effectiveDelay === 'custom') {
    const customDate = new Date(customEffective)
    if (!customEffective || Number.isNaN(customDate.getTime())) {
      return 'Choose a valid custom deployment time.'
    }
  }
  return null
}

export default function EngineHub() {
  const {
    activeTab, activeVehicle, setActiveVehicle, setActiveTab,
    settings, setSettings, liveConfigs, scheduledConfigs, historyList,
    dataLoaded, fetchData, fetchError, isFetching,
  } = useEngineStore()
  
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  const [draft, setDraft] = useState<FareDraft | null>(null)
  const [draftMeta, setDraftMeta] = useState<{ id?: string; effective_from: string }>({ effective_from: '' })
  const [effectiveDelay, setEffectiveDelay] = useState<string>('now')
  const [customEffective, setCustomEffective] = useState('')

  useEffect(() => {
    if (!dataLoaded) {
      fetchData()
    }
  }, [dataLoaded, fetchData])

  const liveConfig = liveConfigs[activeVehicle]
  const scheduledConfig = scheduledConfigs[activeVehicle]

  useEffect(() => {
    if (liveConfig) {
      setDraft(configToDraft(liveConfig))
      setDraftMeta({ id: liveConfig.id, effective_from: liveConfig.effective_from })
      setEffectiveDelay('existing')
      setCustomEffective(toDatetimeLocal(liveConfig.effective_from))
    } else {
      setDraft(defaultFareDraft(activeVehicle))
      setDraftMeta({ effective_from: new Date().toISOString() })
      setEffectiveDelay('now')
      setCustomEffective(toDatetimeLocal(new Date().toISOString()))
    }
  }, [activeVehicle, liveConfig])

  const liveDraft = liveConfig ? configToDraft(liveConfig) : null
  const isDraftDirty = draft && liveDraft ? !draftsEqual(draft, liveDraft) : !!draft && !liveConfig
  const isNewConfig = !liveConfig
  const isDeployDirty = effectiveDelay !== 'existing'
  const draftError = draft ? validateFareDraft(draft, effectiveDelay, customEffective) : null
  const canSaveConfig = !!draft && !savingConfig && !draftError && (isDraftDirty || isNewConfig || isDeployDirty)

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await api.patch('/pricing/settings/', settings, { timeout: 45000 })
      await fetchData(true)
    } catch (err: unknown) {
      alert(`Error: ${readApiError(err, 'Failed to update global settings.')}`)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!draft) return
    const validationError = validateFareDraft(draft, effectiveDelay, customEffective)
    if (validationError) {
      alert(`Error: ${validationError}`)
      return
    }
    setSavingConfig(true)
    try {
      const existingIso = liveConfig?.effective_from
      const effective_from = resolveEffectiveFrom(
        effectiveDelay,
        customEffective,
        existingIso,
      )
      const payload = {
        vehicle_type: activeVehicle,
        is_active: true,
        ...draft,
        effective_from,
      }
      if (draftMeta.id && effectiveDelay === 'existing') {
        await api.patch(`/pricing/config/${draftMeta.id}/`, payload, { timeout: 45000 })
      } else {
        await api.post('/pricing/config/', payload, { timeout: 45000 })
      }
      await fetchData(true)
    } catch (err: unknown) {
      alert(`Error: ${readApiError(err, 'Failed to save configuration.')}`)
    } finally {
      setSavingConfig(false)
    }
  }

  if (!dataLoaded) {
    return (
      <div style={{ ...campusPanel.shell, alignItems: 'center', justifyContent: 'center', color: T.textMuted, gap: 16, flexDirection: 'column' }}>
        <Activity size={32} />
        <p style={{ margin: 0, fontSize: 13 }}>Loading pricing engine…</p>
        {isFetching && (
          <p style={{ margin: 0, fontSize: 10, color: T.textMuted }}>Contacting server… this may take up to 45 s on first request.</p>
        )}
      </div>
    )
  }

  return (
    <div style={campusPanel.shell}>
      <div style={{ ...campusPanel.scrollMain, ...campusPanel.thinScroll }}>
        {/* Error banner — shown when initial load succeeded partially or on force-refresh fail */}
        {fetchError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', background: 'rgba(239,68,68,0.08)',
            border: `1px solid rgba(239,68,68,0.3)`, fontSize: 11,
            color: T.error, flexShrink: 0,
          }}>
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{fetchError}</span>
            <button
              type="button"
              style={{ ...campusPanel.btnSecondary, padding: '4px 10px', fontSize: 10 }}
              onClick={() => fetchData(true)}
            >
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        )}
        {activeTab === 'overview' && (
          <OverviewTab
            settings={settings}
            liveConfigs={liveConfigs}
            scheduledConfigs={scheduledConfigs}
            onGoTariffs={() => setActiveTab('tariffs')}
            onGoSimulation={() => setActiveTab('simulation')}
          />
        )}
        {activeTab === 'tariffs' && draft && (
          <TariffsTab
            activeVehicle={activeVehicle}
            setActiveVehicle={setActiveVehicle}
            draft={draft}
            setDraft={setDraft}
            liveConfig={liveConfig}
            scheduledConfig={scheduledConfig}
            effectiveDelay={effectiveDelay}
            setEffectiveDelay={setEffectiveDelay}
            customEffective={customEffective}
            setCustomEffective={setCustomEffective}
            isDraftDirty={isDraftDirty}
            isNewConfig={isNewConfig}
            savingConfig={savingConfig}
            canSaveConfig={canSaveConfig}
            draftError={draftError}
            onSave={handleSaveConfig}
            onRevert={() => {
              if (liveConfig) {
                setDraft(configToDraft(liveConfig))
                setEffectiveDelay('existing')
              } else {
                setDraft(defaultFareDraft(activeVehicle))
                setEffectiveDelay('now')
              }
            }}
          />
        )}
        {activeTab === 'simulation' && draft && (
          <SimulationTab
            settings={settings}
            liveConfigs={liveConfigs}
            scheduledConfigs={scheduledConfigs}
            tariffsDraft={draft}
            tariffsVehicle={activeVehicle}
          />
        )}
        {activeTab === 'global' && (
          <GlobalTab
            settings={settings}
            setSettings={setSettings}
            saving={savingSettings}
            onSave={handleSaveSettings}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            configs={historyList}
            onRefresh={() => fetchData(true)}
          />
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Activity } from 'lucide-react'
import api from '../../core/api'
import { campusPanel } from '../shared/campusPanelStyles'
import { T } from '../theme'
import { useEngineStore } from '../engineStore'
import { VEHICLE_TYPES } from './constants'
import {
  calculateFare,
  configToDraft,
  draftsEqual,
  resolveEffectiveFrom,
  toDatetimeLocal,
} from './fareCalculator'
import type { FareConfig, FareDraft, PlatformSettings, SimulationResult } from './types'
import { OverviewTab } from './tabs/OverviewTab'
import { TariffsTab } from './tabs/TariffsTab'
import { SimulationTab } from './tabs/SimulationTab'
import { GlobalTab } from './tabs/GlobalTab'
import { HistoryTab } from './tabs/HistoryTab'

const DEFAULT_SETTINGS: PlatformSettings = {
  commission_rate: 0.15,
  distance_provider: 'osrm',
  max_distance_km: 150,
  no_show_fee_enabled: true,
  no_show_fee_amount: 200,
  no_show_wait_minutes: 5,
}

const emptyDraft = (vehicle: string): FareDraft => ({
  base_fare: 500,
  per_km_rate: 150,
  minimum_fare: 800,
  booking_fee: 50,
  surge_enabled: true,
  max_surge_multiplier: 2.5,
})

export default function EngineHub() {
  const { activeTab, activeVehicle, setActiveVehicle, setActiveTab } = useEngineStore()
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS)
  const [liveConfigs, setLiveConfigs] = useState<Record<string, FareConfig>>({})
  const [scheduledConfigs, setScheduledConfigs] = useState<Record<string, FareConfig>>({})
  const [historyList, setHistoryList] = useState<FareConfig[]>([])

  const [draft, setDraft] = useState<FareDraft | null>(null)
  const [draftMeta, setDraftMeta] = useState<{ id?: string; effective_from: string }>({ effective_from: '' })
  const [effectiveDelay, setEffectiveDelay] = useState<string>('now')
  const [customEffective, setCustomEffective] = useState('')

  const [simDistance, setSimDistance] = useState(12.5)
  const [simVehicle, setSimVehicle] = useState('sedan')
  const [simSurge, setSimSurge] = useState(1.0)
  const [simMode, setSimMode] = useState<'live' | 'draft'>('live')
  const [liveResult, setLiveResult] = useState<SimulationResult | null>(null)
  const [draftResult, setDraftResult] = useState<SimulationResult | null>(null)
  const [simulating, setSimulating] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/pricing/config/active/'),
        api.get('/pricing/config/', { params: { active_only: 'false' } }),
      ])
      const data = activeRes.data
      setSettings(data.settings ?? DEFAULT_SETTINGS)
      const live: Record<string, FareConfig> = {}
      Object.entries(data.live || {}).forEach(([vt, cfg]) => {
        live[vt] = cfg as FareConfig
      })
      setLiveConfigs(live)
      const sched: Record<string, FareConfig> = {}
      Object.entries(data.scheduled || {}).forEach(([vt, cfg]) => {
        sched[vt] = cfg as FareConfig
      })
      setScheduledConfigs(sched)

      const list = Array.isArray(historyRes.data)
        ? historyRes.data
        : (historyRes.data.results || [])
      setHistoryList(list)
    } catch (err) {
      console.error('Failed to load pricing engine', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setSimVehicle(activeVehicle)
  }, [activeVehicle])

  const liveConfig = liveConfigs[activeVehicle]
  const scheduledConfig = scheduledConfigs[activeVehicle]

  useEffect(() => {
    if (liveConfig) {
      setDraft(configToDraft(liveConfig))
      setDraftMeta({ id: liveConfig.id, effective_from: liveConfig.effective_from })
      setEffectiveDelay('existing')
      setCustomEffective(toDatetimeLocal(liveConfig.effective_from))
    } else {
      setDraft(emptyDraft(activeVehicle))
      setDraftMeta({ effective_from: new Date().toISOString() })
      setEffectiveDelay('now')
      setCustomEffective(toDatetimeLocal(new Date().toISOString()))
    }
  }, [activeVehicle, liveConfig])

  const liveDraft = liveConfig ? configToDraft(liveConfig) : null
  const isDraftDirty = draft && liveDraft ? !draftsEqual(draft, liveDraft) : !!draft && !liveConfig
  const isNewConfig = !liveConfig

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await api.patch('/pricing/settings/', settings)
      await fetchData()
    } catch {
      alert('Failed to update global settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!draft) return
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
        await api.patch(`/pricing/config/${draftMeta.id}/`, payload)
      } else {
        await api.post('/pricing/config/', payload)
      }
      await fetchData()
      setSimMode('live')
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } }
      const msg = (e.response?.data?.effective_from as string[])?.[0]
        || (e.response?.data?.error as { message?: string })?.message
        || 'Failed to save configuration.'
      alert(`Error: ${msg}`)
    } finally {
      setSavingConfig(false)
    }
  }

  const runSimulation = async () => {
    setSimulating(true)
    try {
      const liveRes = await api.post('/pricing/estimate/', {
        vehicle_type: simVehicle,
        distance_km: simDistance,
        surge_multiplier: simSurge,
      })
      setLiveResult(liveRes.data)

      const vehicleDraft = simVehicle === activeVehicle && draft
        ? draft
        : liveConfigs[simVehicle]
          ? configToDraft(liveConfigs[simVehicle])
          : emptyDraft(simVehicle)

      const localDraft = calculateFare(
        simVehicle,
        simDistance,
        simSurge,
        settings,
        vehicleDraft,
        'draft_preview',
      )
      setDraftResult(localDraft)
    } catch {
      alert('Simulation failed.')
    } finally {
      setSimulating(false)
    }
  }

  const simResult = simMode === 'draft' ? draftResult : liveResult
  const simMismatch = useMemo(() => {
    if (!liveResult || !draftResult) return false
    return Math.abs(liveResult.total_fare - draftResult.total_fare) > 0.01
  }, [liveResult, draftResult])

  if (loading) {
    return (
      <div style={{ ...campusPanel.shell, alignItems: 'center', justifyContent: 'center', color: T.textMuted }}>
        <Activity size={32} />
        <p style={{ marginTop: 16 }}>Loading pricing engine…</p>
      </div>
    )
  }

  return (
    <div style={campusPanel.shell}>
      <div style={{ ...campusPanel.scrollMain, ...campusPanel.thinScroll }}>
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
            onSave={handleSaveConfig}
            onRevert={() => {
              if (liveConfig) {
                setDraft(configToDraft(liveConfig))
                setEffectiveDelay('existing')
              } else {
                setDraft(emptyDraft(activeVehicle))
                setEffectiveDelay('now')
              }
            }}
          />
        )}
        {activeTab === 'simulation' && (
          <SimulationTab
            simDistance={simDistance}
            setSimDistance={setSimDistance}
            simVehicle={simVehicle}
            setSimVehicle={setSimVehicle}
            simSurge={simSurge}
            setSimSurge={setSimSurge}
            simMode={simMode}
            setSimMode={setSimMode}
            simResult={simResult}
            liveResult={liveResult}
            draftResult={draftResult}
            simMismatch={simMismatch}
            isDraftDirty={isDraftDirty}
            simulating={simulating}
            onRun={runSimulation}
            scheduledConfig={scheduledConfigs[simVehicle]}
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
            onRefresh={fetchData}
          />
        )}
      </div>
    </div>
  )
}

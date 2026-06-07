import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import apiService from '../../services/api.service'
import { T } from '../theme'

type TestRide = {
  id: string
  reference: string
  route: string
  departure_date: string
  window: string
  status: string
  vehicle_size: string
  passenger_count: number
  driver?: string | null
}

type TestSummary = {
  enabled: boolean
  campus?: string | null
  counts: {
    students: number
    drivers: number
    admins: number
    scheduled_rides: number
  }
  rides: TestRide[]
}

type ResultState = {
  title: string
  payload: unknown
  isError?: boolean
}

const readError = (error: unknown) => {
  const err = error as any
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.detail ||
    err?.message ||
    'The request failed.'
  )
}

const clampCount = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return 1
  return Math.min(500, Math.max(1, parsed))
}

export default function TestPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const area = searchParams.get('area') === 'rides' ? 'rides' : 'account'
  const defaultSection = area === 'rides' ? 'create' : 'student'
  const section = searchParams.get('section') || defaultSection
  const [counts, setCounts] = useState({
    student: '10',
    driver: '10',
    admin: '2',
    rides: '25',
    deleteRides: '5',
    join: '20',
  })
  const [selectedRideId, setSelectedRideId] = useState('')
  const [result, setResult] = useState<ResultState | null>(null)

  const summaryQuery = useQuery<TestSummary>({
    queryKey: ['test-tools-summary'],
    queryFn: () => apiService.getTestToolsSummary(),
    refetchOnWindowFocus: false,
  })

  const summary = summaryQuery.data
  const rides = summary?.rides || []
  const selectedRide = useMemo(
    () => rides.find((ride) => ride.id === selectedRideId) || rides[0],
    [rides, selectedRideId],
  )

  const switchSection = (nextSection: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('area', area)
    params.set('section', nextSection)
    setSearchParams(params)
  }

  const setArea = (nextArea: 'account' | 'rides') => {
    const params = new URLSearchParams()
    params.set('area', nextArea)
    params.set('section', nextArea === 'rides' ? 'create' : 'student')
    setSearchParams(params)
  }

  const runAction = useMutation({
    mutationFn: async (action: string) => {
      const actionMap: Record<string, () => Promise<unknown>> = {
        createStudents: () => apiService.createTestStudents(clampCount(counts.student)),
        deleteStudents: () => apiService.deleteTestStudents(clampCount(counts.student)),
        createDrivers: () => apiService.createTestDrivers(clampCount(counts.driver)),
        deleteDrivers: () => apiService.deleteTestDrivers(clampCount(counts.driver)),
        createAdmins: () => apiService.createTestAdmins(clampCount(counts.admin)),
        deleteAdmins: () => apiService.deleteTestAdmins(clampCount(counts.admin)),
        createRides: () => apiService.createTestScheduledRides(clampCount(counts.rides)),
        deleteRides: () => apiService.deleteTestScheduledRides(clampCount(counts.deleteRides)),
        joinRide: () => apiService.joinTestScheduledRide(selectedRide?.id || '', clampCount(counts.join)),
      }
      if (action === 'joinRide' && !selectedRide?.id) {
        throw new Error('Select or create a scheduled ride first.')
      }
      return actionMap[action]()
    },
    onSuccess: async (payload, action) => {
      setResult({ title: actionLabel(action), payload })
      await queryClient.invalidateQueries({ queryKey: ['test-tools-summary'] })
    },
    onError: (error, action) => {
      setResult({
        title: `${actionLabel(action)} failed`,
        payload: { message: readError(error), raw: (error as any)?.response?.data },
        isError: true,
      })
    },
  })

  const busy = runAction.isPending

  return (
    <div style={s.page}>
      <style>{'@keyframes test-spin { to { transform: rotate(360deg); } }'}</style>
      <div style={s.headerRow}>
        <div>
          <div style={s.kicker}>Test data lab</div>
          <h1 style={s.title}>Bulk app testing</h1>
        </div>
        <button style={s.iconButton} onClick={() => summaryQuery.refetch()} disabled={summaryQuery.isFetching}>
          {summaryQuery.isFetching ? <Loader2 size={16} style={s.spin} /> : <RefreshCcw size={16} />}
        </button>
      </div>

      <div style={s.areaTabs}>
        <button style={tabStyle(area === 'account')} onClick={() => setArea('account')}>Account</button>
        <button style={tabStyle(area === 'rides')} onClick={() => setArea('rides')}>Rides</button>
      </div>

      {summary && !summary.enabled && (
        <div style={s.warning}>
          <AlertTriangle size={17} />
          <span>Test tools are disabled on this backend.</span>
        </div>
      )}

      <div style={s.stats}>
        <Stat label="Campus" value={summary?.campus || 'Unavailable'} />
        <Stat label="Students" value={summary?.counts.students ?? 0} />
        <Stat label="Drivers" value={summary?.counts.drivers ?? 0} />
        <Stat label="Admins" value={summary?.counts.admins ?? 0} />
        <Stat label="Schedules" value={summary?.counts.scheduled_rides ?? 0} />
      </div>

      {area === 'account' ? (
        <>
          <div style={s.subTabs}>
            <button style={subTabStyle(section === 'student')} onClick={() => switchSection('student')}>Student</button>
            <button style={subTabStyle(section === 'driver')} onClick={() => switchSection('driver')}>Driver</button>
            <button style={subTabStyle(section === 'admin')} onClick={() => switchSection('admin')}>Admin</button>
          </div>
          {section === 'driver' ? (
            <ActionPanel
              icon={<ShieldCheck size={18} />}
              title="Drivers"
              count={counts.driver}
              setCount={(value) => setCounts((prev) => ({ ...prev, driver: value }))}
              primaryLabel="Create verified drivers"
              dangerLabel="Delete random drivers"
              onPrimary={() => runAction.mutate('createDrivers')}
              onDanger={() => runAction.mutate('deleteDrivers')}
              busy={busy}
            />
          ) : section === 'admin' ? (
            <ActionPanel
              icon={<UserCog size={18} />}
              title="Campus admins"
              count={counts.admin}
              setCount={(value) => setCounts((prev) => ({ ...prev, admin: value }))}
              primaryLabel="Create admins"
              dangerLabel="Delete random admins"
              onPrimary={() => runAction.mutate('createAdmins')}
              onDanger={() => runAction.mutate('deleteAdmins')}
              busy={busy}
            />
          ) : (
            <ActionPanel
              icon={<Users size={18} />}
              title="Students"
              count={counts.student}
              setCount={(value) => setCounts((prev) => ({ ...prev, student: value }))}
              primaryLabel="Create students"
              dangerLabel="Delete random students"
              onPrimary={() => runAction.mutate('createStudents')}
              onDanger={() => runAction.mutate('deleteStudents')}
              busy={busy}
            />
          )}
        </>
      ) : (
        <>
          <div style={s.subTabs}>
            <button style={subTabStyle(section === 'create')} onClick={() => switchSection('create')}>Create</button>
            <button style={subTabStyle(section === 'join')} onClick={() => switchSection('join')}>Join</button>
            <button style={subTabStyle(section === 'verify')} onClick={() => switchSection('verify')}>Verify</button>
          </div>
          {section === 'join' ? (
            <section style={s.panel}>
              <PanelTitle icon={<UserPlus size={18} />} title="Join scheduled ride" />
              <div style={s.formGrid}>
                <label style={s.field}>
                  <span style={s.label}>Ride</span>
                  <select
                    style={s.select}
                    value={selectedRide?.id || ''}
                    onChange={(event) => setSelectedRideId(event.target.value)}
                  >
                    {rides.map((ride) => (
                      <option key={ride.id} value={ride.id}>
                        {ride.reference} - {ride.route}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label="Students"
                  value={counts.join}
                  onChange={(value) => setCounts((prev) => ({ ...prev, join: value }))}
                />
              </div>
              <button style={s.primaryButton} onClick={() => runAction.mutate('joinRide')} disabled={busy || !selectedRide}>
                {busy ? <Loader2 size={15} style={s.spin} /> : <UserPlus size={15} />}
                <span>Join students</span>
              </button>
            </section>
          ) : section === 'verify' ? (
            <section style={s.panel}>
              <PanelTitle icon={<CheckCircle2 size={18} />} title="Generated ride records" />
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Ref</th>
                      <th style={s.th}>Route</th>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Vehicle</th>
                      <th style={s.th}>Passengers</th>
                      <th style={s.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rides.map((ride) => (
                      <tr key={ride.id}>
                        <td style={s.td}>{ride.reference}</td>
                        <td style={s.td}>{ride.route}</td>
                        <td style={s.td}>{ride.departure_date} {ride.window}</td>
                        <td style={s.td}>{ride.vehicle_size}</td>
                        <td style={s.td}>{ride.passenger_count}</td>
                        <td style={s.td}>{ride.status}</td>
                      </tr>
                    ))}
                    {!rides.length && (
                      <tr>
                        <td style={s.emptyCell} colSpan={6}>No generated scheduled rides yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section style={s.panel}>
              <PanelTitle icon={<Bus size={18} />} title="Scheduled rides" />
              <div style={s.formGrid}>
                <NumberField
                  label="Create"
                  value={counts.rides}
                  onChange={(value) => setCounts((prev) => ({ ...prev, rides: value }))}
                />
                <NumberField
                  label="Delete"
                  value={counts.deleteRides}
                  onChange={(value) => setCounts((prev) => ({ ...prev, deleteRides: value }))}
                />
              </div>
              <div style={s.buttonRow}>
                <button style={s.primaryButton} onClick={() => runAction.mutate('createRides')} disabled={busy}>
                  {busy ? <Loader2 size={15} style={s.spin} /> : <Bus size={15} />}
                  <span>Create ride schedules</span>
                </button>
                <button style={s.dangerButton} onClick={() => runAction.mutate('deleteRides')} disabled={busy}>
                  <Trash2 size={15} />
                  <span>Delete random schedules</span>
                </button>
              </div>
            </section>
          )}
        </>
      )}

      <section style={{ ...s.panel, ...s.console }}>
        <div style={s.consoleHeader}>
          <span>{result?.title || 'Result'}</span>
          {result?.isError && <AlertTriangle size={15} color={T.error} />}
        </div>
        <pre style={s.pre}>{result ? JSON.stringify(result.payload, null, 2) : 'Run an action to see response details.'}</pre>
      </section>
    </div>
  )
}

function actionLabel(action: string) {
  return ({
    createStudents: 'Create students',
    deleteStudents: 'Delete students',
    createDrivers: 'Create drivers',
    deleteDrivers: 'Delete drivers',
    createAdmins: 'Create admins',
    deleteAdmins: 'Delete admins',
    createRides: 'Create scheduled rides',
    deleteRides: 'Delete scheduled rides',
    joinRide: 'Join scheduled ride',
  } as Record<string, string>)[action] || 'Test action'
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={s.stat}>
      <span style={s.statLabel}>{label}</span>
      <strong style={s.statValue}>{value}</strong>
    </div>
  )
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div style={s.panelTitle}>
      <span style={s.panelIcon}>{icon}</span>
      <h2 style={s.panelHeading}>{title}</h2>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={s.field}>
      <span style={s.label}>{label}</span>
      <input
        style={s.input}
        type="number"
        min={1}
        max={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ActionPanel({
  icon,
  title,
  count,
  setCount,
  primaryLabel,
  dangerLabel,
  onPrimary,
  onDanger,
  busy,
}: {
  icon: ReactNode
  title: string
  count: string
  setCount: (value: string) => void
  primaryLabel: string
  dangerLabel: string
  onPrimary: () => void
  onDanger: () => void
  busy: boolean
}) {
  return (
    <section style={s.panel}>
      <PanelTitle icon={icon} title={title} />
      <div style={s.formGrid}>
        <NumberField label="Total" value={count} onChange={setCount} />
      </div>
      <div style={s.buttonRow}>
        <button style={s.primaryButton} onClick={onPrimary} disabled={busy}>
          {busy ? <Loader2 size={15} style={s.spin} /> : <UserPlus size={15} />}
          <span>{primaryLabel}</span>
        </button>
        <button style={s.dangerButton} onClick={onDanger} disabled={busy}>
          <Trash2 size={15} />
          <span>{dangerLabel}</span>
        </button>
      </div>
    </section>
  )
}

const tabStyle = (active: boolean): CSSProperties => ({
  ...s.areaTab,
  color: active ? T.accent : T.textSecondary,
  background: active ? T.accentBg : 'transparent',
  borderColor: active ? 'rgba(59, 130, 246, 0.28)' : T.border,
})

const subTabStyle = (active: boolean): CSSProperties => ({
  ...s.subTab,
  color: active ? T.textWhite : T.textSecondary,
  background: active ? T.bgCardHover : 'transparent',
  borderColor: active ? T.borderLight : 'transparent',
})

const s: Record<string, CSSProperties> = {
  page: {
    padding: 24,
    maxWidth: 1180,
    width: '100%',
    margin: '0 auto',
    color: T.textPrimary,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  kicker: { fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800 },
  title: { margin: '4px 0 0', fontSize: 24, color: T.textWhite, letterSpacing: 0, lineHeight: 1.15 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    border: `1px solid ${T.border}`,
    background: T.bgCard,
    color: T.textSecondary,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  areaTabs: { display: 'flex', gap: 8, marginTop: 18 },
  areaTab: {
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 800,
    fontFamily: T.fontFamily,
    cursor: 'pointer',
  },
  subTabs: {
    display: 'flex',
    gap: 6,
    marginTop: 18,
    borderBottom: `1px solid ${T.border}`,
    paddingBottom: 8,
  },
  subTab: {
    border: '1px solid transparent',
    borderRadius: 6,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 800,
    fontFamily: T.fontFamily,
    cursor: 'pointer',
  },
  warning: {
    marginTop: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: `1px solid ${T.warn}55`,
    background: `${T.warn}18`,
    color: T.warn,
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 700,
  },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, marginTop: 18 },
  stat: { border: `1px solid ${T.border}`, background: T.bgCard, borderRadius: 8, padding: 12, minWidth: 0 },
  statLabel: { display: 'block', color: T.textMuted, fontSize: 11, fontWeight: 700 },
  statValue: { display: 'block', color: T.textWhite, fontSize: 18, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  panel: {
    marginTop: 16,
    border: `1px solid ${T.border}`,
    background: T.bgCard,
    borderRadius: 8,
    padding: 16,
  },
  panelTitle: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  panelIcon: { color: T.accent, display: 'inline-flex' },
  panelHeading: { margin: 0, fontSize: 16, color: T.textWhite, letterSpacing: 0 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 12, maxWidth: 720 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: T.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    height: 38,
    borderRadius: 6,
    border: `1px solid ${T.border}`,
    background: T.bgInput,
    color: T.textWhite,
    padding: '0 10px',
    fontSize: 14,
    fontFamily: T.fontFamily,
  },
  select: {
    height: 38,
    borderRadius: 6,
    border: `1px solid ${T.border}`,
    background: T.bgInput,
    color: T.textWhite,
    padding: '0 10px',
    fontSize: 13,
    fontFamily: T.fontFamily,
  },
  buttonRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  primaryButton: {
    height: 36,
    border: 'none',
    borderRadius: 6,
    background: T.accent,
    color: '#ffffff',
    padding: '0 13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontWeight: 800,
    fontSize: 12,
    fontFamily: T.fontFamily,
    cursor: 'pointer',
    marginTop: 14,
  },
  dangerButton: {
    height: 36,
    border: `1px solid ${T.error}55`,
    borderRadius: 6,
    background: `${T.error}16`,
    color: T.error,
    padding: '0 13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontWeight: 800,
    fontSize: 12,
    fontFamily: T.fontFamily,
    cursor: 'pointer',
  },
  tableWrap: { overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 760 },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.textMuted, borderBottom: `1px solid ${T.border}` },
  td: { padding: '10px 12px', fontSize: 12, color: T.textSecondary, borderBottom: `1px solid ${T.border}` },
  emptyCell: { padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 13 },
  console: { marginBottom: 24 },
  consoleHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: T.textWhite, fontWeight: 800, fontSize: 13, marginBottom: 10 },
  pre: {
    margin: 0,
    maxHeight: 260,
    overflow: 'auto',
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: 12,
    color: T.textSecondary,
    fontSize: 12,
    lineHeight: 1.5,
  },
  spin: { animation: 'test-spin 0.8s linear infinite' },
}

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
import { campusPanel } from '../shared/campusPanelStyles'

type TestRide = {
  id: string
  reference: string
  route: string
  departure_date?: string
  window?: string
  status: string
  vehicle_size?: string
  vehicle_type?: string
  passenger_count: number
  driver?: string | null
  student?: string
}

type TestSummary = {
  enabled: boolean
  campus?: string | null
  counts: {
    students: number
    drivers: number
    admins: number
    scheduled_rides: number
    ondemand_rides: number
  }
  rides: TestRide[]
  ondemand_rides: TestRide[]
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
  return Math.min(2000, Math.max(1, parsed))
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
    ondemandRides: '10',
    deleteOnDemand: '5',
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
  const ondemandRides = summary?.ondemand_rides || []
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
        createOnDemand: () => apiService.createTestOnDemandRides(clampCount(counts.ondemandRides)),
        deleteOnDemand: () => apiService.deleteTestOnDemandRides(clampCount(counts.deleteOnDemand)),
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
    <div style={campusPanel.shell}>
      <style>{'@keyframes test-spin { to { transform: rotate(360deg); } }'}</style>
      
      <div style={{ ...campusPanel.toolbar, justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Test data lab</div>
            <h1 style={{ fontSize: 16, color: T.textPrimary, margin: 0, fontWeight: 700 }}>Bulk app testing</h1>
          </div>
          <div style={{ width: 1, height: 24, background: T.border, margin: '0 4px' }} />
          <div style={s.areaTabs}>
            <button style={tabStyle(area === 'account')} onClick={() => setArea('account')}>Account</button>
            <button style={tabStyle(area === 'rides')} onClick={() => setArea('rides')}>Rides</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {summary && !summary.enabled && (
            <div style={s.warning}>
              <AlertTriangle size={14} />
              <span>Test tools are disabled on this backend.</span>
            </div>
          )}
          <button style={campusPanel.btnSecondary} onClick={() => summaryQuery.refetch()} disabled={summaryQuery.isFetching}>
            {summaryQuery.isFetching ? <Loader2 size={13} style={s.spin} /> : <RefreshCcw size={13} />}
            Refresh
          </button>
        </div>
      </div>

      <div style={{ ...campusPanel.scrollMain, ...campusPanel.thinScroll, padding: 16 }}>
        <div style={s.contentGrid}>
          <div style={s.contentCol}>
            
            <div style={s.stats}>
              <Stat label="Campus" value={summary?.campus || 'Unavailable'} />
              <Stat label="Students" value={summary?.counts.students ?? 0} />
              <Stat label="Drivers" value={summary?.counts.drivers ?? 0} />
              <Stat label="Admins" value={summary?.counts.admins ?? 0} />
              <Stat label="Schedules" value={summary?.counts.scheduled_rides ?? 0} />
              <Stat label="On-Demand" value={summary?.counts.ondemand_rides ?? 0} />
            </div>

            <div style={campusPanel.card}>
              {area === 'account' ? (
                <>
                  <div style={s.subTabs}>
                    <button style={subTabStyle(section === 'student')} onClick={() => switchSection('student')}>Student</button>
                    <button style={subTabStyle(section === 'driver')} onClick={() => switchSection('driver')}>Driver</button>
                  </div>
                  {section === 'driver' ? (
                    <ActionPanel
                      icon={<ShieldCheck size={16} />}
                      title="Drivers"
                      count={counts.driver}
                      setCount={(value) => setCounts((prev) => ({ ...prev, driver: value }))}
                      primaryLabel="Create verified drivers"
                      dangerLabel="Delete random drivers"
                      onPrimary={() => runAction.mutate('createDrivers')}
                      onDanger={() => runAction.mutate('deleteDrivers')}
                      busy={busy}
                    />
                  ) : (
                    <ActionPanel
                      icon={<Users size={16} />}
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
                    <button style={subTabStyle(section === 'create')} onClick={() => switchSection('create')}>Scheduled</button>
                    <button style={subTabStyle(section === 'on-demand')} onClick={() => switchSection('on-demand')}>On-Demand</button>
                    <button style={subTabStyle(section === 'join')} onClick={() => switchSection('join')}>Join</button>
                    <button style={subTabStyle(section === 'verify')} onClick={() => switchSection('verify')}>Verify</button>
                  </div>
                  {section === 'on-demand' ? (
                    <div style={campusPanel.cardBody}>
                      <PanelTitle icon={<Bus size={16} />} title="On-Demand Requests" />
                      <div style={s.formGrid}>
                        <NumberField
                          label="Create"
                          value={counts.ondemandRides}
                          onChange={(value) => setCounts((prev) => ({ ...prev, ondemandRides: value }))}
                        />
                        <NumberField
                          label="Delete"
                          value={counts.deleteOnDemand}
                          onChange={(value) => setCounts((prev) => ({ ...prev, deleteOnDemand: value }))}
                        />
                      </div>
                      <div style={s.buttonRow}>
                        <button style={campusPanel.btnPrimary} onClick={() => runAction.mutate('createOnDemand')} disabled={busy}>
                          {busy ? <Loader2 size={13} style={s.spin} /> : <Bus size={13} />}
                          Create available requests
                        </button>
                        <button style={s.dangerButton} onClick={() => runAction.mutate('deleteOnDemand')} disabled={busy}>
                          <Trash2 size={13} />
                          Delete random requests
                        </button>
                      </div>
                    </div>
                  ) : section === 'join' ? (
                    <div style={campusPanel.cardBody}>
                      <PanelTitle icon={<UserPlus size={16} />} title="Join scheduled ride" />
                      <div style={s.formGrid}>
                        <label style={s.field}>
                          <span style={s.label}>Ride</span>
                          <select
                            style={s.input}
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
                      <div style={s.buttonRow}>
                        <button style={campusPanel.btnPrimary} onClick={() => runAction.mutate('joinRide')} disabled={busy || !selectedRide}>
                          {busy ? <Loader2 size={13} style={s.spin} /> : <UserPlus size={13} />}
                          Join students
                        </button>
                      </div>
                    </div>
                  ) : section === 'verify' ? (
                    <div style={{ ...campusPanel.cardBody, padding: 0 }}>
                      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
                        <PanelTitle icon={<CheckCircle2 size={16} />} title="Generated ride records" />
                      </div>
                      <div style={{ overflowX: 'auto' }}>
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

                      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, borderTop: `1px solid ${T.border}` }}>
                        <PanelTitle icon={<CheckCircle2 size={16} />} title="Generated on-demand records" />
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={s.table}>
                          <thead>
                            <tr>
                              <th style={s.th}>Ref</th>
                              <th style={s.th}>Route</th>
                              <th style={s.th}>Student</th>
                              <th style={s.th}>Vehicle</th>
                              <th style={s.th}>Passengers</th>
                              <th style={s.th}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ondemandRides.map((ride) => (
                              <tr key={ride.id}>
                                <td style={s.td}>{ride.reference}</td>
                                <td style={s.td}>{ride.route}</td>
                                <td style={s.td}>{ride.student}</td>
                                <td style={s.td}>{ride.vehicle_type}</td>
                                <td style={s.td}>{ride.passenger_count}</td>
                                <td style={s.td}>{ride.status}</td>
                              </tr>
                            ))}
                            {!ondemandRides.length && (
                              <tr>
                                <td style={s.emptyCell} colSpan={6}>No generated on-demand rides yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={campusPanel.cardBody}>
                      <PanelTitle icon={<Bus size={16} />} title="Scheduled rides" />
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
                        <button style={campusPanel.btnPrimary} onClick={() => runAction.mutate('createRides')} disabled={busy}>
                          {busy ? <Loader2 size={13} style={s.spin} /> : <Bus size={13} />}
                          Create ride schedules
                        </button>
                        <button style={s.dangerButton} onClick={() => runAction.mutate('deleteRides')} disabled={busy}>
                          <Trash2 size={13} />
                          Delete random schedules
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <aside style={s.sidebar}>
            <div style={campusPanel.card}>
              <div style={s.consoleHeader}>
                <span style={campusPanel.cardTitle}>{result?.title || 'Console Output'}</span>
                {result?.isError && <AlertTriangle size={15} color={T.error} />}
              </div>
              <div style={{ padding: 12, background: T.bgInput }}>
                <pre style={s.pre}>{result ? JSON.stringify(result.payload, null, 2) : 'Run an action to see response details.'}</pre>
              </div>
            </div>
          </aside>
        </div>
      </div>
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
    createOnDemand: 'Create on-demand rides',
    deleteOnDemand: 'Delete on-demand rides',
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
        max={2000}
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
    <div style={campusPanel.cardBody}>
      <PanelTitle icon={icon} title={title} />
      <div style={s.formGrid}>
        <NumberField label="Total" value={count} onChange={setCount} />
      </div>
      <div style={s.buttonRow}>
        <button style={campusPanel.btnPrimary} onClick={onPrimary} disabled={busy}>
          {busy ? <Loader2 size={13} style={s.spin} /> : <UserPlus size={13} />}
          {primaryLabel}
        </button>
        <button style={s.dangerButton} onClick={onDanger} disabled={busy}>
          <Trash2 size={13} />
          {dangerLabel}
        </button>
      </div>
    </div>
  )
}

const tabStyle = (active: boolean): CSSProperties => ({
  border: 'none',
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: T.fontFamily,
  cursor: 'pointer',
  color: active ? T.textPrimary : T.textSecondary,
  background: active ? T.bgCard : 'transparent',
  boxShadow: active ? `0 0 0 1px ${T.border}` : 'none',
  borderRadius: 0,
})

const subTabStyle = (active: boolean): CSSProperties => ({
  border: 'none',
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: T.fontFamily,
  cursor: 'pointer',
  color: active ? T.textPrimary : T.textMuted,
  background: 'transparent',
  borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
  marginBottom: -1,
})

const s: Record<string, CSSProperties> = {
  contentGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 16, alignItems: 'start', maxWidth: 1600, margin: '0 auto' },
  contentCol: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  sidebar: { position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 16 },
  
  areaTabs: { display: 'flex', gap: 4, background: T.bgInput, padding: 4 },
  
  subTabs: {
    display: 'flex',
    borderBottom: `1px solid ${T.border}`,
    background: T.bgPanel,
  },
  
  warning: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: T.warn,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    padding: '4px 8px',
    background: 'rgba(234, 179, 8, 0.1)',
    border: '1px solid rgba(234, 179, 8, 0.2)',
  },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 16 },
  stat: { border: `1px solid ${T.border}`, background: T.bgPanel, padding: '12px 16px', minWidth: 0 },
  statLabel: { display: 'block', color: T.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { display: 'block', color: T.textPrimary, fontSize: 16, fontWeight: 700, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  
  panelTitle: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  panelIcon: { color: T.textMuted, display: 'inline-flex' },
  panelHeading: { margin: 0, fontSize: 14, fontWeight: 700, color: T.textPrimary, letterSpacing: 0 },
  
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 16, maxWidth: 480 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: T.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.textPrimary,
    borderRadius: 0,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: T.fontFamily,
    boxSizing: 'border-box',
  },
  
  buttonRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, flexWrap: 'wrap' },
  dangerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid rgba(239, 68, 68, 0.3)`,
    background: 'rgba(239, 68, 68, 0.05)',
    color: T.error,
    cursor: 'pointer',
    padding: '6px 14px',
    borderRadius: 0,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: T.fontFamily,
  },
  
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 760 },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', borderBottom: `1px solid ${T.border}` },
  td: { padding: '12px 16px', fontSize: 12, color: T.textPrimary, borderBottom: `1px solid ${T.border}` },
  emptyCell: { padding: 32, textAlign: 'center', color: T.textMuted, fontSize: 13 },
  
  consoleHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}` },
  pre: {
    margin: 0,
    maxHeight: 'calc(100vh - 160px)',
    overflow: 'auto',
    color: T.textSecondary,
    fontSize: 11,
    lineHeight: 1.5,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  spin: { animation: 'test-spin 0.8s linear infinite' },
}

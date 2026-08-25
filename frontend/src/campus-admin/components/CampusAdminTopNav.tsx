import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarClock, BarChart3, Settings,
  LogOut, User as UserIcon,
  Download, Megaphone, UserPlus,
  ArrowLeft, ChevronRight, History, ShieldAlert, UserX,
  Radio, Crosshair, Activity, Zap, Route, Monitor, Bell, Sliders, ShieldCheck,
  Wrench, Ticket, Plug, Flag, LifeBuoy, Banknote, Calculator, FlaskConical, Map, FolderOpen, Smartphone, Car
} from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import toast from 'react-hot-toast'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'
import { getRefreshToken } from '../../core/tokenStorage'
import { T, useCampusThemeStore } from '../theme'
import { useDispatchStore } from '../dispatchStore'
import { useSettingsStore } from '../settingsStore'
import { useAnalyticsStore } from '../analyticsStore'
import { type FinancialTab, useFinancialStore } from '../financialStore'
import { ENGINE_NAV_ITEMS, useEngineStore } from '../engineStore'
import { type OperationsTab, useOperationsStore } from '../operationsStore'
import { useDocsStore } from '../docsStore'

const OPERATIONS_NAV_ITEMS: Array<{ label: string; tab: OperationsTab }> = [
  { label: 'DEPARTURES', tab: 'departures' },
  { label: 'ROUTES', tab: 'routes' },
  { label: 'FLEET', tab: 'fleet' },
  { label: 'PASSENGERS', tab: 'passengers' },
  { label: 'LOG', tab: 'log' },
]

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Operations Hub', icon: Radio, path: '/operations' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Finance', icon: Banknote, path: '/financial' },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

const FINANCIAL_NAV_ITEMS: Array<{ label: string; tab: FinancialTab }> = [
  { label: 'OVERVIEW', tab: 'overview' },
  { label: 'TRANSACTIONS', tab: 'transactions' },
  { label: 'REPORTS', tab: 'reports' },
  { label: 'PAYOUTS', tab: 'payouts' },
]

export default function CampusAdminTopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { clearAuth } = useAuthStore()
  const { setMode } = useCampusThemeStore()

  // Permanently lock to dark mode
  React.useEffect(() => { setMode('dark') }, [])

  const { activeTab: dispatchTab, setActiveTab: setDispatchTab, wsConnected, showTraffic, setShowTraffic, showHeat, setShowHeat, showRoutes, setShowRoutes, mapLayerConfig, applyMapLayerConfig } = useDispatchStore()
  const { activeTab: settingsTab, setActiveTab: setSettingsTab } = useSettingsStore()
  const { activeTab: analyticsTab, setActiveTab: setAnalyticsTab } = useAnalyticsStore()
  const { activeTab: financeTab, setActiveTab: setFinanceTab } = useFinancialStore()
  const { activeTab: engineTab, setActiveTab: setEngineTab } = useEngineStore()
  const { activeTab: operationsTab, setActiveTab: setOperationsTab } = useOperationsStore()
  const { activeTab: docsTab, setActiveTab: setDocsTab } = useDocsStore()

  // Live unread notification count
  const { data: unreadData } = useQuery<{ unread_count: number }>({
    queryKey: ['notif-unread-count'],
    queryFn: () => api.get('/notifications/unread-count/').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const unreadCount = unreadData?.unread_count ?? 0

  const verifyMatch = location.pathname.match(/\/users\/(.*)\/verify/)
  const verifyDriverId = verifyMatch ? verifyMatch[1] : null
  const searchParams = new URLSearchParams(location.search)
  const activeTab = searchParams.get('tab') || 'personal'
  const isOpenRequestsPanel = location.pathname === '/' && searchParams.get('panel') === 'open'
  const testAreaMatch = searchParams.get('area')
  const testArea = testAreaMatch === 'rides' ? 'rides' : testAreaMatch === 'map' ? 'map' : testAreaMatch === 'calibration' ? 'calibration' : 'account'

  const dashboardNavItems = NAV_ITEMS.filter((item) => item.path === '/')

  const toggleOpenRequestsPanel = () => {
    const params = new URLSearchParams(location.search)
    if (params.get('panel') === 'open') {
      params.delete('panel')
    } else {
      params.set('panel', 'open')
    }
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' })
  }

  const setTestArea = (area: 'account' | 'rides' | 'map' | 'calibration') => {
    const params = new URLSearchParams()
    params.set('area', area)
    params.set('section', area === 'rides' ? 'create' : (area === 'map' || area === 'calibration') ? 'manage' : 'student')
    navigate({ pathname: location.pathname, search: `?${params.toString()}` })
  }

  const { data: unifiedDetail } = useQuery<any>({
    queryKey: ['admin-unified-detail', verifyDriverId],
    enabled: !!verifyDriverId,
    staleTime: 0,
  })

  const isVehicleDoc = !['personal', 'nin'].includes(activeTab)
  const currentDoc = unifiedDetail?.vehicle_documents?.find((d: any) => d.document_type === activeTab)
  
  const displayStatus = isVehicleDoc 
    ? currentDoc?.status
    : unifiedDetail?.account_verification?.status

  const isApproved = displayStatus === 'approved'

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refresh = getRefreshToken()
      if (refresh) await api.post('/auth/logout/', { refresh })
    },
    onSettled: () => {
      clearAuth()
      navigate('/login')
    },
  })

  const handleLiveFleetClick = () => {
    toast('Live Fleet is temporarily unavailable right now.')
  }

  return (
    <header style={s.topBar}>
      <div style={s.topLeft}>
        {location.pathname === '/users' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3 }}>
              User Management
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Central hub for all student and driver administration.
            </div>
          </div>
        ) : location.pathname === '/users/verification' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/users')} style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent', padding: 0 }}>
              <ArrowLeft size={16} />
              <span style={{ fontSize: 14 }}>Back</span>
            </button>
            <div style={{ width: 1, height: 24, background: T.borderLight }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMuted, fontSize: 13 }}>
              <span>User Management</span>
              <ChevronRight size={14} />
              <span>Applications</span>
              <ChevronRight size={14} />
              <span style={{ color: T.textWhite }}>Vehicle Verification</span>
            </div>
          </div>
        ) : location.pathname === '/users/account-verification' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/users')} style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent', padding: 0 }}>
              <ArrowLeft size={16} />
              <span style={{ fontSize: 14 }}>Back</span>
            </button>
            <div style={{ width: 1, height: 24, background: T.borderLight }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMuted, fontSize: 13 }}>
              <span>User Management</span>
              <ChevronRight size={14} />
              <span>Applications</span>
              <ChevronRight size={14} />
              <span style={{ color: T.textWhite }}>Account Verification</span>
            </div>
          </div>
        ) : location.pathname.match(/\/users\/.*\/verify/) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/users')} style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent', padding: 0 }}>
              <ArrowLeft size={16} />
              <span style={{ fontSize: 14 }}>Back</span>
            </button>
            <div style={{ width: 1, height: 24, background: T.borderLight }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textMuted, fontSize: 13 }}>
              <span>User Management</span>
              <ChevronRight size={14} />
              <span>Applications</span>
              <ChevronRight size={14} />
              <span style={{ color: T.textWhite }}>Driver Status</span>
            </div>
          </div>
        ) : location.pathname === '/dispatch' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3, display: 'flex', alignItems: 'center' }}>
              <Radio size={16} color={wsConnected ? T.heatTeal : T.warn} style={{ marginRight: 8 }} />
              Dispatch Control Center
              <span style={{ fontSize: 9, marginLeft: 10, color: wsConnected ? T.heatTeal : T.warn, border: `1px solid ${wsConnected ? 'rgba(20,184,166,0.4)' : 'rgba(245,158,11,0.4)'}`, borderRadius: 999, padding: '2px 8px', fontWeight: 700, textTransform: 'uppercase' }}>
                {wsConnected ? 'Live' : 'Connecting'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Fleet visibility, ride queue, and incident response
            </div>
          </div>
        ) : location.pathname === '/settings' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3, display: 'flex', alignItems: 'center' }}>
              <Settings size={16} color={T.accent} style={{ marginRight: 8 }} />
              System Configuration
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Manage accounts, display preferences, and global settings
            </div>
          </div>
        ) : location.pathname === '/analytics' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3, display: 'flex', alignItems: 'center' }}>
              <BarChart3 size={16} color={T.accent} style={{ marginRight: 8 }} />
              Analytics & Insights
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Monitor system performance and operational intelligence
            </div>
          </div>
        ) : location.pathname === '/financial' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3, display: 'flex', alignItems: 'center' }}>
              <Banknote size={16} color={T.accent} style={{ marginRight: 8 }} />
              Financial Management
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Platform treasury — revenue, ledger, reports, and payouts
            </div>
          </div>
        ) : location.pathname === '/operations' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3, display: 'flex', alignItems: 'center' }}>
              <Radio size={16} color={T.accent} style={{ marginRight: 8 }} />
              Operations Hub
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Manage fleet departures, routes, and passenger assignments
            </div>
          </div>
        ) : location.pathname === '/engine' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3, display: 'flex', alignItems: 'center' }}>
              <Calculator size={16} color={T.accent} style={{ marginRight: 8 }} />
              Pricing Engine
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Tariffs, simulation, and platform fare rules
            </div>
          </div>
        ) : location.pathname === '/test' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3, display: 'flex', alignItems: 'center' }}>
              <FlaskConical size={16} color={T.accent} style={{ marginRight: 8 }} />
              Test Lab
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Bulk account and ride data tools
            </div>
          </div>
        ) : location.pathname === '/docs' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3 }}>Documentation</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Technical architecture and workflows
            </div>
          </div>
        ) : location.pathname === '/notifications' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3, display: 'flex', alignItems: 'center' }}>
              <Bell size={16} color={T.accent} style={{ marginRight: 8 }} />
              Notification Center
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              System alerts, broadcasts, and activity feed
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textWhite, letterSpacing: -0.3 }}>
              FUTMRIDE Control Center
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
              Regulated ride operations and dispatch
            </div>
          </div>
        )}
      </div>

      {location.pathname === '/users' ? (
        <nav style={s.topNav}>
          <button style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}>
            <Download size={13} strokeWidth={1.8} />
            <span>Export User Data</span>
          </button>
          <button style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}>
            <Megaphone size={13} strokeWidth={1.8} />
            <span>Broadcast Notification</span>
          </button>
          <button style={{ ...s.topNavBtn, color: T.accent, background: T.accentBg }}>
            <UserPlus size={13} strokeWidth={1.8} />
            <span>Add New User</span>
          </button>
        </nav>
      ) : location.pathname === '/users/verification' || location.pathname === '/users/account-verification' ? (
        <nav style={s.topNav}>
          <button style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}>
            <History size={13} strokeWidth={1.8} />
            <span>Audit Log</span>
          </button>
        </nav>
      ) : verifyMatch ? (
        <nav style={s.topNav}>
          {isApproved && (
            <button 
              style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                if (params.get('revoke') === 'true') params.delete('revoke');
                else params.set('revoke', 'true');
                navigate(`${location.pathname}?${params.toString()}`);
              }}
              title="Revoke Verification"
            >
              <UserX size={16} />
            </button>
          )}
        </nav>
      ) : location.pathname === '/dispatch' ? (
        <nav style={s.topNav}>
          <button style={{ ...s.topNavBtn, color: dispatchTab === 'route_ops' ? T.accent : T.textSecondary, background: dispatchTab === 'route_ops' ? T.accentBg : 'transparent' }} onClick={() => setDispatchTab('route_ops')}>
            <CalendarClock size={13} strokeWidth={1.8} />
            <span>Route Ops</span>
          </button>
          <button
            style={{
              ...s.topNavBtn,
              color: T.textMuted,
              background: 'transparent',
              opacity: 0.8,
            }}
            onClick={handleLiveFleetClick}
            title="Live Fleet is temporarily unavailable"
          >
            <Radio size={13} strokeWidth={1.8} />
            <span>Live Fleet</span>
          </button>
          {dispatchTab === 'live_fleet' && (
            <>
              <button style={{ ...s.topNavBtn, color: showTraffic ? T.heatTeal : T.textSecondary, background: showTraffic ? `${T.heatTeal}15` : 'transparent' }} onClick={() => setShowTraffic(p => !p)}>
                <Activity size={13} strokeWidth={1.8} />
                <span>Traffic</span>
              </button>
              <button style={{ ...s.topNavBtn, color: showHeat ? T.accent : T.textSecondary, background: showHeat ? T.accentBg : 'transparent' }} onClick={() => setShowHeat(p => !p)}>
                <Zap size={13} strokeWidth={1.8} />
                <span>Heat</span>
              </button>
              <button style={{ ...s.topNavBtn, color: showRoutes ? T.warn : T.textSecondary, background: showRoutes ? `${T.warn}15` : 'transparent' }} onClick={() => setShowRoutes(p => !p)}>
                <Route size={13} strokeWidth={1.8} />
                <span>Routes</span>
              </button>
              <div style={{ width: 1, height: 16, background: T.border, margin: '0 8px' }} />
              <select
                value={mapLayerConfig.default_map_type || 'hybrid'}
                onChange={e => {
                  const next = e.target.value as 'roadmap' | 'hybrid'
                  applyMapLayerConfig({ default_map_type: next })
                  localStorage.setItem('lr_ride_default_map_type', next)
                }}
                style={{ ...s.topNavBtn, width: 'auto', padding: '0 8px', fontSize: 11, cursor: 'pointer', appearance: 'auto', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4, height: 26 }}
              >
                <option value="roadmap" style={{ color: '#000' }}>Roadmap</option>
                <option value="hybrid" style={{ color: '#000' }}>Hybrid</option>
              </select>
            </>
          )}
        </nav>
      ) : location.pathname === '/settings' ? (
        <nav style={s.topNav}>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'account' ? T.accent : T.textSecondary, background: settingsTab === 'account' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('account')}>
            <ShieldCheck size={13} strokeWidth={1.8} />
            <span>Account</span>
          </button>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'display' ? T.accent : T.textSecondary, background: settingsTab === 'display' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('display')}>
            <Monitor size={13} strokeWidth={1.8} />
            <span>Map & GIS</span>
          </button>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'notifications' ? T.accent : T.textSecondary, background: settingsTab === 'notifications' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('notifications')}>
            <Bell size={13} strokeWidth={1.8} />
            <span>Notifications</span>
          </button>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'system' ? T.accent : T.textSecondary, background: settingsTab === 'system' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('system')}>
            <Sliders size={13} strokeWidth={1.8} />
            <span>System Rules</span>
          </button>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'access' ? T.accent : T.textSecondary, background: settingsTab === 'access' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('access')}>
            <ShieldAlert size={13} strokeWidth={1.8} />
            <span>Access</span>
          </button>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'promotion' ? T.accent : T.textSecondary, background: settingsTab === 'promotion' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('promotion')}>
            <Ticket size={13} strokeWidth={1.8} />
            <span>Promotion</span>
          </button>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'integration' ? T.accent : T.textSecondary, background: settingsTab === 'integration' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('integration')}>
            <Plug size={13} strokeWidth={1.8} />
            <span>Integration</span>
          </button>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'feature_flag' ? T.accent : T.textSecondary, background: settingsTab === 'feature_flag' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('feature_flag')}>
            <Flag size={13} strokeWidth={1.8} />
            <span>Feature Flag</span>
          </button>
          <button style={{ ...s.topNavBtn, color: settingsTab === 'support' ? T.accent : T.textSecondary, background: settingsTab === 'support' ? T.accentBg : 'transparent' }} onClick={() => setSettingsTab('support')}>
            <LifeBuoy size={13} strokeWidth={1.8} />
            <span>Support</span>
          </button>
        </nav>
      ) : location.pathname === '/analytics' ? (
        <nav style={s.topNav}>
          <button style={{ ...s.topNavBtn, color: analyticsTab === 'efficiency' ? T.accent : T.textSecondary, background: analyticsTab === 'efficiency' ? T.accentBg : 'transparent' }} onClick={() => setAnalyticsTab('efficiency')}>
            <Activity size={13} strokeWidth={1.8} />
            <span>Efficiency Metrics</span>
          </button>
          <button style={{ ...s.topNavBtn, color: analyticsTab === 'intelligence' ? T.accent : T.textSecondary, background: analyticsTab === 'intelligence' ? T.accentBg : 'transparent' }} onClick={() => setAnalyticsTab('intelligence')}>
            <Crosshair size={13} strokeWidth={1.8} />
            <span>Intelligence Ops</span>
          </button>
        </nav>
      ) : location.pathname === '/financial' ? (
        <nav style={s.topNav}>
          {FINANCIAL_NAV_ITEMS.map((item) => {
            const isActive = financeTab === item.tab
            return (
              <button
                key={item.tab}
                style={{
                  ...s.topNavBtn,
                  color: isActive ? T.accent : T.textSecondary,
                  background: isActive ? T.accentBg : 'transparent',
                  letterSpacing: 0.4,
                }}
                onClick={() => setFinanceTab(item.tab)}
              >
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      ) : location.pathname === '/operations' ? (
        <nav style={s.topNav}>
          {OPERATIONS_NAV_ITEMS.map(({ label, tab }) => (
            <button
              key={tab}
              type="button"
              onClick={() => setOperationsTab(tab)}
              style={{
                ...s.topNavBtn,
                color: operationsTab === tab ? T.accent : T.textSecondary,
                background: operationsTab === tab ? T.accentBg : 'transparent',
              }}
            >
              <span>{label}</span>
            </button>
          ))}
        </nav>
      ) : location.pathname === '/engine' ? (
        <nav style={s.topNav}>
          {ENGINE_NAV_ITEMS.map((item) => {
            const isActive = engineTab === item.tab
            return (
              <button
                key={item.tab}
                type="button"
                style={{
                  ...s.topNavBtn,
                  color: isActive ? T.accent : T.textSecondary,
                  background: isActive ? T.accentBg : 'transparent',
                  letterSpacing: 0.4,
                }}
                onClick={() => setEngineTab(item.tab)}
              >
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      ) : location.pathname === '/test' ? (
        <nav style={s.topNav}>
          <button
            type="button"
            style={{ ...s.topNavBtn, color: testArea === 'account' ? T.accent : T.textSecondary, background: testArea === 'account' ? T.accentBg : 'transparent' }}
            onClick={() => setTestArea('account')}
          >
            <UserIcon size={13} strokeWidth={1.8} />
            <span>Account</span>
          </button>
          <button
            type="button"
            style={{ ...s.topNavBtn, color: testArea === 'rides' ? T.accent : T.textSecondary, background: testArea === 'rides' ? T.accentBg : 'transparent' }}
            onClick={() => setTestArea('rides')}
          >
            <CalendarClock size={13} strokeWidth={1.8} />
            <span>Rides</span>
          </button>
          <button
            type="button"
            style={{ ...s.topNavBtn, color: testArea === 'map' ? T.accent : T.textSecondary, background: testArea === 'map' ? T.accentBg : 'transparent' }}
            onClick={() => setTestArea('map')}
          >
            <Map size={13} strokeWidth={1.8} />
            <span>Map Data</span>
          </button>
          <button
            type="button"
            style={{ ...s.topNavBtn, color: testArea === 'calibration' ? T.accent : T.textSecondary, background: testArea === 'calibration' ? T.accentBg : 'transparent' }}
            onClick={() => setTestArea('calibration')}
          >
            <Route size={13} strokeWidth={1.8} />
            <span>Calibration</span>
          </button>
        </nav>
      ) : location.pathname === '/' ? (
        <nav style={s.topNav}>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(location.search)
              params.set('mode', 'live')
              navigate({ pathname: location.pathname, search: `?${params.toString()}` })
            }}
            style={{
              ...s.topNavBtn,
              color: searchParams.get('mode') !== 'map-editor' ? T.accent : T.textSecondary,
              background: searchParams.get('mode') !== 'map-editor' ? T.accentBg : 'transparent',
            }}
          >
            <Activity size={13} strokeWidth={1.8} />
            <span>Live Operations</span>
          </button>
        </nav>
      ) : location.pathname === '/notifications' ? (
        <nav style={s.topNav}>
          <button
            type="button"
            style={{ ...s.topNavBtn, color: T.textSecondary, background: 'transparent' }}
            onClick={() => navigate('/')}
          >
            <LayoutDashboard size={13} strokeWidth={1.8} />
            <span>Dashboard</span>
          </button>
        </nav>
      ) : location.pathname === '/docs' ? (
        <nav style={s.topNav}>
          <button
            type="button"
            style={{ ...s.topNavBtn, color: docsTab === 'admin' ? T.accent : T.textSecondary, background: docsTab === 'admin' ? T.accentBg : 'transparent' }}
            onClick={() => setDocsTab('admin')}
          >
            <ShieldCheck size={13} strokeWidth={1.8} />
            <span>Admin System</span>
          </button>
          <button
            type="button"
            style={{ ...s.topNavBtn, color: docsTab === 'student' ? T.accent : T.textSecondary, background: docsTab === 'student' ? T.accentBg : 'transparent' }}
            onClick={() => setDocsTab('student')}
          >
            <Smartphone size={13} strokeWidth={1.8} />
            <span>Student App</span>
          </button>
          <button
            type="button"
            style={{ ...s.topNavBtn, color: docsTab === 'driver' ? T.accent : T.textSecondary, background: docsTab === 'driver' ? T.accentBg : 'transparent' }}
            onClick={() => setDocsTab('driver')}
          >
            <Car size={13} strokeWidth={1.8} />
            <span>Driver App</span>
          </button>
        </nav>
      ) : (
        <nav style={s.topNav}>
          {NAV_ITEMS.map((t) => {
            const Icon = t.icon
            const isActive = location.pathname === t.path
            return (
              <Link
                key={t.label}
                to={t.path}
                style={{
                  ...s.topNavBtn,
                  color: isActive ? T.accent : T.textSecondary,
                  background: isActive ? T.accentBg : 'transparent',
                  textDecoration: 'none'
                }}
              >
                <Icon size={13} strokeWidth={1.8} />
                <span>{t.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      <div style={s.topRight}>
        {location.pathname === '/users/verification' ? (
          <button style={{ ...s.topNavBtn, color: T.textPrimary, background: T.bgCard, border: `1px solid ${T.border}` }}>
            <History size={14} />
            <span style={{ fontSize: 13 }}>Audit Log</span>
          </button>
        ) : (
          <>
            {/* Bell Notification Badge */}
            <button
              style={{ ...s.topIconBtn, position: 'relative' }}
              onClick={() => navigate('/notifications')}
              title="Notifications"
            >
              <Bell size={14} color={location.pathname === '/notifications' ? T.accent : T.textSecondary} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  minWidth: 14, height: 14, borderRadius: 999,
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 800, lineHeight: '14px',
                  textAlign: 'center', padding: '0 3px',
                  border: `1.5px solid ${T.topBar}`,
                  pointerEvents: 'none',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button style={s.topIconBtn} onClick={() => logoutMutation.mutate()}>
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

const s: Record<string, CSSProperties> = {
  topBar: {
    height: 44, background: T.topBar, display: 'flex', alignItems: 'center',
    paddingLeft: 16, paddingRight: 12,
    borderBottom: `1px solid ${T.border}`, flexShrink: 0,
  },
  topLeft: { flex: 1, display: 'flex', alignItems: 'center', gap: 12 },
  topNav: { display: 'flex', alignItems: 'center', gap: 2 },
  topNavBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none',
    cursor: 'pointer', padding: '5px 10px', borderRadius: 6,
    fontSize: 11, fontWeight: 600, fontFamily: T.fontFamily, transition: 'all 0.15s',
  },
  topRight: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  topIconBtn: {
    width: 28, height: 28, borderRadius: 6, border: 'none',
    background: 'transparent', color: T.textSecondary, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

}

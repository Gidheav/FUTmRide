// FinancialHub — campus admin finance shell (styled like Settings)
import React, {
  useState, useEffect, useRef,
  useCallback,
} from 'react'
import { Download, RefreshCw, Search, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { FinanceOverview, Period } from '../types/financial.types'
import { injectFHCSS } from '../helpers/hub.helpers'
import { compact, periodLabel } from '../helpers/hub.helpers'
import { PeriodSelector } from '../components/PeriodSelector'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import apiService from '../../../services/api.service'
import { useFinancialStore } from '../../financialStore'
import { OverviewTab } from './tabs/OverviewTab'
import { TransactionsTab } from './tabs/TransactionsTab'
import { ReportsTab } from './tabs/ReportsTab'
import { PayoutsTab } from './tabs/PayoutsTab'
const FinancialHub: React.FC = () => {
  injectFHCSS()
  const location = useLocation()
  const navigate = useNavigate()

  const { activeTab: tab, setActiveTab: setFinanceTab } = useFinancialStore()
  const [period, setPeriod] = useState<Period>('30D')
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [search, setSearch] = useState('')
  const ledgerExportRef = useRef<(() => void) | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const reportsRefreshRef = useRef<(() => void) | null>(null)
  const payoutsRefreshRef = useRef<(() => void) | null>(null)
  const [payoutsMeta, setPayoutsMeta] = useState({ pending: 0, failed: 0 })

  useEffect(() => {
    if (location.search) navigate('/financial', { replace: true })
  }, [location.search, navigate])

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true)
    try {
      const res = await apiService.get<FinanceOverview>(
        `payments/admin/finance/overview/?period=${period}`,
      )
      setOverview(res)
    } catch {
      setOverview(null)
    } finally {
      setLoadingOverview(false)
    }
  }, [period])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const handleSearch = useCallback((q: string) => {
    setSearch(q)
    if (q) setFinanceTab('transactions')
  }, [setFinanceTab])

  const toolbarRevenue = overview?.kpis.platform_revenue_kobo ?? 0
  const toolbarTxCount = overview?.kpis.transaction_count ?? 0
  const toolbarFailed = overview?.kpis.failed_count ?? 0

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [tab])

  const handleRefresh = useCallback(() => {
    if (tab === 'reports' && reportsRefreshRef.current) {
      reportsRefreshRef.current()
      return
    }
    if (tab === 'payouts' && payoutsRefreshRef.current) {
      payoutsRefreshRef.current()
      return
    }
    fetchOverview()
    setRefreshKey((k) => k + 1)
  }, [fetchOverview, tab])

  const handleExport = useCallback(async () => {
    if (tab === 'transactions' && ledgerExportRef.current) {
      ledgerExportRef.current()
      return
    }
    if (tab === 'payouts') {
      try {
        await apiService.downloadPayoutsExport(period)
      } catch {
        /* silent */
      }
      return
    }
    try {
      await apiService.downloadLedgerExport({ period })
    } catch {
      /* silent */
    }
  }, [tab, period])

  const registerLedgerExport = useCallback((fn: () => void) => {
    ledgerExportRef.current = fn
  }, [])

  const registerReportsRefresh = useCallback((fn: () => void) => {
    reportsRefreshRef.current = fn
  }, [])

  const registerPayoutsRefresh = useCallback((fn: () => void) => {
    payoutsRefreshRef.current = fn
  }, [])

  const kpiStrip = (
    <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      {[
        { label: 'Revenue', value: compact(toolbarRevenue), color: T.accent },
        { label: 'Transactions', value: toolbarTxCount.toString(), color: T.textPrimary },
        { label: 'Failed', value: toolbarFailed.toString(), color: toolbarFailed > 0 ? T.error : T.textMuted },
      ].map((k, i) => (
        <div key={k.label} style={{ ...campusPanel.kpiBlock, borderLeft: i === 0 ? 'none' : campusPanel.kpiBlock.borderLeft }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
            {k.label}
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: k.color, margin: '2px 0 0', fontFamily: T.fontFamily }}>
            {k.value}
          </p>
        </div>
      ))}
    </div>
  )

  const refreshButton = (
    <button type="button" onClick={handleRefresh} style={campusPanel.btnPrimary}>
      <RefreshCw size={13} />
      Refresh
    </button>
  )

  return (
    <div className="fh" style={campusPanel.shell}>
      <div style={{ ...campusPanel.toolbar, flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <PeriodSelector value={period} onChange={setPeriod} />
        <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {periodLabel(period)}
        </span>

        {tab === 'payouts' && payoutsMeta.pending > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '3px 8px', textTransform: 'uppercase',
            color: T.warn, background: T.warnBg, border: `1px solid ${T.warn}44`,
          }}>
            {payoutsMeta.pending} pending
          </span>
        )}
        {tab === 'payouts' && payoutsMeta.failed > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '3px 8px', textTransform: 'uppercase',
            color: T.error, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
          }}>
            {payoutsMeta.failed} failed
          </span>
        )}

        {tab === 'transactions' && (
          <div style={{ flex: 1, minWidth: 160, maxWidth: 320, position: 'relative' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted }}
            />
            <input
              type="text"
              className="fh-input"
              placeholder="Search ledger…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ ...campusPanel.input, paddingLeft: 32, paddingRight: search ? 28 : 12 }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  border: 'none', background: 'transparent', cursor: 'pointer', color: T.textMuted,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {(tab === 'overview' || tab === 'transactions') && (
          <div style={{ marginLeft: tab === 'overview' ? 'auto' : undefined, flex: tab === 'transactions' ? 1 : undefined, display: 'flex', justifyContent: tab === 'transactions' ? 'flex-end' : 'flex-start' }}>
            {kpiStrip}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
          {(tab === 'transactions' || tab === 'payouts') && (
            <button type="button" onClick={handleExport} style={campusPanel.btnSecondary}>
              <Download size={13} />
              Export
            </button>
          )}
          {refreshButton}
        </div>
      </div>

      <div ref={scrollRef} style={{ ...campusPanel.scrollMain, ...campusPanel.thinScroll }}>
        {tab === 'overview' && (
          <OverviewTab overview={overview} loading={loadingOverview} />
        )}

        {tab === 'transactions' && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'min(70vh, 100%)' }}>
            <TransactionsTab
              key={refreshKey}
              period={period}
              externalSearch={search}
              onExportReady={registerLedgerExport}
            />
          </div>
        )}

        {tab === 'reports' && (
          <ReportsTab
            period={period}
            onRefreshReady={registerReportsRefresh}
          />
        )}

        {tab === 'payouts' && (
          <PayoutsTab
            period={period}
            onMetaChange={setPayoutsMeta}
            onRefreshReady={registerPayoutsRefresh}
          />
        )}
      </div>
    </div>
  )
}

export default FinancialHub

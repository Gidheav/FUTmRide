// FinancialHub — campus admin finance shell (styled like Settings)
import React, {
  useState, useEffect, useRef,
  useCallback,
} from 'react'
import { Download, RefreshCw, Search, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { FinanceOverview, Period, Tx } from '../types/financial.types'
import { injectFHCSS } from '../helpers/hub.helpers'
import { compact, exportCSV, periodLabel } from '../helpers/hub.helpers'
import { MOCK_TXS } from '../constants/hub.constants'
import { PeriodSelector } from '../components/PeriodSelector'
import { campusPanel } from '../../shared/campusPanelStyles'
import { T } from '../../theme'
import apiService from '../../../services/api.service'
import { useFinancialStore } from '../../financialStore'
import { OverviewTab } from './tabs/OverviewTab'
import { TransactionsTab } from './tabs/TransactionsTab'
import { MembersTab } from './tabs/MembersTab'
import { ReportsTab } from './tabs/ReportsTab'
import { PayoutsTab } from './tabs/PayoutsTab'

const FinancialHub: React.FC = () => {
  injectFHCSS()
  const location = useLocation()
  const navigate = useNavigate()

  const { activeTab: tab, setActiveTab: setFinanceTab } = useFinancialStore()
  const [period, setPeriod] = useState<Period>('30D')
  const [txs, setTxs] = useState<Tx[]>(MOCK_TXS)
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [loadingTxs, setLoadingTxs] = useState(false)
  const [search, setSearch] = useState('')

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

  useEffect(() => {
    if (tab === 'overview') return
    let dead = false
    ;(async () => {
      setLoadingTxs(true)
      try {
        const res = await apiService.get<any>('payments/admin/transactions/')
        if (!dead) {
          const list: Tx[] = Array.isArray(res) ? res : (res?.results ?? res?.data ?? [])
          if (list.length > 0) setTxs(list)
        }
      } catch {
        /* use mock for legacy tabs until wired */
      } finally {
        if (!dead) setLoadingTxs(false)
      }
    })()
    return () => { dead = true }
  }, [tab])

  const handleSearch = useCallback((q: string) => {
    setSearch(q)
    if (q) setFinanceTab('transactions')
  }, [setFinanceTab])

  const toolbarRevenue = overview?.kpis.platform_revenue_kobo ?? 0
  const toolbarTxCount = overview?.kpis.transaction_count ?? txs.length
  const toolbarFailed = overview?.kpis.failed_count ?? txs.filter(t => t.status === 'FAILED').length

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [tab])

  const handleRefresh = useCallback(() => {
    if (tab === 'overview') {
      fetchOverview()
    } else {
      window.location.reload()
    }
  }, [tab, fetchOverview])

  return (
    <div className="fh" style={campusPanel.shell}>
      <div style={campusPanel.toolbar}>
        <PeriodSelector value={period} onChange={setPeriod} />

        <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
          {periodLabel(period)}
        </span>

        <div style={{ flex: 1, minWidth: 160, maxWidth: 320, position: 'relative', marginLeft: 'auto' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted }}
          />
          <input
            type="text"
            className="fh-input"
            placeholder="Search transactions…"
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
              <p style={{ fontSize: 15, fontWeight: 700, color: k.color, margin: '2px 0 0', fontFamily: 'monospace' }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => exportCSV(txs)} style={campusPanel.btnSecondary}>
            <Download size={13} />
            Export
          </button>
          <button type="button" onClick={handleRefresh} style={campusPanel.btnPrimary}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      <div ref={scrollRef} style={{ ...campusPanel.scrollMain, ...campusPanel.thinScroll }}>
        {tab === 'overview' && (
          <OverviewTab overview={overview} loading={loadingOverview} />
        )}

        {tab === 'transactions' && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'min(70vh, 100%)' }}>
            <TransactionsTab txs={txs} period={period} />
          </div>
        )}

        {tab === 'members' && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'min(70vh, 100%)' }}>
            <MembersTab txs={txs} />
          </div>
        )}

        {tab === 'reports' && (
          <ReportsTab txs={txs} />
        )}

        {tab === 'payouts' && (
          <PayoutsTab />
        )}

        {loadingTxs && tab !== 'overview' && (
          <p style={{ fontSize: 12, color: T.textMuted, marginTop: 12 }}>Loading transactions…</p>
        )}
      </div>
    </div>
  )
}

export default FinancialHub

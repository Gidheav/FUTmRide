import api from '../core/api'
import type { AxiosRequestConfig } from 'axios'
import type {
  LedgerQueryParams,
  Period,
  ReportCatalogResponse,
  ReportFormat,
  ReportRun,
  ScheduledReport,
  ScheduleFrequency,
  StatementAccessRequest,
  ConsentScope,
  PayoutListResponse,
  PayoutStatusFilter,
} from '../campus-admin/FinancialManagement/types/financial.types'
import { enrichCatalog, REPORT_CATALOG_FALLBACK } from '../campus-admin/FinancialManagement/constants/reportsCatalog'

type MockBank = { code: string; name: string }

const FRONTEND_ONLY_FINANCE = true

const normalizeUrl = (url: string) => url.replace(/^\/+/, '')

const mockBanks: MockBank[] = [
  { code: '044', name: 'Access Bank' },
  { code: '058', name: 'GTBank' },
  { code: '011', name: 'First Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '033', name: 'UBA' },
  { code: '050', name: 'Ecobank' },
]

const mockBankAccounts = [
  {
    id: 'mock-bank-001',
    bank_name: 'GTBank',
    bank_code: '058',
    account_number: '0123456789',
    account_name: 'LR Ride Operations',
    is_default: true,
  },
]

const mockWithdrawals = [
  {
    id: 'mock-wdr-001',
    amount: 12500000,
    currency: 'NGN',
    status: 'completed',
    bank_name: 'GTBank',
    account_number: '0123456789',
    account_name: 'LR Ride Operations',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000 + 420000).toISOString(),
    paystack_transfer_code: 'TRF_mock001',
  },
  {
    id: 'mock-wdr-002',
    amount: 7600000,
    currency: 'NGN',
    status: 'processing',
    bank_name: 'Access Bank',
    account_number: '9876543210',
    account_name: 'Campus Shuttle Pool',
    created_at: new Date(Date.now() - 9 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    paystack_transfer_code: 'TRF_mock002',
  },
]

const mockBudgetSummary = {
  total_allocated: 420000000,
  total_spent: 268500000,
  total_remaining: 151500000,
  budget_usage_percent: 64,
  allocations: [
    { department: 'Fleet Operations', icon: 'payments', color: '#10b981', allocated_amount: 180000000, spent: 118000000 },
    { department: 'Driver Incentives', icon: 'groups', color: '#3b82f6', allocated_amount: 90000000, spent: 61200000 },
    { department: 'Maintenance', icon: 'settings', color: '#f59e0b', allocated_amount: 75000000, spent: 54800000 },
    { department: 'Campus Expansion', icon: 'target', color: '#8b5cf6', allocated_amount: 75000000, spent: 34500000 },
  ],
}

const mockReserves = [
  { id: 'reserve-ops', name: 'Operations Reserve', balance: 58000000, icon: 'savings', color: '#10b981', note: 'Short-term runway' },
  { id: 'reserve-maint', name: 'Maintenance Fund', balance: 24500000, icon: 'settings', color: '#f59e0b', note: 'Vehicle upkeep' },
  { id: 'reserve-growth', name: 'Growth Pool', balance: 36000000, icon: 'target', color: '#8b5cf6', note: 'New campus launches' },
]

const FINANCE_LIVE_PREFIXES = ['payments/admin/finance/', 'reports/']

const isFinanceLivePath = (path: string) =>
  FINANCE_LIVE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))

const getMock = (url: string): unknown | undefined => {
  const path = normalizeUrl(url)
  if (isFinanceLivePath(path)) return undefined

  if (path === 'payments/admin/transactions/' || path.startsWith('payments/admin/transactions/?')) return []
  if (path === 'payments/admin/paystack-balance/') return { balance: 482000000 }
  if (path === 'withdrawals/banks/') return mockBanks
  if (path === 'withdrawals/bank-accounts/') return mockBankAccounts
  if (path === 'admin/withdrawals/') return { results: mockWithdrawals }
  if (path.startsWith('admin/withdrawals/')) {
    const id = path.split('/').filter(Boolean)[2]
    return mockWithdrawals.find((item) => item.id === id) ?? mockWithdrawals[0]
  }
  if (path === 'budget/summary/') return mockBudgetSummary
  if (path === 'budget/reserves/') return mockReserves

  return undefined
}

const postMock = (url: string, data?: unknown): unknown | undefined => {
  const path = normalizeUrl(url)

  if (path.endsWith('/refund/')) return { status: 'queued' }
  if (path === 'withdrawals/bank-accounts/') {
    const payload = data as { bank_code?: string; account_number?: string }
    const bank = mockBanks.find((item) => item.code === payload?.bank_code)
    return {
      id: 'mock-bank-new',
      bank_name: bank?.name ?? 'Mock Bank',
      bank_code: payload?.bank_code,
      account_number: payload?.account_number,
      account_name: 'Verified Mock Account',
      is_default: false,
    }
  }
  if (path === 'withdrawals/') {
    return {
      id: 'mock-wdr-new',
      status: 'otp_required',
      paystack_transfer_code: 'TRF_mocknew',
    }
  }
  if (path.startsWith('admin/withdrawals/') && path.endsWith('/approve/')) return { status: 'otp_required' }
  if (path.startsWith('withdrawals/') && path.endsWith('/finalize-otp/')) {
    return { withdrawal_status: 'completed', status: 'completed' }
  }

  return undefined
}

class ApiService {
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const mocked = getMock(url)
    if (FRONTEND_ONLY_FINANCE && mocked !== undefined) return mocked as T
    const response = await api.get<T>(url, config)
    return response.data
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const mocked = postMock(url, data)
    if (FRONTEND_ONLY_FINANCE && mocked !== undefined) return mocked as T
    const response = await api.post<T>(url, data, config)
    return response.data
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await api.put<T>(url, data, config)
    return response.data
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await api.patch<T>(url, data, config)
    return response.data
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await api.delete<T>(url, config)
    return response.data
  }

  buildLedgerQuery(params: LedgerQueryParams): string {
    const qs = new URLSearchParams()
    qs.set('period', params.period)
    if (params.page) qs.set('page', String(params.page))
    if (params.page_size) qs.set('page_size', String(params.page_size))
    if (params.status && params.status !== 'ALL') qs.set('status', params.status)
    if (params.source && params.source !== 'ALL') qs.set('source', params.source)
    if (params.search) qs.set('search', params.search)
    if (params.needs_action) qs.set('needs_action', 'true')
    if (params.ordering) qs.set('ordering', params.ordering)
    return qs.toString()
  }

  async downloadLedgerExport(params: LedgerQueryParams): Promise<void> {
    const query = this.buildLedgerQuery(params)
    const response = await api.get(`payments/admin/finance/ledger/export/?${query}`, {
      responseType: 'blob',
    })
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lr_ride_ledger_${params.period.toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async getReportsCatalog(): Promise<ReportCatalogResponse & { fromApi?: boolean }> {
    try {
      const data = await this.get<ReportCatalogResponse>('reports/catalog/')
      if (data?.reports?.length) {
        return { ...enrichCatalog(data), fromApi: true }
      }
    } catch {
      /* use embedded catalog when API unavailable */
    }
    return { ...REPORT_CATALOG_FALLBACK, fromApi: false }
  }

  async generateReport(body: {
    report_key: string
    format?: ReportFormat
    period?: Period
    filters?: Record<string, string>
    async?: boolean
  }): Promise<ReportRun> {
    return this.post<ReportRun>('reports/generate/', body)
  }

  async listReportRuns(limit = 50): Promise<{ results: ReportRun[] }> {
    return this.get<{ results: ReportRun[] }>(`reports/runs/?limit=${limit}`)
  }

  async getReportRun(runId: string): Promise<ReportRun> {
    return this.get<ReportRun>(`reports/runs/${runId}/`)
  }

  async downloadReportRun(runId: string, filename?: string): Promise<void> {
    const response = await api.get(`reports/runs/${runId}/download/`, { responseType: 'blob' })
    const blob = new Blob([response.data])
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `lr_ride_report_${runId.slice(0, 8)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async listScheduledReports(): Promise<{ results: ScheduledReport[] }> {
    return this.get<{ results: ScheduledReport[] }>('reports/schedules/')
  }

  async createScheduledReport(body: {
    name: string
    report_key: string
    format?: ReportFormat
    period?: Period
    frequency?: ScheduleFrequency
    day_of_week?: number
    day_of_month?: number
    hour?: number
    minute?: number
    recipients?: string[]
  }): Promise<ScheduledReport> {
    return this.post<ScheduledReport>('reports/schedules/', body)
  }

  async updateScheduledReport(id: string, body: Partial<ScheduledReport>): Promise<ScheduledReport> {
    return this.patch<ScheduledReport>(`reports/schedules/${id}/`, body)
  }

  async deleteScheduledReport(id: string): Promise<void> {
    await this.delete(`reports/schedules/${id}/`)
  }

  async listConsentRequests(status?: string): Promise<{ results: StatementAccessRequest[] }> {
    const qs = status ? `?status=${status}` : ''
    return this.get<{ results: StatementAccessRequest[] }>(`reports/consent/${qs}`)
  }

  async createConsentRequest(body: {
    subject_id: string
    scope: ConsentScope
    period_start: string
    period_end: string
    ride_id?: string
    notes?: string
  }): Promise<StatementAccessRequest> {
    return this.post<StatementAccessRequest>('reports/consent/', body)
  }

  async approveConsentRequest(id: string, notes?: string): Promise<StatementAccessRequest> {
    return this.post<StatementAccessRequest>(`reports/consent/${id}/approve/`, { notes })
  }

  async denyConsentRequest(id: string, notes?: string): Promise<StatementAccessRequest> {
    return this.post<StatementAccessRequest>(`reports/consent/${id}/deny/`, { notes })
  }

  async generateConsentStatement(id: string, format: ReportFormat = 'pdf'): Promise<ReportRun> {
    return this.post<ReportRun>(`reports/consent/${id}/generate/`, { format })
  }

  buildPayoutQuery(params: {
    period: Period
    page?: number
    page_size?: number
    status?: PayoutStatusFilter
    search?: string
    needs_action?: boolean
  }): string {
    const qs = new URLSearchParams()
    qs.set('period', params.period)
    if (params.page) qs.set('page', String(params.page))
    if (params.page_size) qs.set('page_size', String(params.page_size))
    if (params.status && params.status !== 'ALL') qs.set('status', params.status)
    if (params.search) qs.set('search', params.search)
    if (params.needs_action) qs.set('needs_action', 'true')
    return qs.toString()
  }

  async getFinancePayouts(params: {
    period: Period
    page?: number
    status?: PayoutStatusFilter
    search?: string
    needs_action?: boolean
  }): Promise<PayoutListResponse> {
    const query = this.buildPayoutQuery(params)
    return this.get<PayoutListResponse>(`payments/admin/finance/payouts/?${query}`)
  }

  async downloadPayoutsExport(period: Period): Promise<void> {
    const response = await api.get(`payments/admin/finance/payouts/export/?period=${period}`, {
      responseType: 'blob',
    })
    const blob = new Blob([response.data], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lr_ride_payouts_${period.toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
}

export const apiService = new ApiService()
export default apiService

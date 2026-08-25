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
const TEST_TOOL_REQUEST_CONFIG: AxiosRequestConfig = { timeout: 120000 }

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

  async getCampusFleet(params?: { maintenance_status?: string; verification_status?: string; search?: string }): Promise<any[]> {
    const q = new URLSearchParams()
    if (params?.maintenance_status) q.append('maintenance_status', params.maintenance_status)
    if (params?.verification_status) q.append('verification_status', params.verification_status)
    if (params?.search) q.append('search', params.search)
    return this.get<any[]>(`accounts/fleet/?${q.toString()}`)
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

  // ── Scheduled Rides ────────────────────────────────────────────────────────
  
  async createScheduledRide(data: any): Promise<any> {
    return this.post('rides/scheduled/create/', data)
  }

  async getScheduledRides(params?: { status?: string; date?: string }): Promise<any[]> {
    const buildQuery = (page: number) => {
      const qs = new URLSearchParams()
      if (params?.status) qs.set('status', params.status)
      if (params?.date) qs.set('date', params.date)
      qs.set('page', String(page))
      qs.set('page_size', '100')
      return qs.toString()
    }

    const first = await this.get<any>(`rides/scheduled/?${buildQuery(1)}`)
    if (!first?.pagination) return first?.results || first

    const all = [...(first.results || [])]
    const totalPages = Number(first.pagination.total_pages || 1)
    for (let page = 2; page <= totalPages; page += 1) {
      const res = await this.get<any>(`rides/scheduled/?${buildQuery(page)}`)
      all.push(...(res?.results || []))
    }
    return all
  }

  async getDispatchedBuses(): Promise<any[]> {
    const res = await this.get<any>(`rides/scheduled/dispatched-buses/?page_size=500`)
    return res?.results || res
  }

  async getScheduledRideDetail(id: string): Promise<any> {
    return this.get(`rides/scheduled/${id}/`)
  }

  async updateScheduledRide(id: string, data: Partial<{
    window_start: string
    window_end: string
    status: string
    departure_date: string
    allowed_vehicle_types: string[]
    vehicle_size: string
    notes: string
  }>): Promise<any> {
    return this.patch(`rides/scheduled/${id}/`, data)
  }

  async duplicateScheduledRide(id: string, overrides: Partial<{
    departure_date: string
    window_start: string
    window_end: string
    allowed_vehicle_types: string[]
    notes: string
  }> = {}): Promise<any> {
    const detail = await this.getScheduledRideDetail(id)
    const payload: any = {
      origin_address: detail.origin_address,
      origin_name: detail.origin_name,
      origin_latitude: detail.origin_latitude,
      origin_longitude: detail.origin_longitude,
      destination_address: detail.destination_address,
      destination_name: detail.destination_name,
      destination_latitude: detail.destination_latitude,
      destination_longitude: detail.destination_longitude,
      departure_date: overrides.departure_date || detail.departure_date,
      window_start: overrides.window_start !== undefined ? (overrides.window_start && overrides.window_start.length === 5 ? overrides.window_start + ':00' : overrides.window_start) : detail.window_start,
      window_end: overrides.window_end !== undefined ? (overrides.window_end && overrides.window_end.length === 5 ? overrides.window_end + ':00' : overrides.window_end) : detail.window_end,
      vehicle_size: detail.vehicle_size,
      allowed_vehicle_types: overrides.allowed_vehicle_types || detail.allowed_vehicle_types,
      notes: overrides.notes !== undefined ? overrides.notes : detail.notes,
      stops: (detail.stops || []).map((s: any, i: number) => ({
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        order: i + 1,
      })),
    }
    return this.post('rides/scheduled/create/', payload)
  }

  async updateScheduledRideStops(id: string, stops: any[]): Promise<any> {
    return this.patch(`rides/scheduled/${id}/stops/`, { stops })
  }

  async cancelScheduledRide(id: string): Promise<any> {
    return this.post(`rides/scheduled/${id}/cancel/`)
  }

  async getCancellationImpact(id: string): Promise<any> {
    return this.get(`rides/scheduled/${id}/cancellation-impact/`)
  }

  async hardDeleteScheduledRide(id: string): Promise<any> {
    return this.delete(`rides/scheduled/${id}/delete/`)
  }

  async getCompatibleRides(id: string): Promise<any[]> {
    return this.get(`rides/scheduled/${id}/compatible-rides/`)
  }

  async migrateRide(id: string, targetRideId: string): Promise<any> {
    return this.post(`rides/scheduled/${id}/migrate/`, { target_ride_id: targetRideId })
  }

  async departScheduledRide(id: string): Promise<any> {
    return this.post(`rides/scheduled/${id}/depart/`)
  }

  async completeScheduledRide(id: string): Promise<any> {
    return this.post(`rides/scheduled/${id}/complete/`)
  }

  // ── Bus Assignment (Route Ops) ──────────────────────────────────────────────

  async getBusAssignments(rideId: string): Promise<any[]> {
    const res = await this.get<any>(`rides/scheduled/${rideId}/buses/`)
    return res?.results || res
  }

  async createBusAssignment(rideId: string, data: any): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/buses/assign/`, data)
  }

  async updateBusAssignment(rideId: string, busId: string, data: any): Promise<any> {
    return this.patch(`rides/scheduled/${rideId}/buses/${busId}/`, data)
  }

  async unassignBus(rideId: string, busId: string): Promise<any> {
    return this.delete(`rides/scheduled/${rideId}/buses/${busId}/`)
  }

  async allocateBus(rideId: string, busId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/buses/${busId}/allocate/`)
  }

  async autoCheckInBus(rideId: string, busId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/buses/${busId}/auto-check-in/`)
  }

  async departBus(rideId: string, busId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/buses/${busId}/depart/`)
  }

  async arriveBus(rideId: string, busId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/buses/${busId}/arrive/`)
  }

  async completeBus(rideId: string, busId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/buses/${busId}/complete/`)
  }

  async getInterestedDrivers(rideId: string): Promise<any[]> {
    return this.get<any[]>(`rides/scheduled/${rideId}/interested-drivers/`)
  }

  // ── Passenger Management (Route Ops) ──────────────────────────────────────

  async getRidePassengers(rideId: string): Promise<any[]> {
    const res = await this.get<any>(`rides/scheduled/${rideId}/passengers/?page_size=100000`)
    return res?.results || res
  }

  async checkInPassenger(rideId: string, paxId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/passengers/${paxId}/check-in/`)
  }

  async markNoShow(rideId: string, paxId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/passengers/${paxId}/no-show/`)
  }

  async reassignPassenger(rideId: string, paxId: string, busId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/passengers/${paxId}/reassign/`, { bus_assignment_id: busId })
  }

  async autoAllocatePassengers(rideId: string): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/auto-allocate/`)
  }

  // ── Activity Logs ──────────────────────────────────────────────────────────

  async getScheduledRideLogs(rideId: string): Promise<any[]> {
    return this.get<any[]>(`rides/scheduled/${rideId}/logs/`)
  }

  async addScheduledRideLog(rideId: string, message: string, logType: string = 'info'): Promise<any> {
    return this.post(`rides/scheduled/${rideId}/logs/`, { message, log_type: logType })
  }

  async getTestToolsSummary(): Promise<any> {
    return this.get('rides/test-tools/summary/', TEST_TOOL_REQUEST_CONFIG)
  }

  async createTestStudents(count: number): Promise<any> {
    return this.post('rides/test-tools/accounts/students/create/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async deleteTestStudents(count: number): Promise<any> {
    return this.post('rides/test-tools/accounts/students/delete/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async createTestDrivers(count: number): Promise<any> {
    return this.post('rides/test-tools/accounts/drivers/create/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async deleteTestDrivers(count: number): Promise<any> {
    return this.post('rides/test-tools/accounts/drivers/delete/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async createTestAdmins(count: number): Promise<any> {
    return this.post('rides/test-tools/accounts/admins/create/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async deleteTestAdmins(count: number): Promise<any> {
    return this.post('rides/test-tools/accounts/admins/delete/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async createTestScheduledRides(count: number): Promise<any> {
    return this.post('rides/test-tools/rides/create/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async deleteTestScheduledRides(count: number): Promise<any> {
    return this.post('rides/test-tools/rides/delete/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async flushAllScheduledRides(): Promise<any> {
    return this.post('rides/test-tools/rides/flush/', {}, TEST_TOOL_REQUEST_CONFIG)
  }


  async joinTestScheduledRide(rideId: string, count: number): Promise<any> {
    return this.post('rides/test-tools/rides/join/', { ride_id: rideId, count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async createTestOnDemandRides(count: number): Promise<any> {
    return this.post('rides/test-tools/ondemand-rides/create/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async deleteTestOnDemandRides(count: number): Promise<any> {
    return this.post('rides/test-tools/ondemand-rides/delete/', { count }, TEST_TOOL_REQUEST_CONFIG)
  }

  async flushAllOnDemandRides(): Promise<any> {
    return this.post('rides/test-tools/ondemand-rides/flush/', {}, TEST_TOOL_REQUEST_CONFIG)
  }

  async importLocations(locations: any[]): Promise<any> {
    return this.post('locations/admin/bulk-import/', locations)
  }

  async wipeLocations(): Promise<any> {
    return this.post('locations/admin/wipe/')
  }

  async publishLocations(): Promise<any> {
    return this.post('locations/admin/publish/')
  }

  async getLocationsSnapshot(): Promise<any> {
    return this.get('locations/download/')
  }
  async getRideActivityLog(params: {
    cursor?: string
    ride_type?: string
    status?: string
    event?: string
    date_from?: string
    date_to?: string
    search?: string
    page_size?: number
    is_archive_search?: boolean
  }): Promise<any> {
    return this.get('rides/operations/activity-log/', { params })
  }
}

export const apiService = new ApiService()
export default apiService

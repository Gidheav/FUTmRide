// ─────────────────────────────────────────────────────────────────────────────
// financial.types.ts
// All shared TypeScript interfaces and type aliases for FinancialManagement/
// Sources: FinancialHub (FinancialSanctum.tsx) · FinancialReports (FinancialReports.tsx)
//          PaymentRecords.tsx · FinancialDashboard.tsx
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

/** Shared theme type used by both FinancialReports and FinancialDashboard */
export type Theme = 'dark' | 'light';

/** Shared sort direction used by FinancialHub and PaymentRecords */
export type SortDir = 'asc' | 'desc';

// ═══════════════════════════════════════════════════════════════════════════
// FINANCIAL HUB  (FinancialSanctum.tsx → hub/FinancialHub.tsx)
// ═══════════════════════════════════════════════════════════════════════════

export type Period  = '1D' | '7D' | '30D' | '90D' | 'YTD' | '1Y' | 'ALL';
export type HubTab  = 'overview' | 'transactions' | 'giving' | 'budget' | 'members' | 'reports' | 'payouts';

/** Privacy-safe finance overview from GET /payments/admin/finance/overview/ */
export interface FinanceOverviewKpis {
  platform_revenue_kobo: number;
  ride_fare_total_kobo: number;
  transaction_count: number;
  success_count: number;
  success_rate: number;
  failed_count: number;
  avg_ride_fare_kobo: number;
  pending_count: number;
  ride_count: number;
  prev_platform_revenue_kobo: number;
  prev_transaction_count: number;
  prev_success_rate: number;
  prev_failed_count: number;
  prev_avg_ride_fare_kobo: number;
  revenue_delta_pct: number;
  transaction_delta_pct: number;
  success_rate_delta: number;
  failed_delta_pct: number;
}

export interface FinanceOverviewBreakdown {
  label: string;
  value_kobo: number;
  pct: number;
  color: string;
}

export interface FinanceOverviewTrendPoint {
  label: string;
  value_kobo: number;
  ride_count: number;
}

export interface FinanceOverviewActivity {
  id: string;
  type: 'ride_completed' | 'wallet_topup' | 'driver_withdrawal';
  reference_masked: string;
  status: string;
  amount_kobo: number;
  meta: Record<string, string>;
}

export interface FinanceOverviewRoute {
  label: string;
  ride_count: number;
  revenue_kobo: number;
}

export interface FinanceOverview {
  period: Period;
  campus_scoped: boolean;
  kpis: FinanceOverviewKpis;
  revenue_trend: FinanceOverviewTrendPoint[];
  source_breakdown: FinanceOverviewBreakdown[];
  top_routes: FinanceOverviewRoute[];
  recent_activity: FinanceOverviewActivity[];
  volume_by_period: FinanceOverviewTrendPoint[];
}

/** Platform ledger event — privacy-safe, no user PII */
export type PlatformEventType =
  | 'ride_settlement'
  | 'gateway_topup'
  | 'gateway_failure'
  | 'driver_withdrawal'
  | 'ride_refund'
  | 'dispute_case';

export type LedgerSourceFilter = 'ALL' | 'RIDE' | 'GATEWAY' | 'WITHDRAWAL' | 'REFUND' | 'DISPUTE';
export type LedgerStatusFilter = 'ALL' | 'SUCCESS' | 'FAILED' | 'PENDING' | 'PROCESSING' | 'DISPUTED' | 'NEEDS_ACTION';

export interface LedgerTimelineStep {
  label: string;
  time: string | null;
  done: boolean;
}

export interface LedgerDisputeInfo {
  ride_id: string;
  ride_reference: string;
  dispute_opened_at: string;
  can_refund: boolean;
  can_resolve: boolean;
  party_hint?: string;
  fare_kobo: number;
  commission_kobo: number;
  driver_earnings_kobo: number;
}

export interface PlatformLedgerEvent {
  id: string;
  event_type: PlatformEventType;
  event_label: string;
  event_icon: string;
  reference_masked: string;
  reference_full?: string | null;
  amount_kobo: number;
  status: string;
  source_label: string;
  source_key: string;
  channel?: string;
  created_at: string;
  completed_at?: string | null;
  needs_action: boolean;
  context: Record<string, string | number | boolean>;
  dispute?: LedgerDisputeInfo | null;
  timeline?: LedgerTimelineStep[];
}

export interface LedgerListResponse {
  period: Period;
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: PlatformLedgerEvent[];
}

export interface LedgerQueryParams {
  period: Period;
  page?: number;
  page_size?: number;
  status?: LedgerStatusFilter;
  source?: LedgerSourceFilter;
  search?: string;
  needs_action?: boolean;
  ordering?: string;
}

/** Withdrawal wizard step */
export type WStep  = 'form' | 'initiating' | 'otp' | 'verifying' | 'done';
/** Withdrawal final outcome */
export type WFinal = 'completed' | 'failed' | 'unknown';

export interface Tx {
  id: string;
  user_email: string;
  user_name: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  status_label: string;
  payment_method?: string | null;
  amount_verified: boolean;
  paid_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, any>;
}

export interface BudgetLine {
  id?: string;
  department: string;
  icon: string;
  color: string;
  allocated_amount: number;
  spent: number;
  display_order?: number;
  fiscal_year?: number;
}

export interface BankAcct {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code?: string;
  recipient_code?: string;
}

export interface WithdrawalRecord {
  id: string;
  reference: string;
  amount: number;
  status: string;
  requested_at: string;
  updated_at?: string;
  failure_reason?: string;
  paystack_transfer_code?: string;
  transaction?: { paystack_transfer_code?: string };
}

// ═══════════════════════════════════════════════════════════════════════════
// FINANCIAL REPORTS  (FinancialReports.tsx → reports/FinancialReports.tsx)
// ═══════════════════════════════════════════════════════════════════════════

export type SanctumTab =
  | 'command'
  | 'ledger'
  | 'statements'
  | 'treasury'
  | 'payables'
  | 'assets'
  | 'payroll'
  | 'tax'
  | 'audit'
  | 'board';

export interface Account {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  subtype: string;
  balance: number;
  normal: 'debit' | 'credit';
  description: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  narration: string;
  lines: {
    account_code: string;
    account_name: string;
    debit: number;
    credit: number;
  }[];
  posted: boolean;
  approved_by: string;
  created_by: string;
  total: number;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  bank: string;
  account_no: string;
  bank_code: string;
  category: string;
  terms: number;
  balance_owed: number;
  ytd_paid: number;
  status: 'active' | 'inactive';
  tax_id: string;
}

export interface Bill {
  id: string;
  vendor_id: string;
  vendor_name: string;
  reference: string;
  description: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue' | 'disputed';
  category: string;
  vat: number;
  wht: number;
}

export interface FixedAsset {
  id: string;
  name: string;
  category: string;
  code: string;
  acquisition_date: string;
  acquisition_cost: number;
  useful_life: number;
  depreciation_method: 'straight_line' | 'reducing_balance';
  salvage_value: number;
  accumulated_depreciation: number;
  location: string;
  status: 'active' | 'disposed' | 'written_off';
  serial_number: string;
  supplier: string;
}

export interface StaffMember {
  id: string;
  name: string;
  department: string;
  role: string;
  grade: string;
  gross_salary: number;
  paye: number;
  pension_employee: number;
  pension_employer: number;
  nhf: number;
  nsitf: number;
  net_pay: number;
  bank: string;
  account_no: string;
  start_date: string;
  status: 'active' | 'suspended' | 'terminated';
}

export interface VatEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  type: 'output' | 'input';
  taxable_amount: number;
  vat_amount: number;
  rate: number;
  vendor_customer: string;
  status: 'filed' | 'pending';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  entity_id: string;
  before: string;
  after: string;
  ip: string;
  severity: 'info' | 'warning' | 'critical';
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT RECORDS  (PaymentRecords.tsx → records/PaymentRecords.tsx)
// ═══════════════════════════════════════════════════════════════════════════

export type TxStatus = 'SUCCESS' | 'FAILED' | 'PROCESSING' | 'PENDING' | string;
export type SortKey  = 'user_name' | 'amount' | 'status' | 'created_at' | 'paid_at';

export interface PaymentTransaction {
  id: string;
  user_email: string;
  user_name: string;
  reference: string;
  amount: number;
  currency: string;
  status: TxStatus;
  status_label: string;
  payment_method?: string | null;
  amount_verified: boolean;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════
// FINANCIAL DASHBOARD  (FinancialDashboard.tsx → dashboard/FinancialDashboard.tsx)
// ═══════════════════════════════════════════════════════════════════════════

export type NavSection =
  | 'overview'
  | 'intelligence'
  | 'forecast'
  | 'analytics'
  | 'pulse'
  | 'risk';
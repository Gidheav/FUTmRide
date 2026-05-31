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
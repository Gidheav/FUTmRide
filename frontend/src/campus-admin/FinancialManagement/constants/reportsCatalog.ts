import type { ReportCatalogResponse, ReportDefinition, ReportFormat } from '../types/financial.types';

export const REPORT_CATEGORIES = [
  { key: 'treasury', label: 'Platform Treasury', icon: 'account_balance' },
  { key: 'rides', label: 'Ride Economics', icon: 'local_taxi' },
  { key: 'gateway', label: 'Gateway & Payments', icon: 'account_balance_wallet' },
  { key: 'payouts', label: 'Driver Payouts', icon: 'send' },
  { key: 'disputes', label: 'Refunds & Disputes', icon: 'gavel' },
  { key: 'risk', label: 'Risk & Exceptions', icon: 'warning' },
  { key: 'compliance', label: 'Compliance & Audit', icon: 'policy' },
  { key: 'students', label: 'Student Wallet (Aggregate)', icon: 'school' },
  { key: 'operations', label: 'Operations & Fleet', icon: 'route' },
  { key: 'packages', label: 'Report Packages', icon: 'folder_zip' },
  { key: 'consent', label: 'Consent Statements', icon: 'verified_user' },
] as const;

const CATEGORY_ICON: Record<string, string> = Object.fromEntries(
  REPORT_CATEGORIES.map((c) => [c.key, c.icon]),
);

const ICON_OVERRIDES: Record<string, string> = {
  platform_ledger: 'receipt_long',
  commission_summary: 'bar_chart',
  monthly_revenue: 'calendar_month',
  gateway_reconciliation: 'account_balance_wallet',
  failed_topups: 'cancel',
  failed_transactions_master: 'cancel',
  dispute_register: 'gavel',
  open_disputes_aging: 'gavel',
  driver_withdrawal_summary: 'send',
  admin_audit_trail: 'policy',
  daily_ops_pack: 'folder_zip',
  weekly_finance_pack: 'folder_zip',
  monthly_board_pack: 'folder_zip',
};

type RawReport = {
  key: string;
  title: string;
  category: string;
  description: string;
  formats?: ReportFormat[];
  consent?: boolean;
};

const RAW: RawReport[] = [
  { key: 'platform_ledger', title: 'Platform Ledger', category: 'treasury', description: 'Anonymized platform event log.' },
  { key: 'commission_summary', title: 'Commission Summary', category: 'treasury', description: 'Platform commission totals and trends.' },
  { key: 'gross_ride_volume', title: 'Gross Ride Volume', category: 'treasury', description: 'Total fares processed (aggregate).' },
  { key: 'net_settlement', title: 'Net Settlement Position', category: 'treasury', description: 'Commission minus refunds and chargebacks.' },
  { key: 'daily_cash_position', title: 'Daily Cash Position', category: 'treasury', description: 'End-of-day money flow snapshot.' },
  { key: 'monthly_revenue', title: 'Monthly Revenue Statement', category: 'treasury', description: 'Formal monthly treasury statement.' },
  { key: 'quarterly_executive', title: 'Quarterly Executive Summary', category: 'treasury', description: 'Board-ready executive summary.' },
  { key: 'ytd_revenue', title: 'Year-to-Date Revenue', category: 'treasury', description: 'Fiscal YTD commission roll-up.' },
  { key: 'campus_comparison', title: 'Campus Comparison', category: 'treasury', description: 'Cross-campus revenue comparison.' },
  { key: 'revenue_by_vehicle', title: 'Revenue by Vehicle Type', category: 'treasury', description: 'Commission split by vehicle type.' },
  { key: 'completed_rides_register', title: 'Completed Rides Register', category: 'rides', description: 'Completed rides with fares and routes.' },
  { key: 'cancelled_rides_analysis', title: 'Cancelled Rides Analysis', category: 'rides', description: 'Cancellations and lost revenue.' },
  { key: 'avg_fare_trend', title: 'Average Fare Trend', category: 'rides', description: 'Average fare over time.' },
  { key: 'surge_impact', title: 'Surge Impact Report', category: 'rides', description: 'Revenue when surge multiplier > 1.' },
  { key: 'distance_duration_stats', title: 'Distance & Duration Stats', category: 'rides', description: 'Trip distance and duration aggregates.' },
  { key: 'peak_hours', title: 'Peak Hours Export', category: 'rides', description: 'Hourly ride volume data.' },
  { key: 'route_performance', title: 'Route Performance', category: 'rides', description: 'Top corridors by rides and commission.' },
  { key: 'no_show_summary', title: 'No-Show & Penalty Summary', category: 'rides', description: 'No-show fees collected.' },
  { key: 'completion_rate', title: 'Ride Completion Rate', category: 'rides', description: 'Completed vs total requested.' },
  { key: 'payment_method_mix', title: 'Payment Method Mix', category: 'rides', description: 'Wallet vs card vs cash breakdown.' },
  { key: 'gateway_reconciliation', title: 'Gateway Reconciliation', category: 'gateway', description: 'Paystack vs Flutterwave vs wallet credits.' },
  { key: 'topup_success_rate', title: 'Top-Up Success Rate', category: 'gateway', description: 'Gateway success/failure rates.' },
  { key: 'failed_topups', title: 'Failed Top-Ups Register', category: 'gateway', description: 'Failed and abandoned top-ups.' },
  { key: 'topup_by_channel', title: 'Top-Up by Channel', category: 'gateway', description: 'Volume by payment channel.' },
  { key: 'webhook_log', title: 'Webhook Processing Log', category: 'gateway', description: 'Webhook events received.' },
  { key: 'gateway_settlement_lag', title: 'Gateway Settlement Lag', category: 'gateway', description: 'Time from initiation to credit.' },
  { key: 'duplicate_idempotency', title: 'Duplicate Idempotency Audit', category: 'gateway', description: 'Duplicate reference detection.' },
  { key: 'chargeback_register', title: 'Chargeback & Reversal Register', category: 'gateway', description: 'Reversed gateway transactions.' },
  { key: 'driver_withdrawal_summary', title: 'Driver Withdrawal Summary', category: 'payouts', description: 'Aggregate driver payout totals.' },
  { key: 'pending_payouts', title: 'Pending Payouts Queue', category: 'payouts', description: 'Pending and processing withdrawals.' },
  { key: 'failed_payouts', title: 'Failed Payouts Register', category: 'payouts', description: 'Failed bank transfers.' },
  { key: 'payout_fees', title: 'Payout Fees & Costs', category: 'payouts', description: 'Transfer fees summary.' },
  { key: 'driver_earnings_pool', title: 'Driver Earnings Pool', category: 'payouts', description: 'Total driver earnings (aggregate).' },
  { key: 'commission_driver_share', title: 'Commission vs Driver Share', category: 'payouts', description: 'Platform vs driver split verification.' },
  { key: 'payout_sla', title: 'Payout SLA Report', category: 'payouts', description: 'Withdrawal processing times.' },
  { key: 'bank_distribution', title: 'Bank Distribution', category: 'payouts', description: 'Payouts by bank (masked).' },
  { key: 'dispute_register', title: 'Dispute Register', category: 'disputes', description: 'All disputed rides.' },
  { key: 'open_disputes_aging', title: 'Open Disputes Aging', category: 'disputes', description: 'Days open for unresolved disputes.' },
  { key: 'refunds_issued', title: 'Refunds Issued', category: 'disputes', description: 'Ride refunds credited to wallets.' },
  { key: 'refund_reason_analysis', title: 'Refund Reason Analysis', category: 'disputes', description: 'Refunds by cancellation type.' },
  { key: 'admin_refund_actions', title: 'Admin Refund Actions', category: 'disputes', description: 'Admin-initiated refunds audit.' },
  { key: 'dispute_resolution_sla', title: 'Dispute Resolution SLA', category: 'disputes', description: 'Time to resolve disputes.' },
  { key: 'failed_transactions_master', title: 'Failed Transactions Master', category: 'risk', description: 'All failed platform events.' },
  { key: 'needs_action_queue', title: 'Needs Action Queue', category: 'risk', description: 'Items requiring admin attention.' },
  { key: 'anomaly_detection', title: 'Anomaly Detection Export', category: 'risk', description: 'Unusual volume spikes.' },
  { key: 'wallet_integrity', title: 'Wallet Integrity Check', category: 'risk', description: 'Ledger consistency summary.' },
  { key: 'orphan_transactions', title: 'Orphan Transaction Scan', category: 'risk', description: 'Transactions without ride links.' },
  { key: 'stale_pending', title: 'Stale Pending Report', category: 'risk', description: 'Pending items older than threshold.' },
  { key: 'admin_audit_trail', title: 'Admin Audit Trail', category: 'compliance', description: 'Admin financial and security actions.' },
  { key: 'statement_access_log', title: 'Statement Access Log', category: 'compliance', description: 'Consented statement downloads.' },
  { key: 'report_generation_log', title: 'Report Generation Log', category: 'compliance', description: 'All report runs meta-audit.' },
  { key: 'ndpr_consent_register', title: 'NDPR Consent Register', category: 'compliance', description: 'Users with data consent flags.' },
  { key: 'role_access_changes', title: 'Role & Access Changes', category: 'compliance', description: 'Role change audit entries.' },
  { key: 'ip_session_audit', title: 'IP & Session Audit', category: 'compliance', description: 'Sensitive actions by IP.' },
  { key: 'student_topup_volume', title: 'Top-Up Volume (Students)', category: 'students', description: 'Aggregate student wallet top-ups.' },
  { key: 'student_ride_payment_volume', title: 'Ride Payment Volume', category: 'students', description: 'Aggregate wallet ride payments.' },
  { key: 'student_refund_volume', title: 'Refund Volume to Students', category: 'students', description: 'Aggregate student refunds.' },
  { key: 'promotional_credits', title: 'Promotional Credits Issued', category: 'students', description: 'Promotion credits summary.' },
  { key: 'rides_by_zone', title: 'Rides by Campus Zone', category: 'operations', description: 'Rides grouped by pickup area.' },
  { key: 'garage_scan_summary', title: 'Garage Scan-to-Pay Summary', category: 'operations', description: 'Garage ride payment summary.' },
  { key: 'drivers_vs_volume', title: 'Drivers vs Ride Volume', category: 'operations', description: 'Supply vs demand ratio.' },
  { key: 'vehicle_utilization', title: 'Vehicle Type Utilization', category: 'operations', description: 'Utilization by vehicle type.' },
  { key: 'daily_ops_pack', title: 'Daily Ops Pack', category: 'packages', description: 'Ledger + failed tx + open disputes.', formats: ['zip'] },
  { key: 'weekly_finance_pack', title: 'Weekly Finance Pack', category: 'packages', description: 'Commission + gateway recon + payouts.', formats: ['zip'] },
  { key: 'monthly_board_pack', title: 'Monthly Board Pack', category: 'packages', description: 'Executive summary + monthly revenue + audit.', formats: ['zip'] },
  { key: 'quarterly_compliance_pack', title: 'Quarterly Compliance Pack', category: 'packages', description: 'Audit + consent + reconciliation.', formats: ['zip'] },
  { key: 'incident_pack', title: 'Incident Pack', category: 'packages', description: 'Disputes + refunds + admin actions.', formats: ['zip'] },
  { key: 'driver_earnings_statement', title: 'Driver Earnings Statement', category: 'consent', description: 'Personal driver wallet statement.', consent: true },
  { key: 'driver_tax_summary', title: 'Driver Tax / Earnings Summary', category: 'consent', description: 'Annual-style earnings summary.', consent: true },
  { key: 'student_wallet_statement', title: 'Student Wallet Statement', category: 'consent', description: 'Personal student wallet statement.', consent: true },
  { key: 'single_ride_receipt', title: 'Single Ride Receipt', category: 'consent', description: 'Receipt for one ride.', consent: true },
];

/** Raw data / Excel-friendly exports — CSV first */
const CSV_FIRST_KEYS = new Set([
  'platform_ledger',
  'completed_rides_register',
  'failed_topups',
  'failed_transactions_master',
  'webhook_log',
  'gateway_settlement_lag',
  'duplicate_idempotency',
  'refunds_issued',
  'admin_refund_actions',
  'report_generation_log',
  'statement_access_log',
  'peak_hours',
  'route_performance',
]);

function formatsFor(key: string, consent?: boolean, explicit?: ReportFormat[]): ReportFormat[] {
  if (explicit) return explicit;
  if (key.endsWith('_pack')) return ['zip'];
  if (consent) return ['pdf', 'csv'];
  if (CSV_FIRST_KEYS.has(key)) return ['csv', 'xlsx', 'pdf'];
  return ['pdf', 'csv', 'xlsx'];
}

/** Banking default: PDF statements; CSV for operational dumps */
export function pickPrimaryFormat(report: ReportDefinition): ReportFormat {
  const { formats, key, consent_required: consent } = report;
  if (formats.length === 1) return formats[0];
  if (formats.includes('zip') && !formats.includes('pdf')) return 'zip';
  if (consent) return formats.includes('pdf') ? 'pdf' : formats[0];
  if (CSV_FIRST_KEYS.has(key)) return formats.includes('csv') ? 'csv' : formats[0];
  return formats.includes('pdf') ? 'pdf' : formats[0];
}

function buildReports(): ReportDefinition[] {
  return RAW.map((r) => ({
    key: r.key,
    title: r.title,
    category: r.category,
    description: r.description,
    formats: formatsFor(r.key, r.consent, r.formats),
    consent_required: r.consent ?? false,
    icon: ICON_OVERRIDES[r.key] ?? CATEGORY_ICON[r.category] ?? 'description',
  }));
}

export const REPORT_CATALOG_FALLBACK: ReportCatalogResponse = {
  categories: [...REPORT_CATEGORIES],
  reports: buildReports(),
  packages: {
    daily_ops_pack: ['platform_ledger', 'failed_transactions_master', 'open_disputes_aging'],
    weekly_finance_pack: ['commission_summary', 'gateway_reconciliation', 'driver_withdrawal_summary'],
    monthly_board_pack: ['monthly_revenue', 'quarterly_executive', 'admin_audit_trail'],
    quarterly_compliance_pack: ['admin_audit_trail', 'statement_access_log', 'gateway_reconciliation'],
    incident_pack: ['dispute_register', 'refunds_issued', 'admin_refund_actions'],
  },
};

/** Merge API catalog with local icons */
export function enrichCatalog(data: ReportCatalogResponse): ReportCatalogResponse {
  const fallbackByKey = Object.fromEntries(REPORT_CATALOG_FALLBACK.reports.map((r) => [r.key, r]));
  return {
    ...data,
    reports: data.reports.map((r) => {
      const fb = fallbackByKey[r.key];
      return {
        ...r,
        formats: fb?.formats ?? r.formats,
        icon: r.icon ?? fb?.icon ?? CATEGORY_ICON[r.category] ?? 'description',
      };
    }),
  };
}

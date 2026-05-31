// ─────────────────────────────────────────────────────────────────────────────
// financial.constants.ts
// Shared barrel — re-exports all sub-module constants for convenience.
// Import directly from the sub-files for tree-shaking in production.
// ─────────────────────────────────────────────────────────────────────────────

// Re-export all from hub.constants (with aliases for conflicting exports)
export {
  PERIODS,
  TABS,
  BUDGET_LINES,
  CAT_COLORS,
  STATUS_META as HUB_STATUS_META,
  DEF_STATUS,
  WSTATUS,
  STALE_MS,
  AVATAR_G,
  THIN as HUB_THIN,
  PANEL_W as HUB_PANEL_W,
  FH_CSS,
  MOCK_NAMES,
  MOCK_CATS,
  genMockTransactions,
  MOCK_TXS,
} from './hub.constants';

// Re-export all from records.constants (with aliases for conflicting exports)
export {
  PAGE_SIZE,
  STATUS_META as RECORDS_STATUS_META,
  DEFAULT_STATUS,
  THIN as RECORDS_THIN,
  PANEL_W as RECORDS_PANEL_W,
  AVATAR_COLORS,
} from './records.constants';

// Re-export all from reports.constants
export * from './reports.constants';

// Re-export all from dashboard.constants
export * from './dashboard.constants';

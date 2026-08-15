// ─────────────────────────────────────────────────────────────────────────────
// ReportsTab.tsx — Enterprise Reporting Center (55+ reports, schedules, consent)
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  Period,
  ReportCategory,
  ReportDefinition,
  ReportFormat,
  ReportRun,
  ScheduledReport,
  StatementAccessRequest,
  ConsentScope,
} from '../../types/financial.types';
import { fmtD } from '../../helpers/hub.helpers';
import { Card } from '../../components/Card';
import Icon from '../../../../components/common/Icon';
import apiService from '../../../../services/api.service';
import { pickPrimaryFormat, REPORT_CATALOG_FALLBACK } from '../../constants/reportsCatalog';
import { T } from '../../../theme';

type Panel = 'reports' | 'queue' | 'schedules' | 'consent';

const CATEGORY_COLORS: Record<string, string> = {
  treasury: '#8b5cf6',
  rides: '#10b981',
  gateway: '#3b82f6',
  payouts: '#64748b',
  disputes: '#f97316',
  risk: '#ef4444',
  compliance: '#0ea5e9',
  students: '#ec4899',
  operations: '#14b8a6',
  packages: '#a855f7',
  consent: '#eab308',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  running: '#3b82f6',
  success: '#10b981',
  failed: '#ef4444',
  approved: '#10b981',
  denied: '#ef4444',
};

const FORMAT_LABEL: Record<ReportFormat, string> = {
  csv: 'CSV',
  pdf: 'PDF',
  xlsx: 'XLSX',
  zip: 'ZIP',
};

function formatBytes(n: number): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const ReportsTab = memo(({
  period,
  onMetaChange,
  onRefreshReady,
}: {
  period: Period;
  onMetaChange?: (meta: { count: number; catalogLive: boolean }) => void;
  onRefreshReady?: (fn: () => void) => void;
}) => {
  const [panel, setPanel] = useState<Panel>('reports');
  const [category, setCategory] = useState<string>('all');
  const [catalog, setCatalog] = useState<ReportCategory[]>(REPORT_CATALOG_FALLBACK.categories);
  const [reports, setReports] = useState<ReportDefinition[]>(REPORT_CATALOG_FALLBACK.reports);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [consents, setConsents] = useState<StatementAccessRequest[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showConsentForm, setShowConsentForm] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    report_key: 'platform_ledger',
    format: 'csv' as ReportFormat,
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'quarterly',
    recipients: '',
  });

  const [consentForm, setConsentForm] = useState({
    subject_id: '',
    scope: 'driver_earnings' as ConsentScope,
    period_start: '',
    period_end: '',
    notes: '',
  });

  const loadCatalog = useCallback(async () => {
    const res = await apiService.getReportsCatalog();
    setCatalog(res.categories);
    setReports(res.reports);
    onMetaChange?.({ count: res.reports.length, catalogLive: Boolean(res.fromApi) });
  }, [onMetaChange]);

  const loadRuns = useCallback(async () => {
    try {
      const res = await apiService.listReportRuns(30);
      setRuns(res.results);
    } catch {
      setRuns([]);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      const res = await apiService.listScheduledReports();
      setSchedules(res.results);
    } catch {
      setSchedules([]);
    }
  }, []);

  const loadConsents = useCallback(async () => {
    try {
      const res = await apiService.listConsentRequests();
      setConsents(res.results);
    } catch {
      setConsents([]);
    }
  }, []);

  const refreshAll = useCallback(() => {
    loadCatalog();
    loadRuns();
    loadSchedules();
    loadConsents();
  }, [loadCatalog, loadRuns, loadSchedules, loadConsents]);

  useEffect(() => {
    onRefreshReady?.(refreshAll);
  }, [onRefreshReady, refreshAll]);

  useEffect(() => {
    onMetaChange?.({ count: REPORT_CATALOG_FALLBACK.reports.length, catalogLive: false });
  }, [onMetaChange]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const hasActiveRuns = runs.some((r) => r.status === 'pending' || r.status === 'running');

  useEffect(() => {
    if (hasActiveRuns) {
      pollRef.current = setInterval(loadRuns, 3000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasActiveRuns, loadRuns]);

  const filteredReports = useMemo(() => {
    let list = reports;
    if (category !== 'all') list = list.filter((r) => r.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [reports, category, search]);

  useEffect(() => {
    setExpandedCardKey(null);
  }, [category, search, panel]);

  const handleGenerate = useCallback(async (report: ReportDefinition, format: ReportFormat) => {
    const key = `${report.key}:${format}`;
    setGenerating(key);
    try {
      if (report.key === 'platform_ledger' && format === 'csv') {
        await apiService.downloadLedgerExport({ period });
        return;
      }
      if (report.key === 'failed_topups' && format === 'csv') {
        await apiService.downloadLedgerExport({ period, status: 'FAILED' });
        return;
      }
      if (report.key === 'dispute_register' && format === 'csv') {
        await apiService.downloadLedgerExport({ period, source: 'DISPUTE' });
        return;
      }
      if (report.key === 'commission_summary' && format === 'csv') {
        await apiService.downloadLedgerExport({ period, source: 'RIDE' });
        return;
      }

      const run = await apiService.generateReport({
        report_key: report.key,
        format,
        period,
        async: false,
      });
      setRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)]);
      setPanel('queue');
      if (run.status === 'success' && run.has_file) {
        const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : format === 'zip' ? 'zip' : 'csv';
        await apiService.downloadReportRun(run.id, `${run.report_key}_${run.period.toLowerCase()}.${ext}`);
      }
    } catch {
      /* silent */
    } finally {
      setGenerating(null);
    }
  }, [period]);

  const handleDownloadRun = useCallback(async (run: ReportRun) => {
    if (run.status !== 'success' || !run.has_file) return;
    const ext = run.format === 'xlsx' ? 'xlsx' : run.format === 'pdf' ? 'pdf' : run.format === 'zip' ? 'zip' : 'csv';
    await apiService.downloadReportRun(run.id, `${run.report_key}_${run.period.toLowerCase()}.${ext}`);
  }, []);

  const handleCreateSchedule = useCallback(async () => {
    if (!scheduleForm.name.trim()) return;
    try {
      await apiService.createScheduledReport({
        name: scheduleForm.name,
        report_key: scheduleForm.report_key,
        format: scheduleForm.format,
        period,
        frequency: scheduleForm.frequency,
        recipients: scheduleForm.recipients.split(',').map((e) => e.trim()).filter(Boolean),
      });
      setShowScheduleForm(false);
      setScheduleForm((f) => ({ ...f, name: '', recipients: '' }));
      loadSchedules();
    } catch {
      /* silent */
    }
  }, [scheduleForm, period, loadSchedules]);

  const handleCreateConsent = useCallback(async () => {
    if (!consentForm.subject_id || !consentForm.period_start || !consentForm.period_end) return;
    try {
      await apiService.createConsentRequest({
        subject_id: consentForm.subject_id,
        scope: consentForm.scope,
        period_start: new Date(consentForm.period_start).toISOString(),
        period_end: new Date(consentForm.period_end).toISOString(),
        notes: consentForm.notes,
      });
      setShowConsentForm(false);
      setConsentForm({ subject_id: '', scope: 'driver_earnings', period_start: '', period_end: '', notes: '' });
      loadConsents();
    } catch {
      /* silent */
    }
  }, [consentForm, loadConsents]);

  const sidebarItems: { key: Panel; label: string; icon: string }[] = [
    { key: 'reports', label: 'Report Toolkit', icon: 'grid_view' },
    { key: 'queue', label: 'Generation Queue', icon: 'hourglass_top' },
    { key: 'schedules', label: 'Schedules', icon: 'schedule_send' },
    { key: 'consent', label: 'Consent Center', icon: 'verified_user' },
  ];

  return (
    <div className="fh-reports-layout">
        {/* Sidebar */}
        <Card className="fh-reports-sidebar p-3">
          <nav className="fh-reports-nav">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPanel(item.key)}
                className={`fh-reports-nav-btn${panel === item.key ? ' is-active' : ''}`}
              >
                <Icon name={item.icon} size={14} color={panel === item.key ? '#34d399' : '#64748b'} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.key === 'queue' && hasActiveRuns && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa' }} />
                )}
              </button>
            ))}
          </nav>

          {panel === 'reports' && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                Categories
              </p>
              <div className="fh-reports-nav">
                <button
                  type="button"
                  onClick={() => setCategory('all')}
                  className={`fh-reports-cat-btn${category === 'all' ? ' is-active' : ''}`}
                >
                  All Reports
                </button>
                {catalog.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`fh-reports-cat-btn${category === c.key ? ' is-active' : ''}`}
                  >
                    <Icon name={c.icon} size={12} color={CATEGORY_COLORS[c.key]} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Main panel */}
        <div className="fh-reports-main">
          {panel === 'reports' && (
            <>
              <div className="fh-report-search-bar">
                <div className="fh-report-search-wrap">
                  <span className="fh-report-search-icon" aria-hidden>
                    <Icon name="search" size={16} color="#64748b" />
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by report name or description…"
                    className="fh-report-search-input"
                    aria-label="Search reports"
                  />
                  {search ? (
                    <button
                      type="button"
                      className="fh-report-search-clear"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                    >
                      <Icon name="close" size={14} color="#94a3b8" />
                    </button>
                  ) : null}
                </div>
                <span className="fh-report-search-meta">
                  {filteredReports.length} of {reports.length} reports
                </span>
              </div>

              <div className="fh-reports-grid">
                {filteredReports.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '4rem 1rem', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No reports match your search</p>
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        style={{ marginTop: 12, fontSize: 11, color: '#34d399', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Clear search
                      </button>
                    ) : null}
                  </div>
                ) : filteredReports.map((r) => {
                  const color = CATEGORY_COLORS[r.category] || '#64748b';
                  const primaryFmt = pickPrimaryFormat(r);
                  const altFormats = r.formats.filter((f) => f !== primaryFmt);
                  const genKey = `${r.key}:${primaryFmt}`;
                  const icon = r.icon || 'description';
                  const isLedgerCsv =
                    (r.key === 'platform_ledger' || r.key === 'commission_summary' || r.key === 'failed_topups' || r.key === 'dispute_register')
                    && primaryFmt === 'csv';
                  const isExpanded = expandedCardKey === r.key;
                  const showAltFormats = !r.consent_required && altFormats.length > 0;

                  const handleCardBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    if (!showAltFormats) return;
                    setExpandedCardKey((k) => (k === r.key ? null : r.key));
                  };

                  return (
                    <Card
                      key={r.key}
                      className={`fh-report-card${isExpanded ? ' is-expanded' : ''}${showAltFormats ? ' is-selectable' : ''}`}
                      glow={color}
                    >
                      <div
                        className="fh-report-card-accent"
                        style={{ background: `linear-gradient(90deg, ${color}cc, ${color}33)` }}
                      />
                      <div
                        className="fh-report-card-body"
                        onClick={handleCardBodyClick}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          if ((e.target as HTMLElement).closest('button')) return;
                          if (!showAltFormats) return;
                          e.preventDefault();
                          setExpandedCardKey((k) => (k === r.key ? null : r.key));
                        }}
                        role={showAltFormats ? 'button' : undefined}
                        tabIndex={showAltFormats ? 0 : undefined}
                        aria-expanded={showAltFormats ? isExpanded : undefined}
                      >
                        <div className="fh-report-card-head">
                          <div className="fh-report-card-iconbox" style={{ background: `${color}22` }}>
                            <Icon name={icon} size={18} color={color} />
                          </div>
                          <span
                            className="fh-report-card-badge"
                            style={{ color, borderColor: `${color}55`, background: `${color}18` }}
                          >
                            {FORMAT_LABEL[primaryFmt]}
                          </span>
                        </div>
                        <h3 className="fh-report-card-title">{r.title}</h3>
                        <p className="fh-report-card-desc">{r.description}</p>
                        {r.consent_required ? (
                          <p className="fh-report-card-consent">Consent required — use Consent Center</p>
                        ) : null}
                        <button
                          type="button"
                          disabled={!!generating || r.consent_required}
                          onClick={() => !r.consent_required && handleGenerate(r, primaryFmt)}
                          className="fh-report-card-btn"
                          style={
                            generating === genKey
                              ? { background: '#0f1525', color: '#64748b', borderColor: '#1e293b' }
                              : r.consent_required
                                ? { background: '#0f1525', color: '#64748b', borderColor: '#334155' }
                                : { background: `${color}22`, color, borderColor: `${color}55` }
                          }
                        >
                          {generating === genKey ? (
                            <>
                              <span className="fh-spin" style={{ width: 12, height: 12, border: '2px solid #475569', borderTopColor: '#94a3b8', borderRadius: '50%', display: 'inline-block' }} />
                              GENERATING…
                            </>
                          ) : r.consent_required ? (
                            <>
                              <Icon name="lock" size={12} color="#64748b" />
                              CONSENT CENTER
                            </>
                          ) : (
                            <>
                              <Icon name={isLedgerCsv ? 'download' : primaryFmt === 'pdf' ? 'description' : 'play_arrow'} size={12} color={color} />
                              {isLedgerCsv ? 'DOWNLOAD' : 'GENERATE'} {FORMAT_LABEL[primaryFmt]}
                            </>
                          )}
                        </button>
                        {showAltFormats && isExpanded && (
                          <div className="fh-report-card-alt">
                            <span className="fh-report-card-alt-label">Also:</span>
                            {altFormats.map((fmt) => (
                              <button
                                key={fmt}
                                type="button"
                                disabled={!!generating}
                                onClick={() => handleGenerate(r, fmt)}
                                className="fh-report-card-alt-btn"
                              >
                                {FORMAT_LABEL[fmt]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {panel === 'queue' && (
            <Card className="flex-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">Generation Queue</span>
                <button type="button" onClick={loadRuns} className="text-[10px] font-sans text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
                  <Icon name="refresh" size={12} />REFRESH
                </button>
              </div>
              <div className="divide-y divide-slate-800/60 max-h-[520px] overflow-y-auto">
                {runs.length === 0 ? (
                  <div className="p-10 text-center text-[11px] font-sans text-slate-600">No report runs yet</div>
                ) : runs.map((run) => (
                  <div key={run.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-800/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-sans font-semibold text-slate-300 truncate">{run.report_title}</p>
                      <p className="text-[9px] font-sans text-slate-600 mt-0.5">
                        {run.format.toUpperCase()} · {run.period} · {run.row_count} rows · {formatBytes(run.file_size)}
                      </p>
                      {run.error_message && (
                        <p className="text-[9px] font-sans text-red-400 mt-1 truncate">{run.error_message}</p>
                      )}
                    </div>
                    <span
                      className="text-[8px] font-sans font-semibold uppercase px-2 py-0.5 rounded border shrink-0"
                      style={{
                        color: STATUS_COLORS[run.status] || '#64748b',
                        borderColor: `${STATUS_COLORS[run.status] || '#64748b'}44`,
                        background: `${STATUS_COLORS[run.status] || '#64748b'}11`,
                      }}
                    >
                      {run.status}
                    </span>
                    {run.status === 'success' && run.has_file && (
                      <button
                        type="button"
                        onClick={() => handleDownloadRun(run)}
                        className="shrink-0 h-7 px-2 rounded-lg text-[9px] font-sans font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1"
                      >
                        <Icon name="download" size={12} />DL
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {panel === 'schedules' && (
            <Card className="flex-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">Scheduled Reports</span>
                <button
                  type="button"
                  onClick={() => setShowScheduleForm((v) => !v)}
                  className="text-[10px] font-sans text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                >
                  <Icon name="add" size={12} />NEW SCHEDULE
                </button>
              </div>

              {showScheduleForm && (
                <div className="p-4 border-b border-slate-800 bg-slate-900/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Schedule name"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-sans text-slate-300"
                  />
                  <select
                    value={scheduleForm.report_key}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, report_key: e.target.value }))}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-sans text-slate-300"
                  >
                    {reports.filter((r) => !r.consent_required).map((r) => (
                      <option key={r.key} value={r.key}>{r.title}</option>
                    ))}
                  </select>
                  <select
                    value={scheduleForm.frequency}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, frequency: e.target.value as typeof f.frequency }))}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-sans text-slate-300"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Email recipients (comma-separated)"
                    value={scheduleForm.recipients}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, recipients: e.target.value }))}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-sans text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSchedule}
                    className="sm:col-span-2 h-8 rounded-lg text-[10px] font-sans font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
                  >
                    CREATE SCHEDULE
                  </button>
                </div>
              )}

              <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto">
                {schedules.length === 0 ? (
                  <div className="p-10 text-center text-[11px] font-sans text-slate-600">No scheduled reports configured</div>
                ) : schedules.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-sans font-semibold text-slate-300">{s.name}</p>
                      <p className="text-[9px] font-sans text-slate-600 mt-0.5">
                        {s.frequency} · {s.format.toUpperCase()} · {s.period}
                        {s.next_run_at && ` · Next: ${fmtD(s.next_run_at)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiService.updateScheduledReport(s.id, { is_active: !s.is_active });
                        loadSchedules();
                      }}
                      className={`text-[8px] font-sans font-semibold px-2 py-0.5 rounded border ${s.is_active ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-500 border-slate-700'}`}
                    >
                      {s.is_active ? 'ACTIVE' : 'PAUSED'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => { await apiService.deleteScheduledReport(s.id); loadSchedules(); }}
                      className="text-slate-600 hover:text-red-400"
                    >
                      <Icon name="delete" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {panel === 'consent' && (
            <Card className="flex-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">Consent Center</span>
                <button
                  type="button"
                  onClick={() => setShowConsentForm((v) => !v)}
                  className="text-[10px] font-sans text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                >
                  <Icon name="add" size={12} />REQUEST ACCESS
                </button>
              </div>

              {showConsentForm && (
                <div className="p-4 border-b border-slate-800 bg-slate-900/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Subject user UUID"
                    value={consentForm.subject_id}
                    onChange={(e) => setConsentForm((f) => ({ ...f, subject_id: e.target.value }))}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-sans text-slate-300"
                  />
                  <select
                    value={consentForm.scope}
                    onChange={(e) => setConsentForm((f) => ({ ...f, scope: e.target.value as ConsentScope }))}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-sans text-slate-300"
                  >
                    <option value="driver_earnings">Driver Earnings</option>
                    <option value="student_wallet">Student Wallet</option>
                    <option value="single_ride">Single Ride</option>
                  </select>
                  <input
                    type="date"
                    value={consentForm.period_start}
                    onChange={(e) => setConsentForm((f) => ({ ...f, period_start: e.target.value }))}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-sans text-slate-300"
                  />
                  <input
                    type="date"
                    value={consentForm.period_end}
                    onChange={(e) => setConsentForm((f) => ({ ...f, period_end: e.target.value }))}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-sans text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleCreateConsent}
                    className="sm:col-span-2 h-8 rounded-lg text-[10px] font-sans font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
                  >
                    SUBMIT CONSENT REQUEST
                  </button>
                </div>
              )}

              <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto">
                {consents.length === 0 ? (
                  <div className="p-10 text-center text-[11px] font-sans text-slate-600">No consent requests</div>
                ) : consents.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-sans font-semibold text-slate-300">{c.subject_name} · {c.scope.replace('_', ' ')}</p>
                      <p className="text-[9px] font-sans text-slate-600 mt-0.5">
                        {fmtD(c.period_start)} – {fmtD(c.period_end)} · Downloads: {c.download_count}
                      </p>
                    </div>
                    <span
                      className="text-[8px] font-sans font-semibold uppercase px-2 py-0.5 rounded border"
                      style={{
                        color: STATUS_COLORS[c.status] || '#64748b',
                        borderColor: `${STATUS_COLORS[c.status] || '#64748b'}44`,
                      }}
                    >
                      {c.status}
                    </span>
                    {c.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={async () => { await apiService.approveConsentRequest(c.id); loadConsents(); }}
                          className="text-[9px] font-sans font-semibold text-emerald-400 px-2 py-1 rounded border border-emerald-500/30"
                        >
                          APPROVE
                        </button>
                        <button
                          type="button"
                          onClick={async () => { await apiService.denyConsentRequest(c.id); loadConsents(); }}
                          className="text-[9px] font-sans font-semibold text-red-400 px-2 py-1 rounded border border-red-500/30"
                        >
                          DENY
                        </button>
                      </>
                    )}
                    {c.status === 'approved' && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const run = await apiService.generateConsentStatement(c.id, 'pdf');
                            setRuns((prev) => [run, ...prev]);
                            setPanel('queue');
                            loadConsents();
                            if (run.status === 'success' && run.has_file) {
                              await apiService.downloadReportRun(run.id);
                            }
                          } catch {
                            /* silent */
                          }
                        }}
                        className="text-[9px] font-sans font-semibold text-blue-400 px-2 py-1 rounded border border-blue-500/30 flex items-center gap-1"
                      >
                        <Icon name="description" size={12} />GENERATE PDF
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
    </div>
  );
});
ReportsTab.displayName = 'ReportsTab';

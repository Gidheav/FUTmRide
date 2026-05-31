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

export const ReportsTab = memo(({ period }: { period: Period }) => {
  const [panel, setPanel] = useState<Panel>('reports');
  const [category, setCategory] = useState<string>('all');
  const [catalog, setCatalog] = useState<ReportCategory[]>([]);
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [consents, setConsents] = useState<StatementAccessRequest[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
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
    try {
      const res = await apiService.getReportsCatalog();
      setCatalog(res.categories);
      setReports(res.reports);
    } catch {
      setCatalog([]);
      setReports([]);
    }
  }, []);

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

  useEffect(() => {
    loadCatalog();
    loadRuns();
    loadSchedules();
    loadConsents();
  }, [loadCatalog, loadRuns, loadSchedules, loadConsents]);

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

  const handleGenerate = useCallback(async (report: ReportDefinition, format: ReportFormat) => {
    const key = `${report.key}:${format}`;
    setGenerating(key);
    try {
      const run = await apiService.generateReport({
        report_key: report.key,
        format,
        period,
        async: false,
      });
      setRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)]);
      setPanel('queue');
      if (run.status === 'success' && run.has_file) {
        await apiService.downloadReportRun(run.id);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-display font-semibold text-slate-800 dark:text-slate-300">Reporting Center</h2>
          <p className="text-[10px] font-sans text-slate-600 mt-0.5">
            {reports.length} platform reports · banking-style privacy · consent for personal statements
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-sans text-slate-600">
          <Icon name="schedule" size={12} />
          <span>Period: {period} · {fmtD(new Date().toISOString())}</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-2 min-h-[520px]">
        {/* Sidebar */}
        <Card className="lg:w-52 shrink-0 p-3">
          <nav className="flex flex-col gap-1">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPanel(item.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-sans font-semibold transition-all text-left ${
                  panel === item.key
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <Icon name={item.icon} size={14} />
                {item.label}
                {item.key === 'queue' && hasActiveRuns && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                )}
              </button>
            ))}
          </nav>

          {panel === 'reports' && (
            <div className="mt-4 pt-3 border-t border-slate-800">
              <p className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest mb-2">Categories</p>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setCategory('all')}
                  className={`text-left px-2 py-1.5 rounded text-[10px] font-sans ${category === 'all' ? 'text-emerald-400 bg-slate-800/60' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  All Reports
                </button>
                {catalog.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`text-left px-2 py-1.5 rounded text-[10px] font-sans flex items-center gap-1.5 ${category === c.key ? 'text-emerald-400 bg-slate-800/60' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Icon name={c.icon} size={12} style={{ color: CATEGORY_COLORS[c.key] }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Main panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {panel === 'reports' && (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search reports…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] font-sans text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                </div>
                <span className="text-[10px] font-sans text-slate-600 shrink-0">{filteredReports.length} reports</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredReports.map((r) => {
                  const color = CATEGORY_COLORS[r.category] || '#64748b';
                  const primaryFmt = r.formats[0] || 'csv';
                  const genKey = `${r.key}:${primaryFmt}`;
                  return (
                    <Card key={r.key} className="overflow-hidden hover:border-slate-700 transition-all group" glow={color}>
                      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}80, ${color}20)` }} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-[11px] font-sans font-semibold text-slate-200 leading-snug pr-2">{r.title}</h3>
                          {r.consent_required && (
                            <span className="text-[8px] font-sans font-semibold text-amber-400 border border-amber-500/30 rounded px-1 py-0.5 shrink-0">CONSENT</span>
                          )}
                        </div>
                        <p className="text-[9px] font-sans text-slate-600 leading-relaxed mb-3 line-clamp-2">{r.description}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {r.formats.map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              disabled={!!generating || r.consent_required}
                              onClick={() => !r.consent_required && handleGenerate(r, fmt)}
                              className="text-[8px] font-sans font-semibold border rounded px-1.5 py-0.5 transition-all hover:opacity-80 disabled:opacity-40"
                              style={{ color, borderColor: `${color}44`, background: `${color}11` }}
                            >
                              {FORMAT_LABEL[fmt]}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={generating === genKey || r.consent_required}
                          onClick={() => !r.consent_required && handleGenerate(r, primaryFmt)}
                          className="w-full h-7 rounded-lg text-[9px] font-sans font-semibold transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                          style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                        >
                          {generating === genKey
                            ? <><div className="w-3 h-3 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />GENERATING…</>
                            : r.consent_required
                              ? <><Icon name="lock" size={11} />VIA CONSENT CENTER</>
                              : <><Icon name="play_arrow" size={11} />GENERATE {FORMAT_LABEL[primaryFmt]}</>}
                        </button>
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
    </div>
  );
});
ReportsTab.displayName = 'ReportsTab';

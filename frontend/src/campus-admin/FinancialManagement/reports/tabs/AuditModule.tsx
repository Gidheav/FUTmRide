// ─────────────────────────────────────────────────────────────────────────────
// AuditModule.tsx — Audit tab for FinancialReports
// Controls, audit trail, findings, risk register
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, memo } from 'react';
import Icon from '../../../../components/common/Icon';

const G = '#10b981';

const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: decimals }).format(n);

const fmtShort = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtDT = (s: string) => s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const compact = (n: number): string => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return ngn(n);
};

const SCard = memo(({ children, className = '', style = {} }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div className={`fs-card relative overflow-hidden ${className}`} style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.25)', ...style }}>
    {children}
  </div>
));
SCard.displayName = 'SCard';

const SBar = memo(({ v, color = G, h = 4 }: { v: number; color?: string; h?: number }) => (
  <div className="fs-bar-track w-full rounded-full overflow-hidden" style={{ height: h }}>
    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, v))}%`, background: color }} />
  </div>
));
SBar.displayName = 'SBar';

const Pill = memo(({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
    style={{ color, background: bg, border: `1px solid ${color}33` }}>
    {label}
  </span>
));
Pill.displayName = 'Pill';

// Controls assessment
const controls = [
  { id: 'CTL-001', name: 'Bank Reconciliation', area: 'Cash Management', effectiveness: 'effective', last_tested: '2025-05-15', tester: 'Finance Mgr', findings: 0, trend: 'stable', icon: 'account_balance' },
  { id: 'CTL-002', name: 'Segregation of Duties', area: 'Authorization', effectiveness: 'effective', last_tested: '2025-04-20', tester: 'Internal Audit', findings: 0, trend: 'improving', icon: 'group' },
  { id: 'CTL-003', name: 'Purchase Approval Limits', area: 'Procurement', effectiveness: 'partial', last_tested: '2025-05-01', tester: 'Admin', findings: 2, trend: 'declining', icon: 'shopping_cart' },
  { id: 'CTL-004', name: 'Petty Cash Controls', area: 'Cash Management', effectiveness: 'effective', last_tested: '2025-05-10', tester: 'Finance Mgr', findings: 0, trend: 'stable', icon: 'payments' },
  { id: 'CTL-005', name: 'Payroll Authorization', area: 'HR/Payroll', effectiveness: 'effective', last_tested: '2025-04-30', tester: 'HR Director', findings: 0, trend: 'stable', icon: 'people' },
  { id: 'CTL-006', name: 'Fixed Asset Tagging', area: 'Asset Management', effectiveness: 'partial', last_tested: '2025-03-15', tester: 'Facility Mgr', findings: 3, trend: 'stable', icon: 'computer' },
  { id: 'CTL-007', name: 'Journal Entry Approval', area: 'General Ledger', effectiveness: 'effective', last_tested: '2025-05-05', tester: 'Finance Mgr', findings: 0, trend: 'stable', icon: 'description' },
  { id: 'CTL-008', name: 'Donor Receipting', area: 'Revenue', effectiveness: 'effective', last_tested: '2025-05-12', tester: 'Finance Mgr', findings: 0, trend: 'improving', icon: 'receipt' },
];

// Audit trail
const auditTrail = [
  { id: 'AUD-001', timestamp: '2025-05-30T14:23:00', user: 'Rev. Dr. John Adeyemi', action: 'Approved Budget V3', module: 'Budget', ip: '192.168.1.101', status: 'success' },
  { id: 'AUD-002', timestamp: '2025-05-30T11:45:22', user: 'Mrs. Grace Chukwu', action: 'Created Bill #BILL-008', module: 'Payables', ip: '192.168.1.105', status: 'success' },
  { id: 'AUD-003', timestamp: '2025-05-29T16:30:15', user: 'Mr. Emmanuel Okonkwo', action: 'Posted Journal Entry #JE-2025-056', module: 'Ledger', ip: '192.168.1.103', status: 'success' },
  { id: 'AUD-004', timestamp: '2025-05-29T10:12:08', user: 'Mrs. Grace Chukwu', action: 'Initiated Withdrawal ₦500,000', module: 'Treasury', ip: '192.168.1.105', status: 'success' },
  { id: 'AUD-005', timestamp: '2025-05-28T09:55:33', user: 'Mr. Emmanuel Okonkwo', action: 'Reconciled Bank Statement (GTB)', module: 'Cash', ip: '192.168.1.103', status: 'success' },
  { id: 'AUD-006', timestamp: '2025-05-27T15:42:19', user: 'Admin System', action: 'Auto-reversal of failed transaction', module: 'Payments', ip: 'System', status: 'success' },
  { id: 'AUD-007', timestamp: '2025-05-26T11:20:45', user: 'Miss Sarah Musa', action: 'Exported Giving Report (May)', module: 'Reports', ip: '192.168.1.108', status: 'success' },
  { id: 'AUD-008', timestamp: '2025-05-25T08:30:00', user: 'Mr. Emmanuel Okonkwo', action: 'Updated Chart of Accounts', module: 'Ledger', ip: '192.168.1.103', status: 'success' },
];

// Findings
const findings = [
  { id: 'FIND-001', title: 'Purchase orders not consistently raised for procurement < ₦50k', severity: 'medium', area: 'Procurement', status: 'open', due_date: '2025-06-15', owner: 'Adminstrator', raised_date: '2025-05-01', description: 'Small purchases bypassing PO process.' },
  { id: 'FIND-002', title: 'Fixed asset register incomplete — 3 items not tagged', severity: 'low', area: 'Asset Management', status: 'in_progress', due_date: '2025-06-30', owner: 'Facility Manager', raised_date: '2025-03-15', description: 'Missing asset tags from 2023 donation.' },
  { id: 'FIND-003', title: 'Approval limits exceeded without escalation (x2)', severity: 'high', area: 'Authorization', status: 'open', due_date: '2025-06-01', owner: 'Senior Pastor', raised_date: '2025-05-10', description: 'Two transactions exceeded ₦500k limit without board approval.' },
];

// Risk register
const risks = [
  { id: 'RSK-001', title: 'Insufficient insurance coverage for assets', likelihood: 'medium', impact: 'high', score: 12, status: 'active', mitigation: 'Review insurance portfolio Q3 2025', owner: 'Finance Board' },
  { id: 'RSK-002', title: 'Key person dependency (Finance Mgr)', likelihood: 'high', impact: 'medium', score: 10, status: 'active', mitigation: 'Cross-train admin staff', owner: 'HR Director' },
  { id: 'RSK-003', title: 'Cybersecurity — cloud financial system', likelihood: 'low', impact: 'high', score: 6, status: 'active', mitigation: '2FA, audit logs, backup', owner: 'IT Coordinator' },
  { id: 'RSK-004', title: 'Regulatory non-compliance (tax filings)', likelihood: 'low', impact: 'medium', score: 4, status: 'active', mitigation: 'Calendar alerts, professional adviser', owner: 'Finance Mgr' },
];

const AuditModule: React.FC = () => {
  const [view, setView] = useState<'controls' | 'trail' | 'findings' | 'risks'>('controls');

  const effectiveCount = controls.filter(c => c.effectiveness === 'effective').length;
  const partialCount = controls.filter(c => c.effectiveness === 'partial').length;
  const openFindings = findings.filter(f => f.status === 'open').length;

  const getScoreColor = (score: number) => {
    if (score >= 12) return '#ef4444';
    if (score >= 8) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden fs-slide">
      <div className="fs-toolbar px-5 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border fs-divider">
          {([
            ['controls', 'Controls'],
            ['trail', 'Audit Trail'],
            ['findings', 'Findings'],
            ['risks', 'Risk Register']
          ] as [typeof view, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 text-[11px] font-bold transition-all ${view === k ? 'text-black' : 'fs-text3 hover:fs-text2'}`}
              style={view === k ? { background: G } : {}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Effective Controls', v: `${effectiveCount}/${controls.length}`, c: '#10b981', i: 'verified_user' },
          { l: 'Partial Controls', v: partialCount.toString(), c: '#f59e0b', i: 'warning' },
          { l: 'Open Findings', v: openFindings.toString(), c: '#f87171', i: 'bug_report' },
          { l: 'Active Risks', v: risks.length.toString(), c: '#8b5cf6', i: 'gavel' }
        ].map(k => (
          <SCard key={k.l} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] fs-text3 uppercase font-bold tracking-widest">{k.l}</span>
              <Icon name={k.i} size={12} style={{ color: k.c }} />
            </div>
            <p className="text-lg font-black font-mono" style={{ color: k.c }}>{k.v}</p>
          </SCard>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
        {view === 'controls' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Internal Controls Assessment</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[800px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['CONTROL', 'AREA', 'EFFECTIVENESS', 'LAST TESTED', 'TESTER', 'FINDINGS', 'TREND'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {controls.map((c, i) => (
                      <tr key={c.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Icon name={c.icon} size={14} className="fs-text3" />
                            <span className="text-xs font-bold fs-text1">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><span className="text-[10px] fs-text3">{c.area}</span></td>
                        <td className="px-4 py-2.5">
                          <Pill 
                            label={c.effectiveness.toUpperCase()} 
                            color={c.effectiveness === 'effective' ? '#10b981' : '#f59e0b'} 
                            bg={c.effectiveness === 'effective' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'} 
                          />
                        </td>
                        <td className="px-4 py-2.5"><span className="text-[10px] font-mono fs-text3">{fmtShort(c.last_tested)}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[10px] fs-text3">{c.tester}</span></td>
                        <td className="px-4 py-2.5"><span className={`text-[10px] font-mono font-bold ${c.findings > 0 ? 'text-red-400' : 'fs-text3'}`}>{c.findings}</span></td>
                        <td className="px-4 py-2.5">
                          <Icon 
                            name={c.trend === 'improving' ? 'trending_up' : c.trend === 'declining' ? 'trending_down' : 'trending_flat'} 
                            size={14} 
                            className={c.trend === 'improving' ? 'text-emerald-400' : c.trend === 'declining' ? 'text-red-400' : 'fs-text3'} 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SCard>
          </div>
        )}

        {view === 'trail' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-xs font-bold fs-text2">Audit Trail (Recent Activity)</p>
                <button className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                  <Icon name="download" size={11} />EXPORT LOG
                </button>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[750px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['TIMESTAMP', 'USER', 'ACTION', 'MODULE', 'IP ADDRESS', 'STATUS'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditTrail.map((a, i) => (
                      <tr key={a.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-2.5"><span className="text-[10px] font-mono fs-text3">{fmtDT(a.timestamp)}</span></td>
                        <td className="px-4 py-2.5"><span className="text-xs font-bold fs-text1">{a.user}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[10px] fs-text3">{a.action}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[10px] fs-text3">{a.module}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[10px] font-mono fs-text3">{a.ip}</span></td>
                        <td className="px-4 py-2.5">
                          <Pill label={a.status.toUpperCase()} color="#10b981" bg="rgba(16,185,129,0.12)" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SCard>
          </div>
        )}

        {view === 'findings' && (
          <div className="p-5 space-y-3">
            {findings.map(f => (
              <SCard key={f.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Pill 
                        label={f.severity.toUpperCase()} 
                        color={f.severity === 'high' ? '#ef4444' : f.severity === 'medium' ? '#f59e0b' : '#64748b'} 
                        bg={f.severity === 'high' ? 'rgba(239,68,68,0.12)' : f.severity === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)'} 
                      />
                      <span className="text-xs font-bold fs-text1">{f.title}</span>
                    </div>
                    <Pill 
                      label={f.status === 'open' ? 'OPEN' : f.status === 'in_progress' ? 'IN PROGRESS' : 'CLOSED'} 
                      color={f.status === 'open' ? '#ef4444' : f.status === 'in_progress' ? '#f59e0b' : '#10b981'} 
                      bg={f.status === 'open' ? 'rgba(239,68,68,0.12)' : f.status === 'in_progress' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'} 
                    />
                  </div>
                  <div className="flex gap-4 text-[10px] fs-text3 mt-2">
                    <span>Area: <span className="fs-text2">{f.area}</span></span>
                    <span>Owner: <span className="fs-text2">{f.owner}</span></span>
                    <span>Due: <span className="text-amber-400">{fmtShort(f.due_date)}</span></span>
                    <span>Raised: <span className="fs-text2">{fmtShort(f.raised_date)}</span></span>
                  </div>
                  <p className="text-[10px] fs-text3 mt-2">{f.description}</p>
                </div>
              </SCard>
            ))}
          </div>
        )}

        {view === 'risks' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Risk Register</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[700px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['RISK', 'LIKELIHOOD', 'IMPACT', 'SCORE', 'STATUS', 'MITIGATION', 'OWNER'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {risks.map((r, i) => (
                      <tr key={r.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-3"><span className="text-xs font-bold fs-text1">{r.title}</span></td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-mono ${r.likelihood === 'high' ? 'text-red-400' : r.likelihood === 'medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {r.likelihood.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-mono ${r.impact === 'high' ? 'text-red-400' : r.impact === 'medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {r.impact.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <SBar v={(r.score / 16) * 100} color={getScoreColor(r.score)} h={6} />
                            <span className="text-xs font-mono font-bold" style={{ color: getScoreColor(r.score) }}>{r.score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><Pill label="ACTIVE" color="#10b981" bg="rgba(16,185,129,0.12)" /></td>
                        <td className="px-4 py-3"><span className="text-[10px] fs-text3">{r.mitigation}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] fs-text3">{r.owner}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditModule;

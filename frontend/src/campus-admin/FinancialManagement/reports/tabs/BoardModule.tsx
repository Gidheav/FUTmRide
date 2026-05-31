// ─────────────────────────────────────────────────────────────────────────────
// BoardModule.tsx — Board tab for FinancialReports
// Board reports, resolutions, meeting minutes, KPIs
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, memo } from 'react';
import Icon from '../../../../components/common/Icon';

const G = '#10b981';

const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: decimals }).format(n);

const fmtShort = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
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

// Board members
const boardMembers = [
  { id: 'BM-001', name: 'Dr. Peter A. Oladipo', role: 'Chairman', committee: 'Executive', tenure: '2018-2026', status: 'active', attendance: 95 },
  { id: 'BM-002', name: 'Mrs. Esther O. Williams', role: 'Vice Chairman', committee: 'Executive', tenure: '2020-2028', status: 'active', attendance: 92 },
  { id: 'BM-003', name: 'Mr. John O. Adeyemi', role: 'Senior Pastor (Ex-officio)', committee: 'Ex-officio', tenure: '2010-Present', status: 'active', attendance: 100 },
  { id: 'BM-004', name: 'Prof. Grace N. Chukwu', role: 'Secretary', committee: 'Finance', tenure: '2019-2027', status: 'active', attendance: 88 },
  { id: 'BM-005', name: 'Mr. David A. Ibrahim', role: 'Treasurer', committee: 'Finance', tenure: '2021-2029', status: 'active', attendance: 90 },
  { id: 'BM-006', name: 'Dr. Sarah B. Musa', role: 'Member', committee: 'Programs', tenure: '2022-2030', status: 'active', attendance: 85 },
  { id: 'BM-007', name: 'Mr. Emmanuel T. Okonkwo', role: 'Member', committee: 'Finance', tenure: '2023-2031', status: 'active', attendance: 82 },
  { id: 'BM-008', name: 'Mrs. Funke C. Adebayo', role: 'Member', committee: 'Worship', tenure: '2021-2029', status: 'active', attendance: 78 },
];

// Resolutions
const resolutions = [
  { id: 'RES-2025-014', title: 'Approval of 2025 Annual Budget (₦85M)', meeting: 'Board Meeting #12', date: '2025-01-15', status: 'approved', sponsor: 'Treasurer' },
  { id: 'RES-2025-015', title: 'Renovation of Fellowship Hall — ₦12M', meeting: 'Board Meeting #12', date: '2025-01-15', status: 'approved', sponsor: 'Facility Committee' },
  { id: 'RES-2025-016', title: 'Investment in FGN Savings Bond — ₦25M', meeting: 'Board Meeting #13', date: '2025-02-20', status: 'approved', sponsor: 'Finance Committee' },
  { id: 'RES-2025-017', title: 'Staff Salary Increment (8%)', meeting: 'Board Meeting #14', date: '2025-03-18', status: 'approved', sponsor: 'HR Committee' },
  { id: 'RES-2025-018', title: 'Purchase of 14-Seater Bus', meeting: 'Board Meeting #15', date: '2025-04-22', status: 'pending', sponsor: 'Transport Committee' },
  { id: 'RES-2025-019', title: 'New Building Project — Phase 2', meeting: 'Special Meeting', date: '2025-05-10', status: 'approved', sponsor: 'Building Committee' },
];

// Meetings
const meetings = [
  { id: 'MTG-2025-14', type: 'Quarterly Board Meeting', date: '2025-05-15', venue: 'Board Room', attendees: 8, quorum: true, agenda_items: 6, notes_status: 'ready' },
  { id: 'MTG-2025-13', type: 'Quarterly Board Meeting', date: '2025-02-20', venue: 'Board Room', attendees: 7, quorum: true, agenda_items: 5, notes_status: 'ready' },
  { id: 'MTG-2025-SP', type: 'Special Meeting', date: '2025-05-10', venue: 'Sanctuary Conf. Room', attendees: 8, quorum: true, agenda_items: 3, notes_status: 'draft' },
  { id: 'MTG-2025-12', type: 'Quarterly Board Meeting', date: '2025-01-15', venue: 'Board Room', attendees: 8, quorum: true, agenda_items: 8, notes_status: 'ready' },
];

// KPIs for board
const boardKPIs = [
  { label: 'Attendance Rate', value: 88.75, target: 90, format: '%', color: '#10b981' },
  { label: 'Budget Execution', value: 42, target: 50, format: '%', color: '#10b981' },
  { label: 'Fundraising Goal', value: 68, target: 100, format: '%', color: '#f59e0b' },
  { label: 'Active Committees', value: 6, target: 6, format: '', color: '#10b981' },
  { label: 'Resolutions Implemented', value: 85, target: 100, format: '%', color: '#10b981' },
  { label: 'Member Tenure Avg', value: 4.2, target: 5, format: 'yrs', color: '#10b981' },
];

const BoardModule: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'members' | 'resolutions' | 'meetings'>('dashboard');

  const pendingResolutions = resolutions.filter(r => r.status === 'pending').length;
  const approvedResolutions = resolutions.filter(r => r.status === 'approved').length;

  return (
    <div className="flex flex-col h-full overflow-hidden fs-slide">
      <div className="fs-toolbar px-5 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border fs-divider">
          {([
            ['dashboard', 'Dashboard'],
            ['members', 'Members'],
            ['resolutions', 'Resolutions'],
            ['meetings', 'Meetings']
          ] as [typeof view, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 text-[11px] font-bold transition-all ${view === k ? 'text-black' : 'fs-text3 hover:fs-text2'}`}
              style={view === k ? { background: G } : {}}>
              {l}
            </button>
          ))}
        </div>
        <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/50 text-emerald-400 text-[10px] font-bold hover:bg-emerald-900/20 transition-colors">
          <Icon name="add" size={11} />NEW RESOLUTION
        </button>
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Board Members', v: boardMembers.length, c: '#10b981', i: 'groups' },
          { l: 'Approved Resolutions', v: approvedResolutions, c: '#3b82f6', i: 'check_circle' },
          { l: 'Pending Approval', v: pendingResolutions, c: '#f59e0b', i: 'pending' },
          { l: 'Meetings (YTD)', v: meetings.length, c: '#8b5cf6', i: 'event' }
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
        {view === 'dashboard' && (
          <div className="p-5 space-y-4">
            {/* KPIs */}
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Board Performance KPIs</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                {boardKPIs.map(kpi => (
                  <div key={kpi.label} className="p-4 text-center">
                    <p className="text-[9px] fs-text3 uppercase mb-2">{kpi.label}</p>
                    <p className="text-2xl font-black" style={{ color: kpi.color }}>
                      {kpi.value}{kpi.format === 'yrs' ? 'yrs' : ''}{kpi.format === '%' && !kpi.format.includes('yrs') ? '%' : ''}
                    </p>
                    <p className="text-[9px] fs-text3 mt-1">Target: {kpi.target}{kpi.format === 'yrs' ? 'yrs' : ''}{kpi.format === '%' && !kpi.format.includes('yrs') ? '%' : ''}</p>
                    <div className="mt-2">
                      <SBar v={(kpi.value / kpi.target) * 100} color={kpi.color} h={4} />
                    </div>
                  </div>
                ))}
              </div>
            </SCard>

            {/* Recent Resolutions */}
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-xs font-bold fs-text2">Recent Board Resolutions</p>
                <button onClick={() => setView('resolutions')} className="text-[10px] text-emerald-400 hover:text-emerald-300">VIEW ALL →</button>
              </div>
              <div className="divide-y divide-slate-800/40">
                {resolutions.slice(0, 4).map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold fs-text1">{r.title}</p>
                      <p className="text-[9px] fs-text3 mt-0.5">{r.meeting} · {fmtShort(r.date)}</p>
                    </div>
                    <Pill 
                      label={r.status.toUpperCase()} 
                      color={r.status === 'approved' ? '#10b981' : '#f59e0b'} 
                      bg={r.status === 'approved' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'} 
                    />
                  </div>
                ))}
              </div>
            </SCard>

            {/* Upcoming Meetings */}
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-xs font-bold fs-text2">Upcoming Meetings</p>
                <button onClick={() => setView('meetings')} className="text-[10px] text-emerald-400 hover:text-emerald-300">VIEW ALL →</button>
              </div>
              <div className="divide-y divide-slate-800/40">
                {meetings.slice(0, 3).map(m => (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold fs-text1">{m.type}</p>
                      <p className="text-[9px] fs-text3 mt-0.5">{m.venue} · {fmtShort(m.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] fs-text3">{m.attendees} attendees</p>
                      <Pill 
                        label={m.notes_status.toUpperCase()} 
                        color={m.notes_status === 'ready' ? '#10b981' : '#f59e0b'} 
                        bg={m.notes_status === 'ready' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SCard>
          </div>
        )}

        {view === 'members' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Board of Trustees</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[700px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['MEMBER', 'ROLE', 'COMMITTEE', 'TENURE', 'ATTENDANCE', 'STATUS'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boardMembers.map((m, i) => (
                      <tr key={m.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-xs font-bold text-white">
                              {m.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-xs font-bold fs-text1">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="text-[10px] fs-text3">{m.role}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] fs-text3">{m.committee}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono fs-text3">{m.tenure}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <SBar v={m.attendance} color={m.attendance >= 90 ? '#10b981' : m.attendance >= 80 ? '#f59e0b' : '#f87171'} h={4} />
                            <span className="text-[10px] font-mono" style={{ color: m.attendance >= 90 ? '#10b981' : m.attendance >= 80 ? '#f59e0b' : '#f87171' }}>{m.attendance}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><Pill label="ACTIVE" color="#10b981" bg="rgba(16,185,129,0.12)" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SCard>
          </div>
        )}

        {view === 'resolutions' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Board Resolutions</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[700px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['RESOLUTION', 'TITLE', 'MEETING', 'DATE', 'SPONSOR', 'STATUS'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resolutions.map((r, i) => (
                      <tr key={r.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono text-emerald-400">{r.id}</span></td>
                        <td className="px-4 py-3"><span className="text-xs font-bold fs-text1">{r.title}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] fs-text3">{r.meeting}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono fs-text3">{fmtShort(r.date)}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] fs-text3">{r.sponsor}</span></td>
                        <td className="px-4 py-3">
                          <Pill 
                            label={r.status.toUpperCase()} 
                            color={r.status === 'approved' ? '#10b981' : '#f59e0b'} 
                            bg={r.status === 'approved' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'} 
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

        {view === 'meetings' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-xs font-bold fs-text2">Meeting History</p>
                <button className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300">
                  <Icon name="add" size={11} />SCHEDULE MEETING
                </button>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[600px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['MEETING', 'DATE', 'VENUE', 'ATTENDEES', 'QUORUM', 'AGENDA ITEMS', 'NOTES'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((m, i) => (
                      <tr key={m.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-3"><span className="text-xs font-bold fs-text1">{m.type}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono fs-text3">{fmtShort(m.date)}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] fs-text3">{m.venue}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono fs-text2">{m.attendees}</span></td>
                        <td className="px-4 py-3">
                          <Icon name={m.quorum ? 'check_circle' : 'cancel'} size={14} className={m.quorum ? 'text-emerald-400' : 'text-red-400'} />
                        </td>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono fs-text3">{m.agenda_items}</span></td>
                        <td className="px-4 py-3">
                          <Pill 
                            label={m.notes_status.toUpperCase()} 
                            color={m.notes_status === 'ready' ? '#10b981' : '#f59e0b'} 
                            bg={m.notes_status === 'ready' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'} 
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
      </div>
    </div>
  );
};

export default BoardModule;

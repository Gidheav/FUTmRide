// ─────────────────────────────────────────────────────────────────────────────
// TaxModule.tsx — Tax tab for FinancialReports
// VAT, WHT, PAYE, compliance calendar, tax liabilities
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, memo } from 'react';
import Icon from '../../../../components/common/Icon';

const G = '#10b981';

const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: decimals }).format(n);

const fmtShort = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
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

// Tax data
const vatRecords = [
  { period: 'Jan 2025', output_vat: 420000, input_vat: 125000, vat_due: 295000, filing_date: '2025-02-21', due_date: '2025-02-28', status: 'paid', receipt_no: 'VAT-2025-01' },
  { period: 'Feb 2025', output_vat: 385000, input_vat: 98000, vat_due: 287000, filing_date: '2025-03-20', due_date: '2025-03-31', status: 'paid', receipt_no: 'VAT-2025-02' },
  { period: 'Mar 2025', output_vat: 512000, input_vat: 156000, vat_due: 356000, filing_date: '2025-04-18', due_date: '2025-04-30', status: 'paid', receipt_no: 'VAT-2025-03' },
  { period: 'Apr 2025', output_vat: 478000, input_vat: 142000, vat_due: 336000, filing_date: '2025-05-20', due_date: '2025-05-31', status: 'paid', receipt_no: 'VAT-2025-04' },
  { period: 'May 2025', output_vat: 545000, input_vat: 168000, vat_due: 377000, filing_date: null, due_date: '2025-06-30', status: 'pending', receipt_no: null },
];

const whtRecords = [
  { vendor: 'TechPro Nigeria Ltd', tin: '12345678-0001', category: 'Consultancy', wht_rate: 10, invoice_amt: 1200000, wht_deducted: 120000, date: '2025-02-14', status: 'remitted', crn: 'WHT-2025-0012' },
  { vendor: 'Ola & Co. Chartered Accountants', tin: 'ICAN-000892', category: 'Professional', wht_rate: 5, invoice_amt: 240000, wht_deducted: 12000, date: '2025-04-01', status: 'remitted', crn: 'WHT-2025-0034' },
  { vendor: 'CleanSweep Services', tin: '98765432-0002', category: 'Services', wht_rate: 5, invoice_amt: 80000, wht_deducted: 4000, date: '2025-05-25', status: 'pending', crn: null },
  { vendor: 'Stanbic IBTC Bank', tin: 'RC-000234-FIN', category: 'Interest', wht_rate: 10, invoice_amt: 75000, wht_deducted: 7500, date: '2025-05-01', status: 'remitted', crn: 'WHT-2025-0056' },
  { vendor: 'Arise FM / Radio', tin: 'NBC-ARISE-2020', category: 'Media/Advertising', wht_rate: 5, invoice_amt: 312000, wht_deducted: 15600, date: '2025-05-15', status: 'pending', crn: null },
];

const complianceCalendar = [
  { tax_type: 'VAT', filing: 'Monthly', due_day: 30, next_due: '2025-06-30', penalty_rate: '5% per month', status: 'upcoming' },
  { tax_type: 'PAYE', filing: 'Monthly', due_day: 10, next_due: '2025-06-10', penalty_rate: 'N/A', status: 'upcoming' },
  { tax_type: 'WHT', filing: 'Monthly', due_day: 15, next_due: '2025-06-15', penalty_rate: 'N/A', status: 'upcoming' },
  { tax_type: 'Company Income Tax', filing: 'Annual', due_day: 30, next_due: '2026-06-30', penalty_rate: '25% + interest', status: 'upcoming' },
  { tax_type: 'Capital Gains Tax', filing: 'Event-based', due_day: 90, next_due: 'N/A', penalty_rate: '10% + penalties', status: 'n/a' },
];

const TaxModule: React.FC = () => {
  const [view, setView] = useState<'vat' | 'wht' | 'calendar'>('vat');

  const totalVatDue = vatRecords.filter(v => v.status === 'pending').reduce((s, v) => s + v.vat_due, 0);
  const totalWhtPending = whtRecords.filter(w => w.status === 'pending').reduce((s, w) => s + w.wht_deducted, 0);
  const totalWhtRemitted = whtRecords.filter(w => w.status === 'remitted').reduce((s, w) => s + w.wht_deducted, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden fs-slide">
      <div className="fs-toolbar px-5 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border fs-divider">
          {([
            ['vat', 'VAT Returns'],
            ['wht', 'WHT Certificates'],
            ['calendar', 'Compliance Calendar']
          ] as [typeof view, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 text-[11px] font-bold transition-all ${view === k ? 'text-black' : 'fs-text3 hover:fs-text2'}`}
              style={view === k ? { background: G } : {}}>
              {l}
            </button>
          ))}
        </div>
        <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/50 text-emerald-400 text-[10px] font-bold hover:bg-emerald-900/20 transition-colors">
          <Icon name="upload_file" size={11} />FILE RETURN
        </button>
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'VAT Output (YTD)', v: vatRecords.reduce((s, v) => s + v.output_vat, 0), c: '#10b981', i: 'trending_up' },
          { l: 'VAT Input (YTD)', v: vatRecords.reduce((s, v) => s + v.input_vat, 0), c: '#3b82f6', i: 'trending_down' },
          { l: 'VAT Payable', v: totalVatDue, c: '#f59e0b', i: 'request_quote' },
          { l: 'WHT Pending Remittance', v: totalWhtPending, c: '#f87171', i: 'schedule' }
        ].map(k => (
          <SCard key={k.l} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] fs-text3 uppercase font-bold tracking-widest">{k.l}</span>
              <Icon name={k.i} size={12} style={{ color: k.c }} />
            </div>
            <p className="text-lg font-black font-mono" style={{ color: k.c }}>{compact(k.v)}</p>
          </SCard>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
        {view === 'vat' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">VAT Returns History</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[750px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['PERIOD', 'OUTPUT VAT', 'INPUT VAT', 'VAT DUE', 'FILED DATE', 'DUE DATE', 'RECEIPT #', 'STATUS'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vatRecords.map((v, i) => (
                      <tr key={v.period} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-2.5"><span className="text-xs font-bold fs-text1">{v.period}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[11px] font-mono text-emerald-400">{ngn(v.output_vat)}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[11px] font-mono text-blue-400">{ngn(v.input_vat)}</span></td>
                        <td className="px-4 py-2.5"><span className="text-xs font-mono font-bold text-amber-400">{ngn(v.vat_due)}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[10px] font-mono fs-text3">{v.filing_date ? fmtShort(v.filing_date) : '—'}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[10px] font-mono fs-text3">{fmtShort(v.due_date)}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[10px] font-mono text-emerald-400">{v.receipt_no || '—'}</span></td>
                        <td className="px-4 py-2.5">
                          <Pill label={v.status.toUpperCase()} color={v.status === 'paid' ? '#10b981' : '#f59e0b'} bg={v.status === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SCard>
          </div>
        )}

        {view === 'wht' && (
          <div className="p-5 space-y-4">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Withholding Tax Certificates</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[800px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['VENDOR', 'TIN', 'CATEGORY', 'RATE', 'INVOICE AMT', 'WHT DEDUCTED', 'DATE', 'CRN', 'STATUS'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {whtRecords.map((w, i) => (
                      <tr key={w.vendor + i} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-3 py-2.5"><span className="text-xs font-bold fs-text1">{w.vendor}</span></td>
                        <td className="px-3 py-2.5"><span className="text-[10px] font-mono fs-text3">{w.tin}</span></td>
                        <td className="px-3 py-2.5"><span className="text-[10px] fs-text3">{w.category}</span></td>
                        <td className="px-3 py-2.5"><span className="text-[10px] font-mono text-amber-400">{w.wht_rate}%</span></td>
                        <td className="px-3 py-2.5"><span className="text-[11px] font-mono fs-text2">{ngn(w.invoice_amt)}</span></td>
                        <td className="px-3 py-2.5"><span className="text-xs font-mono font-bold text-red-400">{ngn(w.wht_deducted)}</span></td>
                        <td className="px-3 py-2.5"><span className="text-[10px] font-mono fs-text3">{fmtShort(w.date)}</span></td>
                        <td className="px-3 py-2.5"><span className="text-[10px] font-mono text-emerald-400">{w.crn || '—'}</span></td>
                        <td className="px-3 py-2.5">
                          <Pill label={w.status.toUpperCase()} color={w.status === 'remitted' ? '#10b981' : '#f59e0b'} bg={w.status === 'remitted' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SCard>

            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">WHT Summary</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                <div className="p-4 text-center">
                  <p className="text-[9px] fs-text3 uppercase mb-1">Total Deducted</p>
                  <p className="text-lg font-black font-mono text-red-400">{ngn(totalWhtPending + totalWhtRemitted)}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-[9px] fs-text3 uppercase mb-1">Remitted</p>
                  <p className="text-lg font-black font-mono text-emerald-400">{ngn(totalWhtRemitted)}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-[9px] fs-text3 uppercase mb-1">Pending</p>
                  <p className="text-lg font-black font-mono text-amber-400">{ngn(totalWhtPending)}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-[9px] fs-text3 uppercase mb-1">Remittance Rate</p>
                  <p className="text-lg font-black font-mono text-blue-400">
                    {((totalWhtRemitted / (totalWhtPending + totalWhtRemitted)) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </SCard>
          </div>
        )}

        {view === 'calendar' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Tax Compliance Calendar — {new Date().getFullYear()}</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[600px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['TAX TYPE', 'FILING FREQUENCY', 'DUE DAY OF MONTH', 'NEXT DUE DATE', 'PENALTY RATE', 'STATUS'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {complianceCalendar.map((c, i) => (
                      <tr key={c.tax_type} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold fs-text1">{c.tax_type}</p>
                        </td>
                        <td className="px-4 py-3"><span className="text-[10px] fs-text3">{c.filing}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono fs-text2">{c.due_day === 90 ? '90 days' : `Day ${c.due_day}`}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono text-amber-400">{c.next_due}</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-mono text-red-400">{c.penalty_rate}</span></td>
                        <td className="px-4 py-3">
                          <Pill 
                            label={c.status.toUpperCase()} 
                            color={c.status === 'upcoming' ? '#10b981' : c.status === 'n/a' ? '#64748b' : '#f59e0b'} 
                            bg={c.status === 'upcoming' ? 'rgba(16,185,129,0.12)' : c.status === 'n/a' ? 'rgba(100,116,139,0.12)' : 'rgba(245,158,11,0.12)'} 
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

export default TaxModule;

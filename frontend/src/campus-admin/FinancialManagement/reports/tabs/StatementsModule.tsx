// ─────────────────────────────────────────────────────────────────────────────
// StatementsModule.tsx — Financial Statements tab for FinancialReports
// Full implementation: P&L, Balance Sheet, Cash Flow
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, memo } from 'react';

const G = '#10b981';

const ngn = (n: number, decimals = 0) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: decimals }).format(n);

const fmtD = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';
const abs = Math.abs;

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

const Row = ({ label, amount, level = 0, bold = false, total = false }: {
  label: string;
  amount?: number;
  level?: number;
  bold?: boolean;
  total?: boolean;
}) => (
  <div className={`flex items-center justify-between py-1.5 px-4 ${total ? 'border-t-2 border-emerald-900/40 mt-1' : 'border-b border-slate-900/30'}`}
    style={{ paddingLeft: 16 + level * 20, background: total ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
    <span className={`text-xs ${bold || total ? 'font-black fs-text1' : 'fs-text2'}`}>{label}</span>
    {amount !== undefined && (
      <span className={`text-xs font-mono ${total ? 'font-black text-emerald-300' : bold ? 'font-bold fs-text2' : amount < 0 ? 'text-red-400' : 'fs-text2'}`}>
        {amount < 0 ? `(${ngn(abs(amount))})` : ngn(amount)}
      </span>
    )}
  </div>
);

const StatementsModule: React.FC = () => {
  const [stmt, setStmt] = useState<'pl' | 'bs' | 'cf'>('pl');

  // P&L figures
  const tithes = 38420000;
  const projects = 12850000;
  const fundraising = 6740000;
  const programFees = 2180000;
  const investInc = 3250000;
  const rental = 840000;
  const merchandise = 420000;
  const totalRevenue = tithes + projects + fundraising + programFees + investInc + rental + merchandise;

  const pastoralSal = 18600000;
  const staffSal = 9840000;
  const empPension = 1428000;
  const benefits = 840000;
  const totalPersonnel = pastoralSal + staffSal + empPension + benefits;

  const building = 4820000;
  const utilities = 1840000;
  const media = 3180000;
  const printing = 640000;
  const missions = 4200000;
  const youth = 2840000;
  const travel = 1240000;
  const profFees = 580000;
  const benevolence = 1680000;
  const totalMinOps = building + utilities + media + printing + missions + youth + travel + profFees + benevolence;

  const bankCharges = 124000;
  const interest = 900000;
  const depreciation = 2380000;
  const totalOther = bankCharges + interest + depreciation;
  const totalExpenses = totalPersonnel + totalMinOps + totalOther;
  const EBITDA = totalRevenue - totalPersonnel - totalMinOps;
  const netSurplus = totalRevenue - totalExpenses;

  // Balance Sheet
  const currentAssets = 8420000 + 3150000 + 125000 + 2280000 + 640000 + 380000 + 10000000;
  const fixedAssetsGross = 85000000 + 9800000 + 12500000;
  const accDepr = 4250000 + 3920000 + 5000000;
  const fixedAssetsNet = fixedAssetsGross - accDepr;
  const longTermInvest = 25000000;
  const totalAssets = currentAssets + fixedAssetsNet + longTermInvest;
  const currentLiab = 1840000 + 920000 + 214000 + 87000 + 340000 + 280000 + 1200000;
  const ltLiab = 15000000;
  const totalLiab = currentLiab + ltLiab;
  const totalEquity = 42000000 + 8660000 + 1650000 + 30000000 + netSurplus;
  const totalLiabEquity = totalLiab + totalEquity;

  return (
    <div className="flex flex-col h-full overflow-hidden fs-slide">
      <div className="fs-toolbar px-5 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border fs-divider">
          {([
            ['pl', 'Income Statement'],
            ['bs', 'Balance Sheet'],
            ['cf', 'Cash Flow']
          ] as [typeof stmt, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setStmt(k)} className={`px-4 py-1.5 text-[11px] font-bold transition-all ${stmt === k ? 'text-black' : 'fs-text3 hover:fs-text2'}`}
              style={stmt === k ? { background: G } : {}}>
              {l}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] fs-text3">Fiscal Year 2025 · IFRS Basis · Unaudited</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>

        {/* INCOME STATEMENT / P&L */}
        {stmt === 'pl' && (
          <div className="max-w-2xl mx-auto p-5">
            <div className="text-center mb-6">
              <p className="text-[10px] fs-text3 uppercase tracking-widest">Statement of Financial Activities</p>
              <h2 className="text-lg font-black fs-text1 mt-1" style={{ fontFamily: 'Roboto Mono, monospace' }}>Income Statement</h2>
              <p className="text-[11px] fs-text3 mt-1">For the Period: 1 January — 31 December 2025</p>
            </div>
            <SCard>
              <Row label="INCOME" bold />
              <Row label="Ministry Income" level={1} bold />
              <Row label="Tithes & Offerings" amount={tithes} level={2} />
              <Row label="Project Offerings" amount={projects} level={2} />
              <Row label="Fundraising Revenue" amount={fundraising} level={2} />
              <Row label="Total Ministry Income" amount={tithes + projects + fundraising} level={1} bold />
              <Row label="Other Income" level={1} bold />
              <Row label="Program Fees" amount={programFees} level={2} />
              <Row label="Investment Income" amount={investInc} level={2} />
              <Row label="Rental Income" amount={rental} level={2} />
              <Row label="Merchandise Sales" amount={merchandise} level={2} />
              <Row label="Total Other Income" amount={programFees + investInc + rental + merchandise} level={1} bold />
              <Row label="TOTAL INCOME" amount={totalRevenue} total bold />
              <div className="h-3" />
              <Row label="EXPENDITURE" bold />
              <Row label="Personnel Costs" level={1} bold />
              <Row label="Pastoral Salaries" amount={pastoralSal} level={2} />
              <Row label="Staff Salaries" amount={staffSal} level={2} />
              <Row label="Employer Pension (10%)" amount={empPension} level={2} />
              <Row label="Staff Benefits & HMO" amount={benefits} level={2} />
              <Row label="Total Personnel" amount={totalPersonnel} level={1} bold />
              <Row label="Ministry & Operations" level={1} bold />
              <Row label="Building & Maintenance" amount={building} level={2} />
              <Row label="Utilities" amount={utilities} level={2} />
              <Row label="Media & Technology" amount={media} level={2} />
              <Row label="Printing & Stationery" amount={printing} level={2} />
              <Row label="Mission & Outreach" amount={missions} level={2} />
              <Row label="Youth & Programs" amount={youth} level={2} />
              <Row label="Travel & Transport" amount={travel} level={2} />
              <Row label="Professional Fees" amount={profFees} level={2} />
              <Row label="Benevolence & Welfare" amount={benevolence} level={2} />
              <Row label="Total Ministry & Ops" amount={totalMinOps} level={1} bold />
              <Row label="EBITDA" amount={EBITDA} total bold />
              <Row label="Finance & Non-cash" level={1} bold />
              <Row label="Bank Charges" amount={bankCharges} level={2} />
              <Row label="Interest Expense" amount={interest} level={2} />
              <Row label="Depreciation" amount={depreciation} level={2} />
              <Row label="Total Finance & Non-cash" amount={totalOther} level={1} bold />
              <Row label="TOTAL EXPENDITURE" amount={totalExpenses} total bold />
              <div className="h-3" />
              <div className="p-4 mx-2 mb-2 rounded-xl" style={{ background: netSurplus >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${netSurplus >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black fs-text1">NET SURPLUS / (DEFICIT)</span>
                  <span className={`text-xl font-black font-mono ${netSurplus >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netSurplus >= 0 ? ngn(netSurplus) : `(${ngn(abs(netSurplus))})`}</span>
                </div>
                <div className="flex gap-6 mt-2">
                  <div><p className="text-[9px] fs-text3">Surplus Margin</p><p className="text-xs font-mono text-emerald-400">{pct(netSurplus, totalRevenue)}%</p></div>
                  <div><p className="text-[9px] fs-text3">EBITDA Margin</p><p className="text-xs font-mono text-blue-400">{pct(EBITDA, totalRevenue)}%</p></div>
                  <div><p className="text-[9px] fs-text3">Personnel Ratio</p><p className="text-xs font-mono text-violet-400">{pct(totalPersonnel, totalRevenue)}%</p></div>
                </div>
              </div>
            </SCard>
          </div>
        )}

        {/* BALANCE SHEET */}
        {stmt === 'bs' && (
          <div className="max-w-2xl mx-auto p-5">
            <div className="text-center mb-6">
              <p className="text-[10px] fs-text3 uppercase tracking-widest">Statement of Financial Position</p>
              <h2 className="text-lg font-black fs-text1 mt-1" style={{ fontFamily: 'Roboto Mono, monospace' }}>Balance Sheet</h2>
              <p className="text-[11px] fs-text3 mt-1">As at 31 December 2025</p>
            </div>
            <SCard>
              <Row label="ASSETS" bold />
              <Row label="Current Assets" level={1} bold />
              <Row label="Cash — GTBank" amount={8420000} level={2} />
              <Row label="Cash — Zenith Bank" amount={3150000} level={2} />
              <Row label="Petty Cash" amount={125000} level={2} />
              <Row label="T-Bills (90-day)" amount={10000000} level={2} />
              <Row label="Accounts Receivable" amount={2280000} level={2} />
              <Row label="Prepaid Expenses" amount={640000} level={2} />
              <Row label="Inventory" amount={380000} level={2} />
              <Row label="Total Current Assets" amount={currentAssets} level={1} bold />
              <Row label="Non-Current Assets" level={1} bold />
              <Row label="Land & Building (Gross)" amount={85000000} level={2} />
              <Row label="Less: Acc. Depreciation" amount={-4250000} level={2} />
              <Row label="Equipment & Furniture (Net)" amount={9800000 - 3920000} level={2} />
              <Row label="Motor Vehicles (Net)" amount={12500000 - 5000000} level={2} />
              <Row label="FGN Bonds (Long-term)" amount={25000000} level={2} />
              <Row label="Total Non-Current Assets" amount={fixedAssetsNet + longTermInvest} level={1} bold />
              <Row label="TOTAL ASSETS" amount={totalAssets} total bold />
              <div className="h-3" />
              <Row label="LIABILITIES & FUND BALANCES" bold />
              <Row label="Current Liabilities" level={1} bold />
              <Row label="Accounts Payable" amount={1840000} level={2} />
              <Row label="Accrued Expenses" amount={920000} level={2} />
              <Row label="VAT Payable" amount={214000} level={2} />
              <Row label="WHT Payable" amount={87000} level={2} />
              <Row label="PAYE Payable" amount={340000} level={2} />
              <Row label="Pension Payable" amount={280000} level={2} />
              <Row label="Deferred Revenue" amount={1200000} level={2} />
              <Row label="Total Current Liabilities" amount={currentLiab} level={1} bold />
              <Row label="Long-term Liabilities" level={1} bold />
              <Row label="Building Renovation Loan" amount={15000000} level={2} />
              <Row label="Total Long-term Liabilities" amount={ltLiab} level={1} bold />
              <Row label="TOTAL LIABILITIES" amount={totalLiab} total bold />
              <div className="h-3" />
              <Row label="FUND BALANCES / EQUITY" bold />
              <Row label="Unrestricted — General Fund" amount={42000000} level={1} />
              <Row label="Restricted — Building Fund" amount={8660000} level={1} />
              <Row label="Restricted — Missions Fund" amount={1650000} level={1} />
              <Row label="Permanently Restricted — Endowment" amount={30000000} level={1} />
              <Row label="Current Year Surplus" amount={netSurplus} level={1} />
              <Row label="TOTAL FUND BALANCES" amount={totalEquity} total bold />
              <div className="h-3" />
              <div className="p-4 mx-2 mb-2 rounded-xl" style={{ background: abs(totalAssets - totalLiabEquity) < 10 ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${abs(totalAssets - totalLiabEquity) < 10 ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black fs-text2">TOTAL LIABILITIES + FUND BALANCES</span>
                  <span className="text-xl font-black font-mono text-emerald-300">{ngn(totalLiabEquity)}</span>
                </div>
                <p className={`text-[10px] mt-1 font-mono ${abs(totalAssets - totalLiabEquity) < 10 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {abs(totalAssets - totalLiabEquity) < 10 ? '✓ Balance Sheet BALANCES' : '⚠ Difference: ' + ngn(abs(totalAssets - totalLiabEquity))}
                </p>
              </div>
            </SCard>
          </div>
        )}

        {/* CASH FLOW */}
        {stmt === 'cf' && (
          <div className="max-w-2xl mx-auto p-5">
            <div className="text-center mb-6">
              <p className="text-[10px] fs-text3 uppercase tracking-widest">Statement of Cash Flows</p>
              <h2 className="text-lg font-black fs-text1 mt-1" style={{ fontFamily: 'Roboto Mono, monospace' }}>Cash Flow Statement</h2>
              <p className="text-[11px] fs-text3 mt-1">For the Period: 1 January — 31 December 2025 · Indirect Method</p>
            </div>
            <SCard>
              <Row label="OPERATING ACTIVITIES" bold />
              <Row label="Net Surplus for the Period" amount={netSurplus} level={1} />
              <Row label="Adjustments for non-cash items:" level={1} bold />
              <Row label="Add: Depreciation" amount={depreciation} level={2} />
              <Row label="Add: Increase in Accounts Payable" amount={420000} level={2} />
              <Row label="Add: Increase in Accrued Expenses" amount={180000} level={2} />
              <Row label="Less: Increase in Receivables" amount={-380000} level={2} />
              <Row label="Less: Increase in Prepaid Expenses" amount={-120000} level={2} />
              <Row label="Less: Increase in Inventory" amount={-80000} level={2} />
              <Row label="Net Cash from Operating Activities" amount={netSurplus + depreciation + 420000 + 180000 - 380000 - 120000 - 80000} total bold />
              <div className="h-3" />
              <Row label="INVESTING ACTIVITIES" bold />
              <Row label="Purchase of Equipment" amount={-1200000} level={1} />
              <Row label="Purchase of T-Bills" amount={-5000000} level={1} />
              <Row label="Proceeds from Investments" amount={1125000} level={1} />
              <Row label="Net Cash used in Investing" amount={-1200000 - 5000000 + 1125000} total bold />
              <div className="h-3" />
              <Row label="FINANCING ACTIVITIES" bold />
              <Row label="Loan Repayment (Principal)" amount={-600000} level={1} />
              <Row label="Interest Paid" amount={-900000} level={1} />
              <Row label="Net Cash used in Financing" amount={-1500000} total bold />
              <div className="h-3" />
              <div className="p-4 mx-2 mb-2 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <Row label="Opening Cash Balance (1 Jan 2025)" amount={9200000} level={0} />
                <Row label="NET INCREASE IN CASH" amount={netSurplus + depreciation + 420000 + 180000 - 380000 - 120000 - 80000 - 1200000 - 5000000 + 1125000 - 1500000} level={0} bold />
                <Row label="CLOSING CASH BALANCE (31 Dec 2025)" amount={11695000} level={0} total bold />
              </div>
            </SCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementsModule;

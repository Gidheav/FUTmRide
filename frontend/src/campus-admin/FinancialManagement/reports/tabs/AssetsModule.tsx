// ─────────────────────────────────────────────────────────────────────────────
// AssetsModule.tsx — Fixed Assets tab for FinancialReports
// Fixed asset register, depreciation, asset categories
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
const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';

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

// Asset categories
const categories = [
  { name: 'Land & Buildings', icon: 'church', color: '#10b981', count: 3, total_cost: 145000000, acc_dep: 0, book_value: 145000000 },
  { name: 'Motor Vehicles', icon: 'directions_car', color: '#3b82f6', count: 2, total_cost: 42000000, acc_dep: 16500000, book_value: 25500000 },
  { name: 'Office Equipment', icon: 'computer', color: '#8b5cf6', count: 12, total_cost: 6800000, acc_dep: 2450000, book_value: 4350000 },
  { name: 'Furniture & Fixtures', icon: 'chair', color: '#f59e0b', count: 28, total_cost: 3200000, acc_dep: 1280000, book_value: 1920000 },
  { name: 'Musical Instruments', icon: 'piano', color: '#ec4899', count: 8, total_cost: 2100000, acc_dep: 630000, book_value: 1470000 },
  { name: 'Audio/Visual Equipment', icon: 'speaker', color: '#06b6d4', count: 15, total_cost: 4800000, acc_dep: 1680000, book_value: 3120000 },
];

// Assets data
const assets = [
  { id: 'AST-001', name: 'Church Sanctuary Building', category: 'Land & Buildings', purchase_date: '2018-01-15', cost: 120000000, salvage: 15000000, useful_life: 50, depreciation_method: 'Straight-line', annual_dep: 2100000, acc_dep: 14700000, book_value: 105300000, location: 'Main Campus', status: 'active', serial: 'LND-2018-001' },
  { id: 'AST-002', name: 'Land (2 Hectares, Oyegunle)', category: 'Land & Buildings', purchase_date: '2015-06-20', cost: 25000000, salvage: 0, useful_life: 0, depreciation_method: 'N/A', annual_dep: 0, acc_dep: 0, book_value: 25000000, location: 'Oyegunle Plot', status: 'active', serial: 'LND-2015-002' },
  { id: 'AST-003', name: 'Toyota Hiace (14-Seater)', category: 'Motor Vehicles', purchase_date: '2021-03-10', cost: 28000000, salvage: 5000000, useful_life: 7, depreciation_method: 'Straight-line', annual_dep: 3285714, acc_dep: 11500000, book_value: 16500000, location: 'Fleet', status: 'active', serial: 'Toya-2021-Hiace' },
  { id: 'AST-004', name: 'Honda Accord (Admin)', category: 'Motor Vehicles', purchase_date: '2022-08-22', cost: 14000000, salvage: 2000000, useful_life: 5, depreciation_method: 'Straight-line', annual_dep: 2400000, acc_dep: 5000000, book_value: 9000000, location: 'Admin Pool', status: 'active', serial: 'Honda-2022-ACC' },
  { id: 'AST-005', name: 'Dell OptiPlex 7080 (x5)', category: 'Office Equipment', purchase_date: '2023-02-14', cost: 3500000, salvage: 350000, useful_life: 5, depreciation_method: 'Straight-line', annual_dep: 630000, acc_dep: 945000, book_value: 2555000, location: 'Admin Office', status: 'active', serial: 'DELL-7080-001' },
  { id: 'AST-006', name: 'Yamaha P-125 Digital Piano', category: 'Musical Instruments', purchase_date: '2022-11-05', cost: 650000, salvage: 65000, useful_life: 10, depreciation_method: 'Straight-line', annual_dep: 58500, acc_dep: 117000, book_value: 533000, location: 'Worship Center', status: 'active', serial: 'YAMA-P125-001' },
  { id: 'AST-007', name: 'Yamaha Stage Custom Drum Kit', category: 'Musical Instruments', purchase_date: '2021-04-20', cost: 850000, salvage: 85000, useful_life: 10, depreciation_method: 'Straight-line', annual_dep: 76500, acc_dep: 255000, book_value: 595000, location: 'Worship Center', status: 'active', serial: 'YAMA-DRUM-001' },
  { id: 'AST-008', name: 'JBL Professional Line Array', category: 'Audio/Visual Equipment', purchase_date: '2023-06-01', cost: 2200000, salvage: 220000, useful_life: 7, depreciation_method: 'Straight-line', annual_dep: 282857, acc_dep: 424285, book_value: 1775715, location: 'Sanctuary', status: 'active', serial: 'JBL-LINE-001' },
  { id: 'AST-009', name: 'Sony PXW-Z280 Camcorder', category: 'Audio/Visual Equipment', purchase_date: '2024-01-15', cost: 1800000, salvage: 180000, useful_life: 5, depreciation_method: 'Straight-line', annual_dep: 324000, acc_dep: 108000, book_value: 1692000, location: 'Media Room', status: 'active', serial: 'SONY-Z280-001' },
  { id: 'AST-010', name: 'Office Chairs (Executive - 12)', category: 'Furniture & Fixtures', purchase_date: '2023-09-10', cost: 1200000, salvage: 120000, useful_life: 7, depreciation_method: 'Straight-line', annual_dep: 154285, acc_dep: 77142, book_value: 1112858, location: 'Admin Office', status: 'active', serial: 'CHR-EXEC-012' },
  { id: 'AST-011', name: 'Conference Table (Glass)', category: 'Furniture & Fixtures', purchase_date: '2022-05-18', cost: 450000, salvage: 45000, useful_life: 10, depreciation_method: 'Straight-line', annual_dep: 40500, acc_dep: 101250, book_value: 348750, location: 'Board Room', status: 'active', serial: 'TBL-GLASS-001' },
  { id: 'AST-012', name: 'Samsung 75" Smart TV', category: 'Audio/Visual Equipment', purchase_date: '2024-03-20', cost: 800000, salvage: 80000, useful_life: 5, depreciation_method: 'Straight-line', annual_dep: 144000, acc_dep: 48000, book_value: 752000, location: 'Fellowship Hall', status: 'active', serial: 'SAMS-75-SMART' },
];

const AssetsModule: React.FC = () => {
  const [view, setView] = useState<'register' | 'categories' | 'depreciation'>('register');
  const [categoryF, setCategoryF] = useState('all');

  const filteredAssets = categoryF === 'all' ? assets : assets.filter(a => a.category === categoryF);

  const totalCost = assets.reduce((s, a) => s + a.cost, 0);
  const totalAccDep = assets.reduce((s, a) => s + a.acc_dep, 0);
  const totalBookValue = assets.reduce((s, a) => s + a.book_value, 0);

  const categoryOptions = [...new Set(assets.map(a => a.category))];

  return (
    <div className="flex flex-col h-full overflow-hidden fs-slide">
      <div className="fs-toolbar px-5 py-3 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border fs-divider">
          {([
            ['register', 'Asset Register'],
            ['categories', 'Categories'],
            ['depreciation', 'Depreciation']
          ] as [typeof view, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 text-[11px] font-bold transition-all ${view === k ? 'text-black' : 'fs-text3 hover:fs-text2'}`}
              style={view === k ? { background: G } : {}}>
              {l}
            </button>
          ))}
        </div>
        {view === 'register' && (
          <select value={categoryF} onChange={e => setCategoryF(e.target.value)} className="fs-input px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none">
            <option value="all">All Categories</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/50 text-emerald-400 text-[10px] font-bold hover:bg-emerald-900/20 transition-colors">
          <Icon name="add" size={11} />ADD ASSET
        </button>
      </div>

      {/* Summary cards */}
      <div className="px-5 py-3 flex-shrink-0 grid grid-cols-3 gap-3">
        {[
          { l: 'Total Asset Cost', v: totalCost, c: '#10b981', i: 'account_balance' },
          { l: 'Accumulated Depreciation', v: totalAccDep, c: '#f59e0b', i: 'remove_circle_outline' },
          { l: 'Net Book Value', v: totalBookValue, c: '#3b82f6', i: 'savings' }
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
        {view === 'register' && (
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="sticky top-0 z-10 fs-thead">
                <tr>
                  {['ASSET', 'CATEGORY', 'LOCATION', 'PURCHASE DATE', 'COST', 'DEP METHOD', 'ANNUAL DEP', 'ACC DEP', 'BOOK VALUE', 'STATUS'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">
                      <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((a, i) => (
                  <tr key={a.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-bold fs-text1">{a.name}</p>
                      <p className="text-[9px] font-mono fs-text3">{a.serial}</p>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[10px] fs-text3">{a.category}</span></td>
                    <td className="px-3 py-2.5"><span className="text-[10px] fs-text3">{a.location}</span></td>
                    <td className="px-3 py-2.5"><span className="text-[10px] font-mono fs-text3">{fmtShort(a.purchase_date)}</span></td>
                    <td className="px-3 py-2.5"><span className="text-xs font-mono font-bold fs-text2">{ngn(a.cost)}</span></td>
                    <td className="px-3 py-2.5"><span className="text-[10px] fs-text3">{a.depreciation_method}</span></td>
                    <td className="px-3 py-2.5"><span className="text-[10px] font-mono text-amber-400">{ngn(a.annual_dep)}</span></td>
                    <td className="px-3 py-2.5"><span className="text-[10px] font-mono text-red-400">{ngn(a.acc_dep)}</span></td>
                    <td className="px-3 py-2.5"><span className="text-xs font-mono font-bold text-emerald-400">{ngn(a.book_value)}</span></td>
                    <td className="px-3 py-2.5"><Pill label={a.status.toUpperCase()} color="#10b981" bg="rgba(16,185,129,0.12)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'categories' && (
          <div className="p-5 space-y-3">
            {categories.map(cat => (
              <SCard key={cat.name}>
                <div className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}20`, border: `1px solid ${cat.color}40` }}>
                    <Icon name={cat.icon} size={22} style={{ color: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold fs-text1">{cat.name}</p>
                      <span className="text-[10px] fs-text3">({cat.count} assets)</span>
                    </div>
                    <div className="flex gap-4 text-[10px]">
                      <span className="fs-text3">Cost: <span className="font-mono fs-text2">{compact(cat.total_cost)}</span></span>
                      <span className="fs-text3">Acc. Dep.: <span className="font-mono text-red-400">{compact(cat.acc_dep)}</span></span>
                      <span className="fs-text3">Book Value: <span className="font-mono text-emerald-400">{compact(cat.book_value)}</span></span>
                    </div>
                    <div className="mt-2">
                      <SBar v={parseFloat(pct(cat.book_value, cat.total_cost))} color={cat.color} h={3} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black font-mono text-emerald-300">{compact(cat.book_value)}</p>
                    <p className="text-[9px] fs-text3">{pct(cat.book_value, cat.total_cost)}% of cost</p>
                  </div>
                </div>
              </SCard>
            ))}
          </div>
        )}

        {view === 'depreciation' && (
          <div className="p-5">
            <SCard>
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-xs font-bold fs-text2">Depreciation Schedule (Straight-Line Method)</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                <table className="w-full min-w-[700px] border-collapse">
                  <thead className="fs-thead">
                    <tr>
                      {['ASSET', 'COST', 'SALVAGE', 'DEPRECIABLE BASE', 'USEFUL LIFE', 'ANNUAL DEP', 'MONTHLY DEP', 'DEP RATE'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left">
                          <span className="text-[9px] fs-text3 font-bold uppercase tracking-widest">{h}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assets.filter(a => a.useful_life > 0).map((a, i) => (
                      <tr key={a.id} className={`border-b border-opacity-20 ${i % 2 === 0 ? 'fs-tr-even' : 'fs-tr-odd'}`}>
                        <td className="px-4 py-3"><span className="text-xs font-bold fs-text1">{a.name}</span></td>
                        <td className="px-4 py-3"><span className="text-[11px] font-mono fs-text2">{ngn(a.cost)}</span></td>
                        <td className="px-4 py-3"><span className="text-[11px] font-mono fs-text3">{ngn(a.salvage)}</span></td>
                        <td className="px-4 py-3"><span className="text-[11px] font-mono text-amber-400">{ngn(a.cost - a.salvage)}</span></td>
                        <td className="px-4 py-3"><span className="text-[11px] fs-text3">{a.useful_life} years</span></td>
                        <td className="px-4 py-3"><span className="text-xs font-mono font-bold text-emerald-400">{ngn(a.annual_dep)}</span></td>
                        <td className="px-4 py-3"><span className="text-[11px] font-mono text-emerald-400/80">{(a.annual_dep / 12).toFixed(0)}</span></td>
                        <td className="px-4 py-3"><span className="text-[11px] font-mono text-amber-400">{((1 / a.useful_life) * 100).toFixed(1)}%</span></td>
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

export default AssetsModule;

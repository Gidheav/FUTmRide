// ─────────────────────────────────────────────────────────────────────────────
// reports/FinancialReports.tsx — thin orchestrator shell
// Source: FinancialReports lines 1724–1857
// Destination: src/admin/FinancialManagement/reports/FinancialReports.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import type { SanctumTab, Theme } from '../types/financial.types';
import { ThemeProvider, ThemeCtx }   from './context';
import { SANCTUM_TABS, THIN_DARK, THIN_LIGHT, G, FS_CSS } from '../constants/reports.constants';
import Icon from '../../../components/common/Icon';

// ── CSS injection ──
let _fsCss = false;
const injectFSCSS = () => {
  if (_fsCss || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = FS_CSS;
  document.head.appendChild(s);
  _fsCss = true;
};

// ── Lazy tabs ──
// Note: Using type assertion to handle both default and named exports
const CommandModule    = lazy(() => import('./tabs/CommandModule')    .then((m) => ({ default: (m as any).default || m })));
const LedgerModule     = lazy(() => import('./tabs/LedgerModule')     .then((m) => ({ default: (m as any).default || m })));
const StatementsModule = lazy(() => import('./tabs/StatementsModule').then((m) => ({ default: (m as any).default || m })));
const TreasuryModule   = lazy(() => import('./tabs/TreasuryModule')   .then((m) => ({ default: (m as any).default || m })));
const PayablesModule   = lazy(() => import('./tabs/PayablesModule')   .then((m) => ({ default: (m as any).default || m })));
const AssetsModule     = lazy(() => import('./tabs/AssetsModule')     .then((m) => ({ default: (m as any).default || m })));
const PayrollModule    = lazy(() => import('./tabs/PayrollModule')    .then((m) => ({ default: (m as any).default || m })));
const TaxModule        = lazy(() => import('./tabs/TaxModule')        .then((m) => ({ default: (m as any).default || m })));
const AuditModule      = lazy(() => import('./tabs/AuditModule')      .then((m) => ({ default: (m as any).default || m })));
const BoardModule      = lazy(() => import('./tabs/BoardModule')      .then((m) => ({ default: (m as any).default || m })));

const TabFallback = () => (
  <div className="flex items-center justify-center h-32">
    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent fs-spin"/>
  </div>
);

const FinancialReports: React.FC = () => {
  injectFSCSS();
  const [tab,    setTab]    = useState<SanctumTab>('command');
  const [search, setSearch] = useState('');
  const [theme,  setTheme]  = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('admin-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo(0,0); }, [tab]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  const isLight = theme === 'light';
  const THIN    = isLight ? THIN_LIGHT : THIN_DARK;

  const divBg     = isLight ? '#d1fae5' : '#1e293b';
  const searchIcon= isLight ? '#a7f3d0' : '#475569';
  const subtleTxt = isLight ? '#065f46' : '#64748b';
  const titleTxt  = isLight ? '#064e3b' : '#f1f5f9';

  const MODULE_MAP: Record<SanctumTab, React.ReactNode> = {
    command:    <CommandModule/>,
    ledger:     <LedgerModule/>,
    statements: <StatementsModule/>,
    treasury:   <TreasuryModule/>,
    payables:   <PayablesModule/>,
    assets:     <AssetsModule/>,
    payroll:    <PayrollModule/>,
    tax:        <TaxModule/>,
    audit:      <AuditModule/>,
    board:      <BoardModule/>,
  };

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className={`fs ${theme} flex flex-col h-full overflow-hidden`}>

        {/* ── TOP BAR ── */}
        <div className="fs-topbar flex-shrink-0">
          <div className="px-5 py-3 flex items-center gap-3">

            {/* Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                style={{ background:'linear-gradient(135deg,#064e3b,#10b981)', boxShadow:'0 0 18px rgba(16,185,129,0.4)' }}>
                <Icon name="book" size={17} style={{ color:'#fff' }}/>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-black leading-none tracking-tight" style={{ fontFamily:'Roboto Mono, monospace', color:titleTxt }}>The Sanctum</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] mt-0.5" style={{ color:subtleTxt }}>Accounting · Treasury · Compliance</p>
              </div>
            </div>

            <div className="hidden sm:block w-px h-8 flex-shrink-0" style={{ background:divBg }}/>

            {/* Search */}
            <div className="flex-1 max-w-xs relative">
              <Icon name="search" size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color:searchIcon }}/>
              <input type="text" placeholder="Search accounts, entries…" value={search} onChange={e=>setSearch(e.target.value)}
                className="fs-input w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px] focus:outline-none"/>
            </div>

            {/* Status chips */}
            <div className="hidden lg:flex items-center gap-2 ml-auto">
              {[
                { label:'FY2025',   icon:'calendar_today' },
                { label:'NGN',      icon:'currency_exchange' },
                { label:'IFRS',     icon:'verified' },
                { label:'Unaudited',icon:'pending' },
              ].map(s => (
                <div key={s.label} className="fs-stat-chip flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold" style={{ color:G }}>
                  <Icon name={s.icon} size={10} style={{ color:G }}/>
                  {s.label}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                style={isLight
                  ? { border:'1px solid #a7f3d0', color:G, background:'transparent' }
                  : { border:'1px solid rgba(16,185,129,0.3)', color:G, background:'transparent' }}>
                <Icon name="print" size={11}/>Print
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:opacity-90"
                style={{ background:G, color:'#fff' }}>
                <Icon name="add" size={11}/>New Entry
              </button>
            </div>
          </div>

          {/* ── TAB NAV ── */}
          <div className="flex overflow-x-auto px-4 fs-tab-bar" style={{ scrollbarWidth:'none' }}>
            {SANCTUM_TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`fs-tab-btn flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${tab===t.key?'active':''}`}
                style={tab===t.key ? { borderColor:G, color:G } : { borderColor:'transparent' }}>
                <Icon name={t.icon} size={12} style={{ color:tab===t.key?G:'#334155' }}/>
                {t.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── MODULE CONTENT ── */}
        <div ref={scrollRef} className="fs-page flex-1 min-h-0 overflow-hidden flex flex-col">
          <Suspense fallback={<TabFallback/>}>
            {(['ledger','statements','payables'] as SanctumTab[]).includes(tab)
              ? <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{MODULE_MAP[tab]}</div>
              : <div className="flex-1 overflow-y-auto" style={THIN}>{MODULE_MAP[tab]}</div>
            }
          </Suspense>
        </div>

      </div>
    </ThemeProvider>
  );
};

export default FinancialReports;
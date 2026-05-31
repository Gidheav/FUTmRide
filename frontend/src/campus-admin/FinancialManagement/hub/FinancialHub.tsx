// FinancialHub.tsx - thin orchestrator shell.
// The campus admin top nav owns the visible finance tab navigation.
import React, {
  lazy, Suspense, useState, useEffect, useRef,
  useCallback, useMemo,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { HubTab, Period, Tx } from '../types/financial.types';
import { injectFHCSS }    from '../helpers/hub.helpers';
import { compact, exportCSV, periodLabel } from '../helpers/hub.helpers';
import { MOCK_TXS, THIN } from '../constants/hub.constants';
import { PeriodSelector } from '../components/PeriodSelector';
import {
  OverviewSkeleton,
  TransactionsSkeleton,
  MembersSkeleton,
  ReportsSkeleton,
} from '../components/SkeletonLoaders';
import Icon from '../../../components/common/Icon';
import apiService from '../../../services/api.service';

// Lazy-loaded tabs

const OverviewTab     = lazy(() => import('./tabs/OverviewTab').then(m => ({ default: m.OverviewTab })));
const TransactionsTab = lazy(() => import('./tabs/TransactionsTab').then(m => ({ default: m.TransactionsTab })));
const MembersTab      = lazy(() => import('./tabs/MembersTab').then(m => ({ default: m.MembersTab })));
const ReportsTab      = lazy(() => import('./tabs/ReportsTab').then(m => ({ default: m.ReportsTab })));

type FinancialHubTab = Extract<HubTab, 'overview' | 'transactions' | 'members' | 'reports'>;

const HUB_TABS: FinancialHubTab[] = ['overview', 'transactions', 'members', 'reports'];

const getTabFromSearch = (search: string): FinancialHubTab => {
  const tab = new URLSearchParams(search).get('tab') as FinancialHubTab | null;
  return tab && HUB_TABS.includes(tab) ? tab : 'overview';
};

// Shell

const FinancialHub: React.FC = () => {
  injectFHCSS();
  const location = useLocation();
  const navigate = useNavigate();

  const [tab,     setTab]     = useState<FinancialHubTab>(() => getTabFromSearch(location.search));
  const [period,  setPeriod]  = useState<Period>('30D');
  const [txs,     setTxs]     = useState<Tx[]>(MOCK_TXS);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    const nextTab = getTabFromSearch(location.search);
    setTab((current) => (current === nextTab ? current : nextTab));
  }, [location.search]);

  const setFinanceTab = useCallback((nextTab: FinancialHubTab) => {
    setTab(nextTab);
    navigate(`/financial?tab=${nextTab}`);
  }, [navigate]);

  // Fetch live transactions once on mount
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await apiService.get<any>('payments/admin/transactions/');
        if (!dead) {
          const list: Tx[] = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
          if (list.length > 0) setTxs(list);
        }
      } catch { /* use mock */ }
      finally { if (!dead) setLoading(false); }
    })();
    return () => { dead = true; };
  }, []);

  // Global search Ã¢â€ â€™ jump to Transactions tab
  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    if (q) setFinanceTab('transactions');
  }, [setFinanceTab]);

  const success = useMemo(() => txs.filter(t => t.status === 'SUCCESS'), [txs]);
  const revenue = useMemo(() => success.reduce((s, t) => s + t.amount, 0), [success]);
  const failed  = useMemo(() => txs.filter(t => t.status === 'FAILED').length, [txs]);

  // Scroll to top whenever tab changes
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [tab]);

  return (
    <div className="fh flex flex-col h-full overflow-hidden bg-slate-950">

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ COMMAND BAR Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="fh-bar flex-shrink-0 bg-slate-900 border-b border-slate-800"
        style={{ boxShadow: '0 1px 0 #1e293b' }}>
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 16px #10b98140' }}>
              <Icon name="account_balance" size={18} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-display font-semibold leading-none" style={{ color: 'var(--fh-text1)' }}>Financial Hub</p>
              <p className="text-[9px] font-sans uppercase tracking-wider mt-0.5" style={{ color: 'var(--fh-text3)' }}>Treasury Ã‚Â· Accounting Ã‚Â· Analytics</p>
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 flex-shrink-0" style={{ background: 'var(--fh-border2)' }} />

          <PeriodSelector value={period} onChange={setPeriod} />

          <span className="hidden lg:block text-[10px] font-sans flex-shrink-0" style={{ color: 'var(--fh-text3)' }}>
            {periodLabel(period)}
          </span>

          {/* Global search */}
          <div className="flex-1 max-w-xs relative ml-auto">
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Global searchÃ¢â‚¬Â¦"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="fh-input w-full pl-8 pr-6 py-1.5 bg-slate-800/80 border border-slate-700 rounded-md text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                <Icon name="close" size={11} />
              </button>
            )}
          </div>

          {/* Quick KPIs */}
          <div className="hidden xl:flex items-center gap-0 divide-x flex-shrink-0"
            style={{ borderColor: 'var(--fh-border)' }}>
            {[
              { label: 'REVENUE', value: compact(revenue),           color: '#10b981' },
              { label: 'TX',      value: txs.length.toString(),      color: '#94a3b8' },
              { label: 'FAILED',  value: failed.toString(),          color: failed > 0 ? '#f87171' : '#475569' },
            ].map(k => (
              <div key={k.label} className="px-4 text-center">
                <p className="text-[8px] font-sans tracking-widest" style={{ color: 'var(--fh-text3)' }}>{k.label}</p>
                <p className="text-sm font-mono font-bold" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => exportCSV(txs)}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-[10px] font-sans hover:border-emerald-700 hover:text-emerald-400 transition-colors"
              style={{ background: 'var(--fh-surface2)', borderColor: 'var(--fh-border2)', color: 'var(--fh-text3)' }}>
              <Icon name="download" size={12} />
              <span className="hidden sm:inline">EXPORT</span>
            </button>
            <button onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-sans font-semibold text-black transition-colors"
              style={{ background: '#10b981' }}>
              <Icon name="refresh" size={12} />
              <span className="hidden sm:inline">REFRESH</span>
            </button>
          </div>
        </div>

      </div>

      {/* TAB CONTENT */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">

        {tab === 'overview' && (
          <div className="flex-1 overflow-y-auto" style={THIN}>
            <Suspense fallback={<OverviewSkeleton />}>
              <OverviewTab txs={txs} period={period} />
            </Suspense>
          </div>
        )}

        {tab === 'transactions' && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <Suspense fallback={<TransactionsSkeleton />}>
              <TransactionsTab txs={txs} period={period} />
            </Suspense>
          </div>
        )}


        {tab === 'members' && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <Suspense fallback={<MembersSkeleton />}>
              <MembersTab txs={txs} />
            </Suspense>
          </div>
        )}

        {tab === 'reports' && (
          <div className="flex-1 overflow-y-auto" style={THIN}>
            <Suspense fallback={<ReportsSkeleton />}>
              <ReportsTab txs={txs} />
            </Suspense>
          </div>
        )}


      </div>
    </div>
  );
};

export default FinancialHub;

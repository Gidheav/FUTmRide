// ─────────────────────────────────────────────────────────────────────────────
// SkeletonLoaders.tsx — Suspense fallbacks for all lazy-loaded modules
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';

// ─── Pulse helper ─────────────────────────────────────────────────────────────

const P = ({ w, h = 3, cls = '' }: { w: number | string; h?: number; cls?: string }) => (
  <div
    className={`animate-pulse rounded bg-slate-100 dark:bg-slate-700/60 ${cls}`}
    style={{ width: typeof w === 'number' ? `${w}px` : w, height: `${h}px` }} />
);

// ─── SkeletonRow (Records table row) ─────────────────────────────────────────

export const SkeletonRow = memo(({ i }: { i: number }) => (
  <tr className={`border-b border-slate-100 dark:border-slate-700/50 ${
    i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-800/30'
  }`}>
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 animate-pulse flex-shrink-0" />
        <div className="space-y-1.5">
          <P w={112} h={12} />
          <P w={160} h={10} cls="opacity-60" />
        </div>
      </div>
    </td>
    <td className="hidden md:table-cell px-4 py-3"><P w={128} h={12} /></td>
    <td className="px-4 py-3"><P w={80} h={16} /></td>
    <td className="hidden sm:table-cell px-4 py-3"><P w={80} h={20} cls="rounded-full" /></td>
    <td className="hidden lg:table-cell px-4 py-3"><P w={64} h={12} /></td>
    <td className="hidden xl:table-cell px-4 py-3"><P w={96} h={12} /></td>
    <td className="px-4 py-3 text-right"><P w={64} h={28} cls="rounded-lg ml-auto" /></td>
  </tr>
));
SkeletonRow.displayName = 'SkeletonRow';

// ─── KPI row helper ───────────────────────────────────────────────────────────

const KPIRow = ({ cols = 4 }: { cols?: number }) => (
  <div className={`grid grid-cols-2 sm:grid-cols-${cols} gap-3 mb-4`}>
    {Array.from({ length: cols }, (_, i) => (
      <div key={i} className="rounded-xl border border-slate-800 p-4 space-y-3">
        <P w="60%" h={10} />
        <P w="80%" h={24} />
        <P w="100%" h={24} />
      </div>
    ))}
  </div>
);

// ─── OverviewSkeleton ─────────────────────────────────────────────────────────

export const OverviewSkeleton = memo(() => (
  <div className="p-4 sm:p-6 space-y-5 animate-pulse">
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-xl border border-slate-800 p-4 space-y-3">
          <P w="70%" h={10} />
          <P w="85%" h={22} />
          <P w="100%" h={24} />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 rounded-xl border border-slate-800 p-5 space-y-3">
        <P w="40%" h={10} /><P w="30%" h={28} /><P w="100%" h={160} />
      </div>
      <div className="rounded-xl border border-slate-800 p-5 space-y-3">
        <P w="50%" h={10} /><P w="140px" h={140} cls="rounded-full mx-auto" />
        {Array.from({ length: 4 }, (_, i) => <P key={i} w="100%" h={12} />)}
      </div>
    </div>
  </div>
));
OverviewSkeleton.displayName = 'OverviewSkeleton';

// ─── TransactionsSkeleton ─────────────────────────────────────────────────────

export const TransactionsSkeleton = memo(() => (
  <div className="flex flex-col h-full animate-pulse">
    <div className="px-4 py-2.5 border-b border-slate-800 flex gap-2">
      <P w={208} h={32} cls="rounded-md" />
      <P w={120} h={32} cls="rounded-md" />
      <P w={100} h={32} cls="rounded-md" />
      <P w={80}  h={32} cls="rounded-md" />
    </div>
    <div className="flex-1 overflow-hidden">
      <table className="w-full">
        <thead><tr className="border-b border-slate-800">
          {[200, 160, 100, 100, 100, 120, 80].map((w, i) => (
            <th key={i} className="px-4 py-2.5"><P w={w * 0.6} h={10} /></th>
          ))}
        </tr></thead>
        <tbody>
          {Array.from({ length: 12 }, (_, i) => <SkeletonRow key={i} i={i} />)}
        </tbody>
      </table>
    </div>
  </div>
));
TransactionsSkeleton.displayName = 'TransactionsSkeleton';

// ─── GivingSkeleton ───────────────────────────────────────────────────────────

export const GivingSkeleton = memo(() => (
  <div className="p-4 sm:p-6 space-y-5 animate-pulse">
    <KPIRow cols={4} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-800 p-5 space-y-3">
        <P w="40%" h={10} /><P w="100%" h={180} />
      </div>
      <div className="rounded-xl border border-slate-800 p-5 space-y-3">
        <P w="40%" h={10} />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <P w={8} h={8} cls="rounded-full flex-shrink-0" />
            <P w="60%" h={12} /><P w="15%" h={12} />
          </div>
        ))}
      </div>
    </div>
  </div>
));
GivingSkeleton.displayName = 'GivingSkeleton';

// ─── BudgetSkeleton ───────────────────────────────────────────────────────────

export const BudgetSkeleton = memo(() => (
  <div className="p-4 sm:p-6 space-y-5 animate-pulse">
    <KPIRow cols={4} />
    <div className="rounded-xl border border-slate-800">
      <div className="px-5 py-3 border-b border-slate-800"><P w="30%" h={10} /></div>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="px-5 py-4 border-b border-slate-800/40 flex items-center gap-4">
          <P w={36} h={36} cls="rounded-lg flex-shrink-0" />
          <P w="35%" h={12} />
          <P w="15%" h={12} /><P w="15%" h={12} />
          <P w="10%" h={12} /><P w={60} h={12} />
        </div>
      ))}
    </div>
  </div>
));
BudgetSkeleton.displayName = 'BudgetSkeleton';

// ─── MembersSkeleton ─────────────────────────────────────────────────────────

export const MembersSkeleton = memo(() => (
  <div className="flex flex-col h-full animate-pulse">
    <div className="px-4 py-2.5 border-b border-slate-800 flex gap-2">
      <P w={208} h={32} cls="rounded-md" />
      {Array.from({ length: 4 }, (_, i) => <P key={i} w={90} h={32} cls="rounded-md" />)}
    </div>
    <div className="flex-1 overflow-hidden">
      <table className="w-full">
        <thead><tr className="border-b border-slate-800">
          {Array.from({ length: 9 }, (_, i) => (
            <th key={i} className="px-3 py-2.5"><P w={60} h={10} /></th>
          ))}
        </tr></thead>
        <tbody>
          {Array.from({ length: 12 }, (_, i) => (
            <tr key={i} className={`border-b border-slate-800/40 ${i % 2 === 0 ? '' : 'bg-slate-800/10'}`}>
              <td className="px-3 py-2.5"><P w={20} h={16} /></td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <P w={28} h={28} cls="rounded-full flex-shrink-0" /><P w={120} h={12} />
                </div>
              </td>
              {Array.from({ length: 7 }, (_, j) => (
                <td key={j} className="px-3 py-2.5"><P w={70} h={12} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
));
MembersSkeleton.displayName = 'MembersSkeleton';

// ─── ReportsSkeleton ─────────────────────────────────────────────────────────

export const ReportsSkeleton = memo(() => (
  <div className="p-4 sm:p-6 space-y-5 animate-pulse">
    <KPIRow cols={4} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-xl border border-slate-800 p-5 space-y-3">
        <P w="35%" h={10} />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-800/40">
            <P w={60} h={12} /><P w="40%" h={12} /><P w="20%" h={12} /><P w="15%" h={12} />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-800 p-5 space-y-3">
        <P w="50%" h={10} />
        {Array.from({ length: 5 }, (_, i) => <P key={i} w="100%" h={14} />)}
      </div>
    </div>
  </div>
));
ReportsSkeleton.displayName = 'ReportsSkeleton';

// ─── PayoutsSkeleton ─────────────────────────────────────────────────────────

export const PayoutsSkeleton = memo(() => (
  <div className="p-4 sm:p-6 space-y-5 animate-pulse">
    <KPIRow cols={3} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-800 p-5 space-y-4">
        <P w="35%" h={10} />
        {Array.from({ length: 4 }, (_, i) => <P key={i} w="100%" h={44} cls="rounded-lg" />)}
      </div>
      <div className="rounded-xl border border-slate-800">
        <div className="px-5 py-3 border-b border-slate-800"><P w="30%" h={10} /></div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-slate-800/40">
            <P w={36} h={36} cls="rounded-lg flex-shrink-0" />
            <P w="40%" h={12} /><P w="20%" h={12} /><P w={80} h={20} cls="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
));
PayoutsSkeleton.displayName = 'PayoutsSkeleton';

// ─── ModuleSkeleton (Reports module generic) ─────────────────────────────────

export const ModuleSkeleton = memo(() => (
  <div className="p-5 space-y-4 animate-pulse">
    <KPIRow cols={4} />
    <div className="rounded-xl border border-slate-800 p-5 space-y-3">
      <P w="30%" h={10} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex gap-4 py-2 border-b border-slate-800/40">
          <P w="25%" h={12} /><P w="35%" h={12} /><P w="20%" h={12} /><P w="15%" h={12} />
        </div>
      ))}
    </div>
  </div>
));
ModuleSkeleton.displayName = 'ModuleSkeleton';

// ─── DashboardSkeleton (Dashboard full-layout skeleton) ───────────────────────

export const DashboardSkeleton = memo(() => (
  <div className="p-5 space-y-4 animate-pulse">
    <div className="grid grid-cols-4 gap-3 mb-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-xl border border-slate-800 p-4 space-y-3">
          <P w="60%" h={10} /><P w="80%" h={22} /><P w="100%" h={24} />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2 rounded-xl border border-slate-800 p-5 space-y-3">
        <P w="35%" h={10} /><P w="100%" h={160} />
      </div>
      <div className="rounded-xl border border-slate-800 p-5 space-y-3">
        <P w="50%" h={10} />
        {Array.from({ length: 6 }, (_, i) => <P key={i} w="100%" h={32} cls="rounded-lg" />)}
      </div>
    </div>
  </div>
));
DashboardSkeleton.displayName = 'DashboardSkeleton';
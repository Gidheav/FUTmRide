// ─────────────────────────────────────────────────────────────────────────────
// Charts.tsx — shared SVG chart primitives
// Sources: FinancialSanctum (Spark/AreaChart/BarViz/Donut),
//          FinancialReports (MiniLine),
//          FinancialDashboard (Spark variant used under obs-* layout)
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import { compact } from '../helpers/hub.helpers';

// ─── Spark (Hub) ──────────────────────────────────────────────────────────────

export const Spark = memo(({ pts, color = '#10b981', w = 72, h = 28 }: {
  pts: number[]; color?: string; w?: number; h?: number;
}) => {
  if (pts.length < 2) return null;
  const max   = Math.max(...pts) || 1;
  const min   = Math.min(...pts);
  const range = max - min || 1;
  const coords = pts.map((v, i) =>
    `${(i / (pts.length - 1)) * w},${h - ((v - min) / range) * h}`
  );
  const area = [...coords, `${w},${h}`, `0,${h}`].join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ opacity: 0.8 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={coords.join(' ')} stroke={color} strokeWidth="1.5"
        fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
});
Spark.displayName = 'Spark';

// ─── AreaChart (Hub) ─────────────────────────────────────────────────────────

export const AreaChart = memo(({ data, color = '#10b981', h = 160, showGrid = true }: {
  data: { label: string; value: number }[];
  color?: string; h?: number; showGrid?: boolean;
}) => {
  const W   = 800;
  const PAD = { t: 10, r: 8, b: 28, l: 52 };
  const cw  = W - PAD.l - PAD.r;
  const ch  = h - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.value)) || 1;
  const xOf = (i: number) => PAD.l + (i / (data.length - 1 || 1)) * cw;
  const yOf = (v: number) => PAD.t + ch - (v / max) * ch;
  const linePts = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ');
  const areaPts = [`${PAD.l},${PAD.t + ch}`, ...data.map((d, i) => `${xOf(i)},${yOf(d.value)}`), `${PAD.l + cw},${PAD.t + ch}`].join(' ');
  const gridLines = 4;
  const stepV = max / gridLines;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" preserveAspectRatio="none" style={{ height: h }}>
      <defs>
        <linearGradient id={`ag-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      {showGrid && Array.from({ length: gridLines + 1 }, (_, i) => {
        const y = PAD.t + (i / gridLines) * ch;
        const v = max - i * stepV;
        return (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={PAD.l + cw} y2={y} stroke="currentColor" strokeWidth="1"
              style={{ color: 'var(--fh-border,#1e293b)' }} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize={9} fontFamily="monospace"
              style={{ fill: 'var(--fh-text3,#475569)' }}>
              {compact(v * 100)}
            </text>
          </g>
        );
      })}
      <polygon points={areaPts} fill={`url(#ag-${color.replace('#', '')})`} />
      <polyline points={linePts} stroke={color} strokeWidth="2" fill="none"
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          {data.length <= 14 && (
            <circle cx={xOf(i)} cy={yOf(d.value)} r="3" fill={color} stroke="#0f172a" strokeWidth="1.5" />
          )}
          <text x={xOf(i)} y={PAD.t + ch + 18} textAnchor="middle" fontSize={8}
            fill="var(--fh-text3,#64748b)" fontFamily="monospace">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
});
AreaChart.displayName = 'AreaChart';

// ─── BarViz (Hub) ─────────────────────────────────────────────────────────────

export const BarViz = memo(({ data, color = '#10b981', h = 120 }: {
  data: { label: string; value: number }[]; color?: string; h?: number;
}) => {
  if (!data.length) return null;
  const W   = 600;
  const PAD = { t: 4, r: 4, b: 20, l: 4 };
  const cw  = W - PAD.l - PAD.r;
  const ch  = h - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.value)) || 1;
  const bw  = Math.floor((cw - (data.length - 1) * 4) / data.length);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" style={{ height: h }}>
      {data.map((d, i) => {
        const bh = Math.max(2, Math.round((d.value / max) * ch));
        const x  = PAD.l + i * (bw + 4);
        const y  = PAD.t + ch - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx={2}
              fill={color} opacity={0.7 + 0.3 * (d.value / max)} />
            <text x={x + bw / 2} y={PAD.t + ch + 14} textAnchor="middle" fontSize={8}
              fill="var(--fh-text3,#475569)" fontFamily="monospace">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
BarViz.displayName = 'BarViz';

// ─── Donut (Hub) ─────────────────────────────────────────────────────────────

export const Donut = memo(({ segs, size = 140, thick = 26 }: {
  segs: { label: string; value: number; color: string }[]; size?: number; thick?: number;
}) => {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const r     = (size - thick) / 2;
  const cx    = size / 2;
  const circ  = 2 * Math.PI * r;
  let offset  = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke="var(--fh-surface2,#1e293b)" strokeWidth={thick} />
      {segs.map((s, i) => {
        const dash = (s.value / total) * circ;
        const gap  = circ - dash;
        const el   = (
          <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={s.color} strokeWidth={thick}
            strokeDasharray={`${dash - 1.5} ${gap + 1.5}`} strokeDashoffset={-offset}
            strokeLinecap="butt"
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cx - 4} textAnchor="middle" fontSize={13} fontWeight="700"
        fill="var(--fh-text1,#f1f5f9)" fontFamily="monospace">
        {segs.length}
      </text>
      <text x={cx} y={cx + 12} textAnchor="middle" fontSize={8}
        fill="var(--fh-text3,#475569)" fontFamily="monospace">
        CATEGORIES
      </text>
    </svg>
  );
});
Donut.displayName = 'Donut';

// ─── MiniLine (Reports) ───────────────────────────────────────────────────────

const G = '#10b981';

export const MiniLine = memo(({ pts, color = G, w = 80, h = 32 }: {
  pts: number[]; color?: string; w?: number; h?: number;
}) => {
  if (pts.length < 2) return null;
  const max    = Math.max(...pts) || 1;
  const min    = Math.min(...pts);
  const range  = max - min || 1;
  const coords = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / range) * h}`);
  const area   = [`0,${h}`, ...coords, `${w},${h}`].join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <defs>
        <linearGradient id={`ml-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#ml-${color.replace('#', '')})`} />
      <polyline points={coords.join(' ')} stroke={color} strokeWidth="1.5" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});
MiniLine.displayName = 'MiniLine';

// ─── ObsSpark (Dashboard — same logic, obs-* safe gradient id) ────────────────

export const ObsSpark = memo(({ data, color = 'var(--em)', w = 80, h = 28 }: {
  data: number[]; color?: string; w?: number; h?: number;
}) => {
  if (!data || data.length < 2) return null;
  const mn    = Math.min(...data);
  const mx    = Math.max(...data);
  const range = mx - mn || 1;
  const pts   = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - mn) / range) * h}`
  ).join(' ');
  const area = `M0,${h} L${pts.split(' ').join(' L')} L${w},${h} Z`;
  const gradId = `obsg-${w}-${h}`;
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <polyline fill="none" stroke={color} strokeWidth="1.8"
        strokeLinejoin="round" points={pts} />
      <circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - ((data[data.length - 1] - mn) / range) * h}
        r="2.5" fill={color} />
    </svg>
  );
});
ObsSpark.displayName = 'ObsSpark';
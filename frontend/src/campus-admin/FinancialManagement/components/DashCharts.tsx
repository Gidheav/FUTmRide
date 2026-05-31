// dashboard/components/DashCharts.tsx
// Chart primitives used exclusively inside The Observatory (FinancialDashboard).
// NOTE: The shared Charts.tsx has Hub/Reports variants; these are Observatory-specific.

import { memo } from 'react';

// ─── Multi-key Area Chart ─────────────────────────────────────────────────────
export const AreaChart = memo(({
  data, keys, colors, width = 500, height = 160,
}: {
  data: ({ [k: string]: number | string } & { m?: string })[];
  keys: string[];
  colors: string[];
  width?: number;
  height?: number;
}) => {
  const pad = { l: 8, r: 8, t: 8, b: 24 };
  const cw = width - pad.l - pad.r;
  const ch = height - pad.t - pad.b;
  const allVals = data.flatMap(d => keys.map(k => Number(d[k]) || 0));
  const mx = Math.max(...allVals) || 1;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * cw;
  const y = (v: number) => pad.t + ch - (v / mx) * ch;
  const gradId = (k: string) => `obs-acg-${k.replace(/\s/g, '')}`;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        {colors.map((c, i) => (
          <linearGradient key={i} id={gradId(keys[i])} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.35" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={pad.l} y1={pad.t + ch * t} x2={pad.l + cw} y2={pad.t + ch * t}
          stroke="var(--b2)" strokeWidth="0.8" strokeDasharray="3,4" />
      ))}
      {keys.map((k, ki) => {
        const pts = data.map((d, i) => `${x(i)},${y(Number(d[k]) || 0)}`);
        const area = `M${x(0)},${y(0) + ch + pad.t} L${pts.join(' L')} L${x(data.length - 1)},${y(0) + ch + pad.t} Z`;
        return <path key={k} d={area} fill={`url(#${gradId(k)})`} />;
      })}
      {keys.map((k, ki) => {
        const pts = data.map((d, i) => `${x(i)},${y(Number(d[k]) || 0)}`).join(' ');
        return (
          <polyline key={k} fill="none" stroke={colors[ki]} strokeWidth="1.8"
            strokeLinejoin="round" strokeLinecap="round" points={pts} />
        );
      })}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={height - 4} textAnchor="middle"
          style={{ fontSize: 9, fill: 'var(--t3)', fontFamily: 'JetBrains Mono,monospace' }}>
          {d.m || MONTHS[i]}
        </text>
      ))}
    </svg>
  );
});
AreaChart.displayName = 'AreaChart';

// ─── Bar Chart ────────────────────────────────────────────────────────────────
export const BarChart = memo(({
  data, colors, width = 500, height = 120,
}: {
  data: { label: string; value: number }[];
  colors: string[];
  width?: number;
  height?: number;
}) => {
  const pad = { l: 6, r: 6, t: 6, b: 20 };
  const mx = Math.max(...data.map(d => d.value)) || 1;
  const bw = (width - pad.l - pad.r) / data.length;
  const bpad = bw * 0.2;
  const ch = height - pad.t - pad.b;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        {colors.map((c, i) => (
          <linearGradient key={i} id={`obs-bcg-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.9" />
            <stop offset="100%" stopColor={c} stopOpacity="0.4" />
          </linearGradient>
        ))}
      </defs>
      {data.map((d, i) => {
        const bh = (d.value / mx) * ch;
        const bx = pad.l + i * bw + bpad / 2;
        const by = pad.t + ch - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw - bpad} height={bh}
              fill={`url(#obs-bcg-${i % colors.length})`} rx="2" />
            <text x={bx + (bw - bpad) / 2} y={height - 4} textAnchor="middle"
              style={{ fontSize: 8, fill: 'var(--t3)', fontFamily: 'JetBrains Mono,monospace' }}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
BarChart.displayName = 'BarChart';

// ─── Donut Chart (pct-based) ──────────────────────────────────────────────────
export const Donut = memo(({
  segments, r = 60, stroke = 14,
}: {
  segments: { color: string; pct: number }[];
  r?: number;
  stroke?: number;
}) => {
  const size = (r + stroke) * 2;
  const circ = 2 * Math.PI * r;
  let cumPct = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={r + stroke} cy={r + stroke} r={r} fill="none"
        stroke="var(--bg3)" strokeWidth={stroke} />
      {segments.map((s, i) => {
        const dash = s.pct / 100 * circ;
        const gap = circ - dash;
        const offset = circ * 0.25 - cumPct / 100 * circ;
        cumPct += s.pct;
        return (
          <circle key={i} cx={r + stroke} cy={r + stroke} r={r} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .6s ease' }} />
        );
      })}
    </svg>
  );
});
Donut.displayName = 'Donut';

// ─── Gauge Arc ────────────────────────────────────────────────────────────────
export const Gauge = memo(({
  value, max = 100, color = 'var(--em)', size = 120,
}: {
  value: number; max?: number; color?: string; size?: number;
}) => {
  const pct = Math.min(value / max, 1);
  const r = size * 0.38;
  const cx = size / 2, cy = size * 0.55;
  const startAngle = -Math.PI * 0.8;
  const endAngle = Math.PI * 0.8;
  const totalAngle = endAngle - startAngle;
  const angle = startAngle + pct * totalAngle;

  const arcPath = (sa: number, ea: number) => {
    const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
    const large = (ea - sa) > Math.PI ? 1 : 0;
    return `M${x1},${y1} A${r},${r},0,${large},1,${x2},${y2}`;
  };

  const nx = cx + r * Math.cos(angle), ny = cy + r * Math.sin(angle);

  return (
    <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
      <path d={arcPath(startAngle, endAngle)} fill="none"
        stroke="var(--bg3)" strokeWidth="8" strokeLinecap="round" />
      {pct > 0 && (
        <path d={arcPath(startAngle, angle)} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          style={{ transition: 'all .6s ease' }} />
      )}
      <circle cx={nx} cy={ny} r="5" fill={color} style={{ transition: 'all .6s ease' }} />
    </svg>
  );
});
Gauge.displayName = 'Gauge';

// ─── Radar Chart ──────────────────────────────────────────────────────────────
export const Radar = memo(({
  scores, size = 200,
}: {
  scores: { label: string; score: number }[];
  size?: number;
}) => {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.36;
  const n = scores.length;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI / n) * i;
  const pt = (i: number, scale: number) => ({
    x: cx + r * scale * Math.cos(angle(i)),
    y: cy + r * scale * Math.sin(angle(i)),
  });
  const polyPts = (scale: number) =>
    scores.map((_, i) => { const p = pt(i, scale); return `${p.x},${p.y}`; }).join(' ');
  const dataPts = scores.map((s, i) => pt(i, s.score / 100));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map(s => (
        <polygon key={s} points={polyPts(s)} fill="none" stroke="var(--b2)" strokeWidth="0.8" />
      ))}
      {scores.map((_, i) => {
        const p = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--b2)" strokeWidth="0.8" />;
      })}
      <polygon points={dataPts.map(p => `${p.x},${p.y}`).join(' ')}
        fill="var(--emg)" stroke="var(--em)" strokeWidth="1.8" strokeLinejoin="round" />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--em)" />
      ))}
      {scores.map((s, i) => {
        const p = pt(i, 1.2);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 9, fill: 'var(--t3)', fontFamily: 'JetBrains Mono,monospace' }}>
            {s.label}
          </text>
        );
      })}
    </svg>
  );
});
Radar.displayName = 'Radar';
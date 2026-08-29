import type { ReactNode } from 'react'
import { T } from '../../theme'

const LIVE = '#10b981'
const WHATIF = '#a855f7'
const MUTED = '#64748b'

function ChartBox({
  title,
  subtitle,
  children,
  height,
  style,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  height?: number
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: T.bgPanel,
      border: `1px solid ${T.border}`,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: height ?? 0,
      ...style,
    }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  )
}

/** Grouped vertical bars — live vs what-if */
export function TotalsComparisonChart({
  live,
  whatIf,
}: {
  live: { total: number; platform: number; driver: number } | null
  whatIf: { total: number; platform: number; driver: number } | null
}) {
  const rows = [
    { key: 'Total fare', live: live?.total ?? 0, whatIf: whatIf?.total ?? 0 },
    { key: 'Platform', live: live?.platform ?? 0, whatIf: whatIf?.platform ?? 0 },
    { key: 'Driver', live: live?.driver ?? 0, whatIf: whatIf?.driver ?? 0 },
  ]
  const max = Math.max(...rows.flatMap((r) => [r.live, r.whatIf]), 1)
  const h = 120
  const barW = 22
  const gap = 36

  if (!live && !whatIf) {
    return (
      <ChartBox title="Fare comparison" subtitle="Run calculation to compare totals">
        <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, fontSize: 11 }}>
          No data yet
        </div>
      </ChartBox>
    )
  }

  const vbW = rows.length * 80 + 40
  const vbH = h + 32

  return (
    <ChartBox title="Fare comparison" subtitle="Live production vs what-if totals" style={{ flex: 1, minHeight: 0 }}>
      <div style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', maxWidth: '100%', flex: 1, minHeight: 0 }}
      >
        {rows.map((row, i) => {
          const x = 24 + i * 80
          const liveH = (row.live / max) * h
          const whatH = (row.whatIf / max) * h
          return (
            <g key={row.key}>
              <rect x={x} y={h - liveH} width={barW} height={liveH} fill={LIVE} opacity={0.85} />
              <rect x={x + barW + 6} y={h - whatH} width={barW} height={whatH} fill={WHATIF} opacity={0.85} />
              <text x={x + barW + 3} y={h + 14} textAnchor="middle" fill={MUTED} fontSize={9} fontFamily="system-ui">
                {row.key}
              </text>
              <text x={x + 6} y={h - liveH - 4} textAnchor="middle" fill={LIVE} fontSize={8} fontFamily="monospace">
                {row.live > 0 ? `₦${Math.round(row.live)}` : ''}
              </text>
              <text x={x + barW + 12} y={h - whatH - 4} textAnchor="middle" fill={WHATIF} fontSize={8} fontFamily="monospace">
                {row.whatIf > 0 ? `₦${Math.round(row.whatIf)}` : ''}
              </text>
            </g>
          )
        })}
        <rect x={8} y={4} width={8} height={8} fill={LIVE} />
        <text x={20} y={11} fill={MUTED} fontSize={9}>Live</text>
        <rect x={52} y={4} width={8} height={8} fill={WHATIF} />
        <text x={64} y={11} fill={MUTED} fontSize={9}>What-if</text>
      </svg>
      </div>
    </ChartBox>
  )
}

const SENS_CHART_CSS = `
.fare-sens-chart-wrap {
  width: 100%;
  aspect-ratio: 12 / 5;
  max-height: 240px;
  min-height: 180px;
  position: relative;
}
.fare-sens-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}
.fare-sens-line-live {
  fill: none;
  stroke: ${LIVE};
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1200;
  stroke-dashoffset: 1200;
  animation: fare-sens-draw 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.fare-sens-line-what {
  fill: none;
  stroke: ${WHATIF};
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 8 5;
  stroke-dashoffset: 1200;
  animation: fare-sens-draw 1.6s cubic-bezier(0.4, 0, 0.2, 1) 0.15s forwards;
}
.fare-sens-area-live {
  opacity: 0;
  animation: fare-sens-area-in 0.9s ease 0.5s forwards;
}
.fare-sens-area-what {
  opacity: 0;
  animation: fare-sens-area-in 0.9s ease 0.65s forwards;
}
.fare-sens-dot {
  opacity: 0;
  transform-origin: center;
  animation: fare-sens-dot-in 0.35s ease forwards;
}
@keyframes fare-sens-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes fare-sens-area-in {
  to { opacity: 1; }
}
@keyframes fare-sens-dot-in {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}
.fare-sens-pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: fare-sens-pulse 2s ease-in-out infinite;
}
@keyframes fare-sens-pulse {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50% { opacity: 0.08; transform: scale(1.75); }
}
`

/** Animated dual-line chart — fare growth vs distance (live vs what-if) */
export function SensitivityLineChart({
  rows,
  highlightKm,
  animKey = 0,
}: {
  rows: { km: number; live: number | null; whatIf: number }[]
  highlightKm: number
  animKey?: number
}) {
  const activeKm = rows.reduce((best, r) =>
    Math.abs(r.km - highlightKm) < Math.abs(best - highlightKm) ? r.km : best,
  rows[0]?.km ?? highlightKm)

  const W = 480
  const H = 200
  const pad = { t: 18, r: 20, b: 32, l: 48 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const maxY = Math.max(...rows.flatMap((r) => [r.live ?? 0, r.whatIf]), 1)
  const minKm = rows[0]?.km ?? 0
  const maxKm = rows[rows.length - 1]?.km ?? 1
  const baseY = pad.t + innerH

  const x = (km: number) => pad.l + ((km - minKm) / (maxKm - minKm || 1)) * innerW
  const y = (v: number) => pad.t + innerH - (v / maxY) * innerH

  const liveRows = rows.filter((r) => r.live != null)
  const linePts = (getV: (r: (typeof rows)[0]) => number) =>
    rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(r.km).toFixed(1)} ${y(getV(r)).toFixed(1)}`).join(' ')

  const liveLine = liveRows.length
    ? liveRows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(r.km).toFixed(1)} ${y(r.live!).toFixed(1)}`).join(' ')
    : ''
  const whatLine = linePts((r) => r.whatIf)

  const areaPath = (line: string, firstKm: number, lastKm: number) =>
    line ? `${line} L ${x(lastKm).toFixed(1)} ${baseY} L ${x(firstKm).toFixed(1)} ${baseY} Z` : ''

  const liveArea = liveRows.length
    ? areaPath(liveLine, liveRows[0].km, liveRows[liveRows.length - 1].km)
    : ''
  const whatArea = areaPath(whatLine, rows[0].km, rows[rows.length - 1].km)

  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <ChartBox title="Distance sensitivity" subtitle="Animated fare curves — see live vs what-if rise and fall by trip length" style={{ flex: 1, minHeight: 0 }}>
      <style>{SENS_CHART_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 10, color: MUTED }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 20, height: 3, background: LIVE, borderRadius: 1 }} />
            Live (production)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 20, height: 0, borderTop: `2px dashed ${WHATIF}` }} />
            What-if (sandbox)
          </span>
        </div>
        <span style={{ fontSize: 9, color: T.textMuted }}>↗ longer trips · replay on Calculate</span>
      </div>

      <div className="fare-sens-chart-wrap" key={animKey}>
        <svg className="fare-sens-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="fareSensLiveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LIVE} stopOpacity={0.35} />
              <stop offset="100%" stopColor={LIVE} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fareSensWhatFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WHATIF} stopOpacity={0.28} />
              <stop offset="100%" stopColor={WHATIF} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {yTicks.map((pct) => {
            const gy = pad.t + innerH * (1 - pct)
            const val = Math.round(maxY * pct)
            return (
              <g key={pct}>
                <line x1={pad.l} y1={gy} x2={W - pad.r} y2={gy} stroke={T.border} strokeWidth={1} strokeDasharray="3 4" />
                <text x={pad.l - 6} y={gy + 4} textAnchor="end" fill={MUTED} fontSize={9} fontFamily="monospace">
                  {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                </text>
              </g>
            )
          })}

          {liveArea && <path className="fare-sens-area-live" d={liveArea} fill="url(#fareSensLiveFill)" />}
          {whatArea && <path className="fare-sens-area-what" d={whatArea} fill="url(#fareSensWhatFill)" />}
          {liveLine && <path className="fare-sens-line-live" d={liveLine} />}
          <path className="fare-sens-line-what" d={whatLine} />

          {rows.map((r, i) => {
            const active = r.km === activeKm
            return (
              <g key={r.km}>
                {r.live != null && (
                  <circle
                    className="fare-sens-dot"
                    cx={x(r.km)}
                    cy={y(r.live)}
                    r={active ? 4.5 : 3}
                    fill={LIVE}
                    style={{ animationDelay: `${0.8 + i * 0.06}s` }}
                  />
                )}
                <circle
                  className="fare-sens-dot"
                  cx={x(r.km)}
                  cy={y(r.whatIf)}
                  r={active ? 4.5 : 3}
                  fill={WHATIF}
                  style={{ animationDelay: `${0.95 + i * 0.06}s` }}
                />
                {active && (
                  <circle className="fare-sens-pulse" cx={x(r.km)} cy={y(r.whatIf)} r={8} fill={WHATIF} />
                )}
                <text
                  x={x(r.km)}
                  y={H - 10}
                  textAnchor="middle"
                  fill={active ? T.textPrimary : MUTED}
                  fontSize={9}
                  fontWeight={active ? 700 : 400}
                  fontFamily="monospace"
                >
                  {r.km}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </ChartBox>
  )
}

/** Horizontal fleet ranking bars */
export function FleetBarChart({
  rows,
  activeId,
  onSelect,
}: {
  rows: { id: string; label: string; total: number; hasLive: boolean }[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const max = Math.max(...rows.map((r) => r.total), 1)

  return (
    <ChartBox title="Fleet at this trip" subtitle={`${rows.length} vehicle classes · click to switch`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row) => {
          const pct = (row.total / max) * 100
          const active = row.id === activeId
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr 52px',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                border: `1px solid ${active ? T.accent : T.border}`,
                background: active ? T.accentBg : T.bgInput,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: T.textPrimary }}>{row.label}</span>
              <div style={{ height: 10, background: T.border, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: active ? T.accent : LIVE, opacity: 0.9 }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#10b981', textAlign: 'right' }}>
                ₦{row.total.toLocaleString()}
              </span>
            </button>
          )
        })}
      </div>
    </ChartBox>
  )
}

/** Side-by-side stacked component bars */
export function ComponentSplitChart({
  live,
  whatIf,
}: {
  live: { base: number; distance: number; booking: number; surge: number; minAdj: number } | null
  whatIf: { base: number; distance: number; booking: number; surge: number; minAdj: number } | null
}) {
  const parts = ['Base', 'Distance', 'Booking', 'Surge', 'Min adj.']
  const getParts = (r: typeof live) => r
    ? [r.base, r.distance, r.booking, r.surge, r.minAdj]
    : [0, 0, 0, 0, 0]
  const colors = ['#64748b', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b']
  const liveVals = getParts(live)
  const whatVals = getParts(whatIf)
  const max = Math.max(...liveVals, ...whatVals, 1)

  return (
    <ChartBox title="Fare composition" subtitle="Base, distance, booking, and surge split" style={{ flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1 }}>
        {[{ label: 'Live', vals: liveVals, accent: LIVE }, { label: 'What-if', vals: whatVals, accent: WHATIF }].map((col) => (
          <div key={col.label}>
            <div style={{ fontSize: 9, fontWeight: 700, color: col.accent, marginBottom: 8, textTransform: 'uppercase' }}>{col.label}</div>
            {parts.map((p, i) => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 8, color: MUTED, width: 44, flexShrink: 0 }}>{p}</span>
                <div style={{ flex: 1, height: 8, background: T.border }}>
                  <div style={{ width: `${(col.vals[i] / max) * 100}%`, height: '100%', background: colors[i] }} />
                </div>
                <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textSecondary, width: 36, textAlign: 'right' }}>
                  {col.vals[i] > 0 ? col.vals[i] : '—'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {parts.map((p, i) => (
          <span key={p} style={{ fontSize: 8, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, background: colors[i] }} />
            {p}
          </span>
        ))}
      </div>
      </div>
    </ChartBox>
  )
}

/** Delta waterfall strip */
export function DeltaInsightStrip({
  delta,
  distance,
  surge,
  vehicleLabel,
  hasResults,
}: {
  delta: { amount: number; pct: number } | null
  distance: number
  surge: number
  vehicleLabel: string
  hasResults: boolean
}) {
  const items = hasResults && delta
    ? [
        { label: 'Scenario', value: `${vehicleLabel} · ${distance} km · ${surge}×` },
        { label: 'Impact', value: `${delta.amount >= 0 ? '+' : ''}₦${delta.amount.toLocaleString()} (${delta.pct >= 0 ? '+' : ''}${delta.pct.toFixed(1)}%)` },
        { label: 'Per extra km', value: distance > 0 && delta ? `~₦${Math.round(delta.amount / distance)}` : '—' },
      ]
    : [
        { label: 'Ready', value: 'Set trip + tariff, then calculate' },
      ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: 2,
      background: T.border,
    }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ background: T.bgPanel, padding: '10px 14px', border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>{it.label}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, marginTop: 4, fontFamily: 'monospace' }}>{it.value}</div>
        </div>
      ))}
    </div>
  )
}

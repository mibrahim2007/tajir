import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { type AgingBuckets } from '@/lib/reports/aging'

/*
 * Presentational pieces of the dashboard.
 *
 * Split out of page.tsx so the page file stays about WHAT is shown and this one
 * about HOW. Everything here is a server component — no state, no effects.
 *
 * One rule holds the visual language together: the accent blue belongs to
 * controls and the lime to affirmative values, while data series draw from the
 * --chart-* scale. A bar and a button never share a colour, so nothing on the
 * page looks clickable that isn't.
 */

/*
 * Series identity is a token, not a hex value. A literal #a3e635 is a bright
 * lime on navy and an unreadable smear on white, so every chart colour below is
 * a --chart-* reference that the active theme resolves. `tone()` builds the
 * same reference at an alpha, for fills and glows.
 */
export const CHART_VARS = [
  '--chart-1', '--chart-2', '--chart-3', '--chart-4',
  '--chart-5', '--chart-6', '--chart-7', '--chart-8',
] as const

export function tone(v: string, alpha?: number) {
  return alpha === undefined ? `hsl(var(${v}))` : `hsl(var(${v}) / ${alpha})`
}

export function shortPKR(n: number): string {
  if (n >= 1_00_00_000) return `Rs ${(n / 1_00_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000)    return `Rs ${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000)       return `Rs ${(n / 1_000).toFixed(0)}K`
  return formatPKR(n)
}

/* ── Panel chrome ─────────────────────────────────────────────── */

export function Panel({
  title, subtitle, action, children, className = '',
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`panel p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && <p className="font-bold text-[13px] tracking-tight text-foreground">{title}</p>}
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

/* ── Small stat tile ──────────────────────────────────────────── */

/**
 * Deliberately compact. These sit clustered on the left rather than stretched
 * across the full width, so a row of five no longer eats the whole first
 * screen before any actual chart appears.
 */
export function MiniStat({
  label, value, sub, up, className = '',
}: {
  label: string
  value: string
  sub?: string
  up?: boolean
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-border/80 bg-tile/60 px-3 py-2.5 min-w-0 ${className}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground truncate">{label}</p>
      <p className="font-mono font-extrabold text-[17px] tracking-tight mt-1.5 leading-none text-foreground truncate">
        {value}
      </p>
      {sub && (
        <p className={`text-[10px] mt-1.5 flex items-center gap-0.5 font-semibold truncate ${
          up === true ? 'text-success' : up === false ? 'text-destructive' : 'text-muted-foreground'
        }`}>
          {up === true && <ArrowUpRight className="h-2.5 w-2.5 shrink-0" />}
          {up === false && <ArrowDownRight className="h-2.5 w-2.5 shrink-0" />}
          <span className="truncate">{sub}</span>
        </p>
      )}
    </div>
  )
}

/* ── Horizontal bar track ─────────────────────────────────────── */

/**
 * The banded horizontal bars from the reference. Every bar starts at the same
 * left edge and is scaled against the largest value — the reference offsets its
 * bars along a time axis, but an offset here would imply a start point these
 * numbers do not have, so the axis measures value instead and the bars stay
 * honest while keeping the same shape on the page.
 */
export function TrackBars({
  data, vars, emptyMsg,
}: {
  data: { label: string; value: number }[]
  /** Series tokens, cycled across the rows. */
  vars: readonly string[]
  emptyMsg: string
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMsg}</p>
  }
  const max = Math.max(...data.map((d) => d.value), 1)
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div>
      {/* Value axis, mirroring the reference's time ruler */}
      <div className="grid gap-3 mb-2.5" style={{ gridTemplateColumns: '104px 1fr 58px' }}>
        <span />
        <div className="flex justify-between text-[9px] font-semibold text-muted-foreground/60 tabular-nums">
          {ticks.map((t) => (
            <span key={t}>{t === 0 ? '0' : shortPKR(max * t)}</span>
          ))}
        </div>
        <span />
      </div>

      <div className="space-y-2">
        {data.map((d, i) => {
          const pct = Math.max((d.value / max) * 100, 3)
          const v = vars[i % vars.length]
          return (
            <div key={i} className="grid items-center gap-3" style={{ gridTemplateColumns: '104px 1fr 58px' }}>
              <p className="text-[11px] text-muted-foreground truncate" title={d.label}>{d.label}</p>
              <div className="relative h-[22px] rounded-lg bg-tile border border-border/50 overflow-hidden">
                {[25, 50, 75].map((g) => (
                  <span key={g} className="absolute inset-y-0 w-px bg-border/50" style={{ left: `${g}%` }} />
                ))}
                <span
                  className="absolute inset-y-[3px] left-[3px] rounded-md"
                  style={{
                    width: `calc(${pct}% - 6px)`,
                    background: `linear-gradient(90deg, ${tone(v, 0.75)}, ${tone(v)})`,
                    boxShadow: `0 0 14px ${tone(v, 0.35)}`,
                  }}
                />
              </div>
              <p className="text-[10.5px] font-mono font-bold text-right tabular-nums text-foreground">
                {shortPKR(d.value)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Aging ────────────────────────────────────────────────────── */

const AGING_BANDS = [
  { key: 'bucket0_30',   label: '0–30',  v: '--chart-2' },
  { key: 'bucket31_60',  label: '31–60', v: '--chart-3' },
  { key: 'bucket61_90',  label: '61–90', v: '--chart-8' },
  { key: 'bucket90plus', label: '90+',   v: '--destructive' },
] as const

export function AgingCard({ title, href, buckets, emptyMsg }: {
  title: string
  href: string
  buckets: AgingBuckets
  emptyMsg: string
}) {
  const overdue = buckets.total - buckets.bucket0_30

  return (
    <Panel
      title={title}
      subtitle={buckets.total > 0 ? `${formatPKR(overdue)} past 30 days` : 'Nothing outstanding'}
      action={<Link href={href} className="text-[11px] text-primary font-bold hover:underline">Details →</Link>}
    >
      {buckets.total <= 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyMsg}</p>
      ) : (
        <>
          <div className="flex h-2.5 rounded-full overflow-hidden mb-4 bg-tile">
            {AGING_BANDS.map((b) => {
              const v = buckets[b.key]
              if (v <= 0) return null
              return (
                <span
                  key={b.key}
                  title={`${b.label} days · ${formatPKR(v)}`}
                  style={{
                    width: `${(v / buckets.total) * 100}%`,
                    backgroundColor: tone(b.v),
                    boxShadow: `0 0 12px ${tone(b.v, 0.4)}`,
                  }}
                />
              )
            })}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {AGING_BANDS.map((b) => (
              <div key={b.key} className="min-w-0">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: tone(b.v) }} />
                  {b.label}
                </p>
                <p className="text-[13px] font-bold font-mono text-foreground mt-1 truncate">
                  {buckets[b.key] > 0 ? shortPKR(buckets[b.key]) : '—'}
                </p>
              </div>
            ))}
          </div>

          {buckets.oldestDate && (
            <p className="text-[11px] text-muted-foreground mt-3">
              Oldest outstanding since {formatPKTDate(buckets.oldestDate + 'T00:00:00')}
            </p>
          )}
        </>
      )}
    </Panel>
  )
}

/* ── Line chart ───────────────────────────────────────────────── */

export function RevenueChart({ months, revenue, purchases }: {
  months: string[]
  revenue: number[]
  purchases: number[]
}) {
  const W = 600, H = 190
  const padL = 10, padR = 10, padT = 14, padB = 26
  const pw = W - padL - padR
  const ph = H - padT - padB
  const n = months.length
  if (n < 2) return null

  const maxVal = Math.max(...revenue, ...purchases, 1)
  const x = (i: number) => +(padL + (i / (n - 1)) * pw).toFixed(1)
  const y = (v: number) => +(padT + (1 - v / maxVal) * ph).toFixed(1)

  const line = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  const revPts = line(revenue)
  const purPts = line(purchases)
  const revArea = `${revPts} L${x(n - 1)},${padT + ph} L${x(0)},${padT + ph}Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 170 }} aria-hidden="true">
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Horizontal guides, as in the reference's performance panel */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padL} x2={W - padR}
          y1={padT + t * ph} y2={padT + t * ph}
          stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5"
        />
      ))}

      <path d={revArea} fill="url(#revGrad)" />
      <path d={purPts} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
      <path d={revPts} fill="none" stroke="hsl(var(--chart-1))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {months.map((m, i) => (
        <g key={m}>
          <circle cx={x(i)} cy={y(purchases[i])} r="3" fill="hsl(var(--chart-2))" />
          <circle cx={x(i)} cy={y(revenue[i])} r="3.5" fill="hsl(var(--chart-1))" stroke="hsl(var(--card))" strokeWidth="1.5" />
          <text
            x={x(i)} y={H - 6} textAnchor="middle" fontSize="10"
            style={{ fill: 'hsl(var(--muted-foreground))', fontFamily: 'inherit' }}
          >
            {m}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* ── Donut ────────────────────────────────────────────────────── */

export function DonutChart({ data }: { data: { label: string; value: number; v: string }[] }) {
  const filtered = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
  if (filtered.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No stock in categories</p>
  }

  const total = filtered.reduce((s, d) => s + d.value, 0)
  const cx = 80, cy = 80, R = 66, ir = 44
  const f = (n: number) => n.toFixed(1)
  const totalStr = total >= 100_000 ? `${(total / 1_000).toFixed(0)}K` : total.toLocaleString('en-IN')

  const paths: { d: string; color: string }[] = []

  if (filtered.length === 1) {
    /* Single segment — render as two semicircles */
    paths.push({
      color: tone(filtered[0].v),
      d: [
        `M${f(cx + R)},${f(cy)}`,
        `A${R},${R} 0 0,1 ${f(cx - R)},${f(cy)}`,
        `A${R},${R} 0 0,1 ${f(cx + R)},${f(cy)}`,
        `M${f(cx + ir)},${f(cy)}`,
        `A${ir},${ir} 0 0,0 ${f(cx - ir)},${f(cy)}`,
        `A${ir},${ir} 0 0,0 ${f(cx + ir)},${f(cy)}`,
        `Z`,
      ].join(' '),
    })
  } else {
    let angle = -Math.PI / 2
    filtered.forEach((seg) => {
      const sweep = (seg.value / total) * 2 * Math.PI
      const ea = angle + sweep
      const lg = sweep > Math.PI ? 1 : 0
      const ox1 = cx + R * Math.cos(angle), oy1 = cy + R * Math.sin(angle)
      const ox2 = cx + R * Math.cos(ea),    oy2 = cy + R * Math.sin(ea)
      const ix1 = cx + ir * Math.cos(ea),   iy1 = cy + ir * Math.sin(ea)
      const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle)
      paths.push({
        color: tone(seg.v),
        d: `M${f(ox1)},${f(oy1)} A${R},${R} 0 ${lg},1 ${f(ox2)},${f(oy2)} L${f(ix1)},${f(iy1)} A${ir},${ir} 0 ${lg},0 ${f(ix2)},${f(iy2)} Z`,
      })
      angle = ea
    })
  }

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="w-[132px] h-[132px] shrink-0" aria-hidden>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="hsl(var(--card))" strokeWidth="1.5" />
        ))}
        <text
          x={cx} y={cy - 3} textAnchor="middle" fontSize="15" fontWeight="bold"
          style={{ fill: 'hsl(var(--foreground))', fontFamily: 'inherit' }}
        >
          {totalStr}
        </text>
        <text
          x={cx} y={cy + 13} textAnchor="middle" fontSize="9"
          style={{ fill: 'hsl(var(--muted-foreground))', fontFamily: 'inherit' }}
        >
          units
        </text>
      </svg>

      {/* Legend carries the share, the way the reference reads "780 (62%)" */}
      <div className="space-y-2 flex-1 min-w-0">
        {filtered.slice(0, 5).map((seg, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: tone(seg.v), boxShadow: `0 0 8px ${tone(seg.v, 0.5)}` }}
            />
            <span className="text-[11.5px] text-muted-foreground truncate flex-1">{seg.label}</span>
            <span className="text-[11px] font-mono font-semibold text-foreground shrink-0 tabular-nums">
              {seg.value.toLocaleString('en-IN')}
              <span className="text-muted-foreground font-normal ml-1">
                ({Math.round((seg.value / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Activity feed ────────────────────────────────────────────── */

export function FeedRow({ v, title, meta, right }: {
  /** Series token for the status dot. */
  v: string
  title: string
  meta: string
  right: string
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 min-w-0">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: tone(v), boxShadow: `0 0 8px ${tone(v, 0.6)}` }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-foreground truncate">{title}</p>
        <p className="text-[10.5px] text-muted-foreground truncate">{meta}</p>
      </div>
      <p className="text-[11.5px] font-mono font-bold text-foreground shrink-0 tabular-nums">{right}</p>
    </div>
  )
}

/* ── Option tiles ─────────────────────────────────────────────── */

const CHIP_TONES = ['', 'icon-chip-lime', 'icon-chip-cyan', 'icon-chip-violet', 'icon-chip-amber'] as const
const UNDERLINE = ['--chart-1', '--chart-2', '--chart-5', '--chart-4', '--chart-3']

/**
 * The icon-above-label option from the reference's feature strip: an outlined
 * circular icon in a vibrant hue, the label beneath it, and a short coloured
 * rule under that. Tones cycle so a row reads as a set rather than a list.
 */
export function OptionTile({ href, label, icon: Icon, index }: {
  href: string
  label: string
  icon: React.ElementType
  index: number
}) {
  const chip = CHIP_TONES[index % CHIP_TONES.length]
  const rule = UNDERLINE[index % UNDERLINE.length]

  return (
    <Link
      href={href}
      className="group flex flex-col items-center text-center gap-2.5 px-2 py-4 rounded-2xl transition-all hover:bg-secondary/60"
    >
      <span className={`icon-chip ${chip} h-14 w-14 rounded-full border-2 transition-transform group-hover:scale-105`}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-[12px] font-bold text-foreground leading-tight">{label}</span>
      <span
        className="h-[2px] w-7 rounded-full opacity-70 group-hover:opacity-100 group-hover:w-10 transition-all"
        style={{ backgroundColor: tone(rule), boxShadow: `0 0 8px ${tone(rule, 0.6)}` }}
      />
    </Link>
  )
}

/** Compact icon-on-top tile for the denser quick-action grid. */
export function ActionTile({ href, label, icon: Icon, index }: {
  href: string
  label: string
  icon: React.ElementType
  index: number
}) {
  const chip = CHIP_TONES[index % CHIP_TONES.length]
  return (
    <Link
      href={href}
      className="group flex flex-col items-center text-center gap-1.5 px-1 py-2.5 rounded-xl border border-border/70 bg-tile/60 transition-all hover:border-primary/40 hover:bg-secondary"
    >
      <span className={`icon-chip ${chip} h-9 w-9 rounded-xl transition-transform group-hover:scale-110`}>
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight transition-colors truncate w-full">
        {label}
      </span>
    </Link>
  )
}

/**
 * Gráficos (Recharts, chunk 'charts'). Cada gráfico tiene su equivalente accesible en HTML
 * (tabla oculta o lista visible), porque el SVG no se lee bien con lectores de pantalla.
 */
import type { ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { ExpenseCategory, ISODate, Money, YearMonth } from '@/api/types'
import { useCssVars } from '@/hooks/useCssVars'
import { cn } from '@/lib/cn'
import { formatDate, formatKm, formatMoney, formatMonth, formatPercent, toNumber } from '@/lib/format'
import { EXPENSE_CATEGORY_ICON, EXPENSE_CATEGORY_LABEL } from '@/lib/labels'

const VARS = ['chart-1', 'chart-2', 'fg-subtle', 'fg-muted', 'line', 'surface-3', 'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-other', 'accent'] as const

function TooltipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-control border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl shadow-black/30">
      <p className="font-medium text-fg-muted">{title}</p>
      <div className="mt-0.5 text-sm font-semibold text-fg tabular">{children}</div>
    </div>
  )
}

/**
 * Tabla solo para lectores de pantalla con los datos del gráfico. Va dentro de un div sr-only:
 * una <table> no respeta height: 1px y alargaba la página con un hueco vacío (hallazgo I2 de UX).
 */
function SrTable({ caption, headers, rows }: { caption: string; headers: [string, string]; rows: [string, string][] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headers[0]}</th>
            <th scope="col">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a}>
              <th scope="row">{a}</th>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───────── Barras mensuales ─────────

export interface MonthlyBarsProps {
  data: { month: YearMonth; total: Money }[]
  /** Título accesible (también caption de la tabla). */
  label: string
  height?: number
  className?: string
  /** Mes resaltado en el color principal. Por defecto, el último; null ⇒ ninguno. */
  highlightMonth?: YearMonth | null
  /**
   * Tabla oculta para lectores de pantalla. Desactívala solo si la pantalla ya muestra
   * los mismos datos en una tabla visible (si no, el gráfico se queda sin alternativa).
   */
  srTable?: boolean
}

export function MonthlyBars({ data, label, height = 220, className, highlightMonth, srTable = true }: MonthlyBarsProps) {
  const c = useCssVars(VARS)
  const rows = data.map((d) => ({ month: d.month, value: toNumber(d.total) ?? 0 }))
  const highlighted = highlightMonth === undefined ? rows[rows.length - 1]?.month : highlightMonth
  const anyHighlighted = rows.some((r) => r.month === highlighted)
  return (
    <figure className={cn('min-w-0', className)}>
      <div aria-hidden style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 4" />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => formatMonth(m)}
              tick={{ fill: c['fg-subtle'], fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              width={56}
              tickFormatter={(v: number) => formatMoney(v, { round: true, compact: true })}
              tick={{ fill: c['fg-subtle'], fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: c['surface-3'], opacity: 0.5 }}
              content={(p: TooltipContentProps) =>
                p.active && p.payload?.length ? <TooltipBox title={formatMonth(String(p.label), 'long')}>{formatMoney(Number(p.payload[0].value))}</TooltipBox> : null
              }
            />
            <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={36} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell
                  key={r.month}
                  fill={r.month === highlighted ? c['chart-1'] : c['fg-subtle']}
                  fillOpacity={r.month === highlighted ? 1 : anyHighlighted ? 0.45 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {srTable && <SrTable caption={label} headers={['Mes', 'Importe']} rows={data.map((d) => [formatMonth(d.month, 'long'), formatMoney(d.total)])} />}
    </figure>
  )
}

// ───────── Kilometraje acumulado ─────────

export function MileageArea({ series, label, height = 200, className }: { series: { date: ISODate; mileage: number }[]; label: string; height?: number; className?: string }) {
  const c = useCssVars(VARS)
  const min = Math.min(...series.map((s) => s.mileage))
  const max = Math.max(...series.map((s) => s.mileage))
  const pad = Math.max(500, Math.round((max - min) * 0.1))
  return (
    <figure className={cn('min-w-0', className)}>
      <div aria-hidden style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="km-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c['chart-2']} stopOpacity={0.35} />
                <stop offset="100%" stopColor={c['chart-2']} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 4" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDate(d, 'dayMonth')}
              tick={{ fill: c['fg-subtle'], fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              width={64}
              domain={[Math.max(0, min - pad), max + pad]}
              tickFormatter={(v: number) => new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}
              tick={{ fill: c['fg-subtle'], fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={(p: TooltipContentProps) =>
                p.active && p.payload?.length ? <TooltipBox title={formatDate(String(p.label), 'long')}>{formatKm(Number(p.payload[0].value))}</TooltipBox> : null
              }
            />
            <Area type="monotone" dataKey="mileage" stroke={c['chart-2']} strokeWidth={2} fill="url(#km-fill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption={label} headers={['Fecha', 'Kilometraje']} rows={series.map((s) => [formatDate(s.date, 'long'), formatKm(s.mileage)])} />
    </figure>
  )
}

// ───────── Gasto por categoría (donut + leyenda HTML) ─────────

const CAT_KEYS = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5'] as const

export function CategoryBreakdown({ data, className }: { data: { category: ExpenseCategory; total: Money; count: number }[]; className?: string }) {
  const c = useCssVars(VARS)
  const sorted = [...data].map((d) => ({ ...d, value: toNumber(d.total) ?? 0 })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
  // Máximo 5 colores categóricos; el resto se agrupa en «Otros» con el gris neutro
  const top = sorted.slice(0, 5)
  const restValue = sorted.slice(5).reduce((s, d) => s + d.value, 0)
  const restCount = sorted.slice(5).reduce((s, d) => s + d.count, 0)
  const total = sorted.reduce((s, d) => s + d.value, 0)
  const slices = [
    ...top.map((d, i) => ({ key: d.category as string, label: EXPENSE_CATEGORY_LABEL[d.category], value: d.value, count: d.count, color: c[CAT_KEYS[i]], icon: EXPENSE_CATEGORY_ICON[d.category] })),
    ...(restValue > 0 ? [{ key: 'rest', label: 'Resto de categorías', value: restValue, count: restCount, color: c['cat-other'], icon: null }] : []),
  ]

  return (
    <div className={cn('grid items-center gap-6 sm:grid-cols-[180px_minmax(0,1fr)]', className)}>
      <div aria-hidden className="relative mx-auto size-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius={58} outerRadius={86} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-fg-subtle">Total</p>
            <p className="font-display text-lg font-semibold text-fg-warm tabular">{formatMoney(total, { round: total >= 10000 })}</p>
          </div>
        </div>
      </div>
      <ul className="min-w-0 divide-y divide-line" aria-label="Gasto por categoría">
        {slices.map((s) => {
          const Icon = s.icon
          return (
            <li key={s.key} className="flex items-center gap-3 py-2.5">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {Icon && <Icon aria-hidden className="size-4 shrink-0 text-fg-subtle" />}
              <span className="min-w-0 flex-1 truncate text-sm text-fg">
                {s.label} <span className="text-xs text-fg-subtle">· {s.count} {s.count === 1 ? 'gasto' : 'gastos'}</span>
              </span>
              <span className="text-xs text-fg-muted tabular">{formatPercent(total ? (s.value / total) * 100 : 0, { digits: 0 })}</span>
              <span className="w-24 text-right text-sm font-medium text-fg tabular">{formatMoney(s.value)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ───────── Barras horizontales HTML (por vehículo, por cliente) ─────────
// Todas en gris: la lima se reserva para la acción primaria y el mes en curso del gráfico.

export function HBarList({ items, className, emptyText = 'Sin datos en este periodo.' }: { items: { key: string | number; label: ReactNode; sublabel?: ReactNode; value: number; display: string }[]; className?: string; emptyText?: string }) {
  const max = Math.max(0, ...items.map((i) => i.value))
  if (!items.length) return <p className="py-6 text-center text-sm text-fg-muted">{emptyText}</p>
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-fg">
              {item.label}
              {item.sublabel && <span className="ml-1.5 text-xs text-fg-subtle">{item.sublabel}</span>}
            </span>
            <span className="shrink-0 font-medium text-fg tabular">{item.display}</span>
          </div>
          <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-fg-subtle/70" style={{ width: `${max ? Math.max(2, (item.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

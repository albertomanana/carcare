import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatPercent } from '@/lib/format'
import { Skeleton } from './Skeleton'

export interface StatCardProps {
  label: string
  value: ReactNode
  /** Unidad o texto pequeño tras la cifra. */
  unit?: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  /** Variación porcentual frente al periodo anterior. null ⇒ no se muestra. */
  change?: number | null
  changeLabel?: string
  /** Si subir es bueno (true) o malo (false, p. ej. gasto). Por defecto neutro. */
  upIsGood?: boolean
  /** Si el dato no está disponible: motivo de la API y acción que lo resuelve. */
  unavailable?: { reason: string | null; action?: ReactNode }
  loading?: boolean
  className?: string
  emphasis?: boolean
}

/** Tarjeta KPI con cifra grande en tipografía display. */
export function StatCard({ label, value, unit, hint, icon, change, changeLabel = 'vs. periodo anterior', upIsGood, unavailable, loading, className, emphasis }: StatCardProps) {
  const changeTone =
    change === null || change === undefined || change === 0 || upIsGood === undefined
      ? 'text-fg-muted'
      : change > 0 === upIsGood
        ? 'text-ok'
        : 'text-warning'
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4 md:p-5', emphasis && 'border-accent/30 bg-gradient-to-br from-accent-soft to-surface', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.1em] text-fg-subtle">{label}</span>
        {icon && <span className="text-fg-subtle [&_svg]:size-4">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="h-9 w-32" />
      ) : unavailable ? (
        <div className="flex flex-col gap-2">
          <span className="font-display text-2xl font-semibold text-fg-subtle" aria-hidden>
            —
          </span>
          <p className="flex items-start gap-1.5 text-xs text-fg-muted">
            <Info aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>{unavailable.reason ?? 'Faltan datos para calcularlo.'}</span>
          </p>
          {unavailable.action}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1.5">
            <span className="tabular font-display text-[1.75rem] font-semibold leading-none tracking-tight text-fg-warm md:text-3xl">{value}</span>
            {unit && <span className="text-sm text-fg-muted">{unit}</span>}
          </div>
          {change !== null && change !== undefined && (
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', changeTone)}>
              {change > 0 ? <ArrowUpRight aria-hidden className="size-3.5" /> : change < 0 ? <ArrowDownRight aria-hidden className="size-3.5" /> : null}
              {formatPercent(change, { signed: true })} <span className="font-normal text-fg-subtle">{changeLabel}</span>
            </span>
          )}
          {hint && <span className="text-xs text-fg-muted">{hint}</span>}
        </div>
      )}
    </div>
  )
}

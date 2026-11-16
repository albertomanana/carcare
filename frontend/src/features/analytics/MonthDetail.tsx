/**
 * Detalle del mes elegido en la gráfica (GET /workspaces/{ws}/analytics/month, contrato §4.1): total, comparación con
 * el mes anterior, reparto por grupos y los cargos uno a uno, cada uno con su enlace. Particular: gastos, con su origen
 * (orden de taller o intervención) y su renovación si son periódicos. Taller: las órdenes entregadas ese mes.
 */
import { ArrowDownRight, ArrowUpRight, Minus, X } from 'lucide-react'
import { Link } from 'react-router'
import { useAnalyticsMonth } from '@/api/hooks/workspaces'
import type { AnalyticsMonth, Expense, YearMonth } from '@/api/types'
import { HBarList } from '@/components/charts/Charts'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { shareOf } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { EXPENSE_GROUP_LABEL, groupTotals, originBreakdown, originLabel, renewalText } from '@/lib/expenseLinks'
import { formatDate, formatMoney, formatMonth, formatPercent, formatPlate, toNumber } from '@/lib/format'
import { EXPENSE_CATEGORY_LABEL } from '@/lib/labels'
import { plural } from '@/lib/text'

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function MonthDetail({ month, onClose }: { month: YearMonth; onClose: () => void }) {
  const ctx = useWorkspace()
  const query = useAnalyticsMonth(ctx.id, month)
  const title = capital(formatMonth(month, 'long'))
  return (
    <section aria-label={`Detalle de ${formatMonth(month, 'long')}`} className="mt-4 border-t border-line pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-ink">Detalle del mes</p>
          <h3 className="font-display text-xl font-bold text-fg-warm">{title}</h3>
        </div>
        <Button variant="ghost" size="sm" icon={<X aria-hidden />} onClick={onClose}>
          Cerrar
        </Button>
      </div>
      {query.isPending ? (
        <div role="status" aria-live="polite" className="mt-3 space-y-3">
          <span className="sr-only">Cargando el detalle de {formatMonth(month, 'long')}…</span>
          <Skeleton aria-hidden className="h-9 w-40" />
          <Skeleton aria-hidden className="h-24 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} className="mt-3" />
      ) : (
        <div aria-live="polite" className={cn('transition-opacity duration-150', query.isPlaceholderData && 'opacity-60')}>
          <Body data={query.data} workshop={ctx.isWorkshop} base={ctx.base} canExpenses={ctx.canExpenses} />
        </div>
      )}
    </section>
  )
}

/** «+100 % respecto a octubre (100,00 €)»; si el mes anterior fue 0, lo dice en vez de inventar un porcentaje. */
function Comparison({ data, workshop }: { data: AnalyticsMonth; workshop: boolean }) {
  const prev = formatMonth(data.previous.month, 'long').replace(/ de \d{4}$/, '')
  const pct = data.change_pct
  if (pct === null) {
    const none = (toNumber(data.total) ?? 0) === 0
    return (
      <p className="text-sm text-fg-muted">
        {none ? `En ${prev} tampoco hubo ${workshop ? 'órdenes entregadas' : 'gastos'}.` : `En ${prev} no hubo ${workshop ? 'órdenes entregadas' : 'gastos'}: no hay con qué comparar.`}
      </p>
    )
  }
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  // En gastos, subir es peor; en el taller, subir es mejor. El color acompaña a la flecha y al texto.
  const good = workshop ? pct > 0 : pct < 0
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-fg-muted">
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', pct === 0 ? 'text-fg' : good ? 'text-ok' : 'text-danger')}>
        <Icon aria-hidden className="size-4" />
        <span className="tabular">{formatPercent(pct, { signed: true, digits: 0 })}</span>
      </span>
      respecto a los <span className="tabular text-fg">{formatMoney(data.previous.total)}</span> de {prev}
    </p>
  )
}

function Body({ data, workshop, base, canExpenses }: { data: AnalyticsMonth; workshop: boolean; base: string; canExpenses: boolean }) {
  const count = workshop ? data.orders.length : data.expenses.length
  const groups = groupTotals(data.expenses)
  return (
    <>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="tabular font-display text-3xl font-extrabold text-fg-warm">{formatMoney(data.total)}</p>
        <p className="text-sm text-fg-muted">{workshop ? plural(count, 'orden entregada', 'órdenes entregadas') : plural(count, 'gasto', 'gastos')}</p>
      </div>
      <Comparison data={data} workshop={workshop} />

      {count === 0 ? (
        <p className="mt-3 rounded-card border border-line px-4 py-3 text-sm text-fg-muted">{workshop ? 'Ninguna orden entregada este mes.' : 'Sin gastos este mes.'}</p>
      ) : workshop ? (
        <ul className="list-panel mt-4" aria-label="Órdenes entregadas este mes">
          {data.orders.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link to={`${base}/ordenes/${o.id}`} className="block truncate text-sm font-medium text-fg underline-offset-4 hover:underline">
                  <span className="tabular">{o.number}</span> · {o.title}
                </Link>
                <p className="truncate text-sm text-fg-muted">
                  {[formatDate(o.delivered_at), o.vehicle.display_name, formatPlate(o.vehicle.plate), o.customer?.name].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="tabular shrink-0 text-right font-medium text-fg">{formatMoney(o.total)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <h4 className="mt-5 text-sm font-semibold text-fg">En qué se fue</h4>
          <HBarList
            className="mt-2"
            items={groups.map((g) => ({
              key: g.group,
              label: EXPENSE_GROUP_LABEL[g.group],
              sublabel: `${plural(g.count, 'gasto', 'gastos')} · ${formatPercent(shareOf(String(g.cents / 100), data.total), { digits: 0 })}`,
              value: g.cents,
              display: formatMoney(g.cents / 100),
            }))}
          />
          <h4 className="mt-5 text-sm font-semibold text-fg">Cargos del mes</h4>
          <ul className="list-panel mt-1" aria-label="Gastos de este mes">
            {data.expenses.map((e) => (
              <ExpenseLine key={e.id} expense={e} base={base} canExpenses={canExpenses} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function ExpenseLine({ expense: e, base, canExpenses }: { expense: Expense; base: string; canExpenses: boolean }) {
  const title = e.description || EXPENSE_CATEGORY_LABEL[e.category]
  const href = `${base}/vehiculos/${e.vehicle_id}/gastos?periodo=${e.expense_date.slice(0, 4)}#gasto-${e.id}`
  const meta = [e.description ? EXPENSE_CATEGORY_LABEL[e.category] : null, formatDate(e.expense_date), e.vehicle?.display_name].filter(Boolean).join(' · ')
  const o = e.origin
  const breakdown = o ? originBreakdown(o) : null
  const renewal = renewalText(e)
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        {canExpenses ? (
          <Link to={href} className="block truncate text-sm font-medium text-fg underline-offset-4 hover:underline">
            {title}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium text-fg">{title}</p>
        )}
        <p className="truncate text-sm text-fg-muted">{meta}</p>
        {o && (
          <p className="text-sm text-fg-muted">
            {o.work_order_number && o.repair_request_id ? (
              <Link to={`${base}/solicitudes/${o.repair_request_id}`} className="font-medium text-accent-ink underline-offset-4 hover:underline">
                {originLabel(o)}
              </Link>
            ) : (
              originLabel(o)
            )}
          </p>
        )}
        {breakdown && <p className="tabular text-sm text-fg-muted">{breakdown}</p>}
        {renewal && <p className="text-sm text-fg-muted">{renewal}</p>}
      </div>
      <p className="tabular shrink-0 text-right font-medium text-fg">{formatMoney(e.amount)}</p>
    </li>
  )
}

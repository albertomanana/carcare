import { Lock, ReceiptText } from 'lucide-react'
import { useId } from 'react'
import { useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form'
import type { LineItemFormValue } from '@/components/forms/LineItemsEditor'
import { cn } from '@/lib/cn'
import { formatDecimal, formatMoney, toNumber } from '@/lib/format'
import { plural } from '@/lib/text'
import { liveTotals, type TotalsData } from './totals'

/**
 * «Resumen de la orden (no es una factura)»: subtotal, IVA y total con IVA.
 * Sin permiso para ver importes (mecánico) solo se muestra el número de líneas.
 */
export function OrderTotals({ data, showPrices, className, live }: { data: TotalsData; showPrices: boolean; className?: string; live?: boolean }) {
  const rate = toNumber(data.taxRate)
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={cn('rounded-card border border-line bg-surface', className)}>
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <ReceiptText aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-base font-semibold tracking-tight text-fg-warm">
            Resumen de la orden <span className="font-sans text-sm font-normal text-fg-muted">(no es una factura)</span>
          </h2>
          <p className="text-xs text-fg-subtle">{data.linesCount ? plural(data.linesCount, 'línea', 'líneas') : 'Sin líneas todavía'}</p>
        </div>
      </div>
      {showPrices ? (
        <div className="px-4 py-3" aria-live={live ? 'polite' : undefined}>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Subtotal</dt>
              <dd className="text-fg tabular">{formatMoney(data.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">IVA{rate !== null ? ` (${formatDecimal(rate, Number.isInteger(rate) ? 0 : 2)} %)` : ''}</dt>
              <dd className="text-fg tabular">{formatMoney(data.tax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
              <dt className="font-medium text-fg">Total con IVA</dt>
              <dd className="font-display text-xl font-semibold text-fg-warm tabular">{formatMoney(data.total)}</dd>
            </div>
          </dl>
          {data.unpricedCount > 0 && (
            <p className="mt-2 text-xs text-fg-subtle">{plural(data.unpricedCount, 'línea sin precio no suma', 'líneas sin precio no suman')}.</p>
          )}
          <p className="mt-2 text-xs text-fg-subtle">Resumen interno del trabajo: CarCare no emite facturas.</p>
        </div>
      ) : (
        <p className="flex items-start gap-2 px-4 py-3 text-xs text-fg-muted">
          <Lock aria-hidden className="mt-px size-3.5 shrink-0 text-fg-subtle" />
          Los importes solo los ven el propietario y el gerente del taller.
        </p>
      )}
    </section>
  )
}

type WithItems = { items: LineItemFormValue[] }

/** Resumen que se recalcula mientras se editan las líneas. */
export function LiveOrderTotals<T extends FieldValues & WithItems>({ form, taxRate, showPrices, className }: { form: UseFormReturn<T>; taxRate: string; showPrices: boolean; className?: string }) {
  const f = form as unknown as UseFormReturn<WithItems>
  const items = useWatch({ control: f.control, name: 'items' }) ?? []
  return <OrderTotals data={liveTotals(items, taxRate)} showPrices={showPrices} className={className} live />
}

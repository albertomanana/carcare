import { useId } from 'react'
import { useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form'
import type { LineItemFormValue } from '@/components/forms/LineItemsEditor'
import { cn } from '@/lib/cn'
import { formatDecimal, formatMoney, toNumber } from '@/lib/format'
import { plural } from '@/lib/text'
import { liveTotals, type TotalsData } from './totals'

/**
 * «Resumen de la orden (no es una factura)»: subtotal, IVA y total con IVA, sin caja (R3) y sin icono en el título (R7).
 * Sin permiso para ver importes (mecánico) solo se dice que los importes no se muestran.
 */
export function OrderTotals({ data, showPrices, className, live }: { data: TotalsData; showPrices: boolean; className?: string; live?: boolean }) {
  const rate = toNumber(data.taxRate)
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={cn('min-w-0', className)}>
      <h3 id={titleId} className="text-sm font-medium text-fg">
        Resumen <span className="font-normal text-fg-muted">(no es una factura)</span>
        <span className="font-normal text-fg-subtle"> · {data.linesCount ? plural(data.linesCount, 'línea', 'líneas') : 'sin líneas todavía'}</span>
      </h3>
      {showPrices ? (
        <div aria-live={live ? 'polite' : undefined}>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Subtotal</dt>
              <dd className="text-fg tabular">{formatMoney(data.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">IVA{rate !== null ? ` (${formatDecimal(rate, Number.isInteger(rate) ? 0 : 2)} %)` : ''}</dt>
              <dd className="text-fg tabular">{formatMoney(data.tax)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
              <dt className="font-medium text-fg">Total con IVA</dt>
              <dd className="text-base font-semibold text-fg tabular">{formatMoney(data.total)}</dd>
            </div>
          </dl>
          {data.unpricedCount > 0 && (
            <p className="mt-1.5 text-xs text-fg-subtle">{plural(data.unpricedCount, 'línea sin precio no suma', 'líneas sin precio no suman')}.</p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-fg-muted">Los importes solo los ven el propietario y el gerente del taller.</p>
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

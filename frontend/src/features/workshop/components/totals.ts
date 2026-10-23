/** Totales de una orden para el «Resumen de la orden (no es una factura)». */
import type { Money, WorkOrder } from '@/api/types'
import type { LineItemFormValue } from '@/components/forms/LineItemsEditor'
import { centsToMoney, orderTotals, sumLines } from '@/lib/lineItems'

export interface TotalsData {
  subtotal: Money
  taxRate: string
  tax: Money
  total: Money
  linesCount: number
  unpricedCount: number
}

/** Totales calculados en vivo a partir de las líneas del formulario (mismas reglas que el servidor). */
export function liveTotals(items: LineItemFormValue[], taxRate: string): TotalsData {
  const t = orderTotals(items, taxRate)
  return {
    subtotal: centsToMoney(t.subtotalCents),
    taxRate,
    tax: centsToMoney(t.taxCents),
    total: centsToMoney(t.totalCents),
    linesCount: items.length,
    unpricedCount: t.unpricedCount,
  }
}

/** Totales guardados en el servidor (orden de solo lectura). */
export function serverTotals(order: Pick<WorkOrder, 'subtotal' | 'tax_rate' | 'tax_amount' | 'total' | 'items'>): TotalsData {
  return {
    subtotal: order.subtotal,
    taxRate: order.tax_rate,
    tax: order.tax_amount,
    total: order.total,
    linesCount: order.items.length,
    unpricedCount: sumLines(order.items).unpricedCount,
  }
}

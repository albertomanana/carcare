import type { LineItem } from '@/api/types'
import { formatDecimal, formatMoney, toNumber } from '@/lib/format'
import { ITEM_KIND_LABEL } from '@/lib/labels'

function qty(value: string): string {
  const n = toNumber(value)
  if (n === null) return value
  return formatDecimal(n, Number.isInteger(n) ? 0 : 2)
}

/** Líneas de una orden en solo lectura (entregada o cancelada). Tabla en escritorio, lista en móvil. */
export function OrderLinesTable({ items, showPrices }: { items: LineItem[]; showPrices: boolean }) {
  if (!items.length) return <p className="text-sm text-fg-muted">Esta orden no tiene líneas.</p>
  return (
    <>
      <ul className="divide-y divide-line rounded-card border border-line md:hidden">
        {items.map((it, i) => (
          <li key={it.id ?? i} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-fg">{it.name}</p>
              <p className="text-xs text-fg-muted">
                {ITEM_KIND_LABEL[it.kind]}
                {it.part_number ? ` · Ref. ${it.part_number}` : ''} · <span className="tabular">{qty(it.quantity)} ud.</span>
              </p>
            </div>
            {showPrices && <span className="shrink-0 font-medium text-fg tabular">{it.total ? formatMoney(it.total) : 'Sin precio'}</span>}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-card border border-line md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Líneas de la orden</caption>
          <thead className="border-b border-line bg-surface-2/60 text-left text-xs text-fg-subtle">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Tipo
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Concepto
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Referencia
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Cant.
              </th>
              {showPrices && (
                <>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Precio/u
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Total
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((it, i) => (
              <tr key={it.id ?? i}>
                <td className="px-3 py-2 text-fg-muted">{ITEM_KIND_LABEL[it.kind]}</td>
                <td className="px-3 py-2 text-fg">{it.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-fg-muted">{it.part_number ?? '—'}</td>
                <td className="px-3 py-2 text-right text-fg tabular">{qty(it.quantity)}</td>
                {showPrices && (
                  <>
                    <td className="px-3 py-2 text-right text-fg-muted tabular">{it.unit_price ? formatMoney(it.unit_price) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-fg tabular">{it.total ? formatMoney(it.total) : 'Sin precio'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

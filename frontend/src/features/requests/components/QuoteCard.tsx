import { useId, type ReactNode } from 'react'
import type { RepairQuote } from '@/api/types'
import { cn } from '@/lib/cn'
import { formatDate, formatDecimal, formatMoney, toNumber } from '@/lib/format'
import { ITEM_KIND_LABEL } from '@/lib/labels'
import { TONE_CLASSES } from '@/lib/status'
import { quoteStatus, type RequestPerspective } from '../requestStatus'

function qty(value: string): string {
  const n = toNumber(value)
  if (n === null) return value
  return formatDecimal(n, Number.isInteger(n) ? 0 : 2)
}

function rate(value: string): string {
  const n = toNumber(value)
  return n === null ? value : formatDecimal(n, Number.isInteger(n) ? 0 : 2)
}

export interface QuoteCardProps {
  quote: RepairQuote
  /** Quién lo mira: cambia el rótulo del motivo del rechazo ("Tu motivo" / "Motivo del cliente"). */
  perspective?: RequestPerspective
  /** Botones bajo el presupuesto (solo para la versión vigente). */
  actions?: ReactNode
  /** Nivel del título según dónde se pinte. */
  as?: 'h2' | 'h3'
  className?: string
}

/**
 * Una versión de presupuesto en solo lectura (contrato §3.13.5). Rótulo obligatorio "Presupuesto (no es una factura)"
 * (D12 = A). Sin caja (R3): título, líneas con separador fino y totales. Los importes vienen de la API como string
 * y se formatean con Intl (es‑ES). La reutiliza el taller (tarea 35).
 */
export function QuoteCard({ quote, perspective = 'requester', actions, as: Heading = 'h2', className }: QuoteCardProps) {
  const titleId = useId()
  const status = quoteStatus(quote)
  const StatusIcon = status.icon
  const vigente = quote.status === 'sent'

  return (
    <section aria-labelledby={titleId} className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Heading id={titleId} className="font-display text-lg font-semibold text-fg-warm">
          Presupuesto <span className="font-normal text-fg-muted">(no es una factura)</span>
        </Heading>
        <p className="flex items-center gap-1.5 text-sm">
          <span className="text-fg-muted tabular">v{quote.version}</span>
          <span aria-hidden className="text-fg-subtle">
            ·
          </span>
          <span className={cn('inline-flex items-center gap-1', TONE_CLASSES[status.tone].text)}>
            <StatusIcon aria-hidden className="size-4" />
            {status.label}
          </span>
        </p>
      </div>

      <p className="mt-1 text-sm text-fg-muted">
        Enviado el <span className="tabular">{formatDate(quote.sent_at)}</span>
        {vigente && (
          <>
            {' · '}
            {quote.is_expired ? 'Caducó el' : 'Válido hasta el'} <span className="tabular">{formatDate(quote.valid_until, 'numeric')}</span>
          </>
        )}
        {quote.answered_at && !vigente && (
          <>
            {' · '}Respondido el <span className="tabular">{formatDate(quote.answered_at)}</span>
          </>
        )}
      </p>

      {/* Líneas: lista en móvil, tabla en escritorio */}
      <ul className="mt-4 divide-y divide-line border-y border-line md:hidden" aria-label={`Líneas del presupuesto v${quote.version}`}>
        {quote.items.map((it, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-1 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-fg">{it.name}</p>
              <p className="text-xs text-fg-muted">
                {ITEM_KIND_LABEL[it.kind]}
                {it.part_number ? ` · Ref. ${it.part_number}` : ''} ·{' '}
                <span className="tabular">
                  {qty(it.quantity)} × {it.unit_price ? formatMoney(it.unit_price) : '—'}
                </span>
              </p>
            </div>
            <span className="shrink-0 font-medium text-fg tabular">{it.total ? formatMoney(it.total) : '—'}</span>
          </li>
        ))}
      </ul>
      <table className="mt-4 hidden w-full border-y border-line text-sm md:table">
        <caption className="sr-only">Líneas del presupuesto v{quote.version}</caption>
        <thead className="border-b border-line text-left text-xs text-fg-muted">
          <tr>
            <th scope="col" className="px-2 py-2 font-medium">
              Tipo
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Concepto
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Referencia
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Cant.
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Precio/u
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {quote.items.map((it, i) => (
            <tr key={i}>
              <td className="px-2 py-2 text-fg-muted">{ITEM_KIND_LABEL[it.kind]}</td>
              <td className="px-2 py-2 text-fg">{it.name}</td>
              <td className="px-2 py-2 text-xs text-fg-muted">{it.part_number ?? '—'}</td>
              <td className="px-2 py-2 text-right text-fg tabular">{qty(it.quantity)}</td>
              <td className="px-2 py-2 text-right text-fg-muted tabular">{it.unit_price ? formatMoney(it.unit_price) : '—'}</td>
              <td className="px-2 py-2 text-right font-medium text-fg tabular">{it.total ? formatMoney(it.total) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Subtotal</dt>
          <dd className="text-fg tabular">{formatMoney(quote.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">IVA ({rate(quote.tax_rate)} %)</dt>
          <dd className="text-fg tabular">{formatMoney(quote.tax_amount)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
          <dt className="font-medium text-fg">Total con IVA</dt>
          <dd className="text-base font-semibold text-fg tabular">{formatMoney(quote.total)}</dd>
        </div>
      </dl>

      {quote.note && (
        <div className="mt-4 text-sm">
          <p className="text-fg-muted">Nota del taller</p>
          <p className="mt-0.5 whitespace-pre-line text-fg">{quote.note}</p>
        </div>
      )}
      {quote.client_reason && (
        <div className="mt-4 text-sm">
          <p className="text-fg-muted">{perspective === 'requester' ? 'Tu motivo al rechazarlo' : 'Motivo del cliente al rechazarlo'}</p>
          <p className="mt-0.5 whitespace-pre-line text-fg">{quote.client_reason}</p>
        </div>
      )}

      {actions && <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>}
    </section>
  )
}

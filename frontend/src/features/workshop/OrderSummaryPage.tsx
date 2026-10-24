import { ArrowLeft, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '@/api/client'
import { useWorkOrder } from '@/api/hooks/workshop'
import type { LineItem, WorkOrder } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatDateTime, formatDecimal, formatKm, formatMoney, formatPlate, todayISO, toNumber } from '@/lib/format'
import { ITEM_KIND_LABEL, WORK_ORDER_STATUS_LABEL } from '@/lib/labels'
import { ORDER_SUMMARY_LABEL, orderSummaryTitle } from './components/orderUtils'

/**
 * Resumen imprimible de una orden (E12‑9, D12 = A). Sale de GET /work-orders/{id}, sin endpoints nuevos.
 * Hoja A4 siempre clara; al imprimir no salen ni la barra ni el menú. El mecánico la imprime sin importes.
 */
export default function OrderSummaryPage() {
  const ctx = useWorkspace()
  const { orderId } = useParams()
  const id = Number(orderId)
  const valid = Number.isInteger(id) && id > 0
  const query = useWorkOrder(valid ? id : undefined)
  const order = query.data && query.data.workspace_id === ctx.id ? query.data : undefined
  useDocumentTitle(order ? orderSummaryTitle(order.number, order.vehicle.plate, todayISO()) : 'Resumen de la orden')
  const back = valid ? `${ctx.base}/ordenes/${id}` : `${ctx.base}/ordenes`

  const notFound = !valid || (query.isError && isApiError(query.error) && query.error.status === 404) || (query.data && !order)

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-[900px] items-center gap-3 px-4 sm:px-6">
          <Link to={back} className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm text-fg-muted hover:text-fg">
            <ArrowLeft aria-hidden className="size-4" />
            {valid ? 'Volver a la orden' : 'Órdenes'}
          </Link>
          <div className="flex-1" />
          <Button variant="primary" icon={<Printer aria-hidden />} onClick={() => window.print()} disabled={!order}>
            Imprimir / Guardar PDF
          </Button>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-[900px] sm:px-6 sm:py-8 print:max-w-none print:p-0">
        {notFound ? (
          <div className="px-4 py-8 sm:px-0">
            <ErrorState title="No encontramos esta orden" />
          </div>
        ) : query.isPending ? (
          <SheetSkeleton />
        ) : query.isError ? (
          <div className="px-4 py-8 sm:px-0">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : order ? (
          <SummarySheet order={order} workshopName={ctx.workspace.name} showPrices={ctx.can('manage')} />
        ) : null}
      </main>
    </div>
  )
}

function SummarySheet({ order, workshopName, showPrices }: { order: WorkOrder; workshopName: string; showPrices: boolean }) {
  const v = order.vehicle
  const c = order.customer
  const rate = toNumber(order.tax_rate)
  const unpriced = order.items.filter((it) => it.total === null).length

  const orderRows: { label: string; value: ReactNode }[] = [
    { label: 'Número', value: <span className="tabular">{order.number}</span> },
    { label: 'Estado', value: WORK_ORDER_STATUS_LABEL[order.status] },
    { label: 'Recibida', value: formatDateTime(order.received_at) },
    ...(order.promised_at && order.status !== 'delivered' && order.status !== 'cancelled' ? [{ label: 'Prometida', value: formatDateTime(order.promised_at) }] : []),
    ...(order.delivered_at ? [{ label: 'Entregada', value: formatDateTime(order.delivered_at) }] : []),
    ...(order.assigned_to ? [{ label: 'Mecánico', value: order.assigned_to.name }] : []),
  ]
  const vehicleRows: { label: string; value: ReactNode }[] = [
    { label: 'Vehículo', value: v.display_name === `${v.make} ${v.model}` ? v.display_name : `${v.display_name} (${v.make} ${v.model})` },
    { label: 'Matrícula', value: v.plate ? formatPlate(v.plate) : 'Sin matrícula' },
    { label: 'Km de entrada', value: <span className="tabular">{formatKm(order.mileage_in, { empty: 'Sin anotar' })}</span> },
    { label: 'Cliente', value: c ? c.name : 'Sin cliente' },
    ...(c?.phone ? [{ label: 'Teléfono', value: <span className="tabular">{c.phone}</span> }] : []),
  ]

  return (
    <article
      aria-labelledby="resumen-titulo"
      className="paper mx-auto px-5 py-8 sm:rounded-card sm:border sm:border-line sm:px-10 sm:py-10 print:border-0 print:p-0"
    >
      <header className="border-b-2 border-fg pb-5">
        <p className="text-sm font-semibold text-fg">{workshopName}</p>
        <h1 id="resumen-titulo" className="mt-3 text-2xl font-semibold text-fg-warm text-balance">
          {ORDER_SUMMARY_LABEL}
        </h1>
        <p className="mt-1 text-base text-fg">{order.title}</p>
      </header>

      <div className="grid gap-x-10 gap-y-6 border-b border-line py-6 sm:grid-cols-2 print:grid-cols-2">
        <Facts title="Orden" rows={orderRows} />
        <Facts title="Vehículo y cliente" rows={vehicleRows} />
      </div>

      {(order.complaint || order.diagnosis) && (
        <section className="print-break-avoid space-y-4 border-b border-line py-6" aria-label="Trabajo">
          {order.complaint && <TextBlock title="Lo que pidió el cliente" text={order.complaint} />}
          {order.diagnosis && <TextBlock title="Diagnóstico y trabajo realizado" text={order.diagnosis} />}
        </section>
      )}

      <section className="py-6" aria-labelledby="lineas-titulo">
        <h2 id="lineas-titulo" className="mb-3 text-base font-semibold text-fg-warm">
          Piezas y mano de obra
        </h2>
        {order.items.length === 0 ? <p className="text-sm text-fg-muted">Esta orden no tiene líneas.</p> : <LinesTable items={order.items} showPrices={showPrices} />}

        {showPrices ? (
          <dl className="print-break-avoid mt-4 ml-auto w-full max-w-72 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Subtotal</dt>
              <dd className="text-fg tabular">{formatMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">IVA{rate !== null ? ` (${formatDecimal(rate, Number.isInteger(rate) ? 0 : 2)} %)` : ''}</dt>
              <dd className="text-fg tabular">{formatMoney(order.tax_amount)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-fg pt-2">
              <dt className="font-semibold text-fg">Total con IVA</dt>
              <dd className="text-lg font-semibold text-fg-warm tabular">{formatMoney(order.total)}</dd>
            </div>
            {unpriced > 0 && (
              <p className="pt-1 text-xs text-fg-subtle">
                {unpriced === 1 ? '1 línea sin precio no suma.' : `${unpriced} líneas sin precio no suman.`}
              </p>
            )}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-fg-muted">Esta copia no incluye importes.</p>
        )}
      </section>

      <footer className="border-t border-line pt-4 text-xs text-fg-subtle">
        <p>
          Documento informativo del trabajo, preparado por {workshopName} con CarCare el {formatDate(todayISO(), 'long')}. No es una factura ni tiene
          validez fiscal.
        </p>
      </footer>
    </article>
  )
}

function Facts({ title, rows }: { title: string; rows: { label: string; value: ReactNode }[] }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold text-fg-warm">{title}</h2>
      <dl className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-fg-muted">{r.label}</dt>
            <dd className="text-fg">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-fg-warm">{title}</h2>
      <p className="mt-1 whitespace-pre-line text-sm text-fg">{text}</p>
    </div>
  )
}

function qty(value: string): string {
  const n = toNumber(value)
  return n === null ? value : formatDecimal(n, Number.isInteger(n) ? 0 : 2)
}

/** Una sola tabla para pantalla e impresión: en el móvil se desplaza en horizontal antes que partir columnas. */
function LinesTable({ items, showPrices }: { items: LineItem[]; showPrices: boolean }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[30rem] text-sm print:min-w-0">
        <caption className="sr-only">Líneas de la orden</caption>
        <thead className="border-b border-fg text-left text-xs text-fg-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">
              Concepto
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Tipo
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Cant.
            </th>
            {showPrices && (
              <>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Precio/u
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Total
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((it, i) => (
            <tr key={it.id ?? i} className="print-break-avoid align-top">
              <td className="py-2 pr-3 text-fg">
                {it.name}
                {it.part_number && <span className="block text-xs text-fg-muted">Ref. {it.part_number}</span>}
              </td>
              <td className="py-2 pr-3 text-fg-muted">{ITEM_KIND_LABEL[it.kind]}</td>
              <td className="py-2 pr-3 text-right text-fg tabular">{qty(it.quantity)}</td>
              {showPrices && (
                <>
                  <td className="py-2 pr-3 text-right text-fg-muted tabular">{it.unit_price ? formatMoney(it.unit_price) : '—'}</td>
                  <td className="py-2 text-right text-fg tabular">{it.total ? formatMoney(it.total) : 'Sin precio'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SheetSkeleton() {
  return (
    <div role="status" aria-live="polite" className="paper mx-auto px-5 py-8 sm:rounded-card sm:border sm:border-line sm:px-10 sm:py-10">
      <span className="sr-only">Cargando el resumen…</span>
      <div aria-hidden className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-3/4" />
        <div className="grid gap-6 sm:grid-cols-2">
          <SkeletonText lines={4} />
          <SkeletonText lines={4} />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

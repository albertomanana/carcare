import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, CircleAlert, ClipboardList, ExternalLink, Plus, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Bay, WorkOrder } from '@/api/types'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { formatKm, formatMoney, formatPlate } from '@/lib/format'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { type FloorSelection, resolveSelection, telHref } from './floor'
import { MoveToMenu } from './MoveToMenu'
import { LateBadge, PriorityBadge, PromisedAt } from './OrderBadges'
import { baysSummary, formatWhen, nextStep, shortOrderNumber, waitingOrders } from './orderUtils'
import type { OrderActions } from './useOrderActions'

/**
 * Panel lateral del Taller 3D (plan UX 5.5): lista sin cajas, sincronizada con la escena. Es también la alternativa
 * HTML accesible de la escena: sin elegir nada lista los elevadores y la zona de espera; al elegir, la ficha rápida
 * con cambio de estado y de elevador. Píldora solo para "Tarde" y "Urgente" (R5); el resto, en texto.
 */

export interface FloorPanelProps {
  bays: Bay[]
  /** Órdenes abiertas (zona de espera y búsqueda de la orden elegida). */
  orders: WorkOrder[]
  ordersLoading?: boolean
  selection: FloorSelection
  actions: OrderActions
  className?: string
}

const TITLE_ID = 'floor-panel-title'

export function FloorPanel({ bays, orders, ordersLoading, selection, actions, className }: FloorPanelProps) {
  const resolved = resolveSelection(selection, bays, orders)
  const ref = useRef<HTMLElement>(null)
  const key = `${selection.bay ?? ''}-${selection.orderId ?? ''}`
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const visibleError = error?.key === key ? error.message : null

  // Al cambiar lo elegido: si el foco se ha quedado sin elemento (el botón pulsado ya no existe), pasa al título
  // de la ficha; en móvil y tableta, además, el panel (que va bajo la escena) se acerca a la vista.
  const lastKey = useRef(key)
  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    const panel = ref.current
    if (!panel) return
    if (document.activeElement === document.body) document.getElementById(TITLE_ID)?.focus({ preventScroll: true })
    if (key === '-' || !window.matchMedia('(max-width: 1279px)').matches) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [key])

  const announce = resolved.order
    ? `Seleccionada ${resolved.order.number}, ${resolved.order.vehicle.display_name}${resolved.order.bay ? `, elevador ${resolved.order.bay}` : ', en espera'}.`
    : resolved.freeBay
      ? `Elevador ${resolved.bay} libre.`
      : ''

  const onError = (message: string) => setError({ key, message })

  return (
    <aside ref={ref} aria-labelledby={TITLE_ID} className={cn('flex min-w-0 scroll-mt-20 flex-col', className)}>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {resolved.order ? (
        <OrderSheet order={resolved.order} bays={bays} selection={selection} actions={actions} error={visibleError} onError={onError} />
      ) : resolved.freeBay && resolved.bay ? (
        <FreeBaySheet bay={resolved.bay} orders={orders} loading={ordersLoading} selection={selection} actions={actions} error={visibleError} onError={onError} />
      ) : (
        <Overview bays={bays} orders={orders} loading={ordersLoading} selection={selection} />
      )}
    </aside>
  )
}

export function FloorPanelSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Cargando elevadores…</span>
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-control" />
        ))}
      </div>
    </div>
  )
}

function PanelHeader({ title, description, onClose }: { title: ReactNode; description?: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 pb-3">
      <div className="min-w-0">
        <h2 id={TITLE_ID} tabIndex={-1} className="font-display text-lg font-semibold tracking-tight text-fg-warm outline-none">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {onClose && (
        <IconButton label="Cerrar ficha y ver todos los elevadores" size="sm" onClick={onClose} className="-mr-2">
          <X aria-hidden />
        </IconButton>
      )}
    </div>
  )
}

function InlineError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

/** Color del coche (el mismo que en la escena) para reconocerlo de un vistazo. Decorativo. */
function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className={cn('size-2.5 shrink-0 rounded-full border border-line-strong', !color && 'bg-surface-3')}
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

function vehicleText(o: WorkOrder): string {
  return [o.vehicle.display_name, o.vehicle.plate ? formatPlate(o.vehicle.plate) : null].filter(Boolean).join(' · ')
}

const rowButton = 'flex w-full min-w-0 items-center gap-3 px-1 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2/60'

function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 text-sm font-medium text-fg">{children}</h3>
}

/** Una orden en la zona de espera: vehículo, número y estado; "Tarde"/"Urgente" solo si aplica. */
function WaitingLine({ order }: { order: WorkOrder }) {
  return (
    <>
      <ColorDot color={order.vehicle.color_hex} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fg">{vehicleText(order)}</span>
        <span className="block truncate text-xs text-fg-muted">
          <span className="tabular">{shortOrderNumber(order.number)}</span> · {WORK_ORDER_STATUS[order.status].label}
        </span>
      </span>
      {(order.is_late || order.priority === 'urgent') && (
        <span className="flex shrink-0 flex-col items-end gap-1">
          {order.is_late && <LateBadge />}
          {order.priority === 'urgent' && <PriorityBadge priority="urgent" />}
        </span>
      )}
    </>
  )
}

function Overview({ bays, orders, loading, selection }: { bays: Bay[]; orders: WorkOrder[]; loading?: boolean; selection: FloorSelection }) {
  const ctx = useWorkspace()
  const { total, busy } = baysSummary(bays)
  const waiting = waitingOrders(orders)
  return (
    <>
      <PanelHeader title="Elevadores y espera" description={`Elige uno, aquí o en la escena, para ver su ficha y moverlo. ${busy} de ${total} ocupados.`} />
      <div className="space-y-6">
        <section aria-label="Elevadores">
          <SubTitle>Elevadores</SubTitle>
          {bays.length === 0 ? (
            <p className="text-sm text-fg-muted">Este taller no tiene elevadores. Se configuran en los ajustes del taller.</p>
          ) : (
            <ul className="border-t border-line">
              {bays.map((b) => {
                const o = b.work_order
                return (
                  <li key={b.number} className="border-b border-line">
                    <button type="button" onClick={() => selection.select({ bay: b.number })} className={rowButton}>
                      <span className="w-20 shrink-0 text-sm font-medium text-fg">Elevador {b.number}</span>
                      {o ? (
                        <WaitingLine order={o} />
                      ) : (
                        <span className="flex-1 text-sm text-fg-muted">Libre</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <section aria-label="En espera">
          <SubTitle>
            En espera <span className="font-normal text-fg-muted tabular">({loading ? '…' : waiting.length})</span>
          </SubTitle>
          {loading ? (
            <div aria-hidden className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-10 rounded-control" />
              ))}
            </div>
          ) : waiting.length === 0 ? (
            <p className="border-t border-line py-3 text-sm text-fg-muted">No hay coches esperando elevador.</p>
          ) : (
            <ul className="border-t border-line">
              {waiting.slice(0, 8).map((o) => (
                <li key={o.id} className="border-b border-line">
                  <button type="button" onClick={() => selection.select({ orderId: o.id })} className={rowButton}>
                    <WaitingLine order={o} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {waiting.length > 8 && (
            <Link to={`${ctx.base}/ordenes`} className="mt-2 inline-block text-sm font-medium text-accent-ink hover:underline">
              Ver las {waiting.length} en el tablero
            </Link>
          )}
        </section>
      </div>
    </>
  )
}

function FreeBaySheet({
  bay,
  orders,
  loading,
  selection,
  actions,
  error,
  onError,
}: {
  bay: number
  orders: WorkOrder[]
  loading?: boolean
  selection: FloorSelection
  actions: OrderActions
  error: string | null
  onError: (m: string) => void
}) {
  const ctx = useWorkspace()
  const waiting = waitingOrders(orders)
  const canOperate = ctx.can('operate')
  return (
    <>
      <PanelHeader title={`Elevador ${bay}`} description="Libre." onClose={() => selection.select(null)} />
      <div className="space-y-3">
        <InlineError message={error} />
        {loading ? (
          <Skeleton className="h-32 rounded-control" />
        ) : waiting.length === 0 ? (
          <div className="space-y-3 border-t border-line pt-3 text-sm text-fg-muted">
            <p>No hay órdenes esperando elevador.</p>
            {canOperate && (
              <ButtonLink to={`${ctx.base}/ordenes/nueva?elevador=${bay}`} size="sm" icon={<Plus aria-hidden />}>
                Abrir orden en este elevador
              </ButtonLink>
            )}
          </div>
        ) : (
          <>
            <SubTitle>{canOperate ? 'Sube un coche de la zona de espera' : 'Coches en espera'}</SubTitle>
            <ul className="border-t border-line">
              {waiting.slice(0, 8).map((o) => (
                <li key={o.id} className="flex items-center gap-2 border-b border-line">
                  <button type="button" onClick={() => selection.select({ orderId: o.id })} className={cn(rowButton, 'flex-1')}>
                    <WaitingLine order={o} />
                  </button>
                  {canOperate && (
                    <Button
                      size="sm"
                      icon={<ArrowUpFromLine aria-hidden />}
                      loading={actions.busyId === o.id}
                      aria-label={`Subir ${o.number} al elevador ${bay}`}
                      onClick={() =>
                        void actions.move(o, o.status, bay, {
                          onError,
                          onSuccess: (u) => selection.select({ orderId: u.id }),
                        })
                      }
                    >
                      Subir
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}

function OrderSheet({
  order,
  bays,
  selection,
  actions,
  error,
  onError,
}: {
  order: WorkOrder
  bays: Bay[]
  selection: FloorSelection
  actions: OrderActions
  error: string | null
  onError: (m: string) => void
}) {
  const ctx = useWorkspace()
  const canOperate = ctx.can('operate')
  const canManage = ctx.can('manage')
  const v = order.vehicle
  const next = nextStep(order.status)
  const busy = actions.busyId === order.id
  const freeBays = bays.filter((b) => !b.work_order)
  const orderHref = `${ctx.base}/ordenes/${order.id}`

  const details: { label: string; value: ReactNode }[] = [
    {
      label: 'Cliente',
      value: order.customer ? (
        <>
          <Link to={`${ctx.base}/clientes/${order.customer.id}`} className="hover:underline">
            {order.customer.name}
          </Link>
          {order.customer.phone && (
            <a href={telHref(order.customer.phone)} className="ml-2 text-fg-muted tabular hover:text-fg hover:underline">
              <span className="sr-only">Llamar al </span>
              {order.customer.phone}
            </a>
          )}
        </>
      ) : (
        <span className="text-fg-subtle">Sin cliente</span>
      ),
    },
    { label: 'Mecánico', value: order.assigned_to?.name ?? <span className="text-fg-subtle">Sin asignar</span> },
    { label: 'Prometida', value: order.promised_at ? <PromisedAt order={order} /> : <span className="text-fg-subtle">Sin fecha</span> },
    { label: 'Recibida', value: <span className="tabular">{formatWhen(order.received_at)}</span> },
    { label: 'Km de entrada', value: <span className="tabular">{formatKm(order.mileage_in, { empty: 'Sin anotar' })}</span> },
    ...(canManage ? [{ label: 'Total (con IVA)', value: <span className="font-medium tabular">{formatMoney(order.total)}</span> }] : []),
  ]

  return (
    <>
      <PanelHeader
        title={
          <Link to={orderHref} className="hover:underline">
            {order.title}
          </Link>
        }
        description={
          <>
            <span className="tabular">{order.number}</span> · {WORK_ORDER_STATUS[order.status].label} · {order.bay ? `Elevador ${order.bay}` : 'En espera'}
          </>
        }
        onClose={() => selection.select(null)}
      />
      <div className="space-y-4">
        {(order.is_late || order.priority === 'urgent') && (
          <p className="flex flex-wrap gap-1.5">
            {order.is_late && <LateBadge size="md" />}
            {order.priority === 'urgent' && <PriorityBadge priority="urgent" size="md" />}
          </p>
        )}

        <p className="flex min-w-0 items-center gap-2 text-sm">
          <ColorDot color={v.color_hex} />
          <Link to={`${ctx.base}/vehiculos/${v.id}`} className="min-w-0 truncate font-medium text-fg hover:underline">
            {vehicleText(order)}
          </Link>
        </p>

        <dl className="divide-y divide-line border-y border-line text-sm">
          {details.map((d) => (
            <div key={d.label} className="flex items-baseline justify-between gap-3 px-1 py-2">
              <dt className="shrink-0 text-fg-muted">{d.label}</dt>
              <dd className="min-w-0 truncate text-right text-fg">{d.value}</dd>
            </div>
          ))}
        </dl>

        <InlineError message={error} />

        {canOperate && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {next && (
                <Button
                  size="sm"
                  icon={<ArrowRight aria-hidden />}
                  loading={busy}
                  onClick={() => (next.status === 'delivered' ? actions.request(order, 'delivered') : void actions.move(order, next.status, undefined, { onError }))}
                >
                  {next.label}
                </Button>
              )}
              <MoveToMenu order={order} onRequest={(o, s) => (s === 'delivered' || s === 'cancelled' ? actions.request(o, s) : void actions.move(o, s, undefined, { onError }))} variant="button" disabled={busy} />
            </div>

            <div>
              <SubTitle>Elevador</SubTitle>
              {order.bay ? (
                <Button size="sm" icon={<ArrowDownToLine aria-hidden />} disabled={busy} onClick={() => void actions.move(order, order.status, null, { onError })}>
                  Bajar del elevador {order.bay}
                </Button>
              ) : freeBays.length === 0 ? (
                <p className="text-sm text-fg-muted">Todos los elevadores están ocupados.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {freeBays.map((b) => (
                    <Button key={b.number} size="sm" icon={<ArrowUpFromLine aria-hidden />} disabled={busy} onClick={() => void actions.move(order, order.status, b.number, { onError })}>
                      Subir al {b.number}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <ButtonLink to={orderHref} size="sm" variant="ghost" icon={<ClipboardList aria-hidden />}>
            Abrir la orden
          </ButtonLink>
          <ButtonLink to={`${ctx.base}/vehiculos/${v.id}/historial`} size="sm" variant="ghost" icon={<ExternalLink aria-hidden />}>
            Historial del vehículo
          </ButtonLink>
        </div>
      </div>
    </>
  )
}

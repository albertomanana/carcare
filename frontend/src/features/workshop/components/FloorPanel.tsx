import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, CircleAlert, ClipboardList, ExternalLink, Plus, TriangleAlert, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Bay, WorkOrder } from '@/api/types'
import { Plate, StatusPill } from '@/components/ui/Badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { VehicleSwatch } from '@/components/vehicles/VehicleVisuals'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { formatKm, formatMoney } from '@/lib/format'
import { PRIORITY, WORK_ORDER_STATUS } from '@/lib/status'
import { FLOOR_DETAIL_TITLE_ID, type FloorSelection, type ResolvedSelection, telHref } from './floor'
import { MoveToMenu } from './MoveToMenu'
import { LateBadge, PriorityBadge, PromisedAt } from './OrderBadges'
import { formatWhen, nextStep, shortOrderNumber, waitingOrders } from './orderUtils'
import type { OrderActions } from './useOrderActions'

/**
 * Ficha del Taller 3D: lo elegido en la maqueta o en la lista de la flota. Para una orden, sus datos reales (vehículo,
 * cliente, estado, elevador, mecánico, km, fechas e importe si el rol lo permite) y las acciones de `useOrderActions`;
 * para un elevador libre, los coches que esperan para subir. Píldora solo para «Tarde» y «Urgente» además del estado.
 * La vista general sin nada elegido (antes aquí) es ahora la tabla de la flota bajo la maqueta.
 */

export interface FloorDetailProps {
  bays: Bay[]
  /** Órdenes abiertas (zona de espera y búsqueda de la orden elegida). */
  orders: WorkOrder[]
  ordersLoading?: boolean
  resolved: ResolvedSelection
  selection: FloorSelection
  actions: OrderActions
  /** Cerrar la ficha (botón y Escape): la página quita la selección y devuelve el foco. */
  onClose: () => void
}

export function FloorDetail({ bays, orders, ordersLoading, resolved, selection, actions, onClose }: FloorDetailProps) {
  const key = `${selection.bay ?? ''}-${selection.orderId ?? ''}`
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const visibleError = error?.key === key ? error.message : null

  // Si el foco se ha quedado sin elemento (el botón pulsado ya no existe tras mover la orden), pasa al título de la ficha.
  const lastKey = useRef<string | null>(null)
  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    if (document.activeElement === document.body) document.getElementById(FLOOR_DETAIL_TITLE_ID)?.focus({ preventScroll: true })
  }, [key])

  const onError = (message: string) => setError({ key, message })

  if (resolved.order)
    return <OrderSheet order={resolved.order} bays={bays} selection={selection} actions={actions} error={visibleError} onError={onError} onClose={onClose} />
  if (resolved.freeBay && resolved.bay)
    return (
      <FreeBaySheet
        bay={resolved.bay}
        orders={orders}
        loading={ordersLoading}
        selection={selection}
        actions={actions}
        error={visibleError}
        onError={onError}
        onClose={onClose}
      />
    )
  return null
}

export function FloorDetailSkeleton() {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Cargando la ficha…</span>
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  )
}

function PanelHeader({ eyebrow, title, onClose }: { eyebrow?: ReactNode; title: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 pb-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm text-fg-muted">{eyebrow}</p>}
        <h2 id={FLOOR_DETAIL_TITLE_ID} tabIndex={-1} className="font-display text-lg font-semibold leading-snug text-fg-warm outline-none">
          {title}
        </h2>
      </div>
      <IconButton label="Cerrar la ficha (Escape)" size="sm" onClick={onClose} className="-mr-2 -mt-1">
        <X aria-hidden />
      </IconButton>
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

const rowButton = 'flex w-full min-w-0 items-center gap-3 rounded-control px-1 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2'

function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 text-sm font-medium text-fg">{children}</h3>
}

/** Una orden en la zona de espera: vehículo, número y estado; «Tarde»/«Urgente» solo si aplica. */
function WaitingLine({ order }: { order: WorkOrder }) {
  return (
    <>
      <VehicleSwatch vehicle={order.vehicle} size="sm" className="size-6 rounded" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fg">{order.vehicle.display_name}</span>
        <span className="block truncate text-xs text-fg-muted">
          {order.vehicle.plate && (
            <>
              <Plate value={order.vehicle.plate} className="text-[11px]" /> ·{' '}
            </>
          )}
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

function FreeBaySheet({
  bay,
  orders,
  loading,
  selection,
  actions,
  error,
  onError,
  onClose,
}: {
  bay: number
  orders: WorkOrder[]
  loading?: boolean
  selection: FloorSelection
  actions: OrderActions
  error: string | null
  onError: (m: string) => void
  onClose: () => void
}) {
  const ctx = useWorkspace()
  const waiting = waitingOrders(orders).filter((o) => o.status !== 'ready')
  const canOperate = ctx.can('operate')
  return (
    <>
      <PanelHeader eyebrow="Libre" title={`Elevador ${bay}`} onClose={onClose} />
      <div className="space-y-3">
        <InlineError message={error} />
        {loading ? (
          <Skeleton className="h-32" />
        ) : waiting.length === 0 ? (
          <div className="space-y-3 border-t border-line pt-3 text-sm text-fg-muted">
            <p>No hay coches esperando elevador.</p>
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
            {waiting.length > 8 && (
              <Link to={`${ctx.base}/ordenes`} className="inline-block text-sm font-medium text-accent-ink hover:underline">
                Ver las {waiting.length} en el tablero
              </Link>
            )}
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
  onClose,
}: {
  order: WorkOrder
  bays: Bay[]
  selection: FloorSelection
  actions: OrderActions
  error: string | null
  onError: (m: string) => void
  onClose: () => void
}) {
  const ctx = useWorkspace()
  const canOperate = ctx.can('operate')
  // Importes: solo owner y manager (contrato, permiso `manage`); el mecánico no los ve.
  const canSeeMoney = ctx.can('manage')
  const v = order.vehicle
  const next = nextStep(order.status)
  const busy = actions.busyId === order.id
  const freeBays = bays.filter((b) => !b.work_order)
  const orderHref = `${ctx.base}/ordenes/${order.id}`
  const prio = PRIORITY[order.priority]
  const PrioIcon = prio.icon

  const details: { label: string; value: ReactNode }[] = [
    {
      label: 'Cliente',
      value: order.customer ? (
        <>
          <Link to={`${ctx.base}/clientes/${order.customer.id}`} className="hover:underline">
            {order.customer.name}
          </Link>
          {order.customer.phone && (
            <a href={telHref(order.customer.phone)} className="mt-0.5 block text-fg-muted tabular hover:text-fg hover:underline">
              <span className="sr-only">Llamar al </span>
              {order.customer.phone}
            </a>
          )}
        </>
      ) : (
        <span className="text-fg-subtle">Sin cliente</span>
      ),
    },
    { label: 'Elevador', value: order.bay ? <span className="tabular">Elevador {order.bay}</span> : <span className="text-fg-muted">Sin elevador</span> },
    { label: 'Mecánico', value: order.assigned_to?.name ?? <span className="text-fg-subtle">Sin asignar</span> },
    {
      label: 'Prioridad',
      value: (
        <span className="inline-flex items-center gap-1">
          <PrioIcon aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
          {prio.label}
        </span>
      ),
    },
    { label: 'Km de entrada', value: <span className="tabular whitespace-nowrap">{formatKm(order.mileage_in, { empty: 'Sin anotar' })}</span> },
    { label: 'Recibido', value: <span className="tabular whitespace-nowrap">{formatWhen(order.received_at)}</span> },
    {
      label: 'Entrega prometida',
      value: order.promised_at ? (
        <>
          <PromisedAt order={order} className="justify-end" />
          {order.is_late && (
            <span className="mt-0.5 flex items-center justify-end gap-1 text-xs font-medium text-danger">
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              Con retraso
            </span>
          )}
        </>
      ) : (
        <span className="text-fg-subtle">Sin fecha</span>
      ),
    },
    ...(canSeeMoney ? [{ label: 'Total (con IVA)', value: <span className="font-medium tabular whitespace-nowrap">{formatMoney(order.total)}</span> }] : []),
  ]

  return (
    <>
      <PanelHeader
        eyebrow={<span className="tabular">{order.number}</span>}
        title={
          <Link to={orderHref} className="hover:underline">
            {order.title}
          </Link>
        }
        onClose={onClose}
      />
      <div className="space-y-4">
        <p className="flex flex-wrap gap-1.5">
          <StatusPill status={WORK_ORDER_STATUS[order.status]} />
          {order.is_late && <LateBadge size="md" />}
          {(order.priority === 'urgent' || order.priority === 'high') && <PriorityBadge priority={order.priority} size="md" />}
        </p>

        <div className="flex min-w-0 items-center gap-3">
          <VehicleSwatch vehicle={v} size="sm" />
          <p className="min-w-0">
            <Link to={`${ctx.base}/vehiculos/${v.id}`} className="block truncate font-medium text-fg hover:underline">
              {v.display_name}
            </Link>
            {v.plate ? <Plate value={v.plate} className="tag-label" /> : <span className="text-xs text-fg-subtle">Sin matrícula</span>}
          </p>
        </div>

        <dl className="border-y border-line text-sm">
          {details.map((d) => (
            <div key={d.label} className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
              <dt className="shrink-0 text-fg-muted">{d.label}</dt>
              <dd className="min-w-0 text-right text-fg">{d.value}</dd>
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
              <MoveToMenu
                order={order}
                onRequest={(o, s) => (s === 'delivered' || s === 'cancelled' ? actions.request(o, s) : void actions.move(o, s, undefined, { onError }))}
                variant="button"
                disabled={busy}
              />
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
                    <Button
                      key={b.number}
                      size="sm"
                      icon={<ArrowUpFromLine aria-hidden />}
                      disabled={busy}
                      onClick={() => void actions.move(order, order.status, b.number, { onError, onSuccess: (u) => selection.select({ orderId: u.id }) })}
                    >
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
            Abrir orden
          </ButtonLink>
          <ButtonLink to={`${ctx.base}/vehiculos/${v.id}/historial`} size="sm" variant="ghost" icon={<ExternalLink aria-hidden />}>
            Historial del vehículo
          </ButtonLink>
        </div>
      </div>
    </>
  )
}

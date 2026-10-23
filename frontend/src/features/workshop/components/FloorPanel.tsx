import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, CircleAlert, ClipboardList, ExternalLink, Phone, Plus, TriangleAlert, UserRound, Warehouse, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Bay, WorkOrder } from '@/api/types'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, Plate } from '@/components/ui/Badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { VehicleSwatch } from '@/components/vehicles/VehicleVisuals'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { formatKm, formatMoney } from '@/lib/format'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { CarThumbnail } from '@/three'
import { type FloorSelection, resolveSelection, telHref } from './floor'
import { MoveToMenu } from './MoveToMenu'
import { BayBadge, LateBadge, OrderStatusPill, PriorityBadge, PromisedAt } from './OrderBadges'
import { baysSummary, formatWhen, nextStep, waitingOrders } from './orderUtils'
import type { OrderActions } from './useOrderActions'

// ───────── Franja de elevadores (alternativa HTML de la escena) ─────────

export function BayStrip({ bays, selection, className }: { bays: Bay[]; selection: FloorSelection; className?: string }) {
  const resolved = resolveSelection(selection, bays, [])
  const selectedBay = selection.bay ?? resolved.bay
  return (
    <ul aria-label="Elevadores" className={cn('grid grid-cols-2 gap-2 @lg:grid-cols-4', className)}>
      {bays.map((b) => {
        const o = b.work_order
        const selected = selectedBay === b.number
        const st = o ? WORK_ORDER_STATUS[o.status] : null
        const StIcon = st?.icon
        return (
          <li key={b.number} className="min-w-0">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => selection.select(selected ? null : { bay: b.number })}
              className={cn(
                'flex h-full w-full min-w-0 flex-col items-start gap-1 rounded-card border bg-surface px-3 py-2.5 text-left transition-colors duration-150',
                selected ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong hover:bg-surface-2/60',
              )}
            >
              <span className="flex w-full items-center gap-1.5 text-xs font-medium text-fg-muted">
                <Warehouse aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">Elevador {b.number}</span>
                {o?.is_late && (
                  <span className="ml-auto inline-flex shrink-0 items-center text-danger" title="Va tarde">
                    <TriangleAlert aria-hidden className="size-3.5" />
                    <span className="sr-only">, va tarde</span>
                  </span>
                )}
              </span>
              {o ? (
                <>
                  <span className="flex w-full min-w-0 items-center gap-1.5">
                    <VehicleSwatch vehicle={o.vehicle} size="sm" className="size-5 [&_svg]:size-2.5" />
                    <span className="truncate text-sm font-medium text-fg">{o.vehicle.display_name}</span>
                  </span>
                  <span className="flex w-full min-w-0 items-center gap-1 text-[11px] text-fg-muted">
                    {StIcon && <StIcon aria-hidden className="size-3 shrink-0" />}
                    <span className="truncate">
                      {o.number.replace(/^OT-\d{4}-/, 'OT ')} · {st?.label}
                    </span>
                  </span>
                </>
              ) : (
                <span className="py-1 text-sm text-fg-subtle">Libre</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function BayStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[74px] rounded-card" />
      ))}
    </div>
  )
}

// ───────── Panel lateral sincronizado con la selección ─────────

export interface FloorPanelProps {
  bays: Bay[]
  /** Órdenes abiertas (zona de espera y búsqueda de la orden elegida). */
  orders: WorkOrder[]
  ordersLoading?: boolean
  selection: FloorSelection
  actions: OrderActions
  className?: string
}

/** Ficha rápida de lo elegido en el taller (elevador, coche en espera) con cambio de estado y de elevador. */
export function FloorPanel({ bays, orders, ordersLoading, selection, actions, className }: FloorPanelProps) {
  const resolved = resolveSelection(selection, bays, orders)
  const ref = useRef<HTMLElement>(null)
  const key = `${selection.bay ?? ''}-${selection.orderId ?? ''}`
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const visibleError = error?.key === key ? error.message : null

  // En móvil/tableta el panel queda bajo la escena: al elegir algo se acerca a la vista
  const lastKey = useRef(key)
  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    if (key === '-' || !ref.current || !window.matchMedia('(max-width: 1279px)').matches) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [key])

  const announce = resolved.order
    ? `Seleccionada ${resolved.order.number}, ${resolved.order.vehicle.display_name}${resolved.order.bay ? `, elevador ${resolved.order.bay}` : ', en espera'}.`
    : resolved.freeBay
      ? `Elevador ${resolved.bay} libre.`
      : ''

  const onError = (message: string) => setError({ key, message })

  return (
    <aside ref={ref} aria-labelledby="floor-panel-title" className={cn('flex min-w-0 scroll-mt-20 flex-col rounded-card border border-line bg-surface', className)}>
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

function PanelHeader({ title, eyebrow, onClose }: { title: ReactNode; eyebrow?: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-line px-4 pb-3 pt-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-0.5 text-xs font-medium text-fg-subtle">{eyebrow}</div>}
        <h2 id="floor-panel-title" className="font-display text-base font-semibold tracking-tight text-fg-warm">
          {title}
        </h2>
      </div>
      {onClose && (
        <IconButton label="Cerrar ficha" size="sm" onClick={onClose} className="-mr-2 -mt-1">
          <X aria-hidden />
        </IconButton>
      )}
    </div>
  )
}

function InlineError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-control border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-fg">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
      <span>{message}</span>
    </p>
  )
}

function WaitingButton({ order, onSelect }: { order: WorkOrder; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full min-w-0 items-center gap-3 rounded-control border bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2/60',
        order.is_late ? 'border-danger/40' : 'border-line',
      )}
    >
      <VehicleSwatch vehicle={order.vehicle} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{order.vehicle.display_name}</span>
        <span className="block truncate text-xs text-fg-muted">
          {order.number} · {WORK_ORDER_STATUS[order.status].label}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {order.is_late && <LateBadge />}
        <PriorityBadge priority={order.priority} quiet />
      </span>
    </button>
  )
}

function Overview({ bays, orders, loading, selection }: { bays: Bay[]; orders: WorkOrder[]; loading?: boolean; selection: FloorSelection }) {
  const ctx = useWorkspace()
  const { total, busy } = baysSummary(bays)
  const waiting = waitingOrders(orders)
  return (
    <>
      <PanelHeader title="Elevadores y espera" eyebrow={`${busy} de ${total} elevadores ocupados`} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm text-fg-muted">Elige un elevador o un coche en espera, en la escena o en la lista, para ver su ficha y moverlo.</p>
        <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-fg-subtle">
          En espera <span className="tabular">({loading ? '…' : waiting.length})</span>
        </h3>
        {loading ? (
          <div aria-hidden className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-control" />
            ))}
          </div>
        ) : waiting.length === 0 ? (
          <p className="rounded-control border border-dashed border-line px-3 py-4 text-center text-sm text-fg-muted">No hay coches esperando elevador.</p>
        ) : (
          <ul className="space-y-2">
            {waiting.slice(0, 6).map((o) => (
              <li key={o.id}>
                <WaitingButton order={o} onSelect={() => selection.select({ orderId: o.id })} />
              </li>
            ))}
          </ul>
        )}
        {waiting.length > 6 && (
          <Link to={`${ctx.base}/ordenes`} className="text-sm font-medium text-accent-ink hover:underline">
            Ver las {waiting.length} en el tablero
          </Link>
        )}
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
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            Elevador {bay}
            <Badge tone="ok" size="sm">
              Libre
            </Badge>
          </span>
        }
        eyebrow="Elevador"
        onClose={() => selection.select(null)}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <InlineError message={error} />
        {loading ? (
          <Skeleton className="h-32 rounded-control" />
        ) : waiting.length === 0 ? (
          <div className="rounded-control border border-dashed border-line px-3 py-5 text-center text-sm text-fg-muted">
            <p>No hay órdenes esperando elevador.</p>
            {canOperate && (
              <ButtonLink to={`${ctx.base}/ordenes/nueva?elevador=${bay}`} size="sm" icon={<Plus aria-hidden />} className="mt-3">
                Abrir orden en este elevador
              </ButtonLink>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-fg-muted">{canOperate ? 'Sube un coche de la zona de espera:' : 'Coches en espera:'}</p>
            <ul className="space-y-2">
              {waiting.slice(0, 8).map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <WaitingButton order={o} onSelect={() => selection.select({ orderId: o.id })} />
                  </div>
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
      label: 'Mecánico',
      value: order.assigned_to ? (
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={order.assigned_to.name} size="xs" />
          {order.assigned_to.name}
        </span>
      ) : (
        <span className="text-fg-subtle">Sin asignar</span>
      ),
    },
    { label: 'Prometida', value: order.promised_at ? <PromisedAt order={order} /> : <span className="text-fg-subtle">Sin fecha</span> },
    { label: 'Recibida', value: <span className="tabular">{formatWhen(order.received_at)}</span> },
    { label: 'Km de entrada', value: <span className="tabular">{formatKm(order.mileage_in, { empty: 'Sin anotar' })}</span> },
    ...(canManage ? [{ label: 'Total (con IVA)', value: <span className="font-medium tabular">{formatMoney(order.total)}</span> }] : []),
  ]

  return (
    <>
      <PanelHeader
        eyebrow={<span className="font-mono tracking-wide tabular">{order.number}</span>}
        title={
          <Link to={orderHref} className="hover:underline">
            {order.title}
          </Link>
        }
        onClose={() => selection.select(null)}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          <OrderStatusPill status={order.status} />
          {order.is_late && <LateBadge size="md" />}
          <PriorityBadge priority={order.priority} size="md" quiet />
          {order.bay ? <BayBadge bay={order.bay} size="md" /> : <Badge tone="neutral">En espera</Badge>}
        </div>

        <div className="flex items-center gap-3 rounded-control border border-line bg-surface-2/50 p-2.5">
          <CarThumbnail appearance={{ bodyType: v.body_type, colorHex: v.color_hex }} alt="" className="h-12 w-20 shrink-0" />
          <div className="min-w-0 flex-1">
            <Link to={`${ctx.base}/vehiculos/${v.id}`} className="block truncate text-sm font-medium text-fg hover:underline">
              {v.display_name}
            </Link>
            {v.plate && <Plate value={v.plate} className="mt-1 h-5 text-[10px]" />}
          </div>
        </div>

        {order.customer && (
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <UserRound aria-hidden className="size-4 shrink-0 text-fg-subtle" />
            <Link to={`${ctx.base}/clientes/${order.customer.id}`} className="min-w-0 truncate text-fg hover:underline">
              {order.customer.name}
            </Link>
            {order.customer.phone && (
              <a href={telHref(order.customer.phone)} className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 text-xs text-fg-muted hover:text-fg md:min-h-0">
                <Phone aria-hidden className="size-3.5" />
                <span className="sr-only">Llamar al </span>
                <span className="tabular">{order.customer.phone}</span>
              </a>
            )}
          </div>
        )}

        <dl className="divide-y divide-line rounded-control border border-line text-sm">
          {details.map((d) => (
            <div key={d.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-fg-muted">{d.label}</dt>
              <dd className="min-w-0 truncate text-right text-fg">{d.value}</dd>
            </div>
          ))}
        </dl>

        <InlineError message={error} />

        {canOperate && (
          <div className="space-y-3">
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
              <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.1em] text-fg-subtle">Elevador</p>
              {order.bay ? (
                <Button
                  size="sm"
                  icon={<ArrowDownToLine aria-hidden />}
                  disabled={busy}
                  onClick={() => void actions.move(order, order.status, null, { onError })}
                >
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
                      onClick={() => void actions.move(order, order.status, b.number, { onError })}
                    >
                      Subir al {b.number}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
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

/** Resumen corto para el encabezado: "Elevadores ocupados: 3 de 4 · 11 en espera". */
export function floorSummary(bays: Bay[], orders: WorkOrder[] | undefined): string {
  const { total, busy } = baysSummary(bays)
  const waiting = orders ? waitingOrders(orders).length : null
  return `Elevadores ocupados: ${busy} de ${total}${waiting !== null ? ` · ${waiting} en espera` : ''}`
}

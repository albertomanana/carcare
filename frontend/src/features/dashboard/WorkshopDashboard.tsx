import { CalendarClock, ChevronDown, CircleCheck, Plus, SquareKanban, TriangleAlert, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { LIVE_REFRESH_MS, useOpenWorkOrders, useWorkshopDashboard } from '@/api/hooks/workshop'
import type { Bay, WorkOrder, WorkshopDashboard as WorkshopDashboardData } from '@/api/types'
import { ButtonLink } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { buttonClasses } from '@/components/ui/variants'
import { ReminderItem } from '@/components/vehicles/ReminderItem'
import { useAuth } from '@/features/auth/auth-context'
import { PriorityBadge } from '@/features/workshop/components/OrderBadges'
import { OrderRow, OrderRowSkeleton } from '@/features/workshop/components/OrderList'
import { attentionOrders, controlCenterHeadline, formatWhen, waitingOrders } from '@/features/workshop/components/orderUtils'
import { type OrderActions, useOrderActions } from '@/features/workshop/components/useOrderActions'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatPlate } from '@/lib/format'
import { WORK_ORDER_STATUS_LABEL } from '@/lib/labels'
import { plural } from '@/lib/text'

/** Filas como máximo en "Requiere atención" y "Mis órdenes"; el resto, en el tablero. */
const MAX_ROWS = 8

/**
 * Centro de control del taller (plan UX 5.3): una línea de resumen, lo que requiere atención,
 * la tabla de elevadores y las alertas de flota. Sin 3D (está en Taller 3D) y sin importes
 * (están en Analítica). Dos peticiones, refrescadas cada minuto solo con la pestaña visible.
 */
export default function WorkshopDashboard() {
  const ctx = useWorkspace()
  useDocumentTitle('Centro de control')
  const dashboard = useWorkshopDashboard(ctx.id)
  const data = dashboard.data ?? null
  const canOperate = ctx.can('operate')

  return (
    <>
      <PageHeader
        title="Centro de control"
        description={data ? controlCenterHeadline(data) : undefined}
        actions={
          <>
            <ButtonLink to={`${ctx.base}/ordenes`} icon={<SquareKanban aria-hidden />}>
              Tablero
            </ButtonLink>
            {canOperate && (
              <ButtonLink to={`${ctx.base}/ordenes/nueva`} variant="primary" icon={<Plus aria-hidden />}>
                Nueva orden
              </ButtonLink>
            )}
          </>
        }
      />
      {dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      ) : !data ? (
        <ErrorState title="Este espacio no es un taller" />
      ) : (
        <ControlCenter data={data} />
      )}
    </>
  )
}

function ControlCenter({ data }: { data: WorkshopDashboardData }) {
  const ctx = useWorkspace()
  const { user } = useAuth()
  const open = useOpenWorkOrders(ctx.id, {}, LIVE_REFRESH_MS)
  const orders = open.data?.data
  const actions = useOrderActions()
  const isMechanic = ctx.workspace.role === 'mechanic'

  return (
    <div className="space-y-10">
      {isMechanic && (
        <MyOrders
          orders={orders?.filter((o) => o.assigned_to?.id === user?.id)}
          loading={open.isPending}
          error={open.isError ? open.error : null}
          onRetry={() => void open.refetch()}
        />
      )}
      <Attention data={data} />
      <Bays bays={data.bays} orders={orders} loading={open.isPending} actions={actions} />
      <FleetAlerts data={data} />
      {actions.dialogs}
    </div>
  )
}

function MyOrders({ orders, loading, error, onRetry }: { orders: WorkOrder[] | undefined; loading: boolean; error: Error | null; onRetry: () => void }) {
  const ctx = useWorkspace()
  return (
    <Section
      id="mis-ordenes"
      title="Mis órdenes"
      description={orders ? plural(orders.length, 'orden abierta asignada a ti', 'órdenes abiertas asignadas a ti') : undefined}
      action={
        orders && orders.length > 0 && (
          <Link to={`${ctx.base}/ordenes?mias=1`} className="text-sm font-medium text-accent-ink hover:underline">
            Ver en el tablero
          </Link>
        )
      }
    >
      {loading ? (
        <OrderRowSkeleton count={2} />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} />
      ) : !orders?.length ? (
        <EmptyState compact icon={<UserRound />} title="No tienes órdenes asignadas" description="Cuando te asignen una orden aparecerá aquí." />
      ) : (
        <ul className="border-t border-line">
          {orders.slice(0, MAX_ROWS).map((o) => (
            <OrderRow key={o.id} order={o} to={`${ctx.base}/ordenes/${o.id}`} />
          ))}
        </ul>
      )}
    </Section>
  )
}

/** Promesa de entrega: "Tarde" con icono y texto (nunca solo el color). */
function Promised({ order }: { order: WorkOrder }) {
  if (!order.promised_at) return <span className="text-fg-subtle">Sin fecha</span>
  return order.is_late ? (
    <span className="inline-flex items-center gap-1 text-danger tabular">
      <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
      Tarde · {formatWhen(order.promised_at)}
    </span>
  ) : (
    <span className="text-fg tabular">{formatWhen(order.promised_at)}</span>
  )
}

function Attention({ data }: { data: WorkshopDashboardData }) {
  const ctx = useWorkspace()
  const list = attentionOrders(data)
  const shown = list.slice(0, MAX_ROWS)
  const href = (o: WorkOrder) => `${ctx.base}/ordenes/${o.id}`
  return (
    <Section
      id="atencion"
      title="Requiere atención"
      description={list.length ? 'Van tarde o tienen la entrega prometida para hoy.' : undefined}
      action={
        list.length > 0 && (
          <Link to={`${ctx.base}/ordenes`} className="text-sm font-medium text-accent-ink hover:underline">
            {list.length > MAX_ROWS ? `Ver las ${list.length} en el tablero` : 'Ver en el tablero'}
          </Link>
        )
      }
    >
      {list.length === 0 ? (
        <EmptyState compact icon={<CircleCheck />} title="Nada va tarde ni hay entregas para hoy" description="Las órdenes con fecha prometida van en plazo." />
      ) : (
        <>
          <ul className="border-t border-line md:hidden">
            {shown.map((o) => (
              <OrderRow key={o.id} order={o} to={href(o)} />
            ))}
          </ul>
          <table className="hidden w-full table-fixed border-y border-line text-sm md:table">
            <caption className="sr-only">Órdenes que van tarde o con entrega prometida para hoy</caption>
            <thead className="border-b border-line text-left text-xs text-fg-muted">
              <tr>
                <th scope="col" className="w-[7rem] py-2.5 pr-3 font-medium">
                  Nº
                </th>
                <th scope="col" className="py-2.5 pr-3 font-medium">
                  Trabajo
                </th>
                <th scope="col" className="w-[26%] py-2.5 pr-3 font-medium">
                  Vehículo
                </th>
                <th scope="col" className="w-[8.5rem] py-2.5 pr-3 font-medium">
                  Estado
                </th>
                <th scope="col" className="w-[11rem] py-2.5 font-medium">
                  Prometida
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((o) => (
                <tr key={o.id} className="align-top transition-colors hover:bg-surface-2/50">
                  <td className="py-2.5 pr-3 text-fg-muted tabular">{o.number}</td>
                  <td className="py-2.5 pr-3">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <Link to={href(o)} className="min-w-0 truncate font-medium text-fg hover:underline">
                        {o.title}
                      </Link>
                      {o.priority === 'urgent' && <PriorityBadge priority="urgent" />}
                    </span>
                  </td>
                  <td className="truncate py-2.5 pr-3 text-fg-muted">{vehicleText(o)}</td>
                  <td className="py-2.5 pr-3 text-fg">{WORK_ORDER_STATUS_LABEL[o.status]}</td>
                  <td className="py-2.5">
                    <Promised order={o} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Section>
  )
}

function vehicleText(o: WorkOrder): string {
  return [o.vehicle.display_name, o.vehicle.plate ? formatPlate(o.vehicle.plate) : null].filter(Boolean).join(' · ')
}

/** Elevadores en tabla (sustituye a la escena 3D y a la franja). Un elevador libre ofrece "Subir coche" con los que esperan. */
function Bays({ bays, orders, loading, actions }: { bays: Bay[]; orders: WorkOrder[] | undefined; loading: boolean; actions: OrderActions }) {
  const ctx = useWorkspace()
  const canOperate = ctx.can('operate')
  const waiting = waitingOrders(orders)
  const href = (o: WorkOrder) => `${ctx.base}/ordenes/${o.id}`

  const upload = (bay: number) =>
    canOperate &&
    waiting.length > 0 && (
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonClasses({ size: 'sm' })} aria-label={`Subir un coche al elevador ${bay}`}>
          Subir coche
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 max-w-[calc(100vw-2rem)]">
          {waiting.slice(0, 10).map((o) => (
            <DropdownMenuItem key={o.id} disabled={actions.busyId === o.id} onSelect={() => void actions.move(o, o.status, bay)}>
              <span className="min-w-0">
                <span className="block truncate">{o.title}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {o.number} · {vehicleText(o)}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )

  return (
    <Section
      id="elevadores"
      title="Elevadores"
      action={
        <Link to={`${ctx.base}/taller`} className="text-sm font-medium text-accent-ink hover:underline">
          Ver Taller 3D
        </Link>
      }
    >
      {bays.length === 0 ? (
        <EmptyState compact title="Este taller no tiene elevadores" description="El número de elevadores se configura en los ajustes del taller." />
      ) : (
        <>
          <ul className="border-t border-line md:hidden">
            {bays.map((b) => {
              const o = b.work_order
              return (
                <li key={b.number} className="flex items-center gap-3 border-b border-line py-2.5">
                  <span className="w-20 shrink-0 text-sm font-medium text-fg">Elevador {b.number}</span>
                  {o ? (
                    <Link to={href(o)} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate text-sm text-fg">{vehicleText(o)}</span>
                      <span className="block truncate text-xs text-fg-muted">{[o.number, WORK_ORDER_STATUS_LABEL[o.status], o.assigned_to?.name].filter(Boolean).join(' · ')}</span>
                    </Link>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-fg-muted">Libre</span>
                      {upload(b.number)}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
          <table className="hidden w-full table-fixed border-y border-line text-sm md:table">
            <caption className="sr-only">Elevadores del taller</caption>
            <thead className="border-b border-line text-left text-xs text-fg-muted">
              <tr>
                <th scope="col" className="w-[7rem] py-2.5 pr-3 font-medium">
                  Elevador
                </th>
                <th scope="col" className="w-[26%] py-2.5 pr-3 font-medium">
                  Vehículo
                </th>
                <th scope="col" className="py-2.5 pr-3 font-medium">
                  Orden
                </th>
                <th scope="col" className="w-[8.5rem] py-2.5 pr-3 font-medium">
                  Estado
                </th>
                <th scope="col" className="w-[11rem] py-2.5 font-medium">
                  Mecánico
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bays.map((b) => {
                const o = b.work_order
                return (
                  <tr key={b.number} className="align-middle">
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium text-fg">
                      {b.number}
                    </th>
                    {o ? (
                      <>
                        <td className="truncate py-2.5 pr-3 text-fg">{vehicleText(o)}</td>
                        <td className="truncate py-2.5 pr-3">
                          <Link to={href(o)} className="text-fg hover:underline">
                            <span className="text-fg-muted tabular">{o.number}</span> {o.title}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-fg">{WORK_ORDER_STATUS_LABEL[o.status]}</td>
                        <td className="truncate py-2.5 text-fg-muted">{o.assigned_to?.name ?? 'Sin asignar'}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="py-2">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-fg-muted">Libre</span>
                          {upload(b.number)}
                        </span>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
      <p className="mt-3 text-sm text-fg-muted" aria-live="polite">
        {loading ? (
          'Cargando la zona de espera…'
        ) : orders ? (
          <>
            En espera: {plural(waiting.length, 'coche', 'coches')}
            {waiting.length > 0 && (
              <>
                {' · '}
                <Link to={`${ctx.base}/ordenes`} className="font-medium text-accent-ink hover:underline">
                  Ver en el tablero
                </Link>
              </>
            )}
          </>
        ) : (
          'No se pudo cargar la zona de espera.'
        )}
      </p>
    </Section>
  )
}

function FleetAlerts({ data }: { data: WorkshopDashboardData }) {
  const ctx = useWorkspace()
  const n = data.fleet_alerts.length
  return (
    <Section
      title={n ? `Alertas de flota (${n})` : 'Alertas de flota'}
      description="Según los intervalos anotados, no medido."
      action={
        <Link to={`${ctx.base}/agenda`} className="text-sm font-medium text-accent-ink hover:underline">
          Agenda de flota
        </Link>
      }
    >
      {n ? (
        <ul className="space-y-2">
          {data.fleet_alerts.slice(0, 5).map((r) => (
            <ReminderItem key={r.id} reminder={r} compact vehicleLink={`${ctx.base}/vehiculos/${r.vehicle_id}/recordatorios`} />
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<CalendarClock />} title="Sin alertas de flota" description="Ningún vehículo del taller tiene recordatorios vencidos ni próximos." />
      )}
    </Section>
  )
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-10">
      <span className="sr-only">Cargando el centro de control…</span>
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <SkeletonText lines={4} />
      </div>
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <SkeletonText lines={4} />
      </div>
    </div>
  )
}

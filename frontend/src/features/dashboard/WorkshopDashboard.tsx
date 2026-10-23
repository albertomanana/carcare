import { CalendarClock, CalendarCheck2, CircleCheck, ClipboardList, Maximize2, Plus, SquareKanban, TriangleAlert, Warehouse } from 'lucide-react'
import { Link } from 'react-router'
import { LIVE_REFRESH_MS, useOpenWorkOrders, useWorkshopDashboard } from '@/api/hooks/workshop'
import type { WorkOrder, WorkshopDashboard as WorkshopDashboardData } from '@/api/types'
import { MonthlyBars } from '@/components/charts/Charts'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ReminderItem } from '@/components/vehicles/ReminderItem'
import { BayStrip, BayStripSkeleton, FloorPanel } from '@/features/workshop/components/FloorPanel'
import { resolveSelection, useFloorSelection } from '@/features/workshop/components/floor'
import { OrderRow, OrderRowSkeleton } from '@/features/workshop/components/OrderList'
import { baysSummary, KANBAN_STATUSES, waitingOrders } from '@/features/workshop/components/orderUtils'
import { TeamActivity } from '@/features/workshop/components/TeamActivity'
import { useOrderActions } from '@/features/workshop/components/useOrderActions'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { formatDate, formatMoney, todayISO } from '@/lib/format'
import { TONE_CLASSES, WORK_ORDER_STATUS } from '@/lib/status'
import { plural } from '@/lib/text'
import { WorkshopScene } from '@/three'

/** Centro de control del taller: elevadores en 3D con su ficha, lo que va tarde, lo de hoy, flota y equipo. */
export default function WorkshopDashboard() {
  const ctx = useWorkspace()
  useDocumentTitle('Centro de control')
  const dashboard = useWorkshopDashboard(ctx.id)
  const data = dashboard.data ?? null
  const canOperate = ctx.can('operate')

  return (
    <>
      <PageHeader
        eyebrow={formatDate(todayISO(), 'weekday')}
        title="Centro de control"
        description={data ? headline(data) : `${ctx.workspace.name}: lo que pasa en el taller ahora mismo.`}
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

function headline(d: WorkshopDashboardData): string {
  const parts = [plural(d.counts.open_orders, 'orden abierta', 'órdenes abiertas')]
  if (d.counts.late_orders) parts.push(`${d.counts.late_orders} ${d.counts.late_orders === 1 ? 'va' : 'van'} tarde`)
  if (d.due_today.length) parts.push(`${d.due_today.length} para hoy`)
  return `${parts.join(' · ')}.`
}

function ControlCenter({ data }: { data: WorkshopDashboardData }) {
  const ctx = useWorkspace()
  const open = useOpenWorkOrders(ctx.id, {}, LIVE_REFRESH_MS)
  const orders = open.data?.data ?? []
  const waiting = waitingOrders(orders)
  const selection = useFloorSelection()
  const resolved = resolveSelection(selection, data.bays, orders)
  const actions = useOrderActions()
  const { total, busy, free } = baysSummary(data.bays)
  const orderHref = (o: WorkOrder) => `${ctx.base}/ordenes/${o.id}`

  return (
    <div className="space-y-8">
      <section aria-label="Cifras del taller" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Órdenes abiertas"
          icon={<ClipboardList aria-hidden />}
          value={data.counts.open_orders}
          hint={open.data ? `${busy} en elevador · ${waiting.length} en espera` : `${busy} en elevador`}
        />
        <StatCard
          label="Tarde"
          icon={<TriangleAlert aria-hidden />}
          value={data.counts.late_orders}
          hint={data.counts.late_orders ? 'Fecha prometida ya pasada' : 'Ninguna fuera de plazo'}
          className={cn(data.counts.late_orders > 0 && 'border-danger/40')}
        />
        <StatCard label="Para hoy" icon={<CalendarCheck2 aria-hidden />} value={data.due_today.length} hint="Con fecha prometida hoy" />
        <StatCard label="Elevadores libres" icon={<Warehouse aria-hidden />} value={free} unit={`de ${total}`} hint={`${data.counts.vehicles} vehículos · ${data.counts.customers} clientes`} />
      </section>

      <Pipeline data={data} />

      <section aria-labelledby="floor-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="floor-title" className="font-display text-lg font-semibold tracking-tight text-fg-warm">
              El taller ahora
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted">Elevadores y zona de espera. Se actualiza cada minuto.</p>
          </div>
          <ButtonLink to={`${ctx.base}/taller`} size="sm" variant="ghost" icon={<Maximize2 aria-hidden />}>
            Pantalla completa
          </ButtonLink>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="@container min-w-0 space-y-3">
            <div className="relative h-[300px] overflow-hidden rounded-hero border border-line bg-surface sm:h-[380px] lg:h-[440px]">
              <WorkshopScene
                bays={data.bays}
                waiting={waiting}
                selectedBay={resolved.bay}
                onSelectBay={(n) => selection.select(n ? { bay: n } : null)}
                onSelectOrder={(id) => selection.select({ orderId: id })}
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <BayStrip bays={data.bays} selection={selection} />
          </div>
          {/* En escritorio el panel ocupa la altura de la escena + franja y desplaza su contenido */}
          <div className="relative min-w-0">
            <FloorPanel bays={data.bays} orders={orders} ordersLoading={open.isPending} selection={selection} actions={actions} className="xl:absolute xl:inset-0 xl:overflow-y-auto" />
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section
          id="tarde"
          title="Tarde"
          description="Prometidas para antes de ahora y sin terminar."
          action={
            data.late.length > 0 && (
              <Link to={`${ctx.base}/ordenes?tarde=1`} className="text-sm font-medium text-accent-ink hover:underline">
                Ver en el tablero
              </Link>
            )
          }
        >
          {data.late.length ? (
            <ul className="space-y-2">
              {data.late.slice(0, 6).map((o) => (
                <OrderRow key={o.id} order={o} to={orderHref(o)} />
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CircleCheck />} title="Nada va tarde" description="Todas las órdenes con fecha prometida van en plazo." />
          )}
        </Section>
        <Section id="hoy" title="Para hoy" description="Órdenes con la entrega prometida para hoy.">
          {data.due_today.length ? (
            <ul className="space-y-2">
              {data.due_today.map((o) => (
                <OrderRow key={o.id} order={o} to={orderHref(o)} />
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CalendarClock />} title="Nada prometido para hoy" description="Cuando una orden tenga la entrega prometida para hoy aparecerá aquí." />
          )}
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {data.revenue && <Revenue revenue={data.revenue} />}
        <FleetAlerts data={data} />
        {!data.revenue && <TeamSection data={data} />}
      </div>
      {data.revenue && <TeamSection data={data} />}
      {actions.dialogs}
    </div>
  )
}

/** Flujo de trabajo: cuántas órdenes hay en cada estado abierto (enlaza a la lista filtrada). */
function Pipeline({ data }: { data: WorkshopDashboardData }) {
  const ctx = useWorkspace()
  return (
    <nav aria-label="Órdenes por estado">
      <ol className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5">
        {KANBAN_STATUSES.map((s, i) => {
          const st = WORK_ORDER_STATUS[s]
          const Icon = st.icon
          const n = data.orders_by_status[s] ?? 0
          return (
            <li key={s} className="min-w-[150px] flex-1">
              <Link
                to={`${ctx.base}/ordenes?vista=lista&estado=${s}`}
                className="flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface-2/60"
              >
                <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4', TONE_CLASSES[st.tone].soft)}>
                  <Icon />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-fg-muted">
                    <span className="sr-only">Paso {i + 1}: </span>
                    {st.label}
                  </span>
                  <span className="block font-display text-xl font-semibold leading-tight text-fg-warm tabular">{n}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Revenue({ revenue }: { revenue: NonNullable<WorkshopDashboardData['revenue']> }) {
  const ctx = useWorkspace()
  return (
    <Section
      title="Importe de órdenes entregadas"
      description="Total con IVA de lo entregado. Es un resumen interno, no son facturas."
      action={
        ctx.can('manage') && (
          <Link to={`${ctx.base}/analitica`} className="text-sm font-medium text-accent-ink hover:underline">
            Facturación
          </Link>
        )
      }
    >
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-fg-subtle">Este mes</p>
            <p className="font-display text-2xl font-semibold text-fg-warm tabular">{formatMoney(revenue.month)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-fg-subtle">Este año</p>
            <p className="font-display text-2xl font-semibold text-fg-warm tabular">{formatMoney(revenue.year)}</p>
          </div>
        </div>
        <MonthlyBars data={revenue.by_month} label="Importe de las órdenes entregadas en los últimos 12 meses" />
      </Card>
    </Section>
  )
}

function FleetAlerts({ data }: { data: WorkshopDashboardData }) {
  const ctx = useWorkspace()
  const overdue = data.counts.overdue_reminders
  return (
    <Section
      title="Alertas de flota"
      description={`${overdue ? `${plural(overdue, 'recordatorio vencido', 'recordatorios vencidos')}. ` : ''}Según los intervalos anotados, no medido.`}
      action={
        <Link to={`${ctx.base}/agenda`} className="text-sm font-medium text-accent-ink hover:underline">
          Agenda de flota
        </Link>
      }
    >
      {data.fleet_alerts.length ? (
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

function TeamSection({ data }: { data: WorkshopDashboardData }) {
  const ctx = useWorkspace()
  return (
    <Section
      title="Actividad del equipo"
      action={
        <Link to={`${ctx.base}/equipo`} className="text-sm font-medium text-accent-ink hover:underline">
          Equipo
        </Link>
      }
    >
      <TeamActivity items={data.recent_activity} />
    </Section>
  )
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <span className="sr-only">Cargando el centro de control…</span>
      <div aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
      <div aria-hidden className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 min-w-[150px] flex-1 rounded-card" />
        ))}
      </div>
      <div aria-hidden className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="@container space-y-3">
          <Skeleton className="h-[300px] rounded-hero sm:h-[380px] lg:h-[440px]" />
          <BayStripSkeleton />
        </div>
        <Skeleton className="h-80 rounded-card xl:h-auto" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <OrderRowSkeleton count={3} />
        <OrderRowSkeleton count={2} />
      </div>
    </div>
  )
}

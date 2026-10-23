import { ClipboardList, ClipboardPlus, History } from 'lucide-react'
import { Link } from 'react-router'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useWorkOrdersInfinite } from '@/api/hooks/workshop'
import { ButtonLink } from '@/components/ui/Button'
import { LoadMore } from '@/components/ui/LoadMore'
import { Section } from '@/components/ui/Section'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { OrderRow, OrderRowSkeleton } from '@/features/workshop/components/OrderList'
import { isFinalStatus } from '@/features/workshop/components/orderUtils'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useVehicleOutlet } from '../vehicle-outlet'

/** Órdenes de trabajo del vehículo (solo talleres): las abiertas arriba y el resto debajo. */
export default function OrdersTab() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const query = useWorkOrdersInfinite(ctx.id, { vehicle_id: vehicle.id, per_page: 20 }, ctx.isWorkshop)
  const orders = flattenPages(query.data)
  const total = totalFromPages(query.data)
  const open = orders.filter((o) => !isFinalStatus(o.status))
  const closed = orders.filter((o) => isFinalStatus(o.status))
  const canCreate = ctx.can('operate') && !vehicle.archived_at
  const showTotal = ctx.can('manage')
  const newHref = `${ctx.base}/ordenes/nueva?vehiculo=${vehicle.id}`
  const orderHref = (id: number) => `${ctx.base}/ordenes/${id}`

  if (!ctx.isWorkshop)
    return <EmptyState icon={<ClipboardList />} title="Las órdenes de trabajo son del modo taller" description="En tu garaje, lo que se hace al coche se registra como intervención en el historial." />

  const createAction = canCreate && (
    <ButtonLink to={newHref} icon={<ClipboardPlus aria-hidden />}>
      Nueva orden
    </ButtonLink>
  )

  return (
    <div className="space-y-8">
      {query.isPending ? (
        <OrderRowSkeleton count={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="Este vehículo no tiene órdenes"
          description={
            vehicle.archived_at
              ? 'Está archivado: restáuralo para abrirle una orden.'
              : 'Cuando entre en el taller, ábrele una orden. Al entregarla, el trabajo quedará en su historial.'
          }
          action={createAction}
        />
      ) : (
        <>
          <Section
            title="Abiertas"
            description={open.length ? 'En el taller ahora mismo.' : 'Ninguna orden abierta: el coche no está en el taller.'}
            action={createAction}
          >
            {open.length ? (
              <ul className="space-y-2">
                {open.map((o) => (
                  <OrderRow key={o.id} order={o} to={orderHref(o.id)} showVehicle={false} showTotal={showTotal} />
                ))}
              </ul>
            ) : (
              <p className="rounded-card border border-dashed border-line px-4 py-5 text-center text-sm text-fg-muted">Sin órdenes abiertas.</p>
            )}
          </Section>

          {closed.length > 0 && (
            <Section
              title="Entregadas y canceladas"
              description="Las entregadas también están en el historial como intervenciones."
              action={
                <Link to={`${ctx.base}/vehiculos/${vehicle.id}/historial`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline md:min-h-0">
                  <History aria-hidden className="size-4" />
                  Ver historial
                </Link>
              }
            >
              <ul className="space-y-2">
                {closed.map((o) => (
                  <OrderRow key={o.id} order={o} to={orderHref(o.id)} showVehicle={false} showTotal={showTotal} />
                ))}
              </ul>
            </Section>
          )}

          <LoadMore hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} shown={orders.length} total={total} what="órdenes" />
        </>
      )}
    </div>
  )
}

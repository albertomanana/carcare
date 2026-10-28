import { Plus, SquareKanban, Warehouse } from 'lucide-react'
import { LIVE_REFRESH_MS, useBays, useOpenWorkOrders } from '@/api/hooks/workshop'
import { ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { WorkshopScene } from '@/three'
import { FloorPanel, FloorPanelSkeleton } from './components/FloorPanel'
import { resolveSelection, useFloorSelection } from './components/floor'
import { floorSummary, waitingOrders } from './components/orderUtils'
import { useOrderActions } from './components/useOrderActions'

/**
 * Taller 3D (plan UX 5.5): la escena a toda la altura y, al lado, la lista de elevadores y de la zona de espera,
 * sincronizada con la escena y que es su alternativa HTML accesible. Sin la franja de elevadores bajo la escena,
 * que repetía los rótulos y el panel. Se actualiza cada minuto; los cambios hechos aquí se ven al momento.
 */
export default function WorkshopFloorPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Taller 3D')
  const bays = useBays(ctx.id, ctx.isWorkshop, LIVE_REFRESH_MS)
  const open = useOpenWorkOrders(ctx.id, {}, LIVE_REFRESH_MS)
  const selection = useFloorSelection()
  const actions = useOrderActions()
  const canOperate = ctx.can('operate')

  if (!ctx.isWorkshop)
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState icon={<Warehouse />} title="El taller 3D es del modo taller" description="Cambia a un espacio de taller para ver sus elevadores." />
      </div>
    )

  const orders = open.data?.data ?? []
  const bayList = bays.data ?? []
  const resolved = resolveSelection(selection, bayList, orders)
  const summary = bays.data ? floorSummary(bayList, open.data ? orders : undefined) : null

  return (
    <div className="flex flex-col xl:h-[calc(100dvh-4rem)]">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold tracking-tight text-fg-warm md:text-2xl">Taller 3D</h1>
          <p className="text-sm text-fg-muted" aria-live="polite">
            {summary ?? 'Cargando elevadores…'}
            <span className="hidden sm:inline"> · Se actualiza cada minuto.</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink to={`${ctx.base}/ordenes`} size="sm" icon={<SquareKanban aria-hidden />}>
            Tablero
          </ButtonLink>
          {canOperate && (
            <ButtonLink to={`${ctx.base}/ordenes/nueva${resolved.freeBay && resolved.bay ? `?elevador=${resolved.bay}` : ''}`} size="sm" variant="primary" icon={<Plus aria-hidden />}>
              Nueva orden
            </ButtonLink>
          )}
        </div>
      </div>

      {bays.isError ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <ErrorState error={bays.error} onRetry={() => void bays.refetch()} />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-h-0 min-w-0 flex-col p-3 sm:p-4 lg:px-8 xl:pr-4">
            <div className="relative h-[52dvh] min-h-[300px] overflow-hidden rounded-card border border-line bg-surface sm:h-[480px] xl:h-auto xl:min-h-0 xl:flex-1">
              {bays.isPending ? (
                <Skeleton className="absolute inset-0 rounded-none" />
              ) : (
                <WorkshopScene
                  bays={bayList}
                  waiting={waitingOrders(orders)}
                  selectedBay={resolved.bay}
                  onSelectBay={(n) => selection.select(n ? { bay: n } : null)}
                  onSelectOrder={(id) => selection.select({ orderId: id })}
                  className="absolute inset-0 h-full w-full"
                />
              )}
            </div>
          </div>
          <div className="min-h-0 min-w-0 px-4 pb-8 pt-2 sm:px-6 lg:px-8 xl:overflow-y-auto xl:py-4 xl:pl-2 xl:pr-6">
            {bays.isPending ? (
              <FloorPanelSkeleton />
            ) : (
              <FloorPanel bays={bayList} orders={orders} ordersLoading={open.isPending} selection={selection} actions={actions} />
            )}
            {open.isError && (
              <p className="mt-3 text-sm text-danger">
                No se pudo cargar la zona de espera.{' '}
                <button type="button" className="font-medium underline" onClick={() => void open.refetch()}>
                  Reintentar
                </button>
              </p>
            )}
          </div>
        </div>
      )}
      {actions.dialogs}
    </div>
  )
}

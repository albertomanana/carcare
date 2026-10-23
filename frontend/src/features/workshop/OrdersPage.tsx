import { ClipboardList, List, Plus, SquareKanban, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { LIVE_REFRESH_MS, useWorkOrders, useWorkOrdersInfinite } from '@/api/hooks/workshop'
import { useMembers } from '@/api/hooks/workspaces'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/inputs'
import { LoadMore } from '@/components/ui/LoadMore'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState, ErrorState, NoResults } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam } from '@/hooks/useSearchParam'
import { cn } from '@/lib/cn'
import { ALL_WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABEL } from '@/lib/labels'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { plural } from '@/lib/text'
import { KanbanBoard, KanbanSkeleton } from './components/KanbanBoard'
import { OrderRowSkeleton, OrdersTable } from './components/OrderList'
import { useOrderActions } from './components/useOrderActions'

type View = 'tablero' | 'lista'

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'open', label: 'Abiertas' },
  { value: 'all', label: 'Todas' },
  ...ALL_WORK_ORDER_STATUSES.map((s) => ({ value: s, label: WORK_ORDER_STATUS_LABEL[s] })),
]

/** Órdenes de trabajo: tablero kanban (arrastrar y soltar) o lista con filtros, todo en la URL. */
export default function OrdersPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Órdenes')
  const storedView = readStorage(STORAGE_KEYS.ordersView) === 'lista' ? 'lista' : 'tablero'
  const [viewParam, setView] = useSearchParam('vista', storedView)
  const view: View = viewParam === 'lista' ? 'lista' : 'tablero'
  const [q, setQ] = useSearchParam('q')
  const [mechanic, setMechanic] = useSearchParam('mecanico')
  const [lateParam, setLate] = useSearchParam('tarde')
  const [statusParam, setStatus] = useSearchParam('estado', 'open')
  const status = STATUS_FILTERS.some((s) => s.value === statusParam) ? statusParam : 'open'
  const onlyLate = lateParam === '1'
  const [term, setTerm] = useState(q)
  const debounced = useDebouncedValue(term)
  const members = useMembers(ctx.id)
  const actions = useOrderActions()
  const canOperate = ctx.can('operate')
  const showTotal = ctx.can('manage')

  useEffect(() => {
    if (debounced !== q) setQ(debounced)
  }, [debounced, q, setQ])

  const changeView = (v: View) => {
    writeStorage(STORAGE_KEYS.ordersView, v)
    setView(v)
  }

  const common = { search: q || undefined, assigned_to: mechanic || undefined }
  const board = useWorkOrders(ctx.id, { status: 'open', per_page: 200, ...common }, view === 'tablero', LIVE_REFRESH_MS)
  const list = useWorkOrdersInfinite(ctx.id, { status: status === 'all' ? undefined : status, per_page: 25, ...common }, view === 'lista')

  const boardOrders = useMemo(() => {
    const all = board.data?.data ?? []
    return onlyLate ? all.filter((o) => o.is_late) : all
  }, [board.data, onlyLate])
  const lateCount = board.data?.data.filter((o) => o.is_late).length ?? 0
  const listOrders = flattenPages(list.data)
  const listTotal = totalFromPages(list.data)

  const filtering = !!q || !!mechanic || (view === 'tablero' ? onlyLate : status !== 'open')
  const resetFilters = () => {
    setTerm('')
    setQ(null)
    setMechanic(null)
    setLate(null)
    setStatus(null)
  }
  const orderHref = (o: WorkOrder) => `${ctx.base}/ordenes/${o.id}`
  const vehicleHref = (o: WorkOrder) => `${ctx.base}/vehiculos/${o.vehicle.id}`
  const onRequest = (o: WorkOrder, s: WorkOrderStatus) => actions.request(o, s)

  const description =
    view === 'tablero'
      ? board.data
        ? `${plural(board.data.meta.total, 'orden abierta', 'órdenes abiertas')}${lateCount ? ` · ${lateCount} ${lateCount === 1 ? 'va' : 'van'} tarde` : ''}.`
        : 'Todo lo que está en el taller, por estado.'
      : listTotal !== null
        ? `${plural(listTotal, 'orden', 'órdenes')} con estos filtros.`
        : 'Busca y filtra todas las órdenes, también las entregadas.'

  const createAction = canOperate && (
    <ButtonLink to={`${ctx.base}/ordenes/nueva`} variant="primary" icon={<Plus aria-hidden />}>
      Nueva orden
    </ButtonLink>
  )

  return (
    <>
      <PageHeader title="Órdenes de trabajo" description={description} actions={createAction} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <SegmentedControl
          label="Vista"
          value={view}
          onValueChange={changeView}
          options={[
            { value: 'tablero', label: 'Tablero', icon: <SquareKanban aria-hidden /> },
            { value: 'lista', label: 'Lista', icon: <List aria-hidden /> },
          ]}
        />
        <SearchInput
          value={term}
          onValueChange={setTerm}
          aria-label="Buscar por número, título, matrícula o cliente"
          placeholder="Número, título, matrícula o cliente…"
          className="lg:ml-auto lg:w-80"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-fg-muted sm:flex-none">
            <span className="shrink-0">Mecánico</span>
            <Select value={mechanic} onChange={(e) => setMechanic(e.target.value || null)} className="sm:w-44" disabled={!members.data}>
              <option value="">Todos</option>
              {members.data?.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </Select>
          </label>
          {view === 'lista' ? (
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-fg-muted sm:flex-none">
              <span className="shrink-0">Estado</span>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <Button
              size="sm"
              aria-pressed={onlyLate}
              onClick={() => setLate(onlyLate ? null : '1')}
              icon={<TriangleAlert aria-hidden />}
              className={cn('h-11 md:h-10', onlyLate && 'border-danger/60 bg-danger-soft text-fg')}
            >
              Solo tarde{lateCount ? <span className="tabular text-fg-muted">({lateCount})</span> : null}
            </Button>
          )}
        </div>
      </div>

      {view === 'tablero' ? (
        board.isPending ? (
          <KanbanSkeleton />
        ) : board.isError ? (
          <ErrorState error={board.error} onRetry={() => void board.refetch()} />
        ) : boardOrders.length === 0 ? (
          filtering ? (
            <NoResults what="órdenes abiertas" onReset={resetFilters} />
          ) : (
            <EmptyState
              icon={<ClipboardList />}
              title="No hay órdenes abiertas"
              description="Cuando entre un coche, ábrele una orden: aparecerá aquí en «Recibido» y podrás llevarla por el tablero hasta la entrega."
              action={
                <>
                  {createAction}
                  <Button onClick={() => changeView('lista')}>Ver todas las órdenes</Button>
                </>
              }
            />
          )
        ) : (
          <>
            <p className="mb-3 text-xs text-fg-subtle">
              <span className="pointer-coarse:hidden">Arrastra una tarjeta a otra columna (Escape cancela) o usa el botón «Mover a…» de cada tarjeta.</span>
              <span className="hidden pointer-coarse:inline">Arrastra desde el asa de la tarjeta o usa el botón «Mover a…».</span> Entregar y cancelar piden confirmación.
            </p>
            <KanbanBoard orders={boardOrders} orderHref={orderHref} onRequest={onRequest} busyId={actions.busyId} />
          </>
        )
      ) : list.isPending ? (
        <OrderRowSkeleton count={6} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : listOrders.length === 0 ? (
        filtering ? (
          <NoResults what="órdenes" onReset={resetFilters} />
        ) : (
          <EmptyState icon={<ClipboardList />} title="Aún no hay órdenes abiertas" description="Las órdenes entregadas y canceladas siguen disponibles con el filtro «Estado»." action={createAction} />
        )
      ) : (
        <>
          <OrdersTable
            orders={listOrders}
            orderHref={orderHref}
            vehicleHref={vehicleHref}
            onRequest={onRequest}
            showTotal={showTotal}
            caption={`Órdenes de trabajo (${STATUS_FILTERS.find((s) => s.value === status)?.label.toLowerCase()})`}
          />
          <LoadMore hasNextPage={!!list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={list.fetchNextPage} shown={listOrders.length} total={listTotal} what="órdenes" />
        </>
      )}
      {actions.dialogs}
    </>
  )
}

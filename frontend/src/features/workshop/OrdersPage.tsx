import { Check, ChevronDown, ClipboardList, List, Plus, SquareKanban, TriangleAlert, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
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
import { useAuth } from '@/features/auth/auth-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam, useSearchParamsPatch } from '@/hooks/useSearchParam'
import { cn } from '@/lib/cn'
import { ALL_WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABEL } from '@/lib/labels'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { plural } from '@/lib/text'
import { assigneePatch, resolveAssignee, type AssigneeChoice, type AssigneeContext } from './components/assignee'
import { KanbanBoard, KanbanSkeleton } from './components/KanbanBoard'
import { OrderRowSkeleton, OrdersTable } from './components/OrderList'
import { useOrderActions } from './components/useOrderActions'

type View = 'tablero' | 'lista'

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'open', label: 'Abiertas' },
  { value: 'all', label: 'Todas' },
  ...ALL_WORK_ORDER_STATUSES.map((s) => ({ value: s, label: WORK_ORDER_STATUS_LABEL[s] })),
]

/**
 * Órdenes de trabajo: tablero kanban (arrastrar y soltar) o lista con filtros, todo en la URL.
 * «Mis órdenes» (assigned_to = tú) viene activado para el mecánico y desactivado para los demás.
 */
export default function OrdersPage() {
  const ctx = useWorkspace()
  const { user } = useAuth()
  useDocumentTitle('Órdenes')
  const [params] = useSearchParams()
  const patchParams = useSearchParamsPatch()
  // Sin preferencia guardada, el móvil abre la lista (el tablero horizontal sigue a un toque) y el escritorio el tablero.
  const saved = readStorage(STORAGE_KEYS.ordersView)
  const storedView = saved === 'lista' || saved === 'tablero' ? saved : window.matchMedia('(max-width: 767px)').matches ? 'lista' : 'tablero'
  const [viewParam, setView] = useSearchParam('vista', storedView)
  const view: View = viewParam === 'lista' ? 'lista' : 'tablero'
  const [q, setQ] = useSearchParam('q')
  const [lateParam, setLate] = useSearchParam('tarde')
  const [statusParam, setStatus] = useSearchParam('estado', 'open')
  const status = STATUS_FILTERS.some((s) => s.value === statusParam) ? statusParam : 'open'
  const onlyLate = lateParam === '1'
  const [term, setTerm] = useState(q)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const debounced = useDebouncedValue(term)
  const canOperate = ctx.can('operate')
  const canManage = ctx.can('manage')
  const members = useMembers(ctx.id)
  const actions = useOrderActions()
  const showTotal = canManage

  const assigneeCtx: AssigneeContext = { userId: user?.id ?? null, role: ctx.workspace.role, canPickMechanic: canManage }
  const assignee = resolveAssignee({ mias: params.get('mias'), mecanico: params.get('mecanico') }, assigneeCtx)
  const chooseAssignee = (choice: AssigneeChoice) => patchParams({ ...assigneePatch(choice, assigneeCtx) })

  // La búsqueda pasa a la URL al dejar de escribir (solo cuando cambia lo escrito, no al cambiar otros filtros)
  const appliedSearch = useRef(debounced)
  useEffect(() => {
    if (appliedSearch.current === debounced) return
    appliedSearch.current = debounced
    setQ(debounced)
  }, [debounced, setQ])

  const changeView = (v: View) => {
    writeStorage(STORAGE_KEYS.ordersView, v)
    setView(v)
  }

  const common = { search: q || undefined, assigned_to: assignee.assignedTo ?? undefined }
  const board = useWorkOrders(ctx.id, { status: 'open', per_page: 200, ...common }, view === 'tablero', LIVE_REFRESH_MS)
  const list = useWorkOrdersInfinite(ctx.id, { status: status === 'all' ? undefined : status, per_page: 25, ...common }, view === 'lista')

  const boardOrders = useMemo(() => {
    const all = board.data?.data ?? []
    return onlyLate ? all.filter((o) => o.is_late) : all
  }, [board.data, onlyLate])
  const lateCount = board.data?.data.filter((o) => o.is_late).length ?? 0
  const listOrders = flattenPages(list.data)
  const listTotal = totalFromPages(list.data)

  // «Mis órdenes» no cuenta como filtro: si no hay nada, se explica aparte y se ofrece ver todas
  const otherMechanic = assignee.assignedTo !== null && !assignee.mine
  const filtering = !!q || otherMechanic || (view === 'tablero' ? onlyLate : status !== 'open')
  // Lo que hay aplicado dentro de "Filtros" (móvil): mecánico concreto y "Solo tarde" o un estado distinto de "Abiertas"
  const activeFilters = [assignee.assignedTo !== null, view === 'tablero' ? onlyLate : status !== 'open'].filter(Boolean).length
  const resetFilters = () => {
    setTerm('')
    appliedSearch.current = ''
    patchParams({ q: null, mecanico: null, mias: null, tarde: null, estado: null })
  }
  const orderHref = (o: WorkOrder) => `${ctx.base}/ordenes/${o.id}`
  const vehicleHref = (o: WorkOrder) => `${ctx.base}/vehiculos/${o.vehicle.id}`
  const onRequest = (o: WorkOrder, s: WorkOrderStatus) => actions.request(o, s)

  const description =
    view === 'tablero'
      ? board.data
        ? `${assignee.mine ? plural(board.data.meta.total, 'orden abierta asignada a ti', 'órdenes abiertas asignadas a ti') : plural(board.data.meta.total, 'orden abierta', 'órdenes abiertas')}${lateCount ? ` · ${lateCount} ${lateCount === 1 ? 'va' : 'van'} tarde` : ''}.`
        : 'Todo lo que está en el taller, por estado.'
      : listTotal !== null
        ? `${assignee.mine ? plural(listTotal, 'orden asignada a ti', 'órdenes asignadas a ti') : plural(listTotal, 'orden', 'órdenes')} con estos filtros.`
        : 'Busca y filtra todas las órdenes, también las entregadas.'

  const createAction = canOperate && (
    <ButtonLink to={`${ctx.base}/ordenes/nueva`} variant="primary" icon={<Plus aria-hidden />}>
      Nueva orden
    </ButtonLink>
  )

  return (
    <>
      <PageHeader title="Órdenes de trabajo" description={description} actions={createAction} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchInput
          value={term}
          onValueChange={setTerm}
          aria-label="Buscar por número, título, matrícula o cliente"
          placeholder="Número, matrícula o cliente…"
          className="min-w-0 flex-1 md:order-2 md:max-w-80"
        />
        <Button
          size="sm"
          aria-expanded={filtersOpen}
          aria-controls="filtros-ordenes"
          onClick={() => setFiltersOpen((o) => !o)}
          iconRight={<ChevronDown aria-hidden className={cn('transition-transform duration-150 motion-reduce:transition-none', filtersOpen && 'rotate-180')} />}
          className="h-11 md:hidden"
        >
          Filtros{activeFilters ? <span className="tabular text-fg-muted">({activeFilters})</span> : null}
        </Button>
        <div id="filtros-ordenes" className={cn('w-full flex-wrap items-center gap-2 md:contents', filtersOpen ? 'flex' : 'hidden')}>
          <SegmentedControl
            label="Vista"
            value={view}
            onValueChange={changeView}
            className="md:order-1"
            options={[
              { value: 'tablero', label: 'Tablero', icon: <SquareKanban aria-hidden /> },
              { value: 'lista', label: 'Lista', icon: <List aria-hidden /> },
            ]}
          />
          <Button
            size="sm"
            aria-pressed={assignee.mine}
            disabled={!user}
            onClick={() => chooseAssignee(assignee.mine ? 'all' : 'mine')}
            icon={assignee.mine ? <Check aria-hidden /> : <UserRound aria-hidden />}
            className={cn('h-11 md:order-3 md:ml-auto md:h-10', assignee.mine && 'border-accent/60 bg-accent-soft text-fg')}
          >
            Mis órdenes
          </Button>
          {canManage && (
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-fg-muted sm:flex-none md:order-4">
              <span className="shrink-0">Mecánico</span>
              <Select
                value={assignee.assignedTo !== null ? String(assignee.assignedTo) : ''}
                onChange={(e) => chooseAssignee(e.target.value ? Number(e.target.value) : 'all')}
                className="sm:w-40"
                disabled={!members.data}
              >
                <option value="">Todos</option>
                {members.data?.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.id === user?.id ? `${m.user.name} (tú)` : m.user.name}
                  </option>
                ))}
                {assignee.assignedTo !== null && members.data && !members.data.some((m) => m.user.id === assignee.assignedTo) && (
                  <option value={assignee.assignedTo}>Ya no está en el equipo</option>
                )}
              </Select>
            </label>
          )}
          {view === 'lista' ? (
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-fg-muted sm:flex-none md:order-5">
              <span className="shrink-0">Estado</span>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40">
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
              className={cn('h-11 md:order-5 md:h-10', onlyLate && 'border-danger/60 bg-danger-soft text-fg')}
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
          ) : assignee.mine ? (
            <MineEmpty onShowAll={() => chooseAssignee('all')} />
          ) : (
            <EmptyState
              icon={<ClipboardList />}
              title="No hay órdenes abiertas"
              description="Cuando entre un coche, ábrele una orden: aparecerá aquí en «Recibido» y podrás llevarla por el tablero hasta la entrega."
              action={
                <>
                  {createAction}
                  <Button
                    onClick={() => {
                      writeStorage(STORAGE_KEYS.ordersView, 'lista')
                      patchParams({ vista: 'lista', estado: 'all' })
                    }}
                  >
                    Ver las órdenes cerradas
                  </Button>
                </>
              }
            />
          )
        ) : (
          <>
            <p className="sr-only">Cada tarjeta tiene un botón «Mover a…» para cambiarla de columna. Entregar y cancelar piden confirmación.</p>
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
        ) : assignee.mine ? (
          <MineEmpty onShowAll={() => chooseAssignee('all')} />
        ) : (
          <EmptyState
            icon={<ClipboardList />}
            title="No hay órdenes abiertas"
            description="Las órdenes entregadas y canceladas siguen disponibles."
            action={
              <>
                {createAction}
                <Button onClick={() => setStatus('all')}>Ver las órdenes cerradas</Button>
              </>
            }
          />
        )
      ) : (
        <>
          <OrdersTable
            orders={listOrders}
            orderHref={orderHref}
            vehicleHref={vehicleHref}
            onRequest={onRequest}
            showTotal={showTotal}
            caption={`Órdenes de trabajo${assignee.mine ? ' asignadas a ti' : ''} (${STATUS_FILTERS.find((s) => s.value === status)?.label.toLowerCase()})`}
            groupByStatus={status === 'open' && !list.hasNextPage}
          />
          <LoadMore hasNextPage={!!list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={list.fetchNextPage} shown={listOrders.length} total={listTotal} what="órdenes" />
        </>
      )}
      {actions.dialogs}
    </>
  )
}

function MineEmpty({ onShowAll }: { onShowAll: () => void }) {
  return (
    <EmptyState
      icon={<UserRound />}
      title="No tienes órdenes abiertas asignadas"
      description="Cuando te asignen una orden, aparecerá aquí."
      action={<Button onClick={onShowAll}>Ver las órdenes de todos</Button>}
    />
  )
}

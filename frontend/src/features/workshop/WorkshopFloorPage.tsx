import { Plus, SquareKanban, Warehouse } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LIVE_REFRESH_MS, useBays, useOpenWorkOrders } from '@/api/hooks/workshop'
import { ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { useWebGLAvailable, WorkshopScene, type WorkshopSceneProps } from '@/three'
import { FleetTable } from './components/FleetTable'
import { FloorDetail, FloorDetailSkeleton } from './components/FloorPanel'
import { FloorStats } from './components/FloorStats'
import { FLOOR_DETAIL_TITLE_ID, resolveSelection, selectionAnnouncement, useFloorSelection } from './components/floor'
import { effectiveFilter, FLEET_TITLE_ID, fleetRowId, fleetRows, fleetSummary, floorCounts, type FloorFilter } from './components/floorFleet'
import { waitingOrders } from './components/orderUtils'
import { useOrderActions } from './components/useOrderActions'
import { useBoxSize, useMediaQuery } from './components/useFloorLayout'
import './floor.css'

/** Px de lienzo que tapan los paneles flotantes: la escena enfoca el coche elegido en la parte que queda a la vista. */
type FocusInset = NonNullable<WorkshopSceneProps['focusInset']>

/** Separación de los paneles flotantes respecto al borde del lienzo (px): 12 en tableta, 16 en escritorio. */
const GAP_MD = 12
const GAP_XL = 16
const DETAIL_WIDTH = 380

const LIST_KEY = 'carcare.taller.lista'

function readListOpen(): boolean {
  try {
    return window.localStorage.getItem(LIST_KEY) !== 'cerrada'
  } catch {
    return true
  }
}

/**
 * Taller 3D: la maqueta isométrica a sangre y, flotando encima, las cifras del taller (filtran la lista), la flota en
 * el taller (plegable; es la alternativa HTML de la escena) y la ficha de lo elegido. La selección vive en la URL
 * (`?elevador=` / `?orden=`) y la escena enfoca el coche teniendo en cuenta lo que tapan los paneles (`focusInset`).
 * A 768 px la ficha es una hoja inferior; por debajo (o sin WebGL) todo se apila bajo la escena, sin nada encima.
 * Se actualiza cada minuto; los cambios hechos aquí se ven al momento.
 */
export default function WorkshopFloorPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Taller')
  const bays = useBays(ctx.id, ctx.isWorkshop, LIVE_REFRESH_MS)
  const open = useOpenWorkOrders(ctx.id, {}, LIVE_REFRESH_MS)
  const selection = useFloorSelection()
  const actions = useOrderActions()
  const canOperate = ctx.can('operate')

  const webgl = useWebGLAvailable()
  const md = useMediaQuery('(min-width: 768px)')
  const wide = useMediaQuery('(min-width: 1280px)')
  const floating = md && webgl
  const gap = wide ? GAP_XL : GAP_MD

  const [filter, setFilter] = useState<FloorFilter>('all')
  const [listOpen, setListOpenState] = useState(readListOpen)
  const setListOpen = useCallback((v: boolean) => {
    setListOpenState(v)
    try {
      window.localStorage.setItem(LIST_KEY, v ? 'abierta' : 'cerrada')
    } catch {
      /* sin almacenamiento: solo dura la visita */
    }
  }, [])

  const [topRef, top] = useBoxSize()
  const [tableRef, table] = useBoxSize()
  const [detailBoxRef, detail] = useBoxSize()
  const detailRef = useRef<HTMLElement | null>(null)
  const setDetailEl = useCallback(
    (el: HTMLElement | null) => {
      detailRef.current = el
      const cleanup = detailBoxRef(el)
      return () => {
        detailRef.current = null
        cleanup?.()
      }
    },
    [detailBoxRef],
  )

  const orders = useMemo(() => open.data?.data ?? [], [open.data])
  const bayList = useMemo(() => bays.data ?? [], [bays.data])
  const resolved = resolveSelection(selection, bayList, orders)
  const detailOpen = !!resolved.order || (resolved.freeBay && !!resolved.bay)
  const counts = bays.data ? floorCounts(bayList, open.data ? orders : undefined) : null
  const activeFilter = counts ? effectiveFilter(filter, counts) : filter
  const rows = fleetRows(orders, activeFilter)
  const selectedOrderId = resolved.order?.id ?? null
  const selectionKey = `${selection.bay ?? ''}-${selection.orderId ?? ''}`

  const { select } = selection
  const onSelectBay = useCallback((n: number | null) => select(n ? { bay: n } : null), [select])
  const onSelectOrder = useCallback((id: number) => select({ orderId: id }), [select])

  // Cerrar la ficha: quita la selección y, si el foco estaba en la ficha, lo devuelve a la fila de la lista (o a su título).
  const closeDetail = useCallback(() => {
    const panel = detailRef.current
    const active = document.activeElement
    const focusWasInPanel = !!panel && (panel.contains(active) || active === document.body)
    select(null)
    if (!focusWasInPanel) return
    requestAnimationFrame(() => {
      const row = selectedOrderId ? document.getElementById(fleetRowId(selectedOrderId)) : null
      const target = row && row.offsetParent !== null ? row : document.getElementById(FLEET_TITLE_ID)
      target?.focus({ preventScroll: floating })
    })
  }, [select, selectedOrderId, floating])

  // Escape cierra la ficha, salvo si lo está usando un diálogo o un menú abierto (Radix lo gestiona).
  useEffect(() => {
    if (!detailOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target instanceof Element ? e.target : null
      if (t?.closest('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]')) return
      if (document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[role="menu"][data-state="open"]')) return
      closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailOpen, closeDetail])

  // Apilado (móvil o sin WebGL), la ficha va bajo la lista: al elegir algo, se acerca a la vista.
  const lastKey = useRef(selectionKey)
  useEffect(() => {
    if (lastKey.current === selectionKey) return
    lastKey.current = selectionKey
    if (floating || !detailOpen) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    detailRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [selectionKey, floating, detailOpen])

  const sheet = floating && !wide
  const focusInset = useMemo<FocusInset | undefined>(() => {
    if (!floating) return undefined
    const bottomCover = detailOpen && sheet ? detail.height : table.height
    return {
      top: top.height ? top.height + gap : 0,
      bottom: bottomCover ? bottomCover + gap : 0,
      right: detailOpen && !sheet && detail.width ? detail.width + gap : 0,
    }
  }, [floating, detailOpen, sheet, detail.height, detail.width, table.height, top.height, gap])

  if (!ctx.isWorkshop)
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState icon={<Warehouse />} title="El taller 3D es del modo taller" description="Cambia a un espacio de taller para ver sus elevadores." />
      </div>
    )

  const summary = counts ? fleetSummary(counts) : 'Cargando elevadores…'
  const newOrderHref = `${ctx.base}/ordenes/nueva${resolved.freeBay && resolved.bay ? `?elevador=${resolved.bay}` : ''}`

  const header = (
    <div className={cn('pointer-events-auto min-w-0', floating ? 'floor-glass px-4 py-3' : 'px-4 pt-4 sm:px-6')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-xl font-semibold text-fg-warm md:text-2xl">Taller</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink to={`${ctx.base}/ordenes`} size="sm" icon={<SquareKanban aria-hidden />}>
            Tablero
          </ButtonLink>
          {canOperate && (
            <ButtonLink to={newOrderHref} size="sm" variant="primary" icon={<Plus aria-hidden />}>
              Nueva orden
            </ButtonLink>
          )}
        </div>
      </div>
      {/* Las cifras ya se ven en las tarjetas; el resumen queda en frase para el lector de pantalla, que oye sus cambios. */}
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>
      <p className="mt-1 text-sm text-fg-muted">{counts ? 'Se actualiza cada minuto.' : 'Cargando elevadores…'}</p>
    </div>
  )

  if (bays.isError)
    return (
      <div className="flex flex-col gap-4 pb-8">
        {header}
        <div className="px-4 sm:px-6 lg:px-8">
          <ErrorState error={bays.error} onRetry={() => void bays.refetch()} />
        </div>
      </div>
    )

  const stats = (
    <FloorStats
      counts={counts}
      ordersPending={open.isPending}
      ordersFailed={open.isError}
      filter={activeFilter}
      onFilter={(f) => {
        setFilter(f)
        if (!listOpen) setListOpen(true)
      }}
      floating={floating}
      className={cn('pointer-events-auto', floating ? 'min-w-0 flex-1 basis-[30rem] md:max-w-max' : 'mx-4 sm:mx-6')}
    />
  )

  const sceneProps: WorkshopSceneProps = {
    bays: bayList,
    waiting: waitingOrders(orders),
    selectedBay: resolved.bay,
    selectedOrderId,
    onSelectBay,
    onSelectOrder,
    focusInset,
    className: 'absolute inset-0 h-full w-full',
  }

  const scene = (
    <div className={cn('relative min-w-0 overflow-hidden', floating ? 'absolute inset-0' : 'h-[45dvh] min-h-[260px] border-y border-line bg-surface-2')}>
      {bays.isPending ? <Skeleton className="absolute inset-0 rounded-none" /> : <WorkshopScene {...sceneProps} />}
    </div>
  )

  // Flotando, la lista se aparta de la ficha en escritorio; en tableta la hoja la cubre.
  const fleet = (
    <FleetTable
      boxRef={floating ? tableRef : undefined}
      style={floating ? { left: gap, bottom: gap, right: detailOpen && !sheet ? DETAIL_WIDTH + gap * 2 : gap } : undefined}
      rows={rows}
      total={orders.length}
      filter={activeFilter}
      onClearFilter={() => setFilter('all')}
      loading={open.isPending}
      error={open.isError ? open.error : null}
      onRetry={() => void open.refetch()}
      selectedOrderId={selectedOrderId}
      onSelect={onSelectOrder}
      open={listOpen}
      onOpenChange={setListOpen}
      newOrderHref={canOperate ? `${ctx.base}/ordenes/nueva` : null}
      floating={floating}
      bodyClassName={floating ? (wide ? 'max-h-[min(30dvh,15rem)]' : 'max-h-[min(26dvh,13rem)]') : undefined}
      className={cn('pointer-events-auto', floating ? 'absolute z-10' : 'mx-4 sm:mx-6')}
    />
  )

  const detailPanel = detailOpen && (
    <aside
      ref={setDetailEl}
      aria-labelledby={FLOOR_DETAIL_TITLE_ID}
      className={cn(
        'pointer-events-auto min-w-0 overscroll-contain p-4',
        floating ? 'floor-glass absolute z-20 overflow-y-auto' : 'list-panel mx-4 mb-0 scroll-mt-20 sm:mx-6',
        floating && (sheet ? 'floor-drawer-up max-h-[50%]' : 'floor-drawer-right'),
      )}
      style={
        floating
          ? sheet
            ? { left: gap, right: gap, bottom: gap }
            : { right: gap, top: (top.height || 96) + gap * 2, bottom: gap, width: DETAIL_WIDTH }
          : undefined
      }
    >
      {bays.isPending ? (
        <FloorDetailSkeleton />
      ) : (
        <FloorDetail bays={bayList} orders={orders} ordersLoading={open.isPending} resolved={resolved} selection={selection} actions={actions} onClose={closeDetail} />
      )}
    </aside>
  )

  const announcement = <p className="sr-only" aria-live="polite">{selectionAnnouncement(resolved)}</p>

  if (!floating)
    return (
      <div className="flex flex-col gap-4 pb-8">
        {header}
        {stats}
        {scene}
        {fleet}
        {detailPanel}
        {announcement}
        {actions.dialogs}
      </div>
    )

  return (
    <div className="relative h-[calc(100dvh-4rem-1px)] min-h-[520px] overflow-hidden bg-canvas">
      {/* Orden del DOM = orden de tabulación: cabecera y cifras → escena → lista → ficha. */}
      <div ref={topRef} className="pointer-events-none absolute z-10 flex flex-wrap items-start gap-3" style={{ left: gap, right: gap, top: gap }}>
        {header}
        {stats}
      </div>
      {scene}
      {fleet}
      {detailPanel}
      {announcement}
      {actions.dialogs}
    </div>
  )
}

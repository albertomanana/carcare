import { Plus, SquareKanban } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LIVE_REFRESH_MS, useBays, useOpenWorkOrders, useWorkshopDashboard } from '@/api/hooks/workshop'
import { CanvasBleed } from '@/components/layout/CanvasBleed'
import { ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useAuth } from '@/features/auth/auth-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useHiddenGuide } from '@/hooks/useHiddenGuide'
import { cn } from '@/lib/cn'
import { workshopFirstSteps } from '@/lib/firstSteps'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { useWebGLAvailable, WorkshopScene, type WorkshopSceneProps } from '@/three'
import { FleetTable } from './components/FleetTable'
import { FloorDetail, FloorDetailSkeleton } from './components/FloorPanel'
import { FloorStats } from './components/FloorStats'
import { FLOOR_DETAIL_TITLE_ID, resolveSelection, selectionAnnouncement, useFloorSelection } from './components/floor'
import { effectiveFilter, FLEET_TITLE_ID, fleetRowId, fleetRows, fleetSummary, floorCounts, type FloorFilter } from './components/floorFleet'
import { MissionsPanel } from './components/MissionsPanel'
import { homeMissions } from './components/homeMissions'
import { WorkshopFirstSteps } from './components/WorkshopFirstSteps'
import { waitingOrders } from './components/orderUtils'
import { useOrderActions } from './components/useOrderActions'
import { useBoxSize, useMediaQuery } from './components/useFloorLayout'
import './floor.css'

/** Px de lienzo que tapan los paneles flotantes: la escena enfoca el coche elegido en la parte que queda a la vista. */
type FocusInset = NonNullable<WorkshopSceneProps['focusInset']>

/** Separación entre los paneles flotantes y ancho de la columna lateral (ficha, misiones o primeros pasos). */
const GAP = 12
const SLOT_WIDTH = 360
/** Lo que reserva `.canvas-hud` en md+ (px): cabecera flotante (5,25 rem), margen derecho (1,5 rem) e inferior (2 rem). */
const HUD_PAD = { top: 84, right: 24, bottom: 32 }

const LIST_KEY = 'carcare.taller.lista'

function readListOpen(): boolean {
  try {
    return window.localStorage.getItem(LIST_KEY) !== 'cerrada'
  } catch {
    return true
  }
}

/**
 * Portada del taller («Taller»): la maqueta isométrica a pantalla completa y, flotando encima como el HUD de un juego,
 * las cifras del taller (filtran la lista), la flota en el taller (plegable; es la alternativa HTML de la escena), la
 * ficha de lo elegido y, sin nada elegido, las «misiones» (lo que pide atención, con datos reales) o los primeros pasos
 * de un taller recién creado. La selección vive en la URL (`?elevador=` / `?orden=`) y la escena enfoca el coche
 * teniendo en cuenta lo que tapan los paneles (`focusInset`). Desde 768 px la maqueta va a sangre (a 768 la ficha es una
 * hoja inferior); por debajo, o sin WebGL, todo se apila bajo la escena. Se actualiza cada minuto.
 */
export default function WorkshopFloorPage() {
  const ctx = useWorkspace()
  const { user } = useAuth()
  useDocumentTitle('Taller')
  const bays = useBays(ctx.id, ctx.isWorkshop, LIVE_REFRESH_MS)
  const open = useOpenWorkOrders(ctx.id, {}, LIVE_REFRESH_MS)
  const dashboard = useWorkshopDashboard(ctx.id)
  const selection = useFloorSelection()
  const actions = useOrderActions()
  const canOperate = ctx.can('operate')
  const isMechanic = ctx.workspace.role === 'mechanic'

  const webgl = useWebGLAvailable()
  const md = useMediaQuery('(min-width: 768px)')
  const wide = useMediaQuery('(min-width: 1280px)')
  const floating = md && webgl

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

  // Primeros pasos de un taller recién creado (los ve quien puede gestionar el taller)
  const { hidden, hide } = useHiddenGuide(String(ctx.id))
  const [baysConfirmed, setBaysConfirmed] = useState(() => readStorage(STORAGE_KEYS.baysConfirmed(ctx.id)) === '1')
  const data = dashboard.data ?? null
  const guide = data && ctx.can('manage') && !hidden ? workshopFirstSteps(data, baysConfirmed) : null
  const confirmBays = () => {
    writeStorage(STORAGE_KEYS.baysConfirmed(ctx.id), '1')
    setBaysConfirmed(true)
  }

  const [topRef, top] = useBoxSize()
  const [tableRef, table] = useBoxSize()
  const [slotBoxRef, slot] = useBoxSize()
  const detailRef = useRef<HTMLElement | null>(null)
  const setSlotEl = useCallback(
    (el: HTMLElement | null) => {
      detailRef.current = el
      const cleanup = slotBoxRef(el)
      return () => {
        detailRef.current = null
        cleanup?.()
      }
    },
    [slotBoxRef],
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

  const missions = useMemo(
    () => homeMissions({ orders: open.data ? orders : undefined, bays: bayList, dashboard: data, mechanicId: isMechanic && user ? user.id : null }),
    [open.data, orders, bayList, data, isMechanic, user],
  )
  // Sin órdenes abiertas ni alertas, «Misiones» no tiene nada que decir (el estado vacío de la lista ya invita a abrir la primera orden).
  const showMissions = !guide && !detailOpen && (open.isPending || missions.length > 0)

  const { select } = selection
  const onSelectBay = useCallback((n: number | null) => select(n ? { bay: n } : null), [select])
  const onSelectOrder = useCallback((id: number) => select({ orderId: id }), [select])
  const applyFilter = useCallback(
    (f: FloorFilter) => {
      setFilter(f)
      setListOpen(true)
    },
    [setListOpen],
  )

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

  // Qué ocupa la columna lateral: la ficha (hoja inferior en tableta), los primeros pasos o las misiones (solo en escritorio).
  const sheet = floating && !wide && detailOpen
  const sideContent: 'detail' | 'guide' | 'missions' | null = detailOpen ? 'detail' : guide ? 'guide' : showMissions && wide ? 'missions' : null
  const side = floating && sideContent !== null && !sheet

  const focusInset = useMemo<FocusInset | undefined>(() => {
    if (!floating) return undefined
    const bottomCover = sheet ? slot.height : table.height
    return {
      top: HUD_PAD.top + (top.height ? top.height + GAP : 0),
      bottom: HUD_PAD.bottom + (bottomCover ? bottomCover + GAP : 0),
      right: HUD_PAD.right + (side && wide ? SLOT_WIDTH + GAP : 0),
    }
  }, [floating, sheet, side, wide, slot.height, table.height, top.height])

  const summary = counts ? fleetSummary(counts) : 'Cargando elevadores…'
  const newOrderHref = `${ctx.base}/ordenes/nueva${resolved.freeBay && resolved.bay ? `?elevador=${resolved.bay}` : ''}`

  const header = (
    <div className={cn('hud-bar pointer-events-auto min-w-0 px-4 py-3', !floating && 'w-full')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-xl font-bold text-fg-warm md:text-2xl">Taller</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink to={`${ctx.base}/ordenes`} size="sm" icon={<SquareKanban aria-hidden />}>
            Tablero
          </ButtonLink>
          {canOperate && !guide && (
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
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState error={bays.error} onRetry={() => void bays.refetch()} />
      </div>
    )

  const stats = (
    <FloorStats
      counts={counts}
      ordersPending={open.isPending}
      ordersFailed={open.isError}
      filter={activeFilter}
      onFilter={applyFilter}
      floating={floating}
      className={cn('pointer-events-auto', floating && 'min-w-0 flex-1 basis-[30rem] md:max-w-max')}
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
  const sceneNode = bays.isPending ? <Skeleton className="absolute inset-0 rounded-none" /> : <WorkshopScene {...sceneProps} />

  const fleet = (
    <FleetTable
      boxRef={floating ? tableRef : undefined}
      style={floating ? { left: 0, bottom: 0, right: side && wide ? SLOT_WIDTH + GAP : 0 } : undefined}
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
      bodyClassName={floating ? (wide ? 'max-h-[min(30dvh,15rem)]' : 'max-h-[min(26dvh,13rem)]') : undefined}
      className={cn('pointer-events-auto', floating && 'absolute z-10')}
    />
  )

  const firstSteps = guide && data && <WorkshopFirstSteps data={data} steps={guide} onHide={hide} onConfirmBays={confirmBays} />
  const missionsPanel = (
    <MissionsPanel missions={missions} loading={open.isPending} base={ctx.base} onSelectOrder={onSelectOrder} onFilter={applyFilter} />
  )

  // La columna lateral: sobre la maqueta, a la derecha (o hoja inferior con la ficha en tableta); apilada, en el flujo.
  const slotStyle: CSSProperties | undefined = floating
    ? sheet
      ? { left: 0, right: 0, bottom: 0 }
      : {
          right: 0,
          top: (top.height || 96) + GAP,
          width: wide ? SLOT_WIDTH : 340,
          maxHeight: `calc(100% - ${(top.height || 96) + GAP}px${wide ? '' : ` - ${table.height + GAP}px`})`,
        }
    : undefined

  const slotPanel =
    sideContent === 'detail' || (!floating && detailOpen) ? (
      <aside
        ref={setSlotEl}
        aria-labelledby={FLOOR_DETAIL_TITLE_ID}
        className={cn(
          'pointer-events-auto min-w-0 overscroll-contain p-4',
          floating ? 'hud-panel absolute z-20 overflow-y-auto' : 'hud-panel scroll-mt-20',
          floating && (sheet ? 'floor-drawer-up max-h-[50%]' : 'floor-drawer-right'),
        )}
        style={slotStyle}
      >
        {bays.isPending ? (
          <FloorDetailSkeleton />
        ) : (
          <FloorDetail bays={bayList} orders={orders} ordersLoading={open.isPending} resolved={resolved} selection={selection} actions={actions} onClose={closeDetail} />
        )}
      </aside>
    ) : floating && sideContent === 'guide' ? (
      <div className="hud-panel pointer-events-auto absolute z-20 overflow-y-auto overscroll-contain p-4 floor-drawer-right" style={slotStyle}>
        {firstSteps}
      </div>
    ) : floating && sideContent === 'missions' ? (
      <div className="hud-panel pointer-events-auto absolute z-20 flex flex-col overflow-hidden p-4 floor-drawer-right" style={slotStyle}>
        {missionsPanel}
      </div>
    ) : null

  const announcement = <p className="sr-only" aria-live="polite">{selectionAnnouncement(resolved)}</p>

  if (!floating)
    return (
      <div className="flex flex-col gap-4">
        {header}
        {stats}
        {guide && <div className="hud-panel p-4">{firstSteps}</div>}
        <div className="relative -mx-4 h-[45dvh] min-h-[260px] overflow-hidden bg-canvas sm:-mx-6">{sceneNode}</div>
        {!guide && showMissions && <div className="hud-panel p-4">{missionsPanel}</div>}
        {fleet}
        {slotPanel}
        {announcement}
        {actions.dialogs}
      </div>
    )

  return (
    <CanvasBleed scene={<div className="absolute inset-y-0 right-0 left-[var(--shell-left)]">{sceneNode}</div>}>
      {/* Orden del DOM = orden de tabulación: cabecera y cifras → escena → lista → columna lateral. */}
      <div className="relative h-[calc(100dvh-7.25rem)] min-h-[28rem]">
        <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-3">
          {header}
          {stats}
        </div>
        {fleet}
        {slotPanel}
      </div>
      {announcement}
      {actions.dialogs}
    </CanvasBleed>
  )
}

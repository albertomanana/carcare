import { type MouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { TONE_CLASSES, WORK_ORDER_STATUS } from '@/lib/status'
import { OrderCard } from './OrderCard'
import { KANBAN_STATUSES } from './orderUtils'

interface DragSession {
  id: number
  status: WorkOrderStatus
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  width: number
  active: boolean
  cancelled: boolean
}

interface DragView {
  id: number
  x: number
  y: number
  width: number
  over: WorkOrderStatus | null
}

function columnAt(x: number, y: number): WorkOrderStatus | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-kanban-column]')
  return (el?.dataset.kanbanColumn as WorkOrderStatus | undefined) ?? null
}

/** Desplaza el tablero (horizontal) y la página (vertical) al acercar el puntero a los bordes. */
function autoScroll(board: HTMLElement | null, x: number, y: number) {
  const EDGE = 56
  const STEP = 16
  if (board && board.scrollWidth > board.clientWidth) {
    const r = board.getBoundingClientRect()
    if (x < r.left + EDGE) board.scrollLeft -= STEP
    else if (x > r.right - EDGE) board.scrollLeft += STEP
  }
  if (y < 64 + EDGE) window.scrollBy(0, -STEP)
  else if (y > window.innerHeight - EDGE - 24) window.scrollBy(0, STEP)
}

/**
 * Arrastrar y soltar con Pointer Events (ratón, táctil y lápiz con el mismo código).
 * Umbral de 6 px para distinguir clic de arrastre; Escape cancela; tras soltar se anula el clic del enlace.
 */
function useKanbanDrag(onDrop: (id: number, status: WorkOrderStatus) => void) {
  const session = useRef<DragSession | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const suppressClick = useRef(false)
  const dropRef = useRef(onDrop)
  const [view, setView] = useState<DragView | null>(null)

  useEffect(() => {
    dropRef.current = onDrop
  })

  useEffect(() => {
    const body = document.body
    const end = () => {
      session.current = null
      setView(null)
      body.style.removeProperty('user-select')
      body.style.removeProperty('cursor')
    }
    const swallowNextClick = () => {
      suppressClick.current = true
      window.setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    const onMove = (e: PointerEvent) => {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId || s.cancelled) return
      if (!s.active) {
        if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < 6) return
        s.active = true
        body.style.userSelect = 'none'
        body.style.cursor = 'grabbing'
      }
      e.preventDefault()
      autoScroll(boardRef.current, e.clientX, e.clientY)
      setView({ id: s.id, x: e.clientX - s.offsetX, y: e.clientY - s.offsetY, width: s.width, over: columnAt(e.clientX, e.clientY) })
    }
    const onUp = (e: PointerEvent) => {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId) return
      if (s.active || s.cancelled) swallowNextClick()
      if (s.active && !s.cancelled) {
        const over = columnAt(e.clientX, e.clientY)
        if (over && over !== s.status) dropRef.current(s.id, over)
      }
      end()
    }
    const onCancel = (e: PointerEvent) => {
      if (session.current?.pointerId === e.pointerId) end()
    }
    const onKey = (e: KeyboardEvent) => {
      const s = session.current
      if (e.key === 'Escape' && s?.active) {
        s.cancelled = true
        s.active = false
        setView(null)
        body.style.removeProperty('user-select')
        body.style.removeProperty('cursor')
      }
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      end()
    }
  }, [])

  const start = (e: ReactPointerEvent<HTMLElement>, order: WorkOrder) => {
    if (e.button !== 0 || session.current) return
    const target = e.target as HTMLElement
    if (target.closest('[data-no-drag]')) return
    const handle = !!target.closest('[data-drag-handle]')
    if (e.pointerType !== 'mouse' && !handle) return
    const rect = e.currentTarget.getBoundingClientRect()
    session.current = {
      id: order.id,
      status: order.status,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      active: false,
      cancelled: false,
    }
    if (handle) e.preventDefault()
  }

  const onClickCapture = (e: MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return { view, start, boardRef, onClickCapture }
}

export interface KanbanBoardProps {
  orders: WorkOrder[]
  orderHref: (order: WorkOrder) => string
  onRequest: (order: WorkOrder, status: WorkOrderStatus) => void
  busyId?: number | null
}

/** Tablero kanban de órdenes abiertas: una columna por estado (entregadas y canceladas van en la vista de lista). */
export function KanbanBoard({ orders, orderHref, onRequest, busyId }: KanbanBoardProps) {
  const byStatus = useMemo(() => {
    const map = new Map<WorkOrderStatus, WorkOrder[]>(KANBAN_STATUSES.map((s) => [s, []]))
    for (const o of orders) map.get(o.status)?.push(o)
    return map
  }, [orders])

  const { view, start, boardRef, onClickCapture } = useKanbanDrag((id, status) => {
    const order = orders.find((o) => o.id === id)
    if (order) onRequest(order, status)
  })
  const dragOrder = view ? orders.find((o) => o.id === view.id) : undefined

  return (
    <>
      <div
        ref={boardRef}
        onClickCapture={onClickCapture}
        className={cn(
          'scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:mx-0 xl:overflow-visible xl:px-0',
          view ? 'snap-none' : 'snap-x snap-mandatory',
        )}
      >
        {KANBAN_STATUSES.map((status) => {
          const list = byStatus.get(status) ?? []
          const st = WORK_ORDER_STATUS[status]
          const Icon = st.icon
          const over = view?.over === status
          const headingId = `kanban-${status}`
          return (
            <section
              key={status}
              aria-labelledby={headingId}
              data-kanban-column={status}
              className={cn(
                'flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-card border bg-surface-2/40 transition-colors duration-150 sm:w-[268px]',
                'xl:w-auto xl:min-w-0 xl:max-w-none xl:flex-1 xl:basis-0',
                over ? 'border-accent bg-accent-soft' : 'border-line',
              )}
            >
              <header className="flex items-center gap-2 px-3 pb-2 pt-3">
                <span aria-hidden className={cn('grid size-6 shrink-0 place-items-center rounded-full [&_svg]:size-3.5', TONE_CLASSES[st.tone].soft)}>
                  <Icon />
                </span>
                <h2 id={headingId} className="min-w-0 truncate text-sm font-semibold text-fg">
                  {st.label}
                  <span className="sr-only">, {list.length === 1 ? '1 orden' : `${list.length} órdenes`}</span>
                </h2>
                <span aria-hidden className="ml-auto rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-fg-muted tabular">
                  {list.length}
                </span>
              </header>
              <ol className="flex min-h-28 flex-1 flex-col gap-2 px-2 pb-2">
                {list.map((o) => (
                  <li key={o.id}>
                    <OrderCard
                      order={o}
                      to={orderHref(o)}
                      onRequest={onRequest}
                      busy={busyId === o.id}
                      dragging={view?.id === o.id}
                      onPointerDown={(e) => start(e, o)}
                    />
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="grid flex-1 place-items-center rounded-control border border-dashed border-line px-3 py-6 text-center text-xs text-fg-subtle">
                    {view ? 'Suelta aquí' : 'Sin órdenes'}
                  </li>
                )}
              </ol>
            </section>
          )
        })}
      </div>

      {view &&
        dragOrder &&
        createPortal(
          <div inert aria-hidden className="pointer-events-none fixed z-[80]" style={{ left: view.x, top: view.y, width: view.width }}>
            <OrderCard order={dragOrder} to={orderHref(dragOrder)} onRequest={onRequest} ghost />
          </div>,
          document.body,
        )}
    </>
  )
}

export function KanbanSkeleton() {
  return (
    <div role="status" aria-live="polite" className="-mx-4 flex gap-3 overflow-hidden px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:mx-0 xl:px-0">
      <span className="sr-only">Cargando tablero…</span>
      {KANBAN_STATUSES.map((s, i) => (
        <div key={s} aria-hidden className="flex w-[82vw] max-w-[300px] shrink-0 flex-col gap-2 rounded-card border border-line bg-surface-2/40 p-2 sm:w-[268px] xl:w-auto xl:max-w-none xl:flex-1 xl:basis-0">
          <Skeleton className="m-1 h-5 w-28" />
          {Array.from({ length: 3 - (i % 2) }, (_, j) => (
            <Skeleton key={j} className="h-36 w-full rounded-card" />
          ))}
        </div>
      ))}
    </div>
  )
}

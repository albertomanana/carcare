import { ChevronDown, Plus, Truck, X } from 'lucide-react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import type { WorkOrder } from '@/api/types'
import { Plate } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { VehicleSwatch } from '@/components/vehicles/VehicleVisuals'
import { cn } from '@/lib/cn'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { FILTER_LABEL, FLEET_TITLE_ID, filterCaption, fleetRowId, type FloorFilter } from './floorFleet'
import { LateBadge, PriorityBadge, PromisedAt } from './OrderBadges'

const BODY_ID = 'floor-fleet-body'

export interface FleetTableProps {
  rows: WorkOrder[]
  /** Órdenes abiertas sin filtrar (para distinguir «taller vacío» de «nada con este filtro»). */
  total: number
  filter: FloorFilter
  onClearFilter: () => void
  loading: boolean
  error: unknown
  onRetry: () => void
  selectedOrderId: number | null
  onSelect: (orderId: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ruta de «Nueva orden» si el rol puede crearla (estado vacío). */
  newOrderHref: string | null
  /** Alto máximo del cuerpo plegable cuando flota sobre la maqueta. */
  bodyClassName?: string
  className?: string
  style?: CSSProperties
  /** Para medir lo que tapa la lista flotante (focusInset de la escena). */
  boxRef?: Ref<HTMLElement>
}

/**
 * Flota en el taller: una fila por orden abierta, filtrable por las tarjetas de cifras. Clic o Enter en una fila elige
 * el coche (la maqueta lo enfoca y se abre su ficha). Es también la alternativa HTML de la escena: con teclado se hace
 * todo sin el 3D. Las columnas secundarias se esconden por consulta de contenedor, nunca con desplazamiento lateral.
 */
export function FleetTable({
  rows,
  total,
  filter,
  onClearFilter,
  loading,
  error,
  onRetry,
  selectedOrderId,
  onSelect,
  open,
  onOpenChange,
  newOrderHref,
  bodyClassName,
  className,
  style,
  boxRef,
}: FleetTableProps) {
  const caption = loading ? 'Cargando coches…' : error ? 'No se pudo cargar la lista' : filterCaption(filter, rows.length)

  let body: ReactNode
  if (loading) {
    body = (
      <div role="status" className="space-y-2 p-3">
        <span className="sr-only">Cargando coches del taller…</span>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  } else if (error) {
    body = <ErrorState compact error={error} title="No se pudo cargar la lista de coches" onRetry={onRetry} className="m-3" />
  } else if (total === 0) {
    body = (
      <EmptyState
        compact
        icon={<Truck />}
        title="No hay coches en el taller"
        description="Cuando abras una orden, su coche aparecerá aquí y en la maqueta."
        action={
          newOrderHref && (
            <ButtonLink to={newOrderHref} size="sm" icon={<Plus aria-hidden />}>
              Nueva orden
            </ButtonLink>
          )
        }
        className="m-3"
      />
    )
  } else if (rows.length === 0) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-fg-muted">
        <p>Ningún coche en «{FILTER_LABEL[filter]}» ahora mismo.</p>
        <button type="button" onClick={onClearFilter} className="font-bold text-accent-ink hover:underline">
          Ver todos
        </button>
      </div>
    )
  } else {
    body = (
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">
          Coches en el taller: {caption}. Elige una fila para ver la ficha y enfocar el coche en la maqueta.
        </caption>
        <thead className="sticky top-0 z-[1] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] text-left backdrop-blur">
          <tr className="border-b border-line [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal">
            <th scope="col" className="hidden w-[6.5rem] @[44rem]:table-cell">
              <span className="tag-label text-fg-muted">Matrícula</span>
            </th>
            <th scope="col" className="w-auto">
              <span className="tag-label text-fg-muted">Vehículo</span>
            </th>
            <th scope="col" className="hidden w-[18%] @[52rem]:table-cell">
              <span className="tag-label text-fg-muted">Cliente</span>
            </th>
            <th scope="col" className="w-[9.5rem]">
              <span className="tag-label text-fg-muted">Estado</span>
            </th>
            <th scope="col" className="hidden w-[6.5rem] @[36rem]:table-cell">
              <span className="tag-label text-fg-muted">Elevador</span>
            </th>
            <th scope="col" className="hidden w-[16%] @[62rem]:table-cell">
              <span className="tag-label text-fg-muted">Mecánico</span>
            </th>
            <th scope="col" className="hidden w-[12rem] text-right @[28rem]:table-cell">
              <span className="tag-label text-fg-muted">Entrega</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <FleetRow key={o.id} order={o} selected={o.id === selectedOrderId} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <section ref={boxRef} style={style} aria-labelledby={FLEET_TITLE_ID} className={cn('@container flex min-h-0 min-w-0 flex-col', 'hud-panel overflow-hidden', className)}>
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
        <h2 id={FLEET_TITLE_ID} tabIndex={-1} className="font-display text-base font-bold text-fg-warm outline-none">
          Coches en el taller
        </h2>
        <p className="chip tabular">{caption}</p>
        {filter !== 'all' && !loading && !error && (
          <button
            type="button"
            onClick={onClearFilter}
            className="chip chip-accent min-h-8 hover:brightness-95"
          >
            <span>Filtro: {FILTER_LABEL[filter]}</span>
            <X aria-hidden className="size-3.5" />
            <span className="sr-only">. Quitar el filtro</span>
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={BODY_ID}
          onClick={() => onOpenChange(!open)}
          className="-mr-2 inline-flex min-h-12 items-center gap-1.5 rounded-control px-2 text-sm font-bold text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg lg:min-h-9"
        >
          {open ? 'Ocultar lista' : 'Mostrar lista'}
          <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200 ease-out-soft motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      </div>
      <div id={BODY_ID} hidden={!open} className={cn('min-h-0 overflow-y-auto border-t border-line', bodyClassName)}>
        {body}
      </div>
    </section>
  )
}

function FleetRow({ order: o, selected, onSelect }: { order: WorkOrder; selected: boolean; onSelect: (id: number) => void }) {
  const st = WORK_ORDER_STATUS[o.status]
  const StIcon = st.icon
  return (
    <tr
      // Clic en cualquier punto de la fila; con teclado, el botón de la celda del vehículo (Enter o espacio).
      onClick={() => onSelect(o.id)}
      className={cn(
        'cursor-pointer border-b border-line align-middle transition-colors duration-150 last:border-b-0 [&>td]:px-3 [&>td]:py-2',
        selected ? 'bg-accent-soft [box-shadow:inset_4px_0_0_var(--accent)]' : 'hover:bg-accent-soft/50',
      )}
    >
      <td className="hidden @[44rem]:table-cell">
        <Plate value={o.vehicle.plate} className="tabular text-xs text-fg-muted" />
        {!o.vehicle.plate && <span className="text-fg-subtle">Sin matrícula</span>}
      </td>
      <td className="min-w-0">
        <button
          id={fleetRowId(o.id)}
          type="button"
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(o.id)
          }}
          className="flex w-full min-w-0 items-center gap-2.5 rounded-control py-0.5 text-left"
        >
          <VehicleSwatch vehicle={o.vehicle} size="sm" className="size-7 rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg">
              <span className="sr-only">{o.number}, </span>
              {o.vehicle.display_name}
            </span>
            <span className="block truncate text-xs text-fg-muted">
              <span className="@[44rem]:hidden">{o.vehicle.plate ? <Plate value={o.vehicle.plate} className="text-[11px]" /> : 'Sin matrícula'} · </span>
              <span className="tabular">{o.number}</span>
            </span>
          </span>
        </button>
      </td>
      <td className="hidden truncate text-fg @[52rem]:table-cell">{o.customer?.name ?? <span className="text-fg-subtle">Sin cliente</span>}</td>
      <td>
        <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5 text-fg')}>
          <StIcon aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
          <span className="truncate">{st.label}</span>
        </span>
        {(o.is_late || o.priority === 'urgent') && (
          <span className="mt-1 flex flex-wrap gap-1">
            {o.is_late && <LateBadge />}
            {o.priority === 'urgent' && <PriorityBadge priority="urgent" />}
          </span>
        )}
      </td>
      <td className="hidden whitespace-nowrap @[36rem]:table-cell">
        {o.bay ? (
          <>
            Elevador <span className="tabular">{o.bay}</span>
          </>
        ) : (
          <span className="text-fg-muted">Sin elevador</span>
        )}
      </td>
      <td className="hidden truncate @[62rem]:table-cell">{o.assigned_to?.name ?? <span className="text-fg-subtle">Sin asignar</span>}</td>
      <td className="hidden whitespace-nowrap text-right @[28rem]:table-cell">{o.promised_at ? <PromisedAt order={o} className="justify-end" /> : <span className="text-fg-subtle">Sin fecha</span>}</td>
    </tr>
  )
}

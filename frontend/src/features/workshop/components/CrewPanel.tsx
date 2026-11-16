import { HardHat, Users, X } from 'lucide-react'
import { Link } from 'react-router'
import type { WorkOrder } from '@/api/types'
import { StatusPill } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { overallColor } from '@/lib/mechanic'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { crewStatusText, roleLabel, type CrewAssignment, type CrewPlacement } from '@/three'
import { FLOOR_DETAIL_TITLE_ID } from './floor'
import { LateBadge } from './OrderBadges'
import { shortOrderNumber } from './orderUtils'

/**
 * Equipo en la portada del taller: la ficha de una persona (lo que tiene asignado y dónde está su figura) y la lista
 * del equipo (alternativa HTML de las figuras de la maqueta). «Sin orden en curso» no significa «libre»: no hay
 * fichaje, solo se sabe que no tiene ninguna orden en diagnóstico o reparación en un elevador.
 */

function Swatch({ id, className }: { id: number; className?: string }) {
  return <span aria-hidden className={cn('shrink-0 rounded-full ring-1 ring-black/15', className)} style={{ backgroundColor: overallColor(id) }} />
}

const rowButton = 'flex w-full min-w-0 items-center gap-3 rounded-control px-1 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2'

/** Ficha de una persona: estado, sus órdenes abiertas (se eligen con un toque) y enlace al equipo. */
export function CrewSheet({
  person,
  orders,
  ordersLoading,
  onSelectOrder,
  onClose,
}: {
  person: CrewPlacement
  /** Órdenes abiertas del taller (se filtran las suyas). */
  orders: WorkOrder[]
  ordersLoading?: boolean
  onSelectOrder: (id: number) => void
  onClose: () => void
}) {
  const ctx = useWorkspace()
  const mine = orders.filter((o) => o.assigned_to?.id === person.member.id)
  const role = roleLabel(person.member.role)
  return (
    <>
      <div className="flex items-start justify-between gap-2 pb-3">
        <div className="min-w-0">
          <p className="chip mb-1.5">{role ?? 'Equipo'}</p>
          <h2 id={FLOOR_DETAIL_TITLE_ID} tabIndex={-1} className="flex items-center gap-2 font-display text-lg font-bold leading-snug text-fg-warm outline-none">
            <Swatch id={person.member.id} className="size-3" />
            {person.member.name}
          </h2>
        </div>
        <IconButton label="Cerrar la ficha (Escape)" size="sm" onClick={onClose} className="-mr-2 -mt-1">
          <X aria-hidden />
        </IconButton>
      </div>
      <div className="space-y-4">
        <p className={cn('flex items-center gap-2 rounded-control px-3 py-2 text-sm', person.status === 'working' ? 'bg-accent-soft text-fg' : 'bg-surface-2/70 text-fg-muted')}>
          <HardHat aria-hidden className="size-4 shrink-0" />
          {crewStatusText(person)}
        </p>
        <div>
          <h3 className="mb-1 text-sm font-medium text-fg">Órdenes abiertas asignadas</h3>
          {ordersLoading ? (
            <Skeleton className="h-24" />
          ) : mine.length === 0 ? (
            <p className="text-sm text-fg-muted">No tiene órdenes abiertas asignadas. Se asignan desde la ficha de cada orden.</p>
          ) : (
            <ul className="border-t border-line">
              {mine.map((o) => (
                <li key={o.id} className="border-b border-line">
                  <button type="button" onClick={() => onSelectOrder(o.id)} className={rowButton}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{o.vehicle.display_name}</span>
                      <span className="block truncate text-xs text-fg-muted">
                        <span className="tabular">{shortOrderNumber(o.number)}</span> · {o.bay ? `Elevador ${o.bay}` : 'Sin elevador'} · {o.title}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill status={WORK_ORDER_STATUS[o.status]} />
                      {o.is_late && <LateBadge />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[11px] text-fg-subtle">Su sitio en la maqueta sale de sus órdenes, no de un fichaje.</p>
        <div className="border-t border-line pt-3">
          <Link to={`${ctx.base}/equipo`} className="text-sm font-medium text-accent-ink hover:underline">
            Ver el equipo
          </Link>
        </div>
      </div>
    </>
  )
}

/** Lista del equipo: quién trabaja dónde y quién no tiene orden en curso. `only` filtra (p. ej. solo sin orden en curso). */
export function CrewList({
  crew,
  loading,
  error,
  only,
  selectedMemberId,
  onSelect,
  className,
}: {
  crew: CrewAssignment
  loading?: boolean
  error?: boolean
  only?: 'idle'
  selectedMemberId: number | null
  onSelect: (id: number) => void
  className?: string
}) {
  const people = only ? crew.people.filter((p) => p.status === only) : crew.people
  const title = only === 'idle' ? 'Sin orden en curso' : 'Equipo'
  return (
    <section aria-labelledby="floor-crew-title" className={className}>
      <h2 id="floor-crew-title" className="mb-2 flex items-center gap-2 font-display text-base font-bold text-fg-warm">
        <Users aria-hidden className="size-4 text-fg-muted" />
        {title}
        {!loading && <span className="tabular text-sm font-medium text-fg-muted">{people.length}</span>}
      </h2>
      {loading ? (
        <Skeleton className="h-24" />
      ) : error ? (
        <p className="text-sm text-fg-muted">No se ha podido cargar el equipo. Se muestran solo las personas con órdenes en los elevadores.</p>
      ) : people.length === 0 ? (
        <p className="text-sm text-fg-muted">{only === 'idle' ? 'Todo el equipo tiene una orden en curso.' : 'Aún no hay nadie en el equipo.'}</p>
      ) : (
        <ul className="border-t border-line">
          {people.map((p) => {
            const sel = selectedMemberId === p.member.id
            return (
              <li key={p.member.id} className="border-b border-line">
                <button type="button" aria-pressed={sel} onClick={() => onSelect(p.member.id)} className={cn(rowButton, sel && 'bg-accent-soft')}>
                  <Swatch id={p.member.id} className="size-2.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{p.member.name}</span>
                    <span className="block truncate text-xs text-fg-muted">{crewStatusText(p)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

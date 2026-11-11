import { CalendarClock, CircleCheck, Flag, OctagonAlert, TriangleAlert, UserRound, Warehouse } from 'lucide-react'
import { Link } from 'react-router'
import type { WorkOrder } from '@/api/types'
import { Mission } from '@/components/ui/Hud'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatPlate } from '@/lib/format'
import { plural } from '@/lib/text'
import type { FloorFilter } from './floorFleet'
import type { HomeMission } from './homeMissions'
import { formatWhenInline } from './orderUtils'

function vehicleLine(o: WorkOrder): string {
  return [o.vehicle.display_name, o.vehicle.plate ? formatPlate(o.vehicle.plate) : null].filter(Boolean).join(' · ')
}

const buttonMission = 'w-full cursor-pointer text-left'

/**
 * Panel «Misiones» de la portada del taller: lo que pide atención ahora, con datos reales de la API. Cada misión hace
 * algo: elegir la orden en la maqueta, filtrar la flota o abrir la agenda. El estado va siempre con icono y texto.
 */
export function MissionsPanel({
  missions,
  loading,
  base,
  onSelectOrder,
  onFilter,
  className,
  id = 'misiones',
}: {
  missions: HomeMission[]
  loading: boolean
  base: string
  onSelectOrder: (orderId: number) => void
  onFilter: (filter: FloorFilter) => void
  className?: string
  id?: string
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn('flex min-h-0 min-w-0 flex-col', className)}>
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <h2 id={`${id}-title`} className="font-display text-base font-bold text-fg-warm">
          Misiones
        </h2>
        <p className="text-xs text-fg-muted">{loading ? 'Cargando…' : missions.length ? 'Lo que pide atención ahora' : ''}</p>
      </div>
      {loading ? (
        <div role="status" className="space-y-2">
          <span className="sr-only">Cargando las misiones…</span>
          <Skeleton className="h-16 w-full rounded-card" />
          <Skeleton className="h-16 w-full rounded-card" />
        </div>
      ) : missions.length === 0 ? (
        <p className="flex items-start gap-2 rounded-card bg-ok-soft p-3 text-sm font-medium text-ok">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Todo en orden: nada va tarde ni hay entregas para hoy.</span>
        </p>
      ) : (
        <ul className="stagger -mx-1 -my-1 min-h-0 space-y-2 overflow-y-auto overscroll-contain px-1 py-1">
          {missions.map((m) => (
            <li key={m.key}>
              <MissionRow mission={m} base={base} onSelectOrder={onSelectOrder} onFilter={onFilter} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MissionRow({ mission: m, base, onSelectOrder, onFilter }: { mission: HomeMission; base: string; onSelectOrder: (id: number) => void; onFilter: (f: FloorFilter) => void }) {
  if (m.kind === 'order') {
    const o = m.order
    const icon = o.is_late ? <TriangleAlert aria-hidden /> : m.reason === 'mine' ? <UserRound aria-hidden /> : <CalendarClock aria-hidden />
    const label = m.reason === 'mine' ? (o.is_late ? 'Tuya · va tarde' : 'Asignada a ti') : o.is_late ? 'Va tarde' : 'Entrega hoy'
    return (
      <Mission
        as="button"
        type="button"
        tone={m.tone}
        icon={icon}
        title={o.title}
        description={
          <>
            <span className="block truncate">{vehicleLine(o)}</span>
            <span className={cn('block font-bold', o.is_late ? 'text-danger' : 'text-fg-muted')}>
              {label}
              {o.promised_at && <span className="tabular font-medium"> · {formatWhenInline(o.promised_at)}</span>}
            </span>
          </>
        }
        trailing={<span className="tabular text-xs font-bold text-fg-muted">{o.number.replace(/^OT-\d+-/, '')}</span>}
        className={buttonMission}
        onClick={() => onSelectOrder(o.id)}
        aria-label={`Ver ${o.number}, ${o.title}. ${label}`}
      />
    )
  }
  if (m.kind === 'filter') {
    const ready = m.filter === 'ready'
    return (
      <Mission
        as="button"
        type="button"
        tone={m.tone}
        icon={ready ? <Flag aria-hidden /> : <Warehouse aria-hidden />}
        title={ready ? `${plural(m.count, 'coche listo', 'coches listos')} para entregar` : `${plural(m.count, 'coche espera', 'coches esperan')} elevador`}
        description={ready ? 'Esperan al cliente' : m.freeBays > 0 ? `${plural(m.freeBays, 'elevador libre', 'elevadores libres')}: sube uno` : 'Ahora mismo no hay elevadores libres'}
        trailing={<span className="text-xs font-bold text-accent-ink">Ver lista</span>}
        className={buttonMission}
        onClick={() => onFilter(m.filter)}
      />
    )
  }
  return (
    <Mission
      as={Link}
      to={`${base}/agenda`}
      tone={m.tone}
      icon={m.overdue > 0 ? <OctagonAlert aria-hidden /> : <CalendarClock aria-hidden />}
      title={`${plural(m.count, 'alerta', 'alertas')} de flota`}
      description={m.overdue > 0 ? `${plural(m.overdue, 'vencida', 'vencidas')}. Según los intervalos anotados, no medido` : 'Próximas. Según los intervalos anotados, no medido'}
      trailing={<span className="text-xs font-bold text-accent-ink">Agenda</span>}
    />
  )
}

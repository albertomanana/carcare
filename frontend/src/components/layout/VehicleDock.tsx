import { CarFront, Clock, OctagonAlert, Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
import { useVehicles } from '@/api/hooks/vehicles'
import type { Vehicle } from '@/api/types'
import { Tooltip } from '@/components/ui/Tooltip'
import type { WorkspaceContextValue } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { paintVars } from '@/lib/colors'
import { formatPlate } from '@/lib/format'
import { plural } from '@/lib/text'

/** Fichas que caben en el dock; el resto se ve en el garaje. */
const MAX_TOKENS = 4

function vehicleStatus(v: Vehicle) {
  const { overdue_reminders: overdue, soon_reminders: soon } = v.stats
  if (overdue) return { text: plural(overdue, 'vencido', 'vencidos'), tone: 'danger' as const, Icon: OctagonAlert }
  if (soon) return { text: plural(soon, 'próximo', 'próximos'), tone: 'warning' as const, Icon: Clock }
  return { text: 'Sin avisos', tone: 'none' as const, Icon: null }
}

/**
 * «Fichas» de vehículo del dock (sustituye al abanico de muestras de «Carta de colores»): una ficha por coche, con su
 * pintura real como acento y lo que tiene vencido o próximo (icono + texto). El vehículo que estás viendo lleva anillo
 * azul. En el dock estrecho solo se ve la ficha (con el estado en el tooltip y en el nombre accesible).
 */
export function VehicleDock({ ctx, narrow }: { ctx: WorkspaceContextValue; narrow: boolean }) {
  const location = useLocation()
  const query = useVehicles(ctx.id, { per_page: 12 })
  const all = (query.data?.data ?? []).filter((v) => !v.archived_at)
  const current = new RegExp(`^${ctx.base}/vehiculos/(\\d+)`).exec(location.pathname)?.[1]
  const shown = all.slice(0, MAX_TOKENS)
  const rest = all.length - shown.length

  if (query.isPending) return null
  if (shown.length === 0 && !ctx.can('operate')) return null

  return (
    <section aria-labelledby="dock-vehicles" className="px-3 pb-2">
      <span aria-hidden className="mx-2 mb-3 block border-t border-line" />
      <h2 id="dock-vehicles" className={cn('tag-label px-3 text-fg-subtle', narrow && 'sr-only')}>
        Tus vehículos
      </h2>
      <ul className="mt-1.5 flex flex-col gap-1">
        {shown.map((v) => (
          <li key={v.id}>
            <Token vehicle={v} to={`${ctx.base}/vehiculos/${v.id}`} current={String(v.id) === current} narrow={narrow} />
          </li>
        ))}
        {shown.length === 0 && (
          <li>
            <Link
              to={`${ctx.base}/vehiculos/nuevo`}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-dashed border-line px-3 text-sm font-bold text-fg-muted transition-colors duration-150 hover:border-accent hover:text-accent-ink"
              aria-label="Añadir vehículo"
            >
              <Plus aria-hidden className="size-4 shrink-0" />
              <span className={cn(narrow && 'sr-only')}>Añadir vehículo</span>
            </Link>
          </li>
        )}
      </ul>
      {rest > 0 && (
        <Link
          to={`${ctx.base}/garaje`}
          className="mt-1 block rounded-lg px-3 py-1 text-xs font-bold text-fg-muted underline-offset-4 hover:text-accent-ink hover:underline"
        >
          {narrow ? `+${rest}` : `Ver ${plural(rest, 'otro', 'otros')} en el garaje`}
          {narrow && <span className="sr-only"> {plural(rest, 'vehículo más', 'vehículos más')} en el garaje</span>}
        </Link>
      )}
    </section>
  )
}

function Token({ vehicle: v, to, current, narrow }: { vehicle: Vehicle; to: string; current: boolean; narrow: boolean }) {
  const status = vehicleStatus(v)
  const style = paintVars(v.color_hex) as CSSProperties
  // El nombre accesible empieza por el texto visible («Nombre», «MATRÍCULA · estado»): WCAG 2.5.3
  const label = `${v.display_name} ${v.plate ? `${formatPlate(v.plate)} · ` : ''}${status.text}`
  const link = (
    <Link
      to={to}
      style={style}
      aria-current={current ? 'page' : undefined}
      aria-label={narrow ? label : undefined}
      className={cn(
        'group flex min-h-12 items-center gap-3 rounded-xl p-1.5 transition-[background-color,scale] duration-150 ease-out-soft active:scale-[0.97]',
        narrow && 'justify-center',
        current ? 'bg-accent-soft' : 'hover:bg-accent-soft',
      )}
    >
      <span
        className={cn(
          'clay relative grid size-9 shrink-0 place-items-center rounded-xl transition-transform duration-200 ease-out-soft group-hover:-translate-y-0.5',
          current && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
        )}
      >
        <CarFront aria-hidden className="size-5" />
        {narrow && status.Icon && (
          <span
            aria-hidden
            className={cn(
              'absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full border-2 border-surface text-on-danger [&_svg]:size-2.5',
              status.tone === 'danger' ? 'bg-danger' : 'bg-warning',
            )}
          >
            <status.Icon />
          </span>
        )}
      </span>
      {!narrow && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold leading-tight text-fg">{v.display_name}</span>
          <span
            className={cn(
              'mt-0.5 flex items-center gap-1 text-xs font-semibold leading-tight',
              status.tone === 'danger' ? 'text-danger' : status.tone === 'warning' ? 'text-warning' : 'text-fg-subtle',
            )}
          >
            {status.Icon && <status.Icon aria-hidden className="size-3 shrink-0" />}
            <span className="truncate">{v.plate ? `${formatPlate(v.plate)} · ${status.text}` : status.text}</span>
          </span>
        </span>
      )}
    </Link>
  )
  if (!narrow) return link
  return (
    <Tooltip
      side="right"
      content={
        <>
          <span className="block font-bold">{v.display_name}</span>
          <span className="block text-fg-muted">{[v.plate ? formatPlate(v.plate) : null, status.text].filter(Boolean).join(' · ')}</span>
        </>
      }
    >
      {link}
    </Tooltip>
  )
}

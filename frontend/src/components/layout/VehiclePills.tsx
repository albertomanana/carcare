import { OctagonAlert } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
import { useVehicles } from '@/api/hooks/vehicles'
import type { WorkspaceContextValue } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { paintVars } from '@/lib/colors'
import { formatPlate } from '@/lib/format'
import { plural } from '@/lib/text'

/** Pestañas de la ficha: al cambiar de vehículo desde una de ellas se conserva la pestaña. */
const TABS = new Set(['historial', 'gastos', 'recordatorios', 'datos', 'ordenes'])
/** Pantallas de formulario: ahí cambiar de vehículo no tiene sentido y la fila sobra. */
const FORM_ROUTE = /\/(nuevo|nueva|editar|intervenciones)(\/|$)/

/**
 * Selector rápido de vehículo para el móvil y la tableta (por debajo de 1024 px, donde no está el carril lateral): una
 * fila de píldoras de 48 px bajo la barra de estado, una por vehículo, con su pintura real, su matrícula y un aviso si
 * tiene algo vencido (icono + texto para lectores). Lleva a la ficha; desde una pestaña de la ficha, a la misma pestaña
 * del otro vehículo.
 */
export function VehiclePills({ ctx }: { ctx: WorkspaceContextValue }) {
  const { pathname } = useLocation()
  // La misma consulta que las fichas del carril (comparten caché)
  const query = useVehicles(ctx.id, { per_page: 12 })
  const vehicles = (query.data?.data ?? []).filter((v) => !v.archived_at)
  if (vehicles.length === 0 || FORM_ROUTE.test(pathname)) return null

  const match = new RegExp(`^${ctx.base}/vehiculos/(\\d+)(?:/([a-z]+))?/?$`).exec(pathname)
  const current = match?.[1]
  const tab = match?.[2] && TABS.has(match[2]) ? `/${match[2]}` : ''

  return (
    <nav aria-label="Tus vehículos" className="no-print lg:hidden">
      <ul className="scrollbar-none flex snap-x gap-2 overflow-x-auto px-3 pt-2 sm:px-6">
        {vehicles.map((v) => {
          const active = String(v.id) === current
          const overdue = v.stats.overdue_reminders
          return (
            <li key={v.id} className="shrink-0 snap-start">
              <Link
                to={`${ctx.base}/vehiculos/${v.id}${tab}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // `relative`: el texto solo para lectores (posición absoluta) queda dentro de la fila que se desplaza y no ensancha la página
                  'relative flex min-h-12 items-center gap-2.5 rounded-full border py-1 pl-2 pr-4 transition-[background-color,border-color,scale] duration-150 ease-out-soft active:scale-[0.97]',
                  active ? 'border-accent bg-accent-soft' : 'border-line-strong/45 bg-surface-2',
                )}
              >
                <span aria-hidden style={paintVars(v.color_hex) as CSSProperties} className="clay size-8 shrink-0 rounded-full" />
                <span className="min-w-0">
                  <span className="block max-w-[9.5rem] truncate text-sm font-semibold leading-tight text-fg">{v.display_name}</span>
                  {v.plate && <span className="tabular block text-xs leading-tight text-fg-muted">{formatPlate(v.plate)}</span>}
                </span>
                {overdue > 0 && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-danger">
                    <OctagonAlert aria-hidden className="size-4" />
                    <span className="tabular" aria-hidden>
                      {overdue}
                    </span>
                    <span className="sr-only">{plural(overdue, 'aviso vencido', 'avisos vencidos')}</span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

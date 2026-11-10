import { Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
import { useVehicles } from '@/api/hooks/vehicles'
import type { Vehicle } from '@/api/types'
import type { WorkspaceContextValue } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { paintVars } from '@/lib/colors'
import { plural } from '@/lib/text'
import { formatPlate } from '@/lib/format'

/** Cartas que caben en el abanico; el resto se ve en el garaje. */
const MAX_CHIPS = 3

/**
 * Abanico de muestras de la barra lateral (firma del mundo «Carta de colores»): una carta lacada por vehículo, con su
 * pintura real, su matrícula y lo que tiene vencido o próximo. El vehículo que estás viendo va delante. Cada carta es un
 * enlace a su ficha; el abanico se despliega al pasar el ratón o al llegar con el teclado (CSS, sin JavaScript).
 */
export function PaintFan({ ctx }: { ctx: WorkspaceContextValue }) {
  const location = useLocation()
  const query = useVehicles(ctx.id, { per_page: 12 })
  const all = (query.data?.data ?? []).filter((v) => !v.archived_at)
  const current = new RegExp(`^${ctx.base}/vehiculos/(\\d+)`).exec(location.pathname)?.[1]
  const ordered = current ? [...all].sort((a, b) => Number(String(b.id) === current) - Number(String(a.id) === current)) : all
  const shown = ordered.slice(0, MAX_CHIPS)
  const rest = all.length - shown.length

  if (query.isPending) return null

  return (
    <section aria-labelledby="fan-title" className="px-3 pb-2">
      <h2 id="fan-title" className="tag-label px-3 text-rail-muted">
        Tus vehículos
      </h2>
      {shown.length === 0 ? (
        ctx.can('operate') && (
          <Link
            to={`${ctx.base}/vehiculos/nuevo`}
            className="mt-3 flex min-h-11 items-center gap-2 rounded-[10px] border border-dashed border-rail-line px-3 text-sm text-rail-muted transition-colors duration-150 hover:border-rail-muted hover:text-rail-fg"
          >
            <Plus aria-hidden className="size-4" />
            Añadir vehículo
          </Link>
        )
      ) : (
        <div className="fan mt-1">
          <ul className="fan-stage" style={{ height: 124 + (shown.length - 1) * 80 }} aria-label="Muestras de tus vehículos">
            {/* el primero queda delante: se pinta el último */}
            {shown
              .map((v, i) => ({ v, i }))
              .reverse()
              .map(({ v, i }) => (
                <li key={v.id} className="absolute inset-0 [transform-style:preserve-3d]">
                  <Chip vehicle={v} index={i} to={`${ctx.base}/vehiculos/${v.id}`} current={String(v.id) === current} />
                </li>
              ))}
            {/* remache del abanico */}
            <li aria-hidden className="absolute bottom-[1.2rem] left-[2.45rem] size-2.5 rounded-full bg-rail-muted shadow-[inset_0_-1px_0_rgb(0_0_0/0.4),0_1px_2px_rgb(0_0_0/0.5)] [transform:translateZ(4px)]" />
          </ul>
        </div>
      )}
      {rest > 0 && (
        <Link to={`${ctx.base}/garaje`} className="mt-1 block px-3 text-xs text-rail-muted underline-offset-4 hover:text-rail-fg hover:underline">
          {`Ver ${plural(rest, 'otro', 'otros')} en el garaje`}
        </Link>
      )}
    </section>
  )
}

function Chip({ vehicle: v, index, to, current }: { vehicle: Vehicle; index: number; to: string; current: boolean }) {
  const { overdue_reminders: overdue, soon_reminders: soon } = v.stats
  const status = overdue ? plural(overdue, 'vencido', 'vencidos') : soon ? plural(soon, 'próximo', 'próximos') : 'Sin avisos'
  const sub = v.nickname ? `${v.make} ${v.model}` : v.year ? String(v.year) : v.version
  const style = { ...paintVars(v.color_hex), '--i': index, zIndex: 10 - index } as CSSProperties
  return (
    <Link
      to={to}
      style={style}
      aria-current={current ? 'page' : undefined}
      aria-label={`${v.display_name}${v.plate ? `, ${formatPlate(v.plate)}` : ''}: ${status}`}
      className={cn('fan-chip block rounded-[10px] shadow-[0_14px_22px_-14px_rgb(0_0_0/0.8)]', current && 'ring-2 ring-rail-accent ring-offset-2 ring-offset-rail')}
    >
      <span className="lacquer block h-[3.75rem] rounded-t-[10px] px-3 pt-2.5">
        <span className="block truncate text-[0.9375rem] font-semibold leading-5">{v.display_name}</span>
        {sub && <span className="tag-label block truncate opacity-80">{sub}</span>}
      </span>
      <span className="tag-label flex items-center justify-between gap-2 rounded-b-[10px] bg-surface py-2 pl-7 pr-3 text-fg">
        <span className="truncate">{v.plate ? formatPlate(v.plate) : 'Sin matrícula'}</span>
        <span className={cn('shrink-0', overdue ? 'text-danger' : soon ? 'text-warning' : 'text-fg-subtle')}>{status}</span>
      </span>
    </Link>
  )
}

/**
 * Telemetría del vehículo: los datos clave (taller, avisos, km, ITV, seguro, neumáticos, última revisión, motor, gasto)
 * como tarjetas que rodean al coche en el garaje 3D y como lista HTML en la página. Los datos salen de
 * `vehicleTelemetry` (API real); el color acompaña siempre a un texto.
 */
import { BellRing, CircleDot, ClipboardCheck, Cog, Gauge, ShieldCheck, Wallet, Warehouse, Wrench, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useReminders } from '@/api/hooks/records'
import { useVehicleSummary } from '@/api/hooks/vehicles'
import type { Vehicle } from '@/api/types'
import { LiveTimer } from '@/components/orders/OrderTimer'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { datumSentence, vehicleTelemetry, type TelemetryDatum, type TelemetryTone } from '@/lib/vehicleTelemetry'
import type { WorkshopVisit } from '@/lib/workshopVisit'

const ICON: Record<string, LucideIcon> = {
  taller: Warehouse,
  avisos: BellRing,
  km: Gauge,
  itv: ClipboardCheck,
  insurance: ShieldCheck,
  tyres: CircleDot,
  revision: Wrench,
  motor: Cog,
  gasto: Wallet,
}

/** Las cifras van en la mono del sistema; los valores que son solo texto («El año pasado»), en la de lectura. */
const figure = (value: string) => (/d/.test(value) ? 'tabular' : undefined)

const TONE_TEXT: Record<TelemetryTone, string> = { neutral: 'text-fg', ok: 'text-ok', warning: 'text-warning', danger: 'text-danger', workshop: 'text-warning' }
const TONE_EDGE: Record<TelemetryTone, string> = { neutral: 'before:bg-line-strong', ok: 'before:bg-ok', warning: 'before:bg-warning', danger: 'before:bg-danger', workshop: 'before:bg-[#f59e0b]' }

/** Datos de telemetría de un vehículo (ficha + resumen + recordatorios pendientes + visita al taller, si la hay). */
export function useVehicleTelemetry(vehicle: Vehicle | undefined, visit: WorkshopVisit | undefined): TelemetryDatum[] {
  const ctx = useWorkspace()
  const summary = useVehicleSummary(vehicle?.id)
  const reminders = useReminders(vehicle?.id)
  const canExpenses = ctx.canExpenses
  const base = ctx.base
  return useMemo(
    () => (vehicle ? vehicleTelemetry({ vehicle, summary: summary.data, reminders: reminders.data, visit, canExpenses, base }) : []),
    [vehicle, summary.data, reminders.data, visit, canExpenses, base],
  )
}

/**
 * Tarjeta de 190 × 56 px para el anillo de la escena: rótulo, valor y nota en tres líneas, con una arista del color del
 * estado. Es un enlace a la pantalla del dato.
 */
export function TelemetryCard({ datum }: { datum: TelemetryDatum }) {
  const Icon = ICON[datum.id] ?? Gauge
  const live = datum.visit && datum.visit.order.status !== 'ready' ? datum.visit.order : null
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase leading-[1.3] tracking-[0.08em] text-fg-muted">
        <Icon aria-hidden className={cn('size-3 shrink-0', datum.tone !== 'neutral' && TONE_TEXT[datum.tone])} />
        <span className="truncate">{datum.label}</span>
        {live && <LiveTimer order={live} short bar={false} className="ml-auto shrink-0 normal-case tracking-normal" />}
      </span>
      <span className={cn('truncate text-[13px] font-semibold leading-tight', figure(datum.value), TONE_TEXT[datum.tone])}>{datum.value}</span>
      {datum.note && <span className="truncate text-[11px] leading-tight text-fg-muted">{datum.note}</span>}
    </>
  )
  const cls = cn(
    'relative flex h-full w-full flex-col justify-center gap-0.5 overflow-hidden rounded-control border border-line bg-surface/95 py-1 pl-3.5 pr-2.5 shadow-md backdrop-blur-sm',
    'before:absolute before:inset-y-1.5 before:left-1 before:w-[3px] before:rounded-full',
    TONE_EDGE[datum.tone],
    datum.tone === 'workshop' && 'border-[#f59e0b]/55',
  )
  if (!datum.to)
    return (
      <div className={cls} title={datumSentence(datum)}>
        {body}
      </div>
    )
  return (
    <Link to={datum.to} className={cn(cls, 'transition-colors hover:border-accent/60 hover:bg-surface')} title={datumSentence(datum)}>
      {body}
    </Link>
  )
}

/** Los mismos datos como lista de definición: la versión de siempre, para móvil, sin WebGL y lectores de pantalla. */
export function TelemetryList({ data, className }: { data: TelemetryDatum[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-4', className)}>
      {data.map((d) => {
        const Icon = ICON[d.id] ?? Gauge
        const value = <span className={cn('block truncate text-sm font-semibold', figure(d.value), TONE_TEXT[d.tone])}>{d.value}</span>
        return (
          <div key={d.id} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Icon aria-hidden className={cn('size-3.5 shrink-0', d.tone !== 'neutral' && TONE_TEXT[d.tone])} />
              <span className="truncate">{d.label}</span>
            </dt>
            <dd className="mt-0.5 min-w-0">
              {d.to ? (
                <Link to={d.to} className="block rounded-sm underline-offset-4 hover:underline">
                  {value}
                </Link>
              ) : (
                value
              )}
              {d.note && <span className="block truncate text-xs text-fg-subtle">{d.note}</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

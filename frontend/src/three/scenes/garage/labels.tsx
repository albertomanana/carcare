/**
 * Rótulo HTML de un vehículo del garaje: un botón accesible proyectado sobre su coche. El texto accesible lleva siempre
 * el nombre completo y la matrícula; la versión compacta (cabecera pequeña) solo enseña la matrícula o un nombre corto.
 */
import type { GarageVehicle } from '../../types'
import { vehicleAria } from './layout'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function VehicleLabel({
  vehicle,
  slot,
  selected,
  compact,
  onSelect,
}: {
  vehicle: GarageVehicle
  slot: number
  selected: boolean
  compact: boolean
  onSelect: (id: number | null) => void
}) {
  const aria = `Plaza ${slot + 1}: ${vehicleAria(vehicle)}${vehicle.inWorkshop ? ', en el taller' : ''}`
  const short = vehicle.plate ?? vehicle.name
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={aria}
        title={aria}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(selected ? null : vehicle.id)
        }}
        className={cx(
          'inline-flex max-w-52 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-card border px-2.5 py-1 text-xs font-medium text-fg shadow-md backdrop-blur-md',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink',
          selected ? 'border-accent bg-surface ring-2 ring-accent/35' : 'border-line/70 bg-surface/90 hover:bg-surface',
        )}
      >
        {vehicle.inWorkshop ? (
          <span aria-hidden className="relative grid size-2.5 shrink-0 place-items-center">
            <span className="absolute inset-0 rounded-full bg-[#f59e0b] opacity-60 motion-safe:animate-ping" />
            <span className="relative size-2.5 rounded-full bg-[#f59e0b]" />
          </span>
        ) : (
          <span className="font-display text-xs font-semibold text-fg-subtle">{slot + 1}</span>
        )}
        <span className="truncate">{compact && !selected ? short : vehicle.name}</span>
        {vehicle.inWorkshop ? <span className="font-semibold text-warning">En el taller</span> : (!compact || selected) && vehicle.plate && <span className="truncate text-fg-muted">{vehicle.plate}</span>}
      </button>
      <span className="h-2.5 w-px bg-fg-subtle/70" aria-hidden />
    </div>
  )
}

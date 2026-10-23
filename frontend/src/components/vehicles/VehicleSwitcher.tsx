import { useId } from 'react'
import type { Vehicle } from '@/api/types'
import { cn } from '@/lib/cn'
import { VehicleSwatch } from './VehicleVisuals'

/** Selector de vehículo en carrusel (radios nativos: flechas del teclado incluidas). */
export function VehicleSwitcher({ vehicles, value, onChange, label = 'Vehículo' }: { vehicles: Vehicle[]; value: number | null; onChange: (id: number) => void; label?: string }) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {vehicles.map((v) => {
        const checked = v.id === value
        return (
          <label
            key={v.id}
            className={cn(
              'flex min-h-14 shrink-0 cursor-pointer snap-start items-center gap-3 rounded-card border px-3 py-2 transition-colors duration-150',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
              checked ? 'border-accent/60 bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={checked} onChange={() => onChange(v.id)} />
            <VehicleSwatch vehicle={v} size="sm" />
            <span className="min-w-0">
              <span className="block max-w-[11rem] truncate text-sm font-semibold text-fg">{v.display_name}</span>
              <span className="block max-w-[11rem] truncate text-xs text-fg-subtle">{v.plate ?? `${v.make} ${v.model}`}</span>
            </span>
            {v.stats.overdue_reminders > 0 && (
              <span className="ml-1 rounded-full bg-danger-soft px-1.5 text-[11px] font-semibold text-danger tabular" title="Recordatorios vencidos">
                {v.stats.overdue_reminders}
                <span className="sr-only"> vencidos</span>
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}

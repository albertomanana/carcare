import { useState } from 'react'
import type { Vehicle } from '@/api/types'
import { useTheme } from '@/app/theme-context'
import { Plate } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { formatKm } from '@/lib/format'
import { CarViewer } from '@/three'

/**
 * Escaparate del garaje: el coche del usuario en 3D sobre un suelo en perspectiva, con el modelo girando despacio.
 * Es el único lienzo WebGL de Inicio (regla 7): `CarViewer` carga three.js cuando la tarjeta entra en pantalla y,
 * sin WebGL o con error, enseña la silueta 2D. El estado de cada zona sigue en la ficha; aquí no se inventa nada.
 */
export function Showroom({ vehicles }: { vehicles: Vehicle[] }) {
  const ctx = useWorkspace()
  const { theme } = useTheme()
  const active = vehicles.filter((v) => !v.archived_at)
  const [index, setIndex] = useState(0)
  const vehicle = active[Math.min(index, active.length - 1)]
  if (!vehicle) return null

  return (
    <section aria-label="Tu garaje en 3D" className="surface-card relative isolate h-[21rem] overflow-hidden rounded-hero border border-line sm:h-[26rem]">
      <div aria-hidden className="floor-local" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_45%,var(--glow),transparent_70%)]" />
      <CarViewer
        key={vehicle.id}
        appearance={{ bodyType: vehicle.body_type, colorHex: vehicle.color_hex }}
        mode="showcase"
        lighting={theme === 'dark' ? 'night' : 'studio'}
        className="absolute inset-0 z-10 h-full w-full"
        ariaLabel={`Modelo 3D de ${vehicle.display_name}, girando despacio.`}
      />

      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-surface/90 to-transparent p-4 pt-14 sm:p-6 sm:pt-16">
        <div className="min-w-0">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="truncate font-display text-2xl font-semibold tracking-[-0.02em] text-fg-warm sm:text-3xl">{vehicle.display_name}</span>
            <Plate value={vehicle.plate} className="text-sm" />
          </p>
          <p className="tabular mt-1 text-sm text-fg-muted">{formatKm(vehicle.current_mileage, { empty: 'Sin kilómetros' })}</p>
        </div>
        <ButtonLink to={`${ctx.base}/vehiculos/${vehicle.id}`} variant="primary">
          Abrir ficha
        </ButtonLink>
      </div>

      {active.length > 1 && (
        <div role="group" aria-label="Vehículo mostrado" className="absolute right-3 top-3 z-20 flex max-w-[70%] gap-1 overflow-x-auto rounded-control border border-line bg-surface/80 p-1 backdrop-blur-md sm:right-5 sm:top-5">
          {active.map((v, i) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'min-h-9 shrink-0 whitespace-nowrap rounded-[6px] px-3 text-sm font-medium transition-[color,background-color,scale] duration-150 active:scale-95',
                i === index ? 'bg-accent text-on-accent' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {v.display_name}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

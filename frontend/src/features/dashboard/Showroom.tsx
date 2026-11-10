import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Vehicle } from '@/api/types'
import { useTheme } from '@/app/theme-context'
import { ButtonLink } from '@/components/ui/Button'
import { Tilt } from '@/components/ui/Tilt'
import { BrandLogo } from '@/components/vehicles/BrandLogo'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { paintVars, vehicleColorName } from '@/lib/colors'
import { formatKm, formatPlate } from '@/lib/format'
import { CarViewer } from '@/three'

/**
 * Escaparate de Inicio (mundo «Carta de colores»): una placa de muestra. A la izquierda, la carta lacada con la pintura
 * real del vehículo y sus datos; a la derecha, la cabina de igualación con el coche 3D girando despacio. Es el único lienzo
 * WebGL de Inicio (regla 7): `CarViewer` carga three.js al entrar en pantalla y, sin WebGL o con error, enseña la silueta.
 * Con varios vehículos, las muestras redondas de arriba cambian el coche y la pintura de la placa (el estado vive en Inicio,
 * que también enseña las cifras del mes del vehículo elegido).
 */
export function Showroom({ vehicles, vehicle, onSelect }: { vehicles: Vehicle[]; vehicle: Vehicle; onSelect: (id: Vehicle['id']) => void }) {
  const ctx = useWorkspace()
  const { theme } = useTheme()
  const active = vehicles.filter((v) => !v.archived_at)
  const paint = paintVars(vehicle.color_hex) as CSSProperties
  const colorName = vehicleColorName(vehicle.color_hex)
  const sub = [vehicle.nickname ? `${vehicle.make} ${vehicle.model}` : vehicle.version, vehicle.year].filter(Boolean).join(' · ')

  return (
    <section
      aria-label="Tu garaje en 3D"
      style={paint}
      className="surface-card @container isolate overflow-hidden rounded-hero border border-line"
    >
      <div className="grid h-full @[34rem]:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] @[50rem]:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"
    >
      {/* Carta de muestra: se inclina hacia el puntero y deja ver su canto */}
      <Tilt max={6} className="relative z-10 @[34rem]:-mr-3">
        <div key={vehicle.id} className="lacquer paint-wipe flex h-full min-h-[11rem] flex-col justify-between gap-6 rounded-hero p-5 @[34rem]:rounded-r-[1.25rem] @[50rem]:p-6">
          <div className="z-near flex items-start justify-between gap-3">
            <div className="min-w-0">
            <p className="line-clamp-2 break-words font-display text-2xl font-bold @[50rem]:text-3xl">{vehicle.display_name}</p>
            {sub && <p className="mt-1 truncate text-sm opacity-80">{sub}</p>}
            </div>
            {/* decorativo: la marca ya está en el texto */}
            <BrandLogo make={vehicle.make} className="mt-1 size-7 opacity-85" />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @[34rem]:grid-cols-1">
            <div className="@[34rem]:order-2">
              <dt className="tag-label opacity-75">Matrícula</dt>
              <dd className="tag-label mt-0.5 text-sm">{vehicle.plate ? formatPlate(vehicle.plate) : 'Sin matrícula'}</dd>
            </div>
            <div className="@[34rem]:order-1">
              <dt className="tag-label opacity-75">Kilometraje</dt>
              <dd className="tabular mt-0.5 whitespace-nowrap font-display text-2xl font-bold leading-8 @[34rem]:text-[1.75rem]">{formatKm(vehicle.current_mileage, { empty: 'Sin anotar' })}</dd>
            </div>
            <div className="@max-[34rem]:col-span-2 @[34rem]:order-3">
              <dt className="tag-label opacity-75">Pintura</dt>
              <dd className="tag-label mt-0.5">{vehicle.color_hex ? `${colorName ?? 'Color propio'} · ${vehicle.color_hex.toUpperCase()}` : 'Sin indicar'}</dd>
            </div>
          </dl>
        </div>
      </Tilt>

      {/* Cabina de igualación: luz neutra, el suelo recoge un reflejo de la pintura */}
      <div className="relative h-[19rem] @[34rem]:h-[23rem] bg-[radial-gradient(120%_70%_at_50%_100%,color-mix(in_srgb,var(--paint)_18%,var(--surface-2)),var(--surface)_72%)]">
        <CarViewer
          key={vehicle.id}
          appearance={{ bodyType: vehicle.body_type, colorHex: vehicle.color_hex }}
          mode="showcase"
          lighting={theme === 'dark' ? 'night' : 'studio'}
          className="absolute inset-0 h-full w-full"
          ariaLabel={`Modelo 3D de ${vehicle.display_name}, girando despacio.`}
        />
        {active.length > 1 && (
          <div role="group" aria-label="Vehículo mostrado" className="absolute left-5 top-4 z-10 flex gap-2 @[50rem]:left-7 @[50rem]:top-6">
            {active.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === vehicle.id}
                aria-label={v.display_name}
                title={v.display_name}
                onClick={() => onSelect(v.id)}
                style={paintVars(v.color_hex) as CSSProperties}
                className={cn(
                  'lacquer size-8 rounded-full transition-transform duration-150 ease-out active:scale-90',
                  v.id === vehicle.id ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:-translate-y-0.5',
                )}
              />
            ))}
          </div>
        )}
        <ButtonLink to={`${ctx.base}/vehiculos/${vehicle.id}`} className="absolute bottom-4 right-4 z-10 @[50rem]:bottom-6 @[50rem]:right-6" iconRight={<ArrowRight aria-hidden />}>
          Abrir ficha
        </ButtonLink>
      </div>
      </div>
    </section>
  )
}

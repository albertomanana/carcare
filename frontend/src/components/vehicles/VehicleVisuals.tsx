import { Car } from 'lucide-react'
import type { BodyType } from '@/api/types'
import { cn } from '@/lib/cn'
import { CarThumbnail } from '@/three'

interface Look {
  body_type: BodyType | null
  color_hex: string | null
  display_name: string
}

/** Miniatura estática (render cacheado o silueta): nunca un WebGL por tarjeta. */
export function VehicleThumb({ vehicle, className }: { vehicle: Look; className?: string }) {
  return (
    <CarThumbnail
      appearance={{ bodyType: vehicle.body_type, colorHex: vehicle.color_hex }}
      alt={`Ilustración de ${vehicle.display_name}`}
      className={className}
    />
  )
}

/** Punto de color del vehículo para listas compactas. */
export function VehicleSwatch({ vehicle, size = 'md', className }: { vehicle: Pick<Look, 'color_hex'>; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full border border-line-strong/60 bg-surface-3',
        size === 'sm' ? 'size-7' : 'size-9',
        className,
      )}
      style={vehicle.color_hex ? { backgroundColor: vehicle.color_hex } : undefined}
    >
      <Car className={cn('text-white mix-blend-difference', size === 'sm' ? 'size-3.5' : 'size-4')} />
    </span>
  )
}

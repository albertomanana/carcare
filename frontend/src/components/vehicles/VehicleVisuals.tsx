import type { CSSProperties } from 'react'
import type { BodyType } from '@/api/types'
import { cn } from '@/lib/cn'
import { paintVars } from '@/lib/colors'
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

/** Muestra lacada del color del vehículo para listas compactas (mundo «Carta de colores»). */
export function VehicleSwatch({ vehicle, size = 'md', className }: { vehicle: Pick<Look, 'color_hex'>; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-hidden
      style={paintVars(vehicle.color_hex) as CSSProperties}
      className={cn('lacquer block shrink-0 rounded-md', size === 'sm' ? 'size-7' : 'size-9', className)}
    />
  )
}

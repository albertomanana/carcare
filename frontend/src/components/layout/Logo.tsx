import { cn } from '@/lib/cn'

/**
 * Marca de CarCare («Apex Telemetry»): una placa naranja con la trazada de una curva y su vértice marcado, como en una
 * hoja de telemetría. Los colores son fijos (la marca no cambia con el tema).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)} fill="none">
      <rect width="32" height="32" rx="8" fill="#ff5500" />
      {/* borde interior de la curva */}
      <path d="M14 25C14 19.5 17.5 16 25 16" stroke="#0b0d13" strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round" />
      {/* trazada */}
      <path d="M7 25C7 14.5 13.5 9 25 9" stroke="#0b0d13" strokeWidth="3" strokeLinecap="round" />
      {/* vértice */}
      <circle cx="11.6" cy="13.6" r="2.6" fill="#0b0d13" stroke="#ff5500" strokeWidth="1.2" />
    </svg>
  )
}

/** Logotipo con nombre. */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showText && <span className="font-display text-lg font-bold text-fg-warm">CarCare</span>}
    </span>
  )
}

export function Splash({ label = 'Cargando CarCare…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas" role="status">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-12 animate-pulse" />
        <span className="text-sm font-semibold text-fg-subtle">{label}</span>
      </div>
    </div>
  )
}

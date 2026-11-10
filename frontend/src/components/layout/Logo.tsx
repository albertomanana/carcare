import { cn } from '@/lib/cn'

/**
 * Marca de CarCare: un abanico de tres muestras de pintura (cartulina, rojo y el azul de calibración) sobre grafito,
 * sujetas por su remache. Es el mismo gesto que el abanico de vehículos de la barra lateral.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#232528" />
      <rect x="9" y="18.5" width="17" height="7" rx="2" fill="#F7F7F4" transform="rotate(-40 11.5 22)" />
      <rect x="9" y="18.5" width="17" height="7" rx="2" fill="#D0453B" transform="rotate(-20 11.5 22)" />
      <rect x="9" y="18.5" width="17" height="7" rx="2" fill="#2F5FE8" />
      <circle cx="11.5" cy="22" r="1.5" fill="#232528" />
    </svg>
  )
}

/** Logotipo con nombre. `inverted`: sobre la barra grafito. */
export function Logo({ className, showText = true, inverted = false }: { className?: string; showText?: boolean; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showText && <span className={cn('font-display text-lg font-bold', inverted ? 'text-rail-fg' : 'text-fg-warm')}>CarCare</span>}
    </span>
  )
}

export function Splash({ label = 'Cargando CarCare…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas" role="status">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-12 animate-pulse" />
        <span className="text-sm text-fg-subtle">{label}</span>
      </div>
    </div>
  )
}

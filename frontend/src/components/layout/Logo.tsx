import { cn } from '@/lib/cn'

/**
 * Marca de CarCare («Diorama»): una ficha de azul eléctrico con su canto, y encima una plataforma isométrica con un
 * bloque, como una pieza de maqueta. Los colores son fijos (la marca no cambia con el tema).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <rect y="2" width="32" height="30" rx="9" fill="#1a3fae" />
      <rect width="32" height="30" rx="9" fill="#2559e8" />
      {/* plataforma */}
      <path d="M4 15.5 16 21.5 28 15.5V18.5L16 24.5 4 18.5Z" fill="#7f9fee" />
      <path d="M16 9.5 28 15.5 16 21.5 4 15.5Z" fill="#bcd0ff" />
      {/* bloque */}
      <path d="M11 9.8 16 12.6V17.8L11 15Z" fill="#dbe5fd" />
      <path d="M16 12.6 21 9.8V15L16 17.8Z" fill="#aac0f7" />
      <path d="M16 7 21 9.8 16 12.6 11 9.8Z" fill="#ffffff" />
    </svg>
  )
}

/** Logotipo con nombre. */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showText && <span className="font-display text-lg font-extrabold text-fg-warm">CarCare</span>}
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

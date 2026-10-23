import { cn } from '@/lib/cn'

/** Marca de CarCare: cuentakilómetros estilizado sobre lima. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="9" fill="#c7f36b" />
      <path d="M8.2 21.5a8.6 8.6 0 1 1 15.6 0" fill="none" stroke="#111518" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M16 17.4 20.6 11.6" stroke="#111518" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="17.6" r="2.2" fill="#111518" />
    </svg>
  )
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showText && <span className="font-display text-lg font-semibold tracking-tight text-fg-warm">CarCare</span>}
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

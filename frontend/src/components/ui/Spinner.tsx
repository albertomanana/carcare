import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <>
      <LoaderCircle aria-hidden className={cn('size-4 animate-spin', className)} />
      {label && <span className="sr-only">{label}</span>}
    </>
  )
}

/** Indicador centrado para suspensiones de rutas. */
export function PageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center text-fg-subtle" role="status">
      <div className="flex items-center gap-3 text-sm">
        <LoaderCircle aria-hidden className="size-5 animate-spin text-accent-ink" />
        {label}
      </div>
    </div>
  )
}

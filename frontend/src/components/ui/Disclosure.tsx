import { ChevronRight } from 'lucide-react'
import { type ReactNode, useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Bloque plegable ("Más detalles", "Desglosar…"): botón con `aria-expanded` y el contenido debajo. Cerrado, puede
 * enseñar a su lado un resumen de lo que hay dentro, para que nada quede escondido sin decirlo.
 */
export function Disclosure({
  label,
  summary,
  open,
  onOpenChange,
  children,
  className,
}: {
  label: ReactNode
  /** Texto gris junto al botón mientras está cerrado. */
  summary?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}) {
  const id = `d${useId().replace(/:/g, '')}`
  return (
    <div className={cn('min-w-0', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => onOpenChange(!open)}
        className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-control text-left text-sm font-medium text-fg hover:text-fg-warm md:min-h-9"
      >
        <ChevronRight aria-hidden className={cn('size-4 shrink-0 text-fg-subtle transition-transform duration-150 ease-out-soft motion-reduce:transition-none', open && 'rotate-90')} />
        <span>
          {label}
          {summary && !open && <span className="font-normal text-fg-muted"> · {summary}</span>}
        </span>
      </button>
      {open && (
        <div id={id} className="mt-3 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

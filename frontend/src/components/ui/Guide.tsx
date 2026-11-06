import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Marca lo que toca hacer ahora con un anillo que late tres veces (ver `.guide-ring` en index.css). Cambiar `cue`
 * lo repite. No cambia el orden de tabulación ni el contenido: es una ayuda visual, no un control.
 */
export function Guide({ on, cue, className, children }: { on: boolean; cue: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {on && <span key={cue} aria-hidden className="guide-ring" />}
    </div>
  )
}

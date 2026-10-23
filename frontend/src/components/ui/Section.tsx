import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Bloque de página con título h2 y acción opcional. */
export function Section({ title, description, action, children, className, id }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section className={cn('min-w-0', className)} aria-labelledby={headingId} id={id}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-lg font-semibold tracking-tight text-fg-warm">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  )
}

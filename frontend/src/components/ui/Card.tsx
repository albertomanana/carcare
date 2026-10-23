import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-card border border-line bg-surface', className)} {...props} />
}

export interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
  /** Nivel del encabezado (h2 por defecto). */
  as?: 'h2' | 'h3'
  id?: string
}

export function CardHeader({ title, description, action, icon, className, as: As = 'h2', id }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-control bg-surface-2 text-fg-muted [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <As id={id} className="font-display text-base font-semibold tracking-tight text-fg-warm">
            {title}
          </As>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />
}

/** Lista de definición clave/valor (fichas técnicas). */
export function DataList({ items, className }: { items: { label: ReactNode; value: ReactNode; empty?: boolean }[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line', className)}>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3">
          <dt className="text-sm text-fg-muted">{item.label}</dt>
          <dd className={cn('text-sm', item.empty ? 'italic text-fg-subtle' : 'text-fg')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

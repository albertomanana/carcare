import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  className?: string
  children?: ReactNode
}

export function PageHeader({ title, description, eyebrow, actions, back, className, children }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 md:mb-8', className)}>
      {back && (
        <Link to={back.to} className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-fg-muted hover:text-fg md:min-h-0">
          <ArrowLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">{eyebrow}</div>}
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg-warm text-balance md:text-3xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-fg-muted md:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

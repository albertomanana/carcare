import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'

export interface Crumb {
  label: string
  /** Sin `to`, es la pantalla actual (el último paso). */
  to?: string
}

/**
 * Migas de pan de las pantallas de segundo nivel ("Garaje › Kia Sportage › Gastos"). En el móvil no caben: queda
 * solo el paso anterior como enlace de vuelta, igual que el antiguo "← Garaje".
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const parent = [...items].reverse().find((c) => c.to)
  if (!items.length) return null
  return (
    <nav aria-label="Ruta de navegación" className={cn('no-print text-sm', className)}>
      <ol className="hidden min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-fg-muted sm:flex">
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />}
              {c.to && !last ? (
                <Link to={c.to} className="max-w-[16rem] truncate rounded-control underline-offset-4 hover:text-fg hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn('max-w-[16rem] truncate', last && 'text-fg')}>
                  {c.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {parent?.to && (
        <Link to={parent.to} className="inline-flex min-h-11 items-center gap-1.5 text-fg-muted hover:text-fg sm:hidden">
          <ArrowLeft aria-hidden className="size-4" />
          {parent.label}
        </Link>
      )}
    </nav>
  )
}

import type { ReactNode } from 'react'
import { Breadcrumbs, type Crumb } from '@/components/ui/Breadcrumbs'
import { cn } from '@/lib/cn'
import '../diorama.css'

/**
 * Cabecera de pantalla del taller en el mundo «Diorama»: un panel flotante con migas de pan, el título de la pantalla,
 * su descripción y sus acciones (la primaria azul, una sola). Es el equivalente de `PageHeader` para el HUD del taller
 * (el `PageHeader` del sistema es compartido con el particular y no se toca).
 */
export function WorkshopHeader({
  title,
  description,
  crumbs,
  back,
  actions,
  className,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  crumbs?: Crumb[]
  /** Atajo de una pantalla con un solo padre: se pinta como migas «Padre › Título». */
  back?: { to: string; label: string }
  actions?: ReactNode
  className?: string
  children?: ReactNode
}) {
  const backCrumbs: Crumb[] | undefined = back ? [{ label: back.label, to: back.to }, { label: typeof title === 'string' ? title : 'Detalle' }] : undefined
  return (
    <header className={cn('hud-panel mb-5 flex flex-col gap-2 px-4 py-3.5 sm:px-5 md:mb-6', className)}>
      {(crumbs ?? backCrumbs) && <Breadcrumbs items={(crumbs ?? backCrumbs)!} />}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-fg-warm text-balance md:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 max-w-3xl text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

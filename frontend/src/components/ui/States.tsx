import { CloudOff, Lock, RotateCcw, SearchX, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { errorMessage, isApiError } from '@/api/client'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
  children?: ReactNode
}

export function EmptyState({ icon, title, description, action, className, compact, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-line text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      {icon && (
        <span className={cn('grid place-items-center rounded-full bg-surface-2 text-fg-muted', compact ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-6')}>{icon}</span>
      )}
      <div className="max-w-md">
        <h3 className={cn('font-display font-semibold text-fg-warm', compact ? 'text-sm' : 'text-lg')}>{title}</h3>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

export function NoResults({ onReset, what = 'resultados' }: { onReset?: () => void; what?: string }) {
  return (
    <EmptyState
      compact
      icon={<SearchX />}
      title={`Sin ${what} con estos filtros`}
      description="Prueba a quitar algún filtro o a cambiar la búsqueda."
      action={onReset && <Button onClick={onReset}>Quitar filtros</Button>}
    />
  )
}

export interface ErrorStateProps {
  error?: unknown
  title?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorState({ error, title, onRetry, className, compact }: ErrorStateProps) {
  const status = isApiError(error) ? error.status : null
  const Icon = status === 0 ? CloudOff : status === 403 ? Lock : TriangleAlert
  const heading =
    title ??
    (status === 403 ? 'No tienes permiso para ver esto' : status === 404 ? 'No encontrado' : status === 0 ? 'Sin conexión con el servidor' : 'No se pudo cargar')
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-danger/30 bg-danger-soft/40 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="max-w-md">
        <h3 className="font-display text-base font-semibold text-fg-warm">{heading}</h3>
        {error !== undefined && status !== 403 && <p className="mt-1 text-sm text-fg-muted">{errorMessage(error)}</p>}
        {status === 403 && <p className="mt-1 text-sm text-fg-muted">Tu rol en este espacio no incluye esta sección.</p>}
      </div>
      {onRetry && status !== 403 && status !== 404 && (
        <Button onClick={onRetry} icon={<RotateCcw aria-hidden />}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

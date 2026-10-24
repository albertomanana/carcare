import { cn } from '@/lib/cn'
import { Button } from './Button'

export interface LoadMoreProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
  shown: number
  total: number | null
  what?: string
  /** Texto del botón ('Cargar más' por defecto). */
  label?: string
  className?: string
}

/** "Cargar más" para listados paginados del contrato (meta.current_page / last_page). */
export function LoadMore({ hasNextPage, isFetchingNextPage, fetchNextPage, shown, total, what = 'elementos', label = 'Cargar más', className }: LoadMoreProps) {
  if (!total) return null
  return (
    <div className={cn('mt-6 flex flex-col items-center gap-2', className)}>
      <p className="text-xs text-fg-subtle tabular" aria-live="polite">
        Mostrando {new Intl.NumberFormat('es-ES').format(shown)} de {new Intl.NumberFormat('es-ES').format(total)} {what}
      </p>
      {hasNextPage && (
        <Button onClick={() => void fetchNextPage()} loading={isFetchingNextPage}>
          {label}
        </Button>
      )}
    </div>
  )
}

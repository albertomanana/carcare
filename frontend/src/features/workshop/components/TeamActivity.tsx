import { History } from 'lucide-react'
import { Link } from 'react-router'
import type { Activity } from '@/api/types'
import { EmptyState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { formatDateTime, formatRelativeTime } from '@/lib/format'
import { activityHref } from './floor'

/**
 * Actividad del equipo: quién hizo qué y cuándo (frases que redacta el servidor).
 * Lista con separador fino, sin caja (R3, R4) y sin iniciales en círculo: el nombre ya va en la frase (R7).
 */
export function TeamActivity({ items, limit = 8 }: { items: Activity[]; limit?: number }) {
  const ctx = useWorkspace()
  if (!items.length) return <EmptyState compact icon={<History />} title="Sin actividad todavía" description="Aquí verás lo que vaya haciendo el equipo: órdenes abiertas, cambios de estado, entregas…" />
  return (
    <ol className="border-t border-line">
      {items.slice(0, limit).map((a) => {
        const href = activityHref(ctx.base, a)
        const content = (
          <>
            <span className="min-w-0 flex-1 text-sm text-fg">{a.summary}</span>
            <time dateTime={a.created_at} title={formatDateTime(a.created_at)} className="shrink-0 text-xs text-fg-subtle tabular">
              {formatRelativeTime(a.created_at, undefined, { pastOnly: true })}
            </time>
          </>
        )
        return (
          <li key={a.id} className="border-b border-line">
            {href ? (
              <Link to={href} className="flex flex-col gap-0.5 px-1 py-2.5 transition-colors duration-150 hover:bg-surface-2/60 sm:flex-row sm:items-baseline sm:gap-4">
                {content}
              </Link>
            ) : (
              <div className="flex flex-col gap-0.5 px-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

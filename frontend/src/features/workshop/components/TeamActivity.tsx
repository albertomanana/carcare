import { History } from 'lucide-react'
import { Link } from 'react-router'
import type { Activity } from '@/api/types'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { formatDateTime, formatRelativeTime } from '@/lib/format'

/** Enlace más útil para una entrada de actividad: la orden, el cliente o el vehículo. */
export function activityHref(base: string, a: Activity): string | null {
  if (a.entity_type === 'work_order') return `${base}/ordenes/${a.entity_id}`
  if (a.entity_type === 'customer') return `${base}/clientes/${a.entity_id}`
  if (a.entity_type === 'member') return `${base}/equipo`
  if (a.vehicle_id) return `${base}/vehiculos/${a.vehicle_id}`
  return null
}

/** Actividad del equipo: quién hizo qué y cuándo (frases que redacta el servidor). */
export function TeamActivity({ items, limit = 8 }: { items: Activity[]; limit?: number }) {
  const ctx = useWorkspace()
  if (!items.length) return <EmptyState compact icon={<History />} title="Sin actividad todavía" description="Aquí verás lo que vaya haciendo el equipo: órdenes abiertas, cambios de estado, entregas…" />
  return (
    <ol className="divide-y divide-line rounded-card border border-line bg-surface">
      {items.slice(0, limit).map((a) => {
        const href = activityHref(ctx.base, a)
        const content = (
          <>
            <Avatar name={a.user?.name ?? 'Sistema'} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-fg">{a.summary}</span>
              <span className="block text-xs text-fg-subtle">
                <time dateTime={a.created_at} title={formatDateTime(a.created_at)}>
                  {formatRelativeTime(a.created_at, new Date(), { pastOnly: true })}
                </time>
              </span>
            </span>
          </>
        )
        return (
          <li key={a.id}>
            {href ? (
              <Link to={href} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60">
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

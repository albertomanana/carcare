import { useRepairRequestHistory } from '@/api/hooks/repairRequests'
import type { ID } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { formatDate, formatKm } from '@/lib/format'
import { RECORD_TYPE_LABEL, ZONE_LABEL } from '@/lib/labels'

/**
 * Historial compartido de una solicitud (§3.13.7): fecha, tipo, zona, título, km y taller. Sin importes, descripciones,
 * líneas ni documentos. El particular lo usa para ver lo mismo que ve el taller; el taller, para presupuestar.
 * Solo se pide si `history_available` (si no, la API da 403).
 */
export function SharedHistoryList({ requestId, enabled = true }: { requestId: ID; enabled?: boolean }) {
  const query = useRepairRequestHistory(requestId, enabled)

  if (query.isPending)
    return (
      <div role="status" aria-live="polite" className="divide-y divide-line border-y border-line">
        <span className="sr-only">Cargando el historial…</span>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} aria-hidden className="space-y-1.5 py-2.5">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        ))}
      </div>
    )
  if (query.isError) return <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
  if (query.data.length === 0) return <p className="text-sm text-fg-muted">Este coche no tiene intervenciones anotadas.</p>

  return (
    <ul className="divide-y divide-line border-y border-line" aria-label="Historial compartido">
      {query.data.map((e, i) => (
        <li key={i} className="py-2.5 text-sm">
          <p className="font-medium text-fg">{e.title}</p>
          <p className="text-fg-muted">
            <span className="tabular">{formatDate(e.service_date)}</span>
            {' · '}
            {RECORD_TYPE_LABEL[e.type]}
            {' · '}
            {ZONE_LABEL[e.zone]}
            {e.mileage !== null && (
              <>
                {' · '}
                <span className="tabular">{formatKm(e.mileage)}</span>
              </>
            )}
            {e.workshop_name && ` · ${e.workshop_name}`}
          </p>
        </li>
      ))}
    </ul>
  )
}

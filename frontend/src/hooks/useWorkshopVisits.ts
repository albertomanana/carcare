import { useMemo } from 'react'
import { useConvertedRequests } from '@/api/hooks/repairRequests'
import type { ID } from '@/api/types'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { openVisits, type WorkshopVisit } from '@/lib/workshopVisit'

const NONE = new Map<ID, WorkshopVisit>()

/**
 * Coches del garaje que están ahora en un taller (solo en espacios personales): vehículo → visita abierta.
 * Sale de las solicitudes convertidas; se refresca cada minuto. Mientras carga, o si falla, no hay visitas:
 * el garaje se ve como siempre.
 */
export function useWorkshopVisits(): Map<ID, WorkshopVisit> {
  const ctx = useWorkspace()
  const requests = useConvertedRequests(ctx.id, !ctx.isWorkshop)
  return useMemo(() => (requests.data ? openVisits(requests.data) : NONE), [requests.data])
}

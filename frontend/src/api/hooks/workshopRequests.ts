/**
 * E16 · lado del taller (contrato §3.13): decidir sobre una solicitud recibida (aceptar con o sin presupuesto,
 * rechazar con motivo, enviar otra versión del presupuesto) y guardar el perfil del directorio.
 * Solo owner y manager (`manage`); el mecánico recibe 403 y la SPA no le muestra los botones.
 * Las consultas (listado, detalle, historial, perfil) están en `repairRequests.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { qk } from '../keys'
import type {
  AcceptRepairRequestInput,
  DirectoryProfile,
  DirectoryProfileInput,
  ID,
  Paginated,
  RejectRepairRequestInput,
  RepairQuoteInput,
  RepairRequest,
  Resource,
} from '../types'
import { afterRepairRequestChange, refetchOnConflict } from './repairRequests'

/** POST /accept. Con `quote` ⇒ `quoted` (versión 1); sin él ⇒ `accepted` ("lo añadiré después"). */
export function useAcceptRepairRequest(ws: ID, id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AcceptRepairRequestInput) => (await api.post<Resource<RepairRequest>>(`/repair-requests/${id}/accept`, input)).data,
    onSuccess: (request) => afterRepairRequestChange(qc, request, ws),
    onError: (error) => refetchOnConflict(qc, id, error),
  })
}

/** POST /reject con motivo (5–500). La versión vigente, si la hay, pasa a `superseded`. */
export function useRejectRepairRequest(ws: ID, id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RejectRepairRequestInput) => (await api.post<Resource<RepairRequest>>(`/repair-requests/${id}/reject`, input)).data,
    onSuccess: (request) => afterRepairRequestChange(qc, request, ws),
    onError: (error) => refetchOnConflict(qc, id, error),
  })
}

/** POST /quotes: versión n+1 (desde `accepted` o `quoted`). La vigente anterior pasa a `superseded`. */
export function useSendRepairQuote(ws: ID, id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RepairQuoteInput) => (await api.post<Resource<RepairRequest>>(`/repair-requests/${id}/quotes`, input)).data,
    onSuccess: (request) => afterRepairRequestChange(qc, request, ws),
    onError: (error) => refetchOnConflict(qc, id, error),
  })
}

/** PUT del perfil del directorio (solo el owner; manager y mecánico ⇒ 403). */
export function useSaveDirectoryProfile(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DirectoryProfileInput) => (await api.put<Resource<DirectoryProfile>>(`/workspaces/${ws}/directory-profile`, input)).data,
    onSuccess: (profile) => {
      qc.setQueryData(qk.directoryProfile(ws), profile)
      // El directorio que ven los particulares y la actividad del taller ("Ana actualizó el perfil del directorio")
      void qc.invalidateQueries({ queryKey: ['directory'] })
      void qc.invalidateQueries({ queryKey: qk.activity(ws).slice(0, 3) })
    },
  })
}

/** La solicitud de la que viene una orden (`?work_order_id=`), o null si la orden se abrió a mano. */
export function useRequestForOrder(ws: ID, workOrderId: ID | undefined) {
  return useQuery({
    queryKey: qk.repairRequests(ws, { work_order_id: workOrderId, per_page: 1 }),
    queryFn: async ({ signal }) =>
      (await api.get<Paginated<RepairRequest>>(`/workspaces/${ws}/repair-requests`, { work_order_id: workOrderId, per_page: 1 }, { signal })).data[0] ?? null,
    enabled: !!workOrderId,
  })
}

/** Cuántas solicitudes hay en un estado (para el contador de la pestaña "Nuevas"): pide una sola fila. */
export function useRepairRequestCount(ws: ID, status: string) {
  return useQuery({
    queryKey: qk.repairRequests(ws, { status, per_page: 1 }),
    queryFn: async ({ signal }) => (await api.get<Paginated<RepairRequest>>(`/workspaces/${ws}/repair-requests`, { status, per_page: 1 }, { signal })).meta.total,
  })
}

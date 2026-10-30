/**
 * E16 · directorio de talleres y solicitudes de reparación (contrato §3.13, ADR‑0007).
 * Aquí van las consultas de las dos partes, el directorio y las mutaciones del particular.
 * Las mutaciones del taller (aceptar, rechazar, enviar presupuesto, perfil) van en `workshopRequests.ts`
 * y usan `afterRepairRequestChange` para invalidar lo mismo.
 */
import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError, type QueryParams } from '../client'
import { qk } from '../keys'
import type {
  DirectoryProfile,
  DirectoryWorkshop,
  ID,
  Paginated,
  QuoteDecisionInput,
  RepairRequest,
  RepairRequestInput,
  RepairRequestUpdateInput,
  Resource,
  SharedHistoryEntry,
} from '../types'
import { useInfiniteList } from './shared'

// ───────── Directorio ─────────

/** GET /workshops: talleres del directorio (solo `listed`), por nombre. `search` busca en nombre o ciudad. */
export function useDirectory(params: QueryParams = {}) {
  return useQuery({
    queryKey: qk.directory(params),
    queryFn: ({ signal }) => api.get<Paginated<DirectoryWorkshop>>('/workshops', params, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useDirectoryWorkshop(id: ID | undefined) {
  return useQuery({
    queryKey: qk.directoryWorkshop(id ?? 0),
    queryFn: async ({ signal }) => (await api.get<Resource<DirectoryWorkshop>>(`/workshops/${id}`, undefined, { signal })).data,
    enabled: !!id,
  })
}

/** Perfil del directorio de un taller (Ajustes). En un espacio personal la API da 404: no se pide. */
export function useDirectoryProfile(ws: ID, enabled = true) {
  return useQuery({
    queryKey: qk.directoryProfile(ws),
    queryFn: async ({ signal }) => (await api.get<Resource<DirectoryProfile>>(`/workspaces/${ws}/directory-profile`, undefined, { signal })).data,
    enabled,
  })
}

// ───────── Solicitudes: consultas (las dos partes) ─────────

/**
 * Solicitudes del espacio: las enviadas (personal) o las recibidas (taller), de la más reciente a la más antigua.
 * `status` admite una lista separada por comas u `open` (= pending, accepted, quoted).
 */
export function useRepairRequests(ws: ID, params: QueryParams = {}, enabled = true) {
  return useInfiniteList<RepairRequest>(qk.repairRequests(ws, params), `/workspaces/${ws}/repair-requests`, params, enabled)
}

export function useRepairRequest(id: ID | undefined) {
  return useQuery({
    queryKey: qk.repairRequest(id ?? 0),
    queryFn: async ({ signal }) => (await api.get<Resource<RepairRequest>>(`/repair-requests/${id}`, undefined, { signal })).data,
    enabled: !!id,
  })
}

/** Historial compartido (sin importes). Solo se pide con `history_available`; si no, la API da 403. */
export function useRepairRequestHistory(id: ID | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.repairRequestHistory(id ?? 0),
    queryFn: async ({ signal }) => (await api.get<{ data: SharedHistoryEntry[] }>(`/repair-requests/${id}/history`, undefined, { signal })).data,
    enabled: !!id && enabled,
  })
}

// ───────── Invalidación común ─────────

/**
 * Tras cualquier cambio de una solicitud (de cualquiera de las dos partes):
 * - el detalle se sustituye por la respuesta de la API;
 * - se invalidan los listados de solicitudes de todos los espacios, su historial y las notificaciones;
 * - con `ws`, todo lo del espacio (actividad, dashboard y, en el taller, órdenes y clientes tras la conversión).
 */
export function afterRepairRequestChange(qc: QueryClient, request: RepairRequest, ws?: ID) {
  qc.setQueryData(qk.repairRequest(request.id), request)
  void qc.invalidateQueries({ queryKey: qk.repairRequestHistory(request.id) })
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'repair-requests' })
  void qc.invalidateQueries({ queryKey: ['notifications'] })
  if (ws) void qc.invalidateQueries({ queryKey: ['workspaces', ws] })
}

/** 409 o 403 al actuar: los datos que se ven están desfasados (otra persona respondió antes). Se vuelve a pedir la solicitud. */
export function refetchOnConflict(qc: QueryClient, id: ID, error: unknown) {
  if (isApiError(error) && (error.status === 409 || error.status === 403)) {
    void qc.invalidateQueries({ queryKey: qk.repairRequest(id) })
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'repair-requests' })
  }
}

// ───────── Solicitudes: mutaciones del particular ─────────

/** POST /workspaces/{ws}/repair-requests (solo el owner de un espacio personal). */
export function useCreateRepairRequest(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RepairRequestInput) => (await api.post<Resource<RepairRequest>>(`/workspaces/${ws}/repair-requests`, input)).data,
    onSuccess: (request) => afterRepairRequestChange(qc, request, ws),
  })
}

/** PATCH share_history: dar o retirar el consentimiento del historial. */
export function useUpdateRepairRequest(id: ID, ws?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RepairRequestUpdateInput) => (await api.patch<Resource<RepairRequest>>(`/repair-requests/${id}`, input)).data,
    onSuccess: (request) => afterRepairRequestChange(qc, request, ws),
    onError: (error) => refetchOnConflict(qc, id, error),
  })
}

export function useCancelRepairRequest(id: ID, ws?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post<Resource<RepairRequest>>(`/repair-requests/${id}/cancel`)).data,
    onSuccess: (request) => afterRepairRequestChange(qc, request, ws),
    onError: (error) => refetchOnConflict(qc, id, error),
  })
}

/** Aceptar la versión vigente: la solicitud pasa a `converted` y el taller abre la orden. */
export function useAcceptQuote(id: ID, ws?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: QuoteDecisionInput) => (await api.post<Resource<RepairRequest>>(`/repair-requests/${id}/quote/accept`, input)).data,
    onSuccess: (request) => afterRepairRequestChange(qc, request, ws),
    onError: (error) => refetchOnConflict(qc, id, error),
  })
}

/** Rechazar la versión vigente (motivo opcional): la solicitud vuelve a `accepted`. */
export function useRejectQuote(id: ID, ws?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: QuoteDecisionInput) => (await api.post<Resource<RepairRequest>>(`/repair-requests/${id}/quote/reject`, input)).data,
    onSuccess: (request) => afterRepairRequestChange(qc, request, ws),
    onError: (error) => refetchOnConflict(qc, id, error),
  })
}

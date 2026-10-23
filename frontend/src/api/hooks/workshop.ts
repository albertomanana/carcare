/** Taller: clientes, órdenes de trabajo y elevadores. */
import { type InfiniteData, keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type QueryParams } from '../client'
import { qk } from '../keys'
import type {
  Bay,
  Customer,
  CustomerInput,
  ID,
  Paginated,
  Resource,
  Vehicle,
  WorkOrder,
  WorkOrderInput,
  WorkOrderStatus,
  WorkOrderStatusInput,
  WorkshopDashboard,
  WorkspaceDashboard,
} from '../types'
import { useInfiniteList } from './shared'

/** Refresco periódico de las vistas "en vivo" del taller (centro de control, taller 3D, tablero). */
export const LIVE_REFRESH_MS = 60_000

// ───────── Clientes ─────────

export function useCustomers(ws: ID, params: QueryParams = {}) {
  return useInfiniteList<Customer>(qk.customers(ws, params), `/workspaces/${ws}/customers`, params)
}

export function useCustomerSearch(ws: ID, search: string, enabled = true) {
  return useQuery({
    queryKey: qk.customers(ws, { search, per_page: 8 }),
    queryFn: ({ signal }) => api.get<Paginated<Customer>>(`/workspaces/${ws}/customers`, { search, per_page: 8 }, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useCustomer(id: ID | undefined) {
  return useQuery({
    queryKey: qk.customer(id ?? 0),
    queryFn: async ({ signal }) => (await api.get<Resource<Customer>>(`/customers/${id}`, undefined, { signal })).data,
    enabled: !!id,
  })
}

export function useCustomerVehicles(id: ID) {
  return useQuery({
    queryKey: qk.customerVehicles(id),
    queryFn: async ({ signal }) => (await api.get<{ data: Vehicle[] }>(`/customers/${id}/vehicles`, undefined, { signal })).data,
  })
}

export function useSaveCustomer(ws: ID, customerId?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CustomerInput) =>
      customerId
        ? (await api.patch<Resource<Customer>>(`/customers/${customerId}`, input)).data
        : (await api.post<Resource<Customer>>(`/workspaces/${ws}/customers`, input)).data,
    onSuccess: (customer) => {
      qc.setQueryData(qk.customer(customer.id), customer)
      void qc.invalidateQueries({ queryKey: ['workspaces', ws] })
    },
  })
}

export function useDeleteCustomer(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => api.delete<void>(`/customers/${id}`),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.customer(id) })
      void qc.invalidateQueries({ queryKey: ['workspaces', ws] })
    },
  })
}

// ───────── Órdenes ─────────

export function useWorkOrders(ws: ID, params: QueryParams = {}, enabled = true, refetchInterval?: number) {
  return useQuery({
    queryKey: qk.workOrders(ws, params),
    queryFn: ({ signal }) => api.get<Paginated<WorkOrder>>(`/workspaces/${ws}/work-orders`, params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval,
  })
}

/** Todas las órdenes abiertas (tablero kanban, zona de espera del taller). El contrato admite hasta 200. */
export function useOpenWorkOrders(ws: ID, params: QueryParams = {}, refetchInterval?: number) {
  return useWorkOrders(ws, { status: 'open', per_page: 200, ...params }, true, refetchInterval)
}

export function useWorkOrdersInfinite(ws: ID, params: QueryParams = {}, enabled = true) {
  return useInfiniteList<WorkOrder>(qk.workOrders(ws, params), `/workspaces/${ws}/work-orders`, params, enabled)
}

export function useWorkOrder(id: ID | undefined) {
  return useQuery({
    queryKey: qk.workOrder(id ?? 0),
    queryFn: async ({ signal }) => (await api.get<Resource<WorkOrder>>(`/work-orders/${id}`, undefined, { signal })).data,
    enabled: !!id,
  })
}

export function useBays(ws: ID, enabled = true, refetchInterval?: number) {
  return useQuery({
    queryKey: qk.bays(ws),
    queryFn: async ({ signal }) => (await api.get<{ data: Bay[] }>(`/workspaces/${ws}/bays`, undefined, { signal })).data,
    enabled,
    refetchInterval,
  })
}

/** Dashboard de un taller (misma clave que useDashboard) con refresco periódico para el centro de control. */
export function useWorkshopDashboard(ws: ID) {
  return useQuery({
    queryKey: qk.dashboard(ws),
    queryFn: async ({ signal }) => (await api.get<Resource<WorkspaceDashboard>>(`/workspaces/${ws}/dashboard`, undefined, { signal })).data,
    select: (d): WorkshopDashboard | null => (d.type === 'workshop' ? d : null),
    refetchInterval: LIVE_REFRESH_MS,
  })
}

function afterOrderChange(qc: QueryClient, ws: ID, order: WorkOrder) {
  qc.setQueryData(qk.workOrder(order.id), order)
  void qc.invalidateQueries({ queryKey: ['workspaces', ws] })
  void qc.invalidateQueries({ queryKey: ['vehicles', order.vehicle.id] })
  if (order.customer) void qc.invalidateQueries({ queryKey: ['customers', order.customer.id] })
}

export function useSaveWorkOrder(ws: ID, orderId?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<WorkOrderInput>) =>
      orderId
        ? (await api.patch<Resource<WorkOrder>>(`/work-orders/${orderId}`, input)).data
        : (await api.post<Resource<WorkOrder>>(`/workspaces/${ws}/work-orders`, input)).data,
    onSuccess: (order) => afterOrderChange(qc, ws, order),
  })
}

export function useDeleteWorkOrder(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => api.delete<void>(`/work-orders/${id}`),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.workOrder(id) })
      void qc.invalidateQueries({ queryKey: ['workspaces', ws] })
    },
  })
}

// ───────── Cambio de estado (optimista) ─────────

const FINAL: WorkOrderStatus[] = ['delivered', 'cancelled']
const RELEASES_BAY: WorkOrderStatus[] = ['ready', 'delivered', 'cancelled']

/** Elevador resultante de un cambio de estado, con la misma regla que el servidor (§3.11). */
export function nextBay(order: Pick<WorkOrder, 'status' | 'bay'>, input: WorkOrderStatusInput): number | null {
  if (FINAL.includes(input.status)) return null
  if (input.bay !== undefined) return input.bay
  if (RELEASES_BAY.includes(input.status) && input.status !== order.status) return null
  return order.bay
}

function patchOrder(o: WorkOrder, input: WorkOrderStatusInput): WorkOrder {
  const releases = RELEASES_BAY.includes(input.status)
  return { ...o, status: input.status, bay: nextBay(o, input), is_late: releases ? false : o.is_late }
}

type ListData = Paginated<WorkOrder> | InfiniteData<Paginated<WorkOrder>> | undefined

function patchList(old: ListData, id: ID, input: WorkOrderStatusInput): ListData {
  if (!old) return old
  const mapPage = (page: Paginated<WorkOrder>) =>
    Array.isArray(page?.data) ? { ...page, data: page.data.map((o) => (o.id === id ? patchOrder(o, input) : o)) } : page
  if ('pages' in old && Array.isArray(old.pages)) return { ...old, pages: old.pages.map(mapPage) }
  if ('data' in old) return mapPage(old)
  return old
}

/** Reubica la orden en la lista de elevadores (sale del suyo, entra en el nuevo si lo hay). */
function patchBays(bays: Bay[], id: ID, input: WorkOrderStatusInput, source: WorkOrder | undefined): Bay[] {
  const current = source ?? bays.find((b) => b.work_order?.id === id)?.work_order ?? undefined
  if (!current) return bays
  const updated = patchOrder(current, input)
  return bays.map((b) => {
    if (b.number === updated.bay) return { ...b, work_order: updated }
    if (b.work_order?.id === id) return { ...b, work_order: null }
    return b
  })
}

type Snapshot = [readonly unknown[], unknown][]

/**
 * Cambio de estado con actualización optimista en todos los listados de órdenes del espacio
 * (tablero kanban, lista paginada), en los elevadores y en el dashboard. Si el servidor responde 409
 * u otro error, se restaura todo lo anterior.
 */
export function useChangeWorkOrderStatus(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: ID; input: WorkOrderStatusInput }) =>
      (await api.post<Resource<WorkOrder>>(`/work-orders/${id}/status`, input)).data,
    onMutate: async ({ id, input }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: qk.workOrdersAll(ws) }),
        qc.cancelQueries({ queryKey: qk.bays(ws) }),
        qc.cancelQueries({ queryKey: qk.dashboard(ws) }),
        qc.cancelQueries({ queryKey: qk.workOrder(id) }),
      ])
      const snapshot: Snapshot = [
        ...(qc.getQueriesData({ queryKey: qk.workOrdersAll(ws) }) as Snapshot),
        [qk.bays(ws), qc.getQueryData(qk.bays(ws))],
        [qk.dashboard(ws), qc.getQueryData(qk.dashboard(ws))],
        [qk.workOrder(id), qc.getQueryData(qk.workOrder(id))],
      ]

      // Orden de referencia: la del detalle o la de cualquier listado cargado
      const detail = qc.getQueryData<WorkOrder>(qk.workOrder(id))
      let source = detail
      if (!source) {
        for (const [, data] of qc.getQueriesData<ListData>({ queryKey: qk.workOrdersAll(ws) })) {
          const pages = data && 'pages' in data ? data.pages : data ? [data] : []
          source = pages.flatMap((p) => p?.data ?? []).find((o) => o.id === id)
          if (source) break
        }
      }

      qc.setQueriesData<ListData>({ queryKey: qk.workOrdersAll(ws) }, (old) => patchList(old, id, input))
      qc.setQueryData<Bay[]>(qk.bays(ws), (old) => (old ? patchBays(old, id, input, source) : old))
      qc.setQueryData<WorkspaceDashboard>(qk.dashboard(ws), (old) =>
        old && old.type === 'workshop' ? { ...old, bays: patchBays(old.bays, id, input, source) } : old,
      )
      if (detail) qc.setQueryData(qk.workOrder(id), patchOrder(detail, input))
      return { snapshot }
    },
    onError: (_err, { id }, ctx) => {
      // setQueryData(undefined) no hace nada: solo se restaura lo que había en caché
      ctx?.snapshot.forEach(([key, data]) => {
        if (data !== undefined) qc.setQueryData(key, data)
      })
      // Un 409 suele significar que nuestros datos estaban desfasados (otro usuario ocupó el elevador
      // o cerró la orden): se vuelve a pedir todo para mostrar el estado real.
      void qc.invalidateQueries({ queryKey: ['workspaces', ws] })
      void qc.invalidateQueries({ queryKey: qk.workOrder(id) })
    },
    onSuccess: (order) => afterOrderChange(qc, ws, order),
  })
}

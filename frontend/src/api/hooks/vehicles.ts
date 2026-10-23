import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type QueryParams } from '../client'
import { qk } from '../keys'
import type {
  ID,
  JournalDay,
  MileageInput,
  MileageLog,
  Paginated,
  Resource,
  Vehicle,
  VehicleInput,
  VehicleReport,
  VehicleSummary,
  ZoneStatus,
} from '../types'
import { invalidateVehicle, useInfiniteList } from './shared'

export function useVehicles(ws: ID | undefined, params: QueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: qk.vehicles(ws ?? 0, params),
    queryFn: ({ signal }) => api.get<Paginated<Vehicle>>(`/workspaces/${ws}/vehicles`, params, { signal }),
    enabled: !!ws && enabled,
    placeholderData: keepPreviousData,
  })
}

export function useVehiclesInfinite(ws: ID, params: QueryParams = {}) {
  return useInfiniteList<Vehicle>(qk.vehicles(ws, params), `/workspaces/${ws}/vehicles`, params)
}

export function useVehicle(id: ID | undefined) {
  return useQuery({
    queryKey: qk.vehicleDetail(id ?? 0),
    queryFn: async ({ signal }) => (await api.get<Resource<Vehicle>>(`/vehicles/${id}`, undefined, { signal })).data,
    enabled: !!id,
  })
}

export function useCreateVehicle(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: VehicleInput) => (await api.post<Resource<Vehicle>>(`/workspaces/${ws}/vehicles`, input)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspaces'] })
      void qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useUpdateVehicle(id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<VehicleInput>) => (await api.patch<Resource<Vehicle>>(`/vehicles/${id}`, input)).data,
    onSuccess: (vehicle) => {
      qc.setQueryData(qk.vehicleDetail(id), vehicle)
      void invalidateVehicle(qc, id)
    },
  })
}

export function useArchiveVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, restore }: { id: ID; restore?: boolean }) =>
      (await api.post<Resource<Vehicle>>(`/vehicles/${id}/${restore ? 'restore' : 'archive'}`)).data,
    onSuccess: (vehicle) => {
      qc.setQueryData(qk.vehicleDetail(vehicle.id), vehicle)
      void invalidateVehicle(qc, vehicle.id)
      void qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => api.delete<void>(`/vehicles/${id}`),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.vehicle(id) })
      void qc.invalidateQueries({ queryKey: ['workspaces'] })
      void qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

// ───────── Lecturas derivadas ─────────

export function useVehicleSummary(id: ID | undefined, params: QueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: qk.summary(id ?? 0, params),
    queryFn: async ({ signal }) => (await api.get<Resource<VehicleSummary>>(`/vehicles/${id}/summary`, params, { signal })).data,
    enabled: !!id && enabled,
    placeholderData: keepPreviousData,
  })
}

export function useZones(id: ID | undefined) {
  return useQuery({
    queryKey: qk.zones(id ?? 0),
    queryFn: async ({ signal }) => (await api.get<{ data: ZoneStatus[] }>(`/vehicles/${id}/zones`, undefined, { signal })).data,
    enabled: !!id,
  })
}

export function useJournal(id: ID, params: QueryParams = {}) {
  return useQuery({
    queryKey: qk.journal(id, params),
    queryFn: async ({ signal }) => (await api.get<{ data: JournalDay[] }>(`/vehicles/${id}/journal`, params, { signal })).data,
    placeholderData: keepPreviousData,
  })
}

export function useVehicleReport(id: ID) {
  return useQuery({
    queryKey: qk.report(id),
    queryFn: async ({ signal }) => (await api.get<Resource<VehicleReport>>(`/vehicles/${id}/report`, undefined, { signal })).data,
  })
}

// ───────── Kilometraje ─────────

export function useMileageLogs(id: ID) {
  return useInfiniteList<MileageLog>(qk.mileage(id), `/vehicles/${id}/mileage`, { per_page: 20 })
}

export function useAddMileage(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MileageInput) => (await api.post<Resource<MileageLog>>(`/vehicles/${vehicleId}/mileage`, input)).data,
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

export function useDeleteMileage(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (logId: ID) => api.delete<void>(`/mileage/${logId}`),
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

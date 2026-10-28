/** Intervenciones, gastos, recordatorios y documentos de un vehículo. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, fetchBlob, type QueryParams } from '../client'
import { qk } from '../keys'
import type {
  CompleteReminderInput,
  CompleteReminderResult,
  Expense,
  ExpenseInput,
  ID,
  MaintenanceInput,
  MaintenanceRecord,
  Reminder,
  ReminderInput,
  ReminderStatus,
  Resource,
  VehicleDocument,
} from '../types'
import { invalidateVehicle, useInfiniteList } from './shared'

// ───────── Intervenciones ─────────

export function useMaintenanceList(vehicleId: ID, params: QueryParams = {}, enabled = true) {
  return useInfiniteList<MaintenanceRecord>(qk.maintenance(vehicleId, params), `/vehicles/${vehicleId}/maintenance`, params, enabled)
}

export function useRecord(id: ID | undefined) {
  return useQuery({
    queryKey: qk.record(id ?? 0),
    queryFn: async ({ signal }) => (await api.get<Resource<MaintenanceRecord>>(`/maintenance/${id}`, undefined, { signal })).data,
    enabled: !!id,
  })
}

export function useSaveRecord(vehicleId: ID, recordId?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MaintenanceInput) =>
      recordId
        ? (await api.patch<Resource<MaintenanceRecord>>(`/maintenance/${recordId}`, input)).data
        : (await api.post<Resource<MaintenanceRecord>>(`/vehicles/${vehicleId}/maintenance`, input)).data,
    onSuccess: (record) => {
      qc.setQueryData(qk.record(record.id), record)
      void invalidateVehicle(qc, vehicleId)
    },
  })
}

export function useArchiveRecord(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, restore }: { id: ID; restore?: boolean }) =>
      (await api.post<Resource<MaintenanceRecord>>(`/maintenance/${id}/${restore ? 'restore' : 'archive'}`)).data,
    onSuccess: (record) => {
      qc.setQueryData(qk.record(record.id), record)
      void invalidateVehicle(qc, vehicleId)
    },
  })
}

// ───────── Gastos ─────────

export function useExpenses(vehicleId: ID, params: QueryParams = {}, enabled = true) {
  return useInfiniteList<Expense>(qk.expenses(vehicleId, params), `/vehicles/${vehicleId}/expenses`, params, enabled)
}

export function useSaveExpense(vehicleId: ID, expenseId?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ExpenseInput) =>
      expenseId
        ? (await api.patch<Resource<Expense>>(`/expenses/${expenseId}`, input)).data
        : (await api.post<Resource<Expense>>(`/vehicles/${vehicleId}/expenses`, input)).data,
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

export function useDeleteExpense(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => api.delete<void>(`/expenses/${id}`),
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

// ───────── Recordatorios ─────────

export function useReminders(vehicleId: ID | undefined, status: ReminderStatus | 'all' = 'pending') {
  return useQuery({
    queryKey: qk.reminders(vehicleId ?? 0, status),
    queryFn: async ({ signal }) => (await api.get<{ data: Reminder[] }>(`/vehicles/${vehicleId}/reminders`, { status }, { signal })).data,
    enabled: !!vehicleId,
  })
}

export function useSaveReminder(vehicleId: ID, reminderId?: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<ReminderInput>) =>
      reminderId
        ? (await api.patch<Resource<Reminder>>(`/reminders/${reminderId}`, input)).data
        : (await api.post<Resource<Reminder>>(`/vehicles/${vehicleId}/reminders`, input)).data,
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

export function useCompleteReminder(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: ID; input: CompleteReminderInput }) =>
      (await api.post<Resource<CompleteReminderResult>>(`/reminders/${id}/complete`, input)).data,
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

export function useDismissReminder(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: ID) => (await api.post<Resource<Reminder>>(`/reminders/${id}/dismiss`)).data,
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

export function useDeleteReminder(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => api.delete<void>(`/reminders/${id}`),
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

/**
 * Acciones sobre recordatorios de cualquier vehículo (agenda del espacio, dashboards):
 * cada variable lleva su vehicle_id para invalidar lo que corresponde.
 */
export function useReminderCommands() {
  const qc = useQueryClient()
  const complete = useMutation({
    mutationFn: async ({ reminder, input }: { reminder: Pick<Reminder, 'id' | 'vehicle_id'>; input: CompleteReminderInput }) =>
      (await api.post<Resource<CompleteReminderResult>>(`/reminders/${reminder.id}/complete`, input)).data,
    onSuccess: (_d, { reminder }) => invalidateVehicle(qc, reminder.vehicle_id),
  })
  const dismiss = useMutation({
    mutationFn: async (reminder: Pick<Reminder, 'id' | 'vehicle_id'>) => (await api.post<Resource<Reminder>>(`/reminders/${reminder.id}/dismiss`)).data,
    onSuccess: (_d, reminder) => invalidateVehicle(qc, reminder.vehicle_id),
  })
  const remove = useMutation({
    mutationFn: (reminder: Pick<Reminder, 'id' | 'vehicle_id'>) => api.delete<void>(`/reminders/${reminder.id}`),
    onSuccess: (_d, reminder) => invalidateVehicle(qc, reminder.vehicle_id),
  })
  /** Cambio parcial (p. ej. posponer: nueva due_date / due_mileage). */
  const update = useMutation({
    mutationFn: async ({ reminder, input }: { reminder: Pick<Reminder, 'id' | 'vehicle_id'>; input: Partial<ReminderInput> }) =>
      (await api.patch<Resource<Reminder>>(`/reminders/${reminder.id}`, input)).data,
    onSuccess: (_d, { reminder }) => invalidateVehicle(qc, reminder.vehicle_id),
  })
  return { complete, dismiss, remove, update }
}

// ───────── Documentos ─────────

export function useDocuments(vehicleId: ID, params: QueryParams = {}) {
  return useQuery({
    queryKey: qk.documents(vehicleId, params),
    queryFn: async ({ signal }) => (await api.get<{ data: VehicleDocument[] }>(`/vehicles/${vehicleId}/documents`, params, { signal })).data,
  })
}

export interface UploadDocumentInput {
  file: File
  title: string
  document_type: VehicleDocument['document_type']
  maintenance_record_id?: ID | null
  expires_at?: string | null
}

export function useUploadDocument(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UploadDocumentInput) => {
      const form = new FormData()
      form.append('file', input.file)
      form.append('title', input.title)
      form.append('document_type', input.document_type)
      if (input.maintenance_record_id) form.append('maintenance_record_id', String(input.maintenance_record_id))
      if (input.expires_at) form.append('expires_at', input.expires_at)
      return (await api.upload<Resource<VehicleDocument>>(`/vehicles/${vehicleId}/documents`, form)).data
    },
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

export function useDeleteDocument(vehicleId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => api.delete<void>(`/documents/${id}`),
    onSuccess: () => invalidateVehicle(qc, vehicleId),
  })
}

/** Archivo de un documento como Blob (descarga autenticada con la cookie de sesión, `?inline=1`). */
export function useDocumentFile(id: ID | null | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.documentFile(id ?? 0),
    queryFn: ({ signal }) => fetchBlob(`/documents/${id}/download`, { inline: 1 }, signal),
    enabled: !!id && enabled,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: 1,
  })
}

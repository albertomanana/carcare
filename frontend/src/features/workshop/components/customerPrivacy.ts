/**
 * Derechos RGPD del cliente del taller (contrato §3.10.1, ADR‑0005): exportar sus datos y anonimizarlo.
 * Las dos llamadas son POST y se tratan como mutaciones (dejan rastro en la actividad y no se reintentan).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/api/client'
import { qk } from '@/api/keys'
import type { Customer, CustomerExport, ID, ISODate, Resource } from '@/api/types'

/** Nombre del archivo que pide el contrato: `cliente-{id}-{AAAA-MM-DD}.json`. */
export function exportFileName(id: ID, date: ISODate): string {
  return `cliente-${id}-${date}.json`
}

/** Guarda un objeto como archivo .json (Blob + enlace de descarga), sin una segunda petición. */
export function saveJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
}

/**
 * Mensaje para los fallos de exportar o anonimizar. El 403 y el 404 llevan un texto propio porque
 * piden algo distinto al usuario; el 409 trae el motivo exacto de la API ("ya está anonimizado",
 * "tiene órdenes abiertas").
 */
export function privacyErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isForbidden) return 'Solo el propietario o un gerente del taller pueden hacerlo.'
    if (error.isNotFound) return 'Este cliente ya no existe en el taller.'
    if (error.message) return error.message
  }
  return 'Algo ha fallado. Inténtalo de nuevo.'
}

export function useExportCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: ID) => (await api.post<Resource<CustomerExport>>(`/customers/${id}/export`)).data,
    // 404: lo han borrado mientras tanto; al recargar, la ficha muestra "No encontramos este cliente".
    onError: (error, id) => {
      if (isApiError(error) && error.isNotFound) void qc.invalidateQueries({ queryKey: qk.customer(id) })
    },
  })
}

export function useAnonymizeCustomer(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: ID) => (await api.post<Resource<Customer>>(`/customers/${id}/anonymize`)).data,
    onSuccess: (customer) => {
      qc.setQueryData(qk.customer(customer.id), customer)
      // El nombre nuevo aparece en la lista de clientes, en sus órdenes y en sus vehículos.
      void qc.invalidateQueries({ queryKey: ['workspaces', ws] })
      void qc.invalidateQueries({ queryKey: ['work-orders'] })
      void qc.invalidateQueries({ queryKey: ['vehicles'] })
      void qc.invalidateQueries({ queryKey: qk.customerVehicles(customer.id) })
    },
    onError: (error, id) => {
      // 409 (órdenes abiertas o ya anonimizado) o 404: lo que hay en pantalla está desfasado.
      if (isApiError(error) && (error.isConflict || error.isNotFound)) void qc.invalidateQueries({ queryKey: qk.customer(id) })
    },
  })
}

/**
 * Claves estables de TanStack Query. Jerarquía pensada para invalidar por prefijo:
 *  ['workspaces', ws, …]  → todo lo que cuelga de un espacio (dashboard, listados, agenda…)
 *  ['vehicles', id, …]    → todo lo de un vehículo (resumen, zonas, diario, historial, gastos…)
 */
import type { ID } from './types'
import type { QueryParams } from './client'

export const qk = {
  me: ['me'] as const,
  workspaces: ['workspaces'] as const,

  workspace: (ws: ID) => ['workspaces', ws] as const,
  dashboard: (ws: ID) => ['workspaces', ws, 'dashboard'] as const,
  activity: (ws: ID, params: QueryParams = {}) => ['workspaces', ws, 'activity', params] as const,
  wsReminders: (ws: ID, params: QueryParams = {}) => ['workspaces', ws, 'reminders', params] as const,
  analytics: (ws: ID, params: QueryParams = {}) => ['workspaces', ws, 'analytics', params] as const,
  members: (ws: ID) => ['workspaces', ws, 'members'] as const,
  vehicles: (ws: ID, params: QueryParams = {}) => ['workspaces', ws, 'vehicles', params] as const,
  vehiclesAll: (ws: ID) => ['workspaces', ws, 'vehicles'] as const,
  customers: (ws: ID, params: QueryParams = {}) => ['workspaces', ws, 'customers', params] as const,
  workOrders: (ws: ID, params: QueryParams = {}) => ['workspaces', ws, 'work-orders', params] as const,
  workOrdersAll: (ws: ID) => ['workspaces', ws, 'work-orders'] as const,
  bays: (ws: ID) => ['workspaces', ws, 'bays'] as const,

  vehicle: (id: ID) => ['vehicles', id] as const,
  vehicleDetail: (id: ID) => ['vehicles', id, 'detail'] as const,
  summary: (id: ID, params: QueryParams = {}) => ['vehicles', id, 'summary', params] as const,
  zones: (id: ID) => ['vehicles', id, 'zones'] as const,
  journal: (id: ID, params: QueryParams = {}) => ['vehicles', id, 'journal', params] as const,
  report: (id: ID) => ['vehicles', id, 'report'] as const,
  mileage: (id: ID) => ['vehicles', id, 'mileage'] as const,
  maintenance: (id: ID, params: QueryParams = {}) => ['vehicles', id, 'maintenance', params] as const,
  expenses: (id: ID, params: QueryParams = {}) => ['vehicles', id, 'expenses', params] as const,
  reminders: (id: ID, status = 'pending') => ['vehicles', id, 'reminders', status] as const,
  documents: (id: ID, params: QueryParams = {}) => ['vehicles', id, 'documents', params] as const,

  /** Contenido binario de un documento (vista previa). */
  documentFile: (id: ID) => ['documents', id, 'file'] as const,

  record: (id: ID) => ['maintenance', id] as const,
  customer: (id: ID) => ['customers', id] as const,
  customerVehicles: (id: ID) => ['customers', id, 'vehicles'] as const,
  workOrder: (id: ID) => ['work-orders', id] as const,

  // ───────── E16 · directorio, solicitudes y notificaciones (§3.13) ─────────
  /** Solicitudes de un espacio: enviadas (personal) o recibidas (taller). Invalidar por prefijo con repairRequestsAll. */
  repairRequests: (ws: ID, params: QueryParams = {}) => ['workspaces', ws, 'repair-requests', params] as const,
  repairRequestsAll: (ws: ID) => ['workspaces', ws, 'repair-requests'] as const,
  /** Una solicitud (las dos partes la piden por id, sin espacio). */
  repairRequest: (id: ID) => ['repair-requests', id] as const,
  repairRequestHistory: (id: ID) => ['repair-requests', id, 'history'] as const,
  directory: (params: QueryParams = {}) => ['directory', params] as const,
  directoryWorkshop: (id: ID) => ['directory', 'workshop', id] as const,
  /** Perfil del directorio de un taller (Ajustes). */
  directoryProfile: (ws: ID) => ['workspaces', ws, 'directory-profile'] as const,
  /** Listado de la campana. Invalidar todo con ['notifications']. */
  notifications: (params: QueryParams = {}) => ['notifications', 'list', params] as const,
  notificationsCount: ['notifications', 'count'] as const,
}

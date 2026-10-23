/** Reglas de las intervenciones que la interfaz explica antes de guardar (contrato §3.5, D3‑A). */
import type { ExpenseCategory, RecordType, ServiceKind, Zone } from '@/api/types'
import { QUICK_SERVICES, type QuickService } from './quickServices'

/** Categoría del gasto vinculado que crea el servidor en espacios personales. */
export function linkedExpenseCategory(type: RecordType): ExpenseCategory {
  if (type === 'repair' || type === 'breakdown' || type === 'bodywork') return 'repair'
  if (type === 'inspection') return 'inspection'
  return 'maintenance'
}

/** Chip rápido que coincide con la combinación actual de tipo, zona y servicio (o null). */
export function matchQuickService(values: { type: RecordType | string; zone: Zone | string; service_kind: ServiceKind | string | null }): QuickService | null {
  const kind = values.service_kind || null
  return QUICK_SERVICES.find((q) => q.type === values.type && q.zone === values.zone && q.service_kind === kind) ?? null
}

/** `?servicio=oil|service|itv` (enlaces «Registrar» de la cabina) → chip correspondiente. */
export function quickServiceFromParam(param: string | null): QuickService | null {
  if (!param) return null
  return QUICK_SERVICES.find((q) => q.id === param || q.service_kind === param) ?? null
}

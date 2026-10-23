/** Chips rápidos "¿Qué se hizo?" del formulario de intervención: rellenan tipo, zona, service_kind y título. */
import type { RecordType, ServiceKind, Zone } from '@/api/types'

export interface QuickService {
  id: string
  label: string
  type: RecordType
  zone: Zone
  service_kind: ServiceKind | null
  title: string
}

export const QUICK_SERVICES: QuickService[] = [
  { id: 'oil', label: 'Cambio de aceite', type: 'maintenance', zone: 'engine', service_kind: 'oil', title: 'Cambio de aceite y filtro' },
  { id: 'service', label: 'Revisión', type: 'maintenance', zone: 'general', service_kind: 'service', title: 'Revisión periódica' },
  { id: 'itv', label: 'ITV', type: 'inspection', zone: 'general', service_kind: 'itv', title: 'Inspección técnica (ITV)' },
  { id: 'tyres', label: 'Neumáticos', type: 'tyres', zone: 'tyres', service_kind: 'tyres', title: 'Cambio de neumáticos' },
  { id: 'brakes', label: 'Frenos', type: 'maintenance', zone: 'brakes', service_kind: 'brakes', title: 'Pastillas y discos de freno' },
  { id: 'battery', label: 'Batería', type: 'maintenance', zone: 'electrical', service_kind: 'battery', title: 'Cambio de batería' },
  { id: 'timing', label: 'Distribución', type: 'maintenance', zone: 'engine', service_kind: 'timing_belt', title: 'Kit de distribución' },
  { id: 'filters', label: 'Filtros', type: 'maintenance', zone: 'engine', service_kind: 'filters', title: 'Cambio de filtros' },
  { id: 'ac', label: 'Aire acondicionado', type: 'maintenance', zone: 'interior', service_kind: 'ac', title: 'Carga de aire acondicionado' },
  { id: 'breakdown', label: 'Avería', type: 'breakdown', zone: 'general', service_kind: null, title: 'Reparación de avería' },
  { id: 'other', label: 'Otro', type: 'other', zone: 'general', service_kind: 'other', title: '' },
]

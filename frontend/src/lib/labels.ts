/** Etiquetas en español (y, cuando aplica, iconos) de todos los enums del contrato. */
import {
  Battery,
  BookOpen,
  Camera,
  Car,
  CarFront,
  CircleDot,
  CircleEllipsis,
  ClipboardCheck,
  Cog,
  Disc3,
  Droplets,
  File,
  FileText,
  Fuel,
  Gauge,
  Hammer,
  IdCard,
  Landmark,
  type LucideIcon,
  Receipt,
  ReceiptText,
  Route,
  ShieldCheck,
  Siren,
  Sparkles,
  SquareParking,
  Ticket,
  TriangleAlert,
  Wind,
  Wrench,
  Zap,
  Armchair,
  PaintBucket,
  CalendarCheck,
} from 'lucide-react'
import type {
  BodyType,
  DocumentType,
  ExpenseCategory,
  FuelType,
  FuelUnit,
  ItemKind,
  JournalEntryType,
  MileageSource,
  Priority,
  RecordType,
  ReminderKind,
  ReminderState,
  ReminderStatus,
  ServiceKind,
  Transmission,
  WorkOrderStatus,
  WorkspaceRole,
  WorkspaceType,
  Zone,
} from '@/api/types'

export const WORKSPACE_TYPE_LABEL: Record<WorkspaceType, string> = {
  personal: 'Particular',
  workshop: 'Taller',
}

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Propietario',
  manager: 'Gerente',
  mechanic: 'Mecánico',
}

export const ROLE_DESCRIPTION: Record<WorkspaceRole, string> = {
  owner: 'Control total, incluido eliminar el taller.',
  manager: 'Gestiona clientes, facturación, ajustes y equipo.',
  mechanic: 'Trabaja con vehículos, órdenes e historial. No ve facturación.',
}

export const FUEL_LABEL: Record<FuelType, string> = {
  gasoline: 'Gasolina',
  diesel: 'Diésel',
  hybrid: 'Híbrido',
  plugin_hybrid: 'Híbrido enchufable',
  electric: 'Eléctrico',
  lpg: 'GLP',
  cng: 'GNC',
  other: 'Otro',
}

export const TRANSMISSION_LABEL: Record<Transmission, string> = {
  manual: 'Manual',
  automatic: 'Automático',
}

export const BODY_LABEL: Record<BodyType, string> = {
  hatchback: 'Compacto',
  sedan: 'Berlina',
  wagon: 'Familiar',
  suv: 'SUV',
  coupe: 'Coupé',
  convertible: 'Descapotable',
  minivan: 'Monovolumen',
  van: 'Furgoneta',
  pickup: 'Pick-up',
}

export const MILEAGE_SOURCE_LABEL: Record<MileageSource, string> = {
  manual: 'Lectura manual',
  vehicle_created: 'Alta del vehículo',
  maintenance: 'Intervención',
  expense: 'Gasto',
  work_order: 'Orden de trabajo',
  reminder: 'Recordatorio completado',
}

export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  maintenance: 'Mantenimiento',
  repair: 'Reparación',
  breakdown: 'Avería',
  inspection: 'Inspección / ITV',
  tyres: 'Neumáticos',
  bodywork: 'Carrocería',
  other: 'Otro',
}

export const RECORD_TYPE_ICON: Record<RecordType, LucideIcon> = {
  maintenance: Wrench,
  repair: Hammer,
  breakdown: TriangleAlert,
  inspection: ClipboardCheck,
  tyres: CircleDot,
  bodywork: PaintBucket,
  other: CircleEllipsis,
}

export const ZONE_LABEL: Record<Zone, string> = {
  engine: 'Motor',
  transmission: 'Transmisión',
  brakes: 'Frenos',
  tyres: 'Neumáticos',
  suspension: 'Suspensión y dirección',
  electrical: 'Eléctrico y batería',
  body: 'Carrocería',
  interior: 'Interior y climatización',
  exhaust: 'Escape',
  general: 'General',
}

export const ZONE_ICON: Record<Zone, LucideIcon> = {
  engine: Cog,
  transmission: Gauge,
  brakes: Disc3,
  tyres: CircleDot,
  suspension: Route,
  electrical: Zap,
  body: CarFront,
  interior: Armchair,
  exhaust: Wind,
  general: Car,
}

export const ZONES: Zone[] = [
  'engine',
  'transmission',
  'brakes',
  'tyres',
  'suspension',
  'electrical',
  'body',
  'interior',
  'exhaust',
  'general',
]

export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  oil: 'Cambio de aceite',
  service: 'Revisión',
  itv: 'ITV',
  tyres: 'Neumáticos',
  brakes: 'Frenos',
  timing_belt: 'Distribución',
  battery: 'Batería',
  filters: 'Filtros',
  ac: 'Aire acondicionado',
  other: 'Otro',
}

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  part: 'Pieza',
  labor: 'Mano de obra',
  fluid: 'Fluido',
  other: 'Otro',
}

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  fuel: 'Combustible',
  maintenance: 'Mantenimiento',
  repair: 'Reparación',
  insurance: 'Seguro',
  tax: 'Impuestos',
  inspection: 'ITV / Inspección',
  parking: 'Aparcamiento',
  tolls: 'Peajes',
  cleaning: 'Limpieza',
  fines: 'Multas',
  other: 'Otros',
}

export const EXPENSE_CATEGORY_ICON: Record<ExpenseCategory, LucideIcon> = {
  fuel: Fuel,
  maintenance: Wrench,
  repair: Hammer,
  insurance: ShieldCheck,
  tax: Landmark,
  inspection: ClipboardCheck,
  parking: SquareParking,
  tolls: Ticket,
  cleaning: Sparkles,
  fines: Siren,
  other: Receipt,
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'fuel',
  'maintenance',
  'repair',
  'insurance',
  'tax',
  'inspection',
  'parking',
  'tolls',
  'cleaning',
  'fines',
  'other',
]

export const FUEL_UNIT_LABEL: Record<FuelUnit, string> = {
  l: 'litros',
  kwh: 'kWh',
  kg: 'kg',
}

export const FUEL_UNIT_SHORT: Record<FuelUnit, string> = {
  l: 'L',
  kwh: 'kWh',
  kg: 'kg',
}

export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  itv: 'ITV',
  insurance: 'Seguro',
  tax: 'Impuesto de circulación',
  oil: 'Cambio de aceite',
  service: 'Revisión',
  tyres: 'Neumáticos',
  brakes: 'Frenos',
  timing_belt: 'Distribución',
  battery: 'Batería',
  custom: 'Personalizado',
}

/** Zona por defecto de cada tipo de recordatorio (contrato §3.7). */
export const REMINDER_KIND_ZONE: Record<ReminderKind, Zone> = {
  oil: 'engine',
  timing_belt: 'engine',
  tyres: 'tyres',
  brakes: 'brakes',
  battery: 'electrical',
  itv: 'general',
  insurance: 'general',
  tax: 'general',
  service: 'general',
  custom: 'general',
}

export const REMINDER_KIND_ICON: Record<ReminderKind, LucideIcon> = {
  itv: ClipboardCheck,
  insurance: ShieldCheck,
  tax: Landmark,
  oil: Droplets,
  service: Wrench,
  tyres: CircleDot,
  brakes: Disc3,
  timing_belt: Cog,
  battery: Battery,
  custom: CalendarCheck,
}

export const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
  pending: 'Pendiente',
  done: 'Hecho',
  dismissed: 'Descartado',
}

export const REMINDER_STATE_LABEL: Record<ReminderState, string> = {
  overdue: 'Vencido',
  soon: 'Próximo',
  ok: 'En plazo',
  unknown: 'Sin datos suficientes',
}

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  invoice: 'Factura',
  insurance: 'Seguro',
  itv: 'ITV',
  registration: 'Permiso de circulación',
  manual: 'Manual',
  photo: 'Foto',
  other: 'Otro',
}

export const DOCUMENT_TYPE_ICON: Record<DocumentType, LucideIcon> = {
  invoice: ReceiptText,
  insurance: ShieldCheck,
  itv: ClipboardCheck,
  registration: IdCard,
  manual: BookOpen,
  photo: Camera,
  other: File,
}

export const DOCUMENT_TYPES: DocumentType[] = ['invoice', 'insurance', 'itv', 'registration', 'manual', 'photo', 'other']

export const JOURNAL_TYPE_LABEL: Record<JournalEntryType, string> = {
  mileage: 'Kilometraje',
  expense: 'Gasto',
  record: 'Intervención',
  reminder_done: 'Recordatorio completado',
  document: 'Documento',
}

export const JOURNAL_TYPE_ICON: Record<JournalEntryType, LucideIcon> = {
  mileage: Gauge,
  expense: Receipt,
  record: Wrench,
  reminder_done: CalendarCheck,
  document: FileText,
}

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  received: 'Recibido',
  diagnosing: 'En diagnóstico',
  waiting_parts: 'Esperando piezas',
  in_progress: 'En reparación',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

/** Estados que aparecen como columnas del tablero (órdenes abiertas). */
export const OPEN_WORK_ORDER_STATUSES: WorkOrderStatus[] = ['received', 'diagnosing', 'waiting_parts', 'in_progress', 'ready']
export const FINAL_WORK_ORDER_STATUSES: WorkOrderStatus[] = ['delivered', 'cancelled']
export const ALL_WORK_ORDER_STATUSES: WorkOrderStatus[] = [...OPEN_WORK_ORDER_STATUSES, ...FINAL_WORK_ORDER_STATUSES]

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent']


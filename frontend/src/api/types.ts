/**
 * CONTRATO DE LA API v1 DE CARCARE — fuente de verdad de las formas JSON.
 *
 * Backend (Laravel API Resources) y frontend deben respetar exactamente estos tipos.
 * Reglas y endpoints: docs/api/contrato-v1.md. Cualquier cambio aquí se anota en ese
 * documento (sección "Historial de cambios") y lo aprueba el arquitecto.
 *
 * Convenciones:
 *  - Claves en snake_case.
 *  - Fechas sin hora: 'YYYY-MM-DD'. Instantes: ISO 8601 con zona ('2026-10-21T09:30:00+00:00').
 *  - Dinero: string decimal con 2 decimales ('1234.50'). Nunca float.
 *  - Kilometraje: entero >= 0.
 *  - Un recurso individual se envuelve en { data }. Un listado paginado en { data, meta }.
 *  - null significa "sin dato". Nunca se rellena un campo con un valor inventado.
 */

// ───────────────────────── Comunes ─────────────────────────

export type ID = number
export type ISODate = string
export type ISODateTime = string
export type Money = string
export type YearMonth = string // 'YYYY-MM'

export interface Resource<T> {
  data: T
}

export interface PageMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}

/** Cuerpo de error uniforme. 422 incluye `errors` por campo. 401/403/404/409/429 solo `message`. */
export interface ApiErrorBody {
  message: string
  errors?: Record<string, string[]>
}

// ───────────────────────── Usuario y espacios de trabajo ─────────────────────────

export type WorkspaceType = 'personal' | 'workshop'
export type WorkspaceRole = 'owner' | 'manager' | 'mechanic'

export interface User {
  id: ID
  name: string
  email: string
  locale: string
  created_at: ISODateTime
}

export interface WorkspaceSettings {
  /** Número de elevadores/puestos del taller (1–12). En personal se ignora. */
  bays_count: number
  currency: 'EUR'
  /** IVA por defecto de las órdenes de trabajo, p. ej. '21.00'. */
  tax_rate: string
}

export interface Workspace {
  id: ID
  name: string
  type: WorkspaceType
  /** Rol del usuario autenticado en este espacio. */
  role: WorkspaceRole
  settings: WorkspaceSettings
  vehicles_count: number
  members_count: number
  created_at: ISODateTime
}

export interface Me {
  user: User
  workspaces: Workspace[]
}

export interface Member {
  user: Pick<User, 'id' | 'name' | 'email'>
  role: WorkspaceRole
  joined_at: ISODateTime
}

export interface RegisterInput {
  name: string
  email: string
  password: string
  password_confirmation: string
  /** 'workshop' crea además un espacio de taller con `workshop_name`. Siempre se crea el espacio personal. */
  account_type: WorkspaceType
  workshop_name?: string
}

export interface LoginInput {
  email: string
  password: string
  remember?: boolean
}

/**
 * POST /auth/forgot-password (contrato §3.1.1). Respuesta 204 SIEMPRE, exista o no la cuenta:
 * la API nunca revela si un email está registrado.
 */
export interface ForgotPasswordInput {
  email: string
}

/**
 * POST /auth/reset-password (contrato §3.1.1). `token` y `email` llegan en el enlace del correo
 * (`/restablecer?token=…&email=…`). Respuesta 204: cambia la contraseña, invalida el enlace
 * (un solo uso) y cierra todas las sesiones abiertas de la cuenta. No inicia sesión.
 */
export interface ResetPasswordInput {
  token: string
  email: string
  password: string
  password_confirmation: string
}

// ───────────────────────── Vehículos ─────────────────────────

export type FuelType =
  | 'gasoline'
  | 'diesel'
  | 'hybrid'
  | 'plugin_hybrid'
  | 'electric'
  | 'lpg'
  | 'cng'
  | 'other'

export type Transmission = 'manual' | 'automatic'

/** También decide la forma del modelo 3D y de la silueta 2D. */
export type BodyType =
  | 'hatchback'
  | 'sedan'
  | 'wagon'
  | 'suv'
  | 'coupe'
  | 'convertible'
  | 'minivan'
  | 'van'
  | 'pickup'

export interface VehicleRef {
  id: ID
  display_name: string
  make: string
  model: string
  plate: string | null
  body_type: BodyType | null
  color_hex: string | null
}

export interface CustomerRef {
  id: ID
  name: string
  phone: string | null
}

export interface WorkOrderRef {
  id: ID
  number: string
  status: WorkOrderStatus
  bay: number | null
}

export interface VehicleStats {
  records_count: number
  pending_reminders: number
  overdue_reminders: number
  soon_reminders: number
  /** Solo en talleres: la orden abierta (no entregada ni cancelada) más reciente. */
  open_work_order: WorkOrderRef | null
}

export interface Vehicle {
  id: ID
  workspace_id: ID
  customer: CustomerRef | null
  nickname: string | null
  make: string
  model: string
  version: string | null
  year: number | null
  fuel_type: FuelType | null
  transmission: Transmission | null
  engine: string | null
  body_type: BodyType | null
  color_hex: string | null
  /** Mayúsculas, sin espacios ni guiones. */
  plate: string | null
  vin: string | null
  purchase_date: ISODate | null
  purchase_mileage: number | null
  current_mileage: number | null
  mileage_updated_at: ISODate | null
  /** nickname si existe; si no, "make model". */
  display_name: string
  archived_at: ISODateTime | null
  created_at: ISODateTime
  updated_at: ISODateTime
  /** Incluido en listados y en el detalle. */
  stats: VehicleStats
}

export interface VehicleInput {
  make: string
  model: string
  nickname?: string | null
  version?: string | null
  year?: number | null
  fuel_type?: FuelType | null
  transmission?: Transmission | null
  engine?: string | null
  body_type?: BodyType | null
  color_hex?: string | null
  plate?: string | null
  vin?: string | null
  purchase_date?: ISODate | null
  purchase_mileage?: number | null
  /** Al crear: genera la primera lectura de kilometraje (source 'vehicle_created'). */
  current_mileage?: number | null
  customer_id?: ID | null
}

// ───────────────────────── Kilometraje (seguimiento diario) ─────────────────────────

export type MileageSource =
  | 'manual'
  | 'vehicle_created'
  | 'maintenance'
  | 'expense'
  | 'work_order'
  | 'reminder'

export interface MileageLog {
  id: ID
  vehicle_id: ID
  recorded_at: ISODate
  mileage: number
  source: MileageSource
  /**
   * Id del registro que generó la lectura. Siempre es del MISMO vehículo (contrato §3.4.1):
   *  maintenance → MaintenanceRecord.id (puede estar archivada) · expense → Expense.id ·
   *  work_order → WorkOrder.id · reminder → Reminder.id (completado) · vehicle_created → el propio vehicle_id.
   * null en las lecturas manuales y cuando el usuario no puede ver ese origen (gastos para el rol mechanic).
   */
  source_id: ID | null
  note: string | null
  created_at: ISODateTime
}

export interface MileageInput {
  recorded_at: ISODate
  mileage: number
  note?: string | null
  /** Obligatorio (true) si la lectura es menor que una anterior; si falta, la API responde 422 con errors.mileage. */
  confirm_mileage_drop?: boolean
}

// ───────────────────────── Intervenciones (mantenimiento, reparaciones, averías) ─────────────────────────

export type RecordType =
  | 'maintenance'
  | 'repair'
  | 'breakdown'
  | 'inspection'
  | 'tyres'
  | 'bodywork'
  | 'other'

/** Zonas del vehículo. Son las que se iluminan en el modelo 3D. */
export type Zone =
  | 'engine'
  | 'transmission'
  | 'brakes'
  | 'tyres'
  | 'suspension'
  | 'electrical'
  | 'body'
  | 'interior'
  | 'exhaust'
  | 'general'

/** Qué servicio concreto fue (opcional). Permite "desde el último cambio de aceite…". */
export type ServiceKind =
  | 'oil'
  | 'service'
  | 'itv'
  | 'tyres'
  | 'brakes'
  | 'timing_belt'
  | 'battery'
  | 'filters'
  | 'ac'
  | 'other'

export type ItemKind = 'part' | 'labor' | 'fluid' | 'other'

export interface LineItem {
  id?: ID
  kind: ItemKind
  name: string
  part_number: string | null
  /** Decimal con hasta 2 decimales, > 0. */
  quantity: string
  unit_price: Money | null
  /** quantity * unit_price, o null si no hay precio. Lo calcula el servidor. */
  total: Money | null
}

export type LineItemInput = Omit<LineItem, 'id' | 'total'>

export interface MaintenanceRecord {
  id: ID
  vehicle_id: ID
  type: RecordType
  zone: Zone
  service_kind: ServiceKind | null
  title: string
  description: string | null
  service_date: ISODate
  mileage: number | null
  workshop_name: string | null
  parts_cost: Money | null
  labor_cost: Money | null
  total_cost: Money | null
  currency: 'EUR'
  items: LineItem[]
  /** Gasto generado automáticamente (solo espacios personales con total_cost). */
  expense_id: ID | null
  work_order_id: ID | null
  documents_count: number
  archived_at: ISODateTime | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export type MaintenanceRecordRef = Pick<
  MaintenanceRecord,
  'id' | 'type' | 'zone' | 'service_kind' | 'title' | 'service_date' | 'mileage' | 'total_cost'
>

export interface MaintenanceInput {
  type: RecordType
  zone: Zone
  service_kind?: ServiceKind | null
  title: string
  description?: string | null
  service_date: ISODate
  mileage?: number | null
  workshop_name?: string | null
  parts_cost?: Money | null
  labor_cost?: Money | null
  total_cost?: Money | null
  items?: LineItemInput[]
  confirm_mileage_drop?: boolean
}

// ───────────────────────── Gastos ─────────────────────────

export type ExpenseCategory =
  | 'fuel'
  | 'maintenance'
  | 'repair'
  | 'insurance'
  | 'tax'
  | 'inspection'
  | 'parking'
  | 'tolls'
  | 'cleaning'
  | 'fines'
  | 'other'

export type FuelUnit = 'l' | 'kwh' | 'kg'

export interface Expense {
  id: ID
  vehicle_id: ID
  category: ExpenseCategory
  description: string | null
  amount: Money
  currency: 'EUR'
  expense_date: ISODate
  mileage: number | null
  /** Solo combustible/carga. */
  fuel_quantity: string | null
  fuel_unit: FuelUnit | null
  /** Depósito lleno: necesario para calcular consumo por el método lleno-a-lleno. */
  full_tank: boolean | null
  maintenance_record_id: ID | null
  /** true si lo gestiona una intervención: no se puede editar ni borrar desde Gastos. */
  is_linked: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface ExpenseInput {
  category: ExpenseCategory
  amount: Money
  expense_date: ISODate
  description?: string | null
  mileage?: number | null
  fuel_quantity?: string | null
  fuel_unit?: FuelUnit | null
  full_tank?: boolean | null
  confirm_mileage_drop?: boolean
}

// ───────────────────────── Recordatorios y vencimientos ─────────────────────────

export type ReminderKind =
  | 'itv'
  | 'insurance'
  | 'tax'
  | 'oil'
  | 'service'
  | 'tyres'
  | 'brakes'
  | 'timing_belt'
  | 'battery'
  | 'custom'

export type ReminderStatus = 'pending' | 'done' | 'dismissed'

/**
 * Estado calculado (solo para pending):
 *  overdue = fecha pasada o km superados · soon = ≤ 30 días o ≤ 1.000 km
 *  ok = falta más · unknown = depende de km y el vehículo no tiene kilometraje.
 */
export type ReminderState = 'overdue' | 'soon' | 'ok' | 'unknown'

export interface Reminder {
  id: ID
  vehicle_id: ID
  /** Incluido en listados de espacio (agenda) y dashboards. */
  vehicle?: VehicleRef
  title: string
  kind: ReminderKind
  zone: Zone
  notes: string | null
  due_date: ISODate | null
  due_mileage: number | null
  /** Recurrencia: al completar se crea el siguiente automáticamente. */
  recurrence_months: number | null
  recurrence_km: number | null
  starts_on: ISODate
  start_mileage: number | null
  status: ReminderStatus
  completed_at: ISODate | null
  completed_mileage: number | null
  state: ReminderState | null
  days_left: number | null
  km_left: number | null
  /** 0..1 (puede pasar de 1 si está vencido). Tiempo/km transcurridos según TUS intervalos, no desgaste medido. */
  progress: number | null
  created_at: ISODateTime
}

export interface ReminderInput {
  title: string
  kind: ReminderKind
  zone?: Zone
  notes?: string | null
  /** Al menos uno de due_date / due_mileage. */
  due_date?: ISODate | null
  due_mileage?: number | null
  recurrence_months?: number | null
  recurrence_km?: number | null
}

export interface CompleteReminderInput {
  completed_at: ISODate
  mileage?: number | null
  /** Si true y hay recurrencia, crea el siguiente (por defecto true). */
  create_next?: boolean
}

export interface CompleteReminderResult {
  completed: Reminder
  next: Reminder | null
}

// ───────────────────────── Mapa de zonas (alimenta el 3D) ─────────────────────────

export interface ZoneStatus {
  zone: Zone
  /** Etiqueta en español: 'Motor', 'Frenos'… */
  label: string
  /** Peor estado entre sus recordatorios pendientes; 'unknown' si no hay ninguno. */
  state: ReminderState
  /** reminders = estado según recordatorios · records = solo hay historial · none = sin datos. */
  basis: 'reminders' | 'records' | 'none'
  last_record: MaintenanceRecordRef | null
  records_count: number
  next_reminder: Reminder | null
}

// ───────────────────────── Documentos ─────────────────────────

export type DocumentType =
  | 'invoice'
  | 'insurance'
  | 'itv'
  | 'registration'
  | 'manual'
  | 'photo'
  | 'other'

export interface VehicleDocument {
  id: ID
  vehicle_id: ID
  maintenance_record_id: ID | null
  title: string
  document_type: DocumentType
  original_filename: string
  mime_type: string
  size: number
  expires_at: ISODate | null
  /** Ruta relativa de descarga autenticada: '/api/v1/documents/{id}/download'. */
  download_url: string
  created_at: ISODateTime
}

// ───────────────────────── Diario (seguimiento día a día) ─────────────────────────

export type JournalEntryType = 'mileage' | 'expense' | 'record' | 'reminder_done' | 'document'

export interface JournalEntry {
  type: JournalEntryType
  id: ID
  date: ISODate
  title: string
  amount: Money | null
  mileage: number | null
  /** Datos extra según tipo, p. ej. { category: 'fuel', fuel_quantity: '42.10' }. */
  meta: Record<string, string | number | boolean | null>
}

export interface JournalDay {
  date: ISODate
  /** km recorridos ese día si hay lecturas suficientes; null si no se puede saber. */
  km_driven: number | null
  spent: Money
  entries: JournalEntry[]
}

// ───────────────────────── Resumen y analítica de un vehículo ─────────────────────────

export interface Availability {
  available: boolean
  /** Motivo en español cuando no está disponible: qué dato falta. */
  reason: string | null
}

export interface VehicleSummary {
  period: { from: ISODate; to: ISODate }
  totals: {
    period: Money
    month: Money
    year: Money
    previous_period: Money | null
    /** null si el periodo anterior no tiene datos. */
    change_pct: number | null
  }
  by_category: { category: ExpenseCategory; total: Money; count: number }[]
  /** 12 meses que terminan en el mes de `period.to`, incluidos los meses a 0. */
  by_month: { month: YearMonth; total: Money }[]
  cost_per_km: Availability & { value: Money | null; km: number | null }
  consumption: Availability & {
    value: string | null
    unit: 'l/100km' | 'kwh/100km' | 'kg/100km' | null
    fills: number
  }
  mileage: {
    current: number | null
    updated_at: ISODate | null
    km_this_month: number | null
    km_this_year: number | null
    avg_daily_km: number | null
    /** Lecturas de los últimos 12 meses, ascendente. */
    series: { date: ISODate; mileage: number }[]
  }
  records: {
    count: number
    last: MaintenanceRecordRef | null
    recent: MaintenanceRecordRef[]
  }
  since_last: {
    kind: 'oil' | 'service' | 'itv'
    label: string
    record: MaintenanceRecordRef | null
    days: number | null
    km: number | null
  }[]
  reminders: { overdue: number; soon: number; upcoming: Reminder[] }
}

export interface VehicleReport {
  generated_at: ISODateTime
  vehicle: Vehicle
  records: MaintenanceRecord[]
  expenses: {
    total: Money
    by_category: { category: ExpenseCategory; total: Money; count: number }[]
    by_year: { year: number; total: Money }[]
  }
  mileage_logs: MileageLog[]
  pending_reminders: Reminder[]
  documents: Pick<VehicleDocument, 'id' | 'title' | 'document_type' | 'created_at' | 'expires_at'>[]
}

// ───────────────────────── Taller: clientes y órdenes de trabajo ─────────────────────────

export interface Customer {
  id: ID
  workspace_id: ID
  name: string
  email: string | null
  phone: string | null
  tax_id: string | null
  notes: string | null
  vehicles_count: number
  open_orders_count: number
  /**
   * Cuándo se anonimizó (RGPD, contrato §3.10.1). Si no es null: name = 'Cliente anonimizado',
   * email/phone/tax_id/notes = null y el cliente ya no se puede editar (409). Es irreversible.
   */
  anonymized_at: ISODateTime | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface CustomerInput {
  name: string
  email?: string | null
  phone?: string | null
  tax_id?: string | null
  notes?: string | null
}

/**
 * POST /customers/{c}/export (manage, contrato §3.10.1): copia de los datos del cliente para
 * entregársela (derecho de acceso y portabilidad). El frontend la guarda como archivo .json.
 */
export interface CustomerExport {
  generated_at: ISODateTime
  /** Taller que guarda los datos. */
  workspace: Pick<Workspace, 'id' | 'name'>
  customer: Customer
  /** Todos sus vehículos, archivados incluidos. */
  vehicles: Vehicle[]
  /** Todas sus órdenes, en cualquier estado y con sus líneas, de la más reciente a la más antigua. */
  work_orders: WorkOrder[]
}

export type WorkOrderStatus =
  | 'received'
  | 'diagnosing'
  | 'waiting_parts'
  | 'in_progress'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export interface WorkOrder {
  id: ID
  workspace_id: ID
  /** 'OT-2026-0001', correlativo por espacio y año. */
  number: string
  vehicle: VehicleRef
  customer: CustomerRef | null
  title: string
  complaint: string | null
  diagnosis: string | null
  status: WorkOrderStatus
  priority: Priority
  bay: number | null
  assigned_to: Pick<User, 'id' | 'name'> | null
  mileage_in: number | null
  received_at: ISODateTime
  promised_at: ISODateTime | null
  completed_at: ISODateTime | null
  delivered_at: ISODateTime | null
  items: LineItem[]
  subtotal: Money
  tax_rate: string
  tax_amount: Money
  total: Money
  /** true si promised_at ya pasó y no está ready/delivered/cancelled. */
  is_late: boolean
  maintenance_record_id: ID | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface WorkOrderInput {
  vehicle_id: ID
  title: string
  complaint?: string | null
  diagnosis?: string | null
  priority?: Priority
  bay?: number | null
  assigned_to?: ID | null
  mileage_in?: number | null
  promised_at?: ISODateTime | null
  tax_rate?: string
  items?: LineItemInput[]
}

export interface WorkOrderStatusInput {
  status: WorkOrderStatus
  /** Opcional: mover a un elevador a la vez (null lo libera). */
  bay?: number | null
}

export interface Bay {
  number: number
  work_order: WorkOrder | null
}

// ───────────────────────── Actividad ─────────────────────────

export interface Activity {
  id: ID
  /** 'vehicle.created', 'maintenance.created', 'work_order.status_changed'… */
  action: string
  entity_type: string
  entity_id: ID
  /** Frase lista para mostrar: "Ana movió OT-2026-0003 a «Listo»". */
  summary: string
  user: Pick<User, 'id' | 'name'> | null
  vehicle_id: ID | null
  created_at: ISODateTime
}

// ───────────────────────── Dashboards de espacio ─────────────────────────

export interface PersonalDashboard {
  type: 'personal'
  vehicles: Vehicle[]
  spend: { month: Money; year: Money; by_month: { month: YearMonth; total: Money }[] }
  reminders: { overdue: number; soon: number; upcoming: Reminder[] }
  recent_activity: Activity[]
}

export interface WorkshopDashboard {
  type: 'workshop'
  counts: {
    vehicles: number
    customers: number
    open_orders: number
    late_orders: number
    overdue_reminders: number
  }
  orders_by_status: Record<WorkOrderStatus, number>
  bays: Bay[]
  /** Órdenes cuya fecha prometida es hoy. */
  due_today: WorkOrder[]
  late: WorkOrder[]
  /** null para el rol mechanic (no ve importes ni analítica). */
  revenue: { month: Money; year: Money; by_month: { month: YearMonth; total: Money }[] } | null
  fleet_alerts: Reminder[]
  recent_activity: Activity[]
}

export type WorkspaceDashboard = PersonalDashboard | WorkshopDashboard

export interface WorkspaceAnalytics {
  period: { from: ISODate; to: ISODate }
  /** personal: gasto total · workshop: importe de las órdenes entregadas (con IVA). */
  total: Money
  by_month: { month: YearMonth; total: Money }[]
  by_vehicle: { vehicle: VehicleRef; total: Money }[]
  /** Solo personal. */
  by_category: { category: ExpenseCategory; total: Money; count: number }[]
  /** Solo workshop. */
  workshop: {
    orders_delivered: number
    avg_ticket: Money | null
    avg_days_in_shop: number | null
    by_customer: { customer: CustomerRef; total: Money; orders: number }[]
  } | null
}

// ───────────────────────── Directorio de talleres y solicitudes de reparación (E16) ─────────────────────────
// Contrato §3.13 · ADR‑0007. Única vía entre un espacio personal y un taller: el resto sigue aislado (404).

/** Servicios que un taller puede anunciar en el directorio (lista cerrada). */
export type WorkshopService =
  | 'maintenance' // Mantenimiento y revisiones
  | 'mechanics' // Mecánica general
  | 'tyres' // Neumáticos
  | 'brakes' // Frenos
  | 'bodywork' // Chapa y pintura
  | 'electrical' // Electricidad y baterías
  | 'ac' // Aire acondicionado
  | 'pre_itv' // Pre‑ITV

/**
 * GET/PUT /workspaces/{ws}/directory-profile (solo talleres). Datos públicos que elige el owner.
 * El nombre público es Workspace.name (se edita en Ajustes): no se duplica aquí.
 */
export interface DirectoryProfile {
  workspace_id: ID
  /** "Aparecer en el directorio". false por defecto. */
  listed: boolean
  /** Obligatoria si listed = true. */
  city: string | null
  address: string | null
  phone: string | null
  services: WorkshopService[]
  /** Texto libre: "L‑V 8:00‑14:00 y 15:30‑19:00". */
  opening_hours: string | null
  /** null si el owner nunca lo ha guardado. */
  updated_at: ISODateTime | null
}

export interface DirectoryProfileInput {
  listed: boolean
  city?: string | null
  address?: string | null
  phone?: string | null
  services?: WorkshopService[]
  opening_hours?: string | null
}

/** GET /workshops: un taller del directorio (solo los que tienen listed = true). */
export interface DirectoryWorkshop {
  /** Id del espacio de taller. */
  id: ID
  name: string
  city: string
  address: string | null
  phone: string | null
  services: WorkshopService[]
  opening_hours: string | null
  /** true si el usuario es miembro de ese taller: la SPA oculta "Solicitar" (la API daría 422). */
  is_member: boolean
}

/** Taller dentro de una solicitud. Datos actuales de su perfil (aunque ya no esté en el directorio). */
export interface DirectoryWorkshopRef {
  id: ID
  name: string
  city: string | null
  phone: string | null
}

export type RepairRequestStatus =
  | 'pending' // Enviada, esperando al taller
  | 'accepted' // Aceptada; el presupuesto llegará después (o el cliente rechazó el anterior)
  | 'quoted' // Hay un presupuesto vigente esperando al cliente
  | 'rejected' // Rechazada por el taller (final)
  | 'cancelled' // Cancelada por el particular o al borrar el vehículo (final)
  | 'converted' // El cliente aceptó el presupuesto y se creó la orden (final)

export type RepairQuoteStatus =
  | 'sent' // Vigente, esperando respuesta
  | 'accepted'
  | 'rejected'
  | 'superseded' // El taller envió una versión nueva

/**
 * Copia fija del vehículo tomada al enviar la solicitud: lo único que el taller ve del coche.
 * No incluye apodo, VIN, fechas de compra, gastos ni documentos.
 */
export interface RepairRequestVehicle {
  make: string
  model: string
  year: number | null
  fuel_type: FuelType | null
  body_type: BodyType | null
  color_hex: string | null
  plate: string | null
  /** "make model" (nunca el apodo). */
  display_name: string
}

/** Versión de un presupuesto. Inmutable: para cambiarlo, el taller envía otra versión. "No es una factura" (D12). */
export interface RepairQuote {
  id: ID
  /** 1, 2, 3… dentro de la solicitud. */
  version: number
  status: RepairQuoteStatus
  /** Siempre con unit_price y total (precio obligatorio en un presupuesto). Sin id. */
  items: LineItem[]
  subtotal: Money
  tax_rate: string
  tax_amount: Money
  total: Money
  /** 1–90. */
  valid_days: number
  /** Fecha de envío + valid_days. */
  valid_until: ISODate
  /** true si status = 'sent' y hoy > valid_until. Aceptarlo da 409. */
  is_expired: boolean
  /** Nota del taller para el cliente. */
  note: string | null
  /** Motivo opcional del cliente al rechazarlo. */
  client_reason: string | null
  sent_at: ISODateTime
  answered_at: ISODateTime | null
}

/** Orden creada al aceptar el presupuesto, vista desde la solicitud (solo lectura para el particular). */
export interface RepairRequestWorkOrder {
  id: ID
  number: string
  status: WorkOrderStatus
  received_at: ISODateTime
  completed_at: ISODateTime | null
  delivered_at: ISODateTime | null
}

/**
 * Solicitud de reparación. La ven sus dos partes: el owner del espacio personal que la envió
 * (perspective 'requester') y los miembros del taller destinatario ('workshop'). Cualquier otro: 404.
 */
export interface RepairRequest {
  id: ID
  /** La decide el servidor según quién pregunta. */
  perspective: 'requester' | 'workshop'
  status: RepairRequestStatus
  workshop: DirectoryWorkshopRef
  /** Nombre y email de la cuenta que la envió. */
  requester: { name: string; email: string }
  contact_phone: string | null
  /** Solo con perspective 'requester': el vehículo de su garaje (null si lo borró). Para el taller, siempre null. */
  vehicle_id: ID | null
  vehicle: RepairRequestVehicle
  /** Asunto corto. Pasa a ser el título de la orden. */
  title: string
  description: string
  zone: Zone | null
  preferred_date: ISODate
  /** Km declarados al enviar. No crean una lectura en el garaje. */
  mileage: number
  share_history: boolean
  /** true si ahora mismo se puede pedir GET /repair-requests/{r}/history. */
  history_available: boolean
  reject_reason: string | null
  /** Todas las versiones, de la más reciente a la más antigua. La primera es la vigente si su status es 'sent'. */
  quotes: RepairQuote[]
  work_order: RepairRequestWorkOrder | null
  /** Cuándo aceptó o rechazó el taller. */
  responded_at: ISODateTime | null
  /** Cuándo pasó a rejected, cancelled o converted. */
  closed_at: ISODateTime | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface RepairRequestInput {
  vehicle_id: ID
  /** Id del taller (DirectoryWorkshop.id). */
  workshop_id: ID
  title: string
  description: string
  zone?: Zone | null
  preferred_date: ISODate
  mileage: number
  contact_phone?: string | null
  /** false por defecto. */
  share_history?: boolean
}

/** PATCH /repair-requests/{r}: lo único que el particular puede cambiar (dar o retirar el consentimiento). */
export interface RepairRequestUpdateInput {
  share_history: boolean
}

/** Línea de presupuesto: igual que LineItemInput, pero con precio obligatorio. */
export type QuoteLineItemInput = Omit<LineItemInput, 'unit_price'> & { unit_price: Money }

export interface RepairQuoteInput {
  items: QuoteLineItemInput[]
  /** Por defecto, el IVA del taller. */
  tax_rate?: string
  /** 1–90, por defecto 15. */
  valid_days?: number
  note?: string | null
}

/** POST /repair-requests/{r}/accept. Con quote ⇒ 'quoted'; sin quote ⇒ 'accepted'. */
export interface AcceptRepairRequestInput {
  quote?: RepairQuoteInput | null
}

export interface RejectRepairRequestInput {
  reason: string
}

/** POST /repair-requests/{r}/quote/accept|reject. quote_id = la versión que el cliente está viendo. */
export interface QuoteDecisionInput {
  quote_id: ID
  /** Solo al rechazar. */
  reason?: string | null
}

/** GET /repair-requests/{r}/history: proyección sin importes, descripciones, líneas ni documentos. */
export interface SharedHistoryEntry {
  service_date: ISODate
  type: RecordType
  zone: Zone
  service_kind: ServiceKind | null
  title: string
  mileage: number | null
  workshop_name: string | null
}

// ───────────────────────── Notificaciones en la app (E16) ─────────────────────────

export type NotificationKind =
  | 'repair_request.received' // → owner y managers del taller
  | 'repair_request.cancelled' // → owner y managers del taller
  | 'repair_request.accepted' // → particular
  | 'repair_request.rejected' // → particular
  | 'repair_quote.sent' // → particular
  | 'repair_quote.accepted' // → owner y managers del taller (incluye la orden creada)
  | 'repair_quote.rejected' // → owner y managers del taller
  | 'repair_request.order_ready' // → particular, cuando su orden pasa a 'ready'

/** Se llama así para no chocar con el Notification global del navegador. */
export interface AppNotification {
  /** UUID (tabla notifications de Laravel). */
  id: string
  kind: NotificationKind
  /** Frase lista para mostrar, sin el nombre del particular. */
  summary: string
  /** Espacio desde el que se abre: /app/{workspace_id}/solicitudes/{repair_request_id}. */
  workspace_id: ID
  repair_request_id: ID | null
  read_at: ISODateTime | null
  created_at: ISODateTime
}

export interface NotificationCount {
  unread: number
}

/** POST /notifications/read. Sin ids ⇒ todas las del usuario. */
export interface MarkNotificationsReadInput {
  ids?: string[]
}

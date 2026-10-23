/**
 * Datos de EJEMPLO solo para el laboratorio visual (/dev/3d y three-lab.html). No se usan en la app.
 */
import type { Bay, BodyType, ReminderState, WorkOrder, WorkOrderStatus, Zone, ZoneStatus } from '@/api/types'
import { ZONE_LABEL, ZONES } from '@/lib/labels'

const STATES: Record<Zone, { state: ReminderState; basis: ZoneStatus['basis'] }> = {
  engine: { state: 'soon', basis: 'reminders' },
  transmission: { state: 'unknown', basis: 'none' },
  brakes: { state: 'overdue', basis: 'reminders' },
  tyres: { state: 'ok', basis: 'reminders' },
  suspension: { state: 'unknown', basis: 'records' },
  electrical: { state: 'ok', basis: 'reminders' },
  body: { state: 'unknown', basis: 'none' },
  interior: { state: 'soon', basis: 'reminders' },
  exhaust: { state: 'unknown', basis: 'none' },
  general: { state: 'ok', basis: 'reminders' },
}

export function demoZones(): ZoneStatus[] {
  return ZONES.map((zone) => ({
    zone,
    label: ZONE_LABEL[zone],
    state: STATES[zone].state,
    basis: STATES[zone].basis,
    last_record: null,
    records_count: STATES[zone].basis === 'none' ? 0 : 2,
    next_reminder: null,
  }))
}

let nextId = 1
function order(status: WorkOrderStatus, body: BodyType, color: string, name: string, bay: number | null, late = false): WorkOrder {
  const id = nextId++
  const now = '2026-10-22T09:00:00Z'
  return {
    id,
    workspace_id: 1,
    number: `OT-2026-${String(id).padStart(4, '0')}`,
    vehicle: { id: 100 + id, display_name: name, make: name.split(' ')[0], model: name.split(' ').slice(1).join(' '), plate: null, body_type: body, color_hex: color },
    customer: null,
    title: 'Revisión',
    complaint: null,
    diagnosis: null,
    status,
    priority: 'normal',
    bay,
    assigned_to: null,
    mileage_in: null,
    received_at: now,
    promised_at: null,
    completed_at: null,
    delivered_at: null,
    items: [],
    subtotal: '0.00',
    tax_rate: '21.00',
    tax_amount: '0.00',
    total: '0.00',
    is_late: late,
    maintenance_record_id: null,
    created_at: now,
    updated_at: now,
  }
}

export function demoWorkshop(): { bays: Bay[]; waiting: WorkOrder[] } {
  nextId = 1
  const bays: Bay[] = [
    { number: 1, work_order: order('in_progress', 'sedan', '#1f3a5f', 'Berlina azul', 1) },
    { number: 2, work_order: order('diagnosing', 'suv', '#e8e6e1', 'SUV blanco', 2) },
    { number: 3, work_order: null },
    { number: 4, work_order: order('waiting_parts', 'hatchback', '#b3202a', 'Compacto rojo', 4, true) },
    { number: 5, work_order: order('ready', 'van', '#d9d9d6', 'Furgoneta blanca', 5) },
    { number: 6, work_order: order('received', 'pickup', '#2e3b2f', 'Pick-up verde', 6) },
  ]
  const waiting = [
    order('received', 'wagon', '#5a5f63', 'Familiar gris', null),
    order('received', 'coupe', '#c9a227', 'Coupé amarillo', null),
    order('diagnosing', 'minivan', '#24282b', 'Monovolumen negro', null),
    order('received', 'convertible', '#7a1f2b', 'Descapotable granate', null),
  ]
  return { bays, waiting }
}

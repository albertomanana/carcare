import { describe, expect, it } from 'vitest'
import type { Reminder, Vehicle, VehicleSummary } from '@/api/types'
import { datumSentence, dueCompact, mostUrgent, vehicleTelemetry } from './vehicleTelemetry'
import type { WorkshopVisit } from './workshopVisit'

const NOW = new Date('2026-11-15T12:00:00')

const vehicle = (v: Partial<Vehicle> = {}): Vehicle =>
  ({
    id: 12,
    display_name: 'El rojo',
    make: 'Seat',
    model: 'Ibiza',
    engine: '1.0 TSI 95 CV',
    fuel_type: 'gasoline',
    transmission: 'manual',
    current_mileage: 84210,
    mileage_updated_at: '2026-11-10',
    stats: { records_count: 4, pending_reminders: 3, overdue_reminders: 1, soon_reminders: 1, open_work_order: null },
    ...v,
  }) as Vehicle

const reminder = (r: Partial<Reminder> = {}): Reminder =>
  ({ id: 1, vehicle_id: 12, kind: 'itv', status: 'pending', state: 'ok', due_date: '2027-03-12', days_left: 117, due_mileage: null, km_left: null, ...r }) as Reminder

const summary = (s: Partial<VehicleSummary> = {}): VehicleSummary =>
  ({
    totals: { month: '86.40', year: '1240.00' },
    records: { count: 1, last: { id: 5, title: 'Revisión anual', service_date: '2026-07-01' } },
    since_last: [{ kind: 'service', label: 'Revisión', record: { id: 5, title: 'Revisión anual', service_date: '2026-07-01' }, days: 137, km: 4300 }],
    ...s,
  }) as VehicleSummary

const visit: WorkshopVisit = {
  requestId: 7,
  vehicleId: 12,
  workshopName: 'Taller Demo',
  title: 'Chirrido al frenar',
  order: {
    id: 31,
    number: 'OT-2026-0031',
    status: 'in_progress',
    received_at: '2026-11-14T09:00:00+01:00',
    promised_at: null,
    completed_at: null,
    delivered_at: null,
    bay: 2,
    mechanic_name: 'Andrés',
    status_changed_at: '2026-11-15T10:00:00+01:00',
    repair_seconds: 0,
    estimated_minutes: 90,
  },
}

const input = { vehicle: vehicle(), summary: summary(), reminders: [reminder()], visit: undefined, canExpenses: true, base: '/app/3', now: NOW }
const ids = (d: { id: string }[]) => d.map((x) => x.id)
const get = (d: ReturnType<typeof vehicleTelemetry>, id: string) => d.find((x) => x.id === id)!

describe('vehicleTelemetry', () => {
  it('da los datos clave en orden de prioridad, cada uno con su pantalla', () => {
    const d = vehicleTelemetry(input)
    expect(ids(d)).toEqual(['avisos', 'km', 'itv', 'insurance', 'tyres', 'revision', 'motor', 'gasto'])
    expect(d.every((x) => x.to?.startsWith('/app/3/vehiculos/12'))).toBe(true)
    expect(get(d, 'avisos')).toMatchObject({ value: '1 vencido · 1 próximo', note: 'Según tus intervalos', tone: 'danger' })
    expect(get(d, 'itv')).toMatchObject({ value: 'En 117 días', tone: 'ok' })
    expect(get(d, 'motor')).toMatchObject({ value: '1.0 TSI 95 CV', note: 'Gasolina · Manual' })
    expect(get(d, 'revision')).toMatchObject({ label: 'Última revisión', value: 'Hace 5 meses' })
    expect(get(d, 'revision').note).toMatch(/^4\.300\skm desde entonces$/)
    expect(get(d, 'gasto').value).toMatch(/86,40/)
  })

  it('con el coche en el taller, ese dato va el primero y lleva al seguimiento', () => {
    const d = vehicleTelemetry({ ...input, visit })
    expect(d[0]).toMatchObject({ id: 'taller', label: 'En el taller', value: 'Elevador 2', tone: 'workshop', to: '/app/3/solicitudes/7' })
    expect(d[0].note).toBe('En reparación · lo lleva Andrés · Taller Demo')
    expect(d[0].visit).toBe(visit)
    const ready = vehicleTelemetry({ ...input, visit: { ...visit, order: { ...visit.order, status: 'ready' } } })[0]
    expect(ready).toMatchObject({ label: 'Listo en el taller', value: 'Listo para recoger', tone: 'ok' })
  })

  it('si falta un dato lo dice y enlaza a donde se resuelve; no inventa nada', () => {
    const d = vehicleTelemetry({
      ...input,
      vehicle: vehicle({ engine: null, fuel_type: null, transmission: null, current_mileage: null, mileage_updated_at: null, stats: { records_count: 0, pending_reminders: 0, overdue_reminders: 0, soon_reminders: 0, open_work_order: null } }),
      reminders: [],
      summary: summary({ records: { count: 0, last: null, recent: [] }, since_last: [] }),
    })
    expect(get(d, 'avisos')).toMatchObject({ value: 'Sin recordatorios', tone: 'neutral' })
    expect(get(d, 'km')).toMatchObject({ value: 'Sin km anotados', note: 'Anota la primera lectura' })
    expect(get(d, 'itv')).toMatchObject({ value: 'Sin recordatorio', to: '/app/3/vehiculos/12/recordatorios' })
    expect(get(d, 'motor')).toMatchObject({ value: 'Sin indicar', to: '/app/3/vehiculos/12/editar' })
    expect(get(d, 'revision')).toMatchObject({ value: 'Sin registrar', to: '/app/3/vehiculos/12/intervenciones/nueva' })
  })

  it('sin revisión registrada enseña la última intervención que haya', () => {
    const d = vehicleTelemetry({ ...input, summary: summary({ since_last: [{ kind: 'service', label: 'Revisión', record: null, days: null, km: null }] }) })
    expect(get(d, 'revision')).toMatchObject({ label: 'Última intervención', note: 'Revisión anual' })
  })

  it('mientras cargan el resumen o los recordatorios, esos datos esperan sin cifras', () => {
    const d = vehicleTelemetry({ ...input, summary: undefined, reminders: undefined })
    expect(ids(d)).toEqual(['avisos', 'km', 'itv', 'insurance', 'tyres', 'revision', 'motor', 'gasto'])
    for (const id of ['itv', 'insurance', 'tyres', 'revision', 'gasto']) expect(get(d, id).value).toBe('…')
    expect(datumSentence(get(d, 'itv'))).toBe('ITV: cargando')
  })

  it('quien no ve los gastos no recibe el dato de gasto', () => {
    expect(ids(vehicleTelemetry({ ...input, canExpenses: false }))).not.toContain('gasto')
  })
})

describe('mostUrgent', () => {
  it('elige lo vencido antes que lo próximo, y dentro de cada estado lo que antes llega', () => {
    const list = [reminder({ id: 1, state: 'ok', days_left: 200 }), reminder({ id: 2, state: 'soon', days_left: 12 }), reminder({ id: 3, state: 'overdue', days_left: -4 }), reminder({ id: 4, kind: 'insurance', state: 'overdue', days_left: -90 })]
    expect(mostUrgent(list, 'itv')?.id).toBe(3)
    expect(mostUrgent(list.slice(0, 2), 'itv')?.id).toBe(2)
    expect(mostUrgent(list, 'tyres')).toBeNull()
    expect(mostUrgent([reminder({ status: 'done' })], 'itv')).toBeNull()
  })
})

describe('dueCompact', () => {
  it('pone delante la causa del vencimiento', () => {
    expect(dueCompact({ due_date: '2026-11-11', days_left: -4, due_mileage: null, km_left: null }).value).toBe('Venció hace 4 días')
    expect(dueCompact({ due_date: '2027-01-01', days_left: 47, due_mileage: 84000, km_left: -210 }).value).toMatch(/^Pasado en 210\skm$/)
    expect(dueCompact({ due_date: '2026-11-15', days_left: 0, due_mileage: null, km_left: null }).value).toBe('Vence hoy')
    expect(dueCompact({ due_date: '2026-11-16', days_left: 1, due_mileage: null, km_left: null }).value).toBe('Vence mañana')
    expect(dueCompact({ due_date: null, days_left: null, due_mileage: 90000, km_left: 5790 }).value).toMatch(/^Dentro de 5\.790\skm$/)
    expect(dueCompact({ due_date: null, days_left: null, due_mileage: 90000, km_left: null }).note).toBe('Sin km del vehículo')
    expect(dueCompact({ due_date: null, days_left: null, due_mileage: null, km_left: null }).value).toBe('Sin vencimiento')
  })
})

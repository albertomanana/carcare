/**
 * Telemetría del coche elegido: los datos clave que rodean al coche en el garaje 3D y que también se listan en HTML.
 * Todo sale de la API (ficha, resumen, recordatorios y, si la hay, la orden abierta en un taller). Donde falta un dato
 * se dice y se enlaza a la pantalla que lo resuelve; no hay puntuaciones ni estimaciones propias (regla 2).
 * Lógica pura: se prueba con Vitest.
 */
import type { Reminder, ReminderKind, ReminderState, Vehicle, VehicleSummary } from '@/api/types'
import { formatDate, formatDays, formatKm, formatMoney, formatRelativeDate } from './format'
import { FUEL_LABEL, TRANSMISSION_LABEL } from './labels'
import { plural } from './text'
import { visitPlace, visitStatus, type WorkshopVisit } from './workshopVisit'

export type TelemetryTone = 'neutral' | 'ok' | 'warning' | 'danger' | 'workshop'

export interface TelemetryDatum {
  id: string
  label: string
  value: string
  note: string | null
  tone: TelemetryTone
  /** Pantalla donde se ve o se completa el dato. */
  to: string | null
  /** Solo en el dato «En el taller»: la visita, para pintar su reloj en vivo. */
  visit?: WorkshopVisit
}

export interface TelemetryInput {
  vehicle: Vehicle
  /** `undefined` mientras carga. */
  summary: VehicleSummary | undefined
  /** Recordatorios pendientes del vehículo; `undefined` mientras cargan. */
  reminders: readonly Reminder[] | undefined
  visit: WorkshopVisit | undefined
  canExpenses: boolean
  /** Base de rutas del espacio (`/app/3`). */
  base: string
  now?: Date
}

const LOADING = '…'
const STATE_RANK: Record<ReminderState, number> = { overdue: 0, soon: 1, ok: 2, unknown: 3 }
const STATE_TONE: Record<ReminderState, TelemetryTone> = { overdue: 'danger', soon: 'warning', ok: 'ok', unknown: 'neutral' }

const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** El recordatorio pendiente más urgente de un tipo: primero lo vencido, luego lo que antes llega. */
export function mostUrgent(reminders: readonly Reminder[], kind: ReminderKind): Reminder | null {
  const rank = (r: Reminder) => STATE_RANK[r.state ?? 'unknown']
  const left = (r: Reminder) => r.days_left ?? Number.POSITIVE_INFINITY
  return reminders.filter((r) => r.kind === kind && r.status === 'pending').sort((a, b) => rank(a) - rank(b) || left(a) - left(b))[0] ?? null
}

/** Cuándo vence un recordatorio en dos o tres palabras, con la causa del vencimiento delante. */
export function dueCompact(r: Pick<Reminder, 'due_date' | 'days_left' | 'due_mileage' | 'km_left'>): { value: string; note: string | null } {
  const date = r.due_date ? formatDate(r.due_date) : null
  const atKm = r.due_mileage !== null ? `a los ${formatKm(r.due_mileage)}` : null
  const d = r.days_left
  const k = r.km_left
  if (k !== null && k < 0) return { value: `Pasado en ${formatKm(Math.abs(k))}`, note: atKm }
  if (date && d !== null) {
    if (d < 0) return { value: `Venció hace ${formatDays(d)}`, note: date }
    if (d === 0) return { value: 'Vence hoy', note: date }
    if (d === 1) return { value: 'Vence mañana', note: date }
    return { value: `En ${formatDays(d)}`, note: date }
  }
  if (k !== null) return { value: `Dentro de ${formatKm(k)}`, note: atKm }
  if (date) return { value: date, note: null }
  if (atKm) return { value: capital(atKm), note: 'Sin km del vehículo' }
  return { value: 'Sin vencimiento', note: null }
}

export function vehicleTelemetry({ vehicle, summary, reminders, visit, canExpenses, base, now = new Date() }: TelemetryInput): TelemetryDatum[] {
  const ficha = `${base}/vehiculos/${vehicle.id}`
  const out: TelemetryDatum[] = []

  if (visit) {
    const ready = visit.order.status === 'ready'
    out.push({
      id: 'taller',
      label: ready ? 'Listo en el taller' : 'En el taller',
      value: visitPlace(visit.order),
      note: `${visitStatus(visit.order)} · ${visit.workshopName}`,
      tone: ready ? 'ok' : 'workshop',
      to: `${base}/solicitudes/${visit.requestId}`,
      visit,
    })
  }

  // Estado general: lo que hay vencido o próximo según los recordatorios. No es una nota ni una medición.
  const { overdue_reminders: overdue, soon_reminders: soon, pending_reminders: pending } = vehicle.stats
  out.push({
    id: 'avisos',
    label: 'Avisos',
    value: overdue
      ? [plural(overdue, 'vencido', 'vencidos'), soon ? plural(soon, 'próximo', 'próximos') : null].filter(Boolean).join(' · ')
      : soon
        ? plural(soon, 'próximo', 'próximos')
        : pending
          ? 'Todo en plazo'
          : 'Sin recordatorios',
    note: pending ? 'Según tus intervalos' : 'Crea el primero',
    tone: overdue ? 'danger' : soon ? 'warning' : pending ? 'ok' : 'neutral',
    to: `${ficha}/recordatorios`,
  })

  out.push({
    id: 'km',
    label: 'Kilometraje',
    value: formatKm(vehicle.current_mileage, { empty: 'Sin km anotados' }),
    note: vehicle.mileage_updated_at ? `Leído ${formatRelativeDate(vehicle.mileage_updated_at, now)}` : 'Anota la primera lectura',
    tone: 'neutral',
    to: `${ficha}/historial`,
  })

  for (const [kind, label] of [
    ['itv', 'ITV'],
    ['insurance', 'Seguro'],
    ['tyres', 'Neumáticos'],
  ] as const) {
    if (!reminders) {
      out.push({ id: kind, label, value: LOADING, note: null, tone: 'neutral', to: `${ficha}/recordatorios` })
      continue
    }
    const r = mostUrgent(reminders, kind)
    if (!r) {
      out.push({ id: kind, label, value: 'Sin recordatorio', note: 'Crea uno para que avise', tone: 'neutral', to: `${ficha}/recordatorios` })
      continue
    }
    const due = dueCompact(r)
    out.push({ id: kind, label, value: due.value, note: due.note, tone: STATE_TONE[r.state ?? 'unknown'], to: `${ficha}/recordatorios` })
  }

  // Última revisión: la intervención de tipo revisión más reciente; si no hay ninguna, la última intervención que haya
  if (!summary) out.push({ id: 'revision', label: 'Última revisión', value: LOADING, note: null, tone: 'neutral', to: `${ficha}/historial` })
  else {
    const service = summary.since_last.find((s) => s.kind === 'service')
    const record = service?.record ?? null
    const last = summary.records.last
    if (record)
      out.push({
        id: 'revision',
        label: 'Última revisión',
        value: capital(formatRelativeDate(record.service_date, now)),
        note: service?.km != null ? `${formatKm(service.km)} desde entonces` : formatDate(record.service_date),
        tone: 'neutral',
        to: `${ficha}/historial`,
      })
    else if (last) out.push({ id: 'revision', label: 'Última intervención', value: capital(formatRelativeDate(last.service_date, now)), note: last.title, tone: 'neutral', to: `${ficha}/historial` })
    else out.push({ id: 'revision', label: 'Última revisión', value: 'Sin registrar', note: 'Anota la primera', tone: 'neutral', to: `${ficha}/intervenciones/nueva` })
  }

  const fuel = vehicle.fuel_type ? FUEL_LABEL[vehicle.fuel_type] : null
  const gearbox = vehicle.transmission ? TRANSMISSION_LABEL[vehicle.transmission] : null
  const motor = vehicle.engine ?? fuel
  out.push({
    id: 'motor',
    label: 'Motor',
    value: motor ?? 'Sin indicar',
    note: motor ? [vehicle.engine ? fuel : null, gearbox].filter(Boolean).join(' · ') || null : 'Completa la ficha',
    tone: 'neutral',
    to: motor ? `${ficha}/datos` : `${ficha}/editar`,
  })

  if (canExpenses)
    out.push({
      id: 'gasto',
      label: 'Gasto del mes',
      value: summary ? formatMoney(summary.totals.month) : LOADING,
      note: summary ? `${formatMoney(summary.totals.year)} este año` : null,
      tone: 'neutral',
      to: `${ficha}/gastos`,
    })

  return out
}

/** El dato dicho en una frase (lectores de pantalla y títulos). */
export function datumSentence(d: TelemetryDatum): string {
  return [`${d.label}: ${d.value === LOADING ? 'cargando' : d.value}`, d.note].filter(Boolean).join(', ')
}

import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router'
import { useVehicleSummary, useZones } from '@/api/hooks/vehicles'
import type { Vehicle, VehicleSummary, Zone } from '@/api/types'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { VehicleFirstSteps } from '@/components/vehicles/FirstSteps'
import { ReminderItem, ReminderList } from '@/components/vehicles/ReminderItem'
import { ZoneMap } from '@/components/vehicles/ZoneMap'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { vehicleFirstSteps } from '@/lib/firstSteps'
import { formatDate, formatDays, formatKm } from '@/lib/format'
import { INTERVAL_DISCLAIMER } from '@/lib/reminders'
import { plural } from '@/lib/text'
import { useReminderActions } from '../useReminderActions'
import { useVehicleOutlet } from '../vehicle-outlet'

const ReminderDialog = lazy(() => import('../dialogs/ReminderDialog'))

/** Filas de "Pendiente" en el Resumen. */
const PENDING_ROWS = 3

/**
 * Resumen de la ficha (5.2 del informe de UX): el estado del coche y nada más.
 * Pendiente · Zonas · Kilometraje y "Desde el último". Las cifras de gasto y los gráficos viven en Gastos y en el
 * Historial. Un vehículo sin datos ve una sola guía "Primeros pasos" en lugar de varios vacíos (tarea 26).
 */
export default function OverviewTab() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const zones = useZones(vehicle.id)
  const summary = useVehicleSummary(vehicle.id)
  const [reminderZone, setReminderZone] = useState<Zone | null>(null)
  const canOperate = ctx.can('operate') && !vehicle.archived_at
  const reminderActions = useReminderActions({ canOperate, currentMileage: vehicle.current_mileage })
  const base = `${ctx.base}/vehiculos/${vehicle.id}`
  const s = summary.data
  const guide = s && canOperate ? vehicleFirstSteps(vehicle, s, ctx.canExpenses) : []

  return (
    <div className="space-y-10">
      {summary.isPending ? (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Cargando el resumen…</span>
          <Skeleton aria-hidden className="h-6 w-32" />
          <Skeleton aria-hidden className="h-12 w-full" />
          <Skeleton aria-hidden className="h-12 w-full" />
        </div>
      ) : summary.isError || !s ? (
        <ErrorState error={summary.error} title="No se pudo cargar el resumen" onRetry={() => void summary.refetch()} compact />
      ) : guide.length ? (
        <VehicleFirstSteps vehicle={vehicle} steps={guide} />
      ) : (
        <Pending vehicle={vehicle} summary={s} actions={reminderActions.actions} />
      )}

      {zones.isPending ? (
        <Skeleton className="h-[420px] w-full rounded-card" />
      ) : zones.isError ? (
        <ErrorState error={zones.error} title="No se pudo cargar el mapa de zonas" onRetry={() => void zones.refetch()} />
      ) : (
        <ZoneMap
          vehicle={vehicle}
          zones={zones.data}
          canOperate={canOperate}
          onCreateReminder={setReminderZone}
          recordHref={(z) => `${base}/intervenciones/nueva?zona=${z}`}
          historyHref={(z) => `${base}/historial?ver=intervenciones&zona=${z}`}
        />
      )}

      {/* Con la guía de primeros pasos no se repiten vacíos: el kilometraje solo sale si ya hay alguna cifra */}
      {s && (!guide.length || hasMileageData(s)) && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Mileage vehicle={vehicle} summary={s} />
          {!guide.length && <SinceLast vehicle={vehicle} summary={s} canOperate={canOperate} />}
        </div>
      )}

      <Suspense fallback={null}>
        {reminderZone && <ReminderDialog vehicle={vehicle} open={!!reminderZone} defaultZone={reminderZone} onOpenChange={(o) => !o && setReminderZone(null)} />}
      </Suspense>
      {reminderActions.dialogs}
    </div>
  )
}

function Pending({ vehicle, summary: s, actions }: { vehicle: Vehicle; summary: VehicleSummary; actions: ReturnType<typeof useReminderActions>['actions'] }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const canOperate = ctx.can('operate') && !vehicle.archived_at
  const attention = s.reminders.upcoming.filter((r) => r.state === 'overdue' || r.state === 'soon')
  const shown = attention.slice(0, PENDING_ROWS)
  const rest = Math.max(0, vehicle.stats.pending_reminders - shown.length)
  const link = `${ctx.base}/vehiculos/${vehicle.id}/recordatorios`

  return (
    <Section title="Pendiente" description={`${INTERVAL_DISCLAIMER}.`}>
      {shown.length ? (
        <ReminderList aria-label="Avisos vencidos y próximos">
          {shown.map((r) => (
            <ReminderItem key={r.id} reminder={r} compact actions={actions} />
          ))}
        </ReminderList>
      ) : (
        <p className="border-y border-line py-3 text-sm text-fg-muted">
          {vehicle.stats.pending_reminders > 0 ? 'Nada vencido ni próximo.' : 'Este vehículo no tiene recordatorios.'}{' '}
          {canOperate && vehicle.stats.pending_reminders === 0 && (
            <button type="button" onClick={() => quick.run('reminder', vehicle.id)} className="font-medium text-accent-ink underline-offset-4 hover:underline">
              Crear uno
            </button>
          )}
        </p>
      )}
      {vehicle.stats.pending_reminders > 0 && (
        <p className="mt-2 text-sm text-fg-muted">
          {rest > 0 && `${plural(rest, 'otro en plazo', 'otros en plazo')} · `}
          <Link to={link} className="font-medium text-accent-ink underline-offset-4 hover:underline">
            Ver recordatorios
          </Link>
        </p>
      )}
    </Section>
  )
}

function hasMileageData(s: VehicleSummary): boolean {
  return s.mileage.km_this_year !== null || s.mileage.km_this_month !== null || s.mileage.avg_daily_km !== null
}

/** Kilometraje del vehículo (E7‑5): km del año, del mes y media diaria; si faltan lecturas, se dice. */
function Mileage({ vehicle, summary: s }: { vehicle: Vehicle; summary: VehicleSummary }) {
  const ctx = useWorkspace()
  const missing = 'Faltan lecturas para calcularlo'
  const rows: { label: string; value: string | null }[] = [
    { label: 'Este año', value: s.mileage.km_this_year !== null ? formatKm(s.mileage.km_this_year) : null },
    { label: 'Este mes', value: s.mileage.km_this_month !== null ? formatKm(s.mileage.km_this_month) : null },
    { label: 'Media diaria (90 días)', value: s.mileage.avg_daily_km !== null ? `${formatKm(s.mileage.avg_daily_km)}/día` : null },
  ]
  return (
    <Section
      title="Kilometraje"
      action={
        <Link to={`${ctx.base}/vehiculos/${vehicle.id}/historial?ver=km`} className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
          Ver lecturas
        </Link>
      }
    >
      <dl className="divide-y divide-line border-y border-line text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-fg-muted">{r.label}</dt>
            <dd className={r.value ? 'font-medium text-fg tabular' : 'text-fg-subtle'}>{r.value ?? missing}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

function SinceLast({ vehicle, summary: s, canOperate }: { vehicle: Vehicle; summary: VehicleSummary; canOperate: boolean }) {
  const ctx = useWorkspace()
  const base = `${ctx.base}/vehiculos/${vehicle.id}`
  return (
    <Section
      title="Desde el último"
      action={
        <Link to={`${base}/historial?ver=intervenciones`} className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
          Ver historial
        </Link>
      }
    >
      <ul className="divide-y divide-line border-y border-line text-sm">
        {s.since_last.map((item) => (
          <li key={item.kind} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
            <span className="min-w-0">
              <span className="font-medium text-fg">{item.label}</span>
              {item.record && <span className="text-fg-muted tabular"> · {formatDate(item.record.service_date)}</span>}
            </span>
            {item.record ? (
              <span className="text-fg-muted tabular">
                {item.days !== null ? `hace ${formatDays(item.days)}` : 'sin fecha'}
                {' · '}
                {item.km !== null ? formatKm(item.km) : 'km sin datos'}
              </span>
            ) : canOperate ? (
              <Link to={`${base}/intervenciones/nueva?servicio=${item.kind}`} aria-label={`Registrar: ${item.label}`} className="font-medium text-accent-ink underline-offset-4 hover:underline">
                Registrar
              </Link>
            ) : (
              <span className="text-fg-subtle">Sin registros</span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

import { CalendarClock, Fuel, Gauge, History, Receipt, Route, Wrench } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router'
import { useVehicleSummary, useZones } from '@/api/hooks/vehicles'
import type { MaintenanceRecordRef, VehicleSummary, Zone } from '@/api/types'
import { MileageArea, MonthlyBars } from '@/components/charts/Charts'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ReminderItem } from '@/components/vehicles/ReminderItem'
import { ZoneMap } from '@/components/vehicles/ZoneMap'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { formatDate, formatDays, formatKm, formatMoney, formatRelativeDate } from '@/lib/format'
import { RECORD_TYPE_ICON, RECORD_TYPE_LABEL } from '@/lib/labels'
import { useReminderActions } from '../useReminderActions'
import { useVehicleOutlet } from '../vehicle-outlet'

const ReminderDialog = lazy(() => import('../dialogs/ReminderDialog'))

export default function OverviewTab() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const zones = useZones(vehicle.id)
  const summary = useVehicleSummary(vehicle.id)
  const [reminderZone, setReminderZone] = useState<Zone | null>(null)
  const canOperate = ctx.can('operate') && !vehicle.archived_at
  const reminderActions = useReminderActions({ canOperate, currentMileage: vehicle.current_mileage })
  const base = `${ctx.base}/vehiculos/${vehicle.id}`

  return (
    <div className="space-y-8">
      {zones.isPending ? (
        <Skeleton className="h-[420px] w-full rounded-hero" />
      ) : zones.isError ? (
        <ErrorState error={zones.error} title="No se pudo cargar el mapa de zonas" onRetry={() => void zones.refetch()} />
      ) : (
        <ZoneMap
          vehicle={vehicle}
          zones={zones.data}
          canOperate={canOperate}
          onCreateReminder={setReminderZone}
          recordHref={(z) => `${base}/intervenciones/nueva?zona=${z}`}
          historyHref={(z) => `${base}/historial?zona=${z}`}
        />
      )}

      {summary.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <StatCard key={i} label="Cargando" value="" loading />
          ))}
        </div>
      ) : summary.isError ? (
        <ErrorState error={summary.error} title="No se pudo cargar el resumen" onRetry={() => void summary.refetch()} compact />
      ) : (
        renderSummary(summary.data)
      )}

      <Suspense fallback={null}>
        {reminderZone && (
          <ReminderDialog vehicle={vehicle} open={!!reminderZone} defaultZone={reminderZone} onOpenChange={(o) => !o && setReminderZone(null)} />
        )}
      </Suspense>
      {reminderActions.dialogs}
    </div>
  )

  // Función de render (no componente) para no remontar el bloque en cada render
  function renderSummary(s: VehicleSummary) {
    const money = ctx.canExpenses
    const upcoming = s.reminders.upcoming
    return (
      <>
        <section aria-label="Cifras clave" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Kilometraje"
            icon={<Gauge aria-hidden />}
            value={s.mileage.current !== null ? formatKm(s.mileage.current).replace(' km', '') : '—'}
            unit={s.mileage.current !== null ? 'km' : undefined}
            hint={s.mileage.updated_at ? `Actualizado ${formatRelativeDate(s.mileage.updated_at)}` : 'Sin lecturas todavía'}
            unavailable={s.mileage.current === null ? { reason: 'Aún no hay ninguna lectura de kilometraje.', action: canOperate ? <Button size="sm" onClick={() => quick.run('mileage', vehicle.id)}>Anotar km</Button> : undefined } : undefined}
          />
          <StatCard
            label="Km este mes"
            icon={<Route aria-hidden />}
            value={s.mileage.km_this_month !== null ? formatKm(s.mileage.km_this_month).replace(' km', '') : '—'}
            unit="km"
            hint={s.mileage.avg_daily_km !== null ? `Media: ${formatKm(s.mileage.avg_daily_km)}/día (90 días)` : 'Media diaria: faltan lecturas'}
            unavailable={s.mileage.km_this_month === null ? { reason: 'Necesitas al menos dos lecturas para calcularlo.', action: canOperate ? <Button size="sm" onClick={() => quick.run('mileage', vehicle.id)}>Anotar km</Button> : undefined } : undefined}
          />
          {money ? (
            <>
              <StatCard
                label="Gasto este año"
                icon={<Receipt aria-hidden />}
                value={formatMoney(s.totals.year)}
                change={s.totals.change_pct}
                upIsGood={false}
                changeLabel="vs. periodo anterior"
                hint={`Este mes: ${formatMoney(s.totals.month)}`}
              />
              <StatCard
                label="Coste por km"
                icon={<Fuel aria-hidden />}
                value={s.cost_per_km.value ? formatMoney(s.cost_per_km.value) : '—'}
                hint={s.cost_per_km.km !== null ? `Sobre ${formatKm(s.cost_per_km.km)} del periodo` : undefined}
                unavailable={
                  !s.cost_per_km.available
                    ? {
                        reason: s.cost_per_km.reason,
                        action: canOperate ? (
                          <Button size="sm" onClick={() => quick.run('mileage', vehicle.id)}>
                            Anotar km
                          </Button>
                        ) : undefined,
                      }
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <StatCard label="Intervenciones" icon={<Wrench aria-hidden />} value={String(s.records.count)} hint={s.records.last ? `Última: ${formatDate(s.records.last.service_date)}` : 'Sin historial'} />
              <StatCard
                label="Recordatorios"
                icon={<CalendarClock aria-hidden />}
                value={String(s.reminders.overdue + s.reminders.soon)}
                hint={`${s.reminders.overdue} vencidos · ${s.reminders.soon} próximos`}
              />
            </>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <Section
            title="Próximos recordatorios"
            action={
              <Link to={`${base}/recordatorios`} className="text-sm font-medium text-accent-ink hover:underline">
                Ver todos
              </Link>
            }
          >
            {upcoming.length ? (
              <ul className="space-y-2">
                {upcoming.slice(0, 4).map((r) => (
                  <ReminderItem key={r.id} reminder={r} actions={reminderActions.actions} compact />
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<CalendarClock />}
                title="Sin recordatorios pendientes"
                description="Crea uno para la ITV, el seguro o el próximo cambio de aceite."
                action={canOperate && <Button onClick={() => quick.run('reminder', vehicle.id)}>Nuevo recordatorio</Button>}
              />
            )}
          </Section>

          <Section title="Desde el último…" description="Calculado con tu historial de intervenciones.">
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {s.since_last.map((item) => (
                <li key={item.kind} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{item.label}</p>
                    <p className="text-xs text-fg-muted">{item.record ? `${item.record.title} · ${formatDate(item.record.service_date)}` : 'Sin registros de este tipo'}</p>
                  </div>
                  {item.record ? (
                    <p className="shrink-0 text-right text-sm tabular">
                      <span className="block text-fg">{item.days !== null ? `hace ${formatDays(item.days)}` : '—'}</span>
                      <span className="block text-xs text-fg-muted">{item.km !== null ? `${formatKm(item.km)} recorridos` : 'km sin datos'}</span>
                    </p>
                  ) : (
                    canOperate && (
                      <ButtonLink size="sm" variant="ghost" to={`${base}/intervenciones/nueva?servicio=${item.kind}`}>
                        Registrar
                      </ButtonLink>
                    )
                  )}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Section
            title="Últimas intervenciones"
            action={
              <Link to={`${base}/historial`} className="text-sm font-medium text-accent-ink hover:underline">
                Historial completo
              </Link>
            }
          >
            {s.records.recent.length ? (
              <ul className="divide-y divide-line rounded-card border border-line bg-surface">
                {s.records.recent.slice(0, 5).map((r) => (
                  <RecentRecord key={r.id} record={r} href={`${base}/historial#intervencion-${r.id}`} showCost={money} />
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<History />}
                title="Aún no hay intervenciones"
                description="Registra mantenimientos, reparaciones o la ITV para tener el historial completo."
                action={canOperate && <ButtonLink to={`${base}/intervenciones/nueva`}>Nueva intervención</ButtonLink>}
              />
            )}
          </Section>

          <Section title="Kilometraje" description="Lecturas de los últimos 12 meses.">
            <Card className="p-4">
              {s.mileage.series.length >= 2 ? (
                <MileageArea series={s.mileage.series} label={`Kilometraje de ${vehicle.display_name}`} />
              ) : (
                <p className="py-10 text-center text-sm text-fg-muted">Con dos o más lecturas verás aquí la evolución del kilometraje.</p>
              )}
            </Card>
          </Section>
        </div>

        {money && (
          <Section title="Gasto mensual" description="Últimos 12 meses, de todos los gastos del vehículo.">
            <Card className="p-4">
              <MonthlyBars data={s.by_month} label={`Gasto mensual de ${vehicle.display_name}`} />
            </Card>
          </Section>
        )}
      </>
    )
  }
}

function RecentRecord({ record, href, showCost }: { record: MaintenanceRecordRef; href: string; showCost: boolean }) {
  const Icon = RECORD_TYPE_ICON[record.type]
  return (
    <li>
      <Link to={href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-2 text-fg-muted">
          <Icon aria-hidden className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{record.title}</span>
          <span className="block text-xs text-fg-muted tabular">
            {[RECORD_TYPE_LABEL[record.type], formatDate(record.service_date), record.mileage !== null ? formatKm(record.mileage) : null].filter(Boolean).join(' · ')}
          </span>
        </span>
        {showCost && record.total_cost && <span className="shrink-0 text-sm font-medium text-fg tabular">{formatMoney(record.total_cost)}</span>}
      </Link>
    </li>
  )
}


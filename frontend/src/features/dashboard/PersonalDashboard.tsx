import { ArrowRight, BellPlus, CalendarClock, Car, Fuel, Gauge, History, Plus, Receipt, ScanEye, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useDashboard } from '@/api/hooks/workspaces'
import { useVehicleSummary } from '@/api/hooks/vehicles'
import type { Activity, PersonalDashboard as PersonalDashboardData, Vehicle, VehicleSummary } from '@/api/types'
import { MonthlyBars } from '@/components/charts/Charts'
import { Plate, StatusPill } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ReminderItem } from '@/components/vehicles/ReminderItem'
import { VehicleSwitcher } from '@/components/vehicles/VehicleSwitcher'
import { useAuth } from '@/features/auth/auth-context'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useReminderActions } from '@/features/vehicle/useReminderActions'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatDateTime, formatDays, formatDecimal, formatKm, formatMoney, formatNumber, formatRelativeDate, formatRelativeTime, todayISO } from '@/lib/format'
import { FUEL_LABEL } from '@/lib/labels'
import { dueSummary } from '@/lib/reminders'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { REMINDER_STATE } from '@/lib/status'
import { CarViewer } from '@/three'

/** Cabina del particular: coche protagonista, cifras reales y lo próximo que toca. */
export default function PersonalDashboard() {
  const ctx = useWorkspace()
  const { user } = useAuth()
  useDocumentTitle('Cabina')
  const dashboard = useDashboard(ctx.id)
  const data = dashboard.data?.type === 'personal' ? dashboard.data : null
  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <>
      <PageHeader
        eyebrow={formatDate(todayISO(), 'weekday')}
        title={firstName ? `Hola, ${firstName}` : 'Tu cabina'}
        description={data && data.vehicles.length ? resumeLine(data) : 'Todo lo de tus vehículos, de un vistazo.'}
      />
      {dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      ) : !data || data.vehicles.length === 0 ? (
        <Onboarding />
      ) : (
        <Cockpit data={data} />
      )}
    </>
  )
}

function resumeLine(d: PersonalDashboardData): string {
  const { overdue, soon } = d.reminders
  if (overdue > 0) return `Tienes ${overdue} ${overdue === 1 ? 'recordatorio vencido' : 'recordatorios vencidos'}${soon ? ` y ${soon} ${soon === 1 ? 'próximo' : 'próximos'}` : ''}.`
  if (soon > 0) return `Nada vencido. ${soon} ${soon === 1 ? 'recordatorio se acerca' : 'recordatorios se acercan'}.`
  return 'Nada vencido ni próximo: todo en plazo según tus intervalos.'
}

function Cockpit({ data }: { data: PersonalDashboardData }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const storageKey = STORAGE_KEYS.lastVehicle(ctx.id)
  const [selectedId, setSelectedId] = useState<number>(() => {
    const stored = Number(readStorage(storageKey))
    return data.vehicles.some((v) => v.id === stored) ? stored : data.vehicles[0].id
  })
  const vehicle = data.vehicles.find((v) => v.id === selectedId) ?? data.vehicles[0]
  const summary = useVehicleSummary(vehicle.id)
  const canOperate = ctx.can('operate')
  const reminderActions = useReminderActions({ canOperate, currentMileage: vehicle.current_mileage })

  const select = (id: number) => {
    setSelectedId(id)
    writeStorage(storageKey, String(id))
  }

  return (
    <div className="space-y-8">
      {data.vehicles.length > 1 && <VehicleSwitcher vehicles={data.vehicles} value={vehicle.id} onChange={select} label="Vehículo protagonista" />}

      <Hero vehicle={vehicle} summary={summary.data ?? null} loading={summary.isPending} onMileage={() => quick.run('mileage', vehicle.id)} canOperate={canOperate} />

      <section aria-label={`Cifras de ${vehicle.display_name}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCards vehicle={vehicle} summary={summary.data ?? null} loading={summary.isPending} error={summary.isError} />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section
          title="Gasto mensual"
          description={data.vehicles.length > 1 ? 'Todos tus vehículos, últimos 12 meses.' : 'Últimos 12 meses.'}
          action={
            ctx.can('manage') && (
              <Link to={`${ctx.base}/analitica`} className="text-sm font-medium text-accent-ink hover:underline">
                Analítica
              </Link>
            )
          }
        >
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-fg-subtle">Este mes</p>
                <p className="font-display text-2xl font-semibold text-fg-warm tabular">{formatMoney(data.spend.month)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-fg-subtle">Este año</p>
                <p className="font-display text-2xl font-semibold text-fg-warm tabular">{formatMoney(data.spend.year)}</p>
              </div>
            </div>
            <MonthlyBars data={data.spend.by_month} label="Gasto mensual de los últimos 12 meses" />
          </Card>
        </Section>

        <Section
          title="Próximos vencimientos"
          description="Según tus intervalos, no medido."
          action={
            <Link to={`${ctx.base}/agenda`} className="text-sm font-medium text-accent-ink hover:underline">
              Agenda
            </Link>
          }
        >
          {data.reminders.upcoming.length ? (
            <ul className="space-y-2">
              {data.reminders.upcoming.slice(0, 5).map((r) => (
                <ReminderItem key={r.id} reminder={r} compact actions={reminderActions.actions} vehicleLink={data.vehicles.length > 1 ? `${ctx.base}/vehiculos/${r.vehicle_id}/recordatorios` : undefined} />
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={<CalendarClock />}
              title="Sin vencimientos pendientes"
              description="Crea recordatorios para la ITV, el seguro o el aceite y te avisaremos aquí."
              action={
                canOperate && (
                  <Button icon={<BellPlus aria-hidden />} onClick={() => quick.run('reminder', vehicle.id)}>
                    Nuevo recordatorio
                  </Button>
                )
              }
            />
          )}
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={`Desde el último… · ${vehicle.display_name}`} description="Calculado con tu historial de intervenciones.">
          <SinceLast vehicle={vehicle} summary={summary.data ?? null} loading={summary.isPending} canOperate={canOperate} />
        </Section>
        <Section title="Actividad reciente">
          <ActivityList items={data.recent_activity} />
        </Section>
      </div>
      {reminderActions.dialogs}
    </div>
  )
}

function Hero({ vehicle, summary, loading, onMileage, canOperate }: { vehicle: Vehicle; summary: VehicleSummary | null; loading: boolean; onMileage: () => void; canOperate: boolean }) {
  const ctx = useWorkspace()
  const base = `${ctx.base}/vehiculos/${vehicle.id}`
  const next = summary?.reminders.upcoming[0] ?? null
  const nextState = next?.state ? REMINDER_STATE[next.state] : null
  return (
    <section aria-labelledby="hero-vehicle" className="relative overflow-hidden rounded-hero border border-line bg-surface">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_70%_50%,black_10%,transparent_70%)]" />
      <div className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="flex flex-col justify-between gap-6 p-5 sm:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="hero-vehicle" className="font-display text-3xl font-semibold tracking-tight text-fg-warm sm:text-4xl">
                {vehicle.display_name}
              </h2>
              <Plate value={vehicle.plate} />
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {[vehicle.nickname ? `${vehicle.make} ${vehicle.model}` : null, vehicle.version, vehicle.year, vehicle.fuel_type ? FUEL_LABEL[vehicle.fuel_type] : null].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Cuentakilómetros</p>
            <p className="mt-1 font-display text-5xl font-semibold leading-none tracking-tight text-fg-warm tabular sm:text-6xl">
              {vehicle.current_mileage !== null ? formatNumber(vehicle.current_mileage) : '—'}
              <span className="ml-2 text-xl font-medium text-fg-muted">km</span>
            </p>
            <p className="mt-2 text-sm text-fg-muted">{vehicle.mileage_updated_at ? `Última lectura ${formatRelativeDate(vehicle.mileage_updated_at)} (${formatDate(vehicle.mileage_updated_at)})` : 'Aún sin lecturas de kilometraje'}</p>
          </div>

          {loading ? (
            <Skeleton className="h-16 w-full max-w-sm rounded-card" />
          ) : next ? (
            <Link to={`${base}/recordatorios`} className="block max-w-md rounded-card border border-line bg-surface-2/70 p-3 transition-colors hover:border-line-strong">
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Lo próximo</span>
                {nextState && <StatusPill status={nextState} size="sm" />}
              </span>
              <span className="mt-1 block truncate font-medium text-fg">{next.title}</span>
              <span className="block truncate text-sm text-fg-muted">{dueSummary(next)}</span>
            </Link>
          ) : (
            <p className="max-w-md rounded-card border border-dashed border-line p-3 text-sm text-fg-muted">Sin recordatorios pendientes para este vehículo.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {canOperate && (
              <Button variant="primary" icon={<Gauge aria-hidden />} onClick={onMileage}>
                Anotar km
              </Button>
            )}
            <ButtonLink to={base} iconRight={<ArrowRight aria-hidden />}>
              Ver ficha
            </ButtonLink>
          </div>
        </div>

        <div className="relative min-h-[260px] border-t border-line sm:min-h-[340px] lg:min-h-[440px] lg:border-l lg:border-t-0">
          <CarViewer
            key={vehicle.id}
            appearance={{ bodyType: vehicle.body_type, colorHex: vehicle.color_hex }}
            mode="showcase"
            className="absolute inset-0 h-full w-full"
            ariaLabel={`Modelo 3D ilustrativo de ${vehicle.display_name}`}
          />
          <Link
            to={base}
            className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface/85 px-3 text-xs font-medium text-fg backdrop-blur hover:border-line-strong"
          >
            <ScanEye aria-hidden className="size-4 text-accent-ink" />
            Inspeccionar zonas
          </Link>
        </div>
      </div>
    </section>
  )
}

function KpiCards({ vehicle, summary: s, loading, error }: { vehicle: Vehicle; summary: VehicleSummary | null; loading: boolean; error: boolean }) {
  const quick = useQuickActions()
  const ctx = useWorkspace()
  const canOperate = ctx.can('operate')
  if (loading || error || !s)
    return (
      <>
        {['Km este mes', 'Gasto del año', 'Coste por km', 'Consumo medio'].map((l) => (
          <StatCard key={l} label={l} value="—" loading={loading} unavailable={!loading ? { reason: 'No se pudo cargar el resumen.' } : undefined} />
        ))}
      </>
    )
  const kmAction = canOperate ? (
    <Button size="sm" onClick={() => quick.run('mileage', vehicle.id)}>
      Anotar km
    </Button>
  ) : undefined
  return (
    <>
      <StatCard
        label="Km este mes"
        icon={<Car aria-hidden />}
        value={s.mileage.km_this_month !== null ? formatKm(s.mileage.km_this_month).replace(' km', '') : '—'}
        unit="km"
        hint={s.mileage.avg_daily_km !== null ? `Media: ${formatKm(s.mileage.avg_daily_km)}/día` : undefined}
        unavailable={s.mileage.km_this_month === null ? { reason: 'Necesitas dos lecturas este mes para calcularlo.', action: kmAction } : undefined}
      />
      <StatCard label="Gasto del año" icon={<Receipt aria-hidden />} value={formatMoney(s.totals.year)} hint={`Este mes: ${formatMoney(s.totals.month)}`} change={s.totals.change_pct} upIsGood={false} />
      <StatCard
        label="Coste por km"
        icon={<Fuel aria-hidden />}
        value={s.cost_per_km.value ? formatMoney(s.cost_per_km.value) : '—'}
        hint={s.cost_per_km.km !== null ? `Sobre ${formatKm(s.cost_per_km.km)}` : undefined}
        unavailable={!s.cost_per_km.available ? { reason: s.cost_per_km.reason, action: kmAction } : undefined}
      />
      <StatCard
        label="Consumo medio"
        icon={<Fuel aria-hidden />}
        value={s.consumption.value ? formatDecimal(s.consumption.value, 1) : '—'}
        unit={s.consumption.unit?.replace('100km', '100 km') ?? undefined}
        hint={s.consumption.available ? `Lleno a lleno · ${s.consumption.fills} repostajes` : undefined}
        unavailable={
          !s.consumption.available
            ? {
                reason: s.consumption.reason,
                action:
                  canOperate && ctx.canExpenses ? (
                    <Button size="sm" onClick={() => quick.run('expense', vehicle.id)}>
                      Añadir repostaje
                    </Button>
                  ) : undefined,
              }
            : undefined
        }
      />
    </>
  )
}

function SinceLast({ vehicle, summary, loading, canOperate }: { vehicle: Vehicle; summary: VehicleSummary | null; loading: boolean; canOperate: boolean }) {
  const ctx = useWorkspace()
  if (loading) return <Skeleton className="h-44 w-full rounded-card" />
  if (!summary) return <p className="text-sm text-fg-muted">No se pudo cargar.</p>
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {summary.since_last.map((item) => (
        <li key={item.kind} className="flex items-center gap-3 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-2 text-fg-muted">
            {item.kind === 'itv' ? <History aria-hidden className="size-4" /> : <Wrench aria-hidden className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">{item.label}</p>
            <p className="truncate text-xs text-fg-muted">{item.record ? `${formatDate(item.record.service_date)}${item.record.mileage !== null ? ` · ${formatKm(item.record.mileage)}` : ''}` : 'Sin registros de este tipo'}</p>
          </div>
          {item.record ? (
            <p className="shrink-0 text-right text-sm tabular">
              <span className="block font-medium text-fg">{item.days !== null ? `hace ${formatDays(item.days)}` : '—'}</span>
              <span className="block text-xs text-fg-muted">{item.km !== null ? `${formatKm(item.km)} desde entonces` : 'km sin datos'}</span>
            </p>
          ) : (
            canOperate && (
              <ButtonLink size="sm" variant="ghost" to={`${ctx.base}/vehiculos/${vehicle.id}/intervenciones/nueva?servicio=${item.kind}`} icon={<Plus aria-hidden />}>
                Registrar
              </ButtonLink>
            )
          )}
        </li>
      ))}
    </ul>
  )
}

function ActivityList({ items }: { items: Activity[] }) {
  const ctx = useWorkspace()
  if (!items.length) return <EmptyState compact icon={<History />} title="Sin actividad todavía" description="Aquí verás lo último que registres." />
  return (
    <ol className="divide-y divide-line rounded-card border border-line bg-surface">
      {items.slice(0, 8).map((a) => {
        const content = (
          <>
            <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-fg">{a.summary}</span>
              <span className="block text-xs text-fg-subtle">
                <time dateTime={a.created_at} title={formatDateTime(a.created_at)}>
                  {formatRelativeTime(a.created_at, new Date(), { pastOnly: true })}
                </time>
              </span>
            </span>
          </>
        )
        return (
          <li key={a.id}>
            {a.vehicle_id ? (
              <Link to={`${ctx.base}/vehiculos/${a.vehicle_id}/diario`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60">
                {content}
              </Link>
            ) : (
              <div className="flex gap-3 px-4 py-3">{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Onboarding() {
  const ctx = useWorkspace()
  return (
    <section className="relative overflow-hidden rounded-hero border border-line bg-surface p-6 sm:p-10">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-ink">Empecemos</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg-warm sm:text-4xl">Añade tu primer vehículo</h2>
        <p className="mt-3 text-fg-muted">Con la marca, el modelo, la carrocería y el color ya tienes tu coche en 3D. Después, cada repostaje, intervención o recordatorio irá construyendo su historia.</p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { n: '1', title: 'Tu vehículo', text: 'Marca, modelo y aspecto.' },
            { n: '2', title: 'Sus kilómetros', text: 'La lectura de hoy.' },
            { n: '3', title: 'Tus recordatorios', text: 'ITV, seguro, aceite…' },
          ].map((s) => (
            <li key={s.n} className="rounded-card border border-line bg-surface-2/60 p-4">
              <span className="font-display text-2xl font-semibold text-accent-ink tabular">{s.n}</span>
              <p className="mt-1 font-medium text-fg">{s.title}</p>
              <p className="text-sm text-fg-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        {ctx.can('operate') && (
          <ButtonLink to={`${ctx.base}/vehiculos/nuevo`} variant="primary" size="lg" className="mt-8" icon={<Plus aria-hidden />}>
            Añadir vehículo
          </ButtonLink>
        )}
      </div>
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <span className="sr-only">Cargando tu cabina…</span>
      <div aria-hidden className="flex gap-2">
        <Skeleton className="h-14 w-48 rounded-card" />
        <Skeleton className="h-14 w-48 rounded-card" />
      </div>
      <Skeleton className="h-[440px] w-full rounded-hero" />
      <div aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
    </div>
  )
}

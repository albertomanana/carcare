import { BellPlus, CarFront, ChevronDown, Gauge, Plus, Receipt, Wrench } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useVehicleSummary } from '@/api/hooks/vehicles'
import { useDashboard } from '@/api/hooks/workspaces'
import type { Activity, PersonalDashboard as PersonalDashboardData, Vehicle } from '@/api/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { buttonClasses } from '@/components/ui/variants'
import { VehicleFirstSteps } from '@/components/vehicles/FirstSteps'
import { ReminderItem, ReminderList } from '@/components/vehicles/ReminderItem'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useReminderActions } from '@/features/vehicle/useReminderActions'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { Showroom } from './Showroom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { paintVars } from '@/lib/colors'
import { dashboardFirstSteps } from '@/lib/firstSteps'
import { formatDate, formatDateTime, formatKm, formatMoney, formatPlate, formatRelativeDate, formatRelativeTime } from '@/lib/format'
import { INTERVAL_DISCLAIMER } from '@/lib/reminders'
import { plural } from '@/lib/text'

/** Filas de "Pendiente" en Inicio (5.1: máximo 5). */
const PENDING_ROWS = 5

/**
 * Inicio del particular (5.1 del informe de UX): todo es de **todos** los vehículos, así que ninguna cifra
 * mezcla ámbitos (hallazgo C3). Una sola petición (`/dashboard`); el único 3D es la placa de muestra (Showroom).
 */
export default function PersonalDashboard() {
  const ctx = useWorkspace()
  useDocumentTitle('Inicio')
  const dashboard = useDashboard(ctx.id)
  const data = dashboard.data?.type === 'personal' ? dashboard.data : null
  const hasVehicles = !!data && data.vehicles.length > 0

  return (
    <>
      <PageHeader title="Inicio" description={hasVehicles ? statusLine(data) : undefined} actions={hasVehicles && ctx.can('operate') ? <RegisterMenu vehicles={data.vehicles} /> : undefined} />
      {dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      ) : !data || data.vehicles.length === 0 ? (
        <Onboarding />
      ) : (
        <Home data={data} />
      )}
    </>
  )
}

/** Línea de estado bajo el título: solo lo que informa (R10). */
function statusLine(d: PersonalDashboardData): string {
  const { overdue, soon } = d.reminders
  if (!overdue && !soon) return 'Nada vencido ni próximo.'
  const parts = [overdue ? plural(overdue, 'aviso vencido', 'avisos vencidos') : null, soon ? plural(soon, 'próximo', 'próximos') : null].filter(Boolean)
  if (!overdue) return `${plural(soon, 'aviso próximo', 'avisos próximos')}.`
  return `${parts.join(' y ')}.`
}

/**
 * "Registrar ▾" (la acción primaria de Inicio). En el móvil no se pinta: la barra inferior ya tiene "Registrar"
 * con lo mismo (R1 y R14). Con un solo vehículo, las acciones van directas a él.
 */
function RegisterMenu({ vehicles }: { vehicles: Vehicle[] }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const only = vehicles.length === 1 ? vehicles[0].id : undefined
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonClasses({ variant: 'primary', className: 'max-md:hidden' })}>
        <Plus aria-hidden />
        Registrar
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem icon={<Gauge aria-hidden />} onSelect={() => quick.run('mileage', only)}>
          Kilometraje
        </DropdownMenuItem>
        {ctx.canExpenses && (
          <DropdownMenuItem icon={<Receipt aria-hidden />} onSelect={() => quick.run('expense', only)}>
            Gasto o repostaje
          </DropdownMenuItem>
        )}
        <DropdownMenuItem icon={<Wrench aria-hidden />} onSelect={() => quick.run('record', only)}>
          Intervención
        </DropdownMenuItem>
        <DropdownMenuItem icon={<BellPlus aria-hidden />} onSelect={() => quick.run('reminder', only)}>
          Recordatorio
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Home({ data }: { data: PersonalDashboardData }) {
  const ctx = useWorkspace()
  const canOperate = ctx.can('operate')
  const guide = canOperate ? dashboardFirstSteps(data, ctx.canExpenses) : null

  // Primer pantallazo: la placa de muestra del vehículo elegido y, a su lado, lo que toca. Debajo, sus tres cifras del
  // mes; después, los vehículos, el gasto de todos y lo último registrado.
  const active = data.vehicles.filter((v) => !v.archived_at)
  const [selectedId, setSelectedId] = useState<Vehicle['id'] | null>(null)
  const vehicle = active.find((v) => v.id === selectedId) ?? active[0]

  return (
    <div className="space-y-10">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] xl:items-start">
        {vehicle && <Showroom vehicles={data.vehicles} vehicle={vehicle} onSelect={setSelectedId} />}
        {guide ? <VehicleFirstSteps vehicle={guide.vehicle} steps={guide.steps} showName /> : <Pending data={data} canOperate={canOperate} />}
      </div>

      {vehicle && <MonthFigures vehicle={vehicle} canOperate={canOperate} />}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <VehiclesSection vehicles={data.vehicles} canOperate={canOperate} />
        {!guide && (
          <div className="min-w-0 space-y-10">
            {ctx.canExpenses && <SpendSection data={data} />}
            <Section title="Último registrado">
              <ActivityList items={data.recent_activity} />
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Pending({ data, canOperate }: { data: PersonalDashboardData; canOperate: boolean }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  // La lista mezcla vehículos: los km de referencia se deducen de cada recordatorio
  const reminderActions = useReminderActions({ canOperate })
  const attention = data.reminders.upcoming.filter((r) => r.state === 'overdue' || r.state === 'soon')
  const shown = attention.slice(0, PENDING_ROWS)
  const total = data.reminders.overdue + data.reminders.soon
  const multi = data.vehicles.length > 1

  return (
    <Section
      title="Pendiente"
      description={`${INTERVAL_DISCLAIMER}.`}
      action={
        <Link to={`${ctx.base}/agenda`} className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
          {total > shown.length ? `Ver los ${total} en la agenda` : 'Ver la agenda'}
        </Link>
      }
    >
      {shown.length ? (
        <ReminderList aria-label="Avisos vencidos y próximos">
          {shown.map((r) => (
            <ReminderItem key={r.id} reminder={r} compact actions={reminderActions.actions} vehicleLink={multi ? `${ctx.base}/vehiculos/${r.vehicle_id}/recordatorios` : undefined} />
          ))}
        </ReminderList>
      ) : (
        <p className="rounded-card border border-line px-4 py-3 text-sm text-fg-muted">
          Nada vencido ni próximo.{' '}
          {canOperate && (
            <button type="button" onClick={() => quick.run('reminder')} className="font-medium text-accent-ink underline-offset-4 hover:underline">
              Crear un recordatorio
            </button>
          )}
        </p>
      )}
      {reminderActions.dialogs}
    </Section>
  )
}

function VehiclesSection({ vehicles, canOperate }: { vehicles: Vehicle[]; canOperate: boolean }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  return (
    <Section
      title="Vehículos"
      action={
        canOperate && (
          <Link to={`${ctx.base}/vehiculos/nuevo`} className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
            Añadir vehículo
          </Link>
        )
      }
    >
      <ul className="list-panel">
        {vehicles.map((v) => {
          const details = [v.nickname ? `${v.make} ${v.model}` : v.version, v.year].filter(Boolean).join(' · ')
          return (
            <li key={v.id} className="@container flex items-center gap-3 py-3">
              {/* muestra de su pintura: el color vive aquí dentro */}
              <span aria-hidden style={paintVars(v.color_hex) as CSSProperties} className="lacquer size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Link to={`${ctx.base}/vehiculos/${v.id}`} className="font-medium text-fg underline-offset-4 hover:underline">
                    {v.display_name}
                  </Link>
                  {v.plate && <span className="tag-label text-fg-muted">{formatPlate(v.plate)}</span>}
                </p>
                {details && <p className="truncate text-sm text-fg-muted">{details}</p>}
                <p className="tabular text-sm text-fg-muted @[30rem]:hidden">
                  {v.current_mileage !== null ? formatKm(v.current_mileage) : 'Sin km'}
                  {v.mileage_updated_at && ` · ${formatRelativeDate(v.mileage_updated_at)}`}
                </p>
              </div>
              <p className="tabular hidden shrink-0 text-right text-sm @[30rem]:block">
                <span className="block whitespace-nowrap font-medium text-fg">{v.current_mileage !== null ? formatKm(v.current_mileage) : 'Sin km'}</span>
                {v.mileage_updated_at && <span className="block whitespace-nowrap text-xs text-fg-subtle">{formatRelativeDate(v.mileage_updated_at)}</span>}
              </p>
              {canOperate && !v.archived_at && (
                <Button variant="ghost" size="sm" onClick={() => quick.run('mileage', v.id)} aria-label={`Anotar km de ${v.display_name}`}>
                  Anotar km
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/**
 * Tres cifras del mes del vehículo de la placa, alineadas a la derecha: gasto, km y coste por km. Salen del resumen del
 * vehículo; si falta un dato se dice cuál y se ofrece la acción que lo resuelve (regla 2), nunca un cero inventado.
 */
function MonthFigures({ vehicle, canOperate }: { vehicle: Vehicle; canOperate: boolean }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const summary = useVehicleSummary(vehicle.id)
  const s = summary.data
  const logKm = canOperate && !vehicle.archived_at ? () => quick.run('mileage', vehicle.id) : undefined
  const figures: { label: string; value: string | null; missing: string; note?: string; action?: () => void; actionLabel?: string }[] = [
    ...(ctx.canExpenses ? [{ label: 'Gasto del mes', value: s ? formatMoney(s.totals.month) : null, missing: 'Sin datos todavía.' }] : []),
    {
      label: 'Km este mes',
      value: s && s.mileage.km_this_month !== null ? formatKm(s.mileage.km_this_month) : null,
      missing: 'Faltan lecturas de este mes.',
      action: logKm,
      actionLabel: 'Anotar km',
    },
    ...(ctx.canExpenses
      ? [
          {
            label: 'Coste por km',
            value: s?.cost_per_km.available && s.cost_per_km.value ? formatMoney(s.cost_per_km.value) : null,
            missing: s?.cost_per_km.reason ?? 'Faltan datos para calcularlo.',
            note: s ? `Del ${formatDate(s.period.from)} al ${formatDate(s.period.to)}` : undefined,
            action: logKm,
            actionLabel: 'Anotar km',
          },
        ]
      : []),
  ]
  return (
    <section aria-labelledby="month-title">
      <h2 id="month-title" className="font-display text-lg font-bold text-fg-warm">
        {vehicle.display_name} en cifras
      </h2>
      {summary.isError ? (
        <ErrorState compact error={summary.error} onRetry={() => void summary.refetch()} className="mt-3" />
      ) : (
        <dl className="list-panel mt-3 grid sm:grid-cols-3 sm:[&>*+*]:border-l sm:[&>*+*]:border-t-0 sm:[&>*+*]:border-line">
          {figures.map((f) => (
            <div key={f.label} className="flex min-h-24 flex-col justify-between gap-2 py-4">
              <dt className="tag-label text-fg-muted">{f.label}</dt>
              {summary.isPending ? (
                <dd><Skeleton className="ml-auto h-8 w-28" /></dd>
              ) : f.value !== null ? (
                <dd className="text-right">
                  <span className="tabular block whitespace-nowrap font-display text-[1.75rem] font-bold leading-8 text-fg-warm">{f.value}</span>
                  {f.note && <span className="mt-1 block text-xs text-fg-subtle">{f.note}</span>}
                </dd>
              ) : (
                <dd className="text-right text-sm text-fg-muted">
                  {f.missing}
                  {f.action && (
                    <>
                      {' '}
                      <button type="button" onClick={f.action} className="font-medium text-accent-ink underline-offset-4 hover:underline">
                        {f.actionLabel}
                      </button>
                    </>
                  )}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function SpendSection({ data }: { data: PersonalDashboardData }) {
  const ctx = useWorkspace()
  const multi = data.vehicles.length > 1
  return (
    <Section
      title="Gasto"
      description={multi ? 'De todos tus vehículos.' : undefined}
      action={
        ctx.can('manage') && (
          <Link to={`${ctx.base}/analitica`} className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
            Ver analítica
          </Link>
        )
      }
    >
      <div className="list-panel">
        <dl>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-fg-muted">Este mes</dt>
            <dd className="tabular text-right font-display text-xl font-bold text-fg-warm">{formatMoney(data.spend.month)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-line py-3">
            <dt className="text-sm text-fg-muted">Este año</dt>
            <dd className="tabular text-right font-display text-xl font-bold text-fg-warm">{formatMoney(data.spend.year)}</dd>
          </div>
        </dl>
      </div>
    </Section>
  )
}

function ActivityList({ items }: { items: Activity[] }) {
  const ctx = useWorkspace()
  if (!items.length) return <p className="rounded-card border border-line px-4 py-3 text-sm text-fg-muted">Aquí verás lo último que registres.</p>
  return (
    <ol className="list-panel">
      {items.slice(0, 3).map((a) => (
        <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
          {a.vehicle_id ? (
            <Link to={`${ctx.base}/vehiculos/${a.vehicle_id}/historial`} className="min-w-0 text-fg underline-offset-4 hover:underline">
              {a.summary}
            </Link>
          ) : (
            <span className="min-w-0 text-fg">{a.summary}</span>
          )}
          <time dateTime={a.created_at} title={formatDateTime(a.created_at)} className="shrink-0 text-xs text-fg-subtle">
            {formatRelativeTime(a.created_at, new Date(), { pastOnly: true })}
          </time>
        </li>
      ))}
    </ol>
  )
}

/** Primer uso: una sola acción (5.1). Sin pasos numerados ni manchas de luz. */
function Onboarding() {
  const ctx = useWorkspace()
  return (
    <EmptyState
      icon={<CarFront />}
      title="Añade tu primer vehículo"
      description="Con la marca, el modelo y los kilómetros empiezas a llevar su historial, sus gastos y sus vencimientos."
      action={
        ctx.can('operate') && (
          <ButtonLink to={`${ctx.base}/vehiculos/nuevo`} variant="primary" icon={<Plus aria-hidden />}>
            Añadir vehículo
          </ButtonLink>
        )
      }
    />
  )
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-10">
      <span className="sr-only">Cargando el inicio…</span>
      {[3, 2].map((rows, i) => (
        <div key={i} aria-hidden className="space-y-3">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: rows }, (_, j) => (
            <Skeleton key={j} className="h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

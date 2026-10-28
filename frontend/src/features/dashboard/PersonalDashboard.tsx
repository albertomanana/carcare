import { BellPlus, CarFront, ChevronDown, Gauge, Plus, Receipt, Wrench } from 'lucide-react'
import { Link } from 'react-router'
import { useDashboard } from '@/api/hooks/workspaces'
import type { Activity, PersonalDashboard as PersonalDashboardData, Vehicle } from '@/api/types'
import { Sparkbars } from '@/components/charts/Sparkbars'
import { Plate } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { buttonClasses } from '@/components/ui/variants'
import { VehicleFirstSteps } from '@/components/vehicles/FirstSteps'
import { ReminderItem, ReminderList } from '@/components/vehicles/ReminderItem'
import { VehicleThumb } from '@/components/vehicles/VehicleVisuals'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useReminderActions } from '@/features/vehicle/useReminderActions'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { dashboardFirstSteps } from '@/lib/firstSteps'
import { formatDateTime, formatKm, formatMoney, formatRelativeDate, formatRelativeTime } from '@/lib/format'
import { INTERVAL_DISCLAIMER } from '@/lib/reminders'
import { plural } from '@/lib/text'

/** Filas de "Pendiente" en Inicio (5.1: máximo 5). */
const PENDING_ROWS = 5

/**
 * Inicio del particular (5.1 del informe de UX): todo es de **todos** los vehículos, así que ninguna cifra
 * mezcla ámbitos (hallazgo C3). Una sola petición (`/dashboard`), sin 3D y sin tarjetas de cifras.
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

  return (
    <div className="space-y-10">
      {guide ? <VehicleFirstSteps vehicle={guide.vehicle} steps={guide.steps} showName /> : <Pending data={data} canOperate={canOperate} />}

      <VehiclesSection vehicles={data.vehicles} canOperate={canOperate} />

      {!guide && (
        <div className="grid gap-10 lg:grid-cols-2">
          {ctx.canExpenses && <SpendSection data={data} />}
          <Section title="Último registrado">
            <ActivityList items={data.recent_activity} />
          </Section>
        </div>
      )}
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
        <p className="border-y border-line py-3 text-sm text-fg-muted">
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
      <ul className="divide-y divide-line border-y border-line">
        {vehicles.map((v) => {
          const details = [v.nickname ? `${v.make} ${v.model}` : v.version, v.year].filter(Boolean).join(' · ')
          return (
            <li key={v.id} className="flex items-center gap-3 py-3">
              <VehicleThumb vehicle={v} className="hidden h-10 w-16 shrink-0 sm:block" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Link to={`${ctx.base}/vehiculos/${v.id}`} className="font-medium text-fg underline-offset-4 hover:underline">
                    {v.display_name}
                  </Link>
                  <Plate value={v.plate} className="text-sm" />
                </p>
                <p className="text-sm text-fg-muted tabular">
                  {details && <span className="max-sm:hidden">{details} · </span>}
                  {v.current_mileage !== null ? (
                    <>
                      {formatKm(v.current_mileage)}
                      {v.mileage_updated_at && <span className="text-fg-subtle"> · {formatRelativeDate(v.mileage_updated_at)}</span>}
                    </>
                  ) : (
                    'Sin kilometraje'
                  )}
                </p>
              </div>
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
      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <div>
          <dt className="text-sm text-fg-muted">Este mes</dt>
          <dd className="font-display text-2xl font-semibold text-fg-warm tabular">{formatMoney(data.spend.month)}</dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">Este año</dt>
          <dd className="font-display text-2xl font-semibold text-fg-warm tabular">{formatMoney(data.spend.year)}</dd>
        </div>
      </dl>
      <Sparkbars data={data.spend.by_month} label="Gasto de los últimos 12 meses" className="mt-4 max-w-sm" />
      <p className="mt-1 text-xs text-fg-subtle">Últimos 12 meses</p>
    </Section>
  )
}

function ActivityList({ items }: { items: Activity[] }) {
  const ctx = useWorkspace()
  if (!items.length) return <p className="border-y border-line py-3 text-sm text-fg-muted">Aquí verás lo último que registres.</p>
  return (
    <ol className="divide-y divide-line border-y border-line">
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

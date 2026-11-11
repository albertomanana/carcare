import { BellPlus, CarFront, ChevronDown, CircleCheck, Clock, Gauge, OctagonAlert, Plus, Receipt, Target, Wallet, Wrench, History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useVehicleSummary } from '@/api/hooks/vehicles'
import { useDashboard } from '@/api/hooks/workspaces'
import type { Activity, PersonalDashboard as PersonalDashboardData, Vehicle } from '@/api/types'
import { CanvasBleed } from '@/components/layout/CanvasBleed'
import { EmptyBoard, GamePanel, HudHeader, PaintToken, PanelLink, StatRow, StatTile } from '@/components/game/kit'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Chip, Mission } from '@/components/ui/Hud'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { buttonClasses } from '@/components/ui/variants'
import { HomeFirstSteps } from '@/components/vehicles/FirstSteps'
import { ReminderItem, ReminderList } from '@/components/vehicles/ReminderItem'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useReminderActions } from '@/features/vehicle/useReminderActions'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useHiddenGuide } from '@/hooks/useHiddenGuide'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { dashboardFirstSteps } from '@/lib/firstSteps'
import { formatDate, formatDateTime, formatKm, formatMoney, formatPlate, formatRelativeDate, formatRelativeTime } from '@/lib/format'
import { mileageMissions } from '@/lib/missions'
import { INTERVAL_DISCLAIMER } from '@/lib/reminders'
import { plural } from '@/lib/text'
import { CarThumbnail, GarageScene, useWebGLAvailable } from '@/three'

/** Misiones de recordatorio que caben en Inicio. */
const REMINDER_MISSIONS = 4

/**
 * Inicio del particular (mundo «Diorama»): el garaje en 3D a sangre detrás de todo y, flotando encima, la cabecera con el
 * estado, la ficha del vehículo elegido, las misiones (recordatorios vencidos o próximos y kilometraje por actualizar,
 * todo con datos de la API), las cifras del mes y la lista de vehículos. Sin WebGL, la lista de vehículos (con su
 * miniatura y un selector) hace de alternativa 2D del lienzo.
 */
export default function PersonalHome() {
  const ctx = useWorkspace()
  useDocumentTitle('Inicio')
  const dashboard = useDashboard(ctx.id)
  const data = dashboard.data?.type === 'personal' ? dashboard.data : null
  const canOperate = ctx.can('operate')
  const { hidden, hide } = useHiddenGuide(String(ctx.id))
  const guide = canOperate && data && !hidden ? dashboardFirstSteps(data) : null

  if (dashboard.isPending) return <HomeSkeleton />
  if (dashboard.isError)
    return (
      <>
        <HudHeader title="Inicio" />
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </>
    )
  if (!data || data.vehicles.length === 0) {
    return (
      <>
        <HudHeader title="Inicio" description="Tu garaje está vacío: empieza por tu coche." />
        {canOperate ? (
          <HomeFirstSteps vehicle={null} steps={dashboardFirstSteps(data)?.steps ?? []} className="max-w-2xl" />
        ) : (
          <EmptyBoard icon={<CarFront />} title="Aún no hay vehículos" description="Quien administra este espacio puede añadir el primero. Con la marca, el modelo y los kilómetros empieza el historial." />
        )}
      </>
    )
  }
  return <Home data={data} guide={guide} onHideGuide={hide} />
}

function statusLine(d: PersonalDashboardData): string {
  const { overdue, soon } = d.reminders
  if (!overdue && !soon) return 'Nada vencido ni próximo.'
  if (!overdue) return `${plural(soon, 'aviso próximo', 'avisos próximos')}.`
  return `${[plural(overdue, 'aviso vencido', 'avisos vencidos'), soon ? plural(soon, 'próximo', 'próximos') : null].filter(Boolean).join(' y ')}.`
}

/** «Registrar»: la acción primaria de Inicio. En el móvil ya la da la barra inferior. */
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
          <span className="min-w-0">
            <span className="block">Intervención</span>
            <span className="block text-xs text-fg-muted">Revisión, reparación, ITV…</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem icon={<BellPlus aria-hidden />} onSelect={() => quick.run('reminder', only)}>
          Recordatorio
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Home({ data, guide, onHideGuide }: { data: PersonalDashboardData; guide: ReturnType<typeof dashboardFirstSteps>; onHideGuide: () => void }) {
  const ctx = useWorkspace()
  const canOperate = ctx.can('operate')
  const wide = useMediaQuery('(min-width: 1024px)')
  const webgl = useWebGLAvailable()
  const active = data.vehicles.filter((v) => !v.archived_at)
  const [focusId, setFocusId] = useState<Vehicle['id'] | null>(null)
  const vehicle = active.find((v) => v.id === focusId) ?? active[0]

  const scene = webgl ? (
    // El «cargando» de la escena no pinta una caja gris a pantalla completa: el lienzo es el de la página
    <div className="size-full [&_[aria-busy=true]]:!bg-transparent">
      <GarageScene
        className="h-full w-full"
        vehicles={active.map((v) => ({ id: v.id, name: v.display_name, plate: v.plate, color: v.color_hex, body: v.body_type }))}
        selectedId={vehicle ? focusId : null}
        onSelect={setFocusId}
        focusInset={wide ? { top: 80, right: 420, bottom: 200 } : { top: 260, bottom: Math.round(window.innerHeight * 0.45) }}
      />
    </div>
  ) : null

  return (
    <CanvasBleed scene={scene} hudClassName="flex flex-col gap-4 xl:mx-auto xl:max-w-[88rem]">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className={cn('flex min-w-0 flex-col gap-4', webgl && 'lg:min-h-[calc(100dvh-8.5rem)]')}>
          <HudHeader
            className="mb-0"
            title="Inicio"
            description={statusLine(data)}
            actions={canOperate && !guide ? <RegisterMenu vehicles={data.vehicles} /> : undefined}
            chips={
              <>
                {data.reminders.overdue > 0 && (
                  <Chip tone="danger" icon={<OctagonAlert aria-hidden />}>
                    {plural(data.reminders.overdue, 'vencido', 'vencidos')}
                  </Chip>
                )}
                {data.reminders.soon > 0 && (
                  <Chip tone="warning" icon={<Clock aria-hidden />}>
                    {plural(data.reminders.soon, 'próximo', 'próximos')}
                  </Chip>
                )}
                <Chip icon={<CarFront aria-hidden />}>{plural(active.length, 'vehículo', 'vehículos')}</Chip>
              </>
            }
          />
          {/* hueco por el que se ve el garaje (el puntero atraviesa a la escena) */}
          <div aria-hidden className={webgl ? 'h-[30dvh] min-h-40 lg:h-auto lg:flex-1' : 'hidden'} />
          {vehicle && <VehicleSpot vehicle={vehicle} vehicles={active} onPick={setFocusId} webgl={webgl} canOperate={canOperate} />}
        </div>
        <div className="min-w-0">
          {guide ? <HomeFirstSteps vehicle={guide.vehicle} steps={guide.steps} onHide={onHideGuide} className="hud-panel p-4 sm:p-5" /> : <Missions data={data} canOperate={canOperate} />}
        </div>
      </div>

      {vehicle && <MonthFigures vehicle={vehicle} canOperate={canOperate} />}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <VehiclesPanel vehicles={data.vehicles} canOperate={canOperate} focusId={vehicle?.id ?? null} onFocus={setFocusId} />
        {!guide && (
          <div className="flex min-w-0 flex-col gap-4">
            {ctx.canExpenses && <SpendPanel data={data} />}
            <GamePanel title="Último registrado" icon={<History />} flush>
              <ActivityList items={data.recent_activity} />
            </GamePanel>
          </div>
        )}
      </div>
    </CanvasBleed>
  )
}

/** Ficha del vehículo elegido: su pintura, el kilometraje, el selector de vehículo y las dos acciones. */
function VehicleSpot({ vehicle, vehicles, onPick, webgl, canOperate }: { vehicle: Vehicle; vehicles: Vehicle[]; onPick: (id: Vehicle['id']) => void; webgl: boolean; canOperate: boolean }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const sub = [vehicle.nickname ? `${vehicle.make} ${vehicle.model}` : vehicle.version, vehicle.year].filter(Boolean).join(' · ')
  return (
    <section aria-label="Vehículo elegido" className="hud-panel p-3 sm:p-4">
      {!webgl && (
        <div className="mb-3 overflow-hidden rounded-xl bg-surface-2">
          <CarThumbnail appearance={{ bodyType: vehicle.body_type, colorHex: vehicle.color_hex }} alt={`Ilustración de ${vehicle.display_name}`} className="mx-auto h-36 w-full object-contain p-2" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <PaintToken color={vehicle.color_hex} size="lg">
          <CarFront />
        </PaintToken>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-fg-warm">{vehicle.display_name}</p>
          <p className="truncate text-sm text-fg-muted">
            {vehicle.plate ? <span className="tag-label text-fg-muted">{formatPlate(vehicle.plate)}</span> : 'Sin matrícula'}
            {sub && <span> · {sub}</span>}
          </p>
          <p className="tabular text-sm font-bold text-fg">
            {formatKm(vehicle.current_mileage, { empty: 'Sin km anotados' })}
            {vehicle.mileage_updated_at && <span className="font-normal text-fg-subtle"> · {formatRelativeDate(vehicle.mileage_updated_at)}</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ButtonLink to={`${ctx.base}/vehiculos/${vehicle.id}`} size="sm">
          Abrir ficha
        </ButtonLink>
        {canOperate && (
          <Button variant="ghost" size="sm" icon={<Gauge aria-hidden />} onClick={() => quick.run('mileage', vehicle.id)}>
            Anotar km
          </Button>
        )}
      </div>
      {vehicles.length > 1 && (
        <div role="group" aria-label="Elegir vehículo" className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {vehicles.map((v) => (
            <button key={v.id} type="button" className="chip" aria-pressed={v.id === vehicle.id} onClick={() => onPick(v.id)}>
              {v.display_name}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/** Misiones: lo vencido o próximo (recordatorios reales) y los kilómetros que conviene actualizar. */
function Missions({ data, canOperate }: { data: PersonalDashboardData; canOperate: boolean }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const reminderActions = useReminderActions({ canOperate })
  const attention = data.reminders.upcoming.filter((r) => r.state === 'overdue' || r.state === 'soon')
  const shown = attention.slice(0, REMINDER_MISSIONS)
  const total = data.reminders.overdue + data.reminders.soon
  const km = canOperate ? mileageMissions(data.vehicles).slice(0, 3) : []
  const multi = data.vehicles.length > 1
  return (
    <GamePanel
      id="misiones"
      title="Misiones"
      icon={<Target />}
      description={`${INTERVAL_DISCLAIMER}.`}
      action={<PanelLink to={`${ctx.base}/agenda`}>{total > shown.length ? `Ver los ${total}` : 'Agenda'}</PanelLink>}
    >
      {shown.length > 0 && (
        <ReminderList variant="missions" aria-label="Avisos vencidos y próximos">
          {shown.map((r) => (
            <ReminderItem key={r.id} variant="mission" reminder={r} compact actions={reminderActions.actions} vehicleLink={multi ? `${ctx.base}/vehiculos/${r.vehicle_id}/recordatorios` : undefined} />
          ))}
        </ReminderList>
      )}
      {km.length > 0 && (
        <ul className={shown.length ? 'mt-2.5 grid gap-2.5' : 'grid gap-2.5'} aria-label="Kilometraje por actualizar">
          {km.map((m) => (
            <li key={m.vehicle.id}>
              <Mission
                as="button"
                type="button"
                onClick={() => quick.run('mileage', m.vehicle.id)}
                className="w-full text-left"
                tone="info"
                icon={<Gauge aria-hidden />}
                title={`Anota los km de ${m.vehicle.display_name}`}
                description={m.kind === 'none' ? 'Todavía no tiene ninguna lectura.' : `Última lectura ${formatRelativeDate(m.vehicle.mileage_updated_at)} (${formatKm(m.vehicle.current_mileage)}).`}
                trailing="Anotar"
              />
            </li>
          ))}
        </ul>
      )}
      {shown.length === 0 && km.length === 0 && (
        <Mission
          tone="ok"
          icon={<CircleCheck aria-hidden />}
          title="Todo al día"
          description="Nada vencido ni próximo."
          trailing={
            canOperate && (
              <button type="button" onClick={() => quick.run('reminder')} className="text-sm font-bold text-accent-ink underline-offset-4 hover:underline">
                Crear recordatorio
              </button>
            )
          }
        />
      )}
      {reminderActions.dialogs}
    </GamePanel>
  )
}

/** Gasto, km y coste por km del mes del vehículo elegido. Si falta un dato se dice cuál y qué hacer (regla 2). */
function MonthFigures({ vehicle, canOperate }: { vehicle: Vehicle; canOperate: boolean }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const summary = useVehicleSummary(vehicle.id)
  const s = summary.data
  const logKm =
    canOperate && !vehicle.archived_at ? (
      <button type="button" onClick={() => quick.run('mileage', vehicle.id)} className="font-bold text-accent-ink underline-offset-4 hover:underline">
        Anotar km
      </button>
    ) : undefined
  if (summary.isError) return <ErrorState compact error={summary.error} onRetry={() => void summary.refetch()} />
  const loading = summary.isPending
  return (
    <section aria-label={`${vehicle.display_name} en cifras`}>
      <StatRow>
        {ctx.canExpenses && <StatTile label="Gasto del mes" loading={loading} value={s ? formatMoney(s.totals.month) : null} missing="Sin datos todavía." note={vehicle.display_name} />}
        <StatTile
          label="Km este mes"
          loading={loading}
          value={s && s.mileage.km_this_month !== null ? formatKm(s.mileage.km_this_month) : null}
          missing="Faltan lecturas de este mes."
          action={logKm}
          note={vehicle.display_name}
        />
        {ctx.canExpenses && (
          <StatTile
            label="Coste por km"
            loading={loading}
            value={s?.cost_per_km.available && s.cost_per_km.value ? formatMoney(s.cost_per_km.value) : null}
            missing={s?.cost_per_km.reason ?? 'Faltan datos para calcularlo.'}
            action={logKm}
            note={s ? `Del ${formatDate(s.period.from)} al ${formatDate(s.period.to)}` : undefined}
          />
        )}
      </StatRow>
    </section>
  )
}

function VehiclesPanel({ vehicles, canOperate, focusId, onFocus }: { vehicles: Vehicle[]; canOperate: boolean; focusId: Vehicle['id'] | null; onFocus: (id: Vehicle['id']) => void }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  return (
    <GamePanel id="vehiculos" title="Vehículos" icon={<CarFront />} flush action={canOperate && <PanelLink to={`${ctx.base}/vehiculos/nuevo`}>Añadir vehículo</PanelLink>}>
      <ul>
        {vehicles.map((v) => {
          const details = [v.nickname ? `${v.make} ${v.model}` : v.version, v.year].filter(Boolean).join(' · ')
          const { overdue_reminders: overdue, soon_reminders: soon } = v.stats
          return (
            <li key={v.id} className="@container flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:px-5">
              <PaintToken color={v.color_hex} size="md" className={v.id === focusId ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : undefined}>
                <CarFront />
              </PaintToken>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Link to={`${ctx.base}/vehiculos/${v.id}`} className="font-bold text-fg underline-offset-4 hover:underline">
                    {v.display_name}
                  </Link>
                  {v.plate && <span className="tag-label text-fg-muted">{formatPlate(v.plate)}</span>}
                </p>
                {details && <p className="truncate text-sm text-fg-muted">{details}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  {overdue > 0 && (
                    <Chip tone="danger" icon={<OctagonAlert aria-hidden />}>
                      {plural(overdue, 'vencido', 'vencidos')}
                    </Chip>
                  )}
                  {soon > 0 && (
                    <Chip tone="warning" icon={<Clock aria-hidden />}>
                      {plural(soon, 'próximo', 'próximos')}
                    </Chip>
                  )}
                  <span className="tabular text-sm text-fg-muted">
                    {v.current_mileage !== null ? formatKm(v.current_mileage) : 'Sin km'}
                    {v.mileage_updated_at && ` · ${formatRelativeDate(v.mileage_updated_at)}`}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
                {vehicles.length > 1 && !v.archived_at && (
                  <Button variant="ghost" size="sm" aria-pressed={v.id === focusId} onClick={() => onFocus(v.id)} aria-label={`Ver ${v.display_name} en el garaje y en las cifras`}>
                    Ver
                  </Button>
                )}
                {canOperate && !v.archived_at && (
                  <Button variant="secondary" size="sm" onClick={() => quick.run('mileage', v.id)} aria-label={`Anotar km de ${v.display_name}`}>
                    Anotar km
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </GamePanel>
  )
}

function SpendPanel({ data }: { data: PersonalDashboardData }) {
  const ctx = useWorkspace()
  const multi = data.vehicles.length > 1
  return (
    <GamePanel title="Gasto" icon={<Wallet />} description={multi ? 'De todos tus vehículos.' : undefined} action={ctx.can('manage') && <PanelLink to={`${ctx.base}/analitica`}>Analítica</PanelLink>} flush>
      <dl>
        <div className="flex items-baseline justify-between gap-4 px-5 py-3">
          <dt className="text-sm text-fg-muted">Este mes</dt>
          <dd className="tabular text-right font-display text-xl font-extrabold text-fg-warm">{formatMoney(data.spend.month)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-line px-5 py-3">
          <dt className="text-sm text-fg-muted">Este año</dt>
          <dd className="tabular text-right font-display text-xl font-extrabold text-fg-warm">{formatMoney(data.spend.year)}</dd>
        </div>
      </dl>
    </GamePanel>
  )
}

function ActivityList({ items }: { items: Activity[] }) {
  const ctx = useWorkspace()
  if (!items.length) return <p className="px-5 pb-4 text-sm text-fg-muted">Aquí verás lo último que registres.</p>
  return (
    <ol>
      {items.slice(0, 3).map((a) => (
        <li key={a.id} className="flex items-baseline justify-between gap-3 border-t border-line px-5 py-2.5 text-sm first:border-t-0">
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

function HomeSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Cargando el inicio…</span>
      <div aria-hidden className="hud-panel space-y-3 p-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div aria-hidden className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="h-56 w-full rounded-card" />
        <Skeleton className="h-56 w-full rounded-card" />
      </div>
      <Skeleton aria-hidden className="h-28 w-full rounded-card" />
    </div>
  )
}

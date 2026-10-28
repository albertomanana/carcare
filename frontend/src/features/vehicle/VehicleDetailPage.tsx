import { Archive, ArchiveRestore, ArrowLeft, BellPlus, ChevronDown, ClipboardPlus, EllipsisVertical, FileText, Gauge, OctagonAlert, Pencil, Plus, Printer, Receipt, Trash2, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import type { Vehicle } from '@/api/types'
import { useArchiveVehicle, useDeleteVehicle, useVehicle } from '@/api/hooks/vehicles'
import { Plate } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { buttonClasses } from '@/components/ui/variants'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { formatDate, formatKm, formatRelativeDate } from '@/lib/format'
import { FUEL_LABEL, TRANSMISSION_LABEL } from '@/lib/labels'
import { plural } from '@/lib/text'
import { WORK_ORDER_STATUS } from '@/lib/status'
import type { VehicleOutletContext } from './vehicle-outlet'

interface Tab {
  to: string
  label: string
  end?: boolean
}

/**
 * Ficha del vehículo: cabecera corta + 5 pestañas (6 en el taller), 5.2 del informe de UX.
 * Diario y Documentos se juntaron con Historial y Datos (sus rutas antiguas redirigen).
 */
export default function VehicleDetailPage() {
  const ctx = useWorkspace()
  const { vehicleId } = useParams()
  const id = Number(vehicleId)
  const query = useVehicle(Number.isFinite(id) ? id : undefined)
  const vehicle = query.data
  useDocumentTitle(vehicle?.display_name ?? 'Vehículo')

  if (query.isPending) return <HeaderSkeleton />
  if (query.isError || !vehicle)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} className="mt-6" />

  // Un vehículo de otro espacio llega aquí solo si se cambia la URL: lo tratamos como no encontrado
  if (vehicle.workspace_id !== ctx.id) return <ErrorState title="Este vehículo no pertenece a este espacio" className="mt-6" />

  const base = `${ctx.base}/vehiculos/${vehicle.id}`
  const tabs: Tab[] = [
    { to: base, label: 'Resumen', end: true },
    { to: `${base}/historial`, label: 'Historial' },
    ...(ctx.canExpenses ? [{ to: `${base}/gastos`, label: 'Gastos' }] : []),
    { to: `${base}/recordatorios`, label: 'Recordatorios' },
    ...(ctx.isWorkshop ? [{ to: `${base}/ordenes`, label: 'Órdenes' }] : []),
    { to: `${base}/datos`, label: 'Datos' },
  ]
  const outlet: VehicleOutletContext = { vehicle }

  return (
    <>
      <Header vehicle={vehicle} />
      <VehicleTabs tabs={tabs} />
      <Outlet context={outlet} />
    </>
  )
}

/** En el móvil caben 5 pestañas cortas; si hay más (taller), las últimas pasan a "Más ▾" en lugar de esconderse. */
const MOBILE_TABS = 5

function VehicleTabs({ tabs }: { tabs: Tab[] }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = (t: Tab) => (t.end ? location.pathname.replace(/\/$/, '') === t.to : location.pathname.startsWith(t.to))
  const overflow = tabs.length > MOBILE_TABS ? tabs.slice(MOBILE_TABS - 1) : []
  const activeOverflow = overflow.find(isActive)
  const linkClass = (active: boolean) =>
    cn(
      'inline-flex min-h-12 items-center whitespace-nowrap border-b-2 px-2 text-sm font-medium transition-colors sm:px-3',
      active ? 'border-fg text-fg' : 'border-transparent text-fg-muted hover:text-fg',
    )

  return (
    <nav aria-label="Secciones del vehículo" className="no-print sticky top-16 z-10 mb-6 border-b border-line bg-canvas">
      <ul className="-mb-px flex justify-between sm:justify-start sm:gap-1">
        {tabs.map((t, i) => (
          <li key={t.to} className={cn('shrink-0', overflow.length > 0 && i >= MOBILE_TABS - 1 && 'max-sm:hidden')}>
            <NavLink to={t.to} end={t.end} className={({ isActive: active }) => linkClass(active)}>
              {t.label}
            </NavLink>
          </li>
        ))}
        {overflow.length > 0 && (
          <li className="shrink-0 sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(linkClass(!!activeOverflow), 'gap-1')} aria-label={activeOverflow ? `${activeOverflow.label} (más secciones)` : 'Más secciones'}>
                {activeOverflow?.label ?? 'Más'}
                <ChevronDown aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map((t) => (
                  <DropdownMenuItem key={t.to} onSelect={() => navigate(t.to)} aria-current={isActive(t) ? 'page' : undefined}>
                    {t.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
      </ul>
    </nav>
  )
}

/**
 * Cabecera de la ficha (5.2): nombre · matrícula, modelo, kilometraje con "Anotar km" y, si hay, el aviso vencido
 * como texto. Sin miniatura (no descarga three.js) y sin píldoras. "Registrar ▾" es la acción primaria en escritorio;
 * en el móvil la da la barra inferior, que ya sabe en qué vehículo estás (R1 y R14). "Informe" va en el menú "⋯".
 */
function Header({ vehicle }: { vehicle: Vehicle }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const navigate = useNavigate()
  const archive = useArchiveVehicle()
  const remove = useDeleteVehicle()
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const base = `${ctx.base}/vehiculos/${vehicle.id}`
  const canOperate = ctx.can('operate')
  const canManage = ctx.can('manage')
  const archived = !!vehicle.archived_at
  const details = [
    vehicle.nickname ? `${vehicle.make} ${vehicle.model}` : null,
    vehicle.version,
    vehicle.year,
    vehicle.fuel_type ? FUEL_LABEL[vehicle.fuel_type] : null,
    vehicle.transmission ? TRANSMISSION_LABEL[vehicle.transmission] : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const order = vehicle.stats.open_work_order
  const overdue = vehicle.stats.overdue_reminders

  const doArchive = (restore: boolean) =>
    archive.mutate(
      { id: vehicle.id, restore },
      {
        onSuccess: () => {
          toast.success(restore ? 'Vehículo restaurado' : 'Vehículo archivado: conserva todo su historial')
          setConfirm(null)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  const doDelete = () =>
    remove.mutate(vehicle.id, {
      onSuccess: () => {
        toast.success(`${vehicle.display_name} eliminado`)
        navigate(`${ctx.base}/garaje?ver=archivados`, { replace: true })
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  return (
    <header className="mb-4">
      <Link to={`${ctx.base}/garaje`} className="no-print mb-1 inline-flex min-h-11 items-center gap-1 text-sm text-fg-muted hover:text-fg md:mb-2 md:min-h-0">
        <ArrowLeft aria-hidden className="size-4" />
        {ctx.isWorkshop ? 'Vehículos' : 'Garaje'}
      </Link>

      {archived && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 border-y border-line py-3 text-sm">
          <Archive aria-hidden className="size-4 text-fg-muted" />
          <span className="flex-1 text-fg">Vehículo archivado el {formatDate(vehicle.archived_at)}. No aparece en el panel, pero conserva su historial.</span>
          {canManage && (
            <Button size="sm" icon={<ArchiveRestore aria-hidden />} loading={archive.isPending} onClick={() => doArchive(true)}>
              Restaurar
            </Button>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg-warm text-balance md:text-3xl">
            {vehicle.display_name}
            {vehicle.plate && <Plate value={vehicle.plate} className="ml-3 align-middle font-sans text-base font-normal md:text-lg" />}
          </h1>
          {details && <p className="mt-1 text-sm text-fg-muted">{details}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium text-fg tabular">{formatKm(vehicle.current_mileage, { empty: 'Sin kilometraje' })}</span>
            {vehicle.mileage_updated_at && <span className="text-fg-subtle">· leído {formatRelativeDate(vehicle.mileage_updated_at)}</span>}
            {canOperate && !archived && (
              <>
                <span aria-hidden className="text-fg-subtle">
                  ·
                </span>
                <button type="button" onClick={() => quick.run('mileage', vehicle.id)} className="font-medium text-accent-ink underline-offset-4 hover:underline">
                  Anotar km
                </button>
              </>
            )}
          </p>
          {(ctx.isWorkshop || order || overdue > 0) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
              {ctx.isWorkshop &&
                (vehicle.customer ? (
                  <Link to={`${ctx.base}/clientes/${vehicle.customer.id}`} className="underline-offset-4 hover:text-fg hover:underline">
                    {vehicle.customer.name}
                  </Link>
                ) : (
                  <span>Sin cliente</span>
                ))}
              {order && (
                <Link to={`${ctx.base}/ordenes/${order.id}`} className="underline-offset-4 hover:text-fg hover:underline">
                  {order.number} · {WORK_ORDER_STATUS[order.status].label}
                  {order.bay ? ` · Elevador ${order.bay}` : ''}
                </Link>
              )}
              {overdue > 0 && (
                <Link to={`${base}/recordatorios`} className="inline-flex items-center gap-1 text-danger underline-offset-4 hover:underline">
                  <OctagonAlert aria-hidden className="size-4" />
                  {plural(overdue, 'aviso vencido', 'avisos vencidos')}
                </Link>
              )}
            </p>
          )}
        </div>

        <div className="no-print flex shrink-0 items-center gap-2">
          {canOperate && !archived && (
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonClasses({ variant: 'primary', className: 'max-md:hidden' })}>
                <Plus aria-hidden />
                Registrar
                <ChevronDown aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem icon={<Gauge aria-hidden />} onSelect={() => quick.run('mileage', vehicle.id)}>
                  Kilometraje
                </DropdownMenuItem>
                {ctx.canExpenses && (
                  <DropdownMenuItem icon={<Receipt aria-hidden />} onSelect={() => quick.run('expense', vehicle.id)}>
                    Gasto o repostaje
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem icon={<Wrench aria-hidden />} onSelect={() => navigate(`${base}/intervenciones/nueva`)}>
                  Intervención
                </DropdownMenuItem>
                <DropdownMenuItem icon={<BellPlus aria-hidden />} onSelect={() => quick.run('reminder', vehicle.id)}>
                  Recordatorio
                </DropdownMenuItem>
                <DropdownMenuItem icon={<FileText aria-hidden />} onSelect={() => navigate(`${base}/datos?subir=1#documentos`)}>
                  Documento
                </DropdownMenuItem>
                {ctx.isWorkshop && !order && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem icon={<ClipboardPlus aria-hidden />} onSelect={() => navigate(`${ctx.base}/ordenes/nueva?vehiculo=${vehicle.id}`)}>
                      Orden de trabajo
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-11 place-items-center rounded-control border border-line bg-surface-2 text-fg-muted hover:text-fg md:size-10" aria-label="Más acciones del vehículo">
              <EllipsisVertical aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canOperate && (
                <DropdownMenuItem icon={<Pencil aria-hidden />} onSelect={() => navigate(`${base}/editar`)}>
                  Editar datos
                </DropdownMenuItem>
              )}
              <DropdownMenuItem icon={<Printer aria-hidden />} onSelect={() => navigate(`${base}/informe`)}>
                Informe imprimible
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  {archived ? (
                    <>
                      <DropdownMenuItem icon={<ArchiveRestore aria-hidden />} onSelect={() => doArchive(true)}>
                        Restaurar
                      </DropdownMenuItem>
                      <DropdownMenuItem danger icon={<Trash2 aria-hidden />} onSelect={() => setConfirm('delete')}>
                        Eliminar definitivamente
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem icon={<Archive aria-hidden />} onSelect={() => setConfirm('archive')}>
                      Archivar
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Archivar ${vehicle.display_name}?`}
        description="Dejará de aparecer en el panel y en los selectores, pero conservará todo su historial. Podrás restaurarlo cuando quieras."
        confirmLabel="Archivar"
        tone="primary"
        loading={archive.isPending}
        onConfirm={() => doArchive(false)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Eliminar ${vehicle.display_name} para siempre?`}
        description="Se borrarán su historial, gastos, lecturas, recordatorios y documentos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar definitivamente"
        loading={remove.isPending}
        onConfirm={doDelete}
      />
    </header>
  )
}

function HeaderSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mb-6">
      <span className="sr-only">Cargando vehículo…</span>
      <div aria-hidden className="mt-8 space-y-3">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="mt-6 h-12 w-full" />
    </div>
  )
}

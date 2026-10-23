import {
  Archive,
  ArchiveRestore,
  BellPlus,
  ChevronDown,
  ClipboardPlus,
  EllipsisVertical,
  FileText,
  Gauge,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Trash2,
  UserRound,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import type { Vehicle } from '@/api/types'
import { useArchiveVehicle, useDeleteVehicle, useVehicle } from '@/api/hooks/vehicles'
import { Badge, Plate, StatusPill } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { buttonClasses } from '@/components/ui/variants'
import { VehicleThumb } from '@/components/vehicles/VehicleVisuals'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { formatDate, formatKm, formatRelativeDate } from '@/lib/format'
import { FUEL_LABEL, TRANSMISSION_LABEL } from '@/lib/labels'
import { WORK_ORDER_STATUS } from '@/lib/status'
import type { VehicleOutletContext } from './vehicle-outlet'

/** Ficha del vehículo: cabecera + pestañas (rutas anidadas). */
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
  const tabs = [
    { to: base, label: 'Resumen', end: true },
    { to: `${base}/diario`, label: 'Diario' },
    { to: `${base}/historial`, label: 'Historial' },
    ...(ctx.canExpenses ? [{ to: `${base}/gastos`, label: 'Gastos' }] : []),
    { to: `${base}/recordatorios`, label: 'Recordatorios' },
    { to: `${base}/documentos`, label: 'Documentos' },
    ...(ctx.isWorkshop ? [{ to: `${base}/ordenes`, label: 'Órdenes' }] : []),
    { to: `${base}/datos`, label: 'Datos' },
  ]
  const outlet: VehicleOutletContext = { vehicle }

  return (
    <>
      <Header vehicle={vehicle} />
      <nav aria-label="Secciones del vehículo" className="no-print sticky top-16 z-10 -mx-4 mb-6 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <ul className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <li key={t.to} className="shrink-0">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-12 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                    isActive ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                  )
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet context={outlet} />
    </>
  )
}

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
  const details = [vehicle.version, vehicle.year, vehicle.fuel_type ? FUEL_LABEL[vehicle.fuel_type] : null, vehicle.transmission ? TRANSMISSION_LABEL[vehicle.transmission] : null]
    .filter(Boolean)
    .join(' · ')
  const order = vehicle.stats.open_work_order

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
    <header className="mb-4 md:mb-6">
      <Link to={`${ctx.base}/garaje`} className="no-print mb-3 inline-flex min-h-11 items-center text-sm text-fg-muted hover:text-fg md:min-h-0">
        ← {ctx.isWorkshop ? 'Vehículos' : 'Garaje'}
      </Link>

      {archived && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface-2 px-4 py-3 text-sm">
          <Archive aria-hidden className="size-4 text-fg-muted" />
          <span className="flex-1 text-fg">Vehículo archivado el {formatDate(vehicle.archived_at)}. No aparece en el panel, pero conserva su historial.</span>
          {canManage && (
            <Button size="sm" icon={<ArchiveRestore aria-hidden />} loading={archive.isPending} onClick={() => doArchive(true)}>
              Restaurar
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-hero border border-line bg-gradient-to-b from-surface-2 to-surface md:h-28 md:w-48">
          <VehicleThumb vehicle={vehicle} className="absolute inset-0 h-full w-full min-h-0 rounded-none border-0 bg-transparent p-2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-fg-warm md:text-3xl">{vehicle.display_name}</h1>
            <Plate value={vehicle.plate} />
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {vehicle.nickname ? `${vehicle.make} ${vehicle.model}` : null}
            {vehicle.nickname && details ? ' · ' : null}
            {details}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Gauge aria-hidden className="size-4 text-fg-subtle" />
              <span className="font-medium text-fg tabular">{formatKm(vehicle.current_mileage, { empty: 'Sin kilometraje' })}</span>
              {vehicle.mileage_updated_at && <span className="text-fg-subtle">· {formatRelativeDate(vehicle.mileage_updated_at)}</span>}
            </span>
            {ctx.isWorkshop && (
              <span className="inline-flex items-center gap-1.5 text-fg-muted">
                <UserRound aria-hidden className="size-4 text-fg-subtle" />
                {vehicle.customer ? (
                  <Link to={`${ctx.base}/clientes/${vehicle.customer.id}`} className="hover:text-fg hover:underline">
                    {vehicle.customer.name}
                  </Link>
                ) : (
                  'Sin cliente'
                )}
              </span>
            )}
            {order && (
              <Link to={`${ctx.base}/ordenes/${order.id}`} className="rounded-full">
                <StatusPill status={WORK_ORDER_STATUS[order.status]} label={`${order.number} · ${WORK_ORDER_STATUS[order.status].label}${order.bay ? ` · Elevador ${order.bay}` : ''}`} />
              </Link>
            )}
            {vehicle.stats.overdue_reminders > 0 && <Badge tone="danger">{vehicle.stats.overdue_reminders} recordatorio(s) vencido(s)</Badge>}
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          {canOperate && !archived && (
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonClasses({ variant: 'primary' })}>
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
                <DropdownMenuItem icon={<FileText aria-hidden />} onSelect={() => navigate(`${base}/documentos?subir=1`)}>
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
          <ButtonLink to={`${base}/informe`} icon={<Printer aria-hidden />} className="max-sm:hidden">
            Informe
          </ButtonLink>
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-11 place-items-center rounded-control border border-line bg-surface-2 text-fg-muted hover:text-fg md:size-10" aria-label="Más acciones del vehículo">
              <EllipsisVertical aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
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
      <div aria-hidden className="mt-10 flex flex-col gap-5 md:flex-row md:items-center">
        <Skeleton className="h-36 w-full rounded-hero md:h-28 md:w-48" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="mt-8 h-12 w-full" />
    </div>
  )
}

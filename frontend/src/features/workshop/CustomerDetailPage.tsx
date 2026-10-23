import { Car, ClipboardList, ClipboardPlus, EllipsisVertical, Mail, Pencil, Phone, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useCustomer, useCustomerVehicles, useDeleteCustomer, useWorkOrdersInfinite } from '@/api/hooks/workshop'
import type { Customer, Vehicle } from '@/api/types'
import { Avatar } from '@/components/ui/Avatar'
import { Plate, StatusPill } from '@/components/ui/Badge'
import { ButtonLink, Button } from '@/components/ui/Button'
import { Card, DataList } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { LoadMore } from '@/components/ui/LoadMore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { iconButtonClasses } from '@/components/ui/variants'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatKm } from '@/lib/format'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { plural } from '@/lib/text'
import { CarThumbnail } from '@/three'
import { CustomerDialog } from './components/CustomerDialog'
import { mailHref } from './components/customerForm'
import { telHref } from './components/floor'
import { OrderRow, OrderRowSkeleton } from './components/OrderList'

/** Ficha del cliente: contacto, sus vehículos y sus órdenes (abiertas y cerradas). */
export default function CustomerDetailPage() {
  const ctx = useWorkspace()
  const { customerId } = useParams()
  const id = Number(customerId)
  const valid = Number.isInteger(id) && id > 0
  const query = useCustomer(valid ? id : undefined)
  useDocumentTitle(query.data?.name ?? 'Cliente')
  const back = { to: `${ctx.base}/clientes`, label: 'Clientes' }

  if (!valid)
    return (
      <>
        <PageHeader back={back} title="Cliente" />
        <ErrorState title="No encontramos este cliente" />
      </>
    )
  if (query.isPending) return <DetailSkeleton />
  if (query.isError)
    return (
      <>
        <PageHeader back={back} title="Cliente" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  if (query.data.workspace_id !== ctx.id)
    return (
      <>
        <PageHeader back={back} title="Cliente" />
        <ErrorState title="Este cliente no pertenece a este taller" />
      </>
    )
  return <CustomerDetail key={query.data.id} customer={query.data} />
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  const remove = useDeleteCustomer(ctx.id)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canOperate = ctx.can('operate')
  const canManage = ctx.can('manage')
  const hasOpen = customer.open_orders_count > 0

  const doDelete = () =>
    remove.mutate(customer.id, {
      onSuccess: () => {
        toast.success(`${customer.name} eliminado de tus clientes`)
        navigate(`${ctx.base}/clientes`, { replace: true })
      },
      onError: (err) => {
        setConfirmDelete(false)
        toast.error('No se pudo eliminar el cliente', { description: errorMessage(err) })
      },
    })

  return (
    <>
      <PageHeader
        back={{ to: `${ctx.base}/clientes`, label: 'Clientes' }}
        eyebrow="Cliente"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={customer.name} size="lg" className="hidden sm:inline-grid" />
            {customer.name}
          </span>
        }
        description={`Cliente desde el ${formatDate(customer.created_at, 'long')} · ${plural(customer.vehicles_count, 'vehículo', 'vehículos')} · ${plural(customer.open_orders_count, 'orden abierta', 'órdenes abiertas')}.`}
        actions={
          <>
            {canOperate && (
              <ButtonLink to={`${ctx.base}/ordenes/nueva?cliente=${customer.id}`} variant="primary" icon={<ClipboardPlus aria-hidden />}>
                Nueva orden
              </ButtonLink>
            )}
            {canOperate && (
              <Button icon={<Pencil aria-hidden />} onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger className={iconButtonClasses({ variant: 'secondary' })} aria-label={`Más acciones de ${customer.name}`} title="Más acciones">
                  <EllipsisVertical aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72">
                  <DropdownMenuItem danger icon={<Trash2 aria-hidden />} disabled={hasOpen} onSelect={() => setConfirmDelete(true)}>
                    Eliminar cliente…
                  </DropdownMenuItem>
                  {hasOpen && <p className="px-2.5 pb-2 text-xs text-fg-subtle">Tiene {plural(customer.open_orders_count, 'orden abierta', 'órdenes abiertas')}: ciérralas antes de eliminarlo.</p>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-8">
          <CustomerVehicles customer={customer} />
          <CustomerOrders customer={customer} />
        </div>
        <ContactCard customer={customer} onEdit={canOperate ? () => setEditing(true) : undefined} />
      </div>

      <CustomerDialog open={editing} onOpenChange={setEditing} customer={customer} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar a ${customer.name}?`}
        description={`${
          customer.vehicles_count ? `Sus ${plural(customer.vehicles_count, 'vehículo', 'vehículos')} seguirán en el taller, pero sin cliente. ` : ''
        }Las órdenes cerradas se conservan. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar cliente"
        loading={remove.isPending}
        onConfirm={doDelete}
      />
    </>
  )
}

function ContactCard({ customer, onEdit }: { customer: Customer; onEdit?: () => void }) {
  const missing = !customer.phone && !customer.email
  return (
    <Card className="p-5">
      <h2 className="font-display text-base font-semibold text-fg-warm">Contacto</h2>
      {(customer.phone || customer.email) && (
        <div className="mt-3 flex flex-col gap-2">
          {customer.phone && (
            <a href={telHref(customer.phone)} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-3 text-sm text-fg hover:border-line-strong">
              <Phone aria-hidden className="size-4 text-fg-subtle" />
              <span className="sr-only">Llamar al </span>
              <span className="tabular">{customer.phone}</span>
            </a>
          )}
          {customer.email && (
            <a href={mailHref(customer.email)} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-control border border-line px-3 text-sm text-fg hover:border-line-strong">
              <Mail aria-hidden className="size-4 shrink-0 text-fg-subtle" />
              <span className="sr-only">Escribir a </span>
              <span className="truncate">{customer.email}</span>
            </a>
          )}
        </div>
      )}
      {missing && (
        <p className="mt-2 text-sm text-fg-muted">
          Sin teléfono ni email.{' '}
          {onEdit && (
            <button type="button" onClick={onEdit} className="font-medium text-accent-ink hover:underline">
              Añadir contacto
            </button>
          )}
        </p>
      )}
      <DataList
        className="mt-3"
        items={[
          { label: 'NIF / CIF', value: customer.tax_id ? <span className="font-mono">{customer.tax_id}</span> : 'Sin indicar', empty: !customer.tax_id },
          { label: 'Alta', value: formatDate(customer.created_at) },
        ]}
      />
      {customer.notes && (
        <div className="mt-3 rounded-control border border-line bg-surface-2/50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
            <StickyNote aria-hidden className="size-3.5" />
            Notas
          </p>
          <p className="whitespace-pre-line text-sm text-fg">{customer.notes}</p>
        </div>
      )}
    </Card>
  )
}

function CustomerVehicles({ customer }: { customer: Customer }) {
  const ctx = useWorkspace()
  const vehicles = useCustomerVehicles(customer.id)
  const canOperate = ctx.can('operate')
  const addHref = `${ctx.base}/vehiculos/nuevo?cliente=${customer.id}`
  return (
    <Section
      id="vehiculos"
      title="Vehículos"
      description={vehicles.data ? plural(vehicles.data.length, 'vehículo activo', 'vehículos activos') : undefined}
      action={
        canOperate && (
          <ButtonLink to={addHref} size="sm" icon={<Plus aria-hidden />}>
            Añadir vehículo
          </ButtonLink>
        )
      }
    >
      {vehicles.isPending ? (
        <div role="status" className="grid gap-3 sm:grid-cols-2">
          <span className="sr-only">Cargando vehículos…</span>
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      ) : vehicles.isError ? (
        <ErrorState compact error={vehicles.error} onRetry={() => void vehicles.refetch()} />
      ) : vehicles.data.length === 0 ? (
        <EmptyState
          compact
          icon={<Car />}
          title="Sin vehículos"
          description="Da de alta su coche para abrirle órdenes y llevar su historial."
          action={
            canOperate && (
              <ButtonLink to={addHref} size="sm" icon={<Plus aria-hidden />}>
                Añadir vehículo
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {vehicles.data.map((v) => (
            <VehicleTile key={v.id} vehicle={v} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function VehicleTile({ vehicle }: { vehicle: Vehicle }) {
  const ctx = useWorkspace()
  const open = vehicle.stats.open_work_order
  return (
    <li className="relative flex items-center gap-3 rounded-card border border-line bg-surface p-3 transition-colors hover:border-line-strong has-[a.stretched:focus-visible]:outline-2 has-[a.stretched:focus-visible]:outline-accent">
      <CarThumbnail appearance={{ bodyType: vehicle.body_type, colorHex: vehicle.color_hex }} alt="" className="h-12 w-20 shrink-0" />
      <div className="min-w-0 flex-1">
        <Link to={`${ctx.base}/vehiculos/${vehicle.id}`} className="stretched block truncate font-medium text-fg outline-none after:absolute after:inset-0 after:content-['']">
          {vehicle.display_name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <Plate value={vehicle.plate} className="h-5 text-[10px]" />
          <span className="tabular">{formatKm(vehicle.current_mileage, { empty: 'Sin km' })}</span>
        </div>
        {open && (
          <Link to={`${ctx.base}/ordenes/${open.id}`} className="relative z-10 mt-1.5 inline-flex rounded-full">
            <StatusPill status={WORK_ORDER_STATUS[open.status]} size="sm" label={`${open.number} · ${WORK_ORDER_STATUS[open.status].label}`} />
          </Link>
        )}
      </div>
    </li>
  )
}

function CustomerOrders({ customer }: { customer: Customer }) {
  const ctx = useWorkspace()
  const orders = useWorkOrdersInfinite(ctx.id, { customer_id: customer.id, per_page: 10 })
  const list = flattenPages(orders.data)
  const total = totalFromPages(orders.data)
  const canOperate = ctx.can('operate')
  return (
    <Section id="ordenes" title="Órdenes" description={total !== null ? `${plural(total, 'orden', 'órdenes')}, de la más reciente a la más antigua.` : undefined}>
      {orders.isPending ? (
        <OrderRowSkeleton count={3} />
      ) : orders.isError ? (
        <ErrorState compact error={orders.error} onRetry={() => void orders.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          compact
          icon={<ClipboardList />}
          title="Sin órdenes todavía"
          description="Cuando traiga su coche, ábrele una orden: aparecerá aquí y en el tablero."
          action={
            canOperate && (
              <ButtonLink to={`${ctx.base}/ordenes/nueva?cliente=${customer.id}`} size="sm" icon={<ClipboardPlus aria-hidden />}>
                Nueva orden
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {list.map((o) => (
              <OrderRow key={o.id} order={o} to={`${ctx.base}/ordenes/${o.id}`} showCustomer={false} showTotal={ctx.can('manage')} />
            ))}
          </ul>
          <LoadMore hasNextPage={!!orders.hasNextPage} isFetchingNextPage={orders.isFetchingNextPage} fetchNextPage={orders.fetchNextPage} shown={list.length} total={total} what="órdenes" />
        </>
      )}
    </Section>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Cargando cliente…</span>
      <div aria-hidden className="space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-24 rounded-card" />
              <Skeleton className="h-24 rounded-card" />
            </div>
            <Skeleton className="h-48 rounded-card" />
          </div>
          <Skeleton className="h-56 rounded-card" />
        </div>
      </div>
    </div>
  )
}

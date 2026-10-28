import { Car, ClipboardList, ClipboardPlus, Pencil, Plus, ShieldOff } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, useParams } from 'react-router'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useCustomer, useCustomerVehicles, useWorkOrdersInfinite } from '@/api/hooks/workshop'
import type { Customer, Vehicle } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink, Button } from '@/components/ui/Button'
import { LoadMore } from '@/components/ui/LoadMore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatKm, formatPlate } from '@/lib/format'
import { WORK_ORDER_STATUS_LABEL } from '@/lib/labels'
import { plural } from '@/lib/text'
import { CustomerDialog } from './components/CustomerDialog'
import { CustomerPrivacySection } from './components/CustomerPrivacySection'
import { mailHref } from './components/customerForm'
import { telHref } from './components/floor'
import { OrderRow, OrderRowSkeleton } from './components/OrderList'

/** Ficha del cliente: contacto en la cabecera, sus vehículos, sus órdenes y (owner/manager) sus datos personales. */
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
  const [editing, setEditing] = useState(false)
  const anonymized = customer.anonymized_at !== null
  // Un cliente anonimizado no se edita (409) ni se asigna a coches nuevos (422), pero sus coches sí pueden abrir órdenes.
  const canOperate = ctx.can('operate')
  const canEdit = canOperate && !anonymized
  const canOpenOrder = canOperate && (!anonymized || customer.vehicles_count > 0)

  return (
    <>
      <PageHeader
        back={{ to: `${ctx.base}/clientes`, label: 'Clientes' }}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {customer.name}
            {anonymized && (
              <Badge tone="neutral" icon={<ShieldOff aria-hidden />}>
                Anonimizado
              </Badge>
            )}
          </span>
        }
        description={<ContactLine customer={customer} onEdit={canEdit ? () => setEditing(true) : undefined} />}
        actions={
          <>
            {canOpenOrder && (
              <ButtonLink to={`${ctx.base}/ordenes/nueva?cliente=${customer.id}`} variant="primary" icon={<ClipboardPlus aria-hidden />}>
                Nueva orden
              </ButtonLink>
            )}
            {canEdit && (
              <Button icon={<Pencil aria-hidden />} onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
          </>
        }
      >
        {customer.notes && (
          <p className="max-w-2xl whitespace-pre-line text-sm text-fg-muted">
            <span className="font-medium text-fg">Notas: </span>
            {customer.notes}
          </p>
        )}
      </PageHeader>

      <div className="max-w-4xl space-y-10">
        <CustomerVehicles customer={customer} canAdd={canEdit} />
        <CustomerOrders customer={customer} canOpenOrder={canOpenOrder} />
        {ctx.can('manage') && <CustomerPrivacySection customer={customer} />}
      </div>

      {canEdit && <CustomerDialog open={editing} onOpenChange={setEditing} customer={customer} />}
    </>
  )
}

/** Contacto en una línea: teléfono y email enlazados, NIF y antigüedad. */
function ContactLine({ customer, onEdit }: { customer: Customer; onEdit?: () => void }) {
  if (customer.anonymized_at)
    return `Anonimizado el ${formatDate(customer.anonymized_at, 'long')}: sus datos de contacto ya no existen. Cliente desde el ${formatDate(customer.created_at, 'long')}.`

  const parts: ReactNode[] = []
  if (customer.phone)
    parts.push(
      <a key="tel" href={telHref(customer.phone)} className="text-fg underline-offset-2 hover:underline tabular">
        <span className="sr-only">Llamar al </span>
        {customer.phone}
      </a>,
    )
  if (customer.email)
    parts.push(
      <a key="mail" href={mailHref(customer.email)} className="break-all text-fg underline-offset-2 hover:underline">
        <span className="sr-only">Escribir a </span>
        {customer.email}
      </a>,
    )
  if (customer.tax_id) parts.push(<span key="nif">NIF {customer.tax_id}</span>)
  parts.push(<span key="alta">Cliente desde el {formatDate(customer.created_at, 'long')}</span>)

  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden> · </span>}
          {p}
        </span>
      ))}
      {!customer.phone && !customer.email && (
        <>
          {' · '}Sin teléfono ni email
          {onEdit && (
            <>
              {' · '}
              <button type="button" onClick={onEdit} className="font-medium text-accent-ink underline-offset-2 hover:underline">
                Añadir contacto
              </button>
            </>
          )}
        </>
      )}
    </>
  )
}

function CustomerVehicles({ customer, canAdd }: { customer: Customer; canAdd: boolean }) {
  const ctx = useWorkspace()
  const vehicles = useCustomerVehicles(customer.id)
  const addHref = `${ctx.base}/vehiculos/nuevo?cliente=${customer.id}`
  const addButton = canAdd && (
    <ButtonLink to={addHref} size="sm" icon={<Plus aria-hidden />}>
      Añadir vehículo
    </ButtonLink>
  )
  return (
    <Section id="vehiculos" title="Vehículos" description={vehicles.data ? plural(vehicles.data.length, 'vehículo activo', 'vehículos activos') : undefined} action={vehicles.data?.length ? addButton : undefined}>
      {vehicles.isPending ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando vehículos…</span>
          <SkeletonText lines={2} />
        </div>
      ) : vehicles.isError ? (
        <ErrorState compact error={vehicles.error} onRetry={() => void vehicles.refetch()} />
      ) : vehicles.data.length === 0 ? (
        <EmptyState
          compact
          icon={<Car />}
          title="Sin vehículos"
          description={canAdd ? 'Da de alta su coche para abrirle órdenes y llevar su historial.' : 'Este cliente no tiene vehículos en el taller.'}
          action={addButton}
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {vehicles.data.map((v) => (
            <VehicleRow key={v.id} vehicle={v} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function VehicleRow({ vehicle }: { vehicle: Vehicle }) {
  const ctx = useWorkspace()
  const open = vehicle.stats.open_work_order
  return (
    <li className="relative flex flex-col gap-0.5 py-3 transition-colors hover:bg-surface-2/60 has-[a.stretched:focus-visible]:outline-2 has-[a.stretched:focus-visible]:outline-accent sm:flex-row sm:items-baseline sm:gap-4">
      <Link to={`${ctx.base}/vehiculos/${vehicle.id}`} className="stretched min-w-0 truncate font-medium text-fg outline-none after:absolute after:inset-0 after:content-[''] sm:flex-1">
        {vehicle.display_name}
      </Link>
      <span className="text-sm text-fg-muted">
        {[vehicle.plate ? formatPlate(vehicle.plate) : 'Sin matrícula', formatKm(vehicle.current_mileage, { empty: 'Sin km' })].join(' · ')}
      </span>
      {open && (
        <Link to={`${ctx.base}/ordenes/${open.id}`} className="relative z-10 w-fit text-sm text-accent-ink underline-offset-2 hover:underline">
          {open.number} · {WORK_ORDER_STATUS_LABEL[open.status]}
        </Link>
      )}
    </li>
  )
}

function CustomerOrders({ customer, canOpenOrder }: { customer: Customer; canOpenOrder: boolean }) {
  const ctx = useWorkspace()
  const orders = useWorkOrdersInfinite(ctx.id, { customer_id: customer.id, per_page: 10 })
  const list = flattenPages(orders.data)
  const total = totalFromPages(orders.data)
  return (
    <Section id="ordenes" title="Órdenes" description={total ? `${plural(total, 'orden', 'órdenes')}, de la más reciente a la más antigua.` : undefined}>
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
            canOpenOrder && (
              <ButtonLink to={`${ctx.base}/ordenes/nueva?cliente=${customer.id}`} size="sm" icon={<ClipboardPlus aria-hidden />}>
                Nueva orden
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <ul className="border-t border-line">
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
      <div aria-hidden className="max-w-4xl space-y-6">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <SkeletonText lines={3} />
        <SkeletonText lines={4} />
      </div>
    </div>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleCheck,
  EllipsisVertical,
  ExternalLink,
  History,
  Phone,
  Trash2,
  Undo2,
  UserRound,
  Warehouse,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/client'
import { qk } from '@/api/keys'
import { useVehicle } from '@/api/hooks/vehicles'
import { LIVE_REFRESH_MS, useBays, useDeleteWorkOrder, useSaveWorkOrder, useWorkOrder } from '@/api/hooks/workshop'
import { useMembers } from '@/api/hooks/workspaces'
import type { Priority, WorkOrder, WorkOrderStatus } from '@/api/types'
import { LineItemsEditor } from '@/components/forms/LineItemsEditor'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Badge, Plate } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, DataList } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Field, Fieldset } from '@/components/ui/Field'
import { Input, MileageInput, Textarea } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { iconButtonClasses } from '@/components/ui/variants'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { CarThumbnail } from '@/three'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { formatDateTime, formatKm, formatNumber } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { PRIORITIES, PRIORITY_LABEL } from '@/lib/labels'
import { AFTER_SAVE } from '@/lib/navigation'
import { PRIORITY } from '@/lib/status'
import { AssigneeField } from './components/AssigneeField'
import { BayPicker } from './components/BayPicker'
import { telHref } from './components/floor'
import { MoveToMenu } from './components/MoveToMenu'
import { BayBadge, LateBadge, OrderStatusPill, PriorityBadge, PromisedAt } from './components/OrderBadges'
import { ORDER_FIELD_NAMES, orderSchema, orderToValues, type OrderValues, valuesToInput } from './components/orderForm'
import { OrderLinesTable } from './components/OrderLinesTable'
import { LiveOrderTotals, OrderTotals } from './components/OrderTotals'
import { isDeletableStatus, isFinalStatus, nextStep, statusLabel } from './components/orderUtils'
import { PromisedAtField } from './components/PromisedAtField'
import { StatusStepper } from './components/StatusStepper'
import { serverTotals } from './components/totals'
import { useOrderActions } from './components/useOrderActions'

/** Ficha de una orden de trabajo: estado, trabajo, líneas, elevador, mecánico y entrega. */
export default function OrderDetailPage() {
  const ctx = useWorkspace()
  const { orderId } = useParams()
  const id = Number(orderId)
  const valid = Number.isInteger(id) && id > 0
  const query = useWorkOrder(valid ? id : undefined)
  useDocumentTitle(query.data ? `${query.data.number} · ${query.data.title}` : 'Orden de trabajo')
  const back = { to: `${ctx.base}/ordenes`, label: 'Órdenes' }

  if (!valid)
    return (
      <>
        <PageHeader back={back} title="Orden de trabajo" />
        <ErrorState title="No encontramos esta orden" />
      </>
    )
  if (query.isPending) return <DetailSkeleton />
  if (query.isError)
    return (
      <>
        <PageHeader back={back} title="Orden de trabajo" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  if (query.data.workspace_id !== ctx.id)
    return (
      <>
        <PageHeader back={back} title="Orden de trabajo" />
        <ErrorState title="Esta orden no pertenece a este taller" />
      </>
    )
  return <OrderDetail key={query.data.id} order={query.data} />
}

function OrderDetail({ order }: { order: WorkOrder }) {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const actions = useOrderActions()
  const final = isFinalStatus(order.status)
  const editable = ctx.can('operate') && !final
  const showPrices = ctx.can('manage')
  const canDelete = ctx.can('manage') && isDeletableStatus(order.status)
  const bays = useBays(ctx.id, editable, LIVE_REFRESH_MS)
  const save = useSaveWorkOrder(ctx.id, order.id)
  const remove = useDeleteWorkOrder(ctx.id)
  const [orphans, setOrphans] = useState<string[]>([])
  const [bayError, setBayError] = useState<string | null>(null)
  const [pendingFinal, setPendingFinal] = useState<WorkOrderStatus | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const busy = actions.busyId === order.id

  const form = useForm<OrderValues>({ resolver: zodResolver(orderSchema), defaultValues: orderToValues(order), mode: 'onTouched' })
  const { formState, handleSubmit, reset, setError } = form
  const dirty = formState.isDirty
  const guard = useUnsavedChanges(dirty && editable)

  // Cambios que llegan del servidor (otro compañero, cambio de estado…) se reflejan si no hay edición en curso
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(orderToValues(order))
  }, [order, form])

  const submit = (after?: (saved: WorkOrder) => void, onInvalid?: () => void) =>
    handleSubmit((v) => {
      setOrphans([])
      save.mutate(valuesToInput(v), {
        onSuccess: (saved) => {
          reset(orderToValues(saved))
          toast.success('Cambios guardados')
          after?.(saved)
        },
        onError: (err) => {
          if (isApiError(err) && err.isConflict) {
            toast.error('No se pudieron guardar los cambios', { description: err.message })
            void qc.invalidateQueries({ queryKey: qk.workOrder(order.id) })
            return
          }
          handleFormError(err, setError, ORDER_FIELD_NAMES, setOrphans)
        },
      })
    }, onInvalid)

  /** Cambio de estado desde el stepper, el botón principal o «Mover a…». Entregar/cancelar se confirman. */
  const requestStatus = (status: WorkOrderStatus) => {
    if (status === order.status) return
    const closing = status === 'delivered' || status === 'cancelled'
    if (closing && dirty) {
      setPendingFinal(status)
      return
    }
    actions.request(order, status)
  }

  const changeBay = (bay: number | null) => {
    setBayError(null)
    void actions.move(order, order.status, bay, { onError: setBayError })
  }

  const doDelete = () =>
    remove.mutate(order.id, {
      onSuccess: () => {
        toast.success(`${order.number} eliminada`)
        navigate(`${ctx.base}/ordenes`, { replace: true, state: AFTER_SAVE })
      },
      onError: (err) => {
        setConfirmDelete(false)
        toast.error('No se pudo eliminar la orden', { description: errorMessage(err) })
      },
    })

  const next = editable ? nextStep(order.status) : null
  const historyHref = `${ctx.base}/vehiculos/${order.vehicle.id}/historial${order.maintenance_record_id ? `#intervencion-${order.maintenance_record_id}` : ''}`

  const headerActions = (
    <>
      {next && (
        <Button
          variant={dirty ? 'secondary' : 'primary'}
          icon={next.status === 'delivered' ? <CircleCheck aria-hidden /> : <ArrowRight aria-hidden />}
          loading={busy}
          onClick={() => requestStatus(next.status)}
        >
          {next.label}
        </Button>
      )}
      {editable && <MoveToMenu order={order} onRequest={(_o, s) => requestStatus(s)} variant="button" disabled={busy} className="h-11 md:h-10" />}
      {(canDelete || !final) && (
        <DropdownMenu>
          <DropdownMenuTrigger className={iconButtonClasses({ variant: 'secondary' })} aria-label={`Más acciones de ${order.number}`} title="Más acciones">
            <EllipsisVertical aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {!final && (
              <DropdownMenuItem icon={<Warehouse aria-hidden />} onSelect={() => navigate(`${ctx.base}/taller?orden=${order.id}`)}>
                Ver en el taller 3D
              </DropdownMenuItem>
            )}
            <DropdownMenuItem icon={<History aria-hidden />} onSelect={() => navigate(historyHref)}>
              Historial del vehículo
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger icon={<Trash2 aria-hidden />} onSelect={() => setConfirmDelete(true)}>
                  Eliminar orden…
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )

  return (
    <>
      <PageHeader
        back={{ to: `${ctx.base}/ordenes`, label: 'Órdenes' }}
        eyebrow={<span className="font-mono normal-case tracking-[0.08em] tabular">{order.number}</span>}
        title={order.title}
        actions={headerActions}
      >
        <OrderMeta order={order} />
      </PageHeader>

      <Card className="mb-5 p-4 sm:p-5">
        <StatusStepper order={order} onRequest={editable ? requestStatus : undefined} busy={busy} />
        {editable && <p className="mt-3 text-xs text-fg-subtle">Pulsa un paso para mover la orden. Entregar y cancelar piden confirmación.</p>}
      </Card>

      {order.status === 'delivered' && (
        <div role="status" className="mb-5 flex flex-col gap-3 rounded-card border border-ok/40 bg-ok-soft px-4 py-3 sm:flex-row sm:items-center">
          <CircleCheck aria-hidden className="size-5 shrink-0 text-ok" />
          <p className="flex-1 text-sm text-fg">
            Entregada el <span className="tabular">{formatDateTime(order.delivered_at)}</span>.{' '}
            {order.maintenance_record_id
              ? `Está en el historial de ${order.vehicle.display_name} como intervención, con sus líneas.`
              : 'La orden está cerrada y en solo lectura.'}
          </p>
          {order.maintenance_record_id && (
            <ButtonLink to={historyHref} variant="primary" size="sm" icon={<History aria-hidden />}>
              Ver en el historial
            </ButtonLink>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:gap-8">
        <div className="min-w-0 space-y-5">
          {editable ? (
            <form id="order-form" onSubmit={submit()} noValidate className="space-y-5">
              <WorkCard form={form} />
              <Card className="p-5 md:p-6">
                <Fieldset
                  legend="Piezas y mano de obra"
                  description={
                    showPrices
                      ? 'Al entregar, estas líneas se copian al historial del vehículo. El total se calcula con el IVA del taller.'
                      : 'Al entregar, estas líneas se copian al historial del vehículo. Los precios los añade el propietario o el gerente.'
                  }
                >
                  <LineItemsEditor form={form} showPrices={showPrices} />
                  {formState.errors.items?.message && <p className="text-xs font-medium text-danger">{formState.errors.items.message}</p>}
                </Fieldset>
              </Card>
              <PlanningCard form={form} order={order} />
              <FormErrors messages={orphans} />
              <SaveBar dirty={dirty} saving={save.isPending} onDiscard={() => reset(orderToValues(order))} />
            </form>
          ) : (
            <ReadOnlyOrder order={order} showPrices={showPrices} />
          )}
        </div>

        <aside aria-label="Vehículo, elevador y resumen" className="min-w-0 space-y-4">
          <VehicleCard order={order} />
          {editable && (
            <Card className="p-4">
              <BayPicker
                mode="action"
                label="Elevador"
                description={busy ? 'Moviendo…' : 'Pulsa uno libre para subir el coche; «Sin elevador» lo deja en espera.'}
                bays={bays.data}
                loading={bays.isPending}
                currentOrderId={order.id}
                value={order.bay}
                onChange={changeBay}
                disabled={busy}
                error={bayError}
              />
              {bays.isError && (
                <p className="mt-2 text-xs text-danger">
                  No se pudieron cargar los elevadores.{' '}
                  <button type="button" className="font-medium underline" onClick={() => void bays.refetch()}>
                    Reintentar
                  </button>
                </p>
              )}
            </Card>
          )}
          {editable ? <LiveOrderTotals form={form} taxRate={order.tax_rate} showPrices={showPrices} /> : <OrderTotals data={serverTotals(order)} showPrices={showPrices} />}
          <DatesCard order={order} />
        </aside>
      </div>

      <ConfirmDialog
        open={pendingFinal !== null}
        onOpenChange={(o) => !o && setPendingFinal(null)}
        title="Tienes cambios sin guardar"
        description={
          pendingFinal === 'delivered'
            ? 'Al entregar, la orden queda en solo lectura y sus líneas pasan al historial del vehículo. Guarda antes los cambios para que se incluyan.'
            : 'Al cancelar, la orden queda en solo lectura. Guarda antes los cambios si quieres conservarlos.'
        }
        confirmLabel="Guardar y continuar"
        cancelLabel="Volver"
        tone="primary"
        loading={save.isPending}
        onConfirm={() => {
          const status = pendingFinal
          if (!status) return
          // Si la validación falla, se cierra el aviso para que se vean los errores junto a cada campo
          void submit(
            (saved) => {
              setPendingFinal(null)
              actions.request(saved, status)
            },
            () => setPendingFinal(null),
          )()
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar ${order.number}?`}
        description={`Se borrará la orden${order.mileage_in !== null ? ' y su lectura de kilometraje de entrada' : ''}. No afecta al historial del vehículo. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar orden"
        loading={remove.isPending}
        onConfirm={doDelete}
      />
      {actions.dialogs}
      {guard}
    </>
  )
}

function OrderMeta({ order }: { order: WorkOrder }) {
  const ctx = useWorkspace()
  const v = order.vehicle
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <OrderStatusPill status={order.status} />
        {order.is_late && <LateBadge size="md" />}
        <PriorityBadge priority={order.priority} size="md" quiet />
        {!isFinalStatus(order.status) && (order.bay ? <BayBadge bay={order.bay} size="md" /> : <Badge tone="neutral">En espera</Badge>)}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
        <Link to={`${ctx.base}/vehiculos/${v.id}`} className="inline-flex items-center gap-2 text-fg hover:underline">
          {v.display_name}
        </Link>
        {v.plate && <Plate value={v.plate} />}
        {order.customer && (
          <Link to={`${ctx.base}/clientes/${order.customer.id}`} className="inline-flex items-center gap-1.5 hover:text-fg hover:underline">
            <UserRound aria-hidden className="size-4 text-fg-subtle" />
            <span className="sr-only">Cliente: </span>
            {order.customer.name}
          </Link>
        )}
      </p>
    </div>
  )
}

function WorkCard({ form }: { form: UseFormReturn<OrderValues> }) {
  const { register, formState } = form
  const e = formState.errors
  return (
    <Card className="p-5 md:p-6">
      <Fieldset legend="Trabajo">
        <Field label="Título" required error={e.title?.message} hint="Lo que verá el equipo en el tablero y lo que quedará en el historial.">
          <Input autoComplete="off" maxLength={120} {...register('title')} />
        </Field>
        <Field label="Síntoma o petición del cliente" error={e.complaint?.message}>
          <Textarea rows={3} maxLength={5000} placeholder="P. ej. Ruido al frenar en frío; revisión de los 60.000 km" {...register('complaint')} />
        </Field>
        <Field label="Diagnóstico" error={e.diagnosis?.message} hint="Qué habéis encontrado y qué se ha hecho. Al entregar se copia como descripción en el historial.">
          <Textarea rows={4} maxLength={5000} {...register('diagnosis')} />
        </Field>
      </Fieldset>
    </Card>
  )
}

function PlanningCard({ form, order }: { form: UseFormReturn<OrderValues>; order: WorkOrder }) {
  const ctx = useWorkspace()
  const members = useMembers(ctx.id)
  const vehicle = useVehicle(order.vehicle.id)
  const { register, formState, setValue } = form
  const [priority, mileage] = useWatch({ control: form.control, name: ['priority', 'mileage_in'] })
  const current = vehicle.data?.current_mileage ?? null
  const e = formState.errors
  return (
    <Card className="p-5 md:p-6">
      <Fieldset legend="Planificación">
        <div>
          <p aria-hidden className="mb-1.5 text-sm font-medium text-fg">
            Prioridad
          </p>
          <SegmentedControl<Priority>
            label="Prioridad"
            size="sm"
            block
            value={priority}
            onValueChange={(p) => setValue('priority', p, { shouldDirty: true })}
            options={PRIORITIES.map((p) => {
              const Icon = PRIORITY[p].icon
              return { value: p, label: PRIORITY_LABEL[p], icon: <Icon aria-hidden /> }
            })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <AssigneeField form={form} members={members.data} loading={members.isPending} currentName={order.assigned_to?.name} />
          <Field
            label="Km de entrada"
            error={e.mileage_in?.message}
            hint={current !== null ? `Último registro del vehículo: ${formatKm(current)}. Se guarda como lectura.` : 'Lo que marcaba al entrar. Se guarda como lectura del vehículo.'}
            labelAside={
              current !== null &&
              !mileage && (
                <button
                  type="button"
                  onClick={() => setValue('mileage_in', formatNumber(current), { shouldDirty: true, shouldValidate: true })}
                  className="-my-2 rounded-control px-1 py-2 text-xs font-medium text-accent-ink hover:underline"
                >
                  Usar {formatKm(current)}
                </button>
              )
            }
          >
            <MileageInput {...register('mileage_in')} />
          </Field>
        </div>
        <PromisedAtField form={form} />
      </Fieldset>
    </Card>
  )
}

function SaveBar({ dirty, saving, onDiscard }: { dirty: boolean; saving: boolean; onDiscard: () => void }) {
  return (
    <div
      className={
        dirty
          ? 'sticky bottom-24 z-10 flex flex-col gap-2 rounded-card border border-accent/40 bg-surface/95 p-3 shadow-xl shadow-black/30 backdrop-blur sm:flex-row sm:items-center md:bottom-4'
          : 'flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center'
      }
    >
      <p className="flex-1 text-sm text-fg-muted" aria-live="polite">
        {dirty ? 'Tienes cambios sin guardar.' : 'Estado y elevador se aplican al momento; el resto se guarda con este botón.'}
      </p>
      {dirty && (
        <Button variant="ghost" icon={<Undo2 aria-hidden />} onClick={onDiscard} disabled={saving}>
          Descartar
        </Button>
      )}
      <Button type="submit" variant={dirty ? 'primary' : 'secondary'} loading={saving} disabled={!dirty} icon={<Check aria-hidden />}>
        Guardar cambios
      </Button>
    </div>
  )
}

function ReadOnlyOrder({ order, showPrices }: { order: WorkOrder; showPrices: boolean }) {
  const text = (v: string | null) => (v ? <span className="whitespace-pre-line">{v}</span> : 'Sin anotar')
  return (
    <>
      <Card className="p-5 md:p-6">
        <h2 className="font-display text-base font-semibold text-fg-warm">Trabajo</h2>
        <p className="mt-0.5 text-sm text-fg-muted">La orden está {order.status === 'delivered' ? 'entregada' : 'cancelada'}: ya no admite cambios.</p>
        <DataList
          className="mt-3"
          items={[
            { label: 'Síntoma o petición', value: text(order.complaint), empty: !order.complaint },
            { label: 'Diagnóstico', value: text(order.diagnosis), empty: !order.diagnosis },
            { label: 'Prioridad', value: PRIORITY_LABEL[order.priority] },
            { label: 'Mecánico', value: order.assigned_to?.name ?? 'Sin asignar', empty: !order.assigned_to },
            { label: 'Km de entrada', value: <span className="tabular">{formatKm(order.mileage_in, { empty: 'Sin anotar' })}</span>, empty: order.mileage_in === null },
          ]}
        />
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="mb-3 font-display text-base font-semibold text-fg-warm">Piezas y mano de obra</h2>
        <OrderLinesTable items={order.items} showPrices={showPrices} />
      </Card>
    </>
  )
}

function VehicleCard({ order }: { order: WorkOrder }) {
  const ctx = useWorkspace()
  const vehicle = useVehicle(order.vehicle.id)
  const v = order.vehicle
  const c = order.customer
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <VehicleThumbBox order={order} />
        <div className="min-w-0">
          <Link to={`${ctx.base}/vehiculos/${v.id}`} className="block truncate font-medium text-fg hover:underline">
            {v.display_name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <Plate value={v.plate} />
            {vehicle.isPending ? (
              <Skeleton className="h-3 w-16" />
            ) : (
              <span className="tabular">{formatKm(vehicle.data?.current_mileage, { empty: 'Sin km' })}</span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2 p-4 text-sm">
        {c ? (
          <div className="flex min-w-0 items-center gap-2">
            <UserRound aria-hidden className="size-4 shrink-0 text-fg-subtle" />
            <Link to={`${ctx.base}/clientes/${c.id}`} className="min-w-0 truncate text-fg hover:underline">
              <span className="sr-only">Cliente: </span>
              {c.name}
            </Link>
            {c.phone && (
              <a href={telHref(c.phone)} className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 text-xs text-fg-muted hover:text-fg md:min-h-0">
                <Phone aria-hidden className="size-3.5" />
                <span className="sr-only">Llamar al </span>
                <span className="tabular">{c.phone}</span>
              </a>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-fg-muted">
            <UserRound aria-hidden className="size-4 text-fg-subtle" />
            Vehículo sin cliente asignado
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <Link to={`${ctx.base}/vehiculos/${v.id}`} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-accent-ink hover:underline md:min-h-0">
            <ExternalLink aria-hidden className="size-3.5" />
            Ficha del vehículo
          </Link>
          <Link to={`${ctx.base}/vehiculos/${v.id}/historial`} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-accent-ink hover:underline md:min-h-0">
            <History aria-hidden className="size-3.5" />
            Historial
          </Link>
        </div>
      </div>
    </Card>
  )
}

function VehicleThumbBox({ order }: { order: WorkOrder }) {
  const v = order.vehicle
  // Miniatura estática compartida (sin un WebGL por tarjeta)
  return (
    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-control bg-surface-2">
      <CarThumbnail appearance={{ bodyType: v.body_type, colorHex: v.color_hex }} alt="" className="absolute inset-0 h-full w-full p-1" />
    </div>
  )
}

function DatesCard({ order }: { order: WorkOrder }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Recibida', value: formatDateTime(order.received_at) },
    {
      label: 'Prometida',
      value: order.promised_at ? <PromisedAt order={order} className="justify-end" /> : <span className="text-fg-subtle">Sin fecha</span>,
    },
    ...(order.completed_at ? [{ label: 'Terminada', value: formatDateTime(order.completed_at) }] : []),
    ...(order.delivered_at ? [{ label: 'Entregada', value: formatDateTime(order.delivered_at) }] : []),
  ]
  return (
    <Card className="p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
        <CalendarClock aria-hidden className="size-4 text-fg-subtle" />
        Fechas
      </h2>
      <dl className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3">
            <dt className="text-fg-muted">{r.label}</dt>
            <dd className="text-right text-fg tabular">{r.value}</dd>
          </div>
        ))}
      </dl>
      {order.status !== 'delivered' && order.status !== 'cancelled' && (
        <p className="mt-2 text-xs text-fg-subtle">Estado actual: {statusLabel(order.status)}.</p>
      )}
    </Card>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Cargando la orden…</span>
      <div aria-hidden className="space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-6 w-64 max-w-full" />
        <Skeleton className="h-24 w-full rounded-card" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-48 rounded-card" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-card" />
            <Skeleton className="h-48 rounded-card" />
          </div>
        </div>
      </div>
    </div>
  )
}

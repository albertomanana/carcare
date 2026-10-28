import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Ban, Check, CircleCheck, EllipsisVertical, History, Printer, Trash2, TriangleAlert, Undo2, Warehouse } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/client'
import { qk } from '@/api/keys'
import { useVehicle } from '@/api/hooks/vehicles'
import { LIVE_REFRESH_MS, useBays, useDeleteWorkOrder, useSaveWorkOrder, useWorkOrder } from '@/api/hooks/workshop'
import { useMembers } from '@/api/hooks/workspaces'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { LineItemsEditor } from '@/components/forms/LineItemsEditor'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DataList } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Input, MileageInput, Select, Textarea } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { iconButtonClasses } from '@/components/ui/variants'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { formatDateTime, formatKm, formatNumber, formatPlate } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { PRIORITIES, PRIORITY_LABEL } from '@/lib/labels'
import { AFTER_SAVE } from '@/lib/navigation'
import { AssigneeField } from './components/AssigneeField'
import { BayPicker } from './components/BayPicker'
import { telHref } from './components/floor'
import { ORDER_FIELD_NAMES, orderSchema, orderToValues, type OrderValues, valuesToInput } from './components/orderForm'
import { OrderLinesTable } from './components/OrderLinesTable'
import { LiveOrderTotals, OrderTotals } from './components/OrderTotals'
import { formatWhen, isDeletableStatus, isFinalStatus, nextStep } from './components/orderUtils'
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

  /** Cambio de estado desde los pasos, el botón principal o el menú. Entregar y cancelar se confirman. */
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

  // Una sola acción primaria: el siguiente paso (R1). Con cambios sin guardar, la primaria pasa a «Guardar cambios».
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
      <ButtonLink to={`${ctx.base}/ordenes/${order.id}/resumen`} icon={<Printer aria-hidden />}>
        Imprimir resumen
      </ButtonLink>
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
          {(editable || canDelete) && <DropdownMenuSeparator />}
          {editable && (
            <DropdownMenuItem danger icon={<Ban aria-hidden />} onSelect={() => requestStatus('cancelled')}>
              Cancelar orden…
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem danger icon={<Trash2 aria-hidden />} onSelect={() => setConfirmDelete(true)}>
              Eliminar orden…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  return (
    <>
      <PageHeader back={{ to: `${ctx.base}/ordenes`, label: 'Órdenes' }} title={order.title} description={<OrderMeta order={order} />} actions={headerActions} />

      {/* Estado y elevador se aplican al momento, como en el tablero, con «Deshacer» en el aviso. */}
      <section aria-label="Estado y elevador" className="mb-10 space-y-4">
        <StatusStepper order={order} onRequest={editable ? requestStatus : undefined} busy={busy} />
        {editable && (
          <div>
            <BayPicker
              mode="action"
              label="Elevador"
              bays={bays.data}
              loading={bays.isPending}
              currentOrderId={order.id}
              value={order.bay}
              onChange={changeBay}
              disabled={busy}
              busy={busy}
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
          </div>
        )}
        {order.status === 'delivered' && (
          <p role="status" className="flex items-start gap-2 text-sm">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
            <span className="min-w-0 flex-1 text-fg">
              Entregada el <span className="tabular">{formatDateTime(order.delivered_at)}</span>.{' '}
              {order.maintenance_record_id ? (
                <>
                  Está en el historial de {order.vehicle.display_name} como intervención, con sus líneas.{' '}
                  <Link to={historyHref} className="font-medium text-accent-ink hover:underline">
                    Ver en el historial
                  </Link>
                </>
              ) : (
                'La orden está cerrada y en solo lectura.'
              )}
            </span>
          </p>
        )}
      </section>

      {editable ? (
        <form id="order-form" onSubmit={submit()} noValidate className="space-y-10">
          <WorkSection form={form} />
          <section aria-labelledby="lineas-title" className="space-y-4">
            <div>
              <SectionTitle id="lineas-title">Piezas y mano de obra</SectionTitle>
              <p className="mt-0.5 text-sm text-fg-muted">
                {showPrices ? 'Al entregar, estas líneas se copian al historial del vehículo.' : 'Al entregar, estas líneas se copian al historial del vehículo. Los precios los añade el propietario o el gerente.'}
              </p>
            </div>
            <LineItemsEditor form={form} showPrices={showPrices} />
            {formState.errors.items?.message && <p className="text-xs font-medium text-danger">{formState.errors.items.message}</p>}
            <LiveOrderTotals form={form} taxRate={order.tax_rate} showPrices={showPrices} className="ml-auto max-w-sm border-t border-line pt-3" />
          </section>
          <PlanningSection form={form} order={order} />
          <OrderDates order={order} />
          <FormErrors messages={orphans} />
          {dirty && <SaveBar saving={save.isPending} onDiscard={() => reset(orderToValues(order))} />}
        </form>
      ) : (
        <ReadOnlyOrder order={order} showPrices={showPrices} />
      )}

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

/**
 * Segunda línea de la cabecera (plan UX 5.4): "OT-2026-0024 · Toyota Corolla 4470 LJD · Carmen Ficticia Ruiz · prometida hoy 13:00".
 * Va dentro del <p> de la descripción, así que solo lleva contenido en línea. "Tarde" va con icono y texto, nunca solo color.
 */
function OrderMeta({ order }: { order: WorkOrder }) {
  const ctx = useWorkspace()
  const v = order.vehicle
  const c = order.customer
  const sep = <span aria-hidden> · </span>
  return (
    <>
      <span className="tabular">{order.number}</span>
      {sep}
      <Link to={`${ctx.base}/vehiculos/${v.id}`} className="text-fg hover:underline">
        {v.display_name}
        {v.plate && <span className="tabular"> {formatPlate(v.plate)}</span>}
      </Link>
      {sep}
      {c ? (
        <>
          <Link to={`${ctx.base}/clientes/${c.id}`} className="text-fg hover:underline">
            <span className="sr-only">Cliente: </span>
            {c.name}
          </Link>
          {c.phone && (
            <>
              {' ('}
              <a href={telHref(c.phone)} className="tabular hover:text-fg hover:underline">
                <span className="sr-only">llamar al </span>
                {c.phone}
              </a>
              {')'}
            </>
          )}
        </>
      ) : (
        'sin cliente'
      )}
      {!isFinalStatus(order.status) && (
        <>
          {sep}
          {order.promised_at ? (
            order.is_late ? (
              <span className="font-medium text-danger">
                <TriangleAlert aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                Tarde: prometida {formatWhen(order.promised_at)}
              </span>
            ) : (
              <span className="tabular">prometida {formatWhen(order.promised_at)}</span>
            )
          ) : (
            'sin fecha prometida'
          )}
          {order.priority === 'urgent' && (
            <>
              {sep}
              <span className="font-medium text-danger">Urgente</span>
            </>
          )}
        </>
      )}
    </>
  )
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="font-display text-lg font-semibold tracking-tight text-fg-warm">
      {children}
    </h2>
  )
}

function WorkSection({ form }: { form: UseFormReturn<OrderValues> }) {
  const { register, formState } = form
  const e = formState.errors
  return (
    <section aria-labelledby="trabajo-title" className="space-y-4">
      <SectionTitle id="trabajo-title">Trabajo</SectionTitle>
      <Field label="Título" required error={e.title?.message} hint="Es lo que se ve en el tablero y lo que queda en el historial.">
        <Input autoComplete="off" maxLength={120} {...register('title')} />
      </Field>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Síntoma o petición del cliente" error={e.complaint?.message}>
          <Textarea rows={3} maxLength={5000} placeholder="P. ej. Ruido al frenar en frío; revisión de los 60.000 km" {...register('complaint')} />
        </Field>
        <Field label="Diagnóstico" error={e.diagnosis?.message} hint="Al entregar se copia como descripción en el historial.">
          <Textarea rows={3} maxLength={5000} {...register('diagnosis')} />
        </Field>
      </div>
    </section>
  )
}

function PlanningSection({ form, order }: { form: UseFormReturn<OrderValues>; order: WorkOrder }) {
  const ctx = useWorkspace()
  const members = useMembers(ctx.id)
  // El último registro del coche solo hace falta para ofrecer «Usar … km» cuando la orden aún no tiene km de entrada (R12)
  const vehicle = useVehicle(order.mileage_in === null ? order.vehicle.id : undefined)
  const { register, formState, setValue } = form
  const mileage = useWatch({ control: form.control, name: 'mileage_in' })
  const current = vehicle.data?.current_mileage ?? null
  const e = formState.errors
  return (
    <section aria-labelledby="planificacion-title" className="space-y-4">
      <SectionTitle id="planificacion-title">Planificación</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prioridad" error={e.priority?.message}>
          <Select {...register('priority')}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <AssigneeField form={form} members={members.data} loading={members.isPending} currentName={order.assigned_to?.name} />
        <Field
          label="Km de entrada"
          error={e.mileage_in?.message}
          hint={current !== null ? `Último registro del vehículo: ${formatKm(current)}. Se guarda como lectura.` : 'Se guarda como lectura del vehículo.'}
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
        <PromisedAtField form={form} />
      </div>
    </section>
  )
}

/** Barra de guardar fija: solo aparece con cambios sin guardar (un solo modelo de guardado para el formulario). Opaca (R8). */
function SaveBar({ saving, onDiscard }: { saving: boolean; onDiscard: () => void }) {
  return (
    <div className="sticky bottom-24 z-10 flex flex-col gap-2 rounded-card border border-line-strong bg-surface p-3 sm:flex-row sm:items-center md:bottom-4">
      <p className="flex-1 text-sm text-fg" aria-live="polite">
        Tienes cambios sin guardar.
      </p>
      <Button variant="ghost" icon={<Undo2 aria-hidden />} onClick={onDiscard} disabled={saving}>
        Descartar
      </Button>
      <Button type="submit" variant="primary" loading={saving} icon={<Check aria-hidden />}>
        Guardar cambios
      </Button>
    </div>
  )
}

/** Fechas de la orden en una línea (la prometida va en la cabecera). */
function OrderDates({ order }: { order: WorkOrder }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Recibida', value: formatDateTime(order.received_at) },
    ...(order.completed_at ? [{ label: 'Terminada', value: formatDateTime(order.completed_at) }] : []),
    ...(order.delivered_at ? [{ label: 'Entregada', value: formatDateTime(order.delivered_at) }] : []),
  ]
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-4 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex gap-1.5">
          <dt className="text-fg-muted">{r.label}</dt>
          <dd className="text-fg tabular">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReadOnlyOrder({ order, showPrices }: { order: WorkOrder; showPrices: boolean }) {
  const text = (v: string | null) => (v ? <span className="whitespace-pre-line">{v}</span> : 'Sin anotar')
  return (
    <div className="space-y-10">
      <section aria-labelledby="trabajo-title">
        <SectionTitle id="trabajo-title">Trabajo</SectionTitle>
        <p className="mt-0.5 text-sm text-fg-muted">La orden está {order.status === 'delivered' ? 'entregada' : 'cancelada'}: ya no admite cambios.</p>
        <DataList
          className="mt-3 border-t border-line"
          items={[
            { label: 'Síntoma o petición', value: text(order.complaint), empty: !order.complaint },
            { label: 'Diagnóstico', value: text(order.diagnosis), empty: !order.diagnosis },
            { label: 'Prioridad', value: PRIORITY_LABEL[order.priority] },
            { label: 'Mecánico', value: order.assigned_to?.name ?? 'Sin asignar', empty: !order.assigned_to },
            { label: 'Km de entrada', value: <span className="tabular">{formatKm(order.mileage_in, { empty: 'Sin anotar' })}</span>, empty: order.mileage_in === null },
          ]}
        />
      </section>
      <section aria-labelledby="lineas-title" className="space-y-4">
        <SectionTitle id="lineas-title">Piezas y mano de obra</SectionTitle>
        <OrderLinesTable items={order.items} showPrices={showPrices} />
        <OrderTotals data={serverTotals(order)} showPrices={showPrices} className="ml-auto max-w-sm border-t border-line pt-3" />
      </section>
      <OrderDates order={order} />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Cargando la orden…</span>
      <div aria-hidden className="space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

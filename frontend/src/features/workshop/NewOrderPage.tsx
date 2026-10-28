import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronDown, ClipboardList, Info } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/client'
import { useCreateVehicle, useVehicle } from '@/api/hooks/vehicles'
import { LIVE_REFRESH_MS, useBays, useSaveCustomer, useSaveWorkOrder } from '@/api/hooks/workshop'
import { useMembers } from '@/api/hooks/workspaces'
import { LineItemsEditor } from '@/components/forms/LineItemsEditor'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input, MileageInput, Select, Textarea } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { cn } from '@/lib/cn'
import { formatKm, formatNumber } from '@/lib/format'
import { applyServerErrors } from '@/lib/forms'
import { PRIORITIES, PRIORITY_LABEL } from '@/lib/labels'
import { AFTER_SAVE } from '@/lib/navigation'
import { AssigneeField } from './components/AssigneeField'
import { BayPicker } from './components/BayPicker'
import {
  CUSTOMER_ERROR_MAP,
  customerPayload,
  NEW_ORDER_FIELD_NAMES,
  newOrderDefaults,
  newOrderSchema,
  type NewOrderValues,
  orderPayload,
  QUICK_TITLES,
  VEHICLE_ERROR_MAP,
  vehiclePayload,
} from './components/newOrderForm'
import { VehicleSection } from './components/NewOrderVehicle'
import { LiveOrderTotals } from './components/OrderTotals'
import { PromisedAtField } from './components/PromisedAtField'

type Form = UseFormReturn<NewOrderValues>

const idParam = (v: string | null) => (v && /^\d+$/.test(v) ? v : null)

const BAY_SECTION_ID = 'nueva-orden-elevador'

function scrollToBay() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(BAY_SECTION_ID)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
}

/** Abrir una orden: coche del taller (o alta rápida), qué le pasa, planificación y líneas. */
export default function NewOrderPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Nueva orden')
  const [params] = useSearchParams()
  const [preset] = useState(() => ({
    vehicleId: idParam(params.get('vehiculo')),
    customerId: idParam(params.get('cliente')),
    bay: idParam(params.get('elevador')),
  }))

  if (!ctx.isWorkshop)
    return (
      <>
        <PageHeader title="Nueva orden" />
        <EmptyState icon={<ClipboardList />} title="Las órdenes de trabajo son del modo taller" description="Cambia a un espacio de taller desde el selector de espacios para abrir órdenes." />
      </>
    )
  return <NewOrderForm preset={preset} />
}

function NewOrderForm({ preset }: { preset: { vehicleId: string | null; customerId: string | null; bay: string | null } }) {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  const createCustomer = useSaveCustomer(ctx.id)
  const createVehicle = useCreateVehicle(ctx.id)
  const createOrder = useSaveWorkOrder(ctx.id)
  const showPrices = ctx.can('manage')
  const taxRate = ctx.workspace.settings.tax_rate
  const [orphans, setOrphans] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [created, setCreated] = useState<{ customer?: string; vehicle?: string }>({})
  // «Más opciones» empieza abierto si se llega con un elevador elegido (desde el centro de control o el Taller 3D)
  const [moreWanted, setMoreOpen] = useState(!!preset.bay)

  const form = useForm<NewOrderValues>({
    resolver: zodResolver(newOrderSchema),
    defaultValues: newOrderDefaults(preset),
    mode: 'onTouched',
  })
  const { handleSubmit, formState, setError, setValue } = form
  const guard = useUnsavedChanges(formState.isDirty && !saved)
  const e = formState.errors
  const bay = useWatch({ control: form.control, name: 'bay' })

  // Un error en un campo plegado deja abierto «Más opciones» para que se vea junto a su campo
  const hiddenError = !!(e.bay || e.assigned_to || e.mileage_in || e.promised_at || e.items)
  const moreOpen = moreWanted || hiddenError
  // Los elevadores solo se piden al abrir «Más opciones» (R12)
  const bays = useBays(ctx.id, moreOpen, LIVE_REFRESH_MS)

  const onSubmit = handleSubmit(async (v) => {
    setOrphans([])
    setSaving(true)
    let stage: 'customer' | 'vehicle' | 'order' = 'order'
    try {
      let vehicleId = v.vehicle_mode === 'existing' ? Number(v.vehicle_id) : null
      if (vehicleId === null) {
        let customerId = v.customer_mode === 'existing' && v.customer_id ? Number(v.customer_id) : null
        if (v.customer_mode === 'new') {
          stage = 'customer'
          const customer = await createCustomer.mutateAsync(customerPayload(v))
          customerId = customer.id
          // Ya existe: si algo falla después, se reutiliza en vez de duplicarlo
          setValue('customer_mode', 'existing')
          setValue('customer_id', String(customer.id))
          setCreated((c) => ({ ...c, customer: customer.name }))
        }
        stage = 'vehicle'
        const vehicle = await createVehicle.mutateAsync(vehiclePayload(v, customerId))
        vehicleId = vehicle.id
        setValue('vehicle_mode', 'existing')
        setValue('vehicle_id', String(vehicle.id))
        setCreated((c) => ({ ...c, vehicle: vehicle.display_name }))
      }
      stage = 'order'
      const order = await createOrder.mutateAsync(orderPayload(v, vehicleId))
      setSaved(true)
      toast.success(`${order.number} abierta`, {
        description: order.bay ? `En el elevador ${order.bay}, estado «Recibido».` : 'En «Recibido», en la zona de espera.',
      })
      navigate(`${ctx.base}/ordenes/${order.id}`, { replace: true, state: AFTER_SAVE })
    } catch (err) {
      if (isApiError(err) && err.isConflict && stage === 'order') {
        // Elevador ocupado mientras rellenabas el formulario: se marca junto al selector y se refrescan los elevadores
        setMoreOpen(true)
        setError('bay', { type: 'server', message: `${err.message}. Elige otro o déjalo en espera.` })
        void bays.refetch()
        requestAnimationFrame(scrollToBay)
        return
      }
      if (isApiError(err) && err.isValidation) {
        const map = stage === 'customer' ? CUSTOMER_ERROR_MAP : stage === 'vehicle' ? VEHICLE_ERROR_MAP : {}
        const rest = applyServerErrors(err, setError, NEW_ORDER_FIELD_NAMES, map)
        setOrphans(rest.length || Object.keys(err.errors).length ? rest : [err.message])
        return
      }
      const what = stage === 'customer' ? 'el cliente' : stage === 'vehicle' ? 'el vehículo' : 'la orden'
      toast.error(`No se pudo crear ${what}`, { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  })

  return (
    <>
      <PageHeader back={{ to: `${ctx.base}/ordenes`, label: 'Órdenes' }} title="Nueva orden de trabajo" description="Empezará en «Recibido»." />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-10">
        <section aria-labelledby="vehiculo-title" className="space-y-4">
          <div>
            <SectionTitle id="vehiculo-title">1. Vehículo</SectionTitle>
            <p className="mt-0.5 text-sm text-fg-muted">El cliente de la orden es el del vehículo.</p>
          </div>
          <VehicleSection form={form} presetCustomerId={preset.customerId} />
        </section>

        <WorkFields form={form} />

        <section aria-labelledby="mas-opciones-title" className="space-y-5 border-t border-line pt-5">
          <h2 id="mas-opciones-title" className="text-base font-medium text-fg">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="mas-opciones"
              onClick={() => setMoreOpen(!moreOpen)}
              className="inline-flex min-h-11 items-center gap-2 rounded-control text-left hover:text-fg-warm md:min-h-9"
            >
              <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-fg-muted transition-transform duration-150 motion-reduce:transition-none', !moreOpen && '-rotate-90')} />
              Más opciones
              {!moreOpen && <span className="text-sm font-normal text-fg-muted">elevador, mecánico, km, fecha prometida y piezas</span>}
            </button>
          </h2>
          <div id="mas-opciones" hidden={!moreOpen} className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div id={BAY_SECTION_ID} className="scroll-mt-24">
                <BayPicker
                  mode="select"
                  label="Elevador"
                  description="Los ocupados no se pueden elegir. Sin elevador, el coche espera su turno."
                  bays={bays.data}
                  loading={moreOpen && bays.isPending}
                  value={bay ? Number(bay) : null}
                  onChange={(n) => setValue('bay', n === null ? '' : String(n), { shouldDirty: true, shouldValidate: true })}
                  error={e.bay?.message}
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
              <PlanningFields form={form} />
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-fg">Piezas y mano de obra</h3>
                <p className="mt-0.5 text-sm text-fg-muted">
                  {showPrices ? 'Puedes añadirlas ahora (presupuesto) o más adelante.' : 'Puedes añadirlas ahora o más adelante. Los precios los añade el propietario o el gerente.'}
                </p>
              </div>
              <LineItemsEditor form={form} showPrices={showPrices} />
              {e.items?.message && <p className="text-xs font-medium text-danger">{e.items.message}</p>}
              <LiveOrderTotals form={form} taxRate={taxRate} showPrices={showPrices} className="ml-auto max-w-sm border-t border-line pt-3" />
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {(created.customer || created.vehicle) && (
            <p role="status" className="flex items-start gap-2 text-sm text-fg">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
              <span>
                {created.vehicle ? `Ya se ha dado de alta ${created.vehicle}` : `Ya se ha creado el cliente ${created.customer}`}. Corrige lo que falta y vuelve a pulsar «Abrir orden»: no
                se duplicará.
              </span>
            </p>
          )}
          <FormErrors messages={orphans} />

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Link to={`${ctx.base}/ordenes`} className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-fg-muted hover:text-fg">
              Cancelar
            </Link>
            <Button type="submit" variant="primary" loading={saving} icon={<Check aria-hidden />}>
              Abrir orden
            </Button>
          </div>
        </div>
      </form>
      {guard}
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

function WorkFields({ form }: { form: Form }) {
  const { register, formState, setValue } = form
  const title = useWatch({ control: form.control, name: 'title' })
  const e = formState.errors
  return (
    <section aria-labelledby="que-le-pasa-title" className="space-y-4">
      <SectionTitle id="que-le-pasa-title">2. Qué le pasa</SectionTitle>
      <Field label="Título" required error={e.title?.message} hint="Es lo que verá el equipo en el tablero.">
        <Input autoComplete="off" maxLength={120} placeholder="P. ej. Ruido en la suspensión delantera" {...register('title')} />
      </Field>
      <div role="group" aria-label="Títulos frecuentes" className="-mt-1 flex flex-wrap gap-1.5">
        {QUICK_TITLES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={title === t}
            onClick={() => setValue('title', t, { shouldDirty: true, shouldValidate: formState.isSubmitted })}
            className={cn(
              'min-h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150',
              title === t ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field label="Síntoma o petición del cliente" error={e.complaint?.message} hint="Con sus palabras: cuándo pasa, desde cuándo, qué ha notado…">
          <Textarea rows={3} maxLength={5000} {...register('complaint')} />
        </Field>
        <Field label="Prioridad" error={e.priority?.message}>
          <Select {...register('priority')}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </section>
  )
}

function PlanningFields({ form }: { form: Form }) {
  const ctx = useWorkspace()
  const members = useMembers(ctx.id)
  const { register, formState, setValue } = form
  const [mode, vehicleId, mileage] = useWatch({ control: form.control, name: ['vehicle_mode', 'vehicle_id', 'mileage_in'] })
  const vehicle = useVehicle(mode === 'existing' && vehicleId ? Number(vehicleId) : undefined)
  const current = mode === 'existing' ? (vehicle.data?.current_mileage ?? null) : null
  const e = formState.errors
  return (
    <>
      <AssigneeField form={form} members={members.data} loading={members.isPending} />
      <Field
        label="Km de entrada"
        error={e.mileage_in?.message}
        hint={current !== null ? `Último registro: ${formatKm(current)}. Se guarda como lectura del vehículo.` : 'Se guarda como lectura del vehículo.'}
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
    </>
  )
}

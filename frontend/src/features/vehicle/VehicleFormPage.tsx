import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, Gauge, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/client'
import { useCreateVehicle, useUpdateVehicle, useVehicle } from '@/api/hooks/vehicles'
import { useCustomer, useCustomerSearch } from '@/api/hooks/workshop'
import type { BodyType, FuelType, Transmission, Vehicle, VehicleInput } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Field, Fieldset } from '@/components/ui/Field'
import { DateInput, Input, MileageInput, SearchInput, Select } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { searchBrands } from '@/lib/brands'
import { cn } from '@/lib/cn'
import { formatDate, parseIntegerInput } from '@/lib/format'
import { applyServerErrors } from '@/lib/forms'
import { AFTER_SAVE } from '@/lib/navigation'
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from '@/lib/labels'
import { plural } from '@/lib/text'
import { COLOR_HEX_REGEX, isFutureDate, maxVehicleYear, mileageError, normalizePlate, normalizeVin, VIN_REGEX } from '@/lib/validation'
import { CarPreview, CarSilhouette } from '@/three'

const BODY_TYPES = Object.keys(BODY_LABEL) as BodyType[]
const FUEL_TYPES = Object.keys(FUEL_LABEL) as FuelType[]
const TRANSMISSIONS = Object.keys(TRANSMISSION_LABEL) as Transmission[]

/** Colores habituales (el usuario puede elegir cualquier otro). */
const COLORS = [
  { hex: '#F2F2EF', name: 'Blanco' },
  { hex: '#15171A', name: 'Negro' },
  { hex: '#A9AEB4', name: 'Gris plata' },
  { hex: '#4B5157', name: 'Gris grafito' },
  { hex: '#C62828', name: 'Rojo' },
  { hex: '#1F4E9C', name: 'Azul' },
  { hex: '#6FA3D9', name: 'Azul claro' },
  { hex: '#2E6B45', name: 'Verde' },
  { hex: '#CDBA96', name: 'Beige' },
  { hex: '#6B4A35', name: 'Marrón' },
  { hex: '#E06A1B', name: 'Naranja' },
  { hex: '#E8C21C', name: 'Amarillo' },
]

const mileageField = z.string().superRefine((v, ctx) => {
  const e = mileageError(v)
  if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
})

const schema = z.object({
  make: z.string().trim().min(1, 'Indica la marca.').max(60, 'Máximo 60 caracteres.'),
  model: z.string().trim().min(1, 'Indica el modelo.').max(80, 'Máximo 80 caracteres.'),
  version: z.string().max(80, 'Máximo 80 caracteres.'),
  nickname: z.string().max(60, 'Máximo 60 caracteres.'),
  year: z.string().refine((v) => {
    if (!v.trim()) return true
    const n = Number(v)
    return /^\d{4}$/.test(v.trim()) && n >= 1900 && n <= maxVehicleYear()
  }, `Un año entre 1900 y ${maxVehicleYear()}.`),
  body_type: z.string(),
  color_hex: z.string().refine((v) => !v || COLOR_HEX_REGEX.test(v), 'Color no válido.'),
  fuel_type: z.string(),
  transmission: z.string(),
  engine: z.string().max(80, 'Máximo 80 caracteres.'),
  plate: z.string().refine((v) => !v.trim() || /^[A-Z0-9]{2,12}$/.test(normalizePlate(v)), 'Solo letras y números (entre 2 y 12).'),
  vin: z.string().refine((v) => !v.trim() || VIN_REGEX.test(normalizeVin(v)), 'El VIN tiene 17 caracteres, sin las letras I, O ni Q.'),
  purchase_date: z.string().refine((v) => !v || !isFutureDate(v), 'La fecha no puede ser futura.'),
  purchase_mileage: mileageField,
  current_mileage: mileageField,
  customer_id: z.string(),
})
type Values = z.infer<typeof schema>
type FieldName = keyof Values

const STEPS: { id: string; title: string; fields: FieldName[] }[] = [
  { id: 'vehiculo', title: 'Vehículo', fields: ['make', 'model', 'version', 'year', 'nickname'] },
  { id: 'aspecto', title: 'Aspecto', fields: ['body_type', 'color_hex'] },
  { id: 'detalles', title: 'Detalles', fields: ['fuel_type', 'transmission', 'engine', 'plate', 'vin', 'purchase_date', 'purchase_mileage', 'customer_id'] },
  { id: 'km', title: 'Kilometraje', fields: ['current_mileage'] },
]

function toValues(v: Vehicle | null, customerId: string): Values {
  return {
    make: v?.make ?? '',
    model: v?.model ?? '',
    version: v?.version ?? '',
    nickname: v?.nickname ?? '',
    year: v?.year ? String(v.year) : '',
    body_type: v?.body_type ?? '',
    color_hex: v?.color_hex ?? '',
    fuel_type: v?.fuel_type ?? '',
    transmission: v?.transmission ?? '',
    engine: v?.engine ?? '',
    plate: v?.plate ?? '',
    vin: v?.vin ?? '',
    purchase_date: v?.purchase_date ?? '',
    purchase_mileage: v?.purchase_mileage != null ? String(v.purchase_mileage) : '',
    current_mileage: '',
    customer_id: v ? (v.customer ? String(v.customer.id) : '') : customerId,
  }
}

export default function VehicleFormPage() {
  const { vehicleId } = useParams()
  const id = vehicleId ? Number(vehicleId) : undefined
  const query = useVehicle(id)
  useDocumentTitle(id ? 'Editar vehículo' : 'Añadir vehículo')

  if (id && query.isPending)
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Cargando vehículo…</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-hero" />
      </div>
    )
  if (id && (query.isError || !query.data)) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  return <VehicleForm key={query.data?.id ?? 'nuevo'} vehicle={query.data ?? null} />
}

function VehicleForm({ vehicle }: { vehicle: Vehicle | null }) {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isEdit = !!vehicle
  const create = useCreateVehicle(ctx.id)
  const update = useUpdateVehicle(vehicle?.id ?? 0)
  const mutation = isEdit ? update : create
  const [step, setStep] = useState(0)
  const [orphans, setOrphans] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const steps = isEdit ? STEPS.slice(0, 3) : STEPS

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(vehicle, ctx.isWorkshop ? (params.get('cliente') ?? '') : ''),
    mode: 'onTouched',
  })
  const { handleSubmit, formState, trigger, setError } = form
  const blockerDialog = useUnsavedChanges(formState.isDirty && !saved)
  const [bodyType, colorHex, make, model] = useWatch({ control: form.control, name: ['body_type', 'color_hex', 'make', 'model'] })
  const appearance = { bodyType: (bodyType || null) as BodyType | null, colorHex: COLOR_HEX_REGEX.test(colorHex) ? colorHex : null }

  const goTo = async (next: number) => {
    if (next > step) {
      const ok = await trigger(steps[step].fields)
      if (!ok) return
    }
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    const payload: VehicleInput = {
      make: v.make.trim(),
      model: v.model.trim(),
      version: v.version.trim() || null,
      nickname: v.nickname.trim() || null,
      year: v.year.trim() ? Number(v.year) : null,
      body_type: (v.body_type || null) as BodyType | null,
      color_hex: v.color_hex ? v.color_hex.toUpperCase() : null,
      fuel_type: (v.fuel_type || null) as FuelType | null,
      transmission: (v.transmission || null) as Transmission | null,
      engine: v.engine.trim() || null,
      plate: normalizePlate(v.plate) || null,
      vin: normalizeVin(v.vin) || null,
      purchase_date: v.purchase_date || null,
      purchase_mileage: parseIntegerInput(v.purchase_mileage),
      ...(isEdit ? {} : { current_mileage: parseIntegerInput(v.current_mileage) }),
      ...(ctx.isWorkshop ? { customer_id: v.customer_id ? Number(v.customer_id) : null } : {}),
    }
    mutation.mutate(payload, {
      onSuccess: (saved) => {
        setSaved(true)
        toast.success(isEdit ? 'Cambios guardados' : `${saved.display_name} ya está en tu ${ctx.isWorkshop ? 'taller' : 'garaje'}`)
        navigate(`${ctx.base}/vehiculos/${saved.id}`, { replace: true, state: AFTER_SAVE })
      },
      onError: (err) => {
        if (isApiError(err) && err.status === 422) {
          const rest = applyServerErrors(err, setError, Object.keys(schema.shape))
          setOrphans(rest)
          // Llevar al primer paso con error
          const firstField = Object.keys(err.errors)[0]
          const idx = steps.findIndex((s) => s.fields.includes(firstField as FieldName))
          if (!isEdit && idx >= 0) setStep(idx)
          return
        }
        setOrphans([err.message])
      },
    })
  })

  const last = step === steps.length - 1
  const backTo = vehicle ? `${ctx.base}/vehiculos/${vehicle.id}` : `${ctx.base}/garaje`

  return (
    <>
      <PageHeader
        back={{ to: backTo, label: vehicle ? vehicle.display_name : ctx.isWorkshop ? 'Vehículos' : 'Garaje' }}
        title={isEdit ? 'Editar vehículo' : 'Añadir vehículo'}
        description={isEdit ? 'Cambia sus datos y su aspecto. El kilometraje se actualiza desde la ficha.' : 'En cuatro pasos. Solo la marca y el modelo son obligatorios.'}
      />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
        <div className="min-w-0 space-y-6">
          {!isEdit && <Stepper steps={steps.map((s) => s.title)} current={step} onGo={(i) => i < step && setStep(i)} />}

          {(isEdit || step === 0) && <StepVehicle form={form} />}
          {(isEdit || step === 1) && <StepLook form={form} />}
          {(isEdit || step === 2) && <StepDetails form={form} />}
          {!isEdit && step === 3 && <StepMileage form={form} />}

          <FormErrors messages={orphans} />

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center">
            {isEdit ? (
              <Link to={backTo} className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-fg-muted hover:text-fg">
                Cancelar
              </Link>
            ) : step > 0 ? (
              <Button icon={<ArrowLeft aria-hidden />} onClick={() => void goTo(step - 1)}>
                Atrás
              </Button>
            ) : (
              <Link to={backTo} className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-fg-muted hover:text-fg">
                Cancelar
              </Link>
            )}
            <div className="flex-1" />
            {!isEdit && !last && step > 0 && (
              <Button variant="ghost" onClick={() => void goTo(step + 1)}>
                Saltar este paso
              </Button>
            )}
            {isEdit || last ? (
              <Button type="submit" variant="primary" loading={mutation.isPending} icon={<Check aria-hidden />}>
                {isEdit ? 'Guardar cambios' : 'Añadir vehículo'}
              </Button>
            ) : (
              <Button variant="primary" iconRight={<ArrowRight aria-hidden />} onClick={() => void goTo(step + 1)}>
                Siguiente
              </Button>
            )}
          </div>
        </div>

        <aside className="order-first lg:order-none lg:sticky lg:top-24" aria-label="Vista previa">
          <div className="overflow-hidden rounded-hero border border-line bg-gradient-to-b from-surface-2 to-surface">
            <div className={cn('relative', isEdit || step === 1 ? 'h-56 sm:h-72' : 'h-40 sm:h-56 lg:h-72')}>
              <CarPreview appearance={appearance} className="absolute inset-0 h-full w-full" />
            </div>
            <div className="border-t border-line px-4 py-3">
              <p className="truncate font-display text-lg font-semibold text-fg-warm">{[make, model].filter((s) => s.trim()).join(' ') || 'Tu vehículo'}</p>
              <p className="text-xs text-fg-subtle">
                {appearance.bodyType ? BODY_LABEL[appearance.bodyType] : 'Carrocería sin indicar'} · Modelo ilustrativo, no reproduce la marca
              </p>
            </div>
          </div>
        </aside>
      </form>
      {blockerDialog}
    </>
  )
}

function Stepper({ steps, current, onGo }: { steps: string[]; current: number; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Pasos">
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((title, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={title}>
              <button
                type="button"
                onClick={() => onGo(i)}
                disabled={!done}
                aria-current={active ? 'step' : undefined}
                className="flex w-full flex-col gap-2 text-left disabled:cursor-default"
              >
                <span aria-hidden className={cn('h-1 rounded-full transition-colors', done || active ? 'bg-accent' : 'bg-surface-3')} />
                <span className={cn('flex items-center gap-1.5 text-xs font-medium', active ? 'text-fg' : done ? 'text-fg-muted' : 'text-fg-subtle')}>
                  {done && <Check aria-hidden className="size-3.5 text-accent-ink" />}
                  <span className="sr-only">Paso {i + 1}: </span>
                  {title}
                  {done && <span className="sr-only"> (completado)</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StepVehicle({ form }: { form: UseFormReturn<Values> }) {
  const { register, formState, setValue } = form
  const make = useWatch({ control: form.control, name: 'make' })
  const suggestions = useMemo(() => searchBrands(make, 10), [make])
  const exact = suggestions.some((b) => b.toLowerCase() === make.trim().toLowerCase())
  const e = formState.errors
  return (
    <Fieldset legend="¿Qué vehículo es?" description="Escribe la marca o elige una de la lista.">
      <Field label="Marca" required error={e.make?.message}>
        <Input autoComplete="off" maxLength={60} placeholder="P. ej. Seat" {...register('make')} />
      </Field>
      {!exact && (
        <div role="group" aria-label="Sugerencias de marca" className="-mt-1 flex flex-wrap gap-1.5">
          {suggestions.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setValue('make', b, { shouldDirty: true, shouldValidate: true })}
              className="min-h-9 rounded-full border border-line bg-surface-2 px-3 text-sm text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {b}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Modelo" required error={e.model?.message}>
          <Input autoComplete="off" maxLength={80} placeholder="P. ej. Ibiza" {...register('model')} />
        </Field>
        <Field label="Versión" error={e.version?.message} hint="Opcional. P. ej. 1.0 TSI FR">
          <Input autoComplete="off" maxLength={80} {...register('version')} />
        </Field>
        <Field label="Año" error={e.year?.message}>
          <Input inputMode="numeric" maxLength={4} className="tabular" placeholder={String(new Date().getFullYear())} {...register('year')} />
        </Field>
        <Field label="Apodo" error={e.nickname?.message} hint="Opcional. Así lo verás en la app: «El rojo», «La furgo»…">
          <Input autoComplete="off" maxLength={60} {...register('nickname')} />
        </Field>
      </div>
    </Fieldset>
  )
}

function StepLook({ form }: { form: UseFormReturn<Values> }) {
  const { setValue, formState } = form
  const [bodyType, colorHex] = useWatch({ control: form.control, name: ['body_type', 'color_hex'] })
  const set = (name: 'body_type' | 'color_hex', value: string) => setValue(name, value, { shouldDirty: true, shouldValidate: true })
  return (
    <>
      <Fieldset legend="Carrocería" description="Decide la forma del modelo 3D y de la silueta.">
        <div role="radiogroup" aria-label="Carrocería" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BODY_TYPES.map((b) => {
            const checked = bodyType === b
            return (
              <label
                key={b}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1 rounded-card border p-2 text-sm font-medium transition-colors',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                  checked ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                <input type="radio" name="body_type" value={b} checked={checked} onChange={() => set('body_type', b)} className="sr-only" />
                <CarSilhouette appearance={{ bodyType: b, colorHex: colorHex && COLOR_HEX_REGEX.test(colorHex) ? colorHex : null }} className="h-14 w-full" />
                {BODY_LABEL[b]}
              </label>
            )
          })}
        </div>
      </Fieldset>

      <Fieldset legend="Color">
        <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
          {COLORS.map((c) => {
            const checked = colorHex.toUpperCase() === c.hex.toUpperCase()
            return (
              <label key={c.hex} className="group relative cursor-pointer" title={c.name}>
                <input type="radio" name="color_hex" value={c.hex} checked={checked} onChange={() => set('color_hex', c.hex)} className="peer sr-only" />
                <span
                  aria-hidden
                  className={cn(
                    'grid size-11 place-items-center rounded-full border-2 transition-transform peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                    checked ? 'scale-105 border-accent' : 'border-line-strong group-hover:scale-105',
                  )}
                  style={{ backgroundColor: c.hex }}
                >
                  {checked && <Check className="size-4 text-white mix-blend-difference" strokeWidth={3} />}
                </span>
                <span className="sr-only">{c.name}</span>
              </label>
            )
          })}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 text-sm text-fg-muted hover:text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
            <input
              type="color"
              value={COLOR_HEX_REGEX.test(colorHex) ? colorHex : '#888888'}
              onChange={(e) => set('color_hex', e.target.value.toUpperCase())}
              className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Otro color"
            />
            Otro
          </label>
          {colorHex && (
            <button type="button" onClick={() => set('color_hex', '')} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm text-fg-subtle hover:text-fg">
              <X aria-hidden className="size-4" />
              Sin color
            </button>
          )}
        </div>
        {formState.errors.color_hex && <p className="text-xs font-medium text-danger">{formState.errors.color_hex.message}</p>}
      </Fieldset>
    </>
  )
}

function StepDetails({ form }: { form: UseFormReturn<Values> }) {
  const ctx = useWorkspace()
  const { register, formState } = form
  const e = formState.errors
  return (
    <>
      {ctx.isWorkshop && <CustomerPicker form={form} />}
      <Fieldset legend="Identificación" description="Opcional, pero útil para encontrarlo y para el informe.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matrícula" error={e.plate?.message} hint="Se guarda en mayúsculas y sin espacios.">
            <Input autoComplete="off" className="font-mono uppercase tracking-wider" maxLength={15} {...register('plate')} />
          </Field>
          <Field label="Número de bastidor (VIN)" error={e.vin?.message}>
            <Input autoComplete="off" className="font-mono uppercase" maxLength={20} {...register('vin')} />
          </Field>
        </div>
      </Fieldset>
      <Fieldset legend="Mecánica">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Combustible">
            <Select {...register('fuel_type')}>
              <option value="">Sin indicar</option>
              {FUEL_TYPES.map((f) => (
                <option key={f} value={f}>
                  {FUEL_LABEL[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cambio">
            <Select {...register('transmission')}>
              <option value="">Sin indicar</option>
              {TRANSMISSIONS.map((t) => (
                <option key={t} value={t}>
                  {TRANSMISSION_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Motor" error={e.engine?.message} hint="P. ej. 1.6 TDI 115 CV">
            <Input autoComplete="off" maxLength={80} {...register('engine')} />
          </Field>
        </div>
      </Fieldset>
      <Fieldset legend="Compra">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de compra" error={e.purchase_date?.message}>
            <DateInput allowFuture={false} {...register('purchase_date')} />
          </Field>
          <Field label="Kilómetros al comprarlo" error={e.purchase_mileage?.message}>
            <MileageInput {...register('purchase_mileage')} />
          </Field>
        </div>
      </Fieldset>
    </>
  )
}

function StepMileage({ form }: { form: UseFormReturn<Values> }) {
  const { register, formState } = form
  return (
    <Fieldset legend="¿Cuántos kilómetros marca hoy?" description="Será su primera lectura de kilometraje. Puedes dejarlo para más tarde.">
      <Field label="Kilómetros actuales" error={formState.errors.current_mileage?.message} hint={`Lectura con fecha de hoy, ${formatDate(new Date().toISOString().slice(0, 10), 'long')}.`}>
        <MileageInput autoFocus {...register('current_mileage')} />
      </Field>
      <p className="flex items-start gap-2 rounded-card border border-line bg-surface-2/50 p-3 text-sm text-fg-muted">
        <Gauge aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
        Con lecturas periódicas CarCare calcula los km del mes, la media diaria y el coste por km. Sin ellas, te dirá qué falta en lugar de inventar cifras.
      </p>
    </Fieldset>
  )
}

function CustomerPicker({ form }: { form: UseFormReturn<Values> }) {
  const ctx = useWorkspace()
  const customerId = useWatch({ control: form.control, name: 'customer_id' })
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(term)
  const selected = useCustomer(customerId ? Number(customerId) : undefined)
  const results = useCustomerSearch(ctx.id, debounced, open)
  const error = form.formState.errors.customer_id?.message

  const choose = (id: string) => {
    form.setValue('customer_id', id, { shouldDirty: true, shouldValidate: true })
    setOpen(false)
    setTerm('')
  }

  useEffect(() => {
    if (!customerId) setOpen(true)
  }, [customerId])

  return (
    <Fieldset legend="Cliente" description="A quién pertenece el vehículo. Puedes asignarlo más tarde.">
      {customerId && !open ? (
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
          <UserRound aria-hidden className="size-5 text-fg-subtle" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-fg">{selected.data?.name ?? 'Cargando cliente…'}</p>
            {selected.data?.phone && <p className="text-xs text-fg-muted">{selected.data.phone}</p>}
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            Cambiar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => choose('')}>
            Quitar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <SearchInput value={term} onValueChange={setTerm} aria-label="Buscar cliente por nombre, email, teléfono o NIF" placeholder="Buscar cliente…" />
          <div role="radiogroup" aria-label="Clientes" className="max-h-60 overflow-y-auto rounded-card border border-line">
            {results.isPending ? (
              <p className="p-3 text-sm text-fg-muted">Buscando…</p>
            ) : results.isError ? (
              <p className="p-3 text-sm text-danger">No se pudo buscar. {results.error.message}</p>
            ) : results.data.data.length === 0 ? (
              <p className="p-3 text-sm text-fg-muted">
                Sin coincidencias.{' '}
                <Link to={`${ctx.base}/clientes?nuevo=1`} className="font-medium text-accent-ink hover:underline">
                  Crear cliente
                </Link>
              </p>
            ) : (
              results.data.data.map((c) => (
                <label key={c.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-2 has-[:focus-visible]:bg-surface-2">
                  <input type="radio" name="customer-pick" value={c.id} checked={customerId === String(c.id)} onChange={() => choose(String(c.id))} className="size-4 accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                    <span className="block truncate text-xs text-fg-subtle">{[c.phone, c.email, plural(c.vehicles_count, 'vehículo', 'vehículos')].filter(Boolean).join(' · ')}</span>
                  </span>
                </label>
              ))
            )}
          </div>
          {customerId && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Mantener el cliente actual
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </Fieldset>
  )
}


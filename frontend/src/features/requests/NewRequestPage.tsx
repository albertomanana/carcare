import { zodResolver } from '@hookform/resolvers/zod'
import { Car, Store } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { errorMessage, isApiError } from '@/api/client'
import { useCreateRepairRequest, useDirectory, useDirectoryWorkshop } from '@/api/hooks/repairRequests'
import { useVehicles } from '@/api/hooks/vehicles'
import type { DirectoryWorkshop, Vehicle, Zone } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, Fieldset } from '@/components/ui/Field'
import { DateInput, Input, MileageInput, Select, Textarea } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam } from '@/hooks/useSearchParam'
import { addDays, formatKm, formatNumber, parseIntegerInput, todayISO, toISODate } from '@/lib/format'
import { applyServerErrors } from '@/lib/forms'
import { ZONE_LABEL, ZONES } from '@/lib/labels'
import { mileageError } from '@/lib/validation'
import { consentText, SHARE_HISTORY_TEXT, vehicleCopyFacts } from './requestStatus'

/** Mismo formato que el teléfono del directorio (§3.13.2). */
const PHONE_REGEX = /^[0-9 +()-]{6,30}$/
const MAX_DAYS_AHEAD = 180

function maxPreferredDate() {
  return toISODate(addDays(new Date(), MAX_DAYS_AHEAD))
}

const schema = z.object({
  vehicle_id: z.string().min(1, 'Elige el coche.'),
  workshop_id: z.string().min(1, 'Elige el taller.'),
  title: z.string().trim().min(3, 'Escribe al menos 3 caracteres.').max(120, 'Máximo 120 caracteres.'),
  description: z.string().trim().min(10, 'Cuéntalo con al menos 10 caracteres.').max(2000, 'Máximo 2.000 caracteres.'),
  zone: z.string(),
  preferred_date: z
    .string()
    .min(1, 'Elige una fecha.')
    .refine((v) => v >= todayISO(), 'La fecha no puede ser anterior a hoy.')
    .refine((v) => v <= maxPreferredDate(), `Como mucho dentro de ${MAX_DAYS_AHEAD} días.`),
  mileage: z.string().superRefine((v, ctx) => {
    const e = mileageError(v, { required: true })
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
  }),
  contact_phone: z
    .string()
    .trim()
    .refine((v) => !v || PHONE_REGEX.test(v), 'Solo números, espacios y + ( ) -, entre 6 y 30 caracteres.'),
  share_history: z.boolean(),
})
type Values = z.infer<typeof schema>
const FIELDS = ['vehicle_id', 'workshop_id', 'title', 'description', 'zone', 'preferred_date', 'mileage', 'contact_phone', 'share_history'] as const

/**
 * E16‑3 · Nueva solicitud de reparación (`/solicitudes/nueva?taller={id}&vehiculo={id}`).
 * Antes de enviar se ve el texto de consentimiento literal de §3.13.7 con el nombre del taller y la casilla
 * "Compartir historial" desmarcada. Los km no crean una lectura en el garaje: son un dato para el taller.
 */
export default function NewRequestPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Nueva solicitud')
  const [tallerParam] = useSearchParam('taller')
  const [vehiculoParam] = useSearchParam('vehiculo')
  const vehicles = useVehicles(ctx.id, { archived: 0, per_page: 100 })
  const directory = useDirectory({ per_page: 50 })
  const presetId = Number(tallerParam) || undefined
  const inList = !!presetId && !!directory.data?.data.some((w) => w.id === presetId)
  const preset = useDirectoryWorkshop(presetId && directory.isSuccess && !inList ? presetId : undefined)

  const back = { to: `${ctx.base}/solicitudes`, label: 'Solicitudes' }
  const header = <PageHeader title="Pedir una reparación" back={back} />

  if (!ctx.isPersonal || !ctx.can('own')) {
    return (
      <>
        {header}
        <EmptyState icon={<Store />} title="Solo el titular del espacio personal puede enviar solicitudes" />
      </>
    )
  }

  if (vehicles.isPending || directory.isPending || preset.isFetching) {
    return (
      <>
        {header}
        <FormSkeleton />
      </>
    )
  }
  if (vehicles.isError || directory.isError) {
    const error = vehicles.error ?? directory.error
    return (
      <>
        {header}
        <ErrorState
          error={error}
          onRetry={() => {
            void vehicles.refetch()
            void directory.refetch()
          }}
        />
      </>
    )
  }

  const myVehicles = vehicles.data.data.filter((v) => !v.archived_at)
  const workshops = [...directory.data.data, ...(preset.data && !inList ? [preset.data] : [])].filter((w) => !w.is_member)

  if (myVehicles.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<Car />}
          title="Primero añade tu coche"
          description="La solicitud lleva los datos de un coche de tu garaje: marca, modelo, año, combustible, carrocería, color y matrícula."
          action={
            <ButtonLink to={`${ctx.base}/vehiculos/nuevo`} variant="primary">
              Añadir coche
            </ButtonLink>
          }
        />
      </>
    )
  }
  if (workshops.length === 0) {
    return (
      <>
        {header}
        <EmptyState icon={<Store />} title="Todavía no hay talleres en el directorio" description="Cuando un taller de CarCare se publique, podrás pedirle una reparación desde aquí." />
      </>
    )
  }

  const presetVehicle = myVehicles.find((v) => String(v.id) === vehiculoParam)
  const presetWorkshop = workshops.find((w) => w.id === presetId)
  return (
    <>
      {header}
      {presetId && !presetWorkshop && (
        <p role="status" className="mb-4 text-sm text-fg-muted">
          Ese taller ya no está en el directorio. Elige otro de la lista.
        </p>
      )}
      <RequestForm vehicles={myVehicles} workshops={workshops} initialVehicle={presetVehicle ?? (myVehicles.length === 1 ? myVehicles[0] : undefined)} initialWorkshop={presetWorkshop} />
    </>
  )
}

function RequestForm({
  vehicles,
  workshops,
  initialVehicle,
  initialWorkshop,
}: {
  vehicles: Vehicle[]
  workshops: DirectoryWorkshop[]
  initialVehicle?: Vehicle
  initialWorkshop?: DirectoryWorkshop
}) {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  const mutation = useCreateRepairRequest(ctx.id)
  const [orphans, setOrphans] = useState<string[]>([])
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_id: initialVehicle ? String(initialVehicle.id) : '',
      workshop_id: initialWorkshop ? String(initialWorkshop.id) : '',
      title: '',
      description: '',
      zone: '',
      preferred_date: '',
      mileage: initialVehicle?.current_mileage != null ? String(initialVehicle.current_mileage) : '',
      contact_phone: '',
      share_history: false,
    },
  })
  const { register, handleSubmit, formState, setError, setValue, control } = form
  const [vehicleId, workshopId] = useWatch({ control, name: ['vehicle_id', 'workshop_id'] })
  const vehicle = useMemo(() => vehicles.find((v) => String(v.id) === vehicleId), [vehicles, vehicleId])
  const workshop = useMemo(() => workshops.find((w) => String(w.id) === workshopId), [workshops, workshopId])
  const vehicleField = register('vehicle_id')

  const onSubmit = handleSubmit((values) => {
    setOrphans([])
    const mileage = parseIntegerInput(values.mileage) ?? 0
    if (vehicle?.current_mileage != null && mileage < vehicle.current_mileage) {
      setError('mileage', { type: 'client', message: `No puede ser menor que el último kilometraje anotado (${formatKm(vehicle.current_mileage)}).` }, { shouldFocus: true })
      return
    }
    mutation.mutate(
      {
        vehicle_id: Number(values.vehicle_id),
        workshop_id: Number(values.workshop_id),
        title: values.title.trim(),
        description: values.description.trim(),
        zone: (values.zone || null) as Zone | null,
        preferred_date: values.preferred_date,
        mileage,
        contact_phone: values.contact_phone.trim() || null,
        share_history: values.share_history,
      },
      {
        onSuccess: (request) => {
          toast.success(`Solicitud enviada a ${request.workshop.name}`)
          navigate(`${ctx.base}/solicitudes/${request.id}`, { replace: true })
        },
        onError: (err) => {
          // 422 ⇒ junto a cada campo; 409 (ya hay una abierta) y 429 (5 en 24 h) ⇒ aviso sobre el botón. Lo escrito se conserva.
          if (isApiError(err) && err.status === 422) {
            const rest = applyServerErrors(err, setError, FIELDS)
            setOrphans(rest)
            return
          }
          setOrphans([errorMessage(err)])
        },
      },
    )
  })

  const workshopName = workshop?.name ?? 'El taller'

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl space-y-10">
      <Fieldset legend="Coche y taller">
        <Field
          label="Coche"
          required
          error={formState.errors.vehicle_id?.message}
          hint={vehicle ? `El taller verá: ${vehicleCopyFacts(vehicle).join(' · ')}` : undefined}
        >
          <Select
            {...vehicleField}
            onChange={(e) => {
              void vehicleField.onChange(e)
              const v = vehicles.find((x) => String(x.id) === e.target.value)
              setValue('mileage', v?.current_mileage != null ? String(v.current_mileage) : '', { shouldValidate: false })
            }}
            placeholder="Elige un coche"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.display_name}
                {v.plate ? ` · ${v.plate}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Taller"
          required
          error={formState.errors.workshop_id?.message}
          hint={workshop ? [workshop.city, workshop.address].filter(Boolean).join(' · ') : 'Solo talleres del directorio de CarCare.'}
        >
          <Select {...register('workshop_id')} placeholder="Elige un taller">
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.city}
              </option>
            ))}
          </Select>
        </Field>
      </Fieldset>

      <Fieldset legend="Qué le pasa">
        <Field label="Asunto" required error={formState.errors.title?.message} hint="Una frase corta. Será el título de la orden si aceptas el presupuesto.">
          <Input {...register('title')} maxLength={120} placeholder="Ruido al frenar" autoComplete="off" />
        </Field>
        <Field label="Descripción" required error={formState.errors.description?.message} hint="Cuándo pasa, desde cuándo y cualquier detalle que ayude al taller.">
          <Textarea {...register('description')} rows={5} maxLength={2000} />
        </Field>
        <Field label="Zona del coche" error={formState.errors.zone?.message} hint="Opcional.">
          <Select {...register('zone')} placeholder="Sin zona concreta">
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_LABEL[z]}
              </option>
            ))}
          </Select>
        </Field>
      </Fieldset>

      <Fieldset legend="Cuándo y cómo contactarte">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha preferida" required error={formState.errors.preferred_date?.message} hint={`Desde hoy hasta dentro de ${MAX_DAYS_AHEAD} días.`}>
            <DateInput {...register('preferred_date')} min={todayISO()} max={maxPreferredDate()} />
          </Field>
          <Field
            label="Kilómetros actuales"
            required
            error={formState.errors.mileage?.message}
            hint={
              vehicle?.current_mileage != null
                ? `Último anotado: ${formatNumber(vehicle.current_mileage)} km. No se guarda en tu garaje.`
                : 'Para el taller. No se guarda en tu garaje.'
            }
          >
            <MileageInput {...register('mileage')} />
          </Field>
        </div>
        <Field label="Teléfono de contacto" error={formState.errors.contact_phone?.message} hint="Opcional. Para que el taller pueda llamarte.">
          <Input {...register('contact_phone')} type="tel" autoComplete="tel" maxLength={30} className="sm:max-w-xs" />
        </Field>
      </Fieldset>

      <Fieldset legend="Qué verá el taller">
        <p className="text-sm text-fg">{consentText(workshopName)}</p>
        <Checkbox {...register('share_history')} label={SHARE_HISTORY_TEXT} />
      </Fieldset>

      <div className="space-y-4">
        <FormErrors messages={orphans} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            Enviar solicitud
          </Button>
          <ButtonLink to={`${ctx.base}/solicitudes`} variant="ghost">
            Cancelar
          </ButtonLink>
        </div>
      </div>
    </form>
  )
}

function FormSkeleton() {
  return (
    <div role="status" aria-live="polite" className="max-w-2xl space-y-6">
      <span className="sr-only">Cargando el formulario…</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  )
}

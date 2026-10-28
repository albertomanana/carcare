import { zodResolver } from '@hookform/resolvers/zod'
import {
  Archive,
  Battery,
  Calculator,
  Check,
  CircleDot,
  CircleEllipsis,
  ClipboardCheck,
  Cog,
  Disc3,
  Droplets,
  Filter,
  Info,
  Lock,
  type LucideIcon,
  Snowflake,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useMaintenanceList, useRecord, useSaveRecord } from '@/api/hooks/records'
import { flattenPages } from '@/api/hooks/shared'
import { useVehicle } from '@/api/hooks/vehicles'
import type { MaintenanceInput, MaintenanceRecord, RecordType, ServiceKind, Vehicle, Zone } from '@/api/types'
import { LineItemsEditor, lineItemSchema, lineToForm, formToLine, MAX_ITEMS } from '@/components/forms/LineItemsEditor'
import { FormErrors, MileageConflictNotice } from '@/components/forms/MileageConflictNotice'
import { Plate } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Fieldset } from '@/components/ui/Field'
import { DateInput, Input, MileageInput, MoneyInput, Select, Textarea } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { VehicleThumb } from '@/components/vehicles/VehicleVisuals'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { cn } from '@/lib/cn'
import { formatDate, formatKm, formatMoney, formatNumber, moneyToInput, parseIntegerInput, todayISO, toMoneyString } from '@/lib/format'
import { handleFormError, isMileageConflict } from '@/lib/forms'
import { EXPENSE_CATEGORY_LABEL, RECORD_TYPE_LABEL, SERVICE_KIND_LABEL, ZONE_LABEL, ZONES } from '@/lib/labels'
import { centsToMoney, effectiveTotalCents, splitLines, sumLines, toCents } from '@/lib/lineItems'
import { linkedExpenseCategory, matchQuickService, quickServiceFromParam } from '@/lib/maintenance'
import { AFTER_SAVE } from '@/lib/navigation'
import { QUICK_SERVICES, type QuickService } from '@/lib/quickServices'
import { plural } from '@/lib/text'
import { amountError, isFutureDate, mileageError } from '@/lib/validation'

const RECORD_TYPES = Object.keys(RECORD_TYPE_LABEL) as RecordType[]
const SERVICE_KINDS = Object.keys(SERVICE_KIND_LABEL) as ServiceKind[]

const QUICK_ICON: Record<string, LucideIcon> = {
  oil: Droplets,
  service: Wrench,
  itv: ClipboardCheck,
  tyres: CircleDot,
  brakes: Disc3,
  battery: Battery,
  timing: Cog,
  filters: Filter,
  ac: Snowflake,
  breakdown: TriangleAlert,
  other: CircleEllipsis,
}

const moneyField = z.string().superRefine((v, ctx) => {
  const e = amountError(v)
  if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
})

const schema = z.object({
  type: z.enum(RECORD_TYPES as [RecordType, ...RecordType[]]),
  zone: z.enum(ZONES as [Zone, ...Zone[]]),
  service_kind: z.string(),
  title: z.string().trim().min(2, 'Escribe un título de al menos 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
  description: z.string().max(5000, 'Máximo 5.000 caracteres.'),
  service_date: z
    .string()
    .min(1, 'Indica la fecha.')
    .refine((v) => !isFutureDate(v), 'La fecha no puede ser futura.'),
  mileage: z.string().superRefine((v, ctx) => {
    const e = mileageError(v)
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
  }),
  workshop_name: z.string().max(120, 'Máximo 120 caracteres.'),
  parts_cost: moneyField,
  labor_cost: moneyField,
  total_cost: moneyField,
  items: z.array(lineItemSchema).max(MAX_ITEMS, `Máximo ${MAX_ITEMS} líneas.`),
})
type Values = z.infer<typeof schema>
const FIELDS = Object.keys(schema.shape)

function toValues(record: MaintenanceRecord | null, quick: QuickService | null): Values {
  if (record) {
    return {
      type: record.type,
      zone: record.zone,
      service_kind: record.service_kind ?? '',
      title: record.title,
      description: record.description ?? '',
      service_date: record.service_date,
      mileage: record.mileage !== null ? formatNumber(record.mileage) : '',
      workshop_name: record.workshop_name ?? '',
      parts_cost: moneyToInput(record.parts_cost),
      labor_cost: moneyToInput(record.labor_cost),
      total_cost: moneyToInput(record.total_cost),
      items: record.items.map(lineToForm),
    }
  }
  return {
    type: quick?.type ?? 'maintenance',
    zone: quick?.zone ?? 'general',
    service_kind: quick?.service_kind ?? '',
    title: quick?.title ?? '',
    description: '',
    service_date: todayISO(),
    mileage: '',
    workshop_name: '',
    parts_cost: '',
    labor_cost: '',
    total_cost: '',
    items: [],
  }
}

/** Alta y edición de intervenciones (mantenimiento, reparación, avería, ITV…). */
export default function MaintenanceFormPage() {
  const ctx = useWorkspace()
  const { vehicleId, recordId } = useParams()
  const vId = Number(vehicleId)
  const rId = recordId ? Number(recordId) : undefined
  const vehicleQ = useVehicle(Number.isFinite(vId) ? vId : undefined)
  const recordQ = useRecord(rId)
  useDocumentTitle(rId ? 'Editar intervención' : 'Nueva intervención')

  if (vehicleQ.isPending || (rId !== undefined && recordQ.isPending)) return <FormSkeleton />
  if (vehicleQ.isError || !vehicleQ.data) return <ErrorState error={vehicleQ.error} onRetry={() => void vehicleQ.refetch()} className="mt-6" />
  if (rId !== undefined && (recordQ.isError || !recordQ.data)) return <ErrorState error={recordQ.error} onRetry={() => void recordQ.refetch()} className="mt-6" />

  const vehicle = vehicleQ.data
  const record = rId !== undefined ? (recordQ.data ?? null) : null
  const history = `${ctx.base}/vehiculos/${vehicle.id}/historial`
  if (vehicle.workspace_id !== ctx.id || (record && record.vehicle_id !== vehicle.id))
    return <ErrorState title="Esta intervención no pertenece a este vehículo" className="mt-6" />

  const blocked = !ctx.can('operate')
    ? { icon: <Lock />, title: 'Tu rol no permite registrar intervenciones', description: 'Pide a quien gestiona este espacio que te dé permiso.' }
    : vehicle.archived_at
      ? { icon: <Archive />, title: 'Vehículo archivado', description: 'Restáuralo desde su ficha para registrar o editar intervenciones.' }
      : record?.work_order_id
        ? { icon: <Lock />, title: 'Viene de una orden de trabajo', description: 'Se creó al entregar la orden y se conserva tal cual. Los cambios se hacen en la orden.' }
        : record?.archived_at
          ? { icon: <Archive />, title: 'Intervención archivada', description: 'Restáurala desde el historial para poder editarla.' }
          : null

  if (blocked)
    return (
      <>
        <PageHeader back={{ to: history, label: vehicle.display_name }} title={record ? 'Editar intervención' : 'Nueva intervención'} />
        <EmptyState
          icon={blocked.icon}
          title={blocked.title}
          description={blocked.description}
          action={
            <ButtonLink to={history} variant="secondary">
              Volver al historial
            </ButtonLink>
          }
        />
      </>
    )

  return <MaintenanceForm key={record?.id ?? 'nueva'} vehicle={vehicle} record={record} />
}

function MaintenanceForm({ vehicle, record }: { vehicle: Vehicle; record: MaintenanceRecord | null }) {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isEdit = !!record
  const save = useSaveRecord(vehicle.id, record?.id)
  const showPrices = ctx.isPersonal || ctx.canExpenses
  const [orphans, setOrphans] = useState<string[]>([])
  const [conflict, setConflict] = useState<string | null>(null)
  const [confirmDrop, setConfirmDrop] = useState(false)
  const [saved, setSaved] = useState(false)
  const conflictRef = useRef<HTMLDivElement>(null)
  const [initialQuick] = useState(() => (record ? null : quickServiceFromParam(params.get('servicio'))))
  // Último título puesto por un chip: si el usuario no lo ha cambiado, otro chip lo puede reemplazar
  const autoTitle = useRef<string>(initialQuick?.title ?? '')

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(record, initialQuick),
    mode: 'onTouched',
  })
  const { register, handleSubmit, formState, setError, setValue, getValues } = form
  const guard = useUnsavedChanges(formState.isDirty && !saved)
  const base = `${ctx.base}/vehiculos/${vehicle.id}`
  const e = formState.errors

  const applyQuick = (q: QuickService) => {
    const opts = { shouldDirty: true, shouldValidate: formState.isSubmitted }
    setValue('type', q.type, opts)
    setValue('zone', q.zone, opts)
    setValue('service_kind', q.service_kind ?? '', opts)
    const title = getValues('title').trim()
    if (q.title && (!title || title === autoTitle.current)) {
      setValue('title', q.title, opts)
      autoTitle.current = q.title
    }
  }

  const clearConflict = () => {
    if (conflict) {
      setConflict(null)
      setConfirmDrop(false)
    }
  }

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    const effective = effectiveTotalCents({ total: v.total_cost, parts: v.parts_cost, labor: v.labor_cost }, v.items)
    const payload: MaintenanceInput = {
      type: v.type,
      zone: v.zone,
      service_kind: (v.service_kind || null) as ServiceKind | null,
      title: v.title.trim(),
      description: v.description.trim() || null,
      service_date: v.service_date,
      mileage: parseIntegerInput(v.mileage),
      workshop_name: v.workshop_name.trim() || null,
      // Sin permiso para ver importes (mecánico en talleres) no se tocan los costes guardados
      ...(showPrices
        ? {
            parts_cost: toMoneyString(v.parts_cost),
            labor_cost: toMoneyString(v.labor_cost),
            total_cost: effective.cents !== null ? centsToMoney(effective.cents) : null,
          }
        : {}),
      items: v.items.map(formToLine),
      ...(conflict && confirmDrop ? { confirm_mileage_drop: true } : {}),
    }
    save.mutate(payload, {
      onSuccess: (saved) => {
        setSaved(true)
        const counted = ctx.isPersonal && saved.expense_id !== null
        toast.success(isEdit ? 'Intervención actualizada' : 'Intervención registrada', {
          description: counted ? `Cuenta como gasto de «${EXPENSE_CATEGORY_LABEL[linkedExpenseCategory(saved.type)]}», una sola vez.` : undefined,
          action: {
            label: 'Adjuntar factura',
            onClick: () => navigate(`${base}/datos?subir=1&intervencion=${saved.id}#documentos`),
          },
        })
        navigate(`${base}/historial#intervencion-${saved.id}`, { replace: true, state: AFTER_SAVE })
      },
      onError: (err) => {
        const drop = isMileageConflict(err)
        if (drop) {
          setConflict(drop)
          setConfirmDrop(false)
          setTimeout(() => conflictRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0)
          return
        }
        handleFormError(err, setError, FIELDS, setOrphans)
      },
    })
  })

  return (
    <>
      <PageHeader
        back={{ to: `${base}/historial`, label: vehicle.display_name }}
        title={isEdit ? 'Editar intervención' : 'Nueva intervención'}
        description={isEdit ? record.title : 'Mantenimiento, reparación, avería, ITV… con sus piezas, mano de obra y coste.'}
      />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start xl:gap-8">
        <div className="min-w-0 space-y-5">
          <Card className="p-5 md:p-6">
            <WhatSection form={form} onQuick={applyQuick} />
          </Card>

          <Card className="p-5 md:p-6">
            <Fieldset legend="Cuándo y dónde">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fecha" required error={e.service_date?.message}>
                  <DateInput allowFuture={false} {...register('service_date')} />
                </Field>
                <Field
                  label="Kilómetros"
                  error={e.mileage?.message}
                  hint={
                    vehicle.current_mileage !== null
                      ? `Último registro: ${formatKm(vehicle.current_mileage)}${vehicle.mileage_updated_at ? ` (${formatDate(vehicle.mileage_updated_at)})` : ''}. Se guarda también como lectura.`
                      : 'Opcional. Se guarda también como lectura de kilometraje.'
                  }
                  labelAside={
                    !isEdit &&
                    vehicle.current_mileage !== null && (
                      <button
                        type="button"
                        className="-my-2 rounded-control px-1 py-2 text-xs font-medium text-accent-ink hover:underline"
                        onClick={() => {
                          setValue('mileage', formatNumber(vehicle.current_mileage), { shouldDirty: true, shouldValidate: true })
                          clearConflict()
                        }}
                      >
                        Usar {formatKm(vehicle.current_mileage)}
                      </button>
                    )
                  }
                >
                  <MileageInput {...register('mileage', { onChange: clearConflict })} />
                </Field>
              </div>
              <WorkshopField form={form} vehicleId={vehicle.id} />
            </Fieldset>
          </Card>

          <Card className="p-5 md:p-6">
            <Fieldset legend="Piezas y mano de obra" description={showPrices ? 'Opcional. Con precios, CarCare suma el total por ti.' : 'Opcional. Los importes solo los ven propietarios y gerentes.'}>
              <LineItemsEditor form={form} showPrices={showPrices} />
              {e.items?.message && <p className="text-xs font-medium text-danger">{e.items.message}</p>}
            </Fieldset>
          </Card>

          {showPrices && (
            <Card className="p-5 md:p-6">
              <CostSection form={form} />
            </Card>
          )}

          <Card className="p-5 md:p-6">
            <Fieldset legend="Notas">
              <Field label="Descripción" hideLabel error={e.description?.message} hint="Síntomas, qué se revisó, garantía, recomendaciones del taller…">
                <Textarea rows={4} maxLength={5000} placeholder="Opcional" {...register('description')} />
              </Field>
            </Fieldset>
          </Card>

          {conflict && (
            <div ref={conflictRef}>
              <MileageConflictNotice message={conflict} checked={confirmDrop} onCheckedChange={setConfirmDrop} />
            </div>
          )}
          <FormErrors messages={orphans} />

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Link to={`${base}/historial`} className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-fg-muted hover:text-fg">
              Cancelar
            </Link>
            <Button type="submit" variant="primary" loading={save.isPending} disabled={!!conflict && !confirmDrop} icon={<Check aria-hidden />}>
              {isEdit ? 'Guardar cambios' : 'Guardar intervención'}
            </Button>
          </div>
        </div>

        <Summary form={form} vehicle={vehicle} showPrices={showPrices} />
      </form>
      {guard}
    </>
  )
}

function WhatSection({ form, onQuick }: { form: UseFormReturn<Values>; onQuick: (q: QuickService) => void }) {
  const { register, formState } = form
  const [type, zone, serviceKind] = useWatch({ control: form.control, name: ['type', 'zone', 'service_kind'] })
  const active = matchQuickService({ type, zone, service_kind: serviceKind })
  const e = formState.errors
  return (
    <Fieldset legend="¿Qué se hizo?" description="Elige uno para rellenar tipo, zona y título. Puedes cambiarlos después.">
      <div role="group" aria-label="Rellenar rápido" className="flex flex-wrap gap-2">
        {QUICK_SERVICES.map((q) => {
          const Icon = QUICK_ICON[q.id] ?? Wrench
          const pressed = active?.id === q.id
          return (
            <button
              key={q.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => onQuick(q)}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 md:min-h-10',
                pressed ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              <Icon aria-hidden className={cn('size-4', pressed && 'text-accent-ink')} />
              {q.label}
              {pressed && <Check aria-hidden className="size-3.5 text-accent-ink" />}
            </button>
          )
        })}
      </div>
      <Field label="Título" required error={e.title?.message}>
        <Input autoComplete="off" maxLength={120} placeholder="P. ej. Cambio de aceite y filtro" {...register('title')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tipo" required>
          <Select {...register('type')}>
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECORD_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Zona del vehículo" required hint="La que se marca en el modelo 3D.">
          <Select {...register('zone')}>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_LABEL[z]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Servicio concreto" hint="Para «desde el último cambio de aceite…».">
          <Select {...register('service_kind')}>
            <option value="">Ninguno</option>
            {SERVICE_KINDS.map((k) => (
              <option key={k} value={k}>
                {SERVICE_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Fieldset>
  )
}

function WorkshopField({ form, vehicleId }: { form: UseFormReturn<Values>; vehicleId: number }) {
  // Talleres usados antes en este vehículo como sugerencias (datalist nativo, accesible)
  const previous = useMaintenanceList(vehicleId, { per_page: 50 })
  const names = Array.from(new Set(flattenPages(previous.data).map((r) => r.workshop_name?.trim()).filter((n): n is string => !!n))).slice(0, 12)
  return (
    <Field label="Taller" error={form.formState.errors.workshop_name?.message} hint="Opcional. Dónde se hizo (o «Yo mismo»).">
      <Input autoComplete="off" maxLength={120} list={names.length ? 'talleres-anteriores' : undefined} {...form.register('workshop_name')} />
      {names.length > 0 && (
        <datalist id="talleres-anteriores">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      )}
    </Field>
  )
}

function CostSection({ form }: { form: UseFormReturn<Values> }) {
  const { register, formState, setValue } = form
  const ctx = useWorkspace()
  const [items, parts, labor, total, type] = useWatch({ control: form.control, name: ['items', 'parts_cost', 'labor_cost', 'total_cost', 'type'] })
  const lines = items ?? []
  const split = splitLines(lines)
  const { subtotalCents, unpricedCount } = sumLines(lines)
  const effective = effectiveTotalCents({ total, parts, labor }, lines)
  const totalCents = toCents(total)
  const partsCents = toCents(parts)
  const laborCents = toCents(labor)
  const warnings: string[] = []
  if (totalCents !== null && split.pricedCount > 0 && totalCents !== subtotalCents)
    warnings.push(`El total (${formatMoney(centsToMoney(totalCents))}) no cuadra con la suma de las líneas (${formatMoney(centsToMoney(subtotalCents))}).`)
  if (totalCents !== null && (partsCents !== null || laborCents !== null) && totalCents !== (partsCents ?? 0) + (laborCents ?? 0))
    warnings.push(`Piezas + mano de obra suman ${formatMoney(centsToMoney((partsCents ?? 0) + (laborCents ?? 0)))}, distinto del total.`)
  const e = formState.errors

  const fillFromLines = () => {
    const opts = { shouldDirty: true, shouldValidate: true }
    setValue('parts_cost', split.partsCents ? moneyToInput(centsToMoney(split.partsCents)) : '', opts)
    setValue('labor_cost', split.laborCents ? moneyToInput(centsToMoney(split.laborCents)) : '', opts)
    setValue('total_cost', moneyToInput(centsToMoney(subtotalCents)), opts)
  }

  const totalHint =
    totalCents !== null
      ? 'El importe que pagaste.'
      : effective.source === 'breakdown'
        ? `Si lo dejas vacío: piezas + mano de obra (${formatMoney(centsToMoney(effective.cents ?? 0))}).`
        : effective.source === 'lines'
          ? `Si lo dejas vacío: la suma de las líneas (${formatMoney(centsToMoney(effective.cents ?? 0))}).`
          : 'Si lo dejas vacío, la intervención queda sin coste.'

  return (
    <Fieldset legend="Coste" description="Importes con IVA, tal como figuran en la factura.">
      {split.pricedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-2/50 p-3 sm:flex-row sm:items-center">
          <Calculator aria-hidden className="hidden size-5 shrink-0 text-fg-subtle sm:block" />
          <p className="flex-1 text-sm text-fg-muted">
            Las líneas suman <span className="font-medium text-fg tabular">{formatMoney(centsToMoney(subtotalCents))}</span>
            <span className="tabular">
              {' '}
              (piezas {formatMoney(centsToMoney(split.partsCents))} · mano de obra {formatMoney(centsToMoney(split.laborCents))})
            </span>
            {unpricedCount > 0 && `. ${plural(unpricedCount, 'línea sin precio no suma', 'líneas sin precio no suman')}`}.
          </p>
          <Button size="sm" onClick={fillFromLines}>
            Usar estos importes
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Piezas" error={e.parts_cost?.message}>
          <MoneyInput {...register('parts_cost')} />
        </Field>
        <Field label="Mano de obra" error={e.labor_cost?.message}>
          <MoneyInput {...register('labor_cost')} />
        </Field>
        <Field label="Total" error={e.total_cost?.message} hint={totalHint}>
          <MoneyInput {...register('total_cost')} />
        </Field>
      </div>
      <div aria-live="polite" className="space-y-2">
        {warnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning-soft p-3 text-sm text-fg">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              {warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              <p className="mt-1 text-fg-muted">Se guardará el total que has escrito. Revísalo si no es intencionado (descuentos, tasas…).</p>
            </div>
          </div>
        )}
      </div>
      {ctx.isPersonal && (
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
          <span>
            Con coste, cuenta como un gasto de «{EXPENSE_CATEGORY_LABEL[linkedExpenseCategory(type)]}» en Gastos y en la analítica, una sola vez. Se gestiona desde aquí, no desde Gastos.
          </span>
        </p>
      )}
    </Fieldset>
  )
}

function Summary({ form, vehicle, showPrices }: { form: UseFormReturn<Values>; vehicle: Vehicle; showPrices: boolean }) {
  const [type, zone, serviceKind, title, date, mileage, items, parts, labor, total] = useWatch({
    control: form.control,
    name: ['type', 'zone', 'service_kind', 'title', 'service_date', 'mileage', 'items', 'parts_cost', 'labor_cost', 'total_cost'],
  })
  const effective = effectiveTotalCents({ total, parts, labor }, items ?? [])
  const km = parseIntegerInput(mileage)
  const rows: [string, string][] = [
    ['Tipo', RECORD_TYPE_LABEL[type]],
    ['Zona', ZONE_LABEL[zone]],
    ['Servicio', serviceKind ? SERVICE_KIND_LABEL[serviceKind as ServiceKind] : 'Ninguno'],
    ['Fecha', date ? formatDate(date) : 'Sin fecha'],
    ['Kilómetros', km !== null ? formatKm(km) : 'Sin indicar'],
    ['Líneas', (items ?? []).length ? plural((items ?? []).length, 'línea', 'líneas') : 'Ninguna'],
  ]
  return (
    <aside aria-label="Resumen de la intervención" className="hidden lg:sticky lg:top-24 lg:block">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-control bg-surface-2">
            <VehicleThumb vehicle={vehicle} className="absolute inset-0 h-full w-full min-h-0 rounded-none border-0 bg-transparent p-1" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{vehicle.display_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <Plate value={vehicle.plate} />
              <span className="tabular">{formatKm(vehicle.current_mileage, { empty: 'Sin km' })}</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="line-clamp-2 font-display text-base font-semibold text-fg-warm">{title.trim() || 'Sin título'}</p>
          <dl className="mt-3 space-y-1.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-fg-subtle">{k}</dt>
                <dd className="truncate text-right text-fg tabular">{v}</dd>
              </div>
            ))}
          </dl>
          {showPrices && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-sm text-fg-muted">Total que se guardará</p>
              <p className="mt-0.5 font-display text-2xl font-semibold text-fg-warm tabular">{effective.cents !== null ? formatMoney(centsToMoney(effective.cents)) : 'Sin coste'}</p>
              <p className="text-xs text-fg-muted">
                {effective.source === 'manual'
                  ? 'Importe escrito a mano.'
                  : effective.source === 'breakdown'
                    ? 'Piezas + mano de obra.'
                    : effective.source === 'lines'
                      ? 'Suma de las líneas con precio.'
                      : 'Añade un total o líneas con precio.'}
              </p>
            </div>
          )}
        </div>
      </Card>
    </aside>
  )
}

function FormSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Cargando formulario…</span>
      <div aria-hidden className="space-y-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-card" />
            <Skeleton className="h-44 w-full rounded-card" />
            <Skeleton className="h-32 w-full rounded-card" />
          </div>
          <Skeleton className="hidden h-80 rounded-card lg:block" />
        </div>
      </div>
    </div>
  )
}

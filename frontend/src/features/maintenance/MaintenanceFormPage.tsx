import { zodResolver } from '@hookform/resolvers/zod'
import { Archive, Check, Lock, TriangleAlert } from 'lucide-react'
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
import { Button, ButtonLink } from '@/components/ui/Button'
import { Disclosure } from '@/components/ui/Disclosure'
import { Field, Fieldset } from '@/components/ui/Field'
import { DateInput, Input, MileageInput, MoneyInput, Select, Textarea } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
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

/**
 * Chips de "¿Qué se hizo?" (5.5 del informe de UX): los 6 más habituales y sin icono. Batería, distribución, filtros,
 * aire acondicionado y el resto se eligen en "Más detalles" (tipo, zona y servicio concreto).
 */
const QUICK_CHIPS = ['oil', 'service', 'itv', 'tyres', 'brakes', 'breakdown']
const CHIPS = QUICK_SERVICES.filter((q) => QUICK_CHIPS.includes(q.id))

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

  // Secciones con título y separador, sin cajas ni columna de resumen (5.5 del informe de UX). El separador va en un
  // contenedor y no en el <fieldset>: con borde, el navegador pinta la <legend> encima de la línea
  const section = 'border-t border-line pt-6'

  return (
    <>
      <PageHeader back={{ to: `${base}/historial`, label: vehicle.display_name }} title={isEdit ? 'Editar intervención' : 'Nueva intervención'} description={isEdit ? record.title : undefined} />

      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <WhatSection form={form} onQuick={applyQuick} />

        <div className={section}>
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
        </div>

        <CostSection form={form} showPrices={showPrices} className={section} />

        <div className={section}>
          <Fieldset legend="Notas">
            <Field label="Descripción" hideLabel error={e.description?.message} hint="Síntomas, qué se revisó, garantía, recomendaciones del taller…">
              <Textarea rows={3} maxLength={5000} placeholder="Opcional" {...register('description')} />
            </Field>
          </Fieldset>
        </div>

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
  const detailErrors = !!(e.type || e.zone || e.service_kind)
  const [detailsOpen, setDetailsOpen] = useState(false)
  // Cerrado, "Más detalles" dice lo que ha rellenado el chip: nada se guarda sin verse
  const summary = [RECORD_TYPE_LABEL[type], ZONE_LABEL[zone], serviceKind ? SERVICE_KIND_LABEL[serviceKind as ServiceKind] : null].filter(Boolean).join(' · ')
  return (
    <Fieldset legend="¿Qué se hizo?" description="Elige uno para rellenar el título, el tipo y la zona, o escribe el título.">
      <div role="group" aria-label="Rellenar rápido" className="flex flex-wrap gap-2">
        {CHIPS.map((q) => {
          const pressed = active?.id === q.id
          return (
            <button
              key={q.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => onQuick(q)}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 md:min-h-10',
                pressed ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {pressed && <Check aria-hidden className="size-3.5 text-accent-ink" />}
              {q.label}
            </button>
          )
        })}
      </div>
      <Field label="Título" required error={e.title?.message}>
        <Input autoComplete="off" maxLength={120} placeholder="P. ej. Cambio de aceite y filtro" {...register('title')} />
      </Field>
      <Disclosure label="Más detalles" summary={summary} open={detailsOpen || detailErrors} onOpenChange={setDetailsOpen}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tipo" required error={e.type?.message}>
            <Select {...register('type')}>
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RECORD_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Zona del vehículo" required error={e.zone?.message} hint="La que se marca en el mapa de zonas.">
            <Select {...register('zone')}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABEL[z]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Servicio concreto" error={e.service_kind?.message} hint="Para «desde el último cambio de aceite…».">
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
      </Disclosure>
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

/**
 * Coste (5.5 del informe de UX): a la vista solo el total. Las líneas de piezas y mano de obra y su desglose van en
 * "Desglosar en piezas y mano de obra", abierto si ya hay algo o si hay un error dentro. Sin permiso para ver importes
 * (mecánico de un taller) solo quedan las líneas, sin precios.
 */
function CostSection({ form, showPrices, className }: { form: UseFormReturn<Values>; showPrices: boolean; className?: string }) {
  const { register, formState, setValue, getValues } = form
  const ctx = useWorkspace()
  const [items, parts, labor, total, type] = useWatch({ control: form.control, name: ['items', 'parts_cost', 'labor_cost', 'total_cost', 'type'] })
  const [open, setOpen] = useState(() => {
    const v = getValues()
    return v.items.length > 0 || !!v.parts_cost.trim() || !!v.labor_cost.trim()
  })
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
  const innerErrors = !!(e.items || e.parts_cost || e.labor_cost)
  const lineCount = lines.length ? plural(lines.length, 'línea', 'líneas') : undefined

  const fillFromLines = () => {
    const opts = { shouldDirty: true, shouldValidate: true }
    setValue('parts_cost', split.partsCents ? moneyToInput(centsToMoney(split.partsCents)) : '', opts)
    setValue('labor_cost', split.laborCents ? moneyToInput(centsToMoney(split.laborCents)) : '', opts)
    setValue('total_cost', moneyToInput(centsToMoney(subtotalCents)), opts)
  }

  const editor = (
    <>
      <LineItemsEditor form={form} showPrices={showPrices} />
      {e.items?.message && <p className="text-xs font-medium text-danger">{e.items.message}</p>}
    </>
  )

  if (!showPrices)
    return (
      <div className={className}>
        <Fieldset legend="Piezas y mano de obra" description="Opcional. Los importes solo los ven propietarios y gerentes.">
          <Disclosure label={lines.length ? 'Ver las líneas' : 'Añadir líneas'} summary={lineCount} open={open || innerErrors} onOpenChange={setOpen}>
            {editor}
          </Disclosure>
        </Fieldset>
      </div>
    )

  const totalHint =
    totalCents !== null
      ? 'El importe que pagaste, con IVA.'
      : effective.source === 'breakdown'
        ? `Si lo dejas vacío: piezas + mano de obra (${formatMoney(centsToMoney(effective.cents ?? 0))}).`
        : effective.source === 'lines'
          ? `Si lo dejas vacío: la suma de las líneas (${formatMoney(centsToMoney(effective.cents ?? 0))}).`
          : 'Con IVA. Si lo dejas vacío, la intervención queda sin coste.'

  return (
    <div className={className}>
      <Fieldset legend="Coste">
        <Field label="Total" error={e.total_cost?.message} hint={totalHint} className="sm:max-w-xs">
          <MoneyInput {...register('total_cost')} />
        </Field>
        <div aria-live="polite">
          {warnings.length > 0 && (
            <div className="flex items-start gap-2 border-l-2 border-warning pl-3 text-sm text-fg">
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
        <Disclosure label="Desglosar en piezas y mano de obra" summary={lineCount} open={open || innerErrors} onOpenChange={setOpen}>
          {editor}
          {split.pricedCount > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Piezas" error={e.parts_cost?.message}>
              <MoneyInput {...register('parts_cost')} />
            </Field>
            <Field label="Mano de obra" error={e.labor_cost?.message}>
              <MoneyInput {...register('labor_cost')} />
            </Field>
          </div>
        </Disclosure>
        {ctx.isPersonal && (
          <p className="text-sm text-fg-muted">
            Con coste, cuenta como un gasto de «{EXPENSE_CATEGORY_LABEL[linkedExpenseCategory(type)]}» en Gastos y en la analítica, una sola vez. Se cambia desde aquí, no desde Gastos.
          </p>
        )}
      </Fieldset>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Cargando formulario…</span>
      <div aria-hidden className="max-w-3xl space-y-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

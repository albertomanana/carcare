import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock, Link2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useMaintenanceList, useSaveExpense } from '@/api/hooks/records'
import { flattenPages } from '@/api/hooks/shared'
import type { Expense, ExpenseCategory, ExpenseInput, FuelUnit, Vehicle, Zone } from '@/api/types'
import { FormErrors, MileageConflictNotice } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { DateInput, Input, MileageInput, MoneyInput, Select } from '@/components/ui/inputs'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { allowsRecord, costlessRecords, defaultRenewal, isRecurringCategory, recurrenceLabel } from '@/lib/expenseLinks'
import { formatDate, formatMoney, moneyToInput, normalizeDecimalInput, parseIntegerInput, toMoneyString, todayISO } from '@/lib/format'
import { handleFormError, isMileageConflict } from '@/lib/forms'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICON, EXPENSE_CATEGORY_LABEL, FUEL_UNIT_LABEL, RECORD_TYPE_LABEL, ZONES, ZONE_LABEL } from '@/lib/labels'
import { amountError, isFutureDate, mileageError, quantityError } from '@/lib/validation'

const RECURRENCES = ['0', '1', '3', '6', '12'] as const
const RECORD_MODES = ['none', 'link', 'create'] as const

const schema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES as [ExpenseCategory, ...ExpenseCategory[]]),
    amount: z.string(),
    expense_date: z
      .string()
      .min(1, 'Indica la fecha.')
      .refine((v) => !isFutureDate(v), 'La fecha no puede ser futura.'),
    mileage: z.string(),
    description: z.string().max(255, 'Máximo 255 caracteres.'),
    fuel_quantity: z.string(),
    fuel_unit: z.enum(['l', 'kwh', 'kg']),
    full_tank: z.boolean(),
    // Gasto periódico: '0' = no se repite
    recurrence: z.enum(RECURRENCES),
    next_due_date: z.string(),
    // Intervención: solo el gasto, asociarlo a una que no tenía coste, o crearla en el mismo paso
    record_mode: z.enum(RECORD_MODES),
    record_id: z.string(),
    record_title: z.string().max(120, 'Máximo 120 caracteres.'),
    record_workshop: z.string().max(120, 'Máximo 120 caracteres.'),
    record_zone: z.enum(ZONES as [Zone, ...Zone[]]),
  })
  .superRefine((v, ctx) => {
    const amount = amountError(v.amount, { required: true, positive: true })
    if (amount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: amount })
    const km = mileageError(v.mileage)
    if (km) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mileage'], message: km })
    if (v.category === 'fuel' && v.fuel_quantity.trim()) {
      const q = quantityError(v.fuel_quantity)
      if (q) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fuel_quantity'], message: q })
    }
    if (isRecurringCategory(v.category) && v.recurrence !== '0' && v.next_due_date && v.expense_date && v.next_due_date <= v.expense_date)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['next_due_date'], message: 'Tiene que ser posterior a la fecha del gasto.' })
    if (allowsRecord(v.category)) {
      if (v.record_mode === 'link' && !v.record_id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['record_id'], message: 'Elige la intervención.' })
      if (v.record_mode === 'create' && v.record_title.trim().length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['record_title'], message: 'Ponle un nombre a la intervención (mínimo 2 letras).' })
    }
  })
type Values = z.infer<typeof schema>

function defaultUnit(vehicle: Vehicle): FuelUnit {
  if (vehicle.fuel_type === 'electric') return 'kwh'
  if (vehicle.fuel_type === 'cng') return 'kg'
  return 'l'
}

const choice = (on: boolean) =>
  cn(
    'inline-flex min-h-10 cursor-pointer items-center rounded-control border px-3 text-sm font-medium transition-colors max-lg:min-h-12',
    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-ink',
    on ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
  )

export interface ExpenseDialogProps {
  vehicle: Vehicle
  expense?: Expense | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExpenseDialog({ vehicle, expense, open, onOpenChange }: ExpenseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={expense ? 'Editar gasto' : 'Añadir gasto'} description={vehicle.display_name} size="md">
        {open && <ExpenseForm vehicle={vehicle} expense={expense ?? null} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Formulario de gasto con sus relaciones (contrato §3.6.1). Según la categoría aparece un apartado:
 *  - combustible: el repostaje;
 *  - seguro, impuestos, aparcamiento y otros: «Se repite», con la próxima renovación (crea o actualiza su recordatorio);
 *  - mantenimiento, reparación, modificación e inspección (solo al crear, en el garaje personal): asociar el gasto a una
 *    intervención que aún no tenía coste o crearla en el mismo paso, para que haya un solo apunte.
 */
function ExpenseForm({ vehicle, expense, onDone }: { vehicle: Vehicle; expense: Expense | null; onDone: () => void }) {
  const ws = useOptionalWorkspace()
  const personal = !!ws && !ws.isWorkshop
  const mutation = useSaveExpense(vehicle.id, expense?.id)
  const [conflict, setConflict] = useState<string | null>(null)
  const [confirmDrop, setConfirmDrop] = useState(false)
  const [orphans, setOrphans] = useState<string[]>([])
  const pendingRenewal = expense?.renewal?.status === 'pending' ? expense.renewal : null
  const { register, handleSubmit, formState, setError, setValue, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: expense?.category ?? 'fuel',
      amount: moneyToInput(expense?.amount),
      expense_date: expense?.expense_date ?? todayISO(),
      mileage: expense?.mileage != null ? String(expense.mileage) : '',
      description: expense?.description ?? '',
      fuel_quantity: expense?.fuel_quantity ? expense.fuel_quantity.replace('.', ',') : '',
      fuel_unit: expense?.fuel_unit ?? defaultUnit(vehicle),
      full_tank: expense?.full_tank ?? true,
      recurrence: (RECURRENCES as readonly string[]).includes(String(expense?.recurrence_months ?? 0)) ? (String(expense?.recurrence_months ?? 0) as Values['recurrence']) : '0',
      next_due_date: pendingRenewal?.due_date ?? '',
      record_mode: 'none',
      record_id: '',
      record_title: '',
      record_workshop: '',
      record_zone: 'general',
    },
  })
  const category = watch('category')
  const date = watch('expense_date')
  const recurrence = watch('recurrence')
  const recordMode = watch('record_mode')
  const isFuel = category === 'fuel'
  const canRecur = isRecurringCategory(category)
  const canRecord = !expense && personal && allowsRecord(category)
  const errors = formState.errors
  const dueTouched = !!formState.dirtyFields.next_due_date

  // La renovación propuesta sigue a la fecha y a la periodicidad mientras no se haya escrito otra a mano
  useEffect(() => {
    if (!canRecur || recurrence === '0' || dueTouched || pendingRenewal) return
    setValue('next_due_date', defaultRenewal(date, Number(recurrence)))
  }, [canRecur, recurrence, date, dueTouched, pendingRenewal, setValue])

  // Intervenciones del vehículo que aún no tienen coste: a esas se puede asociar el gasto
  const records = useMaintenanceList(vehicle.id, { per_page: 50 }, canRecord)
  const costless = useMemo(() => costlessRecords(flattenPages(records.data)), [records.data])

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    const amount = toMoneyString(v.amount) ?? '0.00'
    const months = canRecur && v.recurrence !== '0' ? Number(v.recurrence) : null
    const input: ExpenseInput = {
      category: v.category,
      amount,
      expense_date: v.expense_date,
      description: v.description.trim() || null,
      mileage: parseIntegerInput(v.mileage),
      fuel_quantity: isFuel ? normalizeDecimalInput(v.fuel_quantity) : null,
      fuel_unit: isFuel ? v.fuel_unit : null,
      full_tank: isFuel ? v.full_tank : null,
      ...(conflict && confirmDrop ? { confirm_mileage_drop: true } : {}),
      // la periodicidad solo se envía si hay algo que poner o que quitar
      ...(months !== null || expense?.recurrence_months ? { recurrence_months: months } : {}),
      ...(months !== null && v.next_due_date ? { next_due_date: v.next_due_date } : {}),
      ...(canRecord && v.record_mode === 'link' ? { maintenance_record_id: Number(v.record_id) } : {}),
      ...(canRecord && v.record_mode === 'create' ? { record: { title: v.record_title.trim(), zone: v.record_zone, workshop_name: v.record_workshop.trim() || null } } : {}),
    }
    mutation.mutate(input, {
      onSuccess: (saved) => {
        const extra = saved.origin ? ' y unido a su intervención' : saved.renewal?.status === 'pending' && saved.renewal.due_date ? `; renovación el ${formatDate(saved.renewal.due_date)}` : ''
        toast.success(expense ? `Gasto actualizado${extra}` : `Gasto de ${formatMoney(amount)} añadido${extra}`)
        onDone()
      },
      onError: (err) => {
        const drop = isMileageConflict(err)
        if (drop) {
          setConflict(drop)
          setConfirmDrop(false)
          return
        }
        handleFormError(err, setError, Object.keys(schema.innerType().shape), setOrphans)
      },
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">Categoría</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {EXPENSE_CATEGORIES.map((c) => {
              const Icon = EXPENSE_CATEGORY_ICON[c]
              return (
                <label
                  key={c}
                  className={cn(
                    'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border px-1 py-2 text-center text-xs font-medium transition-colors',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-ink',
                    category === c ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
                  )}
                >
                  <input type="radio" value={c} className="sr-only" {...register('category')} />
                  <Icon aria-hidden className={cn('size-5', category === c && 'text-accent-ink')} />
                  {EXPENSE_CATEGORY_LABEL[c]}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Importe" required error={errors.amount?.message} hint="Con IVA, p. ej. 54,90.">
            <MoneyInput autoFocus {...register('amount')} />
          </Field>
          <Field label="Fecha" required error={errors.expense_date?.message}>
            <DateInput allowFuture={false} {...register('expense_date')} />
          </Field>
        </div>

        {isFuel && (
          <div className="grid gap-4 rounded-card border border-line bg-surface-2/50 p-4 sm:grid-cols-2">
            <Field label="Cantidad repostada" error={errors.fuel_quantity?.message} hint="Opcional, para calcular el consumo.">
              <Input type="text" inputMode="decimal" className="tabular text-right" placeholder="0,00" {...register('fuel_quantity')} />
            </Field>
            <Field label="Unidad">
              <Select {...register('fuel_unit')}>
                {(Object.keys(FUEL_UNIT_LABEL) as FuelUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {FUEL_UNIT_LABEL[u]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Checkbox
                label="Depósito lleno"
                description="El consumo se calcula entre dos repostajes con depósito lleno y kilómetros indicados."
                {...register('full_tank')}
              />
            </div>
          </div>
        )}

        {canRecur && (
          <div className="space-y-4 rounded-card border border-line bg-surface-2/50 p-4">
            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg">
                <CalendarClock aria-hidden className="size-4 text-fg-muted" />
                ¿Se repite?
              </legend>
              <div className="flex flex-wrap gap-2">
                {RECURRENCES.map((r) => (
                  <label key={r} className={choice(recurrence === r)}>
                    <input type="radio" value={r} className="sr-only" {...register('recurrence')} />
                    {r === '0' ? 'No' : recurrenceLabel(Number(r))}
                  </label>
                ))}
              </div>
            </fieldset>
            {recurrence !== '0' && (
              <Field
                label="Próxima renovación"
                error={errors.next_due_date?.message}
                hint={
                  pendingRenewal
                    ? `Mueve la fecha de tu recordatorio «${pendingRenewal.title}».`
                    : 'Crea el recordatorio de la renovación (o actualiza el que ya tengas de este tipo). No cuenta como gasto hasta que lo pagues.'
                }
              >
                <DateInput {...register('next_due_date')} />
              </Field>
            )}
            {recurrence !== '0' && (category === 'insurance' || category === 'tax') && (
              <p className="text-xs text-fg-muted">La póliza o el recibo se guardan en la pestaña Datos del vehículo, en Documentos.</p>
            )}
          </div>
        )}

        {canRecord && (
          <div className="space-y-4 rounded-card border border-line bg-surface-2/50 p-4">
            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg">
                <Link2 aria-hidden className="size-4 text-fg-muted" />
                Intervención
              </legend>
              <div className="flex flex-wrap gap-2">
                <label className={choice(recordMode === 'none')}>
                  <input type="radio" value="none" className="sr-only" {...register('record_mode')} />
                  Solo el gasto
                </label>
                <label className={cn(choice(recordMode === 'link'), costless.length === 0 && 'cursor-not-allowed opacity-50')}>
                  <input type="radio" value="link" className="sr-only" disabled={costless.length === 0} {...register('record_mode')} />
                  Asociar a una que ya tengo
                </label>
                <label className={choice(recordMode === 'create')}>
                  <input type="radio" value="create" className="sr-only" {...register('record_mode')} />
                  Crear la intervención
                </label>
              </div>
              {records.isSuccess && costless.length === 0 && <p className="mt-2 text-xs text-fg-muted">No hay intervenciones sin coste a las que asociarlo.</p>}
              {recordMode === 'none' && costless.length > 0 && (
                <p className="mt-2 text-xs text-fg-muted">
                  Tienes {costless.length === 1 ? 'una intervención' : `${costless.length} intervenciones`} sin coste en este vehículo: si este gasto es de {costless.length === 1 ? 'ella' : 'una de ellas'}, asócialo y no
                  lo apuntarás dos veces.
                </p>
              )}
            </fieldset>

            {recordMode === 'link' && (
              <Field label="Intervención" required error={errors.record_id?.message} hint="El gasto tomará su fecha y su nombre, y se editará desde ella.">
                <Select {...register('record_id')}>
                  <option value="">Elige…</option>
                  {costless.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.title} · {formatDate(r.service_date)} · {RECORD_TYPE_LABEL[r.type]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {recordMode === 'create' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Qué se hizo" required error={errors.record_title?.message}>
                    <Input placeholder={category === 'modification' ? 'Llantas de 17 pulgadas…' : 'Cambio de pastillas…'} maxLength={120} {...register('record_title')} />
                  </Field>
                  <Field label="Taller" error={errors.record_workshop?.message}>
                    <Input placeholder="Opcional" maxLength={120} {...register('record_workshop')} />
                  </Field>
                </div>
                <Field label="Zona del coche" hint="Es la que se marca en el modelo 3D del vehículo.">
                  <Select {...register('record_zone')}>
                    {ZONES.map((z) => (
                      <option key={z} value={z}>
                        {ZONE_LABEL[z]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-xs text-fg-muted">Queda en el historial con esta fecha y este importe; el gasto se gestiona desde ella, así hay un solo apunte.</p>
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kilómetros" error={errors.mileage?.message} hint={isFuel ? 'Los del cuentakilómetros al repostar: con ellos se calcula el consumo.' : 'Opcional. Los del cuentakilómetros ese día.'}>
            <MileageInput {...register('mileage')} />
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            <Input placeholder={isFuel ? 'Gasolinera…' : 'Opcional'} maxLength={255} {...register('description')} />
          </Field>
        </div>

        {conflict && <MileageConflictNotice message={conflict} checked={confirmDrop} onCheckedChange={setConfirmDrop} />}
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={mutation.isPending} disabled={!!conflict && !confirmDrop}>
          {expense ? 'Guardar cambios' : isFuel ? 'Guardar repostaje' : canRecord && recordMode !== 'none' ? 'Guardar gasto e intervención' : 'Guardar gasto'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default ExpenseDialog

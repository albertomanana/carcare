import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSaveExpense } from '@/api/hooks/records'
import type { Expense, ExpenseCategory, FuelUnit, Vehicle } from '@/api/types'
import { FormErrors, MileageConflictNotice } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { DateInput, Input, MileageInput, MoneyInput, Select } from '@/components/ui/inputs'
import { cn } from '@/lib/cn'
import { formatMoney, moneyToInput, normalizeDecimalInput, parseIntegerInput, toMoneyString, todayISO } from '@/lib/format'
import { handleFormError, isMileageConflict } from '@/lib/forms'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICON, EXPENSE_CATEGORY_LABEL, FUEL_UNIT_LABEL } from '@/lib/labels'
import { amountError, isFutureDate, mileageError, quantityError } from '@/lib/validation'

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
  })
type Values = z.infer<typeof schema>

function defaultUnit(vehicle: Vehicle): FuelUnit {
  if (vehicle.fuel_type === 'electric') return 'kwh'
  if (vehicle.fuel_type === 'cng') return 'kg'
  return 'l'
}

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

function ExpenseForm({ vehicle, expense, onDone }: { vehicle: Vehicle; expense: Expense | null; onDone: () => void }) {
  const mutation = useSaveExpense(vehicle.id, expense?.id)
  const [conflict, setConflict] = useState<string | null>(null)
  const [confirmDrop, setConfirmDrop] = useState(false)
  const [orphans, setOrphans] = useState<string[]>([])
  const { register, handleSubmit, formState, setError, watch } = useForm<Values>({
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
    },
  })
  const category = watch('category')
  const isFuel = category === 'fuel'
  const errors = formState.errors

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    const amount = toMoneyString(v.amount) ?? '0.00'
    mutation.mutate(
      {
        category: v.category,
        amount,
        expense_date: v.expense_date,
        description: v.description.trim() || null,
        mileage: parseIntegerInput(v.mileage),
        fuel_quantity: isFuel ? normalizeDecimalInput(v.fuel_quantity) : null,
        fuel_unit: isFuel ? v.fuel_unit : null,
        full_tank: isFuel ? v.full_tank : null,
        ...(conflict && confirmDrop ? { confirm_mileage_drop: true } : {}),
      },
      {
        onSuccess: () => {
          toast.success(expense ? 'Gasto actualizado' : `Gasto de ${formatMoney(amount)} añadido`)
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
      },
    )
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
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
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
          <Field label="Importe" required error={errors.amount?.message}>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kilómetros" error={errors.mileage?.message} hint={isFuel ? 'Necesarios para el consumo.' : 'Opcional.'}>
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
          {expense ? 'Guardar cambios' : 'Añadir gasto'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default ExpenseDialog

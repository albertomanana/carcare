import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useReminderCommands } from '@/api/hooks/records'
import type { Reminder, ReminderInput } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { DateInput, MileageInput } from '@/components/ui/inputs'
import { postponeDate, postponeDateBase, postponeMileageBase } from '@/lib/agenda'
import { formatDate, formatKm, formatNumber, parseIntegerInput, todayISO } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { dueSummary } from '@/lib/reminders'
import { joinList } from '@/lib/text'
import { mileageError } from '@/lib/validation'

const DATE_STEPS = [
  { label: '+1 semana', amount: { days: 7 } },
  { label: '+1 mes', amount: { months: 1 } },
  { label: '+3 meses', amount: { months: 3 } },
] as const
const KM_STEPS = [500, 1000, 5000]

export interface PostponeReminderDialogProps {
  reminder: Reminder | null
  onOpenChange: (open: boolean) => void
}

/** Posponer = mover el vencimiento (fecha y/o km) más adelante. No toca la recurrencia ni el historial. */
export function PostponeReminderDialog({ reminder, onOpenChange }: PostponeReminderDialogProps) {
  return (
    <Dialog open={!!reminder} onOpenChange={onOpenChange}>
      <DialogContent title="Posponer recordatorio" description={reminder ? `${reminder.title}${reminder.vehicle ? ` · ${reminder.vehicle.display_name}` : ''}` : undefined} size="sm">
        {reminder && <PostponeForm reminder={reminder} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function PostponeForm({ reminder, onDone }: { reminder: Reminder; onDone: () => void }) {
  const { update } = useReminderCommands()
  const [orphans, setOrphans] = useState<string[]>([])
  const today = todayISO()
  const dateBase = postponeDateBase(reminder, today)
  const kmBase = postponeMileageBase(reminder)
  const hasDate = reminder.due_date !== null
  const hasKm = reminder.due_mileage !== null

  const schema = z
    .object({ due_date: z.string(), due_mileage: z.string() })
    .superRefine((v, ctx) => {
      const dateChanged = hasDate && v.due_date !== reminder.due_date
      const kmValue = parseIntegerInput(v.due_mileage)
      const kmChanged = hasKm && kmValue !== reminder.due_mileage
      if (hasDate) {
        if (!v.due_date) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_date'], message: 'Indica la nueva fecha.' })
        else if (dateChanged && v.due_date <= today) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_date'], message: 'Elige una fecha posterior a hoy.' })
        else if (dateChanged && reminder.due_date && v.due_date < reminder.due_date)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_date'], message: `Para posponer, la fecha debe ser posterior al ${formatDate(reminder.due_date)}.` })
      }
      if (hasKm) {
        const e = mileageError(v.due_mileage, { required: true })
        if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_mileage'], message: e })
        else if (kmChanged && kmValue !== null && reminder.due_mileage !== null && kmValue < reminder.due_mileage)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_mileage'], message: `Para posponer, debe ser más de ${formatKm(reminder.due_mileage)}.` })
      }
      if (!dateChanged && !kmChanged) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [hasDate ? 'due_date' : 'due_mileage'], message: 'No has cambiado el vencimiento.' })
      }
    })
  type Values = z.infer<typeof schema>

  const { register, handleSubmit, formState, setError, setValue, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      due_date: dateBase ? postponeDate(dateBase, { months: 1 }) : '',
      due_mileage: kmBase !== null ? String(kmBase + 1000) : '',
    },
  })
  const values = watch()

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    const input: Partial<ReminderInput> = {}
    const changes: string[] = []
    if (hasDate && v.due_date !== reminder.due_date) {
      input.due_date = v.due_date
      changes.push(`al ${formatDate(v.due_date)}`)
    }
    const km = parseIntegerInput(v.due_mileage)
    if (hasKm && km !== reminder.due_mileage) {
      input.due_mileage = km
      changes.push(`a los ${formatKm(km)}`)
    }
    update.mutate(
      { reminder, input },
      {
        onSuccess: () => {
          toast.success(`«${reminder.title}» pospuesto ${joinList(changes)}`)
          onDone()
        },
        onError: (err) => handleFormError(err, setError, ['due_date', 'due_mileage'], setOrphans),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-5">
        <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-fg-muted">
          <span className="font-medium text-fg">Ahora: </span>
          {dueSummary(reminder)}
        </p>
        {hasDate && dateBase && (
          <div className="space-y-2">
            <Field label="Nueva fecha" required error={formState.errors.due_date?.message} hint={reminder.due_date && reminder.due_date < today ? 'Ya venció: los atajos cuentan desde hoy.' : undefined}>
              <DateInput min={today} {...register('due_date')} />
            </Field>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de fecha">
              {hasKm && reminder.due_date && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="border border-line"
                  aria-pressed={values.due_date === reminder.due_date}
                  onClick={() => setValue('due_date', reminder.due_date ?? '', { shouldValidate: true, shouldDirty: true })}
                >
                  Sin cambiar
                </Button>
              )}
              {DATE_STEPS.map((step) => {
                const target = postponeDate(dateBase, step.amount)
                return (
                  <Button
                    key={step.label}
                    size="sm"
                    variant="ghost"
                    className="border border-line"
                    aria-pressed={values.due_date === target}
                    aria-label={`${step.label}: ${formatDate(target, 'long')}`}
                    onClick={() => setValue('due_date', target, { shouldValidate: true, shouldDirty: true })}
                  >
                    {step.label}
                  </Button>
                )
              })}
            </div>
          </div>
        )}
        {hasKm && kmBase !== null && (
          <div className="space-y-2">
            <Field
              label="Nuevos kilómetros"
              required
              error={formState.errors.due_mileage?.message}
              hint={reminder.km_left !== null && reminder.km_left < 0 ? 'Ya se superaron: los atajos cuentan desde los km actuales.' : undefined}
            >
              <MileageInput {...register('due_mileage')} />
            </Field>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de kilómetros">
              {hasDate && reminder.due_mileage !== null && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="border border-line"
                  aria-pressed={parseIntegerInput(values.due_mileage) === reminder.due_mileage}
                  onClick={() => setValue('due_mileage', String(reminder.due_mileage), { shouldValidate: true, shouldDirty: true })}
                >
                  Sin cambiar
                </Button>
              )}
              {KM_STEPS.map((step) => (
                <Button
                  key={step}
                  size="sm"
                  variant="ghost"
                  className="border border-line"
                  aria-pressed={parseIntegerInput(values.due_mileage) === kmBase + step}
                  onClick={() => setValue('due_mileage', String(kmBase + step), { shouldValidate: true, shouldDirty: true })}
                >
                  +{formatNumber(step)} km
                </Button>
              ))}
            </div>
          </div>
        )}
        {(reminder.recurrence_months || reminder.recurrence_km) && (
          <p className="text-xs text-fg-subtle">La repetición no cambia: al completarlo, el siguiente se calculará desde ese día y esos km.</p>
        )}
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={update.isPending}>
          Posponer
        </Button>
      </DialogFooter>
    </form>
  )
}

export default PostponeReminderDialog

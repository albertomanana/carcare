import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useReminderCommands } from '@/api/hooks/records'
import type { Reminder } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { DateInput, MileageInput } from '@/components/ui/inputs'
import { formatDate, formatKm, parseIntegerInput, todayISO } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { recurrenceText } from '@/lib/reminders'
import { isFutureDate, mileageError } from '@/lib/validation'

const schema = z.object({
  completed_at: z
    .string()
    .min(1, 'Indica la fecha.')
    .refine((v) => !isFutureDate(v), 'La fecha no puede ser futura.'),
  mileage: z.string().superRefine((v, ctx) => {
    const e = mileageError(v)
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
  }),
  create_next: z.boolean(),
})
type Values = z.infer<typeof schema>

export interface CompleteReminderDialogProps {
  reminder: Reminder | null
  /** Km actuales del vehículo (solo para la ayuda del campo). */
  currentMileage?: number | null
  onOpenChange: (open: boolean) => void
}

/** Marcar un recordatorio como hecho; si se repite, crea el siguiente. */
export function CompleteReminderDialog({ reminder, currentMileage, onOpenChange }: CompleteReminderDialogProps) {
  return (
    <Dialog open={!!reminder} onOpenChange={onOpenChange}>
      <DialogContent title="Marcar como hecho" description={reminder?.title} size="sm">
        {reminder && <CompleteForm reminder={reminder} currentMileage={currentMileage ?? null} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CompleteForm({ reminder, currentMileage, onDone }: { reminder: Reminder; currentMileage: number | null; onDone: () => void }) {
  const { complete } = useReminderCommands()
  const [orphans, setOrphans] = useState<string[]>([])
  const recurrence = recurrenceText(reminder)
  const { register, handleSubmit, formState, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { completed_at: todayISO(), mileage: '', create_next: true },
  })

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    complete.mutate(
      {
        reminder,
        input: {
          completed_at: v.completed_at,
          mileage: parseIntegerInput(v.mileage),
          create_next: recurrence ? v.create_next : false,
        },
      },
      {
        onSuccess: ({ next }) => {
          const nextText = next
            ? [next.due_date ? formatDate(next.due_date) : null, next.due_mileage !== null ? formatKm(next.due_mileage) : null].filter(Boolean).join(' o ')
            : null
          toast.success(next ? `Hecho. El siguiente vence: ${nextText}` : 'Recordatorio completado')
          onDone()
        },
        onError: (err) => handleFormError(err, setError, ['completed_at', 'mileage', 'create_next'], setOrphans, { completed_mileage: 'mileage' }),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-4">
        <Field label="Fecha en que se hizo" required error={formState.errors.completed_at?.message}>
          <DateInput allowFuture={false} autoFocus {...register('completed_at')} />
        </Field>
        <Field
          label="Kilómetros en ese momento"
          error={formState.errors.mileage?.message}
          hint={currentMileage !== null ? `Opcional. Último registro: ${formatKm(currentMileage)}. Se guardará como lectura.` : 'Opcional. Se guardará como lectura de kilometraje.'}
        >
          <MileageInput {...register('mileage')} />
        </Field>
        {recurrence ? (
          <Checkbox label="Crear el siguiente recordatorio" description={`${recurrence}, contando desde esta fecha y estos km.`} {...register('create_next')} />
        ) : (
          <p className="text-sm text-fg-muted">Este recordatorio no se repite: quedará en el historial como hecho.</p>
        )}
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={complete.isPending}>
          Marcar como hecho
        </Button>
      </DialogFooter>
    </form>
  )
}

export default CompleteReminderDialog

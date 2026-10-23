import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAddMileage } from '@/api/hooks/vehicles'
import type { Vehicle } from '@/api/types'
import { FormErrors, MileageConflictNotice } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { DateInput, Input, MileageInput } from '@/components/ui/inputs'
import { formatDate, formatKm, parseIntegerInput, todayISO } from '@/lib/format'
import { handleFormError, isMileageConflict } from '@/lib/forms'
import { isFutureDate, mileageError } from '@/lib/validation'

const schema = z.object({
  recorded_at: z
    .string()
    .min(1, 'Indica la fecha.')
    .refine((v) => !isFutureDate(v), 'La fecha no puede ser futura.'),
  mileage: z.string().superRefine((v, ctx) => {
    const e = mileageError(v, { required: true })
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
  }),
  note: z.string().max(255, 'Máximo 255 caracteres.'),
})
type Values = z.infer<typeof schema>

export interface MileageDialogProps {
  vehicle: Vehicle
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MileageDialog({ vehicle, open, onOpenChange }: MileageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Actualizar kilometraje"
        description={
          vehicle.current_mileage !== null
            ? `${vehicle.display_name} · último: ${formatKm(vehicle.current_mileage)}${vehicle.mileage_updated_at ? ` el ${formatDate(vehicle.mileage_updated_at)}` : ''}`
            : `${vehicle.display_name} · todavía sin lecturas`
        }
        size="sm"
      >
        {open && <MileageForm vehicle={vehicle} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function MileageForm({ vehicle, onDone }: { vehicle: Vehicle; onDone: () => void }) {
  const mutation = useAddMileage(vehicle.id)
  const [conflict, setConflict] = useState<string | null>(null)
  const [confirmDrop, setConfirmDrop] = useState(false)
  const [orphans, setOrphans] = useState<string[]>([])
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { recorded_at: todayISO(), mileage: '', note: '' },
  })
  const { register, handleSubmit, formState, setError, watch } = form
  const typed = parseIntegerInput(watch('mileage'))
  const lower = typed !== null && vehicle.current_mileage !== null && typed < vehicle.current_mileage

  const onSubmit = handleSubmit((values) => {
    setOrphans([])
    mutation.mutate(
      {
        recorded_at: values.recorded_at,
        mileage: parseIntegerInput(values.mileage) ?? 0,
        note: values.note.trim() || null,
        ...(conflict && confirmDrop ? { confirm_mileage_drop: true } : {}),
      },
      {
        onSuccess: (log) => {
          toast.success(`Kilometraje registrado: ${formatKm(log.mileage)}`)
          onDone()
        },
        onError: (err) => {
          const drop = isMileageConflict(err)
          if (drop) {
            setConflict(drop)
            setConfirmDrop(false)
            return
          }
          handleFormError(err, setError, ['recorded_at', 'mileage', 'note'], setOrphans)
        },
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-4">
        <Field label="Kilómetros del cuentakilómetros" required error={formState.errors.mileage?.message} hint={lower && !conflict ? 'Es menor que la última lectura: se te pedirá confirmarlo.' : undefined}>
          <MileageInput autoFocus {...register('mileage')} />
        </Field>
        <Field label="Fecha de la lectura" required error={formState.errors.recorded_at?.message}>
          <DateInput allowFuture={false} {...register('recorded_at')} />
        </Field>
        <Field label="Nota" hint="Opcional. P. ej. «Vuelta de vacaciones»." error={formState.errors.note?.message}>
          <Input {...register('note')} maxLength={255} />
        </Field>
        {conflict && <MileageConflictNotice message={conflict} checked={confirmDrop} onCheckedChange={setConfirmDrop} />}
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={mutation.isPending} disabled={!!conflict && !confirmDrop}>
          Guardar lectura
        </Button>
      </DialogFooter>
    </form>
  )
}

export default MileageDialog

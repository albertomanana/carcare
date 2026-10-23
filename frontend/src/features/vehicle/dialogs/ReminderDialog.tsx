import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSaveReminder } from '@/api/hooks/records'
import type { Reminder, ReminderKind, Vehicle, Zone } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field, Fieldset } from '@/components/ui/Field'
import { DateInput, Input, MileageInput, Select, Textarea } from '@/components/ui/inputs'
import { addMonths, formatKm, parseIntegerInput, toISODate } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { REMINDER_KIND_LABEL, REMINDER_KIND_ZONE, ZONE_LABEL, ZONES } from '@/lib/labels'
import { mileageError } from '@/lib/validation'

const KINDS = Object.keys(REMINDER_KIND_LABEL) as ReminderKind[]

const schema = z
  .object({
    kind: z.enum(KINDS as [ReminderKind, ...ReminderKind[]]),
    title: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
    zone: z.enum(ZONES as [Zone, ...Zone[]]),
    due_date: z.string(),
    due_mileage: z.string(),
    recurrence_months: z.string(),
    recurrence_km: z.string(),
    notes: z.string().max(1000, 'Máximo 1000 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (!v.due_date && !v.due_mileage.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_date'], message: 'Indica una fecha, unos kilómetros o ambos.' })
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_mileage'], message: 'Indica una fecha, unos kilómetros o ambos.' })
    }
    const km = mileageError(v.due_mileage)
    if (km) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['due_mileage'], message: km })
    const rkm = mileageError(v.recurrence_km)
    if (rkm) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['recurrence_km'], message: rkm })
    if (v.recurrence_months.trim()) {
      const n = Number(v.recurrence_months)
      if (!Number.isInteger(n) || n < 1 || n > 240) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['recurrence_months'], message: 'Entre 1 y 240 meses.' })
    }
  })
type Values = z.infer<typeof schema>

export interface ReminderDialogProps {
  vehicle: Vehicle
  reminder?: Reminder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Zona preseleccionada (p. ej. desde el mapa 3D). */
  defaultZone?: Zone | null
}

export function ReminderDialog({ vehicle, reminder, open, onOpenChange, defaultZone }: ReminderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={reminder ? 'Editar recordatorio' : 'Nuevo recordatorio'} description={vehicle.display_name} size="md">
        {open && <ReminderForm vehicle={vehicle} reminder={reminder ?? null} defaultZone={defaultZone ?? null} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ReminderForm({ vehicle, reminder, defaultZone, onDone }: { vehicle: Vehicle; reminder: Reminder | null; defaultZone: Zone | null; onDone: () => void }) {
  const mutation = useSaveReminder(vehicle.id, reminder?.id)
  const [orphans, setOrphans] = useState<string[]>([])
  const initialKind: ReminderKind = reminder?.kind ?? (defaultZone === 'tyres' ? 'tyres' : defaultZone === 'brakes' ? 'brakes' : defaultZone === 'electrical' ? 'battery' : defaultZone === 'engine' ? 'oil' : 'itv')
  const { register, handleSubmit, formState, setError, setValue, getValues, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: initialKind,
      title: reminder?.title ?? REMINDER_KIND_LABEL[initialKind],
      zone: reminder?.zone ?? defaultZone ?? REMINDER_KIND_ZONE[initialKind],
      due_date: reminder?.due_date ?? '',
      due_mileage: reminder?.due_mileage != null ? String(reminder.due_mileage) : '',
      recurrence_months: reminder?.recurrence_months != null ? String(reminder.recurrence_months) : '',
      recurrence_km: reminder?.recurrence_km != null ? String(reminder.recurrence_km) : '',
      notes: reminder?.notes ?? '',
    },
  })
  const errors = formState.errors
  const kind = watch('kind')

  const onKindChange = (next: ReminderKind) => {
    const prevKind = getValues('kind')
    // Si el título y la zona seguían los valores automáticos, los actualizamos
    if (!getValues('title').trim() || getValues('title') === REMINDER_KIND_LABEL[prevKind]) setValue('title', next === 'custom' ? '' : REMINDER_KIND_LABEL[next])
    if (getValues('zone') === REMINDER_KIND_ZONE[prevKind]) setValue('zone', REMINDER_KIND_ZONE[next])
  }

  const quickDate = (months: number) => setValue('due_date', toISODate(addMonths(new Date(), months)), { shouldValidate: true, shouldDirty: true })
  const quickKm = (km: number) => {
    if (vehicle.current_mileage === null) return
    setValue('due_mileage', String(vehicle.current_mileage + km), { shouldValidate: true, shouldDirty: true })
  }

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    mutation.mutate(
      {
        kind: v.kind,
        title: v.title.trim(),
        zone: v.zone,
        notes: v.notes.trim() || null,
        due_date: v.due_date || null,
        due_mileage: parseIntegerInput(v.due_mileage),
        recurrence_months: v.recurrence_months.trim() ? Number(v.recurrence_months) : null,
        recurrence_km: parseIntegerInput(v.recurrence_km),
      },
      {
        onSuccess: () => {
          toast.success(reminder ? 'Recordatorio actualizado' : 'Recordatorio creado')
          onDone()
        },
        onError: (err) => handleFormError(err, setError, Object.keys(schema.innerType().shape), setOrphans),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" required>
            <Select
              {...register('kind', {
                onChange: (e) => onKindChange(e.target.value as ReminderKind),
              })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {REMINDER_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Zona del vehículo" hint="Se ilumina en el mapa 3D.">
            <Select {...register('zone')}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABEL[z]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Título" required error={errors.title?.message}>
          <Input placeholder={kind === 'custom' ? 'P. ej. Cambiar escobillas' : undefined} maxLength={120} {...register('title')} />
        </Field>

        <Fieldset legend="¿Cuándo vence?" description="Por fecha, por kilómetros o lo que llegue antes.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha" error={errors.due_date?.message}>
              <DateInput {...register('due_date')} />
            </Field>
            <Field
              label="A los kilómetros"
              error={errors.due_mileage?.message}
              hint={vehicle.current_mileage !== null ? `Ahora: ${formatKm(vehicle.current_mileage)}` : 'El vehículo aún no tiene kilometraje.'}
            >
              <MileageInput {...register('due_mileage')} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Atajos de vencimiento">
            {[1, 6, 12, 24].map((m) => (
              <Button key={m} size="sm" variant="ghost" className="border border-line" onClick={() => quickDate(m)}>
                +{m} {m === 1 ? 'mes' : 'meses'}
              </Button>
            ))}
            {vehicle.current_mileage !== null &&
              [5000, 15000].map((km) => (
                <Button key={km} size="sm" variant="ghost" className="border border-line" onClick={() => quickKm(km)}>
                  +{formatKm(km)}
                </Button>
              ))}
          </div>
        </Fieldset>

        <Fieldset legend="Repetir" description="Opcional. Al completarlo se creará el siguiente automáticamente.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cada (meses)" error={errors.recurrence_months?.message}>
              <Input type="text" inputMode="numeric" className="tabular text-right" suffix="meses" {...register('recurrence_months')} />
            </Field>
            <Field label="Cada (km)" error={errors.recurrence_km?.message}>
              <MileageInput {...register('recurrence_km')} />
            </Field>
          </div>
        </Fieldset>

        <Field label="Notas" error={errors.notes?.message}>
          <Textarea rows={2} {...register('notes')} />
        </Field>
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {reminder ? 'Guardar cambios' : 'Crear recordatorio'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default ReminderDialog

import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useSaveCustomer } from '@/api/hooks/workshop'
import type { Customer } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/inputs'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { handleFormError } from '@/lib/forms'
import { CUSTOMER_FIELD_NAMES, customerSchema, customerToValues, type CustomerValues, valuesToCustomerInput } from './customerForm'

export interface CustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = alta de un cliente nuevo. */
  customer: Customer | null
  onSaved?: (customer: Customer) => void
}

/** Alta y edición de clientes del taller. Los errores 422 del servidor aparecen junto a cada campo. */
export function CustomerDialog({ open, onOpenChange, customer, onSaved }: CustomerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={customer ? 'Editar cliente' : 'Nuevo cliente'}
        description={customer ? customer.name : 'Solo el nombre es obligatorio. El teléfono sirve para avisarle cuando su coche esté listo.'}
        size="md"
      >
        {open && <CustomerForm key={customer?.id ?? 'nuevo'} customer={customer} onDone={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function CustomerForm({ customer, onDone, onSaved }: { customer: Customer | null; onDone: (open: boolean) => void; onSaved?: (c: Customer) => void }) {
  const ctx = useWorkspace()
  const save = useSaveCustomer(ctx.id, customer?.id)
  const [orphans, setOrphans] = useState<string[]>([])
  const form = useForm<CustomerValues>({ resolver: zodResolver(customerSchema), defaultValues: customerToValues(customer), mode: 'onTouched' })
  const { register, handleSubmit, formState, setError } = form
  const e = formState.errors

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    save.mutate(valuesToCustomerInput(v), {
      onSuccess: (saved) => {
        toast.success(customer ? 'Cliente actualizado' : `${saved.name} añadido a tus clientes`)
        onDone(false)
        onSaved?.(saved)
      },
      onError: (err) => handleFormError(err, setError, CUSTOMER_FIELD_NAMES, setOrphans),
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-4">
        <Field label="Nombre o razón social" required error={e.name?.message}>
          <Input autoComplete="off" maxLength={120} autoFocus {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono" error={e.phone?.message}>
            <Input type="tel" autoComplete="off" inputMode="tel" maxLength={30} className="tabular" {...register('phone')} />
          </Field>
          <Field label="Email" error={e.email?.message}>
            <Input type="email" autoComplete="off" maxLength={255} {...register('email')} />
          </Field>
        </div>
        <Field label="NIF / CIF" error={e.tax_id?.message} hint="Opcional. Se guarda en mayúsculas y sin espacios.">
          <Input autoComplete="off" maxLength={24} className="font-mono uppercase" {...register('tax_id')} />
        </Field>
        <Field label="Notas" error={e.notes?.message} hint="Preferencias, horario para llamarle, cómo paga…">
          <Textarea rows={3} maxLength={2000} {...register('notes')} />
        </Field>
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={save.isPending}>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={save.isPending} icon={<Check aria-hidden />}>
          {customer ? 'Guardar cambios' : 'Añadir cliente'}
        </Button>
      </DialogFooter>
    </form>
  )
}

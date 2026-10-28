import { TriangleAlert, X } from 'lucide-react'
import { useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { cn } from '@/lib/cn'
import { formatWhenInline, fromDateTimeLocal, isPastLocal, promisedShortcuts } from './orderUtils'

type WithPromised = { promised_at: string }

/** Fecha y hora prometidas al cliente, con atajos y aviso si ya ha pasado (saldrá como «Tarde»). */
export function PromisedAtField<T extends FieldValues & WithPromised>({ form, disabled }: { form: UseFormReturn<T>; disabled?: boolean }) {
  const f = form as unknown as UseFormReturn<WithPromised>
  const value = useWatch({ control: f.control, name: 'promised_at' }) ?? ''
  const error = f.formState.errors.promised_at?.message
  const set = (v: string) => f.setValue('promised_at', v, { shouldDirty: true, shouldValidate: true })
  const past = !!value && isPastLocal(value)

  return (
    <div className="space-y-2">
      <Field
        label="Fecha prometida"
        error={error}
        hint={value && !error ? `Entrega prevista: ${formatWhenInline(fromDateTimeLocal(value))}.` : 'Cuándo le has dicho al cliente que estará. Si pasa sin terminar, la orden sale como «Tarde».'}
      >
        <Input type="datetime-local" className="tabular" disabled={disabled} {...f.register('promised_at')} />
      </Field>
      {!disabled && (
        <div role="group" aria-label="Atajos de fecha prometida" className="flex flex-wrap gap-1.5">
          {promisedShortcuts().map((s) => (
            <button
              key={s.label}
              type="button"
              aria-pressed={value === s.value}
              onClick={() => set(s.value)}
              className={cn(
                'min-h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150',
                value === s.value ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {s.label}
            </button>
          ))}
          {value && (
            <button type="button" onClick={() => set('')} className="inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-xs text-fg-subtle hover:text-fg">
              <X aria-hidden className="size-3.5" />
              Sin fecha
            </button>
          )}
        </div>
      )}
      {past && !error && (
        <p className="flex items-start gap-1.5 text-xs text-warning" aria-live="polite">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          Esa hora ya ha pasado: si la orden no está lista, aparecerá como «Tarde».
        </p>
      )}
    </div>
  )
}

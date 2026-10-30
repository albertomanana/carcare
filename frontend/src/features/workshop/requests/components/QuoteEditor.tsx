import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { isApiError } from '@/api/client'
import type { RepairQuote, RepairQuoteInput } from '@/api/types'
import { LineItemsEditor } from '@/components/forms/LineItemsEditor'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/inputs'
import { formatDate, formatDecimal, formatMoney, toNumber } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { liveTotals } from '@/features/workshop/components/totals'
import { MAX_QUOTE_NOTE, QUOTE_FIELD_NAMES, quoteSchema, quoteToValues, stripErrorPrefix, type QuoteValues, validUntilPreview, valuesToQuoteInput } from './quoteForm'

export interface QuoteEditorProps {
  /** El botón de enviar vive fuera (pie del diálogo) y apunta a este id con `form=`. */
  formId: string
  /** IVA por defecto del taller (`settings.tax_rate`). */
  defaultTaxRate: string
  /** Versión de la que partir (p. ej. la que rechazó el cliente). */
  initial?: RepairQuote | null
  /** 'quote.' al aceptar con presupuesto (las claves 422 llegan como `quote.items.0…`); '' al enviar una versión. */
  errorPrefix?: '' | 'quote.'
  /** Llama a la API. Si lanza, el editor lleva los 422 a cada campo y el resto a un toast. */
  onSubmit: (input: RepairQuoteInput) => Promise<unknown>
  disabled?: boolean
}

/**
 * Editor del «Presupuesto (no es una factura)»: líneas con precio, IVA, validez en días y nota para el cliente.
 * Los totales se recalculan en céntimos con las mismas reglas que el servidor, que es quien guarda los definitivos.
 */
export function QuoteEditor({ formId, defaultTaxRate, initial, errorPrefix = '', onSubmit, disabled }: QuoteEditorProps) {
  const titleId = useId()
  const [orphans, setOrphans] = useState<string[]>([])
  const form = useForm<QuoteValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: quoteToValues(defaultTaxRate, initial),
  })
  const { register, formState } = form
  const errors = formState.errors
  const itemsError = errors.items?.message ?? errors.items?.root?.message
  const validDays = useWatch({ control: form.control, name: 'valid_days' })
  const validUntil = validUntilPreview(validDays)

  const submit = form.handleSubmit(async (values) => {
    setOrphans([])
    try {
      await onSubmit(valuesToQuoteInput(values))
    } catch (error) {
      const map = isApiError(error) ? stripErrorPrefix(error.errors, errorPrefix) : {}
      handleFormError(error, form.setError, QUOTE_FIELD_NAMES, setOrphans, map)
    }
  })

  return (
    <form id={formId} onSubmit={submit} noValidate aria-labelledby={titleId} className="space-y-6">
      <div>
        <h3 id={titleId} className="font-display text-base font-semibold text-fg-warm">
          Presupuesto <span className="font-normal text-fg-muted">(no es una factura)</span>
        </h3>
        <p className="mt-0.5 text-sm text-fg-muted">
          {initial
            ? `Partes de la versión ${initial.version}. El cliente verá la nueva tal cual; la anterior queda guardada.`
            : 'El cliente lo verá tal cual. Si después hay que cambiarlo, enviarás una versión nueva.'}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-fg">Líneas</p>
        <LineItemsEditor form={form} disabled={disabled} />
        {itemsError && (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            {itemsError}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="IVA" required error={errors.tax_rate?.message} hint="Por defecto, el del taller.">
          <Input inputMode="decimal" suffix="%" className="tabular" disabled={disabled} {...register('tax_rate')} />
        </Field>
        <Field
          label="Validez"
          required
          error={errors.valid_days?.message}
          hint={validUntil ? `Si lo envías hoy, vale hasta el ${formatDate(validUntil, 'long')}.` : 'Entre 1 y 90 días.'}
        >
          <Input inputMode="numeric" suffix="días" className="tabular" disabled={disabled} {...register('valid_days')} />
        </Field>
      </div>

      <Field label="Nota para el cliente" error={errors.note?.message} hint="Opcional. Qué incluye, qué no o cuándo podrías empezar.">
        <Textarea rows={3} maxLength={MAX_QUOTE_NOTE} disabled={disabled} {...register('note')} />
      </Field>

      <QuoteLiveTotals form={form} />
      <FormErrors messages={orphans} />
    </form>
  )
}

/** Subtotal, IVA y total con IVA mientras se editan las líneas (sin caja: R3). */
function QuoteLiveTotals({ form }: { form: UseFormReturn<QuoteValues> }) {
  const items = useWatch({ control: form.control, name: 'items' }) ?? []
  const taxRate = useWatch({ control: form.control, name: 'tax_rate' }) ?? ''
  const t = liveTotals(items, taxRate.replace('%', ''))
  const rate = toNumber(t.taxRate.replace(',', '.'))
  return (
    <dl aria-live="polite" className="ml-auto max-w-sm space-y-1 border-t border-line pt-3 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-fg-muted">Subtotal</dt>
        <dd className="text-fg tabular">{formatMoney(t.subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-fg-muted">IVA{rate !== null ? ` (${formatDecimal(rate, Number.isInteger(rate) ? 0 : 2)} %)` : ''}</dt>
        <dd className="text-fg tabular">{formatMoney(t.tax)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
        <dt className="font-medium text-fg">Total con IVA</dt>
        <dd className="text-base font-semibold text-fg tabular">{formatMoney(t.total)}</dd>
      </div>
    </dl>
  )
}

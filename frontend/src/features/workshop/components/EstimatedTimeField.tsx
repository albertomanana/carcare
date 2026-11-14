import { useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/orderTiming'

type WithEstimate = { estimated_minutes: string }

/** Tiempos de mano de obra habituales (min). El contrato admite de 5 a 6000. */
export const ESTIMATE_PRESETS = [30, 60, 90, 120, 180, 240, 360, 480] as const

/**
 * Tiempo estimado de mano de obra: un toque en lugar de escribir. Con él, el taller ve el avance de la reparación
 * frente a lo previsto; sin él, solo el tiempo que lleva. Si la orden trae un valor que no está en la lista, se añade.
 */
export function EstimatedTimeField<T extends FieldValues & WithEstimate>({ form, disabled }: { form: UseFormReturn<T>; disabled?: boolean }) {
  const f = form as unknown as UseFormReturn<WithEstimate>
  const value = useWatch({ control: f.control, name: 'estimated_minutes' }) ?? ''
  const error = f.formState.errors.estimated_minutes?.message
  const set = (v: string) => f.setValue('estimated_minutes', v, { shouldDirty: true, shouldValidate: true })
  const current = Number(value)
  const options = value && !ESTIMATE_PRESETS.includes(current as (typeof ESTIMATE_PRESETS)[number]) ? [...ESTIMATE_PRESETS, current].sort((a, b) => a - b) : ESTIMATE_PRESETS
  const chip = 'min-h-12 rounded-full border px-3 text-xs font-medium transition-colors duration-150 disabled:opacity-50 lg:min-h-9'
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-fg">Tiempo estimado</legend>
      <p id="estimado-ayuda" className="text-xs text-fg-muted">
        Mano de obra prevista. En el taller verás cuánto lleva en reparación frente a esto.
      </p>
      <div role="group" aria-describedby="estimado-ayuda" className="flex flex-wrap gap-1.5">
        {options.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={current === m && !!value}
            onClick={() => set(String(m))}
            className={cn(chip, current === m && value ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg')}
          >
            <span className="tabular">{formatDuration(m * 60)}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!value}
          onClick={() => set('')}
          className={cn(chip, !value ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg')}
        >
          Sin estimar
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}

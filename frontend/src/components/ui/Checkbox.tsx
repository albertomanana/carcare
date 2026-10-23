import { Check } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId } from 'react'
import { cn } from '@/lib/cn'

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

/** Casilla nativa con estilo; toda la fila es clicable (≥ 44 px). */
export function Checkbox({ label, description, className, id: idProp, ...props }: CheckboxProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <label htmlFor={id} className={cn('group flex min-h-11 cursor-pointer items-start gap-3 py-2', props.disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          className="peer size-5 cursor-pointer appearance-none rounded-[6px] border border-line-strong bg-surface-2 transition-colors checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          {...props}
        />
        <Check aria-hidden className="pointer-events-none absolute size-3.5 text-on-accent opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>}
      </span>
    </label>
  )
}

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
  /** Oculta visualmente la etiqueta (sigue siendo el nombre accesible). */
  hideLabel?: boolean
}

export function Switch({ checked, onCheckedChange, label, description, disabled, className, hideLabel }: SwitchProps) {
  const id = useId()
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-3', className)}>
      <label htmlFor={id} className={cn('min-w-0 cursor-pointer', hideLabel && 'sr-only')}>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-3',
          disabled && 'opacity-50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-5 rounded-full shadow transition-transform duration-200 ease-out-soft',
            checked ? 'translate-x-6 bg-on-accent' : 'translate-x-1 bg-fg-muted',
          )}
        />
      </button>
    </div>
  )
}

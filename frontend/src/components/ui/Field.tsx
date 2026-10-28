import { CircleAlert } from 'lucide-react'
import { type ReactNode, useId } from 'react'
import { cn } from '@/lib/cn'
import { FieldContext } from './field-context'

export interface FieldProps {
  label: ReactNode
  children: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  /** Etiqueta solo para lectores de pantalla. */
  hideLabel?: boolean
  /** Acción a la derecha de la etiqueta (p. ej. "¿Olvidaste…?"). */
  labelAside?: ReactNode
  id?: string
  className?: string
}

/** Etiqueta + control + ayuda + error junto al campo, con ids accesibles. */
export function Field({ label, children, hint, error, required, hideLabel, labelAside, id: idProp, className }: FieldProps) {
  const autoId = useId()
  const id = idProp ?? `f${autoId.replace(/:/g, '')}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className={cn('flex items-baseline justify-between gap-2', hideLabel && 'sr-only')}>
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
          {required && (
            <span className="text-fg-subtle" aria-hidden>
              {' '}
              *
            </span>
          )}
        </label>
        {labelAside}
      </div>
      <FieldContext.Provider value={{ id, describedBy, invalid: !!error, required }}>{children}</FieldContext.Provider>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-medium text-danger">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * Agrupa campos relacionados con leyenda accesible. La `<legend>` va como primer hijo del `<fieldset>`: solo así da
 * nombre al grupo para los lectores de pantalla.
 */
export function Fieldset({ legend, description, children, className }: { legend: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="p-0 font-display text-base font-semibold text-fg-warm">{legend}</legend>
      {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </fieldset>
  )
}

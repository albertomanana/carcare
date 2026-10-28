import { ChevronDown, CircleAlert } from 'lucide-react'
import { useId } from 'react'
import type { Bay } from '@/api/types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Select } from '@/components/ui/inputs'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { buttonClasses } from '@/components/ui/variants'
import { cn } from '@/lib/cn'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { bayOptions, shortOrderNumber } from './orderUtils'

export interface BayPickerProps {
  bays: Bay[] | undefined
  loading?: boolean
  /** Orden que se está editando (su propio elevador no cuenta como ocupado). */
  currentOrderId?: number | null
  /** Elevador elegido; null = sin elevador (zona de espera). */
  value: number | null
  onChange: (bay: number | null) => void
  /**
   * select: desplegable nativo para formularios (no aplica nada hasta guardar).
   * action: menú que aplica el cambio al elegir (detalle de la orden); con el teclado, las flechas solo recorren
   * las opciones y Intro elige, así que no se mueve el coche por accidente.
   */
  mode: 'select' | 'action'
  label: string
  description?: string
  disabled?: boolean
  /** Muestra un indicador de carga en el botón (modo action). */
  busy?: boolean
  error?: string | null
  className?: string
}

interface Item {
  key: string
  bay: number | null
  label: string
  occupied: boolean
}

/**
 * Elevador del taller con un selector (plan UX 5.4): "Sin elevador" o "Elevador n", con los ocupados por otra orden
 * a la vista pero deshabilitados. Si los datos estaban desfasados, el servidor responde 409 y el error sale aquí.
 */
export function BayPicker({ bays, loading, currentOrderId, value, onChange, mode, label, description, disabled, busy, error, className }: BayPickerProps) {
  const id = useId()
  const errorId = `${id}-error`
  const descId = `${id}-desc`

  if (loading || !bays) {
    return (
      <div className={cn('space-y-1.5', className)} role="status" aria-live="polite">
        <span className="sr-only">Cargando elevadores…</span>
        <div aria-hidden className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-56 max-w-full" />
        </div>
      </div>
    )
  }

  const items: Item[] = [
    { key: 'none', bay: null, label: 'Sin elevador (en espera)', occupied: false },
    ...bayOptions(bays, currentOrderId).map((o) => ({
      key: String(o.number),
      bay: o.number,
      label: o.occupiedBy
        ? `Elevador ${o.number} · ocupado por ${shortOrderNumber(o.occupiedBy.number)} (${WORK_ORDER_STATUS[o.occupiedBy.status].label.toLowerCase()})`
        : `Elevador ${o.number} · libre`,
      occupied: !!o.occupiedBy,
    })),
  ]
  const describedBy = [description ? descId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  const current = value === null ? 'Sin elevador' : `Elevador ${value}`

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      {mode === 'select' ? (
        <>
          <label htmlFor={id} className="block text-sm font-medium text-fg">
            {label}
          </label>
          <Select
            id={id}
            value={value === null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          >
            {items.map((it) => (
              <option key={it.key} value={it.bay === null ? '' : String(it.bay)} disabled={it.occupied}>
                {it.label}
              </option>
            ))}
          </Select>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span id={`${id}-label`} className="text-sm text-fg-muted">
            {label}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={disabled}
              aria-labelledby={`${id}-label ${id}`}
              aria-describedby={describedBy}
              className={buttonClasses({ size: 'sm' })}
            >
              {busy && <Spinner className="size-3.5" />}
              <span id={id}>{current}</span>
              <ChevronDown aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
              <DropdownMenuLabel>Mover el coche a</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={value === null ? 'none' : String(value)} onValueChange={(v) => onChange(v === 'none' ? null : Number(v))}>
                {items.map((it) => (
                  <DropdownMenuRadioItem key={it.key} value={it.key} disabled={it.occupied}>
                    {it.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {description && (
        <p id={descId} className="text-xs text-fg-subtle">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

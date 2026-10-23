import { CircleAlert, SquareParking, Warehouse } from 'lucide-react'
import { useId } from 'react'
import type { Bay } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { bayOptions } from './orderUtils'

export interface BayPickerProps {
  bays: Bay[] | undefined
  loading?: boolean
  /** Orden que se está editando (su propio elevador no cuenta como ocupado). */
  currentOrderId?: number | null
  /** Elevador elegido; null = sin elevador (zona de espera). */
  value: number | null
  onChange: (bay: number | null) => void
  /**
   * select: grupo de radios para formularios (las flechas cambian la selección, sin efectos).
   * action: botones que aplican el cambio al pulsarlos (detalle de la orden).
   */
  mode: 'select' | 'action'
  label: string
  description?: string
  disabled?: boolean
  error?: string | null
  className?: string
}

/**
 * Elevadores del taller con su ocupación. Los ocupados por otra orden se muestran pero no se pueden
 * elegir; si los datos estaban desfasados, el servidor responde 409 y el error se muestra aquí.
 */
export function BayPicker({ bays, loading, currentOrderId, value, onChange, mode, label, description, disabled, error, className }: BayPickerProps) {
  const name = useId()
  const errorId = `${name}-error`
  const options = bayOptions(bays, currentOrderId)

  if (loading || !bays) {
    return (
      <div className={cn('space-y-2', className)} role="status" aria-live="polite">
        <span className="sr-only">Cargando elevadores…</span>
        <div aria-hidden className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-card" />
          ))}
        </div>
      </div>
    )
  }

  const items: { key: string; bay: number | null; title: string; detail: string; occupied: boolean }[] = [
    { key: 'none', bay: null, title: 'Sin elevador', detail: 'Zona de espera', occupied: false },
    ...options.map((o) => {
      const own = currentOrderId != null && bays.find((b) => b.number === o.number)?.work_order?.id === currentOrderId
      return {
        key: String(o.number),
        bay: o.number,
        title: `Elevador ${o.number}`,
        detail: o.occupiedBy
          ? `${o.occupiedBy.number.replace(/^OT-\d{4}-/, 'OT ')} · ${WORK_ORDER_STATUS[o.occupiedBy.status].label}`
          : own
            ? 'Aquí está este coche'
            : 'Libre',
        occupied: !!o.occupiedBy,
      }
    }),
  ]

  return (
    <fieldset className={cn('@container min-w-0', className)} aria-describedby={error ? errorId : undefined}>
      <legend className="text-sm font-medium text-fg">{label}</legend>
      {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2 @lg:grid-cols-3" role={mode === 'action' ? 'group' : undefined}>
        {items.map((it) => {
          const selected = value === it.bay
          const Icon = it.bay === null ? SquareParking : Warehouse
          const blocked = it.occupied || disabled
          const body = (
            <>
              <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                <Icon aria-hidden className={cn('size-4 shrink-0', selected ? 'text-accent-ink' : 'text-fg-subtle')} />
                <span className="truncate">{it.title}</span>
              </span>
              <span className={cn('mt-0.5 block truncate text-xs', it.occupied ? 'text-warning' : 'text-fg-muted')}>
                {it.occupied && <span className="sr-only">Ocupado por </span>}
                {it.occupied && <span aria-hidden>Ocupado · </span>}
                {it.detail}
                {selected && mode === 'action' && <span className="sr-only"> (actual)</span>}
              </span>
            </>
          )
          const cls = cn(
            'block min-h-16 w-full min-w-0 rounded-card border px-3 py-2.5 text-left transition-colors duration-150',
            selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
            !selected && !blocked && 'cursor-pointer hover:border-line-strong hover:bg-surface-2/60',
            it.occupied && 'border-dashed bg-surface-2/40',
            blocked && !selected && 'cursor-not-allowed opacity-70',
          )
          if (mode === 'action') {
            return (
              <button
                key={it.key}
                type="button"
                aria-pressed={selected}
                disabled={blocked || selected}
                onClick={() => onChange(it.bay)}
                className={cn(cls, selected && 'disabled:opacity-100')}
                title={it.occupied ? `Ocupado por ${it.detail}` : undefined}
              >
                {body}
              </button>
            )
          }
          return (
            <label key={it.key} className={cn(cls, 'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent')}>
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={selected}
                disabled={blocked}
                onChange={() => onChange(it.bay)}
                aria-invalid={error && selected ? true : undefined}
              />
              {body}
            </label>
          )
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </fieldset>
  )
}

import { cn } from '@/lib/cn'
import { type Tone, TONE_CLASSES } from '@/lib/status'

export interface ProgressProps {
  /** 0..1 (puede pasar de 1: se muestra lleno). null ⇒ indeterminado/sin datos. */
  value: number | null
  tone?: Tone
  label: string
  className?: string
  /** Texto del valor para lectores de pantalla. */
  valueText?: string
}

export function Progress({ value, tone = 'accent', label, className, valueText }: ProgressProps) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(pct)}
      aria-valuetext={valueText ?? (value === null ? 'Sin datos suficientes' : `${Math.round(value * 100)} %`)}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      {value !== null && (
        <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out-soft', TONE_CLASSES[tone].solid)} style={{ width: `${pct}%` }} />
      )}
    </div>
  )
}

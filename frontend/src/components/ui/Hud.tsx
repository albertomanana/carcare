import type { ComponentProps, ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { type Tone, TONE_CLASSES } from '@/lib/status'

/** Panel flotante de cristal (`.hud-panel`): el contenedor estándar del HUD sobre el diorama. */
export function Panel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('hud-panel', className)} {...props} />
}

const CHIP_TONE: Record<Tone, string> = {
  neutral: '',
  accent: 'chip-accent',
  ok: 'chip-ok',
  warning: 'chip-warning',
  danger: 'chip-danger',
  info: 'chip-info',
}

export interface ChipProps extends ComponentProps<'span'> {
  tone?: Tone
  icon?: ReactNode
}

/** Insignia en píldora (`.chip`) con icono y texto. Para un filtro pulsable usa `<button className="chip" aria-pressed>`. */
export function Chip({ tone = 'neutral', icon, className, children, ...props }: ChipProps) {
  return (
    <span className={cn('chip', CHIP_TONE[tone], className)} {...props}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

export interface MissionProps {
  /** Estado de la tarjeta: barra de color a la izquierda. El estado va además con icono y texto (nunca solo color). */
  tone?: Tone
  /** Icono del estado o de la tarea. */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Contenido a la derecha: plazo, importe, insignia. */
  trailing?: ReactNode
  /** Elemento que se pinta: `div` (por defecto), un enlace (`Link`) o `button`. Pásale `to`/`onClick` como props. */
  as?: ElementType
  className?: string
  [key: string]: unknown
}

/**
 * Tarjeta de misión (`.mission`): un aviso o tarea real con su estado. Solo con datos reales (regla 2): un recordatorio
 * vencido, una orden tarde, un documento por caducar. Nada de puntos ni logros inventados.
 */
export function Mission({ tone = 'neutral', icon, title, description, trailing, as: As = 'div', className, ...props }: MissionProps) {
  return (
    <As className={cn('mission flex items-center gap-3', className)} data-tone={tone === 'neutral' ? undefined : tone} {...props}>
      {icon && <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5', TONE_CLASSES[tone].soft)}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg-warm">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right text-sm font-semibold text-fg">{trailing}</span>}
    </As>
  )
}

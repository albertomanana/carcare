import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/status'

export interface ProgressProps {
  /** 0..1 (puede pasar de 1: se muestra lleno). null ⇒ indeterminado/sin datos. */
  value: number | null
  tone?: Tone
  label: string
  className?: string
  /** Texto del valor para lectores de pantalla. */
  valueText?: string
  /** Número de segmentos (10 por defecto). 1 ⇒ barra continua. */
  segments?: number
}

/** Color de relleno de cada tono (la variable `--seg` de `.segbar`). */
const SEG_COLOR: Record<Tone, string> = {
  neutral: 'var(--line-strong)',
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
}

/**
 * Barra de progreso segmentada (`.segbar`): cada segmento se rellena en proporción, de modo que la cifra es exacta
 * (el último puede quedar a medias). El valor va también en `aria-valuenow`; el color nunca es la única señal porque
 * lo acompaña el texto de la pantalla que la usa.
 */
export function Progress({ value, tone = 'accent', label, className, valueText, segments = 10 }: ProgressProps) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100
  const n = Math.max(1, Math.round(segments))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(pct)}
      aria-valuetext={valueText ?? (value === null ? 'Sin datos suficientes' : `${Math.round(value * 100)} %`)}
      className={cn('segbar', className)}
      style={{ '--seg': SEG_COLOR[tone] } as CSSProperties}
      data-tone={tone}
    >
      {Array.from({ length: n }, (_, i) => {
        const fill = value === null ? 0 : Math.max(0, Math.min(1, (pct / 100) * n - i))
        return <span key={i} aria-hidden style={{ '--f': fill, '--i': i } as CSSProperties} />
      })}
    </div>
  )
}

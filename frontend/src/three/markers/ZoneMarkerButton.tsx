/**
 * Marcador de zona: botón HTML accesible (no un dibujo en el lienzo). Lo usan el visor 3D (dentro de <Html>)
 * y el mapa 2D de respaldo. El estado se comunica con color + icono + texto, nunca solo con color.
 */
import { forwardRef } from 'react'
import type { Zone, ZoneStatus } from '@/api/types'
import { ZONE_ICON } from '@/lib/labels'
import { zoneDescriptor, type Tone } from '@/lib/status'
import { luminance } from '../color'
import type { ThemeTokens } from '../env'

export const ZONE_DISCLAIMER = 'según tus intervalos, no medido'

export function toneColor(tone: Tone, t: ThemeTokens): string {
  switch (tone) {
    case 'danger':
      return t.danger
    case 'warning':
      return t.warning
    case 'ok':
      return t.ok
    case 'info':
      return t.info
    case 'accent':
      return t.accent
    default:
      return t.fgSubtle
  }
}

export function zoneTone(z: Pick<ZoneStatus, 'state' | 'basis'>): Tone {
  return zoneDescriptor(z).tone
}

export interface ZoneMarkerButtonProps {
  status: ZoneStatus
  selected: boolean
  tokens: ThemeTokens
  onSelect: (zone: Zone | null) => void
  /** Etiqueta siempre visible (p. ej. en el mapa 2D de pantallas anchas). */
  showLabel?: boolean
}

export const ZoneMarkerButton = forwardRef<HTMLButtonElement, ZoneMarkerButtonProps>(function ZoneMarkerButton(
  { status, selected, tokens, onSelect, showLabel = false },
  ref,
) {
  const d = zoneDescriptor(status)
  const ZoneIcon = ZONE_ICON[status.zone]
  const StateIcon = d.icon
  const bg = toneColor(d.tone, tokens)
  const fg = luminance(bg) > 0.33 ? '#111518' : '#ffffff'
  const unknown = d.tone === 'neutral'
  const labelVisible = selected || showLabel
  return (
    <button
      ref={ref}
      type="button"
      data-zone={status.zone}
      aria-pressed={selected}
      aria-label={`${status.label}: ${d.label} (${ZONE_DISCLAIMER})`}
      title={`${status.label} · ${d.label}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(selected ? null : status.zone)
      }}
      className={[
        'group relative flex select-none items-center gap-1.5 rounded-full border p-[3px] text-xs font-medium whitespace-nowrap shadow-lg backdrop-blur-md',
        'transition-[transform,background-color,box-shadow] duration-200 motion-reduce:transition-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected ? 'scale-105 border-transparent bg-surface text-fg' : 'border-line/70 bg-surface/85 text-fg hover:bg-surface',
      ].join(' ')}
      style={selected ? { boxShadow: `0 0 0 2px ${bg}, 0 10px 30px -8px ${bg}` } : undefined}
    >
      <span
        className="relative grid size-7 shrink-0 place-items-center rounded-full"
        style={{
          background: unknown ? 'transparent' : bg,
          color: unknown ? tokens.fgMuted : fg,
          border: unknown ? `2px dashed ${tokens.fgSubtle}` : undefined,
        }}
        aria-hidden
      >
        <ZoneIcon className="size-3.5" strokeWidth={2.2} />
        {!unknown && (
          <span
            className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full ring-2"
            style={{ background: tokens.surface, color: bg, ['--tw-ring-color' as string]: tokens.surface }}
          >
            <StateIcon className="size-2.5" strokeWidth={3} />
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={
          labelVisible
            ? 'pr-2.5'
            : 'sr-only group-hover:not-sr-only group-hover:pr-2.5 group-focus-visible:not-sr-only group-focus-visible:pr-2.5'
        }
      >
        {status.label}
        {selected && <span className="ml-1.5 font-normal text-fg-muted">· {d.label}</span>}
      </span>
    </button>
  )
})

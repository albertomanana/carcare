import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { type StatusDescriptor, type Tone, TONE_CLASSES } from '@/lib/status'

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: Tone
  icon?: ReactNode
  size?: 'sm' | 'md'
}

export function Badge({ tone = 'neutral', icon, size = 'md', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full font-medium [&_svg]:shrink-0',
        size === 'sm' ? 'h-5 px-2 text-[11px] [&_svg]:size-3' : 'h-6 px-2.5 text-xs [&_svg]:size-3.5',
        TONE_CLASSES[tone].soft,
        className,
      )}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Píldora de estado: icono + texto (nunca solo color). */
export function StatusPill({ status, size, className, label }: { status: StatusDescriptor; size?: 'sm' | 'md'; className?: string; label?: string }) {
  const Icon = status.icon
  return (
    <Badge tone={status.tone} size={size} icon={<Icon aria-hidden />} className={className}>
      {label ?? status.label}
    </Badge>
  )
}

/** Matrícula con aspecto de placa. */
export function Plate({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return null
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-[5px] border border-line-strong bg-surface-2 px-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-fg',
        className,
      )}
    >
      <span className="mr-1.5 h-full w-1 rounded-l-[3px] bg-info/70" aria-hidden />
      <span className="sr-only">Matrícula </span>
      {value}
    </span>
  )
}

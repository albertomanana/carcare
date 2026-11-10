import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatPlate } from '@/lib/format'
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
        // etiqueta de muestra: rectángulo de esquina corta, Archivo estrecho en versalitas
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-[5px] font-semibold uppercase tracking-[0.07em] [font-stretch:78%] [&_svg]:shrink-0',
        size === 'sm' ? 'h-5 px-1.5 text-[11px] [&_svg]:size-3' : 'h-6 px-2 text-xs [&_svg]:size-3.5',
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

/** Matrícula como texto ("4821 KTB"), sin imitar una placa (regla R6 del informe de UX). */
export function Plate({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return null
  return (
    <span className={cn('whitespace-nowrap font-semibold uppercase tracking-[0.06em] text-fg-muted [font-stretch:82%]', className)}>
      <span className="sr-only">Matrícula </span>
      {formatPlate(value)}
    </span>
  )
}

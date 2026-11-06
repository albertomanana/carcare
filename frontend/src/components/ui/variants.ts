import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Teclas con relieve: el botón tiene canto (box-shadow apilado). Al pasar el ratón sube y el canto crece; al pulsar se hunde
// hasta casi quedar a ras (respuesta inmediata, 100 ms); al soltar vuelve. Solo se anima transform y sombra.
const BASE =
  'group relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium ' +
  'transition-[background-color,color,border-color,box-shadow,transform,translate,scale,filter] duration-200 ease-out-soft ' +
  'active:duration-100 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

const KEY_PRIMARY =
  '[box-shadow:0_1px_0_rgb(255_255_255/0.5)_inset,0_4px_0_var(--accent-edge),0_12px_18px_-8px_hsl(var(--shadow-color)/0.7)] ' +
  'hover:-translate-y-0.5 hover:[box-shadow:0_1px_0_rgb(255_255_255/0.5)_inset,0_6px_0_var(--accent-edge),0_16px_22px_-8px_hsl(var(--shadow-color)/0.75)] ' +
  'active:translate-y-[3px] active:[box-shadow:0_1px_0_rgb(255_255_255/0.4)_inset,0_1px_0_var(--accent-edge),0_3px_6px_-3px_hsl(var(--shadow-color)/0.6)]'
const KEY_FLAT =
  '[box-shadow:0_1px_0_rgb(255_255_255/0.05)_inset,0_3px_0_var(--surface-3),0_8px_12px_-8px_hsl(var(--shadow-color)/0.6)] ' +
  'hover:-translate-y-px hover:[box-shadow:0_1px_0_rgb(255_255_255/0.07)_inset,0_4px_0_var(--surface-3),0_12px_16px_-8px_hsl(var(--shadow-color)/0.65)] ' +
  'active:translate-y-0.5 active:[box-shadow:0_1px_0_rgb(255_255_255/0.04)_inset,0_1px_0_var(--surface-3)]'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `bg-accent text-on-accent hover:brightness-[1.04] ${KEY_PRIMARY}`,
  secondary: `border border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3 ${KEY_FLAT}`,
  outline: 'border border-line-strong bg-transparent text-fg hover:border-fg-subtle hover:bg-surface-2 active:scale-[0.97]',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg active:scale-[0.97]',
  danger: 'bg-danger text-on-danger hover:brightness-110 active:scale-[0.97]',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-11 px-3 text-sm md:h-9',
  md: 'h-11 px-4 text-sm md:h-10',
  lg: 'h-12 px-6 text-base',
}

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  className,
  block,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string; block?: boolean } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className)
}

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'size-11 md:size-9',
  md: 'size-11 md:size-10',
  lg: 'size-12',
}

export function iconButtonClasses({
  variant = 'ghost',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], ICON_SIZES[size], 'px-0', className)
}

export const inputClasses =
  'h-11 w-full min-w-0 rounded-control border border-line-strong bg-surface-2 px-3 text-base text-fg md:h-10 md:text-sm ' +
  'placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-fg-subtle focus-visible:border-accent focus-visible:outline-offset-0 ' +
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-surface'

export const cardClasses = 'surface-card rounded-card border border-line'

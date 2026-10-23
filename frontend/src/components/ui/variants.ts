import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium ' +
  'transition-[background-color,color,border-color,box-shadow,transform,filter] duration-150 ease-out-soft ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset,0_8px_24px_-12px_var(--glow)] hover:brightness-[0.96] active:brightness-90',
  secondary: 'border border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3',
  outline: 'border border-line-strong bg-transparent text-fg hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-on-danger hover:brightness-110 active:brightness-95',
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

export const cardClasses = 'rounded-card border border-line bg-surface'

import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Botones de «Apex Telemetry»: planos y nítidos. La primaria es naranja con texto oscuro (el blanco no llega a AA sobre
// #FF5500); la secundaria, una superficie con filo. Responden al pulsar encogiéndose un 3 %. 48 px de alto hasta 1024 px.
const BASE =
  'group relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

const FLAT = 'transition-[background-color,color,border-color,box-shadow,filter,scale] duration-150 ease-out-soft active:scale-[0.97]'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${FLAT} bg-accent text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_8px_18px_-10px_var(--accent)] hover:brightness-110`,
  secondary: `${FLAT} border border-line-strong/45 bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3`,
  outline: `${FLAT} border border-line-strong bg-transparent text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-ink`,
  ghost: `${FLAT} text-fg-muted hover:bg-accent-soft hover:text-fg`,
  danger: `${FLAT} bg-danger text-on-danger hover:brightness-110`,
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-12 px-3.5 text-sm lg:h-9',
  md: 'h-12 px-5 text-sm lg:h-10',
  lg: 'h-12 px-7 text-base',
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
  sm: 'size-12 lg:size-9',
  md: 'size-12 lg:size-10',
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
  'h-12 w-full min-w-0 rounded-control border border-line-strong bg-surface-2 px-3.5 text-base font-medium text-fg lg:h-10 lg:text-sm ' +
  'placeholder:font-normal placeholder:text-fg-subtle transition-[border-color,box-shadow,background-color] duration-150 ' +
  'hover:border-fg-subtle focus-visible:border-accent focus-visible:bg-surface focus-visible:outline-offset-0 ' +
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-surface'

export const cardClasses = 'surface-card rounded-card border border-line'

import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Botones «gordos» (mundo «Diorama»): la primaria es una pieza de azul eléctrico con brillo arriba, canto abajo y sombra
// blanda; la secundaria, una ficha blanca con su canto. Se hunden al pulsar (`.chunky` en index.css). Esquinas xl.
const BASE =
  'group relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-bold ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

const FLAT = 'transition-[background-color,color,border-color,box-shadow,translate,scale] duration-150 ease-out-soft active:scale-[0.97]'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'chunky chunky-accent bg-accent text-on-accent',
  secondary: 'chunky border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2',
  outline: `${FLAT} border-2 border-line-strong bg-transparent text-fg hover:border-accent hover:bg-accent-soft hover:text-accent-ink`,
  ghost: `${FLAT} text-fg-muted hover:bg-accent-soft hover:text-fg`,
  danger: 'chunky chunky-danger bg-danger text-on-danger',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-11 px-3.5 text-sm md:h-9',
  md: 'h-11 px-5 text-sm md:h-10',
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
  'h-11 w-full min-w-0 rounded-control border border-line-strong bg-surface-2 px-3.5 text-base font-medium text-fg shadow-[inset_0_2px_3px_hsl(var(--shadow-color)/0.06)] md:h-10 md:text-sm ' +
  'placeholder:font-normal placeholder:text-fg-subtle transition-[border-color,box-shadow,background-color] duration-150 ' +
  'hover:border-fg-subtle focus-visible:border-accent focus-visible:bg-surface focus-visible:outline-offset-0 ' +
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-surface'

export const cardClasses = 'surface-card rounded-card border border-line'

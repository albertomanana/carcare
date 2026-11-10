import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Botones lacados (mundo «Carta de colores»): la primaria es una muestra de azul de calibración con brillo arriba y canto
// abajo; la secundaria, cartulina. Respuesta al pulsar con scale(0.97) en 100 ms (Emil); solo se animan transform, color y sombra.
const BASE =
  'group relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium ' +
  'transition-[background-color,color,border-color,box-shadow,transform,scale,filter] duration-200 ease-out-soft ' +
  'active:scale-[0.97] active:duration-100 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

const LACQUER =
  '[background-image:linear-gradient(180deg,rgb(255_255_255/0.18),transparent_60%)] ' +
  '[box-shadow:inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-1px_0_rgb(0_0_0/0.28),0_6px_14px_-8px_hsl(var(--shadow-color)/0.75)] ' +
  'hover:brightness-110 active:[box-shadow:inset_0_1px_0_rgb(255_255_255/0.2),inset_0_-1px_0_rgb(0_0_0/0.2),0_2px_6px_-4px_hsl(var(--shadow-color)/0.7)]'
const CARD_STOCK =
  '[box-shadow:inset_0_1px_0_var(--sheen),0_1px_0_var(--line),0_6px_12px_-10px_hsl(var(--shadow-color)/0.55)] ' +
  'active:[box-shadow:inset_0_1px_0_var(--sheen),0_1px_2px_-1px_hsl(var(--shadow-color)/0.4)]'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `bg-accent text-on-accent ${LACQUER}`,
  secondary: `border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2 ${CARD_STOCK}`,
  outline: 'border border-line-strong bg-transparent text-fg hover:border-fg-subtle hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: `bg-danger text-on-danger ${LACQUER}`,
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
  'h-11 w-full min-w-0 rounded-control border border-line-strong bg-surface px-3 text-base text-fg md:h-10 md:text-sm ' +
  'placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-fg-subtle focus-visible:border-accent focus-visible:outline-offset-0 ' +
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-surface'

export const cardClasses = 'surface-card rounded-card border border-line'

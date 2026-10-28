import type { ComponentProps, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { useClaimPrimaryAction } from './primary-action'
import { Spinner } from './Spinner'
import { buttonClasses, iconButtonClasses, type ButtonSize, type ButtonVariant } from './variants'

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  block?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  /**
   * Solo para `variant="primary"`: se oculta en el móvil porque la barra inferior ya ofrece la misma acción
   * ("+ Registrar"). Así no hay dos primarias a la vez (regla R1).
   */
  hideOnMobile?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  block,
  icon,
  iconRight,
  className,
  children,
  disabled,
  type = 'button',
  hideOnMobile,
  ...props
}: ButtonProps) {
  useClaimPrimaryAction(variant === 'primary' && !hideOnMobile)
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className: hideOnMobile ? `max-md:hidden ${className ?? ''}` : className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconRight}
    </button>
  )
}

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

/** Enlace con aspecto de botón (navegación, no acción). */
export function ButtonLink({ variant = 'secondary', size = 'md', block, icon, iconRight, className, children, ...props }: ButtonLinkProps) {
  useClaimPrimaryAction(variant === 'primary')
  return (
    <Link className={buttonClasses({ variant, size, block, className: typeof className === 'string' ? className : undefined })} {...props}>
      {icon}
      {children}
      {iconRight}
    </Link>
  )
}

export interface IconButtonProps extends ComponentProps<'button'> {
  /** Obligatorio: nombre accesible del botón. */
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function IconButton({ label, variant = 'ghost', size = 'md', loading, className, children, type = 'button', disabled, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClasses({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

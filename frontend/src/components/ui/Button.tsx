import type { ComponentProps, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Spinner } from './Spinner'
import { buttonClasses, iconButtonClasses, type ButtonSize, type ButtonVariant } from './variants'

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  block?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
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
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
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

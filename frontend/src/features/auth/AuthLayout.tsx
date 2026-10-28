import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { ThemeToggle } from '@/components/layout/UserMenu'

/**
 * Pantallas de acceso (entrar, registro, recuperar y restablecer la contraseña):
 * una sola columna centrada con el logotipo, el título, el formulario y el enlace alternativo.
 */
export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-4 sm:px-8">
      <header className="mx-auto flex h-16 w-full max-w-[26rem] items-center justify-between">
        <Link to="/" className="rounded-control" aria-label="CarCare, volver a la portada">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main id="contenido" className="flex flex-1 justify-center pb-10 pt-6 sm:pt-12">
        <div className="w-full max-w-[26rem] animate-rise">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg text-balance sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 text-fg-muted">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-fg-muted">{footer}</div>}
        </div>
      </main>
      <p className="mx-auto w-full max-w-[26rem] pb-6 text-xs text-fg-subtle">
        CarCare guarda el historial, los gastos y los vencimientos de tus vehículos o los de tu taller.
      </p>
    </div>
  )
}

/** Campo de contraseña con botón para mostrarla. */
export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-1 top-1/2 grid h-9 -translate-y-1/2 place-items-center rounded-control px-2.5 text-xs font-medium text-fg-muted hover:bg-surface-3 hover:text-fg"
      aria-pressed={visible}
    >
      {visible ? 'Ocultar' : 'Mostrar'}
    </button>
  )
}

/** Aviso de error del formulario (no de un campo), con la cuenta atrás si la hay. */
export function FormAlert({ children, lockedFor = 0 }: { children: ReactNode; lockedFor?: number }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-card border border-danger/40 bg-danger-soft p-3.5 text-sm text-fg">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
      <span className="min-w-0">
        {children}
        {lockedFor > 0 && <span className="mt-1 block text-fg-muted tabular">Podrás volver a intentarlo en {lockedFor} s.</span>}
      </span>
    </div>
  )
}

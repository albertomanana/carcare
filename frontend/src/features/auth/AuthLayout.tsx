import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { ThemeToggle } from '@/components/layout/UserMenu'
import { HeroImage } from '@/three'

/**
 * Pantallas de acceso (entrar, registro, recuperar y restablecer la contraseña), en el mundo «Diorama»: sobre el lienzo
 * azul, un panel de cristal con el formulario y, en escritorio, una maqueta del coche a su lado (imagen fija, sin WebGL).
 * El texto de la maqueta es el mismo de siempre: no promete nada que la app no haga.
 */
export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-4 sm:px-8">
      <header className="mx-auto flex h-16 w-full max-w-[64rem] items-center justify-between">
        <Link to="/" className="rounded-control" aria-label="CarCare, volver a la portada">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <div className="mx-auto grid w-full max-w-[64rem] flex-1 items-center gap-8 pb-10 pt-4 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
        <aside aria-hidden className="relative hidden lg:block">
          <div className="relative mx-auto max-w-xl">
            <svg viewBox="0 0 400 120" className="absolute inset-x-0 bottom-0 w-full" fill="none">
              <ellipse cx="200" cy="82" rx="190" ry="30" fill="hsl(var(--shadow-color))" opacity="0.12" />
              <path d="M10 70 200 112 390 70 390 60 200 100 10 60Z" fill="var(--line-strong)" opacity="0.4" />
              <path d="M200 20 390 60 200 100 10 60Z" fill="var(--surface)" stroke="var(--line)" />
            </svg>
            <HeroImage alt="" priority sizes="40vw" className="relative z-10 w-full" />
          </div>
          <p className="mx-auto mt-6 max-w-sm text-center text-sm text-fg-muted">CarCare guarda el historial, los gastos y los vencimientos de tus vehículos o los de tu taller.</p>
        </aside>
        <main id="contenido" className="w-full animate-pop-in lg:max-w-[26rem]">
          <div className="hud-panel mx-auto max-w-[26rem] p-6 sm:p-8 lg:mx-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg-warm text-balance sm:text-3xl">{title}</h1>
            {description && <p className="mt-2 text-fg-muted">{description}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-7 border-t border-line pt-5 text-sm text-fg-muted">{footer}</div>}
          </div>
          <p className="mx-auto mt-5 max-w-[26rem] text-center text-xs text-fg-subtle lg:hidden">
            CarCare guarda el historial, los gastos y los vencimientos de tus vehículos o los de tu taller.
          </p>
        </main>
      </div>
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

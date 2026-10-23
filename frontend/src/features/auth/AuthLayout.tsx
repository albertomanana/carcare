import { BellRing, ChartColumn, ScanEye, SquareKanban } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { ThemeToggle } from '@/components/layout/UserMenu'

const POINTS = [
  { icon: ScanEye, title: 'Mapa de zonas en 3D', text: 'Según tus intervalos, no medido: sin cifras inventadas.' },
  { icon: BellRing, title: 'Recordatorios por fecha o km', text: 'ITV, seguro, aceite… lo que llegue antes.' },
  { icon: ChartColumn, title: 'Gastos que se entienden', text: 'Coste por km y consumo solo cuando hay datos.' },
  { icon: SquareKanban, title: 'Modo taller', text: 'Clientes, órdenes en tablero y elevadores.' },
]

/** Pantallas de acceso: formulario a pantalla completa en móvil, tarjeta + panel de marca en escritorio. */
export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col px-4 sm:px-8">
        <header className="flex h-16 items-center justify-between">
          <Link to="/" className="rounded-control" aria-label="CarCare, volver a la portada">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>
        <main id="contenido" className="flex flex-1 items-start justify-center py-8 sm:items-center">
          <div className="w-full max-w-[26rem] animate-rise">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-fg-warm text-balance">{title}</h1>
            {description && <p className="mt-2 text-fg-muted">{description}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-fg-muted">{footer}</div>}
          </div>
        </main>
        <p className="pb-6 text-xs text-fg-subtle">CarCare · Proyecto de fin de grado de DAW (Ilerna)</p>
      </div>

      <aside aria-hidden className="relative hidden overflow-hidden border-l border-line bg-surface lg:block">
        <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="absolute -right-32 -top-32 size-[36rem] rounded-full bg-accent/10 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-center px-14 xl:px-20">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-ink">Particulares y talleres</p>
          <p className="mt-4 max-w-md font-display text-4xl font-semibold leading-tight tracking-tight text-fg-warm xl:text-5xl">
            Tu coche, al día. Tu taller, bajo control.
          </p>
          <ul className="mt-10 grid max-w-md gap-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-card border border-line bg-surface-2 text-accent-ink">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium text-fg">{title}</span>
                  <span className="block text-sm text-fg-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
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

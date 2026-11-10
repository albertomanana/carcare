import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ChartColumn,
  CircleCheck,
  FileLock,
  Gauge,
  type LucideIcon,
  Printer,
  ShieldCheck,
  SquareKanban,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { type CSSProperties, type ReactNode, useRef } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { SkipLink } from '@/components/layout/SkipLink'
import { ThemeToggle } from '@/components/layout/UserMenu'
import { ButtonLink } from '@/components/ui/Button'
import { Tilt } from '@/components/ui/Tilt'
import { buttonClasses } from '@/components/ui/variants'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'
import { type StatusDescriptor, TONE_CLASSES, zoneDescriptor } from '@/lib/status'
import { HeroVisual } from './HeroVisual'
import { Screenshot } from './Screenshot'

interface Feature {
  icon: LucideIcon
  title: string
  text: string
}

const PERSONAL: Feature[] = [
  { icon: Gauge, title: 'Diario', text: 'Kilómetros, repostajes y gastos.' },
  { icon: Wrench, title: 'Historial', text: 'Cada intervención, con piezas y mano de obra.' },
  { icon: BellRing, title: 'Recordatorios', text: 'Por fecha o por kilómetros.' },
  { icon: ChartColumn, title: 'Gastos', text: 'Por mes y por categoría.' },
  { icon: FileLock, title: 'Documentos', text: 'Seguro, ficha técnica y facturas.' },
  { icon: Printer, title: 'Informe', text: 'Todo el historial, listo para imprimir.' },
]

const WORKSHOP: Feature[] = [
  { icon: SquareKanban, title: 'Órdenes', text: 'De «Recibido» a «Listo», también con teclado.' },
  { icon: Warehouse, title: 'Taller 3D', text: 'Qué coche hay en cada elevador.' },
  { icon: Users, title: 'Clientes', text: 'Sus vehículos y sus órdenes.' },
  { icon: ShieldCheck, title: 'Equipo', text: 'Propietario, gerente y mecánico.' },
  { icon: ChartColumn, title: 'Analítica', text: 'Órdenes entregadas y ticket medio.' },
  { icon: CalendarClock, title: 'Vencimientos', text: 'De todos los vehículos, por urgencia.' },
]

// Los mismos estados, iconos y etiquetas que la ficha del vehículo (`zoneDescriptor`), para que la portada no diga
// otra cosa que la app.
const ZONE_STATES: { status: StatusDescriptor; text: string }[] = [
  { status: zoneDescriptor({ basis: 'reminders', state: 'overdue' }), text: 'se pasó la fecha o los km.' },
  { status: zoneDescriptor({ basis: 'reminders', state: 'soon' }), text: 'falta poco.' },
  { status: zoneDescriptor({ basis: 'reminders', state: 'ok' }), text: 'queda margen.' },
  { status: zoneDescriptor({ basis: 'records', state: 'unknown' }), text: 'hay intervenciones, pero ningún recordatorio.' },
  { status: zoneDescriptor({ basis: 'none', state: 'unknown' }), text: 'sin datos.' },
]

const PRINCIPLES = [
  { title: 'Ninguna cifra inventada', text: 'Si faltan datos, te dice cuáles.' },
  { title: 'Sin «puntuación de salud»', text: 'No mide el desgaste: usa tus intervalos.' },
  { title: 'Documentos privados', text: 'Solo se descargan con tu sesión.' },
  { title: 'Tu historial, si tú quieres', text: 'Un taller solo lo ve si lo compartes, sin importes ni notas.' },
]

const SECTIONS = [
  { href: '#particulares', label: 'Particulares' },
  { href: '#talleres', label: 'Talleres' },
  { href: '#solicitudes', label: 'Presupuestos' },
  { href: '#principios', label: 'Datos' },
]

/** Índice de entrada para la cascada del héroe (`.enter` lo lee como `--i`). */
const step = (i: number): CSSProperties => ({ '--i': i }) as CSSProperties

/**
 * Portada. Héroe en dos tiempos con el coche a la derecha: primero la imagen fija (LCP, sin three.js) y, en escritorio
 * y en reposo, el coche 3D, que sigue el scroll hasta la explicación de las zonas. Después, capturas reales de la app.
 * Todo el texto está en el HTML desde el principio: nada aparece al hacer scroll; solo el héroe entra en cascada al cargar.
 */
export default function LandingPage() {
  const { status } = useAuth()
  const authed = status === 'authenticated'
  const stage = useRef<HTMLElement>(null)

  return (
    <div data-portada className="min-h-dvh overflow-x-clip text-fg">
      <SkipLink />

      <header className="glass sticky top-0 z-40 border-b border-line/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" className="mr-2 rounded-control" aria-label="CarCare, inicio">
            <Logo />
          </Link>
          <nav aria-label="Secciones de la portada" className="hidden items-center md:flex">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className="rounded-control px-3 py-2 text-sm text-fg-muted transition-colors duration-150 hover:text-fg">
                <span className="link-draw">{s.label}</span>
              </a>
            ))}
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
          {!authed && (
            <ButtonLink to="/entrar" variant="ghost">
              Entrar
            </ButtonLink>
          )}
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="outline-none">
        {/* Héroe: dos pantallas en escritorio con el coche fijo a la derecha; en móvil, una columna */}
        <section ref={stage} aria-labelledby="hero-title" className="mx-auto grid max-w-7xl px-4 sm:px-6 lg:grid-cols-12 lg:gap-x-8">
          <div className="flex min-w-0 flex-col justify-center pb-8 pt-8 sm:pt-14 lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:min-h-[calc(100dvh-4rem)] lg:py-16">
            <h1
              id="hero-title"
              style={step(0)}
              className="enter font-display text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.03em] text-fg-warm sm:text-6xl lg:text-[4rem] xl:text-[4.5rem]"
            >
              Tu coche, <span className="text-accent-ink">siempre al día.</span>
            </h1>
            <p style={step(1)} className="enter mt-5 max-w-md text-base text-fg-muted sm:mt-6 sm:text-lg">
              Historial, gastos, kilómetros y vencimientos de cada vehículo. Y si tienes un taller, sus órdenes de trabajo.
            </p>
            <div style={step(2)} className="enter mt-7 flex flex-wrap gap-3 sm:mt-9">
              <ButtonLink to={authed ? '/app' : '/registro'} variant="primary" size="lg" iconRight={<ArrowRight aria-hidden className="transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5" />}>
                {authed ? 'Ir a mi panel' : 'Crear cuenta gratis'}
              </ButtonLink>
              <a href="#particulares" className={buttonClasses({ size: 'lg' })}>
                Ver la app
              </a>
            </div>
          </div>

          <HeroVisual stage={stage} className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:self-start" />

          <div id="zonas" className="flex min-w-0 -scroll-mt-2 flex-col justify-center py-12 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:min-h-[calc(100dvh-4rem)] lg:py-16">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-fg-warm sm:text-4xl">El coche, por zonas</h2>
            <p className="mt-4 text-fg-muted">
              Cada zona del modelo 3D toma el estado de su recordatorio más urgente. Sin sensores ni diagnósticos: siempre{' '}
              <strong className="font-medium text-fg">«según tus intervalos, no medido»</strong>.
            </p>
            <dl className="mt-6 list-panel text-sm">
              {ZONE_STATES.map(({ status: { label, tone, icon: Icon }, text }) => (
                <div key={label} className="flex items-start gap-2 py-2.5">
                  <dt className={cn('inline-flex shrink-0 items-center gap-1.5 font-medium', TONE_CLASSES[tone].text)}>
                    <Icon aria-hidden className="size-4" />
                    {label}:
                  </dt>
                  <dd className="text-fg-muted">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <Band id="particulares" title="El historial y los gastos de cada coche">
          <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
            <Screenshot shot="zonas" rest="left" sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw" />
            <Screenshot shot="gastos" rest="right" sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw" />
          </div>
          <FeatureGrid items={PERSONAL} />
        </Band>

        <Band id="talleres" title="Órdenes, elevadores y equipo" tinted>
          <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
            <Screenshot shot="tablero" rest="left" sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw" />
            <Screenshot shot="taller3d" rest="right" sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw" />
          </div>
          <FeatureGrid items={WORKSHOP} />
        </Band>

        <Band id="solicitudes" title="Pide presupuesto a un taller sin salir de CarCare">
          <ol className="grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-8">
            <Step n={1} title="Eliges un taller" text="Solo los que han decidido publicarse, con su ciudad y sus servicios.">
              <Screenshot shot="directorio" rest="left" sizes="(min-width: 1280px) 395px, (min-width: 768px) 33vw, 100vw" />
            </Step>
            <Step n={2} title="Reciben tu solicitud" text="Tu historial, solo si marcas la casilla, y sin importes ni notas.">
              <Screenshot shot="recibida" sizes="(min-width: 1280px) 395px, (min-width: 768px) 33vw, 100vw" />
            </Step>
            <Step n={3} title="Te llega el presupuesto" text="Con sus líneas y el IVA. Lo aceptas o lo rechazas tú.">
              <Screenshot shot="presupuesto" rest="right" sizes="(min-width: 1280px) 395px, (min-width: 768px) 33vw, 100vw" />
            </Step>
          </ol>
        </Band>

        <Band id="principios" title="Cómo trata tus datos" tinted>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              // dt y dd, hijos directos del div del <dl> (si van en otro div, el lector de pantalla pierde la lista)
              <div key={p.title} className="relative min-w-0 pl-8">
                <dt className="font-medium text-fg">
                  <CircleCheck aria-hidden className="absolute left-0 top-0.5 size-5 text-accent-ink" />
                  {p.title}
                </dt>
                <dd className="mt-1 text-sm text-fg-muted">{p.text}</dd>
              </div>
            ))}
          </dl>
        </Band>

        <section aria-labelledby="empezar-title" className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-28">
            <h2 id="empezar-title" className="max-w-2xl font-display text-4xl font-semibold tracking-[-0.03em] text-fg-warm sm:text-5xl lg:text-6xl">
              {authed ? 'Tu cuenta ya está lista' : 'Añade tu primer coche'}
            </h2>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to={authed ? '/app' : '/registro'} variant="primary" size="lg" iconRight={<ArrowRight aria-hidden />}>
                {authed ? 'Ir a mi panel' : 'Crear cuenta gratis'}
              </ButtonLink>
              {!authed && (
                <ButtonLink to="/entrar" size="lg">
                  Ya tengo cuenta
                </ButtonLink>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-fg-subtle sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p>Capturas con la cuenta de demostración (datos ficticios) · Proyecto de fin de grado de DAW (Ilerna)</p>
        </div>
      </footer>
    </div>
  )
}

/** Sección de la portada: título grande y su contenido. Sin etiqueta encima ni párrafo de relleno. */
function Band({ id, title, tinted, children }: { id: string; title: string; tinted?: boolean; children: ReactNode }) {
  return (
    <section id={`${id}`} aria-labelledby={`${id}-title`} className={cn('-scroll-mt-2 border-t border-line', tinted && 'bg-surface/60')}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 id={`${id}-title`} className="max-w-3xl font-display text-3xl font-semibold tracking-[-0.03em] text-fg-warm sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        <div className="mt-10 lg:mt-12">{children}</div>
      </div>
    </section>
  )
}

function FeatureGrid({ items }: { items: Feature[] }) {
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title}>
          <Tilt max={9} className="h-full rounded-card">
            <div className="surface-card preserve-3d flex h-full gap-3 rounded-card border border-line p-4">
              <span className="z-near grid size-10 shrink-0 place-items-center rounded-control bg-accent-soft text-accent-ink [box-shadow:0_1px_0_rgb(255_255_255/0.08)_inset,0_3px_0_color-mix(in_srgb,var(--accent)_30%,transparent)]">
                <Icon aria-hidden className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-fg">{title}</p>
                <p className="mt-0.5 text-sm text-fg-muted">{text}</p>
              </div>
            </div>
          </Tilt>
        </li>
      ))}
    </ul>
  )
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col">
      <div className="order-2 mt-5">
        <h3 className="flex items-baseline gap-3 font-display text-xl font-semibold text-fg-warm">
          <span className="tabular text-base text-accent-ink" aria-hidden>
            {n}.
          </span>
          {title}
        </h3>
        <p className="mt-2 text-sm text-fg-muted">{text}</p>
      </div>
      <div className="order-1">{children}</div>
    </li>
  )
}

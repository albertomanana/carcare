import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Car,
  ChartColumn,
  CircleCheck,
  CircleDashed,
  Clock,
  FileLock,
  Gauge,
  Layers,
  OctagonAlert,
  Printer,
  Receipt,
  ScanEye,
  ShieldCheck,
  SquareKanban,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { ThemeToggle } from '@/components/layout/UserMenu'
import { ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'
import { ZONE_LABEL, ZONES } from '@/lib/labels'
import { HeroScene } from '@/three'

/** Progreso 0..1 del scroll a lo largo de un elemento (para coreografiar la escena 3D). */
function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = Math.max(1, rect.height - window.innerHeight)
      setProgress(Math.min(1, Math.max(0, -rect.top / total)))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref])
  return progress
}

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-control bg-surface-2 text-accent-ink [&_svg]:size-4">{icon}</span>
      <div>
        <p className="font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-sm text-fg-muted">{children}</p>
      </div>
    </li>
  )
}

const ZONE_DEMO_STATES = [
  { label: 'Vencido', icon: OctagonAlert, cls: 'bg-danger-soft text-danger' },
  { label: 'Próximo', icon: Clock, cls: 'bg-warning-soft text-warning' },
  { label: 'En plazo', icon: CircleCheck, cls: 'bg-ok-soft text-ok' },
  { label: 'Sin datos', icon: CircleDashed, cls: 'bg-surface-3 text-fg-muted' },
]

export default function LandingPage() {
  const { status } = useAuth()
  const heroRef = useRef<HTMLElement>(null)
  const progress = useScrollProgress(heroRef)
  const authed = status === 'authenticated'

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas text-fg">
      {/* Cabecera */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-control" aria-label="CarCare, inicio">
            <Logo />
          </Link>
          <nav aria-label="Secciones de la portada" className="ml-6 hidden items-center gap-6 text-sm text-fg-muted lg:flex">
            <a href="#modos" className="hover:text-fg">
              Particulares y talleres
            </a>
            <a href="#mapa" className="hover:text-fg">
              Mapa 3D
            </a>
            <a href="#como" className="hover:text-fg">
              Cómo funciona
            </a>
            <a href="#principios" className="hover:text-fg">
              Principios
            </a>
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
          {authed ? (
            <ButtonLink to="/app" variant="primary" iconRight={<ArrowRight aria-hidden />}>
              Ir a mi panel
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/entrar" variant="ghost" className="hidden sm:inline-flex">
                Entrar
              </ButtonLink>
              <ButtonLink to="/registro" variant="primary">
                Crear cuenta
              </ButtonLink>
            </>
          )}
        </div>
      </header>

      <main>
        {/* Hero con escena 3D coreografiada por el scroll */}
        <section ref={heroRef} className="relative h-[170vh]" aria-labelledby="hero-title">
          <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-40 top-1/4 size-[42rem] rounded-full bg-accent/10 blur-[120px]"
              style={{ opacity: 0.6 + progress * 0.4 }}
            />
            <div className="absolute inset-0 lg:left-[38%]">
              <HeroScene progress={progress} className="h-full w-full" />
            </div>
            <div className="relative mx-auto w-full max-w-7xl px-4 pt-16 sm:px-6">
              <div
                className="max-w-xl rounded-hero bg-canvas/60 p-1 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none"
                style={{ transform: `translateY(${progress * -40}px)`, opacity: 1 - Math.max(0, progress - 0.55) * 2.2 }}
              >
                <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-fg-muted">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                  Para particulares y para talleres
                </p>
                <h1 id="hero-title" className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-fg-warm text-balance sm:text-6xl lg:text-7xl">
                  Tu coche, al día.
                  <br />
                  <span className="text-accent-ink">Tu taller, bajo control.</span>
                </h1>
                <p className="mt-6 max-w-lg text-base text-fg-muted sm:text-lg">
                  CarCare guarda el historial, los gastos, el kilometraje y los vencimientos de cada vehículo, y te los enseña sobre un modelo 3D que se ilumina
                  según <em className="not-italic text-fg">tus</em> intervalos de mantenimiento.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink to={authed ? '/app' : '/registro'} variant="primary" size="lg" iconRight={<ArrowRight aria-hidden />}>
                    {authed ? 'Ir a mi panel' : 'Crear cuenta'}
                  </ButtonLink>
                  {!authed && (
                    <ButtonLink to="/entrar" variant="secondary" size="lg">
                      Ya tengo cuenta
                    </ButtonLink>
                  )}
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs text-fg-subtle md:flex"
              style={{ opacity: 1 - progress * 3 }}
            >
              Desliza
              <span className="h-8 w-px bg-gradient-to-b from-fg-subtle to-transparent" />
            </div>
          </div>
        </section>

        {/* Dos modos */}
        <section id="modos" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6" aria-labelledby="modos-title">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-ink">Dos modos, una misma base</p>
            <h2 id="modos-title" className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-fg-warm sm:text-5xl">
              Del garaje de casa a la nave del taller.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <Reveal className="rounded-hero border border-line bg-surface p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-card bg-accent-soft text-accent-ink">
                  <Car aria-hidden className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold text-fg-warm">Particular</h3>
                  <p className="text-sm text-fg-muted">Tu cabina personal</p>
                </div>
              </div>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                <Feature icon={<Gauge />} title="Diario del coche">
                  Kilómetros, repostajes y gastos día a día, con calendario de actividad.
                </Feature>
                <Feature icon={<Wrench />} title="Historial completo">
                  Cada intervención con sus piezas, mano de obra y facturas.
                </Feature>
                <Feature icon={<BellRing />} title="Recordatorios">
                  ITV, seguro, aceite… por fecha, por kilómetros o lo que llegue antes.
                </Feature>
                <Feature icon={<ChartColumn />} title="Gastos que se entienden">
                  Por categoría y por mes, coste por km y consumo cuando hay datos para calcularlo.
                </Feature>
                <Feature icon={<FileLock />} title="Documentos">
                  Ficha técnica, seguro y facturas, con vista previa y caducidad.
                </Feature>
                <Feature icon={<Printer />} title="Informe imprimible">
                  Todo el historial en un documento para vender el coche o llevarlo al taller.
                </Feature>
              </ul>
            </Reveal>
            <Reveal className="rounded-hero border border-line bg-surface p-6 sm:p-8" delay={0.08}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-card bg-info-soft text-info">
                  <Warehouse aria-hidden className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold text-fg-warm">Taller y flota</h3>
                  <p className="text-sm text-fg-muted">Tu centro de control</p>
                </div>
              </div>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                <Feature icon={<SquareKanban />} title="Órdenes en tablero">
                  Arrastra cada orden de «Recibido» a «Listo», también con teclado.
                </Feature>
                <Feature icon={<Layers />} title="Elevadores en 3D">
                  Ve qué coche hay en cada elevador y cuáles esperan turno.
                </Feature>
                <Feature icon={<Users />} title="Clientes y flota">
                  Cada cliente con sus vehículos, órdenes e historial.
                </Feature>
                <Feature icon={<ShieldCheck />} title="Equipo con roles">
                  Propietario, gerente y mecánico: cada uno ve lo que le toca.
                </Feature>
                <Feature icon={<Receipt />} title="Importe de órdenes entregadas">
                  Totales con IVA por mes y por cliente, ticket medio y tiempo en el taller. No son facturas.
                </Feature>
                <Feature icon={<CalendarClock />} title="Alertas de flota">
                  Vencimientos de todos los vehículos que gestionas, por urgencia.
                </Feature>
              </ul>
            </Reveal>
          </div>
        </section>

        {/* Mapa 3D de zonas */}
        <section id="mapa" className="scroll-mt-20 border-y border-line bg-surface/40" aria-labelledby="mapa-title">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-ink">El mapa 3D de zonas</p>
              <h2 id="mapa-title" className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg-warm sm:text-5xl">
                Tu coche, por zonas. Según tus intervalos, no medido.
              </h2>
              <p className="mt-5 text-fg-muted">
                Motor, frenos, neumáticos, batería… Cada zona del modelo 3D toma el color del recordatorio más urgente que tengas en ella. Si el cambio de aceite te toca
                por kilómetros y estás cerca, el motor se verá «Próximo». Si una zona no tiene recordatorios, lo verás como «Sin datos».
              </p>
              <p className="mt-4 rounded-card border border-line bg-surface p-4 text-sm text-fg-muted">
                <ScanEye aria-hidden className="mr-2 inline size-4 text-accent-ink" />
                CarCare no tiene sensores ni hace diagnósticos: el estado sale de las fechas y kilómetros que tú defines. Por eso siempre lo etiquetamos como
                <strong className="font-medium text-fg"> «según tus intervalos, no medido»</strong>.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="rounded-hero border border-line bg-surface p-6">
                <div className="flex flex-wrap gap-2" aria-label="Leyenda de estados">
                  {ZONE_DEMO_STATES.map(({ label, icon: Icon, cls }) => (
                    <span key={label} className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium', cls)}>
                      <Icon aria-hidden className="size-3.5" />
                      {label}
                    </span>
                  ))}
                </div>
                <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-2" aria-label="Zonas del vehículo">
                  {ZONES.map((z) => (
                    <li key={z} className="flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface-2 px-3 text-sm text-fg">
                      <span className="size-2 rounded-full bg-line-strong" aria-hidden />
                      {ZONE_LABEL[z]}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-fg-subtle">Las 10 zonas del modelo. En tu ficha, cada una enlaza con su historial y su próximo recordatorio.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6" aria-labelledby="como-title">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-ink">Cómo funciona</p>
            <h2 id="como-title" className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-fg-warm sm:text-5xl">
              Tres pasos y ya está en marcha.
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { n: '01', title: 'Añade tu vehículo', text: 'Marca, modelo, carrocería y color: con eso ya tienes tu coche en 3D.' },
              { n: '02', title: 'Registra lo que pasa', text: 'Kilómetros, repostajes, intervenciones y documentos. En segundos, desde el móvil.' },
              { n: '03', title: 'Deja que te avise', text: 'Recordatorios por fecha o por kilómetros, y un informe completo cuando lo necesites.' },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 0.06}>
                <li className="h-full rounded-hero border border-line bg-surface p-6">
                  <span className="font-display text-4xl font-semibold text-accent-ink tabular">{step.n}</span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-fg-warm">{step.title}</h3>
                  <p className="mt-2 text-sm text-fg-muted">{step.text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Principios */}
        <section id="principios" className="scroll-mt-20 border-t border-line bg-surface/40" aria-labelledby="principios-title">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <Reveal>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-ink">Principios</p>
              <h2 id="principios-title" className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-fg-warm sm:text-5xl">
                Honestos con tus datos.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: 'Ninguna cifra inventada', text: 'Si faltan datos para el coste por km o el consumo, te decimos exactamente cuáles.' },
                { title: 'Sin «puntuación de salud»', text: 'No medimos el desgaste. Mostramos tus intervalos y lo que has registrado.' },
                { title: 'Sin doble conteo', text: 'Una intervención con coste genera un único gasto vinculado, nunca dos.' },
                { title: 'Tus documentos, privados', text: 'Se guardan fuera del acceso público y solo los descargas con tu sesión.' },
              ].map((p, i) => (
                <Reveal key={p.title} delay={i * 0.05}>
                  <div className="h-full rounded-card border border-line bg-surface p-5">
                    <CircleCheck aria-hidden className="size-5 text-accent-ink" />
                    <h3 className="mt-3 font-display font-semibold text-fg-warm">{p.title}</h3>
                    <p className="mt-1.5 text-sm text-fg-muted">{p.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6" aria-labelledby="cta-title">
          <Reveal className="relative overflow-hidden rounded-hero border border-accent/30 bg-gradient-to-br from-accent-soft via-surface to-surface p-8 sm:p-14">
            <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-accent/15 blur-3xl" />
            <h2 id="cta-title" className="relative max-w-2xl font-display text-3xl font-semibold tracking-tight text-fg-warm sm:text-5xl">
              Empieza por tu coche. O por todo tu taller.
            </h2>
            <p className="relative mt-4 max-w-xl text-fg-muted">Al registrarte eliges si eres particular o taller. Siempre tendrás tu garaje personal, y puedes crear o unirte a un taller cuando quieras.</p>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <ButtonLink to={authed ? '/app' : '/registro'} variant="primary" size="lg" iconRight={<ArrowRight aria-hidden />}>
                {authed ? 'Ir a mi panel' : 'Crear cuenta'}
              </ButtonLink>
              {!authed && (
                <ButtonLink to="/entrar" size="lg">
                  Entrar
                </ButtonLink>
              )}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-fg-subtle sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p>CarCare · Proyecto de fin de grado de DAW (Ilerna)</p>
        </div>
      </footer>
    </div>
  )
}

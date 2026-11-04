import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Car,
  ChartColumn,
  CircleCheck,
  FileLock,
  Gauge,
  Inbox,
  type LucideIcon,
  Printer,
  ShieldCheck,
  SquareKanban,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { SkipLink } from '@/components/layout/SkipLink'
import { ThemeToggle } from '@/components/layout/UserMenu'
import { ButtonLink } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/variants'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'
import { ZONE_LABEL, ZONES } from '@/lib/labels'
import { type StatusDescriptor, TONE_CLASSES, zoneDescriptor } from '@/lib/status'
import { HeroVisual } from './HeroVisual'
import { Screenshot } from './Screenshot'

interface Feature {
  icon: LucideIcon
  title: string
  text: string
}

const PERSONAL: Feature[] = [
  { icon: Gauge, title: 'Diario', text: 'Kilómetros, repostajes y gastos del día a día.' },
  { icon: Wrench, title: 'Historial', text: 'Cada intervención, con sus piezas y su mano de obra.' },
  { icon: BellRing, title: 'Recordatorios', text: 'Por fecha o por kilómetros: ITV, seguro, aceite…' },
  { icon: ChartColumn, title: 'Gastos', text: 'Por categoría y por mes, y el coste por km cuando hay datos para calcularlo.' },
  { icon: FileLock, title: 'Documentos', text: 'Ficha técnica, seguro y facturas, con su caducidad.' },
  { icon: Printer, title: 'Informe', text: 'Un informe imprimible con todo el historial del coche.' },
]

const WORKSHOP: Feature[] = [
  { icon: SquareKanban, title: 'Tablero de órdenes', text: 'De «Recibido» a «Listo», también con el teclado.' },
  { icon: Warehouse, title: 'Taller 3D', text: 'Qué coche hay en cada elevador y cuáles esperan turno, con la misma información en una lista.' },
  { icon: Users, title: 'Clientes', text: 'Cada cliente con sus vehículos y sus órdenes.' },
  { icon: ShieldCheck, title: 'Equipo con roles', text: 'Propietario, gerente y mecánico. Cada uno ve lo que le toca.' },
  { icon: ChartColumn, title: 'Analítica', text: 'Importe de las órdenes entregadas, ticket medio y tiempo en el taller. No son facturas.' },
  { icon: CalendarClock, title: 'Vencimientos', text: 'Los de todos los vehículos que gestionas, por urgencia.' },
]

// Los mismos estados, iconos y etiquetas que la ficha del vehículo (`zoneDescriptor`), para que la portada no diga
// otra cosa que la app.
const ZONE_STATES: { status: StatusDescriptor; text: string }[] = [
  { status: zoneDescriptor({ basis: 'reminders', state: 'overdue' }), text: 'has pasado la fecha o los kilómetros del recordatorio.' },
  { status: zoneDescriptor({ basis: 'reminders', state: 'soon' }), text: 'falta poco para la fecha o los kilómetros.' },
  { status: zoneDescriptor({ basis: 'reminders', state: 'ok' }), text: 'todavía queda margen.' },
  { status: zoneDescriptor({ basis: 'records', state: 'unknown' }), text: 'hay intervenciones en la zona, pero ningún recordatorio.' },
  { status: zoneDescriptor({ basis: 'none', state: 'unknown' }), text: 'ni recordatorios ni intervenciones.' },
]

const PRINCIPLES = [
  { title: 'Ninguna cifra inventada', text: 'Si faltan datos para el coste por km o el consumo, CarCare te dice cuáles faltan.' },
  { title: 'Sin «puntuación de salud»', text: 'No mide el desgaste: muestra tus intervalos y lo que has registrado.' },
  { title: 'Sin doble conteo', text: 'Una intervención con coste genera un único gasto vinculado, nunca dos.' },
  { title: 'Documentos privados', text: 'Se guardan fuera del acceso público y solo se descargan con tu sesión.' },
  { title: 'Tu historial, si tú quieres', text: 'Un taller solo lo ve si lo compartes en una solicitud: sin importes ni notas, y mientras siga abierta.' },
  { title: 'Cada rol, lo suyo', text: 'En el taller, el mecánico trabaja las órdenes; la analítica, los gastos y el equipo son del propietario y el gerente.' },
]

const SECTIONS = [
  { href: '#particulares', label: 'Particulares' },
  { href: '#talleres', label: 'Talleres' },
  { href: '#solicitudes', label: 'Presupuestos' },
  { href: '#principios', label: 'Principios' },
]

const DEMO_NOTE = 'Capturas de la app con la cuenta de demostración: los datos son ficticios.'

/**
 * Portada (tarea 36). Héroe en dos tiempos con el coche a la derecha: primero la imagen fija (LCP, sin three.js) y,
 * en escritorio y en reposo, el coche 3D, que sigue el scroll hasta la explicación de las zonas. Después, capturas
 * reales de la app para particulares, talleres y solicitudes de presupuesto (E16), los principios y el registro.
 * Todo el texto está en el HTML desde el principio: no hay nada que aparezca al hacer scroll.
 */
export default function LandingPage() {
  const { status } = useAuth()
  const authed = status === 'authenticated'
  const stage = useRef<HTMLElement>(null)

  return (
    <div data-portada className="min-h-dvh overflow-x-clip bg-canvas text-fg">
      <SkipLink />

      {/* Cabecera opaca (R8). La acción principal está en el titular (R1, R14). */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" className="mr-2 rounded-control" aria-label="CarCare, inicio">
            <Logo />
          </Link>
          <nav aria-label="Secciones de la portada" className="hidden items-center md:flex">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className="rounded-control px-3 py-2 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
                {s.label}
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
              className="font-display text-[2.125rem] font-semibold leading-[1.04] tracking-tight text-fg-warm text-balance sm:text-5xl lg:text-[3.5rem] xl:text-6xl"
            >
              El mantenimiento de tus coches, al día y en un solo sitio.
            </h1>
            <p className="mt-5 max-w-xl text-base text-fg-muted sm:mt-6 sm:text-lg">
              CarCare guarda el historial, los gastos, los kilómetros y los vencimientos de cada vehículo, y te enseña lo que le toca por fecha o por
              kilómetros. Si tienes un taller, también lleva las órdenes de trabajo, los clientes y los elevadores.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
              <ButtonLink to={authed ? '/app' : '/registro'} variant="primary" size="lg" iconRight={<ArrowRight aria-hidden />}>
                {authed ? 'Ir a mi panel' : 'Crear cuenta'}
              </ButtonLink>
              <a href="#particulares" className={buttonClasses({ size: 'lg' })}>
                Ver capturas
              </a>
            </div>
            <p className="mt-5 text-sm text-fg-subtle sm:mt-6">Para particulares y para talleres. Crear una cuenta es gratis.</p>
          </div>

          <HeroVisual stage={stage} className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:self-start" />

          <div id="zonas" className="flex min-w-0 -scroll-mt-2 flex-col justify-center py-12 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:min-h-[calc(100dvh-4rem)] lg:py-16">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-fg-warm text-balance sm:text-4xl">El coche, por zonas</h2>
            <p className="mt-4 text-fg-muted">
              En la ficha de cada vehículo, el modelo 3D se divide en {ZONES.length} zonas: motor, frenos, neumáticos, batería… Cada una toma el estado del
              recordatorio más urgente que tengas en ella. Si el cambio de aceite te toca por kilómetros y estás cerca, el motor sale como «Próximo».
            </p>
            <p className="mt-4 text-fg-muted">
              CarCare no tiene sensores ni hace diagnósticos: el estado sale de las fechas y los kilómetros que defines tú. Por eso siempre pone{' '}
              <strong className="font-medium text-fg">«según tus intervalos, no medido»</strong>. En la ilustración de la portada, los colores son de ejemplo.
            </p>
            <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
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
            <p className="mt-4 text-sm text-fg-subtle">Las zonas: {ZONES.map((z) => ZONE_LABEL[z].toLowerCase()).join(', ')}.</p>
          </div>
        </section>

        <section id="particulares" aria-labelledby="particulares-title" className="-scroll-mt-2 border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionIntro id="particulares-title" icon={Car} kicker="Particular" title="El historial y los gastos de cada coche">
              Apuntas los kilómetros, los repostajes, los gastos y lo que le haces al coche. Con eso, CarCare te enseña qué te toca y cuánto te cuesta, y si
              le faltan datos para calcular algo, te dice cuáles.
            </SectionIntro>
            <div className="mt-10 grid gap-8 md:grid-cols-2 lg:mt-12 lg:gap-10">
              <Screenshot
                shot="zonas"
                sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
                caption="Ficha del vehículo: cada zona con el estado de sus recordatorios, en 3D o en lista."
              />
              <Screenshot
                shot="gastos"
                sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
                caption="Gastos del año, por mes y por categoría. El coste por km y el consumo solo salen si hay datos."
              />
            </div>
            <FeatureGrid items={PERSONAL} />
          </div>
        </section>

        <section id="talleres" aria-labelledby="talleres-title" className="-scroll-mt-2 border-t border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionIntro id="talleres-title" icon={Warehouse} kicker="Taller y flota" title="Órdenes, elevadores y equipo del taller">
              Cada orden pasa de «Recibido» a «Listo» en un tablero, ves qué coche hay en cada elevador y cuáles esperan turno, y cada persona del equipo ve lo
              que le toca. Tu garaje personal sigue ahí: cambias de espacio desde el menú.
            </SectionIntro>
            <div className="mt-10 grid gap-8 md:grid-cols-2 lg:mt-12 lg:gap-10">
              <Screenshot
                shot="tablero"
                sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
                caption="Tablero de órdenes: una columna por fase; las que van tarde, con borde rojo y la etiqueta «Tarde»."
              />
              <Screenshot
                shot="taller3d"
                sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
                caption="Taller 3D: los elevadores y la zona de espera, y al lado la misma información en una lista."
              />
            </div>
            <FeatureGrid items={WORKSHOP} />
          </div>
        </section>

        <section id="solicitudes" aria-labelledby="solicitudes-title" className="-scroll-mt-2 border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionIntro id="solicitudes-title" icon={Inbox} kicker="Solicitudes a talleres" title="Pide presupuesto a un taller sin salir de CarCare">
              Los talleres que usan CarCare pueden aparecer en un directorio. Les cuentas qué le pasa al coche, te responden con un presupuesto y, si lo
              aceptas, se abre la orden de trabajo en el taller y tú ves en qué fase está.
            </SectionIntro>
            <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-6 lg:mt-12 lg:gap-8">
              <Step
                n={1}
                title="Eliges un taller"
                text="En el directorio solo están los talleres de CarCare que han decidido publicarse, con su ciudad, sus servicios y su horario."
              >
                <Screenshot shot="directorio" sizes="(min-width: 1280px) 395px, (min-width: 768px) 33vw, 100vw" caption="Directorio de talleres, visto por un particular." />
              </Step>
              <Step
                n={2}
                title="El taller recibe tu solicitud"
                text="Ve lo que le cuentas, tu nombre, tu contacto y los datos del coche. Tu historial, solo si marcas la casilla para compartirlo, y sin importes ni notas."
              >
                <Screenshot shot="recibida" sizes="(min-width: 1280px) 395px, (min-width: 768px) 33vw, 100vw" caption="La solicitud en la bandeja del taller." />
              </Step>
              <Step
                n={3}
                title="Te llega el presupuesto"
                text="Con sus líneas, el IVA y hasta cuándo vale. Es un presupuesto, no una factura: lo aceptas o lo rechazas tú."
              >
                <Screenshot shot="presupuesto" sizes="(min-width: 1280px) 395px, (min-width: 768px) 33vw, 100vw" caption="El presupuesto, visto por el particular." />
              </Step>
            </ol>
            <p className="mt-10 max-w-3xl text-fg-muted">
              Al aceptar el presupuesto se abre la orden en el taller, con sus mismas líneas, y en tu solicitud ves en qué fase está. Cada paso llega como
              aviso a la campana de la app: a ti y, en el taller, al propietario y a los gerentes. Y cuando el coche está listo, te avisa.
            </p>
          </div>
        </section>

        <section id="principios" aria-labelledby="principios-title" className="-scroll-mt-2 border-t border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 id="principios-title" className="font-display text-3xl font-semibold tracking-tight text-fg-warm text-balance sm:text-4xl">
              Cómo trata tus datos
            </h2>
            <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </section>

        <section aria-labelledby="empezar-title" className="border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h2 id="empezar-title" className="font-display text-3xl font-semibold tracking-tight text-fg-warm text-balance sm:text-4xl lg:text-5xl">
                  {authed ? 'Tu cuenta ya está lista' : 'Crea tu cuenta y añade tu primer coche'}
                </h2>
                <p className="mt-4 text-fg-muted sm:text-lg">
                  Crear una cuenta es gratis. Empiezas con tu garaje personal y puedes crear un taller o unirte a uno cuando quieras.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink to={authed ? '/app' : '/registro'} variant="primary" size="lg" iconRight={<ArrowRight aria-hidden />}>
                  {authed ? 'Ir a mi panel' : 'Crear cuenta'}
                </ButtonLink>
                {!authed && (
                  <ButtonLink to="/entrar" size="lg">
                    Ya tengo cuenta
                  </ButtonLink>
                )}
              </div>
            </div>
          </div>
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

function SectionIntro({ id, icon: Icon, kicker, title, children }: { id: string; icon: LucideIcon; kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-fg-muted">
        <Icon aria-hidden className="size-4 text-accent-ink" />
        {kicker}
      </p>
      <h2 id={id} className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg-warm text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-fg-muted sm:text-lg">{children}</p>
      <p className="mt-3 text-sm text-fg-subtle">{DEMO_NOTE}</p>
    </div>
  )
}

function FeatureGrid({ items }: { items: Feature[] }) {
  return (
    <ul className="mt-12 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-3">
          <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-ink" />
          <div className="min-w-0">
            <p className="font-medium text-fg">{title}</p>
            <p className="mt-1 text-sm text-fg-muted">{text}</p>
          </div>
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

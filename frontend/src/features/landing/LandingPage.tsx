import { ArrowRight, CircleCheck, CircleDashed, Clock, Image, OctagonAlert, Rotate3d } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { ThemeToggle } from '@/components/layout/UserMenu'
import { Button, ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/auth-context'
import { ZONE_LABEL, ZONES } from '@/lib/labels'
import { HeroImage, HeroScene, useWebGLAvailable } from '@/three'

const PERSONAL = [
  'Kilómetros, repostajes y gastos del día a día.',
  'Historial de intervenciones, con piezas y mano de obra.',
  'Recordatorios por fecha o por kilómetros: ITV, seguro, aceite…',
  'Gastos por categoría y por mes, y el coste por km cuando hay datos para calcularlo.',
  'Documentos (ficha técnica, seguro, facturas) con su caducidad.',
  'Un informe imprimible con todo el historial.',
]

const WORKSHOP = [
  'Órdenes de trabajo en un tablero, de «Recibido» a «Listo», también con el teclado.',
  'Qué coche hay en cada elevador y cuáles esperan turno, también en una vista 3D del taller.',
  'Clientes con sus vehículos y sus órdenes.',
  'Equipo con roles: propietario, gerente y mecánico. Cada uno ve lo que le toca.',
  'Importe de las órdenes entregadas, ticket medio y tiempo en el taller. No son facturas.',
  'Vencimientos de todos los vehículos que gestionas.',
]

const ZONE_STATES = [
  { label: 'Vencido', text: 'has pasado la fecha o los kilómetros del recordatorio.', icon: OctagonAlert, cls: 'text-danger' },
  { label: 'Próximo', text: 'falta poco para la fecha o los kilómetros.', icon: Clock, cls: 'text-warning' },
  { label: 'En plazo', text: 'todavía queda margen.', icon: CircleCheck, cls: 'text-ok' },
  { label: 'Sin datos', text: 'la zona no tiene recordatorios.', icon: CircleDashed, cls: 'text-fg-muted' },
]

const PRINCIPLES = [
  { title: 'Ninguna cifra inventada', text: 'Si faltan datos para el coste por km o el consumo, CarCare te dice cuáles faltan.' },
  { title: 'Sin «puntuación de salud»', text: 'No mide el desgaste: muestra tus intervalos y lo que has registrado.' },
  { title: 'Sin doble conteo', text: 'Una intervención con coste genera un único gasto vinculado, nunca dos.' },
  { title: 'Documentos privados', text: 'Se guardan fuera del acceso público y solo se descargan con tu sesión.' },
]

/**
 * Portada (plan UX 5.5): titular descriptivo, dos botones e imagen fija del coche (sin three.js al cargar, R11).
 * La escena 3D solo se monta si se pulsa "Ver en 3D". Sin animaciones de entrada: todo se ve sin hacer scroll (I1)
 * y no hay nada que desactivar con `prefers-reduced-motion` (la escena opcional ya lo respeta).
 */
export default function LandingPage() {
  const { status } = useAuth()
  const authed = status === 'authenticated'
  const webgl = useWebGLAvailable()
  const [show3d, setShow3d] = useState(false)

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas text-fg">
      {/* Cabecera opaca (R8). La acción principal está en el titular, no aquí (R1, R14). */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-control" aria-label="CarCare, inicio">
            <Logo />
          </Link>
          <nav aria-label="Secciones de la portada" className="ml-6 hidden items-center gap-6 text-sm text-fg-muted lg:flex">
            <a href="#modos" className="hover:text-fg">
              Particulares y talleres
            </a>
            <a href="#zonas" className="hover:text-fg">
              Mapa de zonas
            </a>
            <a href="#principios" className="hover:text-fg">
              Principios
            </a>
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

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:pb-24 lg:pt-20" aria-labelledby="hero-title">
          <div className="min-w-0">
            <h1 id="hero-title" className="font-display text-3xl font-semibold tracking-tight text-fg-warm text-balance sm:text-4xl lg:text-5xl">
              Lleva el mantenimiento y los gastos de tus coches, o los de tu taller.
            </h1>
            <p className="mt-5 max-w-xl text-base text-fg-muted sm:text-lg">
              CarCare guarda el historial, los gastos, el kilometraje y los vencimientos de cada vehículo. Si tienes un taller, también las órdenes de trabajo, los
              clientes y los elevadores.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to={authed ? '/app' : '/registro'} variant="primary" size="lg" iconRight={<ArrowRight aria-hidden />}>
                {authed ? 'Ir a mi panel' : 'Crear cuenta'}
              </ButtonLink>
              {webgl && (
                // La etiqueta ya dice lo que hará el botón, así que no lleva aria-pressed (sería contradictorio)
                <Button size="lg" aria-controls="portada-visual" onClick={() => setShow3d((v) => !v)} icon={show3d ? <Image aria-hidden /> : <Rotate3d aria-hidden />}>
                  {show3d ? 'Ver la imagen' : 'Ver en 3D'}
                </Button>
              )}
            </div>
          </div>
          <div id="portada-visual" className="min-w-0">
            {show3d ? (
              <HeroScene className="aspect-[16/9] h-auto w-full" />
            ) : (
              <HeroImage priority sizes="(min-width: 1024px) 50vw, 100vw" className="h-auto w-full" />
            )}
          </div>
        </section>

        <section id="modos" className="scroll-mt-20 border-t border-line" aria-labelledby="modos-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="modos-title" className="font-display text-2xl font-semibold tracking-tight text-fg-warm sm:text-3xl">
              Para particulares y para talleres
            </h2>
            <p className="mt-3 max-w-2xl text-fg-muted">
              Al registrarte eliges cómo empiezas. Siempre tienes tu garaje personal, y puedes crear un taller o unirte a uno cuando quieras.
            </p>
            <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
              <ModeColumn id="modo-particular" title="Particular" items={PERSONAL} />
              <ModeColumn id="modo-taller" title="Taller y flota" items={WORKSHOP} />
            </div>
          </div>
        </section>

        <section id="zonas" className="scroll-mt-20 border-t border-line" aria-labelledby="zonas-title">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
            <div className="min-w-0">
              <h2 id="zonas-title" className="font-display text-2xl font-semibold tracking-tight text-fg-warm sm:text-3xl">
                El coche, por zonas
              </h2>
              <p className="mt-3 text-fg-muted">
                Motor, frenos, neumáticos, batería… En la ficha de cada vehículo, cada zona del modelo toma el estado del recordatorio más urgente que tengas en ella.
                Si el cambio de aceite te toca por kilómetros y estás cerca, el motor sale como «Próximo».
              </p>
              <p className="mt-4 text-fg-muted">
                CarCare no tiene sensores ni hace diagnósticos: el estado sale de las fechas y los kilómetros que defines tú. Por eso siempre se indica{' '}
                <strong className="font-medium text-fg">«según tus intervalos, no medido»</strong>.
              </p>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-fg">Qué significa cada estado</h3>
              <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
                {ZONE_STATES.map(({ label, text, icon: Icon, cls }) => (
                  <div key={label} className="flex items-start gap-2 py-2.5">
                    <dt className={`inline-flex shrink-0 items-center gap-1.5 font-medium ${cls}`}>
                      <Icon aria-hidden className="size-4" />
                      {label}:
                    </dt>
                    <dd className="text-fg-muted">{text}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-fg-muted">
                Las {ZONES.length} zonas del modelo: {ZONES.map((z) => ZONE_LABEL[z].toLowerCase()).join(', ')}.
              </p>
            </div>
          </div>
        </section>

        <section id="principios" className="scroll-mt-20 border-t border-line" aria-labelledby="principios-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="principios-title" className="font-display text-2xl font-semibold tracking-tight text-fg-warm sm:text-3xl">
              Cómo trata tus datos
            </h2>
            <dl className="mt-8 grid gap-x-12 gap-y-6 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <div key={p.title}>
                  <dt className="font-medium text-fg">{p.title}</dt>
                  <dd className="mt-1 text-sm text-fg-muted">{p.text}</dd>
                </div>
              ))}
            </dl>
            {!authed && (
              <div className="mt-14 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-fg-muted">Crear una cuenta es gratis. Empiezas con tu garaje y añades un taller cuando lo necesites.</p>
                <ButtonLink to="/registro" variant="primary" iconRight={<ArrowRight aria-hidden />}>
                  Crear cuenta
                </ButtonLink>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-fg-subtle sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p>CarCare · Proyecto de fin de grado de DAW (Ilerna)</p>
        </div>
      </footer>
    </div>
  )
}

function ModeColumn({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <div className="min-w-0">
      <h3 id={id} className="font-display text-lg font-semibold text-fg-warm">
        {title}
      </h3>
      <ul aria-labelledby={id} className="mt-3 divide-y divide-line border-y border-line">
        {items.map((t) => (
          <li key={t} className="py-2.5 text-sm text-fg-muted">
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

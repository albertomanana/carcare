import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { motion } from 'motion/react'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { IconButton } from '@/components/ui/Button'
import { PrimaryActionContext } from '@/components/ui/primary-action'
import { PageSpinner } from '@/components/ui/Spinner'
import { Tooltip } from '@/components/ui/Tooltip'
import { QuickActionsProvider } from '@/features/quick-actions/QuickActionsProvider'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { CanvasContext } from './canvas-context'
import { CommandPalette } from './CommandPalette'
import { Logo, LogoMark } from './Logo'
import { MobileNav } from './MobileNav'
import { isNavItemActive, navGroups, type NavGroup, type NavItem, SETTINGS_ITEM } from './nav'
import { NotificationBell } from './NotificationBell'
import { SkipLink } from './SkipLink'
import { UserMenu } from './UserMenu'
import { VehicleDock } from './VehicleDock'
import { VehiclePills } from './VehiclePills'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

/** Muelle del indicador de sección activa: se desliza de una sección a otra con un rebote corto. */
const NAV_SPRING = { type: 'spring', duration: 0.32, bounce: 0.18 } as const

/**
 * Pestaña del carril de navegación. Estrecho (76 px): solo el icono, con el nombre para lectores de pantalla y un tooltip con
 * el nombre y qué hay dentro (también al llegar con el teclado). Activo también en sus rutas `also`: la ficha de un
 * vehículo marca "Garaje". El estado activo lleva color, grosor y `aria-current` (no solo color).
 */
function DockLink({ item, narrow }: { item: NavItem; narrow: boolean }) {
  const Icon = item.icon
  const { pathname } = useLocation()
  const active = isNavItemActive(item, pathname)
  const link = (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold transition-[color,background-color,scale] duration-150 ease-out-soft active:scale-[0.97]',
        active ? 'text-accent-ink' : 'text-fg-muted hover:bg-accent-soft hover:text-fg',
        narrow ? 'justify-center' : 'justify-start',
      )}
    >
      {active && (
        <motion.span
          layoutId="dock-pill"
          aria-hidden
          transition={NAV_SPRING}
          className="absolute inset-0 rounded-control bg-accent-soft shadow-[inset_2px_0_0_0_var(--accent)]"
        />
      )}
      <Icon aria-hidden className="relative size-5 shrink-0" strokeWidth={active ? 2.3 : 2} />
      <span className={cn('relative', narrow && 'sr-only')}>{item.label}</span>
    </Link>
  )
  if (!narrow) return link
  return (
    <Tooltip
      side="right"
      content={
        <>
          <span className="block font-bold">{item.label}</span>
          {item.description && <span className="block text-fg-muted">{item.description}</span>}
        </>
      }
    >
      {link}
    </Tooltip>
  )
}

/** Secciones por grupos de tarea: encabezado en el dock ancho y una línea fina en el estrecho (con el nombre para lectores). */
function DockGroups({ groups, narrow }: { groups: NavGroup[]; narrow: boolean }) {
  return (
    <nav className="flex flex-col gap-4 overflow-y-auto px-3 py-2" aria-label="Secciones">
      {groups.map((g) => {
        const headingId = `nav-${g.id}`
        return (
          <div key={g.id}>
            {g.label &&
              (narrow ? (
                <>
                  <span aria-hidden className="mx-2 mb-3 block border-t border-line" />
                  <span id={headingId} className="sr-only">
                    {g.label}
                  </span>
                </>
              ) : (
                <p id={headingId} className="tag-label mb-1.5 px-3 text-fg-subtle">
                  {g.label}
                </p>
              ))}
            <ul className="flex flex-col gap-1" aria-labelledby={g.label ? headingId : undefined}>
              {g.items.map((item) => (
                <li key={item.to}>
                  <DockLink item={item} narrow={narrow} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

/** Campo de búsqueda: abre la paleta. El atajo Ctrl+K sigue funcionando, pero no se dibuja (5.6). */
function SearchButtons({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden h-10 w-44 shrink-0 items-center gap-2 rounded-control border border-line-strong/45 bg-surface-2 px-3.5 text-sm font-medium text-fg-subtle transition-[border-color,color,scale] duration-150 hover:border-line-strong hover:text-fg-muted active:scale-[0.98] lg:flex xl:w-52"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1 text-left">Buscar…</span>
      </button>
      <IconButton label="Buscar" onClick={onOpen} className="lg:hidden">
        <Search aria-hidden />
      </IconButton>
    </>
  )
}

/**
 * Estructura de la app («Apex Telemetry», 13/11/2026). El corte entre móvil y escritorio está en 1024 px:
 *  - Desde 1024 px: un carril de navegación a la izquierda (76 px con iconos; se puede desplegar a 240 px) con las fichas
 *    de vehículo, y la barra de estado arriba con el espacio, la búsqueda, los avisos y la cuenta. En las pantallas con
 *    escena 3D (`<CanvasBleed>`), carril y barra flotan en los márgenes y la escena ocupa toda la ventana.
 *  - Por debajo: barra de navegación inferior fija (3 secciones, «Registrar» y «Más») y, en el particular, una fila de
 *    píldoras con sus vehículos. Nada depende del 3D para navegar.
 * Una sola acción primaria a la vista (R1): ver `primary-action.ts`.
 * `data-canvas` del `<main>` vale `page` (pantalla normal) o `bleed` (escena a sangre, cabecera flotando encima).
 */
export function AppShell() {
  const ctx = useOptionalWorkspace()
  const location = useLocation()
  // Recogido por defecto: el carril es periférico. Solo se despliega si se pidió (y se recuerda).
  const [collapsed, setCollapsed] = useState(() => readStorage(STORAGE_KEYS.sidebarCollapsed) !== '0')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [claims, setClaims] = useState(0)
  const [bleedClaims, setBleedClaims] = useState(0)
  const groups = navGroups(ctx)
  const items = groups.flatMap((g) => g.items)
  const bleed = bleedClaims > 0
  const home = ctx ? ctx.base : '/app'

  const primaryAction = useMemo(
    () => ({
      claim: () => {
        setClaims((c) => c + 1)
        return () => setClaims((c) => c - 1)
      },
    }),
    [],
  )

  const canvas = useMemo(
    () => ({
      claim: () => {
        setBleedClaims((c) => c + 1)
        return () => setBleedClaims((c) => c - 1)
      },
    }),
    [],
  )

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      writeStorage(STORAGE_KEYS.sidebarCollapsed, c ? '0' : '1')
      return !c
    })
  }

  const openPalette = useCallback(() => setPaletteOpen(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Al cambiar de pantalla, el scroll vuelve arriba
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const maxWidth = ctx?.isWorkshop ? 'max-w-[1440px]' : 'max-w-[1240px]'

  return (
    <QuickActionsProvider>
      <PrimaryActionContext.Provider value={primaryAction}>
        <CanvasContext.Provider value={canvas}>
          {/* --shell-left: el hueco que ocupa el carril (lo usan el contenido y la capa de paneles del lienzo) */}
          <div
            className={cn(
              'flex min-h-dvh flex-col [--shell-left:0px]',
              collapsed ? 'lg:[--shell-left:6.25rem]' : 'lg:[--shell-left:16.5rem]',
              !bleed && 'lg:pl-[var(--shell-left)]',
            )}
          >
            <SkipLink />

            <aside className={cn('hud-panel fixed bottom-3 left-3 top-3 z-30 hidden flex-col lg:flex', collapsed ? 'w-[4.75rem]' : 'w-60')} aria-label="Navegación principal">
              <Link to={home} className={cn('flex h-16 shrink-0 items-center rounded-control', collapsed ? 'justify-center' : 'px-5')} aria-label="CarCare: ir al inicio del espacio">
                {collapsed ? <LogoMark /> : <Logo />}
              </Link>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <DockGroups groups={groups} narrow={collapsed} />
                {ctx && !ctx.isWorkshop && <VehicleDock ctx={ctx} narrow={collapsed} />}
              </div>
              <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
                <DockLink item={SETTINGS_ITEM} narrow={collapsed} />
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold text-fg-muted transition-[color,background-color,scale] duration-150 hover:bg-accent-soft hover:text-fg active:scale-[0.97]',
                    collapsed && 'justify-center',
                  )}
                  aria-label={collapsed ? 'Desplegar la navegación' : 'Recoger la navegación'}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
                  {!collapsed && <span>Recoger</span>}
                </button>
              </div>
            </aside>

            {/* Barra de estado. Mide 4 rem con su margen superior: las barras fijas de las pantallas cuelgan de top-16. */}
            <header
              className={cn(
                'no-print z-20 pt-2',
                bleed ? 'pointer-events-none fixed inset-x-0 top-0 px-3 lg:pl-[var(--shell-left)] lg:pr-6' : cn('sticky top-0 mx-auto w-full px-3 sm:px-6 lg:px-8', maxWidth),
              )}
            >
              <div className="hud-bar pointer-events-auto flex h-14 items-center gap-2 px-2 lg:gap-3 lg:px-3">
                <Link to={home} className="rounded-control lg:hidden" aria-label="CarCare: inicio">
                  <LogoMark />
                </Link>
                <WorkspaceSwitcher />
                <span className="flex-1" />
                <SearchButtons onOpen={openPalette} />
                <NotificationBell />
                <UserMenu />
              </div>
            </header>

            {ctx && !ctx.isWorkshop && !bleed && <VehiclePills ctx={ctx} />}

            <main
              id="contenido"
              tabIndex={-1}
              data-canvas={bleed ? 'bleed' : 'page'}
              className={cn('stagger flex-1 outline-none', !bleed && cn('mx-auto w-full px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-14 lg:pt-6', maxWidth))}
            >
              <Suspense fallback={<PageSpinner />}>
                <Outlet />
              </Suspense>
            </main>

            <MobileNav items={items} onOpenPalette={openPalette} primaryTaken={claims > 0} />
            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          </div>
        </CanvasContext.Provider>
      </PrimaryActionContext.Provider>
    </QuickActionsProvider>
  )
}

export default AppShell

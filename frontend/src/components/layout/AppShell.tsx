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
import { useMediaQuery } from '@/hooks/useMediaQuery'
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
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

/** Muelle del indicador de sección activa: se desliza de una sección a otra con un rebote corto. */
const NAV_SPRING = { type: 'spring', duration: 0.32, bounce: 0.18 } as const

/**
 * Pestaña del dock flotante. Estrecho (76 px): solo el icono, con el nombre para lectores de pantalla y un tooltip con
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
        'relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-[color,background-color,scale] duration-150 ease-out-soft active:scale-[0.97]',
        active ? 'text-accent-ink' : 'text-fg-muted hover:bg-accent-soft hover:text-fg',
        narrow ? 'justify-center' : 'justify-start',
      )}
    >
      {active && (
        <motion.span
          layoutId="dock-pill"
          aria-hidden
          transition={NAV_SPRING}
          className="absolute inset-0 rounded-xl bg-accent-soft shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--accent)_28%,transparent),0_2px_0_0_color-mix(in_srgb,var(--accent)_22%,transparent)]"
        />
      )}
      <Icon aria-hidden className="relative size-5 shrink-0" strokeWidth={active ? 2.5 : 2.1} />
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
        className="hidden h-10 w-44 shrink-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 text-sm font-semibold text-fg-subtle shadow-[inset_0_2px_3px_hsl(var(--shadow-color)/0.06)] transition-[border-color,color,scale] duration-150 hover:border-line-strong hover:text-fg-muted active:scale-[0.98] lg:flex xl:w-52"
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
 * Estructura de la app (mundo «Diorama», 11/11/2026): sobre el lienzo azul pastel flotan
 *  - el dock de navegación (76 px con iconos en tableta, 240 px en escritorio, plegable) con las fichas de vehículo,
 *  - la barra de estado (HUD) con el espacio, la búsqueda, los avisos y la cuenta,
 *  - en el móvil, un dock inferior flotante con 3 secciones, «Registrar» y «Más».
 * Una sola acción primaria a la vista (R1): ver `primary-action.ts`.
 *
 * El contenido puede ir sobre un lienzo a sangre (`<CanvasBleed>` / `useCanvasBleed`): sin márgenes, con la cabecera
 * flotando sobre la escena. `data-canvas` del `<main>` vale `page` (normal), `bleed` (escena a sangre) o `flush`
 * (heredado: sin márgenes pero con la cabecera en el flujo; solo lo usa la ruta `/taller` antigua).
 */
export function AppShell() {
  const ctx = useOptionalWorkspace()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => readStorage(STORAGE_KEYS.sidebarCollapsed) === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [claims, setClaims] = useState(0)
  const [bleedClaims, setBleedClaims] = useState(0)
  const groups = navGroups(ctx)
  const items = groups.flatMap((g) => g.items)
  // Solo iconos con el dock plegado y en tableta (76 px de 768 a 1023 px)
  const wide = useMediaQuery('(min-width: 1024px)')
  const narrow = collapsed || !wide
  const sidebar = !!ctx?.isWorkshop
  const bleed = bleedClaims > 0
  const flush = !bleed && /\/taller\/?$/.test(location.pathname)
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

  const content = (
    <Suspense fallback={<PageSpinner />}>
      <div className="stagger contents">
        <Outlet />
      </div>
    </Suspense>
  )

  const maxWidth = sidebar ? 'max-w-[1440px]' : 'max-w-[1240px]'

  return (
    <QuickActionsProvider>
      <PrimaryActionContext.Provider value={primaryAction}>
        <CanvasContext.Provider value={canvas}>
          {/* --shell-left: el hueco que ocupa el dock a la izquierda (lo usan el contenido y la capa de paneles del lienzo) */}
          <div className={cn('min-h-dvh [--shell-left:0px] md:[--shell-left:6.25rem]', collapsed ? 'lg:[--shell-left:6.25rem]' : 'lg:[--shell-left:16.5rem]')}>
            <SkipLink />

            {/* Dock de navegación flotante (los dos modos): la marca, las secciones y, en el particular, las fichas de vehículo */}
            <aside
              className={cn('hud-panel fixed bottom-3 left-3 top-3 z-30 hidden flex-col md:flex', collapsed ? 'w-[4.75rem]' : 'w-[4.75rem] lg:w-60')}
              aria-label="Navegación principal"
            >
              <div className={cn('flex h-16 shrink-0 items-center px-5', collapsed ? 'justify-center px-0' : 'max-lg:justify-center max-lg:px-0')}>
                <Link to={home} className="rounded-xl" aria-label="CarCare: ir al inicio del espacio">
                  <span className={cn(collapsed ? 'hidden' : 'hidden lg:inline-flex')}>
                    <Logo />
                  </span>
                  <span className={cn(collapsed ? 'inline-flex' : 'inline-flex lg:hidden')}>
                    <LogoMark />
                  </span>
                </Link>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <DockGroups groups={groups} narrow={narrow} />
                {ctx && !ctx.isWorkshop && (
                  <div className="mt-3">
                    <VehicleDock ctx={ctx} narrow={narrow} />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
                <DockLink item={SETTINGS_ITEM} narrow={narrow} />
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className={cn(
                    'hidden min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-fg-muted transition-[color,background-color,scale] duration-150 hover:bg-accent-soft hover:text-fg active:scale-[0.97] lg:flex',
                    collapsed && 'justify-center',
                  )}
                  aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
                  {!collapsed && <span>Contraer</span>}
                </button>
              </div>
            </aside>

            <div className={cn('flex min-h-dvh flex-col', !bleed && 'md:pl-[var(--shell-left)]')}>
              {/* Barra de estado (HUD). Mide 4 rem con su margen superior: las barras fijas de las pantallas cuelgan de top-16. */}
              <header className={cn('no-print z-20', bleed ? 'pointer-events-none fixed inset-x-0 top-0' : 'sticky top-0')}>
                <div className={cn('pt-2', bleed ? 'px-3 md:pl-[var(--shell-left)] md:pr-6' : cn('mx-auto w-full px-3 sm:px-6 lg:px-8', flush ? 'max-w-none' : maxWidth))}>
                  <div className="hud-bar pointer-events-auto flex h-14 items-center gap-2 px-2 md:gap-3 md:px-3">
                    <Link to={home} className="rounded-xl md:hidden" aria-label="CarCare: inicio">
                      <LogoMark />
                    </Link>
                    <WorkspaceSwitcher />
                    <div className="flex-1" />
                    <SearchButtons onOpen={openPalette} />
                    <NotificationBell />
                    <UserMenu />
                  </div>
                </div>
              </header>

              <main
                id="contenido"
                tabIndex={-1}
                data-canvas={bleed ? 'bleed' : flush ? 'flush' : 'page'}
                className={cn(
                  'flex-1 outline-none',
                  bleed
                    ? ''
                    : flush
                      ? 'pb-20 md:pb-0'
                      : cn('mx-auto w-full px-4 pb-28 pt-5 sm:px-6 md:pb-14 md:pt-6 lg:px-8', maxWidth),
                )}
              >
                {content}
              </main>
            </div>

            <MobileNav items={items} onOpenPalette={openPalette} primaryTaken={claims > 0} />
            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          </div>
        </CanvasContext.Provider>
      </PrimaryActionContext.Provider>
    </QuickActionsProvider>
  )
}

export default AppShell

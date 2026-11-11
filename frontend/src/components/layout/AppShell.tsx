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
import { CommandPalette } from './CommandPalette'
import { Logo, LogoMark } from './Logo'
import { MobileNav } from './MobileNav'
import { isNavItemActive, navGroups, type NavGroup, type NavItem, SETTINGS_ITEM } from './nav'
import { PaintFan } from './PaintFan'
import { NotificationBell } from './NotificationBell'
import { SkipLink } from './SkipLink'
import { UserMenu } from './UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

/** Muelle del indicador de sección activa: se desliza de una sección a otra sin rebote apreciable. */
const NAV_SPRING = { type: 'spring', duration: 0.35, bounce: 0.12 } as const

/**
 * Enlace de la barra lateral grafito. Estrecha (76 px): solo el icono, con el nombre para lectores de pantalla y un
 * tooltip con el nombre y qué hay dentro (también al llegar con el teclado). Activo también en sus rutas `also`:
 * la ficha de un vehículo marca "Garaje".
 */
function RailLink({ item, narrow }: { item: NavItem; narrow: boolean }) {
  const Icon = item.icon
  const { pathname } = useLocation()
  const active = isNavItemActive(item, pathname)
  const link = (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150',
        active ? 'text-rail-fg' : 'text-rail-muted hover:bg-rail-2 hover:text-rail-fg',
        narrow ? 'justify-center' : 'justify-start',
      )}
    >
      {active && (
        <motion.span layoutId="rail-pill" aria-hidden transition={NAV_SPRING} className="absolute inset-0 rounded-control bg-rail-2">
          <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-rail-accent" />
        </motion.span>
      )}
      <Icon aria-hidden className={cn('relative size-5 shrink-0', active && 'text-rail-accent')} />
      <span className={cn('relative', narrow && 'sr-only')}>{item.label}</span>
    </Link>
  )
  if (!narrow) return link
  return (
    <Tooltip
      side="right"
      content={
        <>
          <span className="block font-medium">{item.label}</span>
          {item.description && <span className="block text-fg-muted">{item.description}</span>}
        </>
      }
    >
      {link}
    </Tooltip>
  )
}

/** Secciones por grupos de tarea: encabezado en la barra ancha y una línea fina en la estrecha (con el nombre para lectores). */
function RailGroups({ groups, narrow }: { groups: NavGroup[]; narrow: boolean }) {
  return (
    <nav className="flex flex-col gap-4 overflow-y-auto px-3 py-3" aria-label="Secciones">
      {groups.map((g) => {
        const headingId = `nav-${g.id}`
        return (
          <div key={g.id}>
            {g.label &&
              (narrow ? (
                <>
                  <span aria-hidden className="mx-2 mb-3 block border-t border-rail-line" />
                  <span id={headingId} className="sr-only">
                    {g.label}
                  </span>
                </>
              ) : (
                <p id={headingId} className="tag-label mb-1.5 px-3 text-rail-muted">
                  {g.label}
                </p>
              ))}
            <ul className="flex flex-col gap-1" aria-labelledby={g.label ? headingId : undefined}>
              {g.items.map((item) => (
                <li key={item.to}>
                  <RailLink item={item} narrow={narrow} />
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
        className="hidden h-10 w-44 shrink-0 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted lg:flex xl:w-52"
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
 * Estructura de la app (rediseño «Carta de colores»): barra lateral grafito en los dos modos (76 px con iconos en tableta,
 * 256 px en escritorio, plegable), cabecera opaca con el espacio, la búsqueda y la cuenta, y el contenido. En el
 * particular, la barra lleva el abanico de muestras de sus vehículos. En el móvil, barra inferior con 3 secciones,
 * "Registrar" y "Más". Una sola acción primaria a la vista (R1): ver `primary-action.ts`.
 */
export function AppShell() {
  const ctx = useOptionalWorkspace()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => readStorage(STORAGE_KEYS.sidebarCollapsed) === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [claims, setClaims] = useState(0)
  const groups = navGroups(ctx)
  const items = groups.flatMap((g) => g.items)
  // Solo iconos con la barra plegada y en tableta (76 px de 768 a 1023 px)
  const wide = useMediaQuery('(min-width: 1024px)')
  const narrow = collapsed || !wide
  const sidebar = !!ctx?.isWorkshop
  const fullBleed = /\/taller\/?$/.test(location.pathname)
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

  const skipLink = <SkipLink />

  const content = (
    <Suspense fallback={<PageSpinner />}>
      <div className="stagger contents">
        <Outlet />
      </div>
    </Suspense>
  )

  return (
    <QuickActionsProvider>
      <PrimaryActionContext.Provider value={primaryAction}>
        <div className="min-h-dvh">
          {skipLink}

          {/* Barra lateral grafito (los dos modos): la marca, las secciones y, en el particular, el abanico de muestras */}
          <aside
            className={cn('rail fixed inset-y-0 left-0 z-30 hidden flex-col bg-rail text-rail-fg md:flex', collapsed ? 'w-[76px]' : 'w-[76px] lg:w-64')}
            aria-label="Navegación principal"
          >
            <div className={cn('flex h-16 shrink-0 items-center px-5', collapsed ? 'justify-center px-0' : 'max-lg:justify-center max-lg:px-0')}>
              <Link to={home} className="rounded-control" aria-label="CarCare: ir al inicio del espacio">
                <span className={cn(collapsed ? 'hidden' : 'hidden lg:inline-flex')}>
                  <Logo inverted />
                </span>
                <span className={cn(collapsed ? 'inline-flex' : 'inline-flex lg:hidden')}>
                  <LogoMark />
                </span>
              </Link>
            </div>
            <RailGroups groups={groups} narrow={narrow} />
            {ctx && !ctx.isWorkshop && !collapsed && (
              <div className="mt-4 hidden lg:block">
                <PaintFan ctx={ctx} />
              </div>
            )}
            <div className="min-h-4 flex-1" />
            <div className="flex flex-col gap-1 border-t border-rail-line px-3 py-3">
              <RailLink item={SETTINGS_ITEM} narrow={narrow} />
              <button
                type="button"
                onClick={toggleCollapsed}
                className={cn(
                  'hidden min-h-11 items-center gap-3 rounded-control px-3 text-sm text-rail-muted transition-colors duration-150 hover:bg-rail-2 hover:text-rail-fg lg:flex',
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

          <div className={cn('flex min-h-dvh flex-col', collapsed ? 'md:pl-[76px]' : 'md:pl-[76px] lg:pl-64')}>
            <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas">
              <div className="flex h-16 items-center gap-2 px-3 md:gap-3 md:px-6 lg:px-8">
                <Link to={home} className="rounded-control md:hidden" aria-label="CarCare: inicio">
                  <LogoMark />
                </Link>
                <WorkspaceSwitcher />
                <div className="flex-1" />
                <SearchButtons onOpen={openPalette} />
                <NotificationBell />
                <UserMenu />
              </div>
            </header>

            <main
              id="contenido"
              tabIndex={-1}
              className={cn(
                'flex-1 outline-none',
                fullBleed ? 'pb-20 md:pb-0' : cn('mx-auto w-full px-4 pb-28 pt-5 sm:px-6 md:pb-14 md:pt-8 lg:px-8', sidebar ? 'max-w-[1440px]' : 'max-w-[1240px]'),
              )}
            >
              {content}
            </main>
          </div>

          <MobileNav items={items} onOpenPalette={openPalette} primaryTaken={claims > 0} />
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </div>
      </PrimaryActionContext.Provider>
    </QuickActionsProvider>
  )
}

export default AppShell

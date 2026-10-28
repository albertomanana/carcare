import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { IconButton } from '@/components/ui/Button'
import { PrimaryActionContext } from '@/components/ui/primary-action'
import { PageSpinner } from '@/components/ui/Spinner'
import { QuickActionsProvider } from '@/features/quick-actions/QuickActionsProvider'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { CommandPalette } from './CommandPalette'
import { Logo, LogoMark } from './Logo'
import { MobileNav } from './MobileNav'
import { navItems, SETTINGS_ITEM, type NavItem } from './nav'
import { UserMenu } from './UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150',
          isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
          collapsed ? 'justify-center' : 'lg:justify-start max-lg:justify-center',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-fg" />}
          <Icon aria-hidden className="size-5 shrink-0" />
          <span className={cn(collapsed ? 'sr-only' : 'max-lg:sr-only')}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Enlace de la barra superior (particular): solo texto, sin icono (regla R7). */
function TopNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'inline-flex min-h-10 items-center rounded-control px-3 text-sm font-medium transition-colors duration-150',
          isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {item.label}
    </NavLink>
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
        className="hidden h-10 w-56 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted lg:flex"
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
 * Estructura de la app (5.6 del informe de UX):
 * - particular: barra superior con las secciones y el contenido centrado (máx. 1.100 px);
 * - taller: barra lateral de 220 px (tiene 7‑8 secciones);
 * - móvil: barra inferior con 3 secciones, "Registrar" y "Más".
 * Las barras son opacas (R8). Una sola acción primaria a la vista (R1): ver `primary-action.ts`.
 */
export function AppShell() {
  const ctx = useOptionalWorkspace()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => readStorage(STORAGE_KEYS.sidebarCollapsed) === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [claims, setClaims] = useState(0)
  const items = navItems(ctx)
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

  const skipLink = (
    <a
      href="#contenido"
      className="sr-only z-[70] rounded-control bg-accent px-4 py-2 text-sm font-semibold text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Saltar al contenido
    </a>
  )

  const content = (
    <Suspense fallback={<PageSpinner />}>
      <Outlet />
    </Suspense>
  )

  return (
    <QuickActionsProvider>
      <PrimaryActionContext.Provider value={primaryAction}>
        <div className="min-h-dvh bg-canvas">
          {skipLink}

          {sidebar ? (
            <>
              {/* Taller: barra lateral */}
              <aside
                className={cn(
                  'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface md:flex',
                  collapsed ? 'w-[76px]' : 'w-[76px] lg:w-[220px]',
                )}
                aria-label="Navegación principal"
              >
                <div className={cn('flex h-16 items-center px-4', collapsed ? 'justify-center' : 'max-lg:justify-center')}>
                  <Link to={home} className="rounded-control" aria-label="CarCare: ir al inicio del espacio">
                    <span className={cn(collapsed ? 'hidden' : 'hidden lg:inline-flex')}>
                      <Logo />
                    </span>
                    <span className={cn(collapsed ? 'inline-flex' : 'inline-flex lg:hidden')}>
                      <LogoMark />
                    </span>
                  </Link>
                </div>
                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3" aria-label="Secciones">
                  {items.map((item) => (
                    <SidebarLink key={item.to} item={item} collapsed={collapsed} />
                  ))}
                </nav>
                <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
                  <SidebarLink item={SETTINGS_ITEM} collapsed={collapsed} />
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    className={cn(
                      'hidden min-h-11 items-center gap-3 rounded-control px-3 text-sm text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg lg:flex',
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

              <div className={cn('flex min-h-dvh flex-col', collapsed ? 'md:pl-[76px]' : 'md:pl-[76px] lg:pl-[220px]')}>
                <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas">
                  <div className="flex h-16 items-center gap-2 px-3 md:gap-3 md:px-6">
                    <Link to={home} className="rounded-control md:hidden" aria-label="CarCare: inicio">
                      <LogoMark />
                    </Link>
                    <WorkspaceSwitcher />
                    <div className="flex-1" />
                    <SearchButtons onOpen={openPalette} />
                    <UserMenu />
                  </div>
                </header>

                <main
                  id="contenido"
                  tabIndex={-1}
                  className={cn(
                    'flex-1 outline-none',
                    fullBleed ? 'pb-20 md:pb-0' : 'mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 md:pb-14 md:pt-8 lg:px-8',
                  )}
                >
                  {content}
                </main>
              </div>
            </>
          ) : (
            <div className="flex min-h-dvh flex-col">
              {/* Particular: barra superior con las secciones */}
              <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas">
                <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center gap-2 px-4 sm:px-6 md:gap-3">
                  <Link to={home} className="shrink-0 rounded-control" aria-label="CarCare: inicio">
                    <span className="hidden lg:inline-flex">
                      <Logo />
                    </span>
                    <span className="inline-flex lg:hidden">
                      <LogoMark />
                    </span>
                  </Link>
                  <WorkspaceSwitcher />
                  <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
                    {items.map((item) => (
                      <TopNavLink key={item.to} item={item} />
                    ))}
                  </nav>
                  <div className="flex-1" />
                  <SearchButtons onOpen={openPalette} />
                  <UserMenu />
                </div>
              </header>

              <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-28 pt-5 outline-none sm:px-6 md:pb-14 md:pt-8">
                {content}
              </main>
            </div>
          )}

          <MobileNav items={items} onOpenPalette={openPalette} primaryTaken={claims > 0} />
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </div>
      </PrimaryActionContext.Provider>
    </QuickActionsProvider>
  )
}

export default AppShell

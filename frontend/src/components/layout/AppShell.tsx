import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { IconButton } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { QuickActionsProvider } from '@/features/quick-actions/QuickActionsProvider'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { CommandPalette } from './CommandPalette'
import { Logo, LogoMark } from './Logo'
import { MobileNav } from './MobileNav'
import { navItems, SETTINGS_ITEM, type NavItem } from './nav'
import { ThemeToggle, UserMenu } from './UserMenu'
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
          'group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150',
          isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
          collapsed ? 'justify-center' : 'lg:justify-start max-lg:justify-center',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
          <Icon aria-hidden className={cn('size-5 shrink-0', isActive && 'text-accent-ink')} />
          <span className={cn(collapsed ? 'sr-only' : 'max-lg:sr-only')}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Estructura de la app: barra lateral (escritorio), barra superior y navegación inferior (móvil). */
export function AppShell() {
  const ctx = useOptionalWorkspace()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => readStorage(STORAGE_KEYS.sidebarCollapsed) === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const items = navItems(ctx)
  const fullBleed = /\/taller\/?$/.test(location.pathname)

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

  return (
    <QuickActionsProvider>
      <div className="min-h-dvh bg-canvas">
        <a
          href="#contenido"
          className="sr-only z-[70] rounded-control bg-accent px-4 py-2 text-sm font-semibold text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Saltar al contenido
        </a>

        {/* Barra lateral */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface/70 backdrop-blur-xl md:flex',
            collapsed ? 'w-[76px]' : 'w-[76px] lg:w-64',
          )}
          aria-label="Navegación principal"
        >
          <div className={cn('flex h-16 items-center px-4', collapsed ? 'justify-center' : 'max-lg:justify-center')}>
            <Link to={ctx ? ctx.base : '/app'} className="rounded-control" aria-label="CarCare: ir al inicio del espacio">
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

        <div className={cn('flex min-h-dvh flex-col', collapsed ? 'md:pl-[76px]' : 'md:pl-[76px] lg:pl-64')}>
          {/* Barra superior */}
          <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-2 px-3 md:gap-3 md:px-6">
              <Link to={ctx ? ctx.base : '/app'} className="rounded-control md:hidden" aria-label="CarCare: inicio">
                <LogoMark />
              </Link>
              <WorkspaceSwitcher />
              <div className="flex-1" />
              <button
                type="button"
                onClick={openPalette}
                className="hidden h-10 w-72 items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted md:flex"
                aria-label="Abrir buscador y paleta de comandos (Ctrl+K)"
              >
                <Search aria-hidden className="size-4" />
                <span className="flex-1 text-left">Buscar o ejecutar…</span>
                <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px]">Ctrl K</kbd>
              </button>
              <IconButton label="Buscar" onClick={openPalette} className="md:hidden">
                <Search aria-hidden />
              </IconButton>
              <span className="hidden md:block">
                <ThemeToggle />
              </span>
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
            <Suspense fallback={<PageSpinner />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <MobileNav items={items} onOpenPalette={openPalette} />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </QuickActionsProvider>
  )
}

export default AppShell

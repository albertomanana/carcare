import { BellPlus, ClipboardPlus, Ellipsis, FileText, Gauge, Plus, Receipt, Search, Wrench } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router'
import { nextThemeMode, THEME_MODE_ACTION, useTheme } from '@/app/theme-context'
import { Dialog, DialogBody, DialogContent } from '@/components/ui/Dialog'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { isNavItemActive, navGroups, type NavItem, SETTINGS_ITEM } from './nav'
import { ThemeModeIcon } from './UserMenu'

/** Fila de las hojas "Registrar" y "Más": icono pequeño sin baldosa (R7) y texto. */
function SheetButton({
  icon,
  label,
  description,
  current,
  onClick,
}: {
  icon: ReactNode
  label: string
  description?: string
  /** La pantalla actual: se marca con fondo y "Estás aquí" (no solo con color). */
  current?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-control px-3 text-left transition-[background-color,scale] duration-150 ease-out-soft hover:bg-accent-soft active:scale-[0.98] [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-fg-muted',
        current && 'bg-accent-soft',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{label}</span>
        {description && <span className="block text-xs text-fg-muted">{description}</span>}
      </span>
      {current && <span className="shrink-0 text-xs text-fg-muted">Estás aquí</span>}
    </button>
  )
}

/**
 * Barra de navegación inferior, fija, por debajo de 1024 px: 3 secciones + "Registrar" + "Más" (5.6). Cada destino mide
 * 56 px de alto y ocupa un quinto del ancho.
 * "Registrar" solo se pinta con el acento si la pantalla no tiene ya su propia acción primaria (regla R1).
 */
export function MobileNav({ items, onOpenPalette, primaryTaken = false }: { items: NavItem[]; onOpenPalette: () => void; primaryTaken?: boolean }) {
  const ctx = useOptionalWorkspace()
  const quick = useQuickActions()
  const navigate = useNavigate()
  const { mode, cycleMode } = useTheme()
  const nextMode = nextThemeMode(mode)
  const [addOpen, setAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const primary = items.filter((i) => i.mobile).slice(0, 3)
  const inBar = new Set(primary.map((i) => i.to))
  // La hoja "Más" repite los grupos de la barra lateral (sin lo que ya está abajo), con qué hay en cada sección
  const restGroups = [
    ...navGroups(ctx)
      .map((g) => ({ ...g, items: g.items.filter((i) => !inBar.has(i.to)) }))
      .filter((g) => g.items.length > 0),
    { id: 'cuenta', label: 'Cuenta', items: [SETTINGS_ITEM] },
  ]
  const rest = restGroups.flatMap((g) => g.items)
  // Si la pantalla es de una sección de "Más", "Más" se marca como activo: siempre sabes dónde estás
  const moreActive = !primary.some((i) => isNavItemActive(i, pathname)) && rest.some((i) => isNavItemActive(i, pathname))
  // En la ficha de un vehículo, "Registrar" va directo a ese vehículo (la cabecera no repite el botón en el móvil)
  const vehicleMatch = useMatch('/app/:ws/vehiculos/:vehicleId/*')
  const vehicleNumber = Number(vehicleMatch?.params.vehicleId)
  const vehicleId = Number.isInteger(vehicleNumber) && vehicleNumber > 0 ? vehicleNumber : undefined

  const run = (fn: () => void) => {
    setAddOpen(false)
    setMoreOpen(false)
    setTimeout(fn, 0)
  }

  const tab = (item: NavItem) => {
    const Icon = item.icon
    const isActive = isNavItemActive(item, pathname)
    return (
      <Link
        key={item.to}
        to={item.to}
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.mobileLabel ? item.label : undefined}
        className={cn(
          'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-control pb-2 text-xs font-semibold transition-[color,background-color,scale] duration-150 ease-out-soft active:scale-95',
          isActive ? 'bg-accent-soft text-accent-ink' : 'text-fg-muted',
        )}
      >
        <Icon aria-hidden className="size-5 shrink-0" strokeWidth={isActive ? 2.4 : 2} />
        <span className="max-w-full truncate px-1 leading-none">{item.mobileLabel ?? item.label}</span>
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-0.5 border-t border-[var(--glass-edge)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-2 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-[16px] lg:hidden"
      >
        {primary.slice(0, 2).map(tab)}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={!ctx}
          className="group flex min-h-14 min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-2 text-xs font-semibold leading-none text-fg-muted disabled:opacity-50"
        >
          <span
            aria-hidden
            className={cn(
              '-mt-5 grid size-12 place-items-center rounded-full transition-[background-color,scale] duration-150 ease-out-soft group-active:scale-90',
              primaryTaken ? 'border border-line-strong/45 bg-surface-2 text-fg' : 'bg-accent text-on-accent shadow-[0_8px_18px_-8px_var(--accent)]',
            )}
          >
            <Plus className="size-6" strokeWidth={2.75} />
          </span>
          Registrar
        </button>
        {primary.slice(2).map(tab)}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn('flex min-h-14 min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-control pb-2 text-xs font-semibold leading-none transition-[color,background-color,scale] duration-150 ease-out-soft active:scale-95', moreActive ? 'bg-accent-soft text-accent-ink' : 'text-fg-muted')}
          aria-label={moreActive ? 'Más secciones (estás en una de ellas)' : 'Más secciones'}
        >
          <Ellipsis aria-hidden className="size-5" strokeWidth={moreActive ? 2.4 : 2} />
          Más
        </button>
      </nav>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent title="Registrar">
          <DialogBody className="grid gap-1">
            <SheetButton icon={<Gauge aria-hidden />} label="Kilometraje" description="Los km del cuentakilómetros" onClick={() => run(() => quick.run('mileage', vehicleId))} />
            {ctx?.isPersonal && ctx.canExpenses && (
              <SheetButton icon={<Receipt aria-hidden />} label="Gasto o repostaje" description="Combustible, seguro, aparcamiento…" onClick={() => run(() => quick.run('expense', vehicleId))} />
            )}
            <SheetButton icon={<Wrench aria-hidden />} label="Intervención" description="Mantenimiento, reparación, ITV…" onClick={() => run(() => quick.run('record', vehicleId))} />
            <SheetButton icon={<BellPlus aria-hidden />} label="Recordatorio" description="Por fecha o por kilómetros" onClick={() => run(() => quick.run('reminder', vehicleId))} />
            {ctx && vehicleId && (
              <SheetButton
                icon={<FileText aria-hidden />}
                label="Documento"
                description="Factura, seguro, ficha técnica…"
                onClick={() => run(() => navigate(`${ctx.base}/vehiculos/${vehicleId}/datos?subir=1#documentos`))}
              />
            )}
            {ctx?.isWorkshop && (
              <SheetButton icon={<ClipboardPlus aria-hidden />} label="Orden de trabajo" description="Para un coche que entra al taller" onClick={() => run(() => navigate(`${ctx.base}/ordenes/nueva`))} />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent title="Más">
          <DialogBody className="grid gap-1">
            <SheetButton icon={<Search aria-hidden />} label="Buscar" description="Vehículos, acciones y secciones" onClick={() => run(onOpenPalette)} />
            {restGroups.map((g) => (
              <section key={g.id} aria-labelledby={g.label ? `mas-${g.id}` : undefined} className="mt-2 grid gap-1">
                {g.label && (
                  <h3 id={`mas-${g.id}`} className="tag-label px-3 pt-1 text-fg-muted">
                    {g.label}
                  </h3>
                )}
                {g.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <SheetButton
                      key={item.to}
                      icon={<Icon aria-hidden />}
                      label={item.label}
                      description={item.description}
                      current={isNavItemActive(item, pathname)}
                      onClick={() => run(() => navigate(item.to))}
                    />
                  )
                })}
              </section>
            ))}
            <SheetButton icon={<ThemeModeIcon mode={nextMode} />} label={THEME_MODE_ACTION[nextMode]} onClick={cycleMode} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

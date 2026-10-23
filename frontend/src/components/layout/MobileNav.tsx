import { BellPlus, ClipboardPlus, Ellipsis, Gauge, Moon, Plus, Receipt, Search, Sun, Wrench } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { useTheme } from '@/app/theme-context'
import { Dialog, DialogBody, DialogContent } from '@/components/ui/Dialog'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { type NavItem, SETTINGS_ITEM } from './nav'

function SheetButton({ icon, label, description, onClick }: { icon: ReactNode; label: string; description?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-card border border-line bg-surface-2 px-4 text-left transition-colors hover:bg-surface-3"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface text-accent-ink [&_svg]:size-5">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{label}</span>
        {description && <span className="block text-xs text-fg-muted">{description}</span>}
      </span>
    </button>
  )
}

/** Navegación inferior en móvil: 3 secciones + acción rápida central + "Más". */
export function MobileNav({ items, onOpenPalette }: { items: NavItem[]; onOpenPalette: () => void }) {
  const ctx = useOptionalWorkspace()
  const quick = useQuickActions()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [addOpen, setAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const primary = items.filter((i) => i.mobile).slice(0, 3)
  const rest = [...items.filter((i) => !primary.includes(i)), SETTINGS_ITEM]

  const run = (fn: () => void) => {
    setAddOpen(false)
    setMoreOpen(false)
    setTimeout(fn, 0)
  }

  const tab = (item: NavItem) => {
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-accent-ink' : 'text-fg-subtle')
        }
      >
        <Icon aria-hidden className="size-5" />
        <span className="max-w-full truncate px-1">{item.label}</span>
      </NavLink>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch px-1">
          {primary.slice(0, 2).map(tab)}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="grid size-12 -translate-y-3 place-items-center rounded-full bg-accent text-on-accent shadow-lg shadow-black/30 ring-4 ring-canvas transition-transform active:scale-95"
              aria-label="Acciones rápidas"
              disabled={!ctx}
            >
              <Plus aria-hidden className="size-6" strokeWidth={2.5} />
            </button>
          </div>
          {primary.slice(2).map(tab)}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-fg-subtle"
            aria-label="Más secciones"
          >
            <Ellipsis aria-hidden className="size-5" />
            Más
          </button>
        </div>
      </nav>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent title="Acción rápida" description="Registra algo en un par de toques.">
          <DialogBody className="grid gap-2">
            <SheetButton icon={<Gauge />} label="Actualizar kilometraje" description="Anota los km del cuentakilómetros" onClick={() => run(() => quick.run('mileage'))} />
            {ctx?.isPersonal && ctx.canExpenses && (
              <SheetButton icon={<Receipt />} label="Añadir gasto" description="Repostaje, seguro, parking…" onClick={() => run(() => quick.run('expense'))} />
            )}
            <SheetButton icon={<Wrench />} label="Nueva intervención" description="Mantenimiento, reparación, ITV…" onClick={() => run(() => quick.run('record'))} />
            <SheetButton icon={<BellPlus />} label="Nuevo recordatorio" description="Por fecha o por kilómetros" onClick={() => run(() => quick.run('reminder'))} />
            {ctx?.isWorkshop && (
              <SheetButton icon={<ClipboardPlus />} label="Nueva orden de trabajo" onClick={() => run(() => navigate(`${ctx.base}/ordenes/nueva`))} />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent title="Más">
          <DialogBody className="grid gap-2">
            <SheetButton icon={<Search />} label="Buscar" description="Vehículos, acciones y secciones" onClick={() => run(onOpenPalette)} />
            {rest.map((item) => {
              const Icon = item.icon
              return <SheetButton key={item.to} icon={<Icon />} label={item.label} onClick={() => run(() => navigate(item.to))} />
            })}
            <SheetButton
              icon={theme === 'dark' ? <Sun /> : <Moon />}
              label={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
              onClick={() => {
                toggleTheme()
              }}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

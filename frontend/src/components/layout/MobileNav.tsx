import { BellPlus, ClipboardPlus, Ellipsis, FileText, Gauge, Moon, Plus, Receipt, Search, Sun, Wrench } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { NavLink, useMatch, useNavigate } from 'react-router'
import { useTheme } from '@/app/theme-context'
import { Dialog, DialogBody, DialogContent } from '@/components/ui/Dialog'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { type NavItem, SETTINGS_ITEM } from './nav'

/** Fila de las hojas "Registrar" y "Más": icono pequeño sin baldosa (R7) y texto. */
function SheetButton({ icon, label, description, onClick }: { icon: ReactNode; label: string; description?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-control px-3 text-left transition-colors hover:bg-surface-2 [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-fg-muted"
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="block text-xs text-fg-muted">{description}</span>}
      </span>
    </button>
  )
}

/**
 * Navegación inferior en el móvil: 3 secciones + "Registrar" + "Más" (5.6).
 * "Registrar" solo se pinta con el acento si la pantalla no tiene ya su propia acción primaria (regla R1).
 */
export function MobileNav({ items, onOpenPalette, primaryTaken = false }: { items: NavItem[]; onOpenPalette: () => void; primaryTaken?: boolean }) {
  const ctx = useOptionalWorkspace()
  const quick = useQuickActions()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [addOpen, setAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const primary = items.filter((i) => i.mobile).slice(0, 3)
  const rest = [...items.filter((i) => !primary.includes(i)), SETTINGS_ITEM]
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
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        aria-label={item.mobileLabel ? item.label : undefined}
        className={({ isActive }) =>
          cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-fg' : 'text-fg-subtle')
        }
      >
        {({ isActive }) => (
          <>
            <Icon aria-hidden className="size-5" strokeWidth={isActive ? 2.4 : 2} />
            <span className="max-w-full truncate px-1">{item.mobileLabel ?? item.label}</span>
          </>
        )}
      </NavLink>
    )
  }

  return (
    <>
      <nav aria-label="Navegación principal" className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch px-1">
          {primary.slice(0, 2).map(tab)}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!ctx}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-fg-subtle disabled:opacity-50"
          >
            <span
              aria-hidden
              className={cn(
                'grid size-8 place-items-center rounded-full transition-colors',
                primaryTaken ? 'border border-line-strong text-fg' : 'bg-accent text-on-accent',
              )}
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </span>
            Registrar
          </button>
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
              <SheetButton icon={<ClipboardPlus aria-hidden />} label="Orden de trabajo" onClick={() => run(() => navigate(`${ctx.base}/ordenes/nueva`))} />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent title="Más">
          <DialogBody className="grid gap-1">
            <SheetButton icon={<Search aria-hidden />} label="Buscar" description="Vehículos, acciones y secciones" onClick={() => run(onOpenPalette)} />
            {rest.map((item) => {
              const Icon = item.icon
              return <SheetButton key={item.to} icon={<Icon aria-hidden />} label={item.label} onClick={() => run(() => navigate(item.to))} />
            })}
            <SheetButton icon={theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />} label={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'} onClick={toggleTheme} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

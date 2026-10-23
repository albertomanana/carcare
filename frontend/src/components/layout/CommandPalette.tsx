import * as RD from '@radix-ui/react-dialog'
import {
  Car,
  ClipboardPlus,
  CornerDownLeft,
  Gauge,
  type LucideIcon,
  Moon,
  Plus,
  Receipt,
  Search,
  Settings,
  BellPlus,
  UserPlus,
  Wrench,
  Warehouse,
} from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useVehicles } from '@/api/hooks/vehicles'
import { useTheme } from '@/app/theme-context'
import { useAuth } from '@/features/auth/auth-context'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { normalizeSearch } from '@/lib/brands'
import { cn } from '@/lib/cn'
import { navItems, SETTINGS_ITEM } from './nav'

interface Command {
  id: string
  group: 'Acciones' | 'Ir a' | 'Vehículos' | 'Espacios' | 'Preferencias'
  label: string
  hint?: string
  icon: LucideIcon
  keywords?: string
  perform: () => void
}

const GROUP_ORDER: Command['group'][] = ['Acciones', 'Vehículos', 'Ir a', 'Espacios', 'Preferencias']

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ctx = useOptionalWorkspace()
  const { workspaces } = useAuth()
  const { toggleTheme, theme } = useTheme()
  const quick = useQuickActions()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const vehiclesQuery = useVehicles(ctx?.id, { per_page: 100, sort: 'name' }, open)
  const vehicles = vehiclesQuery.data?.data ?? []

  const commands = useMemo<Command[]>(() => {
    const close = (fn: () => void) => () => {
      onOpenChange(false)
      // Deja cerrar la paleta antes de abrir otro diálogo
      setTimeout(fn, 0)
    }
    const list: Command[] = []
    if (ctx) {
      const { base, isWorkshop, isPersonal } = ctx
      list.push({ id: 'a-km', group: 'Acciones', label: 'Actualizar kilometraje', icon: Gauge, keywords: 'km odometro lectura', perform: close(() => quick.run('mileage')) })
      if (isPersonal && ctx.canExpenses)
        list.push({ id: 'a-expense', group: 'Acciones', label: 'Añadir gasto', icon: Receipt, keywords: 'repostaje gasolina combustible', perform: close(() => quick.run('expense')) })
      list.push({ id: 'a-record', group: 'Acciones', label: 'Nueva intervención', icon: Wrench, keywords: 'mantenimiento reparacion aceite itv', perform: close(() => quick.run('record')) })
      list.push({ id: 'a-reminder', group: 'Acciones', label: 'Nuevo recordatorio', icon: BellPlus, keywords: 'aviso vencimiento', perform: close(() => quick.run('reminder')) })
      list.push({ id: 'a-vehicle', group: 'Acciones', label: 'Añadir vehículo', icon: Plus, keywords: 'coche nuevo alta', perform: close(() => navigate(`${base}/vehiculos/nuevo`)) })
      if (isWorkshop) {
        list.push({ id: 'a-order', group: 'Acciones', label: 'Nueva orden de trabajo', icon: ClipboardPlus, keywords: 'ot orden', perform: close(() => navigate(`${base}/ordenes/nueva`)) })
        list.push({ id: 'a-customer', group: 'Acciones', label: 'Nuevo cliente', icon: UserPlus, keywords: 'cliente', perform: close(() => navigate(`${base}/clientes?nuevo=1`)) })
      }
      for (const v of vehicles) {
        list.push({
          id: `v-${v.id}`,
          group: 'Vehículos',
          label: v.display_name,
          hint: [v.plate, v.customer?.name].filter(Boolean).join(' · ') || undefined,
          icon: Car,
          keywords: `${v.make} ${v.model} ${v.plate ?? ''} ${v.vin ?? ''} ${v.customer?.name ?? ''}`,
          perform: close(() => navigate(`${base}/vehiculos/${v.id}`)),
        })
      }
    }
    for (const item of [...navItems(ctx), SETTINGS_ITEM]) {
      list.push({ id: `n-${item.to}`, group: 'Ir a', label: item.label, icon: item.to === SETTINGS_ITEM.to ? Settings : item.icon, perform: close(() => navigate(item.to)) })
    }
    for (const w of workspaces) {
      if (w.id === ctx?.id) continue
      list.push({
        id: `w-${w.id}`,
        group: 'Espacios',
        label: `Cambiar a ${w.type === 'personal' ? 'Mi garaje' : w.name}`,
        icon: w.type === 'workshop' ? Warehouse : Car,
        perform: close(() => navigate(`/app/${w.id}`)),
      })
    }
    list.push({ id: 'p-theme', group: 'Preferencias', label: theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro', icon: Moon, keywords: 'tema modo oscuro claro', perform: close(toggleTheme) })
    return list
  }, [ctx, vehicles, workspaces, theme, toggleTheme, quick, navigate, onOpenChange])

  const filtered = useMemo(() => {
    const q = normalizeSearch(query)
    const matches = q
      ? commands.filter((c) => normalizeSearch(`${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.group}`).includes(q))
      : commands.filter((c) => c.group !== 'Vehículos' || commands.filter((x) => x.group === 'Vehículos').indexOf(c) < 5)
    return GROUP_ORDER.flatMap((g) => matches.filter((c) => c.group === g))
  }, [commands, query])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(filtered.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[active]?.perform()
    }
  }

  let lastGroup: string | null = null

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <RD.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[8dvh] z-50 flex max-h-[80dvh] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-hero border border-line bg-surface shadow-2xl shadow-black/50 outline-none data-[state=open]:animate-pop-in"
        >
          <RD.Title className="sr-only">Paleta de comandos</RD.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search aria-hidden className="size-5 shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Busca un vehículo, una acción o una sección…"
              className="h-14 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-list"
              aria-activedescendant={filtered[active] ? `cmd-${filtered[active].id}` : undefined}
              aria-autocomplete="list"
              aria-label="Buscar comandos"
              style={{ outline: 'none' }}
            />
            <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] text-fg-subtle sm:block">Esc</kbd>
          </div>
          <div ref={listRef} id="command-list" role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.length === 0 && <p className="px-3 py-10 text-center text-sm text-fg-muted">Nada coincide con «{query}».</p>}
            {filtered.map((cmd, index) => {
              const header = cmd.group !== lastGroup ? cmd.group : null
              lastGroup = cmd.group
              const Icon = cmd.icon
              return (
                <div key={cmd.id}>
                  {header && (
                    <div role="presentation" className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle first:pt-1">
                      {header}
                    </div>
                  )}
                  <div
                    id={`cmd-${cmd.id}`}
                    role="option"
                    aria-selected={index === active}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => cmd.perform()}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-sm',
                      index === active ? 'bg-surface-3 text-fg' : 'text-fg-muted',
                    )}
                  >
                    <Icon aria-hidden className={cn('size-4 shrink-0', index === active && 'text-accent-ink')} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-fg">{cmd.label}</span>
                      {cmd.hint && <span className="ml-2 text-xs text-fg-subtle">{cmd.hint}</span>}
                    </span>
                    {index === active && <CornerDownLeft aria-hidden className="size-3.5 text-fg-subtle" />}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-fg-subtle sm:flex">
            <span>
              <kbd className="font-sans">↑↓</kbd> moverse
            </span>
            <span>
              <kbd className="font-sans">↵</kbd> abrir
            </span>
            <span>
              <kbd className="font-sans">Ctrl K</kbd> abrir/cerrar
            </span>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}

import { Crosshair, LayoutGrid, Users, Warehouse, Wrench } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/cn'
import type { WorkshopView } from '@/three'

const VIEWS: { key: WorkshopView; label: string; icon: typeof LayoutGrid; shortcut: string }[] = [
  { key: 'general', label: 'General', icon: LayoutGrid, shortcut: '1' },
  { key: 'bays', label: 'Elevadores', icon: Wrench, shortcut: '2' },
  { key: 'side', label: 'Almacén y equipo', icon: Warehouse, shortcut: '3' },
  { key: 'selected', label: 'Lo elegido', icon: Crosshair, shortcut: '4' },
]

/** Teclas 1-4 para las vistas, salvo si se está escribiendo o hay un diálogo o menú abierto. */
function useViewShortcuts(onView: (v: WorkshopView) => void, canSelected: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const t = e.target instanceof HTMLElement ? e.target : null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[role="menu"][data-state="open"]')) return
      const v = VIEWS.find((x) => x.shortcut === e.key)
      if (!v || (v.key === 'selected' && !canSelected)) return
      e.preventDefault()
      onView(v.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onView, canSelected])
}

const chip = cn(
  'inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition-colors duration-150',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink disabled:cursor-not-allowed disabled:opacity-50',
)

/**
 * Encuadres de la maqueta (teclas 1-4) y el filtro «Sin orden en curso» del equipo. Solo con la maqueta 3D: en la
 * vista 2D no hay cámara y el equipo se ve siempre en su lista.
 */
export function FloorViewBar({
  view,
  onView,
  hasSelection,
  idleCount,
  idleOn,
  onIdle,
}: {
  view: WorkshopView
  onView: (v: WorkshopView) => void
  hasSelection: boolean
  /** Personas sin orden en curso; null mientras carga el equipo. */
  idleCount: number | null
  idleOn: boolean
  onIdle: (on: boolean) => void
}) {
  useViewShortcuts(onView, hasSelection)
  const current = view === 'selected' && !hasSelection ? 'general' : view
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <div role="group" aria-label="Vista de la maqueta (teclas 1 a 4)" className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => {
          const Icon = v.icon
          const active = current === v.key
          return (
            <button
              key={v.key}
              type="button"
              aria-pressed={active}
              aria-keyshortcuts={v.shortcut}
              title={`${v.label} (tecla ${v.shortcut})`}
              disabled={v.key === 'selected' && !hasSelection}
              onClick={() => onView(v.key)}
              className={cn(chip, active ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface/80 text-fg-muted hover:text-fg')}
            >
              <Icon aria-hidden className="size-3.5" />
              {v.label}
            </button>
          )
        })}
      </div>
      <span aria-hidden className="mx-1 h-5 w-px bg-line" />
      <button
        type="button"
        aria-pressed={idleOn}
        disabled={idleCount === null}
        onClick={() => onIdle(!idleOn)}
        className={cn(chip, idleOn ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface/80 text-fg-muted hover:text-fg')}
      >
        <Users aria-hidden className="size-3.5" />
        Sin orden en curso
        {idleCount !== null && <span className="tabular">{idleCount}</span>}
      </button>
    </div>
  )
}

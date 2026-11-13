import { Car, ChevronDown, Plus, Warehouse } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { Workspace } from '@/api/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useAuth } from '@/features/auth/auth-context'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { cn } from '@/lib/cn'
import { ROLE_LABEL } from '@/lib/labels'

/** Icono del tipo de espacio, sin baldosa (R7). */
function WorkspaceIcon({ workspace, className }: { workspace: Pick<Workspace, 'type'>; className?: string }) {
  const Icon = workspace.type === 'workshop' ? Warehouse : Car
  return <Icon aria-hidden className={cn('size-4 shrink-0 text-fg-muted', className)} />
}

function workspaceName(w: Workspace) {
  return w.type === 'personal' ? 'Mi garaje' : w.name
}

/** Qué es el espacio, en dos palabras: va bajo el nombre en la cabecera. */
function workspaceKind(w: Workspace) {
  return w.type === 'personal' ? 'Particular' : `Taller · ${ROLE_LABEL[w.role]}`
}

/** Qué cambia al pasar a ese espacio (10/11/2026: el cambio entre garaje y taller no se entendía). */
const WHAT_YOU_SEE: Record<Workspace['type'], string> = {
  personal: 'Tus coches: kilómetros, gastos y avisos',
  workshop: 'Clientes, órdenes de trabajo, elevadores y equipo',
}

/**
 * Selector de espacio: dice en qué espacio estás (nombre y tipo, con su icono) y, al abrirlo, qué ves en cada uno.
 * Al cambiar, un aviso confirma el paso ("Ahora estás en Taller Demo").
 */
export function WorkspaceSwitcher({ compact }: { compact?: boolean }) {
  const { workspaces } = useAuth()
  const current = useOptionalWorkspace()
  const navigate = useNavigate()
  const active = current?.workspace

  const switchTo = (id: string) => {
    if (active && String(active.id) === id) return
    const next = workspaces.find((w) => String(w.id) === id)
    navigate(`/app/${id}`)
    if (next) toast(`Ahora estás en ${workspaceName(next)}`, { description: WHAT_YOU_SEE[next.type] })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex min-h-12 min-w-0 shrink items-center gap-2 rounded-xl border border-line bg-surface-2 py-1 pl-1.5 pr-2.5 text-left text-sm font-bold text-fg shadow-[0_2px_0_0_var(--line)] transition-[background-color,border-color,translate,scale,box-shadow] duration-150 ease-out-soft hover:border-line-strong hover:bg-accent-soft active:translate-y-px active:scale-[0.98] active:shadow-none data-[state=open]:border-accent data-[state=open]:bg-accent-soft lg:min-h-10',
          compact ? 'max-w-[11rem]' : 'max-w-[15rem]',
        )}
      >
        {active && (
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-on-accent shadow-[0_2px_0_0_var(--accent-edge)] max-sm:hidden">
            {active.type === 'workshop' ? <Warehouse className="size-4" /> : <Car className="size-4" />}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate leading-tight">{active ? workspaceName(active) : 'Elige un espacio'}</span>
          {active && <span className="hidden truncate text-xs font-semibold leading-tight text-fg-muted sm:block">{workspaceKind(active)}</span>}
        </span>
        <span className="sr-only"> Cambiar de espacio</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuLabel>{workspaces.length > 1 ? 'Cambiar de espacio' : 'Tu espacio'}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={active ? String(active.id) : ''} onValueChange={switchTo}>
          {workspaces.map((w) => (
            <DropdownMenuRadioItem key={w.id} value={String(w.id)} className="min-h-14 items-start py-2">
              <WorkspaceIcon workspace={w} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{workspaceName(w)}</span>
                <span className="block text-xs text-fg-muted">{WHAT_YOU_SEE[w.type]}</span>
                <span className="block truncate text-xs text-fg-subtle">
                  {workspaceKind(w)} · {w.vehicles_count} {w.vehicles_count === 1 ? 'vehículo' : 'vehículos'}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Plus aria-hidden />} onSelect={() => navigate('/app/ajustes#espacios')}>
          <span className="min-w-0">
            <span className="block">Crear un taller</span>
            <span className="block text-xs text-fg-muted">Para llevar clientes y órdenes de trabajo</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

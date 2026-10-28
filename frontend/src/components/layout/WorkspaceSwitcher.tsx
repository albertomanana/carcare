import { Car, ChevronDown, Plus, Warehouse } from 'lucide-react'
import { useNavigate } from 'react-router'
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

/** Selector de espacio: "Mi garaje" y los talleres a los que pertenece. */
export function WorkspaceSwitcher({ compact }: { compact?: boolean }) {
  const { workspaces } = useAuth()
  const current = useOptionalWorkspace()
  const navigate = useNavigate()
  const active = current?.workspace

  return (
    <DropdownMenu>
      {/* Texto ("Mi garaje ▾"), sin baldosa de icono (5.6) */}
      <DropdownMenuTrigger
        className={cn(
          'flex min-h-11 min-w-0 shrink items-center gap-1 rounded-control px-2 text-left text-sm font-medium text-fg transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2 md:min-h-10',
          compact ? 'max-w-[11rem]' : 'max-w-[14rem]',
        )}
        aria-label={`Espacio actual: ${active ? workspaceName(active) : 'ninguno'}. Cambiar de espacio`}
      >
        <span className="min-w-0 truncate">{active ? workspaceName(active) : 'Elige un espacio'}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Tus espacios</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={active ? String(active.id) : ''} onValueChange={(id) => navigate(`/app/${id}`)}>
          {workspaces.map((w) => (
            <DropdownMenuRadioItem key={w.id} value={String(w.id)} className="min-h-12">
              <WorkspaceIcon workspace={w} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{workspaceName(w)}</span>
                <span className="block truncate text-xs text-fg-subtle">
                  {w.type === 'personal' ? 'Particular' : `Taller · ${ROLE_LABEL[w.role]}`} · {w.vehicles_count} {w.vehicles_count === 1 ? 'vehículo' : 'vehículos'}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Plus aria-hidden />} onSelect={() => navigate('/app/ajustes#espacios')}>
          Crear un taller
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

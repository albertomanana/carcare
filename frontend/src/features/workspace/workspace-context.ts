import { createContext, useContext } from 'react'
import type { Workspace } from '@/api/types'
import { type Capability, can as canFn, canManageExpenses } from '@/lib/permissions'

export interface WorkspaceContextValue {
  workspace: Workspace
  id: number
  isPersonal: boolean
  isWorkshop: boolean
  /** Prefijo de rutas del espacio: '/app/12'. */
  base: string
  can: (capability: Capability) => boolean
  canExpenses: boolean
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function buildWorkspaceContext(workspace: Workspace): WorkspaceContextValue {
  return {
    workspace,
    id: workspace.id,
    isPersonal: workspace.type === 'personal',
    isWorkshop: workspace.type === 'workshop',
    base: `/app/${workspace.id}`,
    can: (capability) => canFn(workspace, capability),
    canExpenses: canManageExpenses(workspace),
  }
}

/** Espacio activo (definido por la URL /app/:ws). */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace debe usarse dentro de una ruta de espacio')
  return ctx
}

export function useOptionalWorkspace(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext)
}

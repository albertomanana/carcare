/** Capacidades por rol (contrato §2). La autorización real la hace el servidor; esto solo decide qué mostrar. */
import type { Workspace, WorkspaceRole } from '@/api/types'

export type Capability = 'view' | 'operate' | 'manage' | 'own'

const MATRIX: Record<Capability, WorkspaceRole[]> = {
  view: ['owner', 'manager', 'mechanic'],
  operate: ['owner', 'manager', 'mechanic'],
  manage: ['owner', 'manager'],
  own: ['owner'],
}

export function can(workspace: Pick<Workspace, 'role'> | null | undefined, capability: Capability): boolean {
  if (!workspace) return false
  return MATRIX[capability].includes(workspace.role)
}

/** Gastos: owner en personal; manage en talleres. */
export function canManageExpenses(workspace: Pick<Workspace, 'role' | 'type'> | null | undefined): boolean {
  if (!workspace) return false
  return workspace.type === 'personal' ? workspace.role === 'owner' : can(workspace, 'manage')
}
